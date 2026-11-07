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
import math
from pathlib import Path
import secrets
import time
from datetime import datetime, timezone
from aiohttp import web

from homeassistant.helpers.storage import Store

from .catalog import CATALOG, admission
from .image import SLOTS, mac_normalize, personalize, private_ipv4
from .relay import Relay, Session
from .network_setup import async_detect_lan_host
from .errors import InstallerError
from .ha_bluetooth import HABluetooth

DOMAIN = "qingping_esphome"
TEMPLATE_ROOT = Path(__file__).parent / "firmware"


class Manager:
    def __init__(self, hass, entry):
        self.hass, self.entry = hass, entry
        self.settings = {**entry.data, **getattr(entry, "options", {})}
        self.host = private_ipv4(self.settings["lan_host"])
        self.http_port, self.mqtt_port = self.settings["http_port"], self.settings["mqtt_port"]
        self.store = Store(hass, 1, DOMAIN + ".installations", private=True, atomic_writes=True)
        self.records = {}
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
        session.downloaded = True
        # Serving bytes is only a reason to begin read-only native checks.
        # It is not a successful flash, nor dependent on a stock progress key.
        session.state = "waiting_for_esphome"
        return web.Response(body=session.image, content_type="application/octet-stream",
                            headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})

    def get(self, session_id, owner):
        self.relay.expire()
        session = self.relay.sessions.get(session_id)
        if not session or session.owner != owner:
            raise InstallerError("session_missing")
        return session

    async def create(self, owner, data):
        admission(data["profile"], data["model"], data["stock_version"])
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
        ssid, password = data["ssid"], data["wifi_password"]
        if not 1 <= len(ssid.encode()) <= 32 or len(password.encode()) > 63:
            raise InstallerError("wifi_length")
        if any(c in ssid + password for c in ('"', '\\', '\r', '\n', '\0')):
            raise InstallerError("wifi_characters")
        root = TEMPLATE_ROOT
        manifest_path = root / "lite-template.json"
        if not manifest_path.is_file():
            raise InstallerError("template_missing")
        manifest = await self.hass.async_add_executor_job(lambda: json.loads(manifest_path.read_text()))
        template = await self.hass.async_add_executor_job((root / "lite-template.bin").read_bytes)
        psk = secrets.token_bytes(32)
        name = "qingping-" + mac.lower() + "-" + secrets.token_hex(5)[:9]
        values = {"display_feed_entity": "", "source_stock_version": data["stock_version"], "ssid": ssid, "wifi_password": password, "name": name,
                  "ap_ssid": "Qingping-" + mac[-6:], "ap_password": secrets.token_hex(8),
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
        session.template_sha256 = manifest["sha256"]
        session.personalization = {key: value for key, value in values.items() if key != "noise_psk"}
        session.transport = transport
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
            "template_sha256": session.template_sha256,
            "personalization": dict(session.personalization),
            "outcome": "sent_requires_verification",
        }
        # This is private HA storage, never a GitHub file or a diagnostic log.
        await self.save_records()

    async def status(self, session_id, owner):
        session = self.get(session_id, owner)
        if session.sent and session.state == "sending" and time.monotonic() - session.sent_at > 180:
            session.state = "needs_review"
            session.error = "ota_timeout"
        if session.sent and session.downloaded and session.state == "waiting_for_esphome" and session.id not in self.checks:
            self.checks[session.id] = asyncio.create_task(self.verify(session), name="qingping-native-verification")
        return session.public()

    async def verify(self, session):
        from aioesphomeapi import APIClient, SensorState
        deadline = time.monotonic() + 100
        client = None
        try:
            while time.monotonic() < deadline:
                client = APIClient(session.peer, 6053, "", noise_psk=session.noise_key,
                                   client_info="Qingping HACS installation check")
                try:
                    await asyncio.wait_for(client.connect(login=True, log_errors=False), 6)
                    break
                except Exception as error:
                    # Read-only retries never resend the factory OTA command.
                    await client.disconnect(); client = None
                    if time.monotonic() >= deadline: raise TimeoutError from error
                    await asyncio.sleep(2)
            if client is None: raise TimeoutError
            info = await client.device_info()
            if mac_normalize(info.mac_address) != session.mac or info.name != session.name:
                raise ValueError("Native identity mismatch")
            entities, _ = await client.list_entities_services()
            keys = {e.key: e.name for e in entities if e.name in ("CO2", "Temperature", "Humidity")}
            values = {}
            def state(value):
                if isinstance(value, SensorState) and value.key in keys:
                    values[keys[value.key]] = value.state
            client.subscribe_states(state)
            for _ in range(360):
                if all(isinstance(values.get(k), (int, float)) and math.isfinite(values[k]) for k in ("CO2", "Temperature", "Humidity")):
                    break
                await asyncio.sleep(.25)
            else: raise ValueError("No fresh physical sensor readings")
            record = self.records[session.mac]
            record.update(outcome="native_verified", build=info.compilation_time)
            await self.save_records()
            session.state = "installed"; session.image = b""
            # Standard ESPHome registration is independent of firmware success.
            # A flow conflict stays visible; it never causes another flash.
            try:
                record["ha_enrollment"] = await self.enroll(session)
            except Exception:
                # Enrollment failure must not mislabel a verified firmware
                # install, or invite a second factory OTA attempt.
                record["ha_enrollment"] = "manual_flow_required"
            await self.save_records()
        except asyncio.CancelledError:
            raise
        except Exception:
            session.state = "needs_review"
            session.error = "native_unconfirmed"
        finally:
            if client: await client.disconnect()

    async def enroll(self, session):
        existing = [e for e in self.hass.config_entries.async_entries("esphome") if e.data.get("host") == session.peer]
        if existing: return "existing_entry_check_required"
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
