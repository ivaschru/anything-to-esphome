"""Owner-bound S60TPF installation lifecycle for the existing HA service domain.

Discovery and sign-in never start a conversion. A separate administrator's
Install click binds the exact selected identity, load acknowledgement and
fresh cloud/LAN readback, then consumes one durable intent before the only
worker spawn. Reload/status cannot clear or replay uncertain installation.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import math
from pathlib import Path
import secrets
import struct
import time
from zoneinfo import ZoneInfo, TZPATH

from aioesphomeapi import APIClient, SensorInfo, SwitchInfo, TextSensorInfo, UpdateInfo
from homeassistant.helpers.storage import Store

from .sonoff_discovery import Account, decrypt_advert, discover, sonoff_inventory
from .sonoff_mdns import probe_target
from .sonoff_policy import (MODEL, PROFILE, STOCK, SonoffError, canonical_mac,
                            lan_address, require_selection)
from .sonoff_runtime import Runtime, private_write, progress

ROOT = Path(__file__).parent


def timezone_rule(name):
    """Encode HA's future calendar rule in the pinned SDK's 32-byte wire form.

    ESPHome 2026.10 pre-parses timezones and no longer uses libc TZ setters.
    Encode explicit little-endian fields, including both DST transitions,
    rather than today's UTC offset. Hex occupies exactly the 64-byte slot;
    C++ decodes fields explicitly instead of relying on struct ABI/padding.
    """
    from aioesphomeapi.posix_tz import parse_posix_tz
    ZoneInfo(name)
    if name in {"UTC", "Etc/UTC", "Etc/GMT"}:
        return bytes(32).hex()
    if name.startswith("/") or ".." in name.split("/"):
        raise SonoffError("sonoff_invalid_request")
    values = []
    for root in TZPATH:
        try:
            values.append((Path(root) / name).read_bytes())
        except OSError:
            pass
    if not values:
        from importlib.resources import files
        values.append(files("tzdata.zoneinfo").joinpath(*name.split("/")).read_bytes())
    for raw in values:
        if raw.startswith(b"TZif") and raw.endswith(b"\n"):
            rule = raw.rsplit(b"\n", 2)[-2].decode("ascii")
            if 1 <= len(rule) <= 64 and "\0" not in rule:
                parsed = parse_posix_tz(rule)
                encoded = struct.pack("<ii", parsed.std_offset_seconds, parsed.dst_offset_seconds)
                for transition in (parsed.dst_start, parsed.dst_end):
                    encoded += struct.pack("<iHBBBB2x", transition.time_seconds, transition.day,
                                           int(transition.type), transition.month,
                                           transition.week, transition.day_of_week)
                return encoded.hex()
    raise SonoffError("sonoff_invalid_request")


class Sonoff:
    def __init__(self, manager):
        self.manager, self.hass = manager, manager.hass
        self.account = Account(self.hass)
        self.root = Path(self.hass.config.path(".storage", "anything_sonoff"))
        self.runtime = Runtime(self.hass, self.root)
        self.store = Store(self.hass, 1, "qingping_esphome.sonoff", private=True, atomic_writes=True)
        self.records, self.selections, self.accounts = {}, {}, {}
        self.lock = asyncio.Lock()
        self.tasks = set()
        self.active = True

    async def start(self):
        self.records = await self.store.async_load() or {}
        # A host restart is not a process handle or permission to spawn again.
        # Keep the original job/backups/history and require outcome review.
        for value in self.records.values():
            if value.get("state") in {"preparing", "running", "verifying"}:
                value["state"] = "outcome_unknown"

    async def stop(self):
        # No terminate()/cancel() of an active firmware writer on UI unload.
        # Its original worker retains the request/backup and process lifetime.
        self.active = False
        self.selections.clear()
        self.accounts.clear()

    def add_devices(self, owner, devices):
        now = time.monotonic()
        self.selections = {key: value for key, value in self.selections.items()
                           if value["expires"] > now and value["owner"] != owner}
        result = []
        for device in devices[:128]:
            token = secrets.token_hex(16)
            self.selections[token] = {"owner": owner, "device": device, "expires": now + 300}
            result.append(device.public(token))
        return result

    async def scan(self, owner):
        devices = sonoff_inventory(self.hass)
        account = self.accounts.get(owner)
        if account and account["expires"] > time.monotonic():
            devices = await self.account.devices(account["region"], account["auth"])
        sightings = await discover(self.hass)
        for device in devices:
            if device.device_id in sightings:
                device.host = sightings[device.device_id]["host"]
        return {"devices": self.add_devices(owner, devices), "found_on_lan": len(sightings),
                "needs_login": not devices or all(not d.auth for d in devices)}

    async def login(self, owner, data):
        region, auth = await self.account.login(data.get("username"), data.get("password"),
                                               data.get("region", "eu"), data.get("country_code", "+7"))
        devices = await self.account.devices(region, auth)
        self.accounts[owner] = {"region": region, "auth": auth, "expires": time.monotonic() + 1800}
        return {"devices": self.add_devices(owner, devices), "needs_login": False}

    async def preflight(self, device, manual_host=None):
        device.require_key()
        if not device.auth or not device.auth.get("at"):
            raise SonoffError("sonoff_auth_required")
        devices = await self.account.devices(device.region, device.auth)
        matches = [d for d in devices if d.device_id == device.device_id and d.mac == device.mac]
        if len(matches) != 1 or matches[0].raw.get("online") is not True:
            raise SonoffError("sonoff_identity_changed")
        current = matches[0]
        host = manual_host or device.host or current.host
        if host:
            observation = await probe_target(lan_address(host), current.device_id)
        else:
            observation = (await discover(self.hass)).get(current.device_id)
            if not observation:
                raise SonoffError("sonoff_unavailable")
        state = decrypt_advert(observation["fields"], current.require_key())
        signal = state.get("rssi")
        if isinstance(signal, int) and signal < -75:
            raise SonoffError("sonoff_unavailable")
        current.host = observation["host"]
        return current, {"relay": state["switch"], "rssi": signal}

    async def select(self, owner, data):
        selected = self.selections.get(data.get("selection"))
        device = require_selection(selected, owner)
        current, observed = await self.preflight(device, data.get("host") or None)
        selected["device"] = current
        return {**current.public(data["selection"]), **observed, "ready": True}

    async def install(self, owner, data):
        if not self.active or self.lock.locked():
            raise SonoffError("sonoff_busy")
        if data.get("load_ack") is not True or data.get("power_loss_ack") is not True:
            raise SonoffError("sonoff_load_ack")
        device = require_selection(self.selections.get(data.get("selection")), owner)
        if any(value.get("mac") == device.mac or value.get("state") in {"running", "verifying", "outcome_unknown"}
               for value in self.records.values()):
            raise SonoffError("sonoff_busy")
        async with self.lock:
            device, _ = await self.preflight(device)
            manifest_path = ROOT / "firmware/sonoff-s60tpf-template.json"
            binary_path = ROOT / "firmware/sonoff-s60tpf-template.bin"
            try:
                manifest = json.loads(await self.hass.async_add_executor_job(manifest_path.read_text))
                binary = await self.hass.async_add_executor_job(binary_path.read_bytes)
                from .sonoff_image import layout
                layout(binary)
                if (manifest.get("profile") != PROFILE or manifest.get("size") != len(binary)
                        or manifest.get("sha256") != hashlib.sha256(binary).hexdigest()):
                    raise ValueError
            except (OSError, ValueError):
                raise SonoffError("sonoff_template_missing") from None
            rule = await self.hass.async_add_executor_job(timezone_rule, self.hass.config.time_zone)
            job_id = secrets.token_hex(16)
            job = await self.runtime.prepare(job_id)
            noise = secrets.token_bytes(32)
            values = {"name": "s60-" + device.mac.replace(":", "").lower() + "-" + secrets.token_hex(7),
                      "noise_psk": base64.b64encode(noise).decode(),
                      "ota_password": secrets.token_urlsafe(24), "ap_password": secrets.token_urlsafe(18),
                      "ap_ssid": "S60 Recovery " + device.mac.replace(":", "")[-6:],
                      # Slot zero is the calendar rule in this separate profile.
                      "display_feed_entity": rule, "source_stock_version": STOCK}
            request = {"format": "anything-sonoff-job-v1", "device_id": device.device_id,
                       "mac": device.mac, "host": device.host, "lan_host": self.manager.host,
                       "auth": device.auth, "region": device.region, "values": values}
            record = {"owner": owner, "mac": device.mac, "host": device.host, "name": device.name,
                      "state": "running", "consumed": True, "values": values,
                      "bluetooth_proxy": data.get("bluetooth_proxy") is True}
            self.records[job_id] = record
            # Durable write precedes spawn. A failure from here onward remains
            # uncertain even when the HTTP/WebSocket reply never reaches HA UI.
            await self.store.async_save(self.records)
            try:
                process = await self.runtime.launch(job, request)
            except Exception:
                record["state"] = "outcome_unknown"
                await self.store.async_save(self.records)
                raise SonoffError("sonoff_outcome_unknown") from None
            task = self.hass.async_create_background_task(self.watch(job_id, process), "S60TPF conversion")
            self.tasks.add(task)
            task.add_done_callback(self.tasks.discard)
            return self.public_job(job_id, owner)

    async def watch(self, job_id, process):
        record = self.records[job_id]
        try:
            async with asyncio.timeout(2400):
                result = await process.wait()
            if result != 0:
                raise SonoffError("sonoff_outcome_unknown")
            record["state"] = "verifying"
            await self.store.async_save(self.records)
            await self.verify(record)
            record["state"] = "verified"
            # A failed HA config flow cannot undo a positively verified app.
            # Keep enrollment as a separate outcome, without permitting a new
            # firmware write or misreporting this as an uncertain conversion.
            try:
                record["enrollment"] = await self.enroll(record)
            except Exception:
                record["enrollment"] = "manual_flow_required"
        except BaseException:
            record["state"] = "outcome_unknown"
        finally:
            await self.store.async_save(self.records)

    async def verify(self, record):
        client = APIClient(record["host"], 6053, "", noise_psk=record["values"]["noise_psk"])
        try:
            await client.connect(login=True)
            info = await client.device_info()
            if (canonical_mac(info.mac_address) != record["mac"]
                    or info.project_name != "ivaschru.sonoff_s60tpf"):
                raise SonoffError("sonoff_identity_changed")
            entities, _ = await client.list_entities_services()
            by_name = {entity.name: entity for entity in entities}
            if not (isinstance(by_name.get("Relay"), SwitchInfo)
                    and isinstance(by_name.get("Voltage"), SensorInfo)
                    and isinstance(by_name.get("Power"), SensorInfo)
                    and isinstance(by_name.get("Calibration"), TextSensorInfo)
                    and isinstance(by_name.get("Firmware"), UpdateInfo)
                    and isinstance(by_name.get("Bluetooth Proxy"), SwitchInfo)):
                raise SonoffError("sonoff_outcome_unknown")
            states = {}
            client.subscribe_states(lambda state: states.__setitem__(state.key, state))
            await asyncio.sleep(7)
            voltage = getattr(states.get(by_name["Voltage"].key), "state", None)
            power = getattr(states.get(by_name["Power"].key), "state", None)
            relay = getattr(states.get(by_name["Relay"].key), "state", None)
            calibration = getattr(states.get(by_name["Calibration"].key), "state", "")
            firmware = getattr(states.get(by_name["Firmware"].key), "current_version", "")
            if (not isinstance(voltage, (int, float)) or not math.isfinite(voltage) or not 80 <= voltage <= 280
                    or not isinstance(power, (int, float)) or not math.isfinite(power) or power < 0
                    or not isinstance(relay, bool)
                    or not isinstance(calibration, str)
                    or not calibration.startswith(("stock NVS, factor ", "from backup, factor "))
                    or firmware != "1"):
                raise SonoffError("sonoff_outcome_unknown")
            # BLE is an explicit option; no advertisement subscription is
            # taken here because that would displace HA's one proxy consumer.
            bluetooth = by_name.get("Bluetooth Proxy")
            if record["bluetooth_proxy"] and isinstance(bluetooth, SwitchInfo):
                client.switch_command(bluetooth.key, True)
            record["observed"] = {"relay": relay, "voltage": voltage, "power": power}
        finally:
            await client.disconnect(force=True)

    async def enroll(self, record):
        existing = self.hass.config_entries.async_entries("esphome")
        if any(entry.data.get("host") == record["host"] for entry in existing):
            return "existing_entry_check_required"
        flow = await self.hass.config_entries.flow.async_init("esphome", context={"source": "user"},
                                                             data={"host": record["host"], "port": 6053})
        for _ in range(4):
            if flow.get("type") == "create_entry":
                return "created"
            if flow.get("type") == "abort":
                return "existing_or_pending_flow"
            if flow.get("step_id") == "encryption_key":
                body = {"noise_psk": record["values"]["noise_psk"]}
            elif flow.get("step_id") == "discovery_confirm":
                body = {}
            else:
                return "manual_flow_required"
            flow = await self.hass.config_entries.flow.async_configure(flow["flow_id"], body)
        return "manual_flow_required"

    def public_job(self, job_id, owner):
        record = self.records.get(job_id)
        if not record or record.get("owner") != owner:
            raise SonoffError("sonoff_selection_expired")
        return {"job": job_id, "state": record["state"], "name": record["name"],
                "enrollment": record.get("enrollment"), "observed": record.get("observed"),
                **progress(self.root / job_id)}

    async def call(self, owner, operation, data):
        if not isinstance(data, dict):
            raise SonoffError("sonoff_invalid_request")
        if operation == "sonoff_scan":
            return await self.scan(owner)
        if operation == "sonoff_login":
            return await self.login(owner, data)
        if operation == "sonoff_select":
            return await self.select(owner, data)
        if operation == "sonoff_install":
            return await self.install(owner, data)
        if operation == "sonoff_status":
            return self.public_job(data.get("job"), owner)
        if operation == "sonoff_jobs":
            return {"jobs": [self.public_job(job, owner) for job, value in self.records.items()
                             if value.get("owner") == owner][-128:]}
        raise SonoffError("sonoff_invalid_request")
