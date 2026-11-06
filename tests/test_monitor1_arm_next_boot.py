"""Fixed next-boot flag transitions over synthetic USB state; never launch.

Reuse the real disabled-commit fixture and its receipts. The fake device
performs only the two known flag effects and syntax-checks generated shell;
it cannot qualify NAND, boot, target kernel or an actual running bridge.
"""
import importlib
from dataclasses import replace
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import unittest
from unittest.mock import patch

import test_monitor1_disabled_writer as writers

PORT = Path(__file__).resolve().parents[1] / "ports/monitor1"
with patch.object(sys, "path", [str(PORT), *sys.path]):
    arm = importlib.import_module("arm_bridge_next_boot_adb")


class ArmAdb(writers.WriterAdb):
    fail_after_backup = False
    fail_after_unlink = False
    fail_after_completion = False
    own_ram_running = False

    def read(self, command):
        if command.startswith("# CGS1_BRIDGE_COMPLETION "):
            operation = command.splitlines()[0].rsplit(" ", 1)[1]
            name = arm.ARM_RECEIPT if operation == "arm" else arm.DISARM_RECEIPT
            receipt = json.loads((self.directory / name).read_text())
            leaf, body = arm.completion_record(self.plan, self.digest, receipt["nonce"], operation)
            if self.remote.get(arm.BASE + "/" + leaf) != (body + "\n").encode():
                raise ValueError("Device command completion is unknown")
            return ""
        if command.startswith("# CGS1_BRIDGE_NEXT_BOOT_SCOPE "):
            state = command.splitlines()[0].rsplit(" ", 1)[1]
            bridge, backup = arm.BASE + "/disabled", arm.BASE + "/" + arm.BACKUP
            present = bridge in self.remote
            saved = backup in self.remote
            if (state == "disabled" and (not present or saved) or
                    state == "backup_disabled" and (not present or not saved) or
                    state == "armed" and (present or not saved) or self.own_ram_running or
                    self.remote.get(arm.BASE + "/pm-helper.disabled") != b""):
                raise ValueError("Current known idle flag scope differs")
            return ""
        if command == "LC_ALL=C ls -A1 " + arm.BASE:
            return "\n".join(sorted({name[len(arm.BASE) + 1:].split("/")[0]
                                      for name in self.remote if name.startswith(arm.BASE + "/")}))
        return super().read(command)

    def completed(self, command):
        self.assert_syntax(command)
        self.transaction_commands.append(command)
        if "\nrm " + arm.BASE + "/disabled\n" in command:
            self.read(arm.guard(self.plan, self.baseline, "disabled"))
            self.remote[arm.BASE + "/" + arm.BACKUP] = b""
            if self.fail_after_backup:
                raise ValueError("Lost ACK after recovery flag")
            self.read(arm.guard(self.plan, self.baseline, "backup_disabled"))
            del self.remote[arm.BASE + "/disabled"]
            if self.fail_after_unlink:
                raise ValueError("Private transport diagnostic must not be saved")
            operation = "arm"
        else:
            self.read(arm.guard(self.plan, self.baseline, "armed"))
            if arm.BASE + "/disabled" in self.remote:
                raise ValueError("Noclobber refuses a repeated flag creation")
            self.remote[arm.BASE + "/disabled"] = b""
            operation = "disarm"
        name = arm.ARM_RECEIPT if operation == "arm" else arm.DISARM_RECEIPT
        receipt = json.loads((self.directory / name).read_text())
        leaf, body = arm.completion_record(self.plan, self.digest, receipt["nonce"], operation)
        self.remote[arm.BASE + "/" + leaf] = (body + "\n").encode()
        if self.fail_after_completion:
            raise ValueError("Private transport diagnostic must not be saved")

    @staticmethod
    def assert_syntax(command):
        subprocess.run(["/bin/sh", "-n", "-c", command], check=True, capture_output=True)
        for forbidden in ("reboot", "kill ", "insmod", "modprobe", "launch.sh start", "launch.sh enable",
                          "/dev/tty", "/sys/class/gpio", "LD_PRELOAD="):
            assert forbidden not in command
        # Exactly the admitted empty bridge opt-out can be unlinked. There
        # is no variable path, recursive deletion or recovery-file removal.
        removes = [line for line in command.splitlines() if line.startswith("rm ")]
        assert removes in ([], ["rm " + arm.BASE + "/disabled"])


class ArmNextBootTests(unittest.TestCase):
    def setUp(self):
        self.fixture = writers.DisabledWriterTests(methodName="runTest")
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.fixture.execute("commit_disabled")
        self.directory, self.digest = self.fixture.directory, self.fixture.digest
        old = self.fixture.adb
        self.adb = ArmAdb(old.stock.copy())
        self.adb.remote, self.adb.root = old.remote.copy(), True
        _, self.plan = arm.staging.load_plan(self.directory, self.digest)
        self.adb.plan = self.plan
        self.adb.directory, self.adb.digest = self.directory, self.digest
        self.adb.baseline = arm.patched_baseline(self.plan, self.digest,
                                                arm.commit.review.collect(self.adb, self.directory, self.digest)["snapshot"])
        self.proof = {"plan_id": self.plan["plan_id"], "plan_sha256": self.digest,
            "stage": "bounded_trial_stopped_observed", "consumed_install_intent": True,
            "launch_attempted": True, "installed": False, "activated": False, "installation_ready": False,
            "local_adb_cleanup": "completed", "forward_cleanup": "removed",
            "guardian_process": [400, 900], "child": [401, 901],
            "result": {"guardian": [400, 900], "child": [401, 901], "elapsed_ms": 60000,
                       "reaped": True, "protection_ack": True, "term_sent": True, "forced": False, "wait_status": 15},
            "api": {"child": [401, 901], "samples": 2, "last_sample_age_at_reap_s": 3.0}}
        arm.staging.store_receipt(self.directory / arm.trial.RECEIPT, self.proof, initial=True)

    def test_arm_and_separate_disarm_touch_only_bridge_flag_and_keep_recovery(self):
        before_stock = self.adb.stock.copy()
        result = arm.arm(self.adb, self.directory, self.digest)
        self.assertTrue(result["autostart_armed"])
        self.assertNotIn(arm.BASE + "/disabled", self.adb.remote)
        self.assertEqual(self.adb.remote[arm.BASE + "/" + arm.BACKUP], b"")
        self.assertEqual(self.adb.remote[arm.BASE + "/pm-helper.disabled"], b"")
        self.assertEqual(arm.status(self.adb, self.directory, self.digest)["stage"], "read_only_armed")
        result = arm.disarm(self.adb, self.directory, self.digest)
        self.assertFalse(result["autostart_armed"])
        self.assertEqual(self.adb.remote[arm.BASE + "/disabled"], b"")
        self.assertIn(arm.BASE + "/" + arm.BACKUP, self.adb.remote)
        self.assertEqual(self.adb.stock, before_stock)
        for key in ("installed", "activated", "installation_ready"):
            self.assertIs(result[key], False)
        with self.assertRaises(ValueError):
            arm.arm(self.adb, self.directory, self.digest)
        with self.assertRaises(ValueError):
            arm.disarm(self.adb, self.directory, self.digest)
        self.assertEqual(len(self.adb.transaction_commands), 2)

    def test_lost_ack_after_completion_is_read_back_without_repeat_and_can_be_disarmed(self):
        self.adb.fail_after_completion = True
        with self.assertRaisesRegex(RuntimeError, "never repeat"):
            arm.arm(self.adb, self.directory, self.digest)
        receipt = json.loads((self.directory / arm.ARM_RECEIPT).read_text())
        self.assertEqual(receipt["stage"], "reconciliation_required_no_retry")
        self.assertIsNone(receipt["autostart_armed"])
        self.assertNotIn("Private transport", json.dumps(receipt))
        self.assertTrue(arm.status(self.adb, self.directory, self.digest)["autostart_armed"])
        with self.assertRaises(ValueError):
            arm.arm(self.adb, self.directory, self.digest)
        self.adb.fail_after_completion = False
        self.assertFalse(arm.disarm(self.adb, self.directory, self.digest)["autostart_armed"])
        self.assertEqual(len(self.adb.transaction_commands), 2)

    def test_interrupted_backup_remains_disabled_and_is_never_completed_automatically(self):
        self.adb.fail_after_backup = True
        with self.assertRaises(RuntimeError):
            arm.arm(self.adb, self.directory, self.digest)
        self.assertEqual(self.adb.remote[arm.BASE + "/disabled"], b"")
        self.assertEqual(arm.status(self.adb, self.directory, self.digest)["stage"],
                         "device_completion_unverified_no_write_authority")
        with self.assertRaisesRegex(ValueError, "completion is unverified"):
            arm.disarm(self.adb, self.directory, self.digest)
        self.assertEqual(len(self.adb.transaction_commands), 1)

    def test_unknown_writer_after_unlink_cannot_race_a_new_disarm(self):
        self.adb.fail_after_unlink = True
        with self.assertRaises(RuntimeError):
            arm.arm(self.adb, self.directory, self.digest)
        self.assertNotIn(arm.BASE + "/disabled", self.adb.remote)
        self.assertIsNone(arm.status(self.adb, self.directory, self.digest)["autostart_armed"])
        with self.assertRaisesRegex(ValueError, "possibly pending"):
            arm.disarm(self.adb, self.directory, self.digest)
        self.assertFalse((self.directory / arm.DISARM_RECEIPT).exists())
        self.assertEqual(len(self.adb.transaction_commands), 1)

    def test_missing_or_forced_trial_and_live_ram_owner_refuse_before_writes(self):
        self.proof["result"]["forced"] = True
        arm.staging.store_receipt(self.directory / arm.trial.RECEIPT, self.proof)
        with self.assertRaises(ValueError):
            arm.arm(self.adb, self.directory, self.digest)
        self.proof["result"]["forced"] = False
        arm.staging.store_receipt(self.directory / arm.trial.RECEIPT, self.proof)
        self.adb.own_ram_running = True
        with self.assertRaises(ValueError):
            arm.arm(self.adb, self.directory, self.digest)
        self.assertFalse(self.adb.transaction_commands)
        self.assertFalse((self.directory / arm.ARM_RECEIPT).exists())

    def test_new_boot_never_reuses_old_stock_process_identity_or_disarms_running_code(self):
        arm.arm(self.adb, self.directory, self.digest)
        with patch.object(arm, "target_boot", return_value="00000000-0000-4000-8000-000000000099"):
            self.assertEqual(arm.status(self.adb, self.directory, self.digest)["stage"],
                             "new_boot_requires_authenticated_runtime_verification")
            with self.assertRaises(ValueError):
                arm.disarm(self.adb, self.directory, self.digest)
        self.assertEqual(len(self.adb.transaction_commands), 1)

    @unittest.skipUnless(sys.platform.startswith("linux") and os.geteuid() == 0,
                         "Real Linux/root metadata; CI runs an isolated root fixture")
    def test_real_fixed_flag_effects_and_recovery_in_an_isolated_filesystem(self):
        root = self.fixture.fixture.fixture.root / "arm-isolated-device"
        for name, data in {**self.adb.stock, **self.adb.remote}.items():
            path = root / name.lstrip("/")
            path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            path.write_bytes(data)
            path.chmod(0o600)
        base = root / arm.BASE.lstrip("/")
        base.chmod(0o700)
        for leaf in ("program", "launch.sh", "SnowApp-with-PM"):
            (base / leaf).chmod(0o700)
        for leaf in ("data/bin/SnowApp", "data/bin/watchdog.sh", "data/etc/init.d/start.sh"):
            (root / leaf).chmod(0o755)
        (root / "tmp").mkdir(mode=0o1777)
        for pid, parent, start, executable in ((50, 51, 100, str(root / "data/bin/SnowApp")),
                                               (51, 1, 110, "/bin/busybox")):
            proc = root / "proc" / str(pid)
            proc.mkdir(parents=True)
            row = writers.fixtures.process_reply(pid, parent, start, executable).splitlines()[0]
            (proc / "stat").write_text(row + "\n")
            (proc / "exe").symlink_to(executable)
        (root / "proc/50/maps").write_text("")
        (root / "proc/51/cmdline").write_bytes(b"/bin/sh\0" + str(root / "data/bin/watchdog.sh").encode() + b"\0")
        for name, value in {"sys/class/net/wlan0/address": self.adb.baseline.target[0],
                            "data/etc/os-release": "CLEARGRASS_VERSION=4.1.8_0287",
                            "proc/sys/kernel/random/boot_id": self.adb.baseline.boot_id,
                            "data/etc/setting.ini": "[sensors]\nco2_type=3"}.items():
            path = root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(value + "\n")
        metadata = base.stat()
        baseline = replace(self.adb.baseline, root_identity=(metadata.st_dev, metadata.st_ino))

        def run(command):
            # Rewrite every device path, including /tmp, exactly once. The
            # generated commands never touch the host's real data/proc/sys.
            mapped = re.sub(r"(?:(?<![A-Za-z0-9_./-])|(?<=\\n))/(?:usr/lib|data|proc|sys|lib|etc|tmp)(?=/|$)",
                            lambda match: str(root) + match[0], command)
            mapped = re.sub(r"(?m)^sync$", ":", mapped)
            return subprocess.run(["/bin/sh", "-eu", "-c", "umask 077\n" + mapped],
                                  capture_output=True, text=True)

        command = arm.arming_command(self.plan, baseline, self.digest, "3" * 32)
        result = run(command)
        self.assertEqual(result.returncode, 0, result.stderr[-1000:])
        self.assertFalse((base / "disabled").exists())
        self.assertEqual((base / arm.BACKUP).read_bytes(), b"")
        self.assertNotEqual(run(command).returncode, 0)  # No overwrite/replay.
        result = run(arm.completion_guard(self.plan, self.digest, "3" * 32, "arm") +
                     arm.disarming_command(self.plan, baseline, self.digest, "4" * 32))
        self.assertEqual(result.returncode, 0, result.stderr[-1000:])
        self.assertEqual((base / "disabled").read_bytes(), b"")
        self.assertEqual((base / "disabled").stat().st_mode & 0o777, 0o600)
        self.assertTrue((base / arm.BACKUP).exists())
        self.assertTrue((base / "pm-helper.disabled").exists())
        # An unexecutable bridge must refuse BEFORE creating recovery or
        # removing its opt-out; byte hashes alone do not prove bootability.
        (base / arm.BACKUP).unlink()  # Own disposable fixture, never device history.
        (base / arm.ARM_DONE).unlink()
        (base / arm.DISARM_DONE).unlink()
        (base / "program").chmod(0o600)
        self.assertNotEqual(run(command).returncode, 0)
        self.assertTrue((base / "disabled").exists())
        self.assertFalse((base / arm.BACKUP).exists())


if __name__ == "__main__":
    unittest.main()
