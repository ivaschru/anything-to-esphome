"""Prepared-plan sequencing only; no monitor, ADB server, shell or radio.

The existing operation suites qualify their own adapters separately. Here
real private host receipts model interruption and bind the sequence to one
plan; a synthetic terminal report is never called hardware/install proof.
"""
import asyncio
from contextlib import ExitStack
import importlib
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import AsyncMock, Mock, patch

PORT = Path(__file__).resolve().parents[1] / "ports/monitor1"
with patch.object(sys, "path", [str(PORT), *sys.path]):
    engine = importlib.import_module("stage_commit_trial_adb")

DIGEST = "2" * 64
PLAN_ID = "1" * 32
PROFILE_SHA = "3" * 64


class SequenceTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.root = Path(self.stack.enter_context(tempfile.TemporaryDirectory()))
        self.plan = {"plan_id": PLAN_ID, "target": {"usb_serial": "fixture"},
                     "basis": {"profile_sha256": PROFILE_SHA}}
        self.adb = Mock(serial="fixture")
        self.stack.enter_context(patch.object(engine.staging, "load_plan", return_value=(self.root, self.plan)))
        self.guardian = self.stack.enter_context(patch.object(engine.trial, "guardian_artifact"))
        self.profile = self.stack.enter_context(patch.object(engine.trial.candidate, "read_profile",
                                                            return_value=({}, PROFILE_SHA)))
        self.order = []
        self.stage = self.stack.enter_context(patch.object(engine.staging, "stage", side_effect=self.stage_step))
        self.commit = self.stack.enter_context(patch.object(engine.commit, "execute", side_effect=self.commit_step))
        self.trial = self.stack.enter_context(patch.object(engine.trial, "trial", new_callable=AsyncMock,
                                                           side_effect=self.trial_step))

    def record(self, name, terminal):
        result = {"plan_id": PLAN_ID, "plan_sha256": DIGEST, "consumed_install_intent": True,
                  "stage": terminal, "installed": False, "activated": False}
        engine.staging.store_receipt(self.root / name, result, initial=True)
        return result

    def stage_step(self, *args):
        self.order.append("stage")
        return self.record("stage-receipt.json", "staged_disabled_not_installed")

    def commit_step(self, *args):
        self.assertEqual(args[-1], "commit_disabled")
        self.order.append("commit")
        return self.record("commit-disabled-receipt.json", "committed_disabled")

    async def trial_step(self, *args):
        self.order.append("trial")
        result = self.record(engine.trial.RECEIPT, "bounded_trial_stopped_observed")
        result.update(local_adb_cleanup="completed", forward_cleanup="removed")
        return result

    def run_engine(self):
        return asyncio.run(engine.run(self.adb, self.root, DIGEST, self.root / "candidate", self.root / "profile"))

    def test_exact_sequence_runs_once_and_never_claims_permanent_installation(self):
        result = self.run_engine()
        self.assertEqual(self.order, ["stage", "commit", "trial"])
        self.assertEqual(result["stage"], "disabled_sequence_trial_observed")
        for key in ("installed", "activated", "installation_ready", "retry_authorized"):
            self.assertIs(result[key], False)
        with self.assertRaisesRegex(ValueError, "history exists"):
            self.run_engine()
        self.assertEqual(self.stage.call_count, 1)
        self.assertEqual(self.commit.call_count, 1)
        self.assertEqual(self.trial.await_count, 1)

    def test_trial_prerequisites_are_checked_before_any_device_write(self):
        self.guardian.side_effect = ValueError("missing separate guardian")
        with self.assertRaises(ValueError):
            self.run_engine()
        self.guardian.side_effect = None
        self.profile.return_value = ({}, "4" * 64)
        with self.assertRaisesRegex(ValueError, "exact private profile"):
            self.run_engine()
        self.stage.assert_not_called()
        self.commit.assert_not_called()
        self.trial.assert_not_awaited()

    def test_partial_receipt_and_dangling_link_refuse_before_usb(self):
        path = self.root / "stage-receipt.next"
        path.write_text("incomplete")
        with self.assertRaisesRegex(ValueError, "history exists"):
            self.run_engine()
        path.unlink()
        path.symlink_to(self.root / "missing")
        with self.assertRaisesRegex(ValueError, "history exists"):
            self.run_engine()
        self.guardian.assert_not_called()
        self.assertFalse(self.adb.mock_calls)
        self.stage.assert_not_called()

    def test_failed_or_incomplete_commit_never_reaches_launch_or_auto_rollback(self):
        self.commit.side_effect = TimeoutError("private transport output")
        with self.assertRaisesRegex(RuntimeError, "disabled_commit") as caught:
            self.run_engine()
        self.assertNotIn("private transport output", str(caught.exception))
        self.trial.assert_not_awaited()
        self.assertEqual(self.order, ["stage"])
        with self.assertRaisesRegex(ValueError, "history exists"):
            self.run_engine()
        self.assertEqual(self.stage.call_count, 1)

    def test_unverified_stage_result_cannot_advance_to_vendor_writer(self):
        self.stage.side_effect = None
        self.stage.return_value = {"stage": "reconciliation_required_no_retry"}
        with self.assertRaisesRegex(RuntimeError, "disabled_stage"):
            self.run_engine()
        self.commit.assert_not_called()
        self.trial.assert_not_awaited()

    def test_status_after_commit_uses_current_disabled_collector_never_factory_or_writer(self):
        self.record("stage-receipt.json", "staged_disabled_not_installed")
        self.record("commit-disabled-receipt.json", "committed_disabled")
        (self.root / "commit-disabled-receipt.next").write_text("interrupted update")
        with patch.object(engine.commit.review, "collect") as collect, \
                patch.object(engine.staging, "reconcile") as factory:
            result = engine.status(self.adb, self.root, DIGEST)
        collect.assert_called_once_with(self.adb, self.root, DIGEST)
        factory.assert_not_called()
        self.assertTrue(result["receipt_update_incomplete"])
        self.assertFalse(result["retry_authorized"])
        self.stage.assert_not_called()
        self.commit.assert_not_called()
        self.trial.assert_not_awaited()

    def test_later_explicit_rollback_supersedes_historical_trial_status(self):
        self.record("stage-receipt.json", "staged_disabled_not_installed")
        self.record("commit-disabled-receipt.json", "committed_disabled")
        self.record(engine.trial.RECEIPT, "bounded_trial_stopped_observed")
        self.record("rollback-disabled-receipt.json", "reconciliation_required_no_retry")
        with patch.object(engine.commit.review, "collect") as collect, \
                patch.object(engine.trial, "status") as historical:
            result = engine.status(self.adb, self.root, DIGEST)
        collect.assert_called_once_with(self.adb, self.root, DIGEST)
        historical.assert_not_called()
        self.assertEqual(result["stage"], "read_only_disabled_scope_observed")
        self.assertFalse(result["retry_authorized"])

    def test_newer_next_boot_state_uses_its_reader_instead_of_old_trial(self):
        self.record("stage-receipt.json", "staged_disabled_not_installed")
        self.record("commit-disabled-receipt.json", "committed_disabled")
        self.record(engine.trial.RECEIPT, "bounded_trial_stopped_observed")
        self.record(engine.next_boot.ARM_RECEIPT, "bridge_autostart_armed_next_boot_unverified")
        with patch.object(engine.next_boot, "status", return_value={"stage": "read_only_armed", "autostart_armed": True}) as current, \
                patch.object(engine.trial, "status") as old:
            result = engine.status(self.adb, self.root, DIGEST)
        current.assert_called_once_with(self.adb, self.root, DIGEST)
        old.assert_not_called()
        self.assertTrue(result["autostart_armed"])
        self.assertFalse(result["installed"])
        self.assertFalse(result["retry_authorized"])


if __name__ == "__main__":
    unittest.main()
