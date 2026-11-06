"""First USB trial orchestration contracts; no monitor, ADB server or radio.

Fixtures use only synthetic identities and temporary host receipts. They
exercise ambiguous writes and cleanup rather than promoting a fake USB
capture or a normal short child exit to physical installation evidence.
"""
import asyncio
from contextlib import ExitStack
import importlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, Mock, patch

PORT = Path(__file__).resolve().parents[1] / "ports/monitor1"
with patch.object(sys, "path", [str(PORT), *sys.path]):
    driver = importlib.import_module("trial_initial_bridge_adb")

NONCE = "7" * 32
GUARD = (400, 900)


class TrialDriverTests(unittest.TestCase):
    def test_child_markers_are_exact_and_early_clean_exit_is_not_success(self):
        self.assertEqual(driver.start_record(
            f"CGS1_TRIAL_START_V1 {NONCE} 400 900\r\n".encode(), NONCE), GUARD)
        valid = f"CGS1_TRIAL_END_V1 {NONCE} 400 900 401 901 60000 1 1 1 0 15\n"
        self.assertEqual(driver.end_record(valid.encode(), NONCE, GUARD)["child"], [401, 901])
        for old, new in (("60000", "500"), ("60000", "71001"), ("1 1 1 0 15", "1 1 1 1 9"),
                         ("1 1 1 0 15", "1 0 1 0 15"), ("400 900", "400 901"),
                         ("401 901", "1 901"), (NONCE, "8" * 32), ("0 15", "0 32000")):
            with self.subTest(new=new), self.assertRaises(ValueError):
                driver.end_record(valid.replace(old, new).encode(), NONCE, GUARD)
        for payload in (valid + "extra", valid + valid, valid[:-5]):
            with self.assertRaises(ValueError):
                driver.end_record(payload.encode(), NONCE, GUARD)

    def test_frame_matches_the_fixed_cpp_argument_indices(self):
        files = {name: {"size": i + 100, "sha256": str(i) * 64}
                 for i, name in enumerate(driver.review.staging.STAGED)}
        plan = {"plan_id": "1" * 32, "target": {"boot_id": "01234567-1234-4234-8234-123456789abc",
                "wlan_mac": "02:00:00:00:00:01", "co2_type": 3}, "files": files}
        snapshot = {"root_identity": [50, 100], "stock_process": [123, 456],
                    "watchdog_process": [120, 400]}
        receipt = {"ram_job_id": "4" * 32, "guardian_job_id": "5" * 32, "nonce": NONCE}
        args = driver.frame(plan, "2" * 64, snapshot, "3" * 32, receipt,
                            (60, 300), (60, 200), {"size": 1000, "sha256": "6" * 64})
        self.assertEqual(len(args), 40)
        self.assertEqual(args[13:22], ["4" * 32, "60", "200", "5" * 32,
                                      "60", "300", "1000", "6" * 64, NONCE])
        self.assertEqual(args[22:], [str(value) for spec in files.values() for value in (spec["size"], spec["sha256"])])
        plan["plan_id"] = "x\nexec forbidden"
        with self.assertRaises(ValueError):
            driver.frame(plan, "2" * 64, snapshot, "3" * 32, receipt, (60, 300), (60, 200),
                         {"size": 1000, "sha256": "6" * 64})

    def test_forward_is_explicit_loopback_and_never_replaces_a_mapping(self):
        adb = Mock(serial="fixture")
        driver.install_forward(adb, 45231)
        adb.command.assert_called_once_with(["forward", "--no-rebind", "tcp:localhost:45231", "tcp:6053"])
        for current, expected in (
            (b"fixture tcp:45231 tcp:6053\n", "removed"),
            (b"fixture tcp:localhost:45231 tcp:6053\n", "removed"),
            (b"other tcp:45231 tcp:6053\n", "changed_preserved"),
            (b"fixture tcp:45231 tcp:9999\n", "changed_preserved"),
            (b"fixture tcp:11111 tcp:6053\n", "absent"),
        ):
            with self.subTest(current=current):
                adb.command.reset_mock()
                adb.command.return_value = current
                self.assertEqual(driver.remove_forward(adb, 45231), expected)
                self.assertEqual(adb.command.call_count, 2 if expected == "removed" else 1)

    def test_child_absence_requires_a_positive_complete_scan_not_a_failed_read(self):
        adb = Mock()
        adb.read.return_value = "401 901 S"
        self.assertEqual(driver.child_of(adb, GUARD), (401, 901))
        for reply in ("", "401 901 Z"):
            adb.read.return_value = reply
            with self.assertRaises(driver.ChildNotRunning):
                driver.child_of(adb, GUARD)
        for reply in ("401 901 S\n402 902 S", "401 901 ?", "400 901 S"):
            adb.read.return_value = reply
            with self.assertRaises(ValueError) as error:
                driver.child_of(adb, GUARD)
            self.assertNotIsInstance(error.exception, driver.ChildNotRunning)
        adb.read.side_effect = ValueError("incomplete USB read")
        with self.assertRaises(ValueError) as error:
            driver.child_of(adb, GUARD)
        self.assertNotIsInstance(error.exception, driver.ChildNotRunning)

    def test_endpoint_requires_both_actual_child_listener_records(self):
        adb = Mock()
        adb.read.return_value = "/proc/net/tcp 17A5\n/proc/net/tcp 0CA0"
        driver.endpoint(adb, (401, 901))
        command = adb.read.call_args.args[0]
        subprocess.run(["/bin/sh", "-n", "-c", command], check=True, capture_output=True)
        self.assertIn("/proc/401/fd/*", command)
        self.assertNotIn("kill ", command)
        for reply in ("", "/proc/net/tcp 17A5", "/proc/net/tcp 17A5\n/proc/net/tcp 17A5",
                      "/proc/net/tcp 17A5\n/proc/net/udp 0CA0"):
            adb.read.return_value = reply
            with self.assertRaises(ValueError):
                driver.endpoint(adb, (401, 901))

    def test_running_memory_does_not_credit_cache_or_swap(self):
        adb = Mock()
        adb.read.return_value = "MemTotal: 262144 kB\nMemFree: 8192 kB"
        driver.running_memory(adb)
        for reply in ("MemTotal: 262144 kB\nMemFree: 8191 kB",
                      "MemTotal: 262144 kB\nMemAvailable: 65536 kB",
                      "MemTotal: 262144 kB\nMemFree: 8192 kB\nMemFree: 65536 kB"):
            adb.read.return_value = reply
            with self.assertRaises(ValueError):
                driver.running_memory(adb)

    def test_retired_collector_cannot_issue_a_new_usb_read(self):
        adb = driver.TrialAdb(Path("adb"), "fixture")
        adb.stop_reads = True
        with patch.object(driver.review.preflight.Adb, "command") as command:
            with self.assertRaises(ValueError):
                adb.command(["get-state"])
            command.assert_not_called()

    def test_lost_ram_ack_is_consumed_before_writes_and_never_replayed(self):
        with tempfile.TemporaryDirectory() as temp, ExitStack() as stack:
            root = Path(temp)
            plan = {"plan_id": "1" * 32, "basis": {"profile_sha256": "2" * 64},
                    "target": {"usb_serial": "fixture"}}
            adb = Mock(serial="fixture")
            stack.enter_context(patch.object(driver.review.staging, "load_plan", return_value=(root, plan)))
            stack.enter_context(patch.object(driver, "guardian_artifact", return_value=(root / "program", {"size": 1000, "sha256": "6" * 64})))
            stack.enter_context(patch.object(driver.candidate, "read_profile", return_value=({}, "2" * 64)))
            stack.enter_context(patch.object(driver.review, "collect", return_value={"snapshot": {}}))
            stack.enter_context(patch.object(driver.initial, "committed_marker"))
            stack.enter_context(patch.object(driver.review.staging.offline, "read_json", return_value=({"nonce": "3" * 32}, None)))

            def ambiguous_write(*args):
                receipt = json.loads((root / driver.RECEIPT).read_text())
                self.assertTrue(receipt["consumed_install_intent"])
                self.assertEqual(receipt["stage"], "consumed_before_ram_write")
                self.assertFalse(receipt["launch_attempted"])
                raise ValueError("simulated private output must never be persisted")

            writes = stack.enter_context(patch.object(driver.review.staging, "completed_write", side_effect=ambiguous_write))
            launch = stack.enter_context(patch.object(driver.asyncio, "create_subprocess_exec", new_callable=AsyncMock))
            with self.assertRaisesRegex(RuntimeError, "never repeat"):
                asyncio.run(driver.trial(adb, root, "4" * 64, root, root / "profile"))
            receipt = json.loads((root / driver.RECEIPT).read_text())
            self.assertEqual(receipt["stage"], "reconciliation_required_no_retry")
            self.assertNotIn("simulated private", json.dumps(receipt))
            self.assertFalse(receipt["installed"])
            with self.assertRaises(FileExistsError):
                asyncio.run(driver.trial(adb, root, "4" * 64, root, root / "profile"))
            self.assertEqual(writes.call_count, 1)
            launch.assert_not_awaited()

    def test_controller_joins_exact_reap_and_samples_but_never_marks_installed(self):
        self.controller_case()

    def test_lost_launch_ack_does_not_relaunch_or_signal_a_device_pid(self):
        self.controller_case(lost_launch=True)

    def test_local_adb_reap_failure_still_cleans_owned_forward_and_keeps_outcome(self):
        self.controller_case(cleanup_failure=True)

    def test_local_adb_retirement_has_bounded_term_and_kill_waits(self):
        process = Mock(returncode=None)
        process.wait = AsyncMock(side_effect=[asyncio.TimeoutError, asyncio.TimeoutError])
        with self.assertRaises(asyncio.TimeoutError):
            asyncio.run(driver.retire_local_adb(process))
        process.terminate.assert_called_once_with()
        process.kill.assert_called_once_with()
        self.assertEqual(process.wait.await_count, 2)

    def controller_case(self, lost_launch=False, cleanup_failure=False):
        with tempfile.TemporaryDirectory() as temp, ExitStack() as stack:
            root = Path(temp)
            plan = {"plan_id": "1" * 32, "basis": {"profile_sha256": "2" * 64},
                    "target": {"usb_serial": "fixture"}}
            adb = Mock(serial="fixture", base=["adb", "-s", "fixture"])
            patches = (
                (driver.review.staging, "load_plan", (root, plan)),
                (driver, "guardian_artifact", (root / "program", {"size": 1000, "sha256": "6" * 64})),
                (driver.candidate, "read_profile", ({"node_name": "fixture"}, "2" * 64)),
                (driver.review, "collect", {"snapshot": {}}),
                (driver.initial, "committed_marker", None),
                (driver.review.staging.offline, "read_json", ({"nonce": "3" * 32}, None)),
                (driver.review.staging, "completed_write", None),
                (driver.review.staging, "verify_remote_file", None),
                (driver, "ram_identity", (10, 20)),
                (driver.initial, "collect", {"conditions": {"disabled": {}}}),
                (driver, "same_scope", True),
                (driver, "frame", ["--bounded-first-bridge-v1"]),
                (driver, "reserve_port", 45231),
                (driver, "install_forward", None),
                (driver, "remove_forward", "removed"),
                (driver, "intent_and_ram", None),
            )
            for module, name, result in patches:
                stack.enter_context(patch.object(module, name, return_value=result))
            stack.enter_context(patch.object(driver.uuid, "uuid4", return_value=SimpleNamespace(hex=NONCE)))
            observed = stack.enter_context(patch.object(driver, "observe", new_callable=AsyncMock,
                return_value={"samples": 2, "child": [401, 901], "_last_sample_at": time.monotonic()}))
            process = Mock(returncode=0)
            process.stdout.readline = AsyncMock(side_effect=[
                f"CGS1_TRIAL_START_V1 {NONCE} 400 900\n".encode(),
                f"CGS1_TRIAL_CHILD_V1 {NONCE} 401 901\n".encode()])
            process.communicate = AsyncMock(return_value=(
                f"CGS1_TRIAL_END_V1 {NONCE} 400 900 401 901 60000 1 1 1 0 15\n".encode(), b""))
            launch = stack.enter_context(patch.object(driver.asyncio, "create_subprocess_exec", new_callable=AsyncMock,
                side_effect=ValueError("lost private launch output") if lost_launch else None, return_value=process))
            if cleanup_failure:
                stack.enter_context(patch.object(driver, "retire_local_adb", new_callable=AsyncMock,
                    side_effect=asyncio.TimeoutError("private subprocess detail must not be stored")))
            if lost_launch:
                with self.assertRaisesRegex(RuntimeError, "never repeat"):
                    asyncio.run(driver.trial(adb, root, "4" * 64, root, root / "profile"))
                observed.assert_not_awaited()
            else:
                result = asyncio.run(driver.trial(adb, root, "4" * 64, root, root / "profile"))
                self.assertEqual(result["stage"], "bounded_trial_stopped_observed")
                self.assertEqual(result["api"]["samples"], 2)
                self.assertNotIn("_last_sample_at", result["api"])
                for field in ("installed", "activated", "installation_ready"):
                    self.assertFalse(result[field])
            receipt = json.loads((root / driver.RECEIPT).read_text())
            self.assertTrue(receipt["launch_attempted"])
            self.assertEqual(receipt["forward_cleanup"], "removed")
            self.assertEqual(receipt["local_adb_cleanup"], "cleanup_unverified" if cleanup_failure
                             else "not_started" if lost_launch else "completed")
            self.assertNotIn("private subprocess detail", json.dumps(receipt))
            self.assertEqual(receipt["stage"], "reconciliation_required_no_retry" if lost_launch else "bounded_trial_stopped_observed")
            with self.assertRaises(FileExistsError):
                asyncio.run(driver.trial(adb, root, "4" * 64, root, root / "profile"))
            launch.assert_awaited_once()
            process.terminate.assert_not_called()
            process.kill.assert_not_called()
            argv = launch.call_args.args
            self.assertEqual(argv[:4], ("adb", "-s", "fixture", "shell"))
            self.assertNotIn("api_encryption_key", " ".join(argv))
