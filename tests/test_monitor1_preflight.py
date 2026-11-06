"""Exercise source capture/patch admission without hardware or vendor bytes."""
import hashlib
import importlib
import os
from pathlib import Path
import shlex
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

PORT = Path(__file__).resolve().parents[1] / "ports/monitor1"
sys.path.insert(0, str(PORT))
try:
    patches = importlib.import_module("bootstrap_patches")
    preflight = importlib.import_module("preflight_adb")
finally:
    sys.path.pop(0)

MAC = "02:00:00:00:00:01"  # Deliberately non-operational fixture identity.
BOOT = "00000000-0000-4000-8000-000000000001"


class FakeAdb:
    """Fixed read-only protocol fake; no shell is executed by this adapter."""
    serial = "fixtureUSB"

    def __init__(self, files):
        self.files = files
        self.pulled = []
        self.mac = MAC
        self.co2 = "3"
        self.boots = 0
        self.change_boot = False
        self.corrupt = False

    def usb(self):
        return "usb:fixture"

    def read(self, command):
        values = {"id -u": "0", "cat /sys/class/net/wlan0/address": self.mac,
                  "cat /data/etc/os-release": "CLEARGRASS_VERSION=4.1.8_0287",
                  "uname -m": "armv7l", preflight.CO2_READ: self.co2,
                  "test ! -e /data/.esphome-cgs1\ntest ! -L /data/.esphome-cgs1": ""}
        if command == "cat /proc/sys/kernel/random/boot_id":
            self.boots += 1
            return BOOT if not self.change_boot or self.boots == 1 else BOOT[:-1] + "2"
        if command in values:
            return values[command]
        source = command.rsplit("sha256sum ", 1)[-1]
        if source in self.files:
            data = self.files[source]
            return f"{len(data)} 1\n{hashlib.sha256(data).hexdigest()}  {source}"
        raise AssertionError("Unexpected device command")

    def pull(self, source, destination):
        self.pulled.append(source)
        destination.write_bytes(b"corrupt" if self.corrupt else self.files[source])


class Monitor1PreflightTests(unittest.TestCase):
    def test_remote_exit_needs_a_complete_final_marker(self):
        marker = "__CGS1_READ_OK_fixture__"
        self.assertEqual(preflight.completed_shell(b"3\r\n\r\n" + marker.encode() + b"\r\n", marker), "3")
        for response in (b"3", marker.encode(), b"\nwrong\n", b"3\n" + marker.encode() + b"\nextra"):
            with self.subTest(response=response), self.assertRaises(ValueError):
                preflight.completed_shell(response, marker)

    def test_tcp_serial_and_unselected_variant_are_rejected_without_adb(self):
        with patch.object(preflight.subprocess, "run") as run:
            for serial in ("192.0.2.1:5555", "", "-d", "usb;reboot"):
                with self.assertRaises(ValueError):
                    preflight.Adb("adb", serial)
            for co2 in (1, 4, True, "3"):
                with self.assertRaises(ValueError):
                    preflight.expected_target(MAC, co2)
            run.assert_not_called()

    def test_co2_filter_does_not_copy_other_ini_fields(self):
        with tempfile.TemporaryDirectory() as temp:
            ini = Path(temp) / "setting.ini"
            command = preflight.CO2_READ.replace("/data/etc/setting.ini", shlex.quote(str(ini)))
            ini.write_text("[wifi]\npassword=fixture-secret\nco2_type=9\n[sensors]\nco2_type=3\n[other]\nco2_type=7\n")
            result = subprocess.run(["/bin/sh", "-c", command], capture_output=True, text=True)
            self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "3\n", ""))
            ini.write_text("[sensors]\nco2_type=3\nco2_type=2\n")
            self.assertNotEqual(subprocess.run(["/bin/sh", "-c", command], capture_output=True).returncode, 0)

    def test_capture_copies_only_fixed_files_and_verifies_both_ends(self):
        files = {name: ("private fixture " + name).encode() for name in preflight.FILES}
        pins = {name: (hashlib.sha256(data).hexdigest(), len(data)) for name, data in files.items()}
        with tempfile.TemporaryDirectory() as temp, patch.object(preflight, "FILES", pins), \
                patch.object(preflight.pm, "HERE", Path(temp).resolve()):
            root = Path(temp).resolve()
            for failure in ("wrong_mac", "wrong_co2", "bad_copy", "new_boot", None):
                with self.subTest(failure=failure):
                    adb = FakeAdb(files)
                    adb.mac = MAC[:-1] + "2" if failure == "wrong_mac" else MAC
                    adb.co2 = "2" if failure == "wrong_co2" else "3"
                    adb.corrupt = failure == "bad_copy"
                    adb.change_boot = failure == "new_boot"
                    output = root / "build" / (failure or "success")
                    if failure:
                        with self.assertRaises(ValueError):
                            preflight.capture(adb, MAC, 3, output)
                        self.assertFalse((output / "result.json").exists())
                        if failure in ("wrong_mac", "wrong_co2"):
                            self.assertFalse(adb.pulled)
                    else:
                        report = preflight.capture(adb, MAC, 3, output)
                        self.assertEqual(report["device_writes"], 0)
                        self.assertFalse(report["installation_ready"])
                        self.assertEqual(set(adb.pulled), set(files))
                        for source, data in files.items():
                            copy = output / source.lstrip("/")
                            self.assertEqual(copy.read_bytes(), data)
                            self.assertEqual(copy.stat().st_mode & 0o777, 0o600)
                        self.assertEqual(output.stat().st_mode & 0o777, 0o700)
                        self.assertEqual((output / "result.json").stat().st_mode & 0o777, 0o600)

    def test_input_reader_rejects_links_and_device_files(self):
        with tempfile.TemporaryDirectory() as temp:
            original = Path(temp) / "file"
            original.write_bytes(b"source")
            linked = Path(temp) / "symlink"
            linked.symlink_to(original)
            with self.assertRaises(OSError):
                patches.read_regular(linked)
            hard = Path(temp) / "hardlink"
            os.link(original, hard)
            with self.assertRaises(ValueError):
                patches.read_regular(original)
            with self.assertRaises(ValueError):
                patches.read_regular(Path("/dev/null"))

    def test_patch_recipe_retains_originals_and_requires_complete_output_pins(self):
        # No vendor script is embedded in tests. A minimal synthetic source
        # tests the transformations; actual factory digests are checked in a
        # separate private retained-backup run, never softened in production.
        start = b"#!/bin/sh\n: fixture\n"
        watchdog = b"#!/bin/sh\n" + patches.WATCHDOG_OLD
        hook = (PORT / "bootstrap/startup-hook.sh").read_bytes()
        new_start, new_watchdog = start + hook, watchdog.replace(patches.WATCHDOG_OLD, patches.WATCHDOG_NEW)
        with tempfile.TemporaryDirectory() as temp, \
                patch.object(patches, "START_FACTORY", patches.sha(start)), \
                patch.object(patches, "WATCHDOG_FACTORY", patches.sha(watchdog)), \
                patch.object(patches, "START_INSTALLED", patches.sha(new_start)), \
                patch.object(patches, "WATCHDOG_INSTALLED", patches.sha(new_watchdog)), \
                patch.object(patches.pm, "HERE", Path(temp).resolve()):
            self.assertEqual(patches.patch_bytes(start, watchdog, hook), (new_start, new_watchdog))
            for values in ((start + b"\n", watchdog, hook), (start, watchdog, hook + b"\n")):
                with self.assertRaises(ValueError):
                    patches.patch_bytes(*values)
            root = Path(temp).resolve()
            (root / "start").write_bytes(start)
            (root / "watchdog").write_bytes(watchdog)
            output = root / "build/result"
            report = patches.prepare(root / "start", root / "watchdog", output)
            self.assertFalse(report["hardware_contacted"])
            self.assertFalse(report["installation_ready"])
            self.assertEqual((output / "stock-start.sh.original").read_bytes(), start)
            self.assertEqual((output / "start.sh.candidate").read_bytes(), new_start)
            for name in [*report["files"], "result.json"]:
                self.assertEqual((output / name).stat().st_mode & 0o777, 0o600)
            with self.assertRaises(FileExistsError):
                patches.prepare(root / "start", root / "watchdog", output)
            with patch.object(patches, "START_INSTALLED", "0" * 64), self.assertRaises(ValueError):
                patches.patch_bytes(start, watchdog, hook)
