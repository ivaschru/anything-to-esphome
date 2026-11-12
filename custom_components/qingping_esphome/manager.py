"""HA-owned sessions, private personalization and verified one-shot installation.

Only the prebuilt public template is distributed. Personal Wi-Fi/API/OTA data
stays in the authenticated HA connection and the selected device's LAN download.
HA's private Store retains the consumed intent and recovery keys before the
firmware command; restarting HA therefore never authorizes an automatic replay.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
from pathlib import Path
import secrets
import time
from datetime import datetime, timezone
from types import SimpleNamespace
from aiohttp import web

from homeassistant.helpers.storage import Store

from .catalog import CATALOG, admission
from .image import SLOTS, mac_normalize, personalize, private_ipv4
from .relay import Relay, Session
from .network_setup import async_detect_lan_host
from .errors import InstallerError
from .ha_bluetooth import HABluetooth
from .lite_verification import PROJECTS, history_entry, verify_native

DOMAIN = "qingping_esphome"
TEMPLATE_ROOT = Path(__file__).parent / "firmware"
AP_PREVIEW_SECONDS = 30 * 60


def _read_lite_template_metadata(root, profile, stock_version, hardware):
    """Resolve the same bundled template for preview and installation."""
    # Factory stock provenance selects its own PM policy and image. A missing
    # package for 4.3.4 must never fall back to the 4.5.8 template.
    if profile["id"] == "lite-434":
        stem, policy = "lite-434-template", "lite-434-polling-only-v1"
    else:
        stem, policy = "lite-template", "quiet-scd4x-window-v1"
    binary = root / (stem + ".bin")
    try:
        manifest = json.loads((root / (stem + ".json")).read_text(encoding="utf-8"))
        if not binary.is_file():
            raise InstallerError("template_missing")
    except FileNotFoundError:
        raise InstallerError("template_missing") from None
    except (OSError, UnicodeError, json.JSONDecodeError):
        raise InstallerError("template_invalid") from None
    if (not isinstance(manifest, dict) or manifest.get("profile") != profile["id"]
            or manifest.get("model") != profile["model"]
            or manifest.get("source_stock_version") != stock_version
            or manifest.get("hardware") != hardware or manifest.get("pm_policy") != policy
            or manifest.get("format") != "esp32-app-fixed-slots-v1"
            or not isinstance(manifest.get("ui"), str) or not manifest["ui"]
            or type(manifest.get("public_version")) is not int or manifest["public_version"] < 1):
        raise InstallerError("template_invalid")
    return manifest, binary


def _catalog_with_lite_versions(root):
    models = []
    for profile in CATALOG:
        model = dict(profile)
        if profile["id"] in ("lite", "lite-434"):
            try:
                manifest, _ = _read_lite_template_metadata(
                    root, profile, profile["stock_versions"][0], profile["hardware_versions"][0])
                model["public_version"] = manifest["public_version"]
            except InstallerError as error:
                # Keep other profiles usable when a Lite release pair is missing.
                model["template_error"] = error.code
        models.append(model)
    return {"models": models, "brands": ["qingping", "sonoff"]}


class Manager:
    def __init__(self, hass, entry):
        self.hass, self.entry = hass, entry
        self.settings = {**entry.data, **getattr(entry, "options", {})}
        self.host = private_ipv4(self.settings["lan_host"])
        self.http_port, self.mqtt_port = self.settings["http_port"], self.settings["mqtt_port"]
        self.store = Store(hass, 1, DOMAIN + ".installations", private=True, atomic_writes=True)
        self.records = {}
        self.wifi_store = Store(hass, 1, DOMAIN + ".remembered_wifi", private=True, atomic_writes=True)
        self.remembered_wifi = {}
        self.wifi_lock = asyncio.Lock()
        self.wifi_generation = {}
        self.ap_previews = {}
        self.record_listeners = set()
        self.records_lock = asyncio.Lock()
        self.updates = None
        self.adoption = None
        self.checks = {}
        self.relay = Relay(self.firmware_url, self.consume_intent)
        self.cleanup_task = None
        self.http_runner = None
        self.bluetooth = HABluetooth(hass)
        self.ble_settings = {}
        self.ble_tasks = {}

    async def start(self):
        if self.settings.get("automatic_network"):
            # Refresh after a DHCP change or restart; existing manually
            # configured entries remain manual until their owner changes it.
            self.host = await async_detect_lan_host(self.hass)
        self.records = await self.store.async_load() or {}
        self.remembered_wifi = await self.wifi_store.async_load() or {}
        await self.relay.start(self.mqtt_port)
        # Stock expects plain HTTP even when HA itself is served over HTTPS.
        # A dedicated LAN listener avoids weakening HA authentication or TLS.
        app = web.Application(client_max_size=1024)
        app.router.add_get("/firmware/{session_id}.bin", self.download)
        self.http_runner = web.AppRunner(app, access_log=None)
        try:
            await self.http_runner.setup()
            await web.TCPSite(self.http_runner, self.host, self.http_port).start()
        except Exception:
            await self.http_runner.cleanup()
            await self.relay.stop()
            raise
        self.cleanup_task = asyncio.create_task(self.cleanup(), name="qingping-session-expiry")

    async def stop(self):
        if self.adoption: await self.adoption.stop()
        if self.updates: await self.updates.stop()
        if self.cleanup_task: self.cleanup_task.cancel()
        for task in self.checks.values(): task.cancel()
        for task in self.ble_tasks.values(): task.cancel()
        await asyncio.gather(*(list(self.checks.values()) + list(self.ble_tasks.values()) + ([self.cleanup_task] if self.cleanup_task else [])), return_exceptions=True)
        self.ble_settings.clear()
        self.ble_tasks.clear()
        await self.bluetooth.stop()
        if self.http_runner: await self.http_runner.cleanup()
        await self.relay.stop()

    def add_record_listener(self, callback):
        self.record_listeners.add(callback)
        return lambda: self.record_listeners.discard(callback)

    async def save_records(self):
        """Serialize the private journal before notifying standard HA entities."""
        async with self.records_lock:
            await self.store.async_save(self.records)
        for callback in tuple(self.record_listeners):
            try:
                callback()
            except Exception:
                # UI notification failure must not turn a committed intent
                # into an apparent storage failure or expose private records.
                logging.getLogger(__name__).error("Could not refresh a Qingping firmware entity")

    async def cleanup(self):
        try:
            while True:
                await asyncio.sleep(30)
                self.relay.expire()
                self.bluetooth.expire()
                now = time.monotonic()
                self.ap_previews = {owner: preview for owner, preview in self.ap_previews.items()
                                    if preview["expires"] > now}
                for key in list(self.ble_settings):
                    if key not in self.relay.sessions: self.ble_settings.pop(key)
                expired_tasks = []
                for key, task in list(self.ble_tasks.items()):
                    if task.done() or key not in self.relay.sessions:
                        self.ble_tasks.pop(key)
                        if not task.done(): task.cancel(); expired_tasks.append(task)
                if expired_tasks: await asyncio.gather(*expired_tasks, return_exceptions=True)
        except asyncio.CancelledError:
            return

    def firmware_url(self, session):
        # Explicit private IPv4 avoids DNS rebinding and cloud HTTP downloads.
        return f"http://{self.host}:{self.http_port}/firmware/{session.id}.bin"

    async def download(self, request):
        self.relay.expire()
        session = self.relay.sessions.get(request.match_info["session_id"])
        # Read the actual TCP peer, never a proxy-supplied Forwarded header.
        peer = request.transport.get_extra_info("peername") if request.transport else None
        if not session or not session.sent or not session.image or not peer or peer[0] != session.peer:
            raise web.HTTPNotFound()
        first_download = not session.downloaded
        session.downloaded = True
        # Serving bytes is only a reason to begin read-only native checks.
        # It is not a successful flash, nor dependent on a stock progress key.
        record = self.records.get(session.mac)
        if first_download and record and record.get("session_id") == session.id and not self._check_status(session.mac, record)["verified"]:
            # Start the readback even if the browser has stopped polling.
            self._start_check(session.mac, record, session)
        return web.Response(body=session.image, content_type="application/octet-stream",
                            headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})

    def get(self, session_id, owner):
        self.relay.expire()
        session = self.relay.sessions.get(session_id)
        if not session or session.owner != owner:
            raise InstallerError("session_missing")
        return session

    async def catalog(self):
        return await self.hass.async_add_executor_job(_catalog_with_lite_versions, TEMPLATE_ROOT)

    async def create(self, owner, data):
        profile = admission(data["profile"], data["model"], data["stock_version"])
        if data.get("hardware") != "0001": raise InstallerError("hardware_unverified")
        if data.get("usb") is not True: raise InstallerError("usb_required")
        transport = data.get("transport", "browser")
        if transport not in ("browser", "ha"): raise InstallerError("invalid_request")
        selected = None
        if transport == "ha":
            selected = self.bluetooth.selected(owner, data.get("selection"), data)
        try:
            mac = mac_normalize(data["mac"])
        except ValueError as error:
            raise InstallerError("invalid_mac") from error
        prior = self.records.get(mac)
        if prior and prior.get("command_consumed"):
            raise InstallerError("already_sent")
        wifi_generation = self.wifi_generation.get(owner, 0)
        if data.get("use_saved_wifi") is True:
            if transport != "ha":
                raise InstallerError("invalid_request")
            saved = self.remembered_wifi.get(owner)
            if not saved or saved.get("revision") != data.get("saved_wifi_revision"):
                raise InstallerError("lite_wifi_not_saved")
            ssid, password = saved["ssid"], saved["password"]
        else:
            ssid, password = data["ssid"], data["wifi_password"]
        if not 1 <= len(ssid.encode()) <= 32 or len(password.encode()) > 63:
            raise InstallerError("wifi_length")
        if any(c in ssid + password for c in ('"', '\\', '\r', '\n', '\0')):
            raise InstallerError("wifi_characters")
        manifest, binary = await self.hass.async_add_executor_job(
            _read_lite_template_metadata, TEMPLATE_ROOT, profile, data["stock_version"], data["hardware"])
        try:
            template = await self.hass.async_add_executor_job(binary.read_bytes)
        except OSError:
            raise InstallerError("template_missing") from None
        if manifest.get("size") != len(template):
            raise InstallerError("template_invalid")
        # If the owner revealed a preview, require that exact still-valid
        # password. Never silently substitute a password they did not copy.
        ap_password = self._ap_password(owner, mac, data.get("ap_token"))
        psk = secrets.token_bytes(32)
        name = "qingping-" + mac.lower() + "-" + secrets.token_hex(5)[:9]
        values = {"display_feed_entity": "", "source_stock_version": data["stock_version"], "ssid": ssid, "wifi_password": password, "name": name,
                  "ap_ssid": "Qingping-" + mac[-6:], "ap_password": ap_password,
                  "ota_password": secrets.token_hex(16), "noise_psk": psk}
        try:
            image = await self.hass.async_add_executor_job(personalize, template, values, manifest["sha256"])
        except ValueError as error:
            raise InstallerError("template_invalid") from error
        session = Session(id=secrets.token_hex(12), owner=owner, mac=mac,
                          stock_version=data["stock_version"], name=name, image=image,
                          noise_key=base64.b64encode(psk).decode(), ota_password=values["ota_password"])
        session.profile = data["profile"]
        session.firmware_version = manifest.get("ui")
        session.public_version = manifest["public_version"]
        session.template_sha256 = manifest["sha256"]
        session.personalization = {key: value for key, value in values.items() if key != "noise_psk"}
        session.transport = transport
        session.remember_wifi = (data.get("remember_wifi") is True and data.get("use_saved_wifi") is not True
                                 and wifi_generation == self.wifi_generation.get(owner, 0))
        self.relay.add(session)
        if selected is not None:
            # Bind once to a verified, owner-scoped read selection. Credentials
            # exist only in RAM until the single provisioning task takes them.
            self.ble_settings[session.id] = (selected, ssid, password)
            self.bluetooth.selections.pop(data["selection"])
        return {**session.public(), "broker": self.broker(session)}

    def broker(self, session):
        return {"host": self.host, "port": self.mqtt_port,
                "username": session.username, "password": session.password,
                "client_id": session.client_id, "up": session.up, "down": session.down}

    async def provision(self, session_id, owner):
        session = self.get(session_id, owner)
        if session.transport != "ha" or session.sent or session.provisioning_started:
            raise InstallerError("ha_bluetooth_setup_started")
        settings = self.ble_settings.pop(session.id, None)
        if settings is None: raise InstallerError("ha_bluetooth_selection_expired")
        # Reserve before yielding: two browser tabs cannot issue the same setup.
        # Shield the tracked task from a disconnected WebSocket; it never arms
        # OTA on its own, and an ambiguous call is reconciled through status.
        session.provisioning_started = True
        session.state = "provisioning"
        task = asyncio.create_task(self._provision(session, settings), name="qingping-ha-bluetooth")
        self.ble_tasks[session.id] = task
        try:
            return await asyncio.shield(task)
        finally:
            if task.done(): self.ble_tasks.pop(session.id, None)

    async def _provision(self, session, settings):
        selected, ssid, password = settings
        try:
            async with asyncio.timeout(100):
                async with self.bluetooth.connection(selected.address) as stock:
                    identity = await stock.initialize()
                    if identity != selected.identity:
                        raise InstallerError("selected_changed")
                    def progress(state):
                        # MQTT may already have detected a mismatch; never
                        # overwrite that terminal state with cosmetic progress.
                        if session.state not in ("identity_mismatch", "needs_review"):
                            session.state = state
                    await stock.provision(identity, ssid, password, self.broker(session), progress)
            session.provisioned = True
            if session.state not in ("identity_mismatch", "needs_review"):
                session.state = "ready" if session.mac_verified and session.version_verified and session.subscribed else "waiting_for_device"
        except asyncio.CancelledError:
            session.state = "needs_review"; session.error = "ha_bluetooth_failed"
            raise
        except Exception as error:
            session.state = "needs_review"
            session.error = error.code if isinstance(error, InstallerError) else "ha_bluetooth_failed"
        return session.public()

    async def arm(self, session_id, owner):
        session = self.get(session_id, owner)
        if session.transport == "ha" and not session.provisioned:
            raise InstallerError("ha_bluetooth_setup_incomplete")
        session.armed = True
        await self.relay.maybe_flash(session)
        return session.public()

    def cancel(self, session_id, owner):
        session = self.get(session_id, owner)
        if session.sent: raise InstallerError("already_sent")
        task = self.ble_tasks.get(session.id)
        if task and not task.done(): raise InstallerError("ha_bluetooth_busy")
        if session.writer: session.writer.close()
        session.image = b""
        self.ble_settings.pop(session.id, None)
        self.ble_tasks.pop(session.id, None)
        self.relay.sessions.pop(session.id)
        return {"cancelled": True}

    async def consume_intent(self, session):
        if self.updates and self.updates.lock.locked():
            raise InstallerError("firmware_update_busy")
        old = self.records.get(session.mac)
        if old and old.get("command_consumed"):
            raise InstallerError("already_sent")
        self.records[session.mac] = {
            "at": datetime.now(timezone.utc).isoformat(), "owner": session.owner,
            "name": session.name, "peer": session.peer, "command_consumed": True,
            "image_sha256": hashlib.sha256(session.image).hexdigest(),
            "noise_key": session.noise_key, "ota_password": session.ota_password,
            "schema_version": 2, "profile": session.profile, "hardware": "0001",
            "source_stock_version": session.stock_version,
            "firmware_version": session.firmware_version, "firmware_revision": 0,
            "public_version": session.public_version,
            "template_sha256": session.template_sha256,
            "personalization": dict(session.personalization),
            "session_id": session.id,
            "install_version": session.public_version,
            "remember_wifi": session.remember_wifi,
            "outcome": "sent_requires_verification",
        }
        # This is private HA storage, never a GitHub file or a diagnostic log.
        await self.save_records()

    def _owned_record(self, owner, mac):
        mac = mac_normalize(mac)
        record = self.records.get(mac)
        if (not record or record.get("owner") != owner or not record.get("command_consumed")
                or record.get("profile") not in PROJECTS):
            raise InstallerError("session_missing")
        return mac, record

    def saved_wifi(self, owner):
        saved = self.remembered_wifi.get(owner)
        return {"ssid": saved["ssid"], "revision": saved["revision"]} if saved else {"ssid": None}

    async def forget_wifi(self, owner):
        async with self.wifi_lock:
            self.wifi_generation[owner] = self.wifi_generation.get(owner, 0) + 1
            self.remembered_wifi.pop(owner, None)
            await self.wifi_store.async_save(self.remembered_wifi)
            # Forget also revokes an outstanding opt-in on an unfinished
            # install, so a later retry cannot silently recreate the entry.
            for record in self.records.values():
                if record.get("owner") == owner:
                    record.pop("remember_wifi", None)
            for session in self.relay.sessions.values():
                if session.owner == owner:
                    session.remember_wifi = False
            await self.save_records()
        return self.saved_wifi(owner)

    async def _remember_verified_wifi(self, record):
        async with self.wifi_lock:
            if record.get("remember_wifi") is not True:
                return
            values = record["personalization"]
            self.remembered_wifi[record["owner"]] = {
                "ssid": values["ssid"], "password": values["wifi_password"], "revision": secrets.token_hex(8)}
            await self.wifi_store.async_save(self.remembered_wifi)
            record.pop("remember_wifi", None)

    def preview_ap(self, owner, mac):
        mac = mac_normalize(mac)
        preview = self.ap_previews.get(owner)
        if not preview or preview["mac"] != mac or preview["expires"] <= time.monotonic():
            preview = {"mac": mac, "password": secrets.token_hex(8), "token": secrets.token_hex(16),
                       "expires": time.monotonic() + AP_PREVIEW_SECONDS}
            self.ap_previews[owner] = preview
        return {"ssid": "Qingping-" + mac[-6:], "password": preview["password"], "token": preview["token"]}

    def _ap_password(self, owner, mac, token):
        if token is None:
            return secrets.token_hex(8)
        preview = self.ap_previews.get(owner)
        if (not isinstance(token, str) or not preview or preview["mac"] != mac
                or preview["expires"] <= time.monotonic() or token != preview["token"]):
            raise InstallerError("lite_ap_preview_expired")
        return preview["password"]

    def reveal_ap(self, owner, mac):
        _, record = self._owned_record(owner, mac)
        values = record.get("personalization") or {}
        if not values.get("ap_ssid") or not values.get("ap_password"):
            raise InstallerError("lite_ap_unavailable")
        return {"ssid": values["ap_ssid"], "password": values["ap_password"]}

    def _check_status(self, mac, record):
        task = self.checks.get(mac)
        result = dict(record.get("verification") or {})
        result["running"] = task is not None and not task.done()
        result["verified"] = record.get("outcome") == "native_verified"
        if result["verified"] and not result.get("stage"):
            result["stage"] = ("lite_check_added" if record.get("ha_enrollment") == "created"
                               else "lite_check_manual_add")
        return result

    def lite_installations(self, owner):
        devices = []
        for mac, record in self.records.items():
            if (record.get("owner") != owner or not record.get("command_consumed")
                    or record.get("profile") not in PROJECTS):
                continue
            values = record.get("personalization") or {}
            attempt = record.get("update_attempt")
            initial = {"at": record.get("at"), "from_version": record.get("source_stock_version"),
                       "public_version": record.get("install_version") or
                       (record.get("public_version") if not attempt else None),
                       "state": ("verified" if record.get("outcome") == "native_verified" else "needs_review"),
                       "error": (record.get("verification") or {}).get("error")}
            history = [initial, *(history_entry(item) for item in record.get("update_history", []))]
            if isinstance(attempt, dict):
                history.append(history_entry(attempt))
            devices.append({"mac": mac, "name": record["name"], "ap_ssid": values.get("ap_ssid"),
                            "ap_available": bool(values.get("ap_password")),
                            "verification": self._check_status(mac, record), "history": history[::-1]})
        return {"devices": devices}

    def _start_check(self, mac, record, session=None):
        running = self.checks.get(mac)
        if running and not running.done():
            return
        self.checks[mac] = asyncio.create_task(self._verify_installation(mac, record, session),
                                              name="qingping-native-verification")

    def retry_lite(self, owner, mac):
        mac, record = self._owned_record(owner, mac)
        if record.get("outcome") == "native_verified":
            return self._check_status(mac, record)
        if self.updates and self.updates.lock.locked():
            raise InstallerError("firmware_update_busy")
        if type(record.get("public_version")) is not int or record["public_version"] < 1 or not record.get("noise_key"):
            raise InstallerError("lite_verification_unavailable")
        session = self.relay.sessions.get(record.get("session_id"))
        self._start_check(mac, record, session)
        return self._check_status(mac, record)

    async def status(self, session_id, owner):
        session = self.get(session_id, owner)
        if session.sent and session.state == "sending" and time.monotonic() - session.sent_at > 180:
            session.state = "needs_review"
            session.error = "ota_timeout"
        result = session.public()
        record = self.records.get(session.mac)
        if record and record.get("session_id") == session.id and record.get("owner") == owner:
            result["verification"] = self._check_status(session.mac, record)
            if result["verification"]["running"]:
                result.update(state="waiting_for_esphome", error=None, error_code=None)
            elif result["verification"]["verified"]:
                result.update(state="installed", error=None, error_code=None)
            elif code := result["verification"].get("error"):
                result.update(state="needs_review", error=code, error_code=code)
        return result

    async def verify(self, session):
        await self._verify_installation(session.mac, self.records[session.mac], session)

    async def _verify_installation(self, mac, record, session=None):
        connected = False

        def report(stage, missing=()):
            nonlocal connected
            connected |= stage == "lite_check_readings"
            record["verification"] = {"stage": stage, "missing": list(missing)}

        if session:
            session.state = "waiting_for_esphome"
            session.error = None
        try:
            host, info = await verify_native(self.hass, mac, record, report)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            code = error.code if isinstance(error, InstallerError) else "native_unconfirmed"
            record.setdefault("verification", {})["error"] = code
            if session:
                session.state = "needs_review"
                session.error = code
        else:
            record.update(outcome="native_verified", build=info.compilation_time, peer=host)
            report("lite_check_enrollment")
            try:
                # A restarted HA needs only the durable identity and API key.
                # Enrollment uses the authenticated current address, not the stock peer.
                target = SimpleNamespace(peer=host, noise_key=record["noise_key"], mac=mac)
                async with asyncio.timeout(20):
                    record["ha_enrollment"] = await self.enroll(target)
            except Exception:
                record["ha_enrollment"] = "manual_flow_required"
            report("lite_check_added" if record["ha_enrollment"] == "created" else "lite_check_manual_add")
            if session:
                session.state = "installed"
                session.image = b""
                session.error = None
        try:
            if connected:
                await self._remember_verified_wifi(record)
            await self.save_records()
        except Exception:
            # Storage failures are visible without logging credential-bearing data.
            record.setdefault("verification", {})["error"] = "lite_verification_storage"

    async def enroll(self, session):
        existing = [e for e in self.hass.config_entries.async_entries("esphome") if e.data.get("host") == session.peer]
        for entry in existing:
            try:
                if mac_normalize(entry.unique_id) == session.mac:
                    return "created"
            except (TypeError, ValueError, AttributeError):
                continue
        if existing:
            return "existing_entry_check_required"
        flow = await self.hass.config_entries.flow.async_init("esphome", context={"source": "user"},
                                                           data={"host": session.peer, "port": 6053})
        for _ in range(4):
            if flow.get("type") == "create_entry": return "created"
            if flow.get("type") == "abort": return "existing_or_pending_flow"
            if flow.get("step_id") == "encryption_key": body = {"noise_psk": session.noise_key}
            elif flow.get("step_id") == "discovery_confirm": body = {}
            else: return "manual_flow_required"
            flow = await self.hass.config_entries.flow.async_configure(flow["flow_id"], body)
        return "manual_flow_required"
