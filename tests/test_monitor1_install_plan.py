"""Offline install-plan joins: simulated inputs, no device action or SDK build."""
import base64
import importlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

PORT = Path(__file__).resolve().parents[1] / "ports/monitor1"
sys.path.insert(0, str(PORT))
try:
    plan = importlib.import_module("prepare_install")
finally:
    sys.path.pop(0)


def write(path, data):
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    path.write_bytes(data)
    path.chmod(0o600)


def write_json(path, data):
    write(path, (json.dumps(data, indent=2) + "\n").encode())


class InstallPlanTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.capture, self.build = self.root / "capture", self.root / "candidate"
        for path in (self.capture, self.build):
            path.mkdir(mode=0o700)
        start = b"#!/bin/sh\n: source_fixture\n"
        watchdog = b"#!/bin/sh\n" + plan.bootstrap.WATCHDOG_OLD
        hook = (PORT / "bootstrap/startup-hook.sh").read_bytes()
        files = {name: ("fixture " + name).encode() for name in plan.preflight.FILES}
        files["/data/etc/init.d/start.sh"], files["/data/bin/watchdog.sh"] = start, watchdog
        pins = {name: (plan.bootstrap.sha(data), len(data)) for name, data in files.items()}
        changes = [(plan.pm, "HERE", self.root), (plan.preflight, "FILES", pins),
                   (plan.bootstrap, "START_FACTORY", plan.bootstrap.sha(start)),
                   (plan.bootstrap, "WATCHDOG_FACTORY", plan.bootstrap.sha(watchdog)),
                   (plan.bootstrap, "START_INSTALLED", plan.bootstrap.sha(start + hook)),
                   (plan.bootstrap, "WATCHDOG_INSTALLED", plan.bootstrap.sha(watchdog.replace(plan.bootstrap.WATCHDOG_OLD, plan.bootstrap.WATCHDOG_NEW)))]
        for owner, name, value in changes:
            self.enterContext(patch.object(owner, name, value))
        for name, data in files.items():
            write(self.capture / name.lstrip("/"), data)
        self.observed = {"schema_version": 1, "stage": "read_only_capture_complete",
                         "hardware_contacted": True, "device_writes": 0,
                         "installation_ready": False, "installed": False,
                         "wlan_mac": "02:00:00:00:00:01", "co2_type": 3,
                         "stock_version": "4.1.8_0287", "usb_serial": "fixtureUSB",
                         "usb_transport": "usb:fixture", "boot_id": "00000000-0000-4000-8000-000000000001",
                         "files": {name: {"sha256": sha, "size": size} for name, (sha, size) in pins.items()}}
        write_json(self.capture / "result.json", self.observed)
        profile = {"model": "CGS1", "stock_version": "4.1.8_0287", "co2_type": 3,
                   "wlan_mac": self.observed["wlan_mac"], "api_mac": "02:00:00:00:00:02",
                   "node_name": "fixture-monitor", "friendly_name": "Offline fixture",
                   "api_encryption_key": base64.b64encode(b"1" * 32).decode(),
                   "qt_core_sha256": pins["/usr/lib/libQt5Core.so.5.9.4"][0]}
        self.profile = self.root / "profile.json"
        write_json(self.profile, profile)
        self.patches = self.root / "build/patches"
        plan.bootstrap.prepare(self.capture / "data/etc/init.d/start.sh",
                               self.capture / "data/bin/watchdog.sh", self.patches)
        # The ELF parser alone is replaced for these tiny synthetic programs;
        # the production planner invokes the real ARM/glibc validators. Real
        # S8/SCD40 candidate byte/ELF audits are separate retained evidence.
        spec = lambda path: {"size": path.stat().st_size, "sha256": plan.pm.digest(path)}
        helper_spec = lambda path, shared: {"bytes": path.stat().st_size, "sha256": plan.pm.digest(path), "needed": ["libQt5Core.so.5"]}
        self.enterContext(patch.object(plan.candidate, "program_spec", side_effect=spec))
        self.enterContext(patch.object(plan.pm, "validate_artifact", side_effect=helper_spec))
        source = self.build / "ports/monitor1"
        write(source / "fixture.h", b"// synthetic public source\n")
        helper = source / "build/pm-helper/pm_qt_bridge.so"
        write(helper, b"synthetic PM helper")
        write(self.build / "guardian-program", b"synthetic guardian")
        guardian = spec(self.build / "guardian-program")
        write(self.build / "native-program", b"synthetic native " + guardian["sha256"].encode())
        native = spec(self.build / "native-program")
        write(self.build / "bridge-program", b"synthetic bridge " + native["sha256"].encode() + guardian["sha256"].encode() + plan.pm.digest(helper).encode())
        self.built = {"complete_build": True, "stage": "built_not_installed",
                      "profile_sha256": plan.pm.digest(self.profile), "hardware_contacted": False,
                      "installed": False, "installation_ready": False, "source_commit": "a" * 40,
                      "source_sha256": {"fixture.h": plan.pm.digest(source / "fixture.h")},
                      "artifacts": {name: spec(self.build / name) for name in
                                    ("bridge-program", "native-program", "guardian-program")},
                      "pm_helper": helper_spec(helper, True)}
        write_json(self.build / "result.json", self.built)

    def prepare(self, name="plan"):
        return plan.prepare(self.capture, self.build, self.patches, self.profile, self.root / "build" / name)

    def test_target_bound_private_payload_stays_unapplied_and_does_not_copy_key(self):
        result, digest = self.prepare()
        self.assertEqual((result["stage"], result["hardware_contacted"], result["device_writes"]), ("offline_plan_only", False, 0))
        self.assertFalse(result["installation_ready"])
        self.assertFalse(result["consumed_install_intent"])
        self.assertEqual(result["target"]["wlan_mac"], self.observed["wlan_mac"])
        self.assertEqual(len(result["files"]), 11)
        output = self.root / "build/plan"
        self.assertEqual(output.stat().st_mode & 0o777, 0o700)
        self.assertEqual(plan.pm.digest(output / "plan.json"), digest)
        self.assertNotIn("api_encryption_key", (output / "plan.json").read_text())
        for name in [*result["files"], "plan.json"]:
            self.assertEqual((output / name).stat().st_mode & 0o777, 0o600)
        with self.assertRaises(FileExistsError):
            self.prepare()

    def test_capture_from_another_mac_or_co2_variant_cannot_join(self):
        for key, value in (("wlan_mac", "02:00:00:00:00:03"), ("co2_type", 2),
                           ("device_writes", 1), ("boot_id", "unknown")):
            with self.subTest(key=key):
                changed = dict(self.observed, **{key: value})
                write_json(self.capture / "result.json", changed)
                with self.assertRaises(ValueError):
                    self.prepare()
                self.assertFalse((self.root / "build/plan").exists())

    def test_tampered_recovery_source_build_or_elf_does_not_produce_a_plan(self):
        for path in (self.capture / "data/bin/SnowApp", self.build / "ports/monitor1/fixture.h",
                     self.build / "native-program", self.patches / "start.sh.candidate"):
            with self.subTest(path=path.name):
                original = path.read_bytes()
                write(path, original + b"changed")
                with self.assertRaises(ValueError):
                    self.prepare()
                self.assertFalse((self.root / "build/plan").exists())
                write(path, original)

    def test_incomplete_build_or_profile_mismatch_is_not_promoted(self):
        for key, value in (("complete_build", False), ("profile_sha256", "0" * 64),
                           ("hardware_contacted", True), ("installation_ready", True)):
            with self.subTest(key=key):
                write_json(self.build / "result.json", dict(self.built, **{key: value}))
                with self.assertRaises(ValueError):
                    self.prepare()

    def test_manifest_paths_and_symlinks_cannot_escape_the_snapshot(self):
        for name in ("../profile.json", "/etc/passwd", "x\\y", None):
            with self.subTest(name=name), self.assertRaises(ValueError):
                plan.child(self.root, name)
        (self.root / "alias").symlink_to(self.capture, target_is_directory=True)
        with self.assertRaises(ValueError):
            plan.child(self.root, "alias/result.json")
        with self.assertRaises(ValueError):
            plan.private_directory(self.root / "alias")
