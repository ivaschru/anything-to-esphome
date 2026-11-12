"""Private device profiles and the user-requested firmware update lifecycle.

Catalog polling never sends device commands. An install downloads and validates
public bytes, performs fresh encrypted identity/USB/settings reads, saves a
consumed intent, sends one encrypted APP, and only then verifies the result.
Neither an ACK, HA restart nor a timeout can authorize an automatic replay.
"""
from __future__ import annotations

import asyncio
import base64
from datetime import datetime, timezone
import hashlib
import json
import math
import secrets
import time
from urllib.parse import urljoin, urlsplit

from aioesphomeapi import APIClient, BinarySensorState, NumberState, SelectState, SensorState, SwitchState, TextSensorState, TimeState
from aiohttp import ClientError, ClientTimeout
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .firmware_catalog import (
    CATALOG_URL, MAX_INDEX_BYTES, Release, FirmwareError, parse_catalog,
    parse_monitor1_releases, asset_url, device_release_profile,
)
from .image import SLOTS, layout, mac_normalize, personalize, private_ipv4
from .native_ota import encryption_available, upload_app
from .lite_verification import history_entry

SETTINGS = {"PM sensor", "LED", "Night mode", "Bluetooth", "Bluetooth heat compensation",
            "Display design", "Screen transitions", "Display brightness", "Idle screen", "Idle screen delay", "Heat model",
            "Temperature offset", "Humidity offset", "Display", "PM standard",
            "Night mode start", "Night mode end", "Display heat", "Display heat at brightness 1",
            "Display heat lag", "Display heat time", "Bluetooth heat", "Bluetooth heat time"}
SOURCES = {"CO2", "Temperature (raw)", "Humidity (raw)"}
# Earlier public firmware has no design/motion selectors. Preserve every
# recognized control actually exposed by that build, with a conservative
# baseline so a missing or partial entity list cannot disable all guards.
BASE_SETTINGS = {"PM sensor", "LED", "Night mode", "Bluetooth", "Display brightness",
                 "Idle screen", "Idle screen delay", "Heat model", "Temperature offset", "Humidity offset"}
PRIVATE_FIELDS = {"ssid", "wifi_password", "name", "ap_ssid", "ap_password", "ota_password"}
STATE_TYPES = (BinarySensorState, NumberState, SelectState, SensorState, SwitchState, TextSensorState, TimeState)


def setting_state(value):
    # ESPHome TimeState has hour/minute/second, not .state. Serialize the full
    # value so restored nightly times are also protected across HA restarts.
    return [value.hour,value.minute,value.second] if isinstance(value,TimeState) else value.state


def private_values(record):
    """Legacy v1 records lack Wi-Fi/AP values: refuse rather than rotate them."""
    data = record.get("personalization")
    if (record.get("profile") not in {"lite", "lite-434"} or record.get("hardware") != "0001"
            or record.get("source_stock_version") not in {"4.3.4", "4.5.8"} or not isinstance(data, dict)
            or not PRIVATE_FIELDS.issubset(data) or data["name"] != record.get("name")
            or data["ota_password"] != record.get("ota_password")):
        raise FirmwareError("update_profile_required")
    if record.get("profile") == "lite-434" and record.get("source_stock_version") != "4.3.4":
        raise FirmwareError("update_profile_required")
    try:
        values = {key: data[key] for key in PRIVATE_FIELDS}
        if any(not isinstance(value, str) for value in values.values()):
            raise ValueError
        values["display_feed_entity"] = data.get("display_feed_entity", "")
        values["source_stock_version"] = record["source_stock_version"]
        values["noise_psk"] = base64.b64decode(record["noise_key"], validate=True)
        if len(values["noise_psk"]) != 32: raise ValueError
        return values
    except (KeyError, TypeError, ValueError):
        raise FirmwareError("update_profile_required") from None


def pending(record):
    attempt = record.get("update_attempt")
    return bool(attempt and attempt.get("state") not in ("verified",))


async def download_public(hass, url, limit):
    """Bound public GitHub downloads and validate each redirect before the GET.

No HA authorization header or private data is ever sent. GitHub assets use
signed CDN URLs, whose query strings must never appear in errors or logs.
"""
    session = async_get_clientsession(hass)
    allowed = {"github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com", "raw.githubusercontent.com"}
    try:
        for _ in range(4):
            parsed = urlsplit(url)
            if parsed.scheme != "https" or parsed.netloc not in allowed:
                raise FirmwareError("firmware_download_failed")
            if parsed.netloc == "raw.githubusercontent.com" and url != CATALOG_URL:
                asset_url(url)
            async with session.get(url, allow_redirects=False, timeout=ClientTimeout(total=30)) as response:
                if response.status in (301, 302, 303, 307, 308):
                    url = urljoin(url, response.headers.get("Location", ""))
                    continue
                if response.status != 200:
                    raise FirmwareError("firmware_download_failed")
                data = bytearray()
                async for chunk in response.content.iter_chunked(65536):
                    data.extend(chunk)
                    if len(data) > limit:
                        raise FirmwareError("firmware_download_failed")
                return bytes(data)
    except (ClientError, TimeoutError, ValueError):
        raise FirmwareError("firmware_download_failed") from None
    raise FirmwareError("firmware_download_failed")


async def fetch_catalog(hass, *, include_monitor1=False):
    try:
        data = json.loads(await download_public(hass, CATALOG_URL, MAX_INDEX_BYTES))
        releases = parse_catalog(data)
        if include_monitor1:
            releases.update(parse_monitor1_releases(data))
        return releases
    except (ValueError, UnicodeError):
        raise FirmwareError("invalid_catalog") from None


async def fetch_asset(hass, asset):
    data = await download_public(hass, asset.url, asset.size)
    if len(data) != asset.size or hashlib.sha256(data).hexdigest() != asset.sha256:
        raise FirmwareError("firmware_asset_mismatch")
    return data


def validate_template(data, manifest_bytes, release):
    """Both the index and original template manifest bind the same public app."""
    try:
        manifest = json.loads(manifest_bytes)
        if (release.profile not in {"lite", "lite-434"} or manifest["model"] != "CGDN1"
                or manifest["format"] != "esp32-app-fixed-slots-v1"
                or manifest["ui"] != release.version or manifest.get("public_version") != release.public_version or manifest["size"] != len(data)
                or release.version.encode() not in data
                or manifest["sha256"] != release.image.sha256
                or hashlib.sha256(data).hexdigest() != release.image.sha256):
            raise ValueError
        if release.profile == "lite-434" and (manifest.get("profile") != "lite-434"
                or manifest.get("source_stock_version") != "4.3.4" or manifest.get("hardware") != "0001"
                or manifest.get("fan_shutdown") is not False or manifest.get("pm_policy") != "lite-434-polling-only-v1"):
            raise ValueError
        layout(data)
        if any(data.count(marker) != manifest["slots"][key] or data.count(marker) < 1
               for key, marker in SLOTS.items()):
            raise ValueError
    except (KeyError, TypeError, ValueError, UnicodeError):
        raise FirmwareError("firmware_asset_mismatch") from None


class FirmwareUpdates:
    def __init__(self, manager, integration_version):
        self.manager, self.hass = manager, manager.hass
        self.integration_version = integration_version
        self.lock = asyncio.Lock()
        self.tasks = set()
        self.closed = False
        # Private test clocks exercise long readback windows without timers or
        # device IO. No runtime/user configuration changes these defaults.
        self._now, self._sleep = time.monotonic, asyncio.sleep

    async def stop(self):
        """Unload cancels only this updater's owned child operations."""
        self.closed = True
        tasks = list(self.tasks)
        for task in tasks: task.cancel()
        if tasks: await asyncio.gather(*tasks, return_exceptions=True)

    async def prepare_legacy(self, mac, data):
        """Explicit HA-only repair of a v1 installer's incomplete private record.

        API/OTA keys are retained. The old random fallback-AP password was not
        stored and cannot be recovered through the normal API: this form must
        explicitly acknowledge its replacement at the next update. Nothing
        is sent to the monitor while saving the profile.
        """
        if self.closed or self.lock.locked(): raise FirmwareError("firmware_update_busy")
        record = self.manager.records.get(mac)
        if (not record or record.get("outcome") != "native_verified"
                or record.get("schema_version", 1) >= 2 or pending(record)
                or data.get("confirm_profile") is not True):
            raise FirmwareError("update_profile_required")
        values = {name: data.get(name) for name in ("ssid", "wifi_password", "ap_ssid", "ap_password")}
        if (any(not isinstance(value, str) or "\0" in value for value in values.values())
                or not 1 <= len(values["ssid"].encode()) <= 32
                or len(values["wifi_password"].encode()) > 63
                or not 1 <= len(values["ap_ssid"].encode()) <= 32
                or not 8 <= len(values["ap_password"].encode()) <= 63):
            raise FirmwareError("update_profile_invalid")
        async with self.lock:
            client = None
            try:
                client, _ = await self.connect(mac, record)
                state = await self.snapshot(client)
                # This known public release is the historical v1 installer's
                # qualified direct-I2C image. Do not infer another board from
                # the shared CGDN1 marketing name or adopt private experiments.
                if state["Local UI version"] not in {"2026.11.04-ui25", "2026.11.06-ui25-polling1"}:
                    raise FirmwareError("update_unmanaged_firmware")
                upgraded = dict(record, schema_version=2, profile="lite", hardware="0001",
                                source_stock_version="4.5.8", firmware_version=state["Local UI version"],
                                firmware_revision=0,
                                personalization={**values, "name": record["name"],
                                                 "ota_password": record["ota_password"]})
                private_values(upgraded)
                self.manager.records[mac] = upgraded
                await self.manager.save_records()
            except FirmwareError:
                raise
            except Exception:
                raise FirmwareError("update_device_unavailable") from None
            finally:
                if client: await client.disconnect()

    def host(self, mac, record):
        # Prefer HA's current ESPHome address after DHCP changes, but never
        # identify a physical device merely from an IP or friendly name.
        for entry in self.hass.config_entries.async_entries("esphome"):
            try:
                if mac_normalize(entry.unique_id) == mac:
                    runtime = getattr(entry, "runtime_data", None)
                    if runtime and runtime.available:
                        # HA already resolved its .local address on a live
                        # authenticated connection. Still require RFC1918;
                        # connect() independently rechecks the physical MAC.
                        return private_ipv4(runtime.client.connected_address)
                    return private_ipv4(entry.data["host"])
            except (ValueError, KeyError, AttributeError):
                continue
        return private_ipv4(record["peer"])

    async def connect(self, mac, record):
        client = APIClient(self.host(mac, record), 6053, "", noise_psk=record["noise_key"],
                           client_info="Qingping firmware update")
        try:
            await asyncio.wait_for(client.connect(login=True, log_errors=False), 10)
            info = await client.device_info()
            if mac_normalize(info.mac_address) != mac or info.name != record["name"]:
                raise FirmwareError("update_identity_mismatch")
            private_ipv4(client.connected_address)
            return client, info
        except BaseException:
            await client.disconnect()
            raise

    async def snapshot(self, client):
        entities, _ = await client.list_entities_services()
        names = {entity.key: entity.name for entity in entities}
        present = set(names.values()) & SETTINGS
        if not BASE_SETTINGS.issubset(present):
            raise FirmwareError("update_device_unavailable")
        values = {}
        def state(value):
            if isinstance(value, STATE_TYPES) and value.key in names:
                name = names[value.key]
                if name in SETTINGS | SOURCES | {"Charging", "Local UI version"}:
                    values[name] = setting_state(value)
        client.subscribe_states(state)
        deadline = self._now() + 12
        required = present | SOURCES | {"Charging", "Local UI version"}
        while not required.issubset(values) and self._now() < deadline:
            await self._sleep(.1)
        if not required.issubset(values):
            raise FirmwareError("update_device_unavailable")
        if any(not math.isfinite(values[name]) for name in SOURCES):
            raise FirmwareError("update_sensor_check_failed")
        return values

    async def verify(self, mac, record, attempt):
        """Read-only recovery is the only continuation of an uncertain upload."""
        client = None
        deadline = self._now() + 120
        try:
            while self._now() < deadline:
                try:
                    client, info = await self.connect(mac, record)
                    values = await self.snapshot(client)
                    if values["Local UI version"] == attempt["version"]: break
                except (OSError, TimeoutError, FirmwareError):
                    pass
                except Exception:
                    pass  # No private SDK exception text crosses this boundary.
                if client: await client.disconnect(); client = None
                await self._sleep(3)
            if client is None or values.get("Local UI version") != attempt["version"]:
                raise FirmwareError("update_verification_required")
            before = attempt["settings_before"]
            if any(name not in values or values[name] != before[name] for name in before):
                raise FirmwareError("update_settings_changed")
            entities, _ = await client.list_entities_services()
            names = {entity.key: entity.name for entity in entities}
            samples = {name: [] for name in SOURCES}
            began = self._now()
            def state(value):
                elapsed = self._now() - began
                # Keep observing settings for the whole verification window;
                # a later subscription must not leave the initial snapshot
                # as our only evidence that persisted values survived boot.
                if isinstance(value, STATE_TYPES) and names.get(value.key) in SETTINGS:
                    values[names[value.key]] = setting_state(value)
                if isinstance(value, SensorState) and names.get(value.key) in samples and elapsed > 2:
                    samples[names[value.key]].append((elapsed, value.state))
            client.subscribe_states(state)
            while self._now() - began < 195:
                if all(len(rows) >= 3 and rows[-1][0] - rows[0][0] >= 100 for rows in samples.values()):
                    break
                await self._sleep(1)
            if any(len(rows) < 3 or rows[-1][0] - rows[0][0] < 100
                   or any(not math.isfinite(row[1]) for row in rows) for rows in samples.values()):
                raise FirmwareError("update_sensor_check_failed")
            if any(name not in values or values[name] != before[name] for name in before):
                raise FirmwareError("update_settings_changed")
            record.update(firmware_version=attempt["version"], firmware_revision=attempt["revision"],
                          template_sha256=attempt["template_sha256"], image_sha256=attempt["image_sha256"],
                          build=info.compilation_time, peer=private_ipv4(client.connected_address),
                          outcome="native_verified")
            if attempt.get("native_update") is True: record["native_update"] = True
            if attempt.get("profile") == "lite-434":
                record["profile"] = "lite-434"
            if attempt.get("public_version") is not None:
                record["public_version"] = attempt["public_version"]
            attempt["state"] = "verified"
            attempt.pop("error", None)
            await self.manager.save_records()
        finally:
            if client: await client.disconnect()

    async def install(self, mac, release, progress, phase):
        if self.closed: raise FirmwareError("firmware_update_busy")
        task = asyncio.create_task(self._install(mac, release, progress, phase), name="qingping-firmware-update")
        self.tasks.add(task)
        try:
            return await task
        finally:
            self.tasks.discard(task)

    async def _install(self, mac, release, progress, phase):
        if self.lock.locked(): raise FirmwareError("firmware_update_busy")
        async with self.lock:
            record = self.manager.records[mac]
            if pending(record):
                phase("verifying")
                await self.verify(mac, record, record["update_attempt"])
                return  # Never fall through into another OTA after recovery.
            if any(not task.done() for task in getattr(self.manager, "checks", {}).values()):
                raise FirmwareError("firmware_update_busy")
            if any(s.sent and s.state in ("sending", "waiting_for_esphome")
                   for s in self.manager.relay.sessions.values()):
                raise FirmwareError("firmware_update_busy")
            if (record.get("outcome") not in {"native_verified", "auto_adopted"} or not release
                    or device_release_profile(record) != release.profile
                    or not release.supports_install(self.integration_version)
                    or release.revision <= record.get("firmware_revision", 0)
                    or release.version == record.get("firmware_version")):
                raise FirmwareError("update_not_applicable")
            if not encryption_available(): raise FirmwareError("ota_encryption_unavailable")
            if record.get("origin") == "device_profile_v1":
                adoption = getattr(self.manager, "adoption", None)
                if not adoption or not await adoption.refresh(mac):
                    raise FirmwareError("update_device_unavailable")
                record = self.manager.records[mac]
                # A fresh device profile can reveal an already-installed
                # release. Never transfer merely because the UI was stale.
                if (device_release_profile(record) != release.profile or release.revision <= record.get("firmware_revision", 0)
                        or release.version == record.get("firmware_version")):
                    raise FirmwareError("update_not_applicable")
            values = private_values(record)
            phase("downloading")
            current = (await fetch_catalog(self.hass)).get(release.profile)
            if current != release: raise FirmwareError("update_catalog_changed")
            template = await fetch_asset(self.hass, release.image)
            metadata = await fetch_asset(self.hass, release.manifest)
            await self.hass.async_add_executor_job(validate_template, template, metadata, release)
            personalized = await self.hass.async_add_executor_job(personalize, template, values, release.image.sha256)
            app = personalized[:-4]  # Native OTA accepts APP, not stock's vendor CRC.
            phase("preflight")
            client = None
            try:
                client, _ = await self.connect(mac, record)
                snapshot = await self.snapshot(client)
                if snapshot["Charging"] is not True: raise FirmwareError("update_usb_required")
                if snapshot["Local UI version"] != record["firmware_version"]:
                    raise FirmwareError("update_unmanaged_firmware")
                host = private_ipv4(client.connected_address)
            except FirmwareError:
                raise
            except Exception:
                raise FirmwareError("update_device_unavailable") from None
            finally:
                if client: await client.disconnect()
            attempt = {"id": secrets.token_hex(16), "at": datetime.now(timezone.utc).isoformat(),
                       "version": release.version, "revision": release.revision, "profile": release.profile, "state": "consumed",
                       "from_version": record.get("public_version"),
                       "public_version": release.public_version,
                       "native_update": json.loads(metadata).get("native_update", {}).get("format") == "qingping-native-update-v1",
                       "template_sha256": release.image.sha256, "image_sha256": hashlib.sha256(app).hexdigest(),
                       "settings_before": {name: snapshot[name] for name in SETTINGS if name in snapshot}}
            # Archive only safe history fields before replacing the latest
            # attempt. The active attempt keeps its existing recovery snapshot.
            if previous := record.get("update_attempt"):
                record.setdefault("update_history", []).append(history_entry(previous))
            record["update_attempt"] = attempt
            # A failed journal prevents the first OTA connection; a persisted
            # consumed intent survives HA restart and cannot become a retry.
            await self.manager.save_records()
            phase("uploading")
            try:
                await upload_app(host, app, record["noise_key"], record["ota_password"], progress)
                attempt["state"] = "acknowledged"
                await self.manager.save_records()
            except BaseException as error:
                attempt["state"] = "needs_review"
                attempt["error"] = str(error) if isinstance(error, FirmwareError) else "native_unconfirmed"
                await asyncio.shield(self.manager.save_records())
                raise
            finally:
                del personalized, app, values, template
            phase("verifying")
            try:
                await self.verify(mac, record, attempt)
            except BaseException as error:
                attempt["state"] = "needs_review"
                attempt["error"] = str(error) if isinstance(error, FirmwareError) else "native_unconfirmed"
                await asyncio.shield(self.manager.save_records())
                raise
