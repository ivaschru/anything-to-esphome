"""Experimental app orchestration with fake engines; no hardware qualification."""
import asyncio
import hashlib
import json
import os
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, Mock, patch
import test_usb_plan as plan_fixtures

installation = sys.modules["installation"]
with patch.object(sys, "path", [str(plan_fixtures.builds.preparations.ROOT / "apps/monitor1_usb/rootfs"), *sys.path]):
    import usb_install_job as job


class InstallTests(unittest.TestCase):
    def setUp(self):
        self.fixture = plan_fixtures.PlanTests(methodName="runTest")
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.fixture.prepare()
        self.directory, self.owner, self.id = self.fixture.directory, self.fixture.owner, self.fixture.id
        self.app = installation.Installations(self.fixture.manager)

    def runner(self, command, cwd, env, log, deadline):
        self.assertTrue((self.directory / "install-intent.json").is_file())
        self.assertEqual(command[-2:], ["--job", self.id])
        self.assertTrue(command[1].endswith("usb_install_job.py"))
        self.assertEqual(env["HOME"], "/data/adb")
        self.assertEqual(env["ADB_SERVER_SOCKET"], "tcp:localhost:5037")
        self.assertNotIn("api_encryption_key", json.dumps([command, env]))
        raw = (self.directory / "install-intent.json").read_bytes()
        installation.write_new(self.directory / "install-result.json", json.dumps(
            {"intent_sha256": hashlib.sha256(raw).hexdigest(), "state": "armed_waiting_reboot"}).encode())

    def start(self, runner=None):
        review = self.app.review(self.owner, self.id)
        previous = os.umask(0o077)
        try:
            return self.app.start(self.owner, self.id, review["plan_sha256"], True, self.runner if runner is None else runner)
        finally:
            os.umask(previous)

    def test_exact_review_and_literal_human_action_precede_any_intent(self):
        review = self.app.review(self.owner, self.id)
        self.assertTrue(review["experimental"])
        self.assertFalse(review["installation_ready"])
        self.assertNotIn("api_encryption_key", review)
        for digest, acknowledged in ((review["plan_sha256"], False), ("0" * 64, True)):
            with self.assertRaisesRegex(Exception, "usb_install_review_required"):
                self.app.start(self.owner, self.id, digest, acknowledged, self.runner)
        self.assertFalse((self.directory / "install-intent.json").exists())
        with self.assertRaises(Exception):
            self.app.review("b" * 32, self.id)

    def test_one_consumed_request_returns_only_next_boot_outcome_and_cannot_restart(self):
        result = self.start()
        self.assertEqual(result["state"], "armed_waiting_reboot")
        self.assertTrue(result["autostart_armed"])
        self.assertFalse(result["installed"] or result["installation_ready"] or result["replay_allowed"])
        self.assertEqual(self.app.status(self.owner, self.id), result)
        # Real canonical writers add their receipts here. They do not make a
        # historical target unreadable or authorize another installation.
        installation.write_new(self.directory / "install-plan/stage-receipt.json", b"{}")
        self.assertEqual(self.app.review(self.owner, self.id)["wlan_mac"], "02:00:00:00:00:01")
        with self.assertRaisesRegex(Exception, "usb_install_consumed"):
            self.start()

    def test_lost_controller_result_is_unverified_and_never_means_zero_writes(self):
        result = self.start(lambda *args: (_ for _ in ()).throw(RuntimeError("synthetic lost controller")))
        self.assertEqual(result["state"], "install_unverified")
        self.assertNotIn("device_writes", result)
        self.assertIsNone(result["autostart_armed"])
        restarted = installation.Installations(self.fixture.manager)
        review_sha = installation.private_hash(self.directory / "install-plan/plan.json")["sha256"]
        with self.assertRaisesRegex(Exception, "usb_install_consumed"):
            restarted.start(self.owner, self.id, review_sha, True, self.runner)

    def observation_runner(self, same_boot=False, invalid=False):
        def run(command, cwd, env, log, deadline):
            self.assertEqual(command[-2], "--observe")
            output = self.directory / "observations" / command[-1]
            plan = json.loads((self.directory / "install-plan/plan.json").read_text())
            proof = {"plan_id": plan["plan_id"], "plan_sha256": installation.private_hash(self.directory / "install-plan/plan.json")["sha256"],
                     "installed": False, "activated": False, "installation_ready": False, "device_writes": 0}
            if same_boot:
                proof.update(stage="same_boot_arm_observed", runtime_observed=False, current={
                    "stage": "read_only_armed", "autostart_armed": True, "receipt_update_incomplete": False,
                    "installed": False, "activated": False, "installation_ready": False, "retry_authorized": False})
                if invalid:
                    proof["current"]["stage"] = "device_completion_unverified_no_write_authority"
            else:
                proof.update(stage="post_boot_bridge_observed", runtime_observed=True,
                             api_disconnect="completed", forward_cleanup="removed")
                if invalid:
                    proof["forward_cleanup"] = "cleanup_unverified_preserved"
            installation.write_new(output / "bridge-boot-observation.json", json.dumps(proof).encode())
        return run

    def test_read_observations_resolve_lost_ack_without_repeating_a_writer(self):
        self.start(lambda *args: (_ for _ in ()).throw(RuntimeError("synthetic lost result")))
        previous = os.umask(0o077)
        try:
            same = self.app.observe(self.owner, self.id, self.observation_runner(same_boot=True))
            self.assertEqual(same["state"], "awaiting_reboot")
            self.assertFalse(same["runtime_observed"])
            self.assertEqual(self.app.status(self.owner, self.id)["state"], "armed_waiting_reboot")
            new = self.app.observe(self.owner, self.id, self.observation_runner())
            self.assertEqual(new["state"], "bridge_observed")
            self.assertEqual(new["device_writes"], 0)
            self.assertFalse(new["installed"] or new["installation_ready"])
            self.assertEqual(self.app.status(self.owner, self.id)["state"], "bridge_observed")
        finally:
            os.umask(previous)
        # A historical ambiguous result is preserved; only separate positive
        # read evidence resolves it. No writer output is fabricated/overwritten.
        self.assertFalse((self.directory / "install-result.json").exists())

    def test_incomplete_device_completion_or_forward_cleanup_never_resolves_history(self):
        self.start(lambda *args: (_ for _ in ()).throw(RuntimeError("synthetic lost result")))
        previous = os.umask(0o077)
        try:
            for same in (False, True):
                result = self.app.observe(self.owner, self.id, self.observation_runner(same_boot=same, invalid=True))
                self.assertEqual(result["state"], "boot_unverified")
                self.assertEqual(self.app.status(self.owner, self.id)["state"], "install_unverified")
        finally:
            os.umask(previous)
        self.assertFalse((self.directory / "install-arm-reconciled.json").exists())
        self.assertFalse((self.directory / "install-reconciled.json").exists())

    def test_companion_auth_and_global_usb_lease_precede_reading_the_body(self):
        server = plan_fixtures.builds.preparations.captures.server
        companion = server.Companion(self.fixture.fixture.fixture.capture.usb, self.app.parent)
        companion.installations = self.app
        nonce = companion.page(self.owner)
        read = Mock(return_value={"job_id": self.id, "expected_plan_sha256": "0" * 64, "experimental_reviewed": True})
        with self.assertRaisesRegex(Exception, "usb_unauthorized"):
            companion.install("b" * 32, nonce, read, lambda value: value)
        read.assert_not_called()
        companion.device_lock.acquire()
        try:
            with self.assertRaisesRegex(Exception, "usb_busy"):
                companion.install(self.owner, nonce, read, lambda value: value)
            read.assert_not_called()
        finally:
            companion.device_lock.release()
        # A failed delivery releases the lease, but never starts another call.
        def deliver(value):
            self.assertFalse(companion.device_lock.acquire(blocking=False))
            raise BrokenPipeError("synthetic disconnect")
        with patch.object(self.app, "start", return_value=installation.install_frame(self.id, "install_unverified")) as start:
            with self.assertRaises(BrokenPipeError):
                companion.install(self.owner, nonce, read, deliver)
            self.assertEqual(start.call_count, 1)
        self.assertTrue(companion.device_lock.acquire(blocking=False))
        companion.device_lock.release()


class CompositionTests(unittest.TestCase):
    def sequence(self, **changes):
        result = {"stage": "disabled_sequence_trial_observed", "installed": False, "activated": False,
                  "installation_ready": False, "retry_authorized": False, "local_adb_cleanup": "completed",
                  "forward_cleanup": "removed", **changes}
        return SimpleNamespace(run=AsyncMock(return_value=result))

    def arm(self, **changes):
        return SimpleNamespace(arm=Mock(return_value={"stage": "bridge_autostart_armed_next_boot_unverified",
            "autostart_armed": True, "installed": False, "activated": False, "installation_ready": False, **changes}))

    def call(self, sequence, arm):
        return asyncio.run(job.install_and_arm(sequence, arm, object(), "plan", "1" * 64, "candidate", "profile"))

    def test_arm_occurs_only_after_actual_terminal_trial_and_clean_owned_host_transport(self):
        sequence, arm = self.sequence(), self.arm()
        self.assertEqual(self.call(sequence, arm), "armed_waiting_reboot")
        self.assertEqual(sequence.run.await_count, 1)
        self.assertEqual(arm.arm.call_count, 1)
        for change in ({"stage": "partial"}, {"installed": True}, {"local_adb_cleanup": "cleanup_unverified"},
                       {"forward_cleanup": "ambiguous_forward_preserved"}):
            arm = self.arm()
            with self.assertRaises(Exception):
                self.call(self.sequence(**change), arm)
            arm.arm.assert_not_called()

    def test_unknown_after_effects_result_never_becomes_armed_or_retried(self):
        arm = self.arm(stage="device_completion_unverified_no_write_authority", autostart_armed=None)
        with self.assertRaises(Exception):
            self.call(self.sequence(), arm)
        self.assertEqual(arm.arm.call_count, 1)


if __name__ == "__main__":
    unittest.main()
