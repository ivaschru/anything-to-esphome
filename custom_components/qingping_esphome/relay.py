"""A bounded, session-only MQTT endpoint for stock Qingping initial OTA.

This is not a general MQTT broker. A device can only authenticate to a live
installation session, subscribe to its exact command topic and publish to its
exact report topic. No wildcard subscriptions, retained messages, anonymous
clients or arbitrary firmware URLs are accepted. The HA WebSocket API handles
the browser separately; raw MQTT stays inside the user's LAN.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
import hmac
import json
import secrets
import time
from typing import Awaitable, Callable
from .image import private_ipv4

MAX_PACKET = 8192
SESSION_SECONDS = 900
MAX_SESSIONS = 4


def mqtt_string(value):
    encoded = value.encode("utf-8")
    return len(encoded).to_bytes(2, "big") + encoded


def packet(header, body=b""):
    length, encoded = len(body), bytearray()
    while True:
        digit = length % 128; length //= 128
        encoded.append(digit | (0x80 if length else 0))
        if not length: break
    return bytes((header,)) + encoded + body


async def read_packet(reader):
    header = (await asyncio.wait_for(reader.readexactly(1), 90))[0]
    length = multiplier = 0
    for index in range(4):
        value = (await asyncio.wait_for(reader.readexactly(1), 5))[0]
        length += (value & 127) * (128 ** index)
        if length > MAX_PACKET: raise ValueError("MQTT packet exceeds session limit")
        if not value & 128:
            return header, await asyncio.wait_for(reader.readexactly(length), 10)
    raise ValueError("Malformed MQTT remaining length")


def take_string(data, offset):
    if offset + 2 > len(data): raise ValueError("Truncated MQTT string")
    length = int.from_bytes(data[offset:offset + 2], "big")
    end = offset + 2 + length
    if end > len(data): raise ValueError("Truncated MQTT string body")
    return data[offset + 2:end].decode("utf-8", errors="strict"), end


def connect_fields(data):
    protocol, at = take_string(data, 0)
    if at + 4 > len(data): raise ValueError("Truncated CONNECT")
    level, flags = data[at], data[at + 1]; at += 4
    if (protocol, level) not in (("MQTT", 4), ("MQIsdp", 3)) or flags & 1:
        raise ValueError("Unsupported MQTT CONNECT")
    client, at = take_string(data, at)
    if flags & 4:
        _, at = take_string(data, at); _, at = take_string(data, at)
    user, at = take_string(data, at) if flags & 128 else ("", at)
    password, at = take_string(data, at) if flags & 64 else ("", at)
    if at != len(data): raise ValueError("Trailing CONNECT data")
    return client, user, password


def find_field(data, name):
    """Read only known identity/status fields; never serialize arbitrary packets."""
    if isinstance(data, dict):
        if name in data: return data[name]
        for value in data.values():
            found = find_field(value, name)
            if found is not None: return found
    elif isinstance(data, list):
        for value in data:
            found = find_field(value, name)
            if found is not None: return found
    return None


@dataclass
class Session:
    id: str
    owner: str
    mac: str
    stock_version: str
    name: str
    image: bytes = field(repr=False)
    noise_key: str = field(repr=False)
    ota_password: str = field(repr=False)
    username: str = field(default_factory=lambda: "qf-" + secrets.token_hex(6))
    password: str = field(default_factory=lambda: secrets.token_hex(16), repr=False)
    created: float = field(default_factory=time.monotonic)
    peer: str | None = None
    writer: asyncio.StreamWriter | None = field(default=None, repr=False)
    subscribed: bool = False
    version_verified: bool = False
    mac_verified: bool = False
    armed: bool = False
    sent: bool = False
    sent_at: float = 0
    downloaded: bool = False
    state: str = "waiting_for_device"
    progress: int = 0
    error: str | None = None

    @property
    def up(self): return f"qingping/{self.mac}/up"

    @property
    def down(self): return f"qingping/{self.mac}/down"

    @property
    def client_id(self): return "qf-" + self.mac

    def public(self):
        return {"id": self.id, "mac": self.mac, "name": self.name,
                "state": self.state, "progress": self.progress,
                "sent": self.sent, "armed": self.armed, "downloaded": self.downloaded, "error": self.error}


class Relay:
    def __init__(self, firmware_url: Callable[[Session], str], before_send: Callable[[Session], Awaitable[None]]):
        self.sessions: dict[str, Session] = {}
        self.firmware_url, self.before_send = firmware_url, before_send
        self.server = None

    async def start(self, port):
        self.server = await asyncio.start_server(self.handle, "0.0.0.0", port, limit=MAX_PACKET + 8)

    async def stop(self):
        if self.server:
            self.server.close(); await self.server.wait_closed()
        for session in self.sessions.values():
            if session.writer: session.writer.close()
            session.image = b""
        self.sessions.clear()

    def add(self, session):
        self.expire()
        if len(self.sessions) >= MAX_SESSIONS: raise ValueError("Уже открыто несколько установок")
        if any(s.mac == session.mac for s in self.sessions.values()):
            raise ValueError("Для этого прибора уже есть сессия; сначала проверьте её результат")
        self.sessions[session.id] = session

    def expire(self):
        for key, session in list(self.sessions.items()):
            if time.monotonic() - session.created > SESSION_SECONDS:
                if session.writer: session.writer.close()
                session.image = b""; self.sessions.pop(key)

    async def publish(self, session, payload):
        if not session.writer or not session.subscribed: return
        body = mqtt_string(session.down) + json.dumps(payload, separators=(",", ":")).encode()
        session.writer.write(packet(0x30, body))
        await asyncio.wait_for(session.writer.drain(), 5)

    async def maybe_flash(self, session):
        if session.state in ("identity_mismatch", "needs_review") or not (session.armed and session.subscribed and session.version_verified and session.mac_verified) or session.sent:
            return
        url = self.firmware_url(session)
        if len(url.encode()) > 127: raise ValueError("Firmware URL exceeds stock buffer")
        # The HA adapter persists the consumed intent BEFORE the only publish.
        # Mark in RAM too before awaiting it, closing simultaneous callback races.
        session.sent = True; session.sent_at = time.monotonic(); session.state = "sending"
        try:
            await self.before_send(session)
            await self.publish(session, {"type": "23", "url": url, "ota_type": 1})
        except Exception:
            session.error = "Результат команды неизвестен. Не повторяйте установку автоматически"
            session.state = "needs_review"
            raise

    async def report(self, session, data):
        if session.state == "identity_mismatch": return
        if not isinstance(data, dict): return
        kind = str(data.get("type"))
        if kind == "13":
            version = find_field(data, "sw_version")
            if version != session.stock_version:
                session.state = "identity_mismatch"; session.error = "Заводская версия изменилась"
                return
            session.version_verified = True
            # Bounded telemetry supplies the MAC absent from some hello packets.
            await self.publish(session, {"type": "12", "up_itvl": "5", "duration": "30"})
        reported_mac = find_field(data, "mac")
        if reported_mac:
            reported_mac = str(reported_mac).replace(":", "").upper()
            if reported_mac != session.mac:
                session.state = "identity_mismatch"; session.error = "Ответил другой MAC"
                return
            session.mac_verified = True
        if kind == "24" and session.sent:
            progress = data.get("percent")
            if isinstance(progress, (int, float)): session.progress = max(0, min(100, int(progress)))
            if data.get("error_code") not in (None, 0, "0"):
                session.error = "Заводская OTA сообщила об ошибке"; session.state = "needs_review"
            elif session.progress == 100: session.state = "waiting_for_esphome"
        if session.mac_verified and session.version_verified and not session.sent:
            session.state = "ready"
        if session.state != "identity_mismatch": await self.maybe_flash(session)

    async def handle(self, reader, writer):
        session = None
        try:
            peer = writer.get_extra_info("peername")[0]
            private_ipv4(peer)
            header, data = await read_packet(reader)
            if header != 0x10: return
            client, user, password = connect_fields(data)
            self.expire()
            session = next((s for s in self.sessions.values() if s.username == user), None)
            if not session or not hmac.compare_digest(session.password, password) or client != session.client_id:
                writer.write(packet(0x20, b"\0\x04")); await writer.drain(); return
            if session.writer and not session.writer.is_closing(): return
            session.peer, session.writer = peer, writer
            writer.write(packet(0x20, b"\0\0")); await writer.drain()
            while time.monotonic() - session.created < SESSION_SECONDS:
                header, data = await read_packet(reader)
                kind = header >> 4
                if kind == 8:
                    if len(data) < 2: raise ValueError("Truncated subscribe")
                    packet_id, at, codes = data[:2], 2, []
                    while at < len(data):
                        topic, at = take_string(data, at)
                        if at >= len(data): raise ValueError("Missing subscription QoS")
                        qos = data[at]; at += 1
                        admitted = topic == session.down and qos <= 1
                        codes.append(0 if admitted else 128)
                        session.subscribed |= admitted
                    writer.write(packet(0x90, packet_id + bytes(codes))); await writer.drain()
                    await self.maybe_flash(session)
                elif kind == 3:
                    topic, at = take_string(data, 0)
                    qos = (header >> 1) & 3
                    if topic != session.up or qos > 1 or header & 1:
                        raise ValueError("Topic/retained publication not allowed")
                    if qos:
                        if at + 2 > len(data): raise ValueError("Missing publication id")
                        writer.write(packet(0x40, data[at:at + 2])); at += 2
                    try: await self.report(session, json.loads(data[at:]))
                    except (json.JSONDecodeError, UnicodeError): pass
                elif kind == 12:
                    writer.write(packet(0xD0))
                elif kind == 14: break
                else: raise ValueError("Unsupported session MQTT packet")
                await writer.drain()
        except (asyncio.IncompleteReadError, TimeoutError, ConnectionError, ValueError, OSError):
            # Do not log arbitrary MQTT/JSON data: it may contain user settings.
            pass
        finally:
            if session and session.writer is writer:
                session.writer = None; session.subscribed = False
            writer.close()
            try: await writer.wait_closed()
            except OSError: pass
