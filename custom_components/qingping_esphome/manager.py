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

DOMAIN = "qingping_esphome"
TEMPLATE_ROOT = Path(__file__).parent / "firmware"


class Manager:
    def __init__(self, hass, entry):
        self.hass, self.entry = hass, entry
        self.settings = {**entry.data, **getattr(entry, "options", {})}
        self.host = private_ipv4(self.settings["lan_host"])
        self.http_port, self.mqtt_port = self.settings["http_port"], self.settings["mqtt_port"]
        self.store = Store(hass, 1, DOMAIN + ".installations", private=True)
        self.records = {}
        self.checks = {}
        self.relay = Relay(self.firmware_url, self.consume_intent)
        self.cleanup_task = None
        self.http_runner = None

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
        if self.cleanup_task: self.cleanup_task.cancel()
        for task in self.checks.values(): task.cancel()
        await asyncio.gather(*(list(self.checks.values()) + ([self.cleanup_task] if self.cleanup_task else [])), return_exceptions=True)
        if self.http_runner: await self.http_runner.cleanup()
        await self.relay.stop()

    async def cleanup(self):
        try:
            while True:
                await asyncio.sleep(30)
                self.relay.expire()
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
            raise ValueError("Сессия не найдена или принадлежит другому пользователю")
        return session

    async def create(self, owner, data):
        admission(data["profile"], data["model"], data["stock_version"])
        if data.get("hardware") != "0001": raise ValueError("Эта аппаратная ревизия ещё не проверена")
        if data.get("usb") is not True: raise ValueError("Подключите прибор к USB")
        mac = mac_normalize(data["mac"])
        prior = self.records.get(mac)
        if prior and prior.get("command_consumed"):
            raise ValueError("Для этого MAC уже отправлялась прошивка. Сначала проверьте результат")
        ssid, password = data["ssid"], data["wifi_password"]
        if not 1 <= len(ssid.encode()) <= 32 or len(password.encode()) > 63:
            raise ValueError("SSID должен помещаться в 32 байта, пароль — в 63")
        if any(c in ssid + password for c in ('"', '\\', '\r', '\n', '\0')):
            raise ValueError("Кавычки, обратный слеш и переносы пока не поддержаны stock BLE setup")
        root = TEMPLATE_ROOT
        manifest_path = root / "lite-template.json"
        if not manifest_path.is_file():
            raise ValueError("В релизе нет firmware template; установите полный release ZIP")
        manifest = await self.hass.async_add_executor_job(lambda: json.loads(manifest_path.read_text()))
        template = await self.hass.async_add_executor_job((root / "lite-template.bin").read_bytes)
        psk = secrets.token_bytes(32)
        name = "qingping-" + mac.lower() + "-" + secrets.token_hex(5)[:9]
        values = {"ssid": ssid, "wifi_password": password, "name": name,
                  "ap_ssid": "Qingping-" + mac[-6:], "ap_password": secrets.token_hex(8),
                  "ota_password": secrets.token_hex(16), "noise_psk": psk}
        image = await self.hass.async_add_executor_job(personalize, template, values, manifest["sha256"])
        session = Session(id=secrets.token_hex(12), owner=owner, mac=mac,
                          stock_version=data["stock_version"], name=name, image=image,
                          noise_key=base64.b64encode(psk).decode(), ota_password=values["ota_password"])
        self.relay.add(session)
        return {**session.public(), "broker": {"host": self.host, "port": self.mqtt_port,
                "username": session.username, "password": session.password,
                "client_id": session.client_id, "up": session.up, "down": session.down}}

    async def consume_intent(self, session):
        old = self.records.get(session.mac)
        if old and old.get("command_consumed"):
            raise ValueError("Предыдущая команда требует проверки результата")
        self.records[session.mac] = {
            "at": datetime.now(timezone.utc).isoformat(), "owner": session.owner,
            "name": session.name, "peer": session.peer, "command_consumed": True,
            "image_sha256": hashlib.sha256(session.image).hexdigest(),
            "noise_key": session.noise_key, "ota_password": session.ota_password,
            "outcome": "sent_requires_verification",
        }
        # This is private HA storage, never a GitHub file or a diagnostic log.
        await self.store.async_save(self.records)

    async def status(self, session_id, owner):
        session = self.get(session_id, owner)
        if session.sent and session.state == "sending" and time.monotonic() - session.sent_at > 180:
            session.state = "needs_review"
            session.error = "Нет итогового ответа OTA. Проверьте прибор; повторная команда не отправлялась"
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
            await self.store.async_save(self.records)
            session.state = "installed"; session.image = b""
            # Standard ESPHome registration is independent of firmware success.
            # A flow conflict stays visible; it never causes another flash.
            try:
                record["ha_enrollment"] = await self.enroll(session)
            except Exception:
                # Enrollment failure must not mislabel a verified firmware
                # install, or invite a second factory OTA attempt.
                record["ha_enrollment"] = "manual_flow_required"
            await self.store.async_save(self.records)
        except asyncio.CancelledError:
            raise
        except Exception:
            session.state = "needs_review"
            session.error = "ESPHome пока не подтвердил результат. Повторная прошивка не отправлялась"
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
