"""Post-boot observation contracts; no monitor, radio or device writer.

The scope fixture starts with real private synthetic plan/commit/trial/arm
receipts, then changes the fake boot and every process identity. API events
are in-memory. Only the explicit Linux/root test executes read-only shell,
with /tmp mapped into its own disposable tmpfs tree.
"""
import asyncio
from contextlib import ExitStack
from dataclasses import dataclass
import importlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, Mock, patch

import test_monitor1_arm_next_boot as arms

PORT = Path(__file__).resolve().parents[1] / "ports/monitor1"
with patch.object(sys, "path", [str(PORT), *sys.path]):
    boot = importlib.import_module("verify_bridge_boot_adb")

NEW_BOOT = "00000000-0000-4000-8000-000000000099"
@dataclass
class SensorInfo:
    key: int
    object_id: str


@dataclass
class SensorState:
    key: int
    state: float


class BootAdb(arms.ArmAdb):
    def __init__(self, original):
        super().__init__(original.stock.copy())
        for key in ("remote", "root", "plan", "directory", "digest", "baseline"):
            setattr(self, key, getattr(original, key))
        self.reads = []
        self.boot = NEW_BOOT
        self.extra_process = False
        self.changed_parent = False
        self.missing_maps = False
        self.pid_birth = 1901

    def read(self, command):
        self.reads.append(command)
        subprocess.run(["/bin/sh", "-n", "-c", command], check=True, capture_output=True)
        self.assert_inert(command)
        if command == "cat /proc/sys/kernel/random/boot_id":
            return self.boot
        if command == boot.lock_command():
            return "300\n301"
        if command.startswith("count=0\nfor link in /proc/"):
            if self.extra_process:
                raise ValueError("Extra own process")
            self.assert_scan_bound(command)
            return "150"
        match = re.match(r"cat /proc/(150|151|300|301)/stat", command)
        if match:
            pid = int(match[1])
            parent, start, name = {150: (151, 1100, "/data/bin/SnowApp"), 151: (1, 1110, "/bin/busybox"),
                300: (1, 1900, "/bin/busybox"),
                301: (999 if self.changed_parent else 300, self.pid_birth, boot.BASE + "/program")}[pid]
            return arms.writers.fixtures.process_reply(pid, parent, start, name)
        if command.startswith("stat -L -c '%d %i %s %a %u %h' /proc/301/exe"):
            spec = self.plan["files"]["bridge-program"]
            line = f"1 77 {spec['size']} 700 0 1"
            return line + "\n" + line + "\n" + spec["sha256"] + "  /proc/301/exe"
        if "stat -L -c '%d %i %s %u %h'" in command:
            return "1 55 1000 0 1\n1 55 1000 0 1"
        if command.startswith("entries=$(LC_ALL=C ls -A1 " + boot.BASE):
            if boot.BASE + "/disabled" in self.remote or boot.BASE + "/" + boot.arm.DISARM_DONE in self.remote:
                raise ValueError("Opt-out or disarm completion present")
            if self.remote.get(boot.BASE + "/" + boot.arm.BACKUP) != b"":
                raise ValueError("Private recovery flag missing")
            return ""
        if command.startswith("test -r /proc/150/maps"):
            if self.missing_maps:
                raise ValueError("Incomplete maps read")
            return ""
        if command.startswith("sockets=' '"):
            return "/proc/net/tcp 17A5\n/proc/net/tcp 0CA0"
        if command == boot.arm.initial.MEMORY_READ:
            return "MemTotal: 131072 kB\nMemFree: 40000 kB"
        return super().read(command)

    @staticmethod
    def assert_inert(command):
        assert not re.search(r"(?m)^\s*(?:kill|reboot|exec|insmod|modprobe|rmmod|rm|mv|cp|mkdir|chmod|sync)\b", command)
        # The inherited complete proc scanner discards readlink/sed stderr.
        # Only that fixed /dev/null redirection is allowed, never a file sink.
        assert not re.search(r"(?<![<>])>(?![>&])", command.replace("2>/dev/null", ""))
        assert "/dev/tty" not in command and "/sys/class/gpio" not in command

    @staticmethod
    def assert_scan_bound(command):
        assert "301:/data/.esphome-cgs1/program" in command
        assert "400:/" not in command and "401:/" not in command


class BootScopeTests(unittest.TestCase):
    def setUp(self):
        self.fixture = arms.ArmNextBootTests(methodName="runTest")
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        boot.arm.arm(self.fixture.adb, self.fixture.directory, self.fixture.digest)
        self.adb = BootAdb(self.fixture.adb)
        self.directory, self.digest, self.plan = self.fixture.directory, self.fixture.digest, self.fixture.plan
        self.receipt = json.loads((self.directory / boot.arm.ARM_RECEIPT).read_text())

    def frame(self):
        return boot.scope(self.adb, self.directory, self.plan, self.digest, self.adb.baseline, self.receipt)

    def test_new_boot_and_fresh_process_births_are_read_without_a_device_writer(self):
        before = self.adb.stock.copy(), self.adb.remote.copy()
        result = self.frame()
        self.assertEqual(result["boot_id"], NEW_BOOT)
        self.assertEqual(result["stock"], (150, 1100))
        self.assertEqual(result["child"], (301, 1901))
        self.assertEqual(result["supervisor"], (300, 1900))
        self.assertEqual(before, (self.adb.stock, self.adb.remote))
        self.assertFalse(self.adb.writes or self.adb.pushes or self.adb.transaction_commands)

    def test_old_boot_wrong_parent_extra_process_and_failed_maps_never_observe_runtime(self):
        for attribute, value in (("boot", self.adb.baseline.boot_id), ("changed_parent", True),
                                 ("extra_process", True), ("missing_maps", True)):
            with self.subTest(attribute=attribute), patch.object(self.adb, attribute, value), self.assertRaises(ValueError):
                self.frame()
        self.adb.remote[boot.BASE + "/" + boot.arm.ARM_DONE] = b"partial"
        with self.assertRaises(ValueError):
            self.frame()
        self.assertFalse(self.adb.writes or self.adb.pushes)

    def test_basis_rejects_disarm_partial_history_or_a_different_profile_before_usb(self):
        profile = {"api_mac": "02:00:00:00:00:01", "node_name": "fixture", "api_encryption_key": "test-only"}
        with patch.object(boot.trial.candidate, "read_profile", return_value=(profile, self.plan["basis"]["profile_sha256"])):
            result = boot.basis(self.directory, self.digest, self.directory / "profile.json")
            self.assertEqual(result[-1], profile)
            pending = (self.directory / boot.arm.ARM_RECEIPT).with_suffix(".next")
            pending.write_text("partial")
            with self.assertRaises(ValueError):
                boot.basis(self.directory, self.digest, self.directory / "profile.json")
            pending.unlink()
            (self.directory / boot.arm.DISARM_RECEIPT).write_text("{}")
            with self.assertRaises(ValueError):
                boot.basis(self.directory, self.digest, self.directory / "profile.json")
        self.assertFalse(self.adb.reads)


class SamplesAndApiTests(unittest.TestCase):
    def sample(self, window):
        for name, value in zip(boot.FIELDS, (700.0, 22.0, 45.0, 0.12, 1.0)):
            window.receive(name, value)

    def test_cached_sentinel_nonfinite_and_missing_age_generation_cannot_count_twice(self):
        window = boot.SampleWindow()
        self.sample(window)
        self.assertTrue(window.accept(0))
        self.assertFalse(window.accept(11))
        for name in boot.trial.FIELDS:
            window.receive(name, window.states[name])
        self.assertFalse(window.accept(12))  # Fresh age generation is required too.
        window.receive("stock_response_age", 1.0)
        self.assertTrue(window.accept(12))
        for value in (99999, math.nan, math.inf, True, 10**10000):
            self.sample(window)
            window.receive("co2", value)
            self.assertFalse(window.accept(30))

    def test_api_requires_exact_identity_unique_metadata_and_two_wire_generations(self):
        entities = [SensorInfo(i, name) for i, name in enumerate(boot.FIELDS)]
        client = SimpleNamespace(connect=AsyncMock(), device_info=AsyncMock(return_value=SimpleNamespace(
            mac_address="02:00:00:00:00:01", name="fixture")), list_entities_services=AsyncMock(return_value=(entities, [])))
        timeline = [0.0]
        callback = [None]
        def emit():
            for item, value in zip(entities, (700.0, 22.0, 45.0, 0.12, 1.0)):
                callback[0](SensorState(item.key, value))
        def subscribe(value):
            callback[0] = value
            emit()
        async def advance(_seconds):
            timeline[0] += 11
            emit()
        client.subscribe_states = subscribe
        profile = {"api_mac": "02:00:00:00:00:01", "node_name": "fixture"}
        frame = {"boot_id": NEW_BOOT, "child": (301, 1901)}
        with patch.object(boot.time, "monotonic", side_effect=lambda: timeline[0]), patch.object(boot.asyncio, "sleep", side_effect=advance):
            result = asyncio.run(boot.observe_api(client, profile, AsyncMock(return_value=frame), frame))
        self.assertEqual(result["samples"], 2)
        client.device_info.return_value.name = "another-node"
        with self.assertRaises(ValueError):
            asyncio.run(boot.observe_api(client, profile, AsyncMock(return_value=frame), frame))
        client.device_info.return_value.name = "fixture"
        client.list_entities_services.return_value = (entities + [SensorInfo(99, "co2")], [])
        with self.assertRaises(ValueError):
            asyncio.run(boot.observe_api(client, profile, AsyncMock(return_value=frame), frame))


class BootTransportTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.adb = SimpleNamespace(deadline=None, stop_reads=False)
        self.profile = {"api_encryption_key": "synthetic-private-key"}
        self.frame = {"boot_id": NEW_BOOT, "child": (301, 1901)}
        self.stack.enter_context(patch.object(boot, "basis", return_value=(Path("."), {}, None, {}, self.profile)))
        self.scope = self.stack.enter_context(patch.object(boot, "scope", return_value=self.frame))
        self.stack.enter_context(patch.object(boot.time, "monotonic", return_value=100.0))
        self.stack.enter_context(patch.object(boot.trial, "reserve_port", return_value=45231))
        self.install = self.stack.enter_context(patch.object(boot.trial, "install_forward"))
        self.remove = self.stack.enter_context(patch.object(boot.trial, "remove_forward", return_value="removed"))
        self.observe = self.stack.enter_context(patch.object(boot, "observe_api", new_callable=AsyncMock,
            return_value={"samples": 2, "_last_sample_at": 99.0}))
        self.disconnect = AsyncMock()
        self.client = SimpleNamespace(disconnect=self.disconnect)
        self.api = Mock(return_value=self.client)
        self.stack.enter_context(patch.dict(sys.modules, {"aioesphomeapi": SimpleNamespace(APIClient=self.api)}))
        self.plan = {"plan_id": "1" * 32}
        # The plan binding itself is exercised by the real receipt fixture;
        # this isolated transport test supplies only the fields it consumes.
        boot.basis.return_value = (Path("."), self.plan, None, {}, self.profile)

    def run_verify(self):
        return asyncio.run(boot.verify(self.adb, Path("."), "2" * 64, Path("profile.json")))

    def test_success_cleans_only_own_forward_and_never_claims_installation(self):
        result = self.run_verify()
        self.assertTrue(result["runtime_observed"])
        self.assertEqual(result["api"]["last_sample_age_at_final_scope_s"], 1)
        self.assertNotIn("_last_sample_at", result["api"])
        self.assertFalse(result["installed"] or result["activated"] or result["installation_ready"])
        self.assertEqual(result["device_writes"], 0)
        self.remove.assert_called_once_with(self.adb, 45231)
        self.disconnect.assert_awaited_once()
        self.assertIsNone(self.adb.deadline)
        self.assertFalse(self.adb.stop_reads)

    def test_api_failure_is_sanitized_and_does_not_skip_owned_forward_cleanup(self):
        self.observe.side_effect = ValueError("synthetic-private-key or private address")
        self.disconnect.side_effect = ValueError("disconnect private details")
        result = self.run_verify()
        self.assertFalse(result["runtime_observed"])
        self.assertEqual(result["failed_phase"], "authenticated_wire_observation")
        self.assertEqual(result["api_disconnect"], "unverified")
        self.assertNotIn("private", json.dumps(result))
        self.remove.assert_called_once()

    def test_unknown_forward_creation_is_preserved_and_expired_or_changed_frames_refuse(self):
        self.install.side_effect = TimeoutError("private transport output")
        result = self.run_verify()
        self.assertEqual(result["forward_cleanup"], "ambiguous_forward_preserved")
        self.assertFalse(result["runtime_observed"])
        self.remove.assert_not_called()
        self.install.side_effect = None
        self.observe.return_value = {"samples": 2, "_last_sample_at": 1.0}
        self.assertFalse(self.run_verify()["runtime_observed"])
        self.observe.return_value = {"samples": 2, "_last_sample_at": 99.0}
        self.scope.side_effect = [self.frame, {**self.frame, "child": (301, 1902)}]
        self.assertFalse(self.run_verify()["runtime_observed"])

    def test_cancellation_retires_collector_and_still_cleans_owned_transport(self):
        self.observe.side_effect = asyncio.CancelledError()
        with self.assertRaises(asyncio.CancelledError):
            self.run_verify()
        self.disconnect.assert_awaited_once()
        self.remove.assert_called_once_with(self.adb, 45231)
        self.assertIsNone(self.adb.deadline)
        self.assertFalse(self.adb.stop_reads)

    @unittest.skipUnless(sys.platform.startswith("linux") and os.geteuid() == 0 and Path("/dev/shm").is_dir(),
                         "Real Linux/root metadata in an isolated tmpfs; CI runs the explicit root suite")
    def test_real_read_only_lock_reader_refuses_extra_files_and_symlinks(self):
        with tempfile.TemporaryDirectory(prefix="qingping-boot-read-", dir="/dev/shm") as directory:
            root = Path(directory)
            temporary = root / "tmp"
            temporary.mkdir()
            temporary.chmod(0o1777)
            lock = root / boot.LOCK.lstrip("/")
            lock.mkdir(mode=0o700)
            for leaf, value in (("supervisor.pid", "300\n"), ("child.pid", "301\n")):
                (lock / leaf).write_text(value)
                (lock / leaf).chmod(0o600)
            command = boot.lock_command().replace("/tmp", str(temporary))
            def read():
                return subprocess.run(["/bin/sh", "-eu", "-c", command], capture_output=True, text=True)
            result = read()
            self.assertEqual(result.returncode, 0, result.stderr[-1000:])
            self.assertEqual(result.stdout.splitlines(), ["300", "301"])
            (lock / "extra").touch()
            self.assertNotEqual(read().returncode, 0)
            (lock / "extra").unlink()
            (lock / "child.pid").rename(lock / "child-source")
            (lock / "child.pid").symlink_to(lock / "child-source")
            self.assertNotEqual(read().returncode, 0)


if __name__ == "__main__":
    unittest.main()
