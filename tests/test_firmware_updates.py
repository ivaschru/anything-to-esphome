"""Release admission and a real encrypted loopback OTA, never a sensor.

The responder uses the independent noiseprotocol implementation and checks
the APP type, password challenge, image digest and transfer bytes. Patching
only the socket destination keeps the production RFC1918 guard intact.
"""
import asyncio
import ast
import base64
import hashlib
import importlib
import importlib.util
import json
from pathlib import Path
import struct
import sys
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
package = types.ModuleType("qingping_update_test")
package.__path__ = [str(ROOT / "custom_components/qingping_esphome")]
sys.modules[package.__name__] = package
catalog = importlib.import_module(package.__name__ + ".firmware_catalog")
native = importlib.import_module(package.__name__ + ".native_ota")


def release(profile="lite"):
    prefix = "https://github.com/ivaschru/qingping-esphome/releases/"
    def asset(name, size):
        return {"url": prefix + "download/v0.1.5/" + name, "size": size, "sha256": "a" * 64}
    return {"format": catalog.CATALOG_FORMAT, "releases": {profile: {
        "version": "2026.11.06-ui25-polling1", "revision": 1,
        "backend": "esp32-noise-app-v1", "minimum_integration": "0.1.5",
        "image": asset("lite-template.bin", 12345),
        "manifest": asset("lite-template.json", 345),
        "release_url": prefix + "tag/v0.1.5", "summary": "A public firmware release",
    }}}


class CatalogTests(unittest.TestCase):
    def test_ha_error_and_entity_translations_cover_every_fixed_update_code(self):
        codes = {"firmware_admin_required", "firmware_update_failed"}
        root = ROOT / "custom_components/qingping_esphome"
        for filename in ("firmware_catalog.py", "firmware_update.py", "native_ota.py"):
            tree = ast.parse((root / filename).read_text())
            for node in ast.walk(tree):
                if (isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
                        and node.func.id == "FirmwareError" and node.args
                        and isinstance(node.args[0], ast.Constant)):
                    codes.add(node.args[0].value)
        for name in ("strings.json", "translations/en.json", "translations/ru.json"):
            strings = json.loads((root / name).read_text())
            self.assertTrue(codes <= strings["exceptions"].keys(), name)
            self.assertIn("firmware_profile", strings["options"]["step"])
            self.assertIn("firmware", strings["entity"]["update"])

    def test_exact_hardware_backend_and_integration_floor(self):
        item = catalog.parse_catalog(release())["lite"]
        self.assertTrue(item.supports_install("0.1.5"))
        self.assertFalse(item.supports_install("0.1.4"))
        self.assertFalse(item.supports_install("unknown"))
        # A catalog is not permission to send a Lite image to another board.
        with self.assertRaises(catalog.FirmwareError): catalog.parse_catalog(release("lite-mcu421"))

    def test_public_number_has_strict_type_and_legacy_catalog_remains_readable(self):
        data=release()
        self.assertEqual(catalog.parse_catalog(data)["lite"].display_version,"2026.11.06-ui25-polling1")
        for value in (True,0,"1"):
            data["releases"]["lite"]["public_version"]=value
            with self.assertRaises(catalog.FirmwareError):catalog.parse_catalog(data)
        data["releases"]["lite"]["public_version"]=1
        item=catalog.parse_catalog(data)["lite"]
        self.assertEqual((item.display_version,item.version,item.revision),("1","2026.11.06-ui25-polling1",1))

    def test_no_foreign_mutable_local_or_credential_urls(self):
        for url in ("http://github.com/ivaschru/qingping-esphome/releases/download/v0.1.5/lite-template.bin",
                    "https://github.com/other/repo/releases/download/v0.1.5/lite-template.bin",
                    "https://github.com/ivaschru/qingping-esphome/releases/download/main/lite-template.bin",
                    "https://github.com/ivaschru/qingping-esphome/releases/download/v0.1.5/lite-template.bin?x=1",
                    "https://github.com@192.168.1.1/image.bin"):
            with self.subTest(url=url), self.assertRaises(catalog.FirmwareError):
                catalog.asset_url(url)

    def test_invalid_revision_sizes_digest_and_format(self):
        for field, value in (("revision", True), ("revision", 0), ("minimum_integration", "0.1.5-beta")):
            data = release(); data["releases"]["lite"][field] = value
            with self.assertRaises(catalog.FirmwareError): catalog.parse_catalog(data)

    def test_adoption_history_preserves_prior_public_identity_and_refuses_ambiguity(self):
        data=release();item=data["releases"]["lite"]
        item.update(version="public-four",revision=4,
                    adoption_versions=[{"version":"public-two","revision":2},
                                       {"version":"public-three","revision":3}])
        parsed=catalog.parse_catalog(data)["lite"]
        self.assertEqual(dict(parsed.adoption_versions),{"public-two":2,"public-three":3})
        for history in ([{"version":"public-two","revision":4}],
                        [{"version":"public-two","revision":1}],
                        [{"version":"public-four","revision":2}],
                        [{"version":"public-two","revision":2}]*2):
            item["adoption_versions"]=history
            with self.assertRaises(catalog.FirmwareError):catalog.parse_catalog(data)
        for field, value in (("size", catalog.MAX_IMAGE_BYTES + 1), ("sha256", "bad")):
            data = release(); data["releases"]["lite"]["image"][field] = value
            with self.assertRaises(catalog.FirmwareError): catalog.parse_catalog(data)


HAS_NOISE = native.encryption_available()


@unittest.skipUnless(HAS_NOISE, "HA's aioesphomeapi is needed for encrypted OTA tests")
class EncryptedOTATests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        from test_protocol import fixture
        self.image = fixture()
        self.key = base64.b64encode(b"x" * 32).decode()
        self.password = "fixture-private-ota-password"
        self.calls = 0
        self.received = b""
        self.connections = []
        self.peer_errors = []
        self.raw_frames = []
        self.mode = "success"

    async def peer(self, reader, writer):
        self.calls += 1
        self.connections.append(writer)
        try:
            from noise.connection import NoiseConnection
            magic = await reader.readexactly(5)
            self.assertEqual(magic, native.MAGIC)
            hello = b"\0\2"
            writer.write(hello); await writer.drain()
            flags = await reader.readexactly(1)
            self.assertEqual(flags, bytes([native.CLIENT_FLAGS]))
            if self.mode == "no_encryption":
                writer.write(b"\x40"); await writer.drain()
                self.assertEqual(await reader.read(), b"")
                return
            features = b"\x48\4"
            writer.write(features); await writer.drain()
            protocol = NoiseConnection.from_name(b"Noise_NNpsk0_25519_ChaChaPoly_SHA256")
            protocol.set_as_responder()
            protocol.set_psks(base64.b64decode(self.key))
            protocol.set_prologue(b"NoiseOTAInit" + magic + hello + flags + features)
            protocol.start_handshake()

            async def frame():
                h = await reader.readexactly(3)
                self.assertEqual(h[0], 1)
                body = await reader.readexactly(int.from_bytes(h[1:], "big"))
                self.raw_frames.append(body)
                return body

            async def send(payload, *, handshake=False):
                body = payload if handshake else bytes(protocol.encrypt(payload))
                writer.write(b"\1" + struct.pack(">H", len(body)) + body)
                await writer.drain()

            first = await frame(); self.assertEqual(first[0], 0)
            protocol.read_message(first[1:])
            await send(b"\0" + bytes(protocol.write_message()), handshake=True)
            buffer = b""

            async def read(size):
                nonlocal buffer
                while len(buffer) < size:
                    buffer += bytes(protocol.decrypt(await frame()))
                value, buffer = buffer[:size], buffer[size:]
                return value

            nonce = b"a" * 64
            await send(b"\2" + nonce)
            cnonce = await read(64)
            digest = await read(64)
            self.assertEqual(digest, hashlib.sha256(self.password.encode() + nonce + cnonce).hexdigest().encode())
            await send(b"\x41")
            self.assertEqual(await read(1), b"\0")  # app only
            size = int.from_bytes(await read(4), "big")
            await send(b"\x42")
            self.assertEqual(await read(32), hashlib.md5(self.image).hexdigest().encode())
            await send(b"\x43")
            while len(self.received) < size:
                self.received += await read(min(8192, size - len(self.received)))
                await send(b"\x47")
            if self.mode == "lost_final_ack": return
            await send(b"\x44\x45")
            self.assertEqual(await read(1), b"\0")
        except BaseException as error:
            self.peer_errors.append(error)
        finally:
            writer.close()
            await writer.wait_closed()

    async def upload(self):
        server = await asyncio.start_server(self.peer, "127.0.0.1", 0)
        port = server.sockets[0].getsockname()[1]
        original = asyncio.open_connection
        async def local(host, ota_port):
            self.assertEqual((host, ota_port), ("192.168.50.9", 3232))
            return await original("127.0.0.1", port)
        self.progress = []
        try:
            with patch.object(native.asyncio, "open_connection", local):
                await native.upload_app("192.168.50.9", self.image, self.key, self.password, self.progress.append)
        finally:
            server.close(); await server.wait_closed()
            for writer in self.connections: writer.close()
            await asyncio.sleep(.02)

    async def test_standard_noise_responder_receives_exact_app_once(self):
        await self.upload()
        self.assertEqual(self.calls, 1)
        self.assertEqual(self.received, self.image)
        self.assertEqual(self.peer_errors, [])
        self.assertEqual(self.progress[-1], 1)
        self.assertNotIn(self.password.encode(), b"".join(self.raw_frames))
        self.assertNotIn(self.image, b"".join(self.raw_frames))

    async def test_declined_noise_never_sends_auth_or_image(self):
        self.mode = "no_encryption"
        with self.assertRaisesRegex(catalog.FirmwareError, "ota_encryption_required"):
            await self.upload()
        self.assertEqual(self.calls, 1)
        self.assertEqual(self.received, b"")

    async def test_lost_commit_ack_never_reconnects(self):
        self.mode = "lost_final_ack"
        with self.assertRaisesRegex(catalog.FirmwareError, "ota_transfer_uncertain"):
            await self.upload()
        self.assertEqual(self.calls, 1)
        self.assertEqual(self.received, self.image)


if __name__ == "__main__": unittest.main()
