"""USB companion protocol and ingress ownership, with no actual ADB/USB."""
import importlib.util
from pathlib import Path
import re
from types import SimpleNamespace
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("qingping_usb_companion", ROOT / "apps/monitor1_usb/rootfs/server.py")
companion = importlib.util.module_from_spec(spec)
spec.loader.exec_module(companion)


class FixtureAdb:
    def __init__(self, co2="3"):
        self.calls = []
        self.identity = {"uid":"0", "wlan_mac":"02:00:00:00:00:01", "arch":"armv7l",
                         "version":"CLEARGRASS_VERSION=4.1.8_0287", "co2_type":co2,
                         "boot_id":"01234567-1234-4234-8234-123456789abc"}
        self.replies = {item["command"]: self.identity[item["name"]] for item in companion.CONTRACT["identity"]}
        self.replies.update({item["command"]: item["expected"] for item in companion.CONTRACT["files"]})
        self.replies[companion.CONTRACT["absent_install"]] = ""
        self.partial = False

    def run(self, args, **options):
        self.calls.append(args)
        assert options["env"] == {"PATH":"/usr/local/bin:/usr/bin:/bin", "HOME":"/data/adb",
                                  "ADB_SERVER_SOCKET":"tcp:localhost:5037"}
        assert 0 < options["timeout"] <= 10
        assert not options["check"]
        operation = args[1:]
        if operation == ["devices", "-l"]:
            raw = b"List of devices attached\nfixture device usb:1-1.2 model:CGS1\n127.0.0.1:5555 device product:other\n"
        else:
            assert operation[:2] == ["-s", "fixture"]
            tail = operation[2:]
            if tail == ["get-state"]:
                raw = b"device\n"
            elif tail == ["get-devpath"]:
                raw = b"usb:1-1.2\n"
            else:
                assert tail[0] == "shell"
                matched = re.fullmatch(r"set -e\n([\s\S]*)\nprintf '\\n(__CGS1_COMPANION_OK_[a-f0-9]{32}__)\\n'\n", tail[1])
                assert matched
                command, marker = matched.groups()
                assert command in self.replies, "Only fixed canonical read commands may execute"
                raw = (self.replies[command] + ("" if self.partial else "\n" + marker + "\n")).encode()
        return SimpleNamespace(returncode=0, stdout=raw)


class UsbCompanionTests(unittest.TestCase):
    def make(self, co2="3"):
        fake = FixtureAdb(co2)
        return fake, companion.UsbReads(run=fake.run)

    def test_discovery_lists_only_explicit_usb_serials(self):
        fake, usb = self.make()
        self.assertEqual(usb.devices(), ["fixture"])
        self.assertEqual(len(fake.calls), 1)

    def test_both_profiles_use_the_same_fixed_reads_and_do_not_install(self):
        for kind in ("2", "3"):
            fake, usb = self.make(kind)
            result = usb.inspect("fixture")
            self.assertEqual(result["co2_type"], int(kind))
            self.assertTrue(result["source_checked"])
            self.assertFalse(result["installation_ready"])
            self.assertEqual(result["transport"], "ha_usb")
            self.assertTrue(all(call[1:] == ["devices","-l"] or call[1:3] == ["-s","fixture"] for call in fake.calls))

    def test_partial_legacy_shell_output_is_not_success(self):
        fake, usb = self.make()
        fake.partial = True
        with self.assertRaisesRegex(companion.Refusal, "usb_read_incomplete"):
            usb.inspect("fixture")

    def test_unknown_profile_and_changed_stock_files_refuse(self):
        for field, value in (("co2_type","1"), ("arch","aarch64"), ("wlan_mac","01:00:00:00:00:01")):
            fake, usb = self.make()
            command = next(item["command"] for item in companion.CONTRACT["identity"] if item["name"] == field)
            fake.replies[command] = value
            with self.assertRaises(companion.Refusal):
                usb.inspect("fixture")
        fake, usb = self.make()
        fake.replies[companion.CONTRACT["files"][0]["command"]] = "changed source"
        with self.assertRaisesRegex(companion.Refusal, "usb_stock_unverified"):
            usb.inspect("fixture")

    def test_tcp_selectors_and_shell_fragments_never_reach_adb(self):
        fake, usb = self.make()
        for serial in ("127.0.0.1:5555", "-d", "fixture; reboot", "../device"):
            with self.assertRaisesRegex(companion.Refusal, "usb_selection_invalid"):
                usb.inspect(serial)
        self.assertEqual(fake.calls, [])

    def test_page_nonce_is_owned_and_selection_is_consumed_before_a_failed_read(self):
        class Usb:
            def __init__(self): self.count = 0
            def inspect(self, serial):
                self.count += 1
                raise companion.Refusal("usb_read_incomplete")
            def devices(self): return ["fixture"]
        usb = Usb(); app = companion.Companion(usb)
        user, other = "a"*32, "b"*32
        nonce = app.page(user)
        with self.assertRaisesRegex(companion.Refusal, "usb_unauthorized"):
            app.inspect(other, nonce, "fixture")
        self.assertEqual(usb.count, 0)
        with self.assertRaisesRegex(companion.Refusal, "usb_read_incomplete"):
            app.inspect(user, nonce, "fixture")
        with self.assertRaisesRegex(companion.Refusal, "usb_selection_consumed"):
            app.inspect(user, nonce, "fixture")
        self.assertEqual(usb.count, 1)
        self.assertEqual(app.discover(user, nonce), ["fixture"])
        with self.assertRaisesRegex(companion.Refusal, "usb_read_incomplete"):
            app.inspect(user, nonce, "fixture")
        self.assertEqual(usb.count, 2) # Explicit rediscovery, only read operations.

    def test_only_the_actual_ingress_peer_can_assert_a_user(self):
        handler = object.__new__(companion.Handler)
        handler.headers = {"X-Remote-User-Id":"a"*32, "X-Forwarded-For":"172.30.32.2"}
        handler.client_address = ("127.0.0.1", 12345)
        with self.assertRaisesRegex(companion.Refusal, "usb_unauthorized"):
            handler.owner()
        handler.client_address = ("172.30.32.2", 12345)
        self.assertEqual(handler.owner(), "a"*32)
        handler.headers = {"X-Remote-User-Id":"unknown"}
        with self.assertRaisesRegex(companion.Refusal, "usb_unauthorized"):
            handler.owner()

    def test_device_lock_is_not_bypassed_by_another_page(self):
        _, usb = self.make()
        app = companion.Companion(usb)
        nonce = app.page("a"*32)
        app.device_lock.acquire()
        try:
            with self.assertRaisesRegex(companion.Refusal, "usb_busy"):
                app.inspect("a"*32, nonce, "fixture")
        finally:
            app.device_lock.release()
