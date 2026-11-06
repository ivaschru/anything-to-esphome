"""Disabled writer protocol, plus isolated Linux/root file replacement QA."""
from dataclasses import replace
import importlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import unittest
from unittest.mock import patch

import test_monitor1_disabled_review as fixtures

PORT = Path(__file__).resolve().parents[1] / "ports/monitor1"
sys.path.insert(0, str(PORT))
try:
    writer = importlib.import_module("commit_disabled_install")
finally:
    sys.path.pop(0)


class WriterAdb(fixtures.ReviewAdb):
    def __init__(self, stock):
        super().__init__(stock)
        self.transaction_commands = []
        self.fail_after_rename = None

    def read(self, command):
        if "/.commit-disabled.lock/owner" in command:
            return self.remote[writer.staging.BASE + "/.commit-disabled.lock/owner"].decode().strip()
        return super().read(command)

    def completed(self, command):
        result = subprocess.run(["/bin/sh", "-n", "-c", command], capture_output=True, text=True)
        if result.returncode:
            raise AssertionError("Generated transaction syntax failed: " + result.stderr[:500])
        self.transaction_commands.append(command)
        self.assert_inert(command)
        claim = re.search(r"printf '%s\\n' '([^']+)' > (/data/\.esphome-cgs1/\.(?:commit|rollback)-disabled.lock/owner)", command)
        if claim:
            self.remote[claim[2]] = (claim[1] + "\n").encode()
            return
        copied = re.search(r"\ncp (/data/\.esphome-cgs1/[A-Za-z0-9_.-]+) ", command)
        renamed = re.search(r"\nmv /data/\.esphome-cgs1/\.[A-Za-z-]+.next (/data/(?:bin/watchdog.sh|etc/init.d/start.sh))\n", command)
        assert copied and renamed
        self.stock[renamed[1]] = self.remote[copied[1]]
        if renamed[1] == self.fail_after_rename:
            raise ValueError("ACK lost after the actual simulated rename")

    @staticmethod
    def assert_inert(command):
        assert not re.search(r"(?m)^\s*(?:kill|reboot|exec|insmod|modprobe|rmmod)\b", command)
        assert "launch.sh start" not in command and "rm " not in command
        assert "/dev/tty" not in command and "/sys/class/gpio" not in command


class DisabledWriterTests(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.DisabledReviewTests(methodName="runTest")
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.directory, self.digest = self.fixture.directory, self.fixture.digest
        previous = self.fixture.adb
        self.adb = WriterAdb(previous.stock.copy())
        self.adb.remote, self.adb.root = previous.remote.copy(), True
        self.enterContext(patch.object(writer.staging, "completed_write", side_effect=lambda adb, command: adb.completed(command)))

    def execute(self, direction):
        return writer.execute(self.adb, self.directory, self.digest, direction)

    def test_commit_then_separate_rollback_leave_both_opt_outs_and_never_launch(self):
        receipt = self.execute("commit_disabled")
        self.assertEqual(receipt["stage"], "committed_disabled")
        self.assertEqual(receipt["verified"], [writer.policy.WATCHDOG, writer.policy.START])
        self.assertFalse(receipt["activated"])
        before = len(self.adb.transaction_commands)
        with self.assertRaises(ValueError):
            self.execute("commit_disabled")
        self.assertEqual(len(self.adb.transaction_commands), before)
        receipt = self.execute("rollback_disabled")
        self.assertEqual(receipt["stage"], "rolled_back_disabled")
        self.assertEqual(receipt["verified"], [writer.policy.START, writer.policy.WATCHDOG])
        self.assertEqual(self.adb.stock, self.fixture.fixture.stock_files)
        for leaf in ("disabled", "pm-helper.disabled"):
            self.assertEqual(self.adb.remote[writer.staging.BASE + "/" + leaf], b"")

    def test_lost_ack_is_consumed_without_resend_and_only_separate_rollback_can_recover(self):
        self.adb.fail_after_rename = writer.policy.WATCHDOG
        with self.assertRaises(ValueError):
            self.execute("commit_disabled")
        path = self.directory / "commit-disabled-receipt.json"
        receipt = json.loads(path.read_text())
        self.assertEqual(receipt["stage"], "reconciliation_required_no_retry")
        self.assertEqual(receipt["vendor_files_changed"], "unknown_requires_readback")
        self.assertEqual(receipt["issued"], [writer.policy.WATCHDOG])
        before = len(self.adb.transaction_commands)
        with self.assertRaises(ValueError):
            self.execute("commit_disabled")
        self.assertEqual(len(self.adb.transaction_commands), before)
        self.adb.fail_after_rename = None
        rollback = self.execute("rollback_disabled")
        self.assertEqual(rollback["verified"], [writer.policy.WATCHDOG])
        self.assertEqual(self.adb.stock, self.fixture.fixture.stock_files)

    def test_failed_command_substitution_never_becomes_a_successful_scope_comparison(self):
        script = writer.equal("printf '50'; exit 1", 50) + "printf 'incorrectly-continued'"
        result = subprocess.run(["/bin/sh", "-eu", "-c", script], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("incorrectly-continued", result.stdout)

    def test_operation_sources_and_paths_cannot_be_substituted(self):
        observed = writer.fresh_snapshot(self.adb, self.directory, self.digest)
        _, plan = writer.staging.load_plan(self.directory, self.digest)
        nonce = "3" * 32
        bad = [writer.policy.Operation("launch.sh", writer.policy.START, writer.policy.FACTORY[writer.policy.START], writer.policy.SOURCES["launch.sh"]),
               writer.policy.Operation("start.sh.candidate", "/etc/profile", "0" * 64, "1" * 64)]
        for operation in bad:
            with self.assertRaises(ValueError):
                writer.replacement_command(plan, observed, "commit_disabled", nonce, operation)
        with self.assertRaises(ValueError):
            writer.inline_guard(plan, observed, "commit_disabled", "bad;command")

    @unittest.skipUnless(sys.platform.startswith("linux") and os.geteuid() == 0,
                         "Real Linux/root metadata; CI runs an explicit disposable root fixture")
    def test_real_atomic_replacement_in_an_isolated_filesystem_keeps_recovery_sources(self):
        # Every device path is mapped into a private temporary tree. Run the
        # actual generated guard/copy/hash/sh-n/rename code there, never the
        # production-path script or firmware program on the build host.
        root = self.fixture.fixture.root / "isolated-device"
        for name, data in {**self.adb.stock, **self.adb.remote}.items():
            path = root / name.lstrip("/")
            path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            path.write_bytes(data)
            path.chmod(0o600)
        base = root / writer.staging.BASE.lstrip("/")
        base.chmod(0o700)
        for pid, parent, start, executable in ((50, 51, 100, str(root / "data/bin/SnowApp")), (51, 1, 110, "/bin/busybox")):
            proc = root / "proc" / str(pid)
            proc.mkdir(parents=True)
            (proc / "stat").write_text(fixtures.process_reply(pid, parent, start, executable).splitlines()[0] + "\n")
            (proc / "exe").symlink_to(executable)
        (root / "proc/50/maps").write_text("")
        (root / "proc/51/cmdline").write_bytes(b"/bin/sh\0" + str(root / "data/bin/watchdog.sh").encode() + b"\0")
        fixed = {"sys/class/net/wlan0/address": "02:00:00:00:00:01\n", "data/etc/os-release": "CLEARGRASS_VERSION=4.1.8_0287\n",
                 "proc/sys/kernel/random/boot_id": "00000000-0000-4000-8000-000000000001\n", "data/etc/setting.ini": "[sensors]\nco2_type=3\n"}
        for name, text in fixed.items():
            path = root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text)
        _, plan = writer.staging.load_plan(self.directory, self.digest)
        observed = writer.fresh_snapshot(self.adb, self.directory, self.digest)
        metadata = base.stat()
        observed = replace(observed, root_identity=(metadata.st_dev, metadata.st_ino))
        for direction in ("commit_disabled", "rollback_disabled"):
            phase = writer.PHASES[direction]
            nonce = "3" * 32
            lock = base / ("." + phase + ".lock")
            lock.mkdir(mode=0o700)
            (lock / "owner").write_text(phase + " " + nonce + " " + plan["plan_id"] + "\n")
            (lock / "owner").chmod(0o600)
            action = writer.policy.DisabledVendorTransaction(plan["plan_id"], self.digest, observed.target, observed.boot_id, direction, observed)
            for _ in action.operations:
                operation = action.issue(observed)
                command = writer.replacement_command(plan, observed, direction, nonce, operation)
                command = re.sub(r"/(?:usr/lib|data|proc|sys|lib|etc)(?=/|$)", lambda match: str(root) + match[0], command)
                # Global durability is a device QA item; don't flush unrelated
                # host filesystems. Real copy/hash/rename are still executed.
                command = re.sub(r"(?m)^sync$", ":", command)
                result = subprocess.run(["/bin/sh", "-eu", "-c", command], capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr[-1000:])
                actual = {path: writer.staging.offline.pm.digest(root / path.lstrip("/")) for path in writer.preflight.FILES}
                observed = replace(observed, vendor_hashes=tuple(sorted(actual.items())))
                self.assertIsNotNone(action.acknowledge(observed))
            self.assertEqual(action.state, "committed_disabled" if direction == "commit_disabled" else "rolled_back_disabled")
        self.assertEqual((root / "data/bin/watchdog.sh").read_bytes(), self.fixture.fixture.stock_files[writer.policy.WATCHDOG])
        self.assertEqual((base / "stock-watchdog.sh.original").read_bytes(), self.fixture.fixture.stock_files[writer.policy.WATCHDOG])
        self.assertEqual((base / "watchdog.sh.candidate").read_bytes(), (self.directory / "watchdog.sh.candidate").read_bytes())
        self.assertFalse((base / ".commit-disabled.next").exists())
        self.assertFalse((base / ".rollback-disabled.next").exists())
        for leaf in ("disabled", "pm-helper.disabled"):
            self.assertEqual((base / leaf).read_bytes(), b"")
