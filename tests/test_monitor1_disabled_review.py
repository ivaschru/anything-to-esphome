"""Fixed-path review protocol with a simulated target, never real USB/argv."""
import importlib
import json
from pathlib import Path
import re
import subprocess
import sys
import unittest
from unittest.mock import patch

import test_monitor1_install_plan as fixtures

PORT = Path(__file__).resolve().parents[1] / "ports/monitor1"
sys.path.insert(0, str(PORT))
try:
    review = importlib.import_module("review_disabled_install")
finally:
    sys.path.pop(0)


def process_reply(pid, parent, start, executable, state="S", uid=0):
    # Embedded spaces and ')' exercise field-22 parsing rather than a naive
    # split of the complete stat string, even though production comm is known.
    line = f"{pid} (stock ) fixture) {state} {parent} " + "0 " * 17 + str(start)
    return line + f"\n{uid}\n{executable}"


class ReviewAdb(fixtures.FakeStageAdb):
    def __init__(self, stock):
        super().__init__(stock)
        self.scans = 0
        self.loaded = False
        self.maps_unavailable = False
        self.bad_arguments = False
        self.change_stock = False

    def read(self, command):
        if command == review.PROCESS_SCAN:
            self.scans += 1
            return "50"
        if command.startswith("cat /proc/50/stat"):
            return process_reply(50, 51, 101 if self.change_stock and self.scans > 1 else 100, "/data/bin/SnowApp")
        if command.startswith("cat /proc/51/stat"):
            return process_reply(51, 1, 110, "/bin/busybox")
        if command.startswith("arguments=$(tr "):
            if self.bad_arguments:
                raise ValueError("Unexpected parent argv")
            return ""
        if command.startswith("test -r /proc/50/maps"):
            if self.loaded or self.maps_unavailable:
                raise ValueError("Loaded helper or unavailable maps")
            return ""
        if "stat -c '%d %i %a %u'" in command:
            return "1 2 700 0\n" + self.remote[review.staging.BASE + "/install.intent"].decode().strip()
        if "stat -c '%d' /data/bin /data/etc/init.d" in command:
            return "1\n1"
        if "stat -c '%s %a %u %h'" in command:
            path = command.rsplit("sha256sum ", 1)[-1]
            data = self.remote[path]
            return f"{len(data)} 600 0 1\n{review.bootstrap.sha(data)}  {path}"
        return super().read(command)


class DisabledReviewTests(unittest.TestCase):
    def setUp(self):
        # Reuse the already explicit synthetic build/capture fixture, without
        # importing its TestCase as another discovered set of test methods.
        self.fixture = fixtures.InstallPlanTests(methodName="runTest")
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        _, self.digest = self.fixture.prepare()
        self.directory = self.fixture.root / "build/plan"
        self.adb = ReviewAdb(self.fixture.stock_files.copy())
        review.staging.stage(self.adb, self.directory, self.digest)
        # The fixture changes only simulated script pins. Keep the policy's
        # module-level immutable pin catalog matched to those synthetic bytes;
        # production always uses its real fixed runtime fingerprints.
        files = json.loads((self.directory / "plan.json").read_text())["files"]
        self.enterContext(patch.object(review.policy, "FACTORY", {
            review.policy.START: files["stock-start.sh.original"]["sha256"],
            review.policy.WATCHDOG: files["stock-watchdog.sh.original"]["sha256"]}))
        self.enterContext(patch.object(review.policy, "PATCHED", {
            review.policy.START: files["start.sh.candidate"]["sha256"],
            review.policy.WATCHDOG: files["watchdog.sh.candidate"]["sha256"]}))
        self.enterContext(patch.object(review.policy, "SOURCES", {
            name: files[name]["sha256"] for name in review.policy.SOURCES}))

    def collect(self):
        return review.collect(self.adb, self.directory, self.digest)

    def test_complete_factory_stage_review_is_read_only_and_not_activation_authority(self):
        before = len(self.adb.writes), len(self.adb.pushes)
        report = self.collect()
        self.assertEqual((len(self.adb.writes), len(self.adb.pushes)), before)
        self.assertEqual(report["device_writes"], 0)
        self.assertFalse(report["installation_ready"])
        self.assertFalse(report["executable_writer_available"])
        self.assertTrue(report["options"]["commit_disabled"]["admissible_for_review"])
        self.assertFalse(report["options"]["rollback_disabled"]["admissible_for_review"])
        self.assertEqual(report["snapshot"]["stock_process"][:2], (50, 100))
        self.assertNotIn("arguments", json.dumps(report))

    def test_known_partial_scripts_offer_only_separate_exact_rollback(self):
        for changed in ((review.policy.START,), (review.policy.WATCHDOG,),
                        (review.policy.START, review.policy.WATCHDOG)):
            with self.subTest(changed=changed):
                self.adb.stock = self.fixture.stock_files.copy()
                for path in changed:
                    name = "start.sh.candidate" if path == review.policy.START else "watchdog.sh.candidate"
                    self.adb.stock[path] = (self.directory / name).read_bytes()
                report = self.collect()
                self.assertFalse(report["options"]["commit_disabled"]["admissible_for_review"])
                rollback = report["options"]["rollback_disabled"]
                self.assertTrue(rollback["admissible_for_review"])
                self.assertEqual({op["target"] for op in rollback["operations"]}, set(changed))

    def test_unavailable_maps_wrong_parent_or_replaced_stock_cannot_mean_idle(self):
        for field in ("loaded", "maps_unavailable", "bad_arguments", "change_stock"):
            with self.subTest(field=field):
                self.adb.scans = 0
                setattr(self.adb, field, True)
                before = len(self.adb.writes), len(self.adb.pushes)
                with self.assertRaises(ValueError):
                    self.collect()
                self.assertEqual((len(self.adb.writes), len(self.adb.pushes)), before)
                setattr(self.adb, field, False)

    def test_partial_stage_receipt_cannot_be_promoted_to_commit_review(self):
        path = self.directory / "stage-receipt.json"
        receipt = json.loads(path.read_text())
        receipt["stage"] = "reconciliation_required_no_retry"
        fixtures.write_json(path, receipt)
        with self.assertRaises(ValueError):
            self.collect()
        self.assertEqual(self.adb.scans, 0)

    def test_stat_parser_handles_comm_delimiters_and_rejects_stopped_or_shifted_fields(self):
        self.assertEqual(review.parse_process(process_reply(50, 51, 100, "/data/bin/SnowApp"), 50,
                                             "/data/bin/SnowApp"), (50, 51, 100))
        for text in (process_reply(50, 51, 100, "/data/bin/SnowApp", state="T"),
                     process_reply(50, 51, 100, "/data/bin/SnowApp", uid=1),
                     process_reply(50, 51, 0, "/data/bin/SnowApp"),
                     process_reply(51, 51, 100, "/data/bin/SnowApp")):
            with self.subTest(text=text), self.assertRaises(ValueError):
                review.parse_process(text, 50, "/data/bin/SnowApp")

    def test_process_scan_distinguishes_kernel_threads_from_unreadable_userspace(self):
        # Run only the read-only scanner against an isolated fake proc tree.
        # Symlink targets are comparison text, never executed or opened. A
        # regular exe leaf makes readlink fail, as procfs does without an mm.
        root = self.fixture.root / "proc"
        for pid in (56, 57):
            (root / str(pid)).mkdir(parents=True)
        (root / "56/exe").symlink_to("/data/bin/SnowApp")
        (root / "57/exe").write_text("no executable link")
        kernel_stat = root / "57/stat"
        kernel_stat.write_text("57 (kernel ) thread) S 1 0 0 0 0 2097152\n")
        script = review.PROCESS_SCAN.replace("/proc/", str(root) + "/")
        result = subprocess.run(["/bin/sh", "-eu", "-c", script], capture_output=True, text=True)
        self.assertEqual((result.returncode, result.stdout), (0, "56\n"))
        kernel_stat.write_text("57 (userspace) S 1 0 0 0 0 0\n")
        self.assertNotEqual(subprocess.run(["/bin/sh", "-eu", "-c", script], capture_output=True).returncode, 0)
        kernel_stat.write_text("57 (exited) Z 1 0 0 0 0 0\n")
        self.assertEqual(subprocess.run(["/bin/sh", "-eu", "-c", script], capture_output=True).returncode, 0)
        (root / "56/exe").unlink()
        (root / "56/exe").symlink_to("/data/.esphome-cgs1/program")
        self.assertNotEqual(subprocess.run(["/bin/sh", "-eu", "-c", script], capture_output=True).returncode, 0)
