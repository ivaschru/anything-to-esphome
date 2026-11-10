"""Synthetic Sonoff protocol/app boundaries; no account, LAN or device IO."""
import base64
import copy
import hashlib
import importlib
import json
from pathlib import Path
import struct
import sys
import types
import unittest

ROOT = Path(__file__).resolve().parents[1]
package = types.ModuleType("sonoff_test")
package.__path__ = [str(ROOT / "custom_components/qingping_esphome")]
sys.modules[package.__name__] = package
policy = importlib.import_module("sonoff_test.sonoff_policy")
image = importlib.import_module("sonoff_test.sonoff_image")
mdns = importlib.import_module("sonoff_test.sonoff_mdns")


def device():
    return {"deviceid": "1000abcdef", "name": "Fixture plug", "productModel": "S60TPF",
            "devicekey": "fixture-device-key", "online": True, "host": "192.168.1.33",
            "extra": {"model": "SN-ESP32C3-S60-01", "uiid": 190},
            "params": {"fwVersion": "1.2.0", "staMac": "AA:BB:CC:11:22:33"}}


def fixture():
    header = bytearray(24)
    header[0], header[1], header[12], header[23] = 0xe9, 2, 5, 1
    result, checksum = bytes(header), 0xef
    slots = list(image.SLOTS.values())
    for block in (b"synthetic-c3\0" + b"\0".join(slots[:5]), b"\0".join(slots[5:]) + b"\0"):
        result += struct.pack("<II", 0x3c000020, len(block)) + block
        for value in block:
            checksum ^= value
    result += b"\0" * (15 - len(result) % 16) + bytes([checksum])
    return result + hashlib.sha256(result).digest()


def values():
    return {key: b"x" * 32 if key == "noise_psk" else b"s" * 31 if key == "name"
            else b"0" * 64 if key == "display_feed_entity" else b"1.2.0" if key == "source_stock_version"
            else b"fixture-private" for key in image.SLOTS}


class SonoffPolicyTests(unittest.TestCase):
    def test_repository_rename_admits_only_original_and_current_immutable_assets(self):
        catalog = importlib.import_module("sonoff_test.firmware_catalog")
        for repository in ("anything-to-esphome", "qingping-esphome"):
            url = f"https://raw.githubusercontent.com/ivaschru/{repository}/firmware-lite-v5/lite-template.bin"
            self.assertEqual(catalog.asset_url(url, filename="lite-template.bin", profile="lite"), url)
        for url in ("https://raw.githubusercontent.com/other/anything-to-esphome/firmware-lite-v5/lite-template.bin",
                    "https://raw.githubusercontent.com/ivaschru/anything-to-esphome/main/lite-template.bin",
                    "https://raw.githubusercontent.com/ivaschru/anything-to-esphome/firmware-sonoff-s60tpf-v1/lite-template.bin"):
            with self.assertRaises(ValueError): catalog.asset_url(url, filename="lite-template.bin", profile="lite")
    def test_exact_model_board_stock_and_private_detached_inventory(self):
        raw, auth = device(), {"at": "fixture-token", "user": {"apikey": "fixture-account-key"}}
        owned = policy.OwnedDevice.parse(raw, source="sonoff", auth=auth)
        self.assertNotIn("fixture", repr(owned))
        public = json.dumps(owned.public("choice"))
        for secret in (raw["devicekey"], auth["at"], auth["user"]["apikey"]):
            self.assertNotIn(secret, public)
        raw["params"]["staMac"], auth["user"]["apikey"] = "changed", "changed"
        self.assertEqual(owned.mac, "AA:BB:CC:11:22:33")
        self.assertEqual(owned.auth["user"]["apikey"], "fixture-account-key")
        for path, value in (("productModel", "S60ZB"), ("deviceid", "../device")):
            bad = device(); bad[path] = value
            with self.assertRaises(policy.SonoffError): policy.OwnedDevice.parse(bad, source="sonoff")
        for parent, key, value in (("extra", "uiid", 191), ("extra", "model", "other"), ("params", "fwVersion", "1.3.0")):
            bad = device(); bad[parent][key] = value
            with self.assertRaises(policy.SonoffError): policy.OwnedDevice.parse(bad, source="sonoff")

    def test_selection_owner_expiration_and_address_bounds(self):
        owned = policy.OwnedDevice.parse(device(), source="sonoff")
        choice = {"owner": "one", "expires": 20, "device": owned}
        self.assertIs(policy.require_selection(choice, "one", now=19), owned)
        for owner, now in (("two", 19), ("one", 20)):
            with self.assertRaises(policy.SonoffError): policy.require_selection(choice, owner, now=now)
        for value in ("127.0.0.1", "8.8.8.8", "169.254.1.2", "::1", "device.local", "192.168.1.2/path"):
            with self.assertRaises(policy.SonoffError): policy.lan_address(value)

    def test_c3_personalization_retains_layout_and_has_no_qingping_trailer(self):
        original = fixture(); private = values()
        actual = image.personalize(original, private, hashlib.sha256(original).hexdigest())
        self.assertEqual(len(original), len(actual))
        self.assertEqual(image.layout(original)[0], image.layout(actual)[0])
        for marker in image.SLOTS.values(): self.assertNotIn(marker, actual)
        for bad in (original + b"crc!", original[:-1], bytes([0]) + original[1:]):
            with self.assertRaises(ValueError): image.layout(bad)
        wrong = bytearray(original); wrong[12] = 0
        with self.assertRaises(ValueError): image.layout(wrong)
        with self.assertRaises(ValueError): image.personalize(original, private, "0" * 64)
        for key, value in (("name", "short"), ("noise_psk", b"short"), ("ssid", "a\0b"), ("source_stock_version", "4.5.8")):
            with self.assertRaises(ValueError): image.personalize(original, {**private, key: value}, hashlib.sha256(original).hexdigest())

    def test_dns_txt_decode_and_adversarial_pointer_loop_duplicate_and_bounds(self):
        name = b"\x04plug\x08_ewelink\x04_tcp\x05local\0"
        fields = [b"id=1000abcdef", b"encrypt=true"]
        def packet(values):
            txt = b"".join(bytes([len(v)]) + v for v in values)
            return struct.pack("!6H", 0, 0x8400, 0, 1, 0, 0) + name + struct.pack("!HHIH", 16, 1, 120, len(txt)) + txt
        self.assertEqual(mdns.txt_response(packet(fields))[0]["id"], "1000abcdef")
        for bad in (packet(fields + fields[:1]), packet(fields)[:-1], b"x" * 17000,
                    struct.pack("!6H", 0, 0x8400, 0, 1, 0, 0) + b"\xc0\x0c"):
            with self.assertRaises(ValueError): mdns.txt_response(bad)


if __name__ == "__main__": unittest.main()
