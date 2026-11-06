"""One encrypted app-only ESPHome OTA, without a compiler or retry loop.

Wire contract: ESPHome 2026.9.1 esphome/espota2.py (MIT, ESPHome contributors).
https://github.com/esphome/esphome/blob/2026.9.1/esphome/espota2.py
This adapter uses HA's aioesphomeapi Noise implementation. It deliberately
omits plaintext fallback, DNS/address retries, bootloader/partition writes,
raw device error text, credential logging and filesystem firmware staging.
The caller must persist its intent and verify native identity/power first.
"""
from __future__ import annotations

import asyncio
import hashlib
import re
import secrets
import struct

from .firmware_catalog import FirmwareError
from .image import layout, private_ipv4

MAGIC = b"\x6c\x26\xf7\x5c\x45"
CLIENT_FLAGS = 0x0E  # SHA256 auth, extended protocol, Noise; no compression.
MAX_FRAME = 1040  # 1024 plaintext bytes plus the ChaCha20-Poly1305 tag.


def encryption_available():
    """Old HA SDKs may lack the standalone Noise handshake; never downgrade."""
    try:
        from aioesphomeapi.noise import NoiseHandshake  # noqa: F401
    except ImportError:
        return False
    return True


class _Wire:
    def __init__(self, reader, writer):
        self.reader, self.writer = reader, writer
        self.encrypt = self.decrypt = None
        self.buffer = b""

    async def raw_read(self, size):
        return await asyncio.wait_for(self.reader.readexactly(size), 160)

    async def frame(self, payload):
        self.writer.write(b"\x01" + struct.pack(">H", len(payload)) + payload)
        await self.writer.drain()

    async def receive_frame(self, maximum=MAX_FRAME):
        header = await self.raw_read(3)
        size = int.from_bytes(header[1:], "big")
        if header[0] != 1 or not 0 < size <= maximum:
            raise FirmwareError("ota_protocol_error")
        return await self.raw_read(size)

    async def write(self, data):
        # Once negotiated, every auth and image byte uses the same cipher
        # instance and nonce sequence. No raw writer escapes this boundary.
        if self.encrypt is None:
            self.writer.write(data)
            await self.writer.drain()
        else:
            for offset in range(0, len(data), 1024):
                await self.frame(self.encrypt.encrypt(data[offset:offset + 1024]))

    async def read(self, size):
        if self.decrypt is None:
            return await self.raw_read(size)
        while len(self.buffer) < size:
            block = self.decrypt.decrypt(await self.receive_frame())
            if not block:
                raise FirmwareError("ota_protocol_error")
            self.buffer += block
        data, self.buffer = self.buffer[:size], self.buffer[size:]
        return data

    async def expect(self, expected):
        if await self.read(1) != bytes([expected]):
            # Device text/bytes are untrusted and never become HA exceptions.
            raise FirmwareError("ota_protocol_error")


async def upload_app(host, image, noise_key, password, progress):
    """A single literal-IPv4 connection; errors never cause another upload."""
    from cryptography.exceptions import InvalidTag
    from aioesphomeapi.noise import NoiseHandshake

    host = private_ipv4(host)
    layout(image)  # Refuse vendor CRC trailers, full flash or oversized apps.
    if not noise_key or not password:
        raise FirmwareError("update_profile_required")
    writer = None
    try:
        async with asyncio.timeout(300):
            reader, writer = await asyncio.wait_for(asyncio.open_connection(host, 3232), 10)
            wire = _Wire(reader, writer)
            await wire.write(MAGIC)
            hello = await wire.read(2)
            if hello[0] != 0 or hello[1] not in (1, 2):
                raise FirmwareError("ota_protocol_error")
            await wire.write(bytes([CLIENT_FLAGS]))
            if await wire.read(1) != b"\x48":
                raise FirmwareError("ota_encryption_required")
            flags = (await wire.read(1))[0]
            if not flags & 4 or flags & 1:
                raise FirmwareError("ota_encryption_required")
            prologue = b"NoiseOTAInit" + MAGIC + hello + bytes([CLIENT_FLAGS, 0x48, flags])
            handshake = NoiseHandshake(noise_key, prologue)
            await wire.frame(b"\0" + handshake.write_message())
            reply = await wire.receive_frame(maximum=128)
            if reply[0] != 0:
                raise FirmwareError("ota_authentication_failed")
            handshake.read_message(reply[1:])
            wire.encrypt, wire.decrypt = handshake.get_ciphers()

            auth = (await wire.read(1))[0]
            if auth in (1, 2):
                width = 32 if auth == 1 else 64
                nonce = await wire.read(width)
                if not re.fullmatch(rb"[0-9a-fA-F]+", nonce):
                    raise FirmwareError("ota_protocol_error")
                cnonce = secrets.token_hex(width // 2).encode()
                digest = (hashlib.md5 if auth == 1 else hashlib.sha256)(
                    password.encode() + nonce + cnonce).hexdigest().encode()
                await wire.write(cnonce)
                await wire.write(digest)
                await wire.expect(0x41)
            elif auth != 0x41:
                raise FirmwareError("ota_authentication_failed")

            # Extended protocol type zero is the APP partition, always. Never
            # expose a caller-controlled OTA type or partition access option.
            await wire.write(b"\0")
            await wire.write(struct.pack(">I", len(image)))
            await wire.expect(0x42)
            await wire.write(hashlib.md5(image).hexdigest().encode())
            await wire.expect(0x43)
            for offset in range(0, len(image), 8192):
                chunk = image[offset:offset + 8192]
                await wire.write(chunk)
                if hello[1] >= 2:
                    await wire.expect(0x47)
                progress(min(offset + len(chunk), len(image)) / len(image))
            # A lost final ACK is ambiguous: the device can already commit
            # and reboot. The caller reconciles by reading, never resending.
            await wire.expect(0x44)
            await wire.expect(0x45)
            try:
                await wire.write(b"\0")
            except (OSError, TimeoutError):
                pass  # Both device commit acknowledgements were received.
    except FirmwareError:
        raise
    except InvalidTag:
        raise FirmwareError("ota_authentication_failed") from None
    except (OSError, TimeoutError, asyncio.IncompleteReadError, ValueError):
        raise FirmwareError("ota_transfer_uncertain") from None
    finally:
        if writer is not None:
            writer.close()
            try:
                await asyncio.wait_for(writer.wait_closed(), 1)
            except (OSError, TimeoutError):
                pass
