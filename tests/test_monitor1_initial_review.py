"""Simulated USB scope joins and isolated read-only shell parser fixtures."""
import importlib
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import unittest

import test_monitor1_disabled_review as fixtures

PORT = Path(__file__).resolve().parents[1] / "ports/monitor1"
sys.path.insert(0, str(PORT))
try:
    initial = importlib.import_module("review_initial_trial")
finally:
    sys.path.pop(0)

JOB = "e" * 32
NONCE = "f" * 32


class InitialAdb(fixtures.ReviewAdb):
    def read(self, command):
        if command == initial.ABSENT_STORES:
            if self.stores_bad:
                raise ValueError("Missing listing or existing autostart store")
            return ""
        if command == initial.INITIAL_PROCESS_SCAN:
            if self.extra_own:
                raise ValueError("Own program found in NAND/RAM")
            return "50"
        if command.startswith("# CGS1_INITIAL_TCP"):
            if self.tcp_bad:
                raise ValueError("TCP table missing, unreadable or endpoint bound")
            return ""
        if command.startswith("# CGS1_INITIAL_RAM"):
            self.ram_reads += 1
            return ("10 21 700 0" if self.ram_changed and self.ram_reads > 1 else "10 20 700 0") + "\n" + self.ram_fs
        if command == initial.MEMORY_READ:
            return self.memory_reply
        if command.startswith("# CGS1_INITIAL_COMMIT_MARKER"):
            return "bad" if self.marker_bad else "commit-disabled " + NONCE + " " + self.plan_id
        return super().read(command)


class InitialReviewTests(unittest.TestCase):
    def setUp(self):
        # All plan/program/capture/receipt bytes here are explicit synthetic
        # test inputs. They are never promoted into a physical USB capture.
        self.fixture = fixtures.DisabledReviewTests(methodName="runTest")
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.directory, self.digest = self.fixture.directory, self.fixture.digest
        self.adb = InitialAdb(self.fixture.fixture.stock_files.copy())
        self.adb.__dict__.update(self.fixture.adb.__dict__)
        self.plan = json.loads((self.directory / "plan.json").read_text())
        self.adb.plan_id = self.plan["plan_id"]
        for path, name in ((initial.review.policy.START, "start.sh.candidate"),
                           (initial.review.policy.WATCHDOG, "watchdog.sh.candidate")):
            self.adb.stock[path] = (self.directory / name).read_bytes()
        self.receipt = {
            "plan_id": self.plan["plan_id"], "plan_sha256": self.digest,
            "direction": "commit_disabled", "stage": "committed_disabled",
            "consumed_install_intent": True, "activated": False, "installed": False,
            "nonce": NONCE, "issued": [initial.review.policy.WATCHDOG, initial.review.policy.START],
            "verified": [initial.review.policy.WATCHDOG, initial.review.policy.START],
        }
        self.write_receipt()
        self.adb.stores_bad = self.adb.extra_own = self.adb.tcp_bad = self.adb.marker_bad = self.adb.ram_changed = False
        self.adb.ram_reads = 0
        self.adb.ram_fs = "1021994 10000 4096"
        self.adb.memory_reply = "MemTotal: 262144 kB\nMemFree: 65536 kB"

    def write_receipt(self):
        fixtures.fixtures.write_json(self.directory / "commit-disabled-receipt.json", self.receipt)

    def collect(self):
        return initial.collect(self.adb, self.directory, self.digest, JOB)

    def test_join_is_read_only_and_cannot_grant_the_missing_device_fd_proof(self):
        before = len(self.adb.writes), len(self.adb.pushes)
        report = self.collect()
        self.assertEqual((len(self.adb.writes), len(self.adb.pushes)), before)
        self.assertEqual(report["device_writes"], 0)
        self.assertFalse(report["execution_authority"])
        self.assertFalse(report["installation_ready"])
        self.assertFalse(report["device_fd_admission_completed"])
        self.assertEqual(report["memory_basis"], "MemFree_lower_bound")
        self.assertEqual(report["conditions"]["ram_identity"], (10, 20))
        fields = report["conditions"].copy()
        fields["disabled"] = initial.review.policy.Snapshot(**fields["disabled"])
        conditions = initial.trial.Conditions(**fields)
        with self.assertRaises(ValueError):
            initial.trial.FirstBridgeTrial(self.plan["plan_id"], self.digest, conditions.disabled.target,
                                          conditions.disabled.boot_id, conditions.bridge_sha256,
                                          "b" * 64, "02:00:00:00:00:02", "fixture-monitor", conditions)

    def test_incomplete_commit_marker_store_socket_or_own_process_cannot_be_ignored(self):
        for name in ("stores_bad", "extra_own", "tcp_bad", "marker_bad", "ram_changed"):
            with self.subTest(name=name):
                setattr(self.adb, name, True)
                self.adb.ram_reads = 0
                before = len(self.adb.writes), len(self.adb.pushes)
                with self.assertRaises(ValueError):
                    self.collect()
                self.assertEqual((len(self.adb.writes), len(self.adb.pushes)), before)
                setattr(self.adb, name, False)
        self.receipt["stage"] = "reconciliation_required_no_retry"
        self.write_receipt()
        with self.assertRaises(ValueError):
            self.collect()

    def test_ram_and_memory_are_actual_separate_budgets_without_cache_credit(self):
        for fs in ("ef53 10000 4096", "1021994 1 4096", "1021994 99999 bad"):
            with self.subTest(fs=fs):
                self.adb.ram_fs = fs
                with self.assertRaises(ValueError):
                    self.collect()
        self.adb.ram_fs = "1021994 10000 4096"
        for value in ("MemAvailable: 999999 kB", "MemTotal: 262144 kB\nMemFree: 1 kB",
                      "MemTotal: 100 kB\nMemFree: 65536 kB", "MemTotal: 262144 kB\nMemFree: 65536",
                      "MemTotal: 262144 kB\nMemFree: 65536 kB\nMemFree: 65536 kB"):
            with self.subTest(value=value):
                self.adb.memory_reply = value
                with self.assertRaises(ValueError):
                    self.collect()
        with self.assertRaises(ValueError):
            initial.ram(self.adb, "../unsafe")

    def test_kernel_tcp_parser_refuses_both_ports_and_missing_or_malformed_tables(self):
        table = self.fixture.fixture.root / "tcp-fixture"
        header = "  sl  local_address rem_address st\n"
        script = initial.tcp_read(False).replace("/proc/net/tcp", shlex.quote(str(table)))
        for body, succeeds in ((header, True), (header + "0: 0100007F:1111 00000000:0000 0A\n", True),
                               (header + "0: 0100007F:17A5 00000000:0000 0A\n", False),
                               (header + "0: 0100007F:0ca0 00000000:0000 06\n", False),
                               (header + "0: BAD:1111 00000000:0000 0A\n", False),
                               (header + "0: 0100007F:1111 00000000:0000 XX\n", False),
                               ("", False), ("bad header\n", False), (header + "malformed\n", False)):
            with self.subTest(body=body):
                table.write_text(body)
                result = subprocess.run(["/bin/sh", "-eu", "-c", script], capture_output=True, text=True)
                self.assertEqual(result.returncode == 0, succeeds, result.stderr)
                self.assertEqual(result.stdout, "")
        table.unlink()
        self.assertNotEqual(subprocess.run(["/bin/sh", "-eu", "-c", script], capture_output=True).returncode, 0)

    def test_actual_scanner_refuses_own_ram_images_after_printing_stock_pid(self):
        proc = self.fixture.fixture.root / "ram-proc"
        for pid in ("56", "57"):
            (proc / pid).mkdir(parents=True)
        (proc / "56/exe").symlink_to("/data/bin/SnowApp")
        other = proc / "57/exe"
        script = initial.INITIAL_PROCESS_SCAN.replace("/proc/", str(proc) + "/")
        for executable in ("/tmp/qingping-full-fixture/native/program",
                           "/tmp/qingping-initial-controller-fixture/program"):
            with self.subTest(executable=executable):
                other.symlink_to(executable)
                result = subprocess.run(["/bin/sh", "-eu", "-c", script], capture_output=True, text=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(result.stdout, "56\n")
                other.unlink()

    def test_positive_absence_listing_propagates_failure_even_after_partial_stdout(self):
        root = self.fixture.fixture.root / "absence"; root.mkdir()
        temporary = root / "tmp"; temporary.mkdir()
        staged = root / "staged"; staged.mkdir()
        mapping = {"/tmp": temporary, "/data/.esphome-cgs1": staged}
        # Replace original tokens once; do not remap /tmp inside a new path.
        script = re.sub(r"/data/\.esphome-cgs1|/tmp",
                        lambda match: shlex.quote(str(mapping[match[0]])), initial.ABSENT_STORES)
        run = lambda **kwargs: subprocess.run(["/bin/sh", "-eu", "-c", script], capture_output=True, **kwargs)
        self.assertEqual(run().returncode, 0)
        for name in ("full-releases", "wifi", "prefs", "full-state"):
            (staged / name).mkdir()
            self.assertNotEqual(run().returncode, 0)
            (staged / name).rmdir()
        tools = root / "bin"; tools.mkdir()
        ls = tools / "ls"; ls.write_text("#!/bin/sh\nprintf 'partial\\n'\nexit 1\n"); ls.chmod(0o700)
        self.assertNotEqual(run(env={**os.environ, "PATH": str(tools)}).returncode, 0)
