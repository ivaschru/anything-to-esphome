"""Durable Full UI trial authority with private synthetic jobs, never USB."""
import asyncio
import hashlib
import json
import os
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, Mock, patch
import test_usb_install as fixtures

HERE = Path(__file__).resolve().parents[1] / "apps/monitor1_usb/rootfs"
with patch.object(sys, "path", [str(HERE), *sys.path]):
    import full_ui_installation as trials
    import full_ui_trial_usb as usb


class TrialAuthorityTests(unittest.TestCase):
    def setUp(self):
        fixture = self.fixture = fixtures.InstallTests(methodName="runTest")
        fixture.setUp()
        self.addCleanup(fixture.doCleanups)
        directory = self.directory = fixture.directory
        plan_path = directory / "install-plan/plan.json"
        plan = json.loads(plan_path.read_text())
        for kind in ("native-program", "guardian-program"):
            body = ("synthetic " + kind).encode()
            fixtures.installation.write_new(directory / "install-plan" / kind, body)
            plan["files"][kind] = {"size": len(body), "sha256": hashlib.sha256(body).hexdigest()}
        plan_path.write_text(json.dumps(plan))
        done = json.loads((directory / "plan-complete.json").read_text())
        done["plan_sha256"] = trials.private_hash(plan_path)["sha256"]
        (directory / "plan-complete.json").write_text(json.dumps(done))
        self.owner, self.id = fixture.owner, fixture.id
        self.manager = trials.FullUiTrials(fixture.app)
        # Substitute only the capability's reviewed-source admission for this
        # synthetic old source; production retains its exact immutable list.
        self.source = plan["basis"]["source_commit"]
        self.addCleanup(patch.stopall)
        patch.object(trials, "TRIAL_SOURCE_COMMITS", frozenset((self.source,))).start()
        self.digest = done["plan_sha256"]
        previous = os.umask(0o077)
        self.addCleanup(os.umask, previous)
        fixture.start()
        fixture.app.observe(self.owner, self.id, fixture.observation_runner())

    def proof(self, nonce, **changes):
        return {"state": "full_ui_trial_returned_observed", "native_observations": 2, "stock_return_observed": True,
                "launch_acknowledged": True, "job": nonce, "hard_runtime_ms": 60000, "installed": False,
                "installation_ready": False, "boot_enabled": False, "replay_allowed": False,
                "forward_cleanup": "removed", "boot_id": "22222222-2222-2222-2222-222222222222", **changes}

    def runner(self, command, cwd, env, log, deadline):
        self.assertEqual(command[-3:], ["--job", self.id, "--full-trial"])
        self.assertEqual(cwd, self.directory)
        self.assertNotIn("api_encryption_key", str(command) + str(env))
        intent, raw = trials.checked_intent(self.directory, self.owner, self.id)
        self.assertEqual(intent["plan_sha256"], self.digest)
        trials.write_new(self.directory / trials.RESULT, json.dumps({"intent_sha256": hashlib.sha256(raw).hexdigest(),
            "proof": self.proof(intent["nonce"])}).encode())

    def start(self, runner=None):
        return self.manager.start(self.owner, self.id, self.digest, True, runner or self.runner)

    def test_owner_exact_review_and_durable_consumption_precede_fixed_child(self):
        for digest, reviewed in (("0" * 64, True), (self.digest, False)):
            with self.assertRaisesRegex(Exception, "usb_full_ui_trial_review_required"):
                self.manager.start(self.owner, self.id, digest, reviewed, self.runner)
        self.assertFalse((self.directory / trials.INTENT).exists())
        with self.assertRaises(Exception):
            self.manager.start("b" * 32, self.id, self.digest, True, self.runner)
        result = self.start()
        self.assertEqual(result["state"], "full_ui_trial_returned_observed")
        self.assertFalse(result["installed"] or result["boot_enabled"] or result["installation_ready"])
        self.assertNotIn("nonce", result)
        self.assertEqual(self.manager.status(self.owner, self.id), result)
        with self.assertRaisesRegex(Exception, "usb_full_ui_trial_consumed"):
            self.start()

    def test_obsolete_source_refuses_before_intent_or_spawning(self):
        with patch.object(trials, "TRIAL_SOURCE_COMMITS", frozenset()), patch.object(trials, "run_owned") as spawn:
            self.assertFalse(self.manager.status(self.owner, self.id)["trial_available"])
            with self.assertRaisesRegex(Exception, "usb_full_ui_trial_rebuild_required"):
                self.start(spawn)
            spawn.assert_not_called()
        self.assertFalse((self.directory / trials.INTENT).exists())

    def test_lost_child_result_remains_consumed_after_restart(self):
        result = self.start(lambda *args: (_ for _ in ()).throw(TimeoutError("synthetic lost child result")))
        self.assertEqual(result["state"], "full_ui_trial_unverified")
        self.assertIsNone(result["stock_return_observed"])
        restarted = trials.FullUiTrials(self.fixture.app)
        self.assertEqual(restarted.status(self.owner, self.id), result)
        with self.assertRaisesRegex(Exception, "usb_full_ui_trial_consumed"):
            restarted.start(self.owner, self.id, self.digest, True, self.runner)
        self.assertTrue((self.directory / trials.INTENT).exists())

    def test_partial_forward_and_forged_positive_proof_are_never_success(self):
        self.start()
        path = self.directory / trials.RESULT
        original = json.loads(path.read_text())
        for changes in ({"stock_return_observed": False}, {"native_observations": True},
                        {"native_observations": 1}, {"hard_runtime_ms": 0}, {"job": "f" * 16},
                        {"forward_cleanup": "ambiguous_forward_preserved"}, {"boot_enabled": True}, {"boot_id": None},
                        {"boot_id": "invalid"}):
            path.write_text(json.dumps({**original, "proof": {**original["proof"], **changes}}))
            with self.subTest(changes=changes), self.assertRaises(Exception):
                self.manager.status(self.owner, self.id)

    def test_exact_child_rechecks_plan_bytes_before_entering_usb_coordinator(self):
        def child(command, cwd, env, log, deadline):
            canonical = SimpleNamespace(TrialAdb=Mock(return_value="synthetic-adb"), candidate=SimpleNamespace(read_profile=Mock(
                return_value=({"node_name": "fixture", "api_mac": "02:00:00:00:00:01"}, "bad-profile-sha"))))
            operation = AsyncMock()
            with patch.dict(sys.modules, {"trial_initial_bridge_adb": canonical}), patch.object(usb, "run_usb", operation), \
                    patch.object(fixtures.job, "adb_executable", return_value="synthetic-adb"):
                with self.assertRaises(Exception):
                    fixtures.job.full_trial_job(cwd)
                operation.assert_not_awaited()
        result = self.start(child)
        self.assertEqual(result["state"], "full_ui_trial_unverified")
        self.assertFalse((self.directory / trials.RESULT).exists())

    def test_new_server_route_retains_owner_body_and_usb_delivery_lease(self):
        server = fixtures.plan_fixtures.builds.preparations.captures.server
        companion = server.Companion(self.fixture.fixture.fixture.fixture.capture.usb, self.manager.parent)
        nonce = companion.page(self.owner)
        companion.full_trials = SimpleNamespace(start=Mock(return_value={"synthetic": True}))
        data = {"job_id": self.id, "expected_plan_sha256": self.digest, "experimental_reviewed": True}
        def deliver(value):
            self.assertTrue(companion.device_lock.locked())
            self.assertEqual(value, {"synthetic": True})
        companion.install(self.owner, nonce, lambda: data, deliver, full=True)
        with self.assertRaises(Exception):
            companion.install(self.owner, "invalid", lambda: self.fail("Unauthorized body read"), deliver, full=True)
        companion.full_trials.start.assert_called_once_with(self.owner, self.id, self.digest, True)


class TrialUsbTests(unittest.TestCase):
    def setUp(self):
        self.nonce = "a" * 16
        self.plan = {"target": {"usb_serial": "fixture", "usb_transport": "usb:fixture", "boot_id": "old",
            "wlan_mac": "02:00:00:00:00:01", "co2_type": 3}, "files": {kind: {"size": 100, "sha256": "c" * 64}
            for kind in ("native-program", "guardian-program", "bridge-program")}}
        self.adb = SimpleNamespace(serial="fixture", usb=Mock(return_value="usb:fixture"), deadline=None)
        self.canonical = SimpleNamespace(BASE="/data/.esphome-cgs1", reserve_port=Mock(return_value=16053),
            install_forward=Mock(), remove_forward=Mock(return_value="removed"), review=SimpleNamespace(
                preflight=SimpleNamespace(identity=Mock(return_value="new")), staging=SimpleNamespace(verify_remote_file=Mock())))
        self.operation = AsyncMock(return_value={"state": "full_ui_trial_unverified"})

    def run_usb(self):
        return asyncio.run(usb.run_usb(self.adb, self.plan, {}, self.canonical, self.nonce, {}, self.operation))

    def test_lost_forward_ack_is_preserved_without_entering_trial(self):
        self.canonical.install_forward.side_effect = TimeoutError()
        result = self.run_usb()
        self.assertEqual(result["state"], "full_ui_trial_close_unverified")
        self.canonical.remove_forward.assert_not_called()
        self.operation.assert_not_awaited()

    def test_api_failure_does_not_skip_acknowledged_forward_cleanup(self):
        self.operation.side_effect = usb.FullUiTrialError("usb_full_ui_trial_close_unverified")
        result = self.run_usb()
        self.assertEqual(result["state"], "full_ui_trial_close_unverified")
        self.canonical.remove_forward.assert_called_once_with(self.adb, 16053)
        self.assertIsNone(self.adb.deadline)


if __name__ == "__main__":
    unittest.main()
