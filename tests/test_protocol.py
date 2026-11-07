"""Checks of the new release/image boundary; no device or home configuration."""
import asyncio
import hashlib
import importlib
from pathlib import Path
import struct
import sys
import types
import unittest

# Pure transport tests must not import HA's integration entrypoint. Give the
# modules their real package-relative namespace without executing __init__.
ROOT = Path(__file__).resolve().parents[1]
package = types.ModuleType("qingping_test")
package.__path__ = [str(ROOT / "custom_components/qingping_esphome")]
sys.modules["qingping_test"] = package
image = importlib.import_module("qingping_test.image")
relay = importlib.import_module("qingping_test.relay")
catalog = importlib.import_module("qingping_test.catalog")


def fixture(extra=b""):
    header = bytearray(24); header[0:2] = bytes((0xE9, 1)); header[23] = 1
    content = b"\0".join(image.SLOTS.values()) + b"\0" + extra
    data = header + struct.pack("<II", 0x3F400020, len(content)) + content
    checksum = 0xEF
    for value in content: checksum ^= value
    data.extend(b"\0" * (15 - len(data) % 16)); data.append(checksum)
    return bytes(data) + hashlib.sha256(data).digest()


class ImageTests(unittest.TestCase):
    def test_personalized_image_integrity_and_secrets_not_in_template(self):
        template = fixture()
        values = {key: (b"X" * 32 if key == "noise_psk" else "q" * 31 if key == "name" else "" if key == "display_feed_entity" else "4.5.8" if key == "source_stock_version" else "private-example") for key in image.SLOTS}
        result = image.personalize(template, values, hashlib.sha256(template).hexdigest())
        image.layout(result[:-4])
        # A separately implemented bitwise CRC checks the vendor trailer, not
        # another call to the same zlib expression used by personalization.
        crc = 0
        for byte in result[:-4]:
            crc ^= byte
            for _ in range(8): crc = (crc >> 1) ^ (0xEDB88320 if crc & 1 else 0)
        self.assertEqual(result[-4:], struct.pack("<I", crc))
        self.assertNotIn(b"private-example", template)
        self.assertIn(b"private-example", result)
        for marker in image.SLOTS.values(): self.assertNotIn(marker, result)

    def test_rejects_wrong_hash_corruption_short_name_and_foreign_chip(self):
        template = fixture()
        with self.assertRaises(ValueError): image.personalize(template, {}, "0" * 64)
        damaged = bytearray(template); damaged[40] ^= 1
        with self.assertRaises(ValueError): image.layout(damaged)
        damaged = bytearray(template); damaged[12] = 2
        with self.assertRaises(ValueError): image.layout(damaged)
        values = {key: b"X" * 32 if key == "noise_psk" else "short" for key in image.SLOTS}
        with self.assertRaises(ValueError): image.personalize(template, values, hashlib.sha256(template).hexdigest())

    def test_lan_and_hardware_admission(self):
        for address in ("127.0.0.1", "169.254.1.1", "192.0.2.2", "100.64.0.1", "0.0.0.0", "8.8.8.8", "::1"):
            with self.subTest(address=address), self.assertRaises(ValueError): image.private_ipv4(address)
        self.assertEqual(image.private_ipv4("192.168.1.10"), "192.168.1.10")
        for profile, model, version in (("monitor2", "CGS2", "4.5.8"), ("lite", "CGS1", "4.5.8"), ("lite", "CGDN1", "9.0.0"), ("lite", "CGDN1", "4.2.1"), ("lite-mcu421", "CGDN1", "4.2.1")):
            with self.assertRaises(ValueError): catalog.admission(profile, model, version)

    def test_release_template_if_present(self):
        path = ROOT / "custom_components/qingping_esphome/firmware/lite-template.bin"
        if not path.exists(): self.skipTest("Run build_lite.py for real template verification")
        binary = path.read_bytes(); image.layout(binary)
        for marker in image.SLOTS.values(): self.assertIn(marker, binary)


class Writer:
    def __init__(self): self.data = bytearray()
    def write(self, data): self.data.extend(data)
    async def drain(self): pass


class RelayTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.saved = []
        async def consume(session):
            await asyncio.sleep(0)
            self.saved.append(session.id)
        self.broker = relay.Relay(lambda s: "http://192.168.1.2:1887/firmware/" + s.id, consume)
        self.session = relay.Session("fixture", "owner", "001122334455", "4.5.8", "fixture", b"image", "key", "password")
        self.session.writer = Writer(); self.session.subscribed = True
        self.broker.add(self.session)

    async def test_fresh_identity_and_user_action_required_exactly_once(self):
        s = self.session
        await self.broker.report(s, {"type": "13", "sw_version": "4.5.8"})
        self.assertFalse(s.sent)
        await self.broker.report(s, {"mac": "00:11:22:33:44:55"})
        self.assertFalse(s.sent)
        s.armed = True
        await asyncio.gather(self.broker.maybe_flash(s), self.broker.maybe_flash(s))
        self.assertEqual(self.saved, [s.id])
        self.assertEqual(s.writer.data.count(b'"type":"23"'), 1)
        self.assertNotIn(b"key", str(s.public()).encode())
        self.assertNotIn(b"password", str(s.public()).encode())

    async def test_mismatched_identity_cannot_be_cured_by_later_telemetry(self):
        s = self.session; s.armed = True
        await self.broker.report(s, {"type": "13", "sw_version": "4.5.8", "mac": "FFEEDDCCBBAA"})
        await self.broker.report(s, {"type": "13", "sw_version": "4.5.8", "mac": s.mac})
        self.assertEqual(s.state, "identity_mismatch")
        self.assertFalse(s.sent)

    async def test_failed_journal_never_publishes_or_retries(self):
        async def broken(_): raise OSError("fixture disk failure")
        self.broker.before_send = broken
        s = self.session; s.armed = s.mac_verified = s.version_verified = True
        with self.assertRaises(OSError): await self.broker.maybe_flash(s)
        await self.broker.maybe_flash(s)
        self.assertTrue(s.sent); self.assertEqual(s.state, "needs_review")
        self.assertNotIn(b'"type":"23"', s.writer.data)

    async def test_oversized_mqtt_length_is_rejected_before_body(self):
        reader = asyncio.StreamReader(); reader.feed_data(b"\x30\xff\xff\x7f"); reader.feed_eof()
        with self.assertRaises(ValueError): await relay.read_packet(reader)


if __name__ == "__main__": unittest.main()
