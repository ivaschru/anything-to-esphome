"""Private desktop export and exact engine composition; synthetic only."""
import asyncio
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tarfile
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, Mock, patch
import test_usb_plan as plans

ROOT = Path(__file__).resolve().parents[1]
HERE = ROOT / "apps/monitor1_usb/rootfs"
with patch.object(sys, "path", [str(HERE), *sys.path]):
    import computer_package as package
    import computer_install as desktop
    import full_ui_usb
    import full_ui_trial_usb
    import full_ui_activation_usb
    import pm_extension_usb


class ComputerExportTests(unittest.TestCase):
    def setUp(self):
        self.fixture = plans.PlanTests(methodName="runTest")
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.root = self.fixture.directory
        self.source = self.fixture.source
        report_path = self.root / "candidate/result.json"
        report = json.loads(report_path.read_text())
        # Build fixtures are explicitly synthetic, not ARM programs. Export
        # preserves their producer hashes; desktop preparation still requires
        # the original actual ELF/helper audit before any device operation.
        specs = {name: package.private_hash(self.root / "candidate" / name) for name in
                 ("bridge-program", "native-program", "guardian-program", "initial-trial-guardian-program")}
        report["artifacts"] = {name: specs[name] for name in specs if name != "initial-trial-guardian-program"}
        report["initial_trial_guardian"] = specs["initial-trial-guardian-program"]
        report["profile_sha256"] = package.private_hash(self.root / "profile.json")["sha256"]
        helper = self.source / "build/pm-helper/pm_qt_bridge.so"
        helper.parent.mkdir(parents=True, mode=0o700)
        helper.parent.parent.chmod(0o700)
        plans.worker.write_new(helper, b"synthetic helper; not a shared library")
        report["pm_helper"] = {"sha256": hashlib.sha256(helper.read_bytes()).hexdigest(), "bytes": helper.stat().st_size, "needed": []}
        report_path.write_text(json.dumps(report))

    def export(self, owner=None):
        return package.package_export(self.fixture.fixture.manager, owner or self.fixture.owner, self.fixture.id)

    def test_private_fixed_export_loads_without_sdk_cache_or_historical_native_plan(self):
        archive = self.export()
        self.assertLess(len(archive), package.MAX_PACKAGE)
        with tempfile.TemporaryDirectory() as temporary, tarfile.open(fileobj=io.BytesIO(archive)) as tar:
            names = tar.getnames()
            self.assertIn(package.PREFIX + "/README.txt", names)
            self.assertIn(package.PREFIX + "/full_ui_trial.py", names)
            self.assertIn(package.PREFIX + "/full_ui_trial_usb.py", names)
            self.assertFalse(any(".venv" in name or "install-plan" in name or "computer-state" in name for name in names))
            self.assertTrue(all(member.mode == (0o700 if member.isdir() else 0o600) for member in tar))
            previous = os.umask(0o077)
            try:
                tar.extractall(temporary, filter="data")
            finally:
                os.umask(previous)
            root, source, manifest = desktop.load_bundle(Path(temporary).resolve() / package.PREFIX)
            self.assertEqual(source, root / "candidate/ports/monitor1")
            self.assertEqual(manifest["profile_sha256"], package.private_hash(self.root / "profile.json")["sha256"])
            self.assertFalse(manifest["installed"] or manifest["installation_ready"])
            self.assertEqual(manifest["device_writes"], 0)
            (root / "profile.json").write_bytes(b"changed")
            with self.assertRaises(ValueError):
                desktop.load_bundle(root)

    def test_other_owner_consumed_install_or_source_drift_cannot_export(self):
        with self.assertRaises(Exception):
            self.export("b" * 32)
        plans.worker.write_new(self.root / "install-intent.json", b"{}")
        with self.assertRaisesRegex(Exception, "usb_computer_after_install"):
            self.export()
        # Separate fixture: no deleting a real consumed record to retry.
        other = ComputerExportTests(methodName="runTest")
        other.setUp()
        self.addCleanup(other.doCleanups)
        (other.source / "prepare_install.py").write_bytes(b"drift")
        with self.assertRaises(Exception):
            other.export()

    def test_export_endpoint_keeps_ingress_owner_nonce_and_lease(self):
        server = plans.builds.preparations.captures.server
        companion = server.Companion(job_root=self.root.parent)
        nonce = companion.page(self.fixture.owner)
        with patch.object(server, "package_export", return_value=b"synthetic export") as export:
            def deliver(body):
                self.assertEqual(body, b"synthetic export")
                self.assertTrue(companion.device_lock.locked())
            companion.export(self.fixture.owner, nonce, lambda: {"job_id": self.fixture.id}, deliver, computer=True)
            export.assert_called_once()
        with patch.object(server, "package_export") as export:
            with self.assertRaises(Exception):
                companion.export(self.fixture.owner, "invalid", lambda: self.fail("unauthorized body read"), lambda _: None, computer=True)
            export.assert_not_called()


class ComputerEngineTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.root.chmod(0o700)
        self.state = self.root / "computer-state"
        self.state.mkdir(mode=0o700)
        self.digest, self.profile_sha = "a" * 64, "b" * 64
        desktop.write_new(self.state / "prepared.json", {"plan_sha256": self.digest, "profile_sha256": self.profile_sha})
        planner = SimpleNamespace(candidate=SimpleNamespace(read_profile=lambda _: ({}, self.profile_sha)))
        self.sequence = SimpleNamespace(run=AsyncMock(return_value={"stage": "disabled_sequence_trial_observed",
            "installed": False, "activated": False, "installation_ready": False, "retry_authorized": False,
            "local_adb_cleanup": "completed", "forward_cleanup": "removed"}))
        self.arm = SimpleNamespace(arm=Mock(return_value={"stage": "bridge_autostart_armed_next_boot_unverified",
            "autostart_armed": True, "installed": False, "activated": False, "installation_ready": False}))
        self.modules = (None, None, planner, self.sequence, self.arm, None)

    def test_exact_review_once_and_no_replay_even_with_a_new_process(self):
        with self.assertRaises(ValueError):
            asyncio.run(desktop.install(self.root, self.modules, None, self.digest, False))
        with self.assertRaises(ValueError):
            asyncio.run(desktop.install(self.root, self.modules, None, "c" * 64, True))
        self.assertFalse((self.state / "install-intent.json").exists())
        result = asyncio.run(desktop.install(self.root, self.modules, None, self.digest, True))
        self.assertEqual(result["state"], "armed_waiting_reboot")
        self.sequence.run.assert_awaited_once()
        self.arm.arm.assert_called_once()
        with self.assertRaises(FileExistsError):
            asyncio.run(desktop.install(self.root, self.modules, None, self.digest, True))
        self.sequence.run.assert_awaited_once()

    def test_unknown_trial_cleanup_never_arms_or_claims_no_write(self):
        self.sequence.run.return_value["forward_cleanup"] = "cleanup_unverified_preserved"
        with self.assertRaises(ValueError):
            asyncio.run(desktop.install(self.root, self.modules, None, self.digest, True))
        self.arm.arm.assert_not_called()
        result = json.loads((self.state / "install-result.json").read_text())
        self.assertEqual(result["state"], "install_unverified")
        self.assertNotIn("device_writes", result)

    def test_prepare_uses_fresh_native_capture_not_exported_browser_identity(self):
        with tempfile.TemporaryDirectory() as other:
            root = Path(other);root.chmod(0o700)
            capture = Mock()
            bootstrap = SimpleNamespace(prepare=Mock())
            planner = SimpleNamespace(candidate=SimpleNamespace(read_profile=lambda _: ({"wlan_mac": "02:00:00:00:00:01",
                "co2_type": 3, "friendly_name": "Synthetic"}, self.profile_sha)), candidate_files=Mock(),
                prepare=Mock(return_value=({"requested_data_free_bytes": 32*1024**2}, self.digest)))
            modules = (SimpleNamespace(capture=capture), bootstrap, planner, None, None, None)
            result = desktop.prepare(root, modules, "fixture native ADB object")
            capture.assert_called_once_with("fixture native ADB object", "02:00:00:00:00:01", 3, root / "computer-state/capture")
            self.assertEqual(result["device_writes"], 0)
            self.assertFalse(result["installed"])
            with self.assertRaises(FileExistsError):
                desktop.prepare(root, modules, "fixture native ADB object")
            capture.assert_called_once()

    def test_full_review_requires_original_intent_and_profile_before_usb(self):
        # This test exercises the downloaded CLI's authority join, not a
        # monitor: neither the API inspector nor any install engine may run
        # until the original consumed intent and private profile agree.
        plan = {"basis": {"profile_sha256": self.profile_sha}}
        staging = SimpleNamespace(load_plan=Mock(return_value=(None, plan)))
        canonical = SimpleNamespace(review=SimpleNamespace(staging=staging),
            candidate=SimpleNamespace(read_profile=Mock(return_value=({}, self.profile_sha))))
        self.sequence.trial = canonical
        result = {"state": "pm_extension_required", "read_only": True,
            "device_writes": 0, "launch_authorized": False,
            "installation_ready": False, "installed": False,
            "live_recheck_required": True, "forward_cleanup": "removed"}
        with patch.object(full_ui_usb, "inspect", new=AsyncMock(return_value=result)) as reader:
            with self.assertRaises(FileNotFoundError):
                asyncio.run(desktop.full_review(self.root, self.modules, None))
            reader.assert_not_awaited()
            desktop.write_new(self.state / "install-intent.json",
                {"plan_sha256": self.digest, "experimental_reviewed": True})
            canonical.candidate.read_profile.return_value = ({}, "c" * 64)
            with self.assertRaises(ValueError):
                asyncio.run(desktop.full_review(self.root, self.modules, None))
            reader.assert_not_awaited()
            canonical.candidate.read_profile.return_value = ({}, self.profile_sha)
            observed = asyncio.run(desktop.full_review(self.root, self.modules, None))
            self.assertEqual(observed, result)
            self.assertEqual(reader.await_args.args, (None, plan, {}, canonical))
            self.assertTrue(callable(reader.await_args.kwargs["initial_pm_reader"]))
            saved = list((self.state / "observations").glob("*/full-ui-review.json"))
            self.assertEqual(len(saved), 1)
            self.assertEqual(json.loads(saved[0].read_text()), {**result, "plan_sha256": self.digest})
        self.sequence.run.assert_not_awaited()
        self.arm.arm.assert_not_called()

    def test_full_trial_uses_shared_usb_engine_once_and_offline_status_never_replays(self):
        source = next(iter(desktop.TRIAL_SOURCE_COMMITS))
        plan = {"basis": {"profile_sha256": self.profile_sha, "source_commit": source},
                "files": {k: {"size": 1, "sha256": "c" * 64} for k in ("native-program", "guardian-program")}}
        plan_root = self.state / "install-plan"; plan_root.mkdir(mode=0o700)
        desktop.write_new(plan_root / "plan.json", plan)
        digest = hashlib.sha256((plan_root / "plan.json").read_bytes()).hexdigest()
        (self.state / "prepared.json").write_text(json.dumps({"plan_sha256": digest, "profile_sha256": self.profile_sha}))
        desktop.write_new(self.state / "install-intent.json", {"plan_sha256": digest, "experimental_reviewed": True})
        canonical = SimpleNamespace(review=SimpleNamespace(staging=SimpleNamespace(load_plan=Mock(return_value=(None, plan)))),
            candidate=SimpleNamespace(read_profile=Mock(return_value=({}, self.profile_sha))))
        self.sequence.trial = canonical
        manifest = {"source_commit": source, "profile_sha256": self.profile_sha,
                    "files": {k: {} for k in ("full_ui_trial.py", "full_ui_trial_usb.py", "full_ui_review.py")}}
        async def operate(adb, actual_plan, profile, actual_canonical, nonce, images):
            self.assertTrue((self.state / "full-ui-trial-intent.json").exists())
            self.assertIs(actual_plan, plan)
            self.assertIs(actual_canonical, canonical)
            self.assertEqual(images, {k: b"x" for k in plan["files"]})
            return {"state": "full_ui_trial_returned_observed", "native_observations": 2, "stock_return_observed": True,
                    "launch_acknowledged": False, "job": nonce, "hard_runtime_ms": 60000, "installed": False,
                    "installation_ready": False, "boot_enabled": False, "replay_allowed": False, "forward_cleanup": "removed",
                    "boot_id": "22222222-2222-2222-2222-222222222222"}
        with patch.object(desktop, "observe", new=AsyncMock(return_value={"state": "bridge_observed"})) as read, \
                patch.object(full_ui_trial_usb, "image_bytes", return_value=b"x"), \
                patch.object(full_ui_trial_usb, "run_usb", new=AsyncMock(side_effect=operate)) as writer:
            with self.assertRaises(ValueError):
                asyncio.run(desktop.full_trial(self.root, self.modules, None, manifest, digest, False))
            read.assert_not_awaited(); writer.assert_not_awaited()
            result = asyncio.run(desktop.full_trial(self.root, self.modules, None, manifest, digest, True))
            self.assertEqual(result["state"], "full_ui_trial_returned_observed")
            self.assertTrue(result["local_receipt_only"])
            self.assertFalse(result["installed"] or result["boot_enabled"])
            with self.assertRaises(ValueError):
                asyncio.run(desktop.full_trial(self.root, self.modules, None, manifest, digest, True))
            writer.assert_awaited_once(); read.assert_awaited_once()
            self.assertEqual(desktop.full_trial_status(self.root, manifest), result)

    def recorded_full_trial(self):
        source = next(iter(desktop.TRIAL_SOURCE_COMMITS))
        profile = {"node_name": "fixture", "api_mac": "02:00:00:00:00:01"}
        plan = {"basis": {"profile_sha256": self.profile_sha, "source_commit": source},
                "api_identity": profile, "target": {"boot_id": "11111111-1111-1111-1111-111111111111"}}
        plan_root = self.state / "install-plan"; plan_root.mkdir(mode=0o700)
        desktop.write_new(plan_root / "plan.json", plan)
        digest = hashlib.sha256((plan_root / "plan.json").read_bytes()).hexdigest()
        (self.state / "prepared.json").write_text(json.dumps({"plan_sha256": digest, "profile_sha256": self.profile_sha}))
        desktop.write_new(self.state / "install-intent.json", {"plan_sha256": digest, "experimental_reviewed": True})
        intent = {"plan_sha256": digest, "source_commit": source, "nonce": "a" * 16, "experimental_reviewed": True,
                  "install_intent_sha256": hashlib.sha256((self.state / "install-intent.json").read_bytes()).hexdigest()}
        desktop.write_new(self.state / "full-ui-trial-intent.json", intent)
        proof = {"state": "full_ui_trial_returned_observed", "native_observations": 2, "stock_return_observed": True,
                 "launch_acknowledged": True, "job": intent["nonce"], "hard_runtime_ms": 60000, "installed": False,
                 "installation_ready": False, "boot_enabled": False, "replay_allowed": False, "forward_cleanup": "removed",
                 "boot_id": "22222222-2222-2222-2222-222222222222"}
        desktop.write_new(self.state / "full-ui-trial-result.json", {"intent_sha256": hashlib.sha256(
            (self.state / "full-ui-trial-intent.json").read_bytes()).hexdigest(), "proof": proof})
        canonical = SimpleNamespace(review=SimpleNamespace(staging=SimpleNamespace(load_plan=Mock(return_value=(None, plan)))),
            candidate=SimpleNamespace(read_profile=Mock(return_value=(profile, self.profile_sha))))
        self.sequence.trial = canonical
        manifest = {"source_commit": source, "profile_sha256": self.profile_sha, "files": {k: {} for k in (
            "full_ui_trial.py", "full_ui_trial_usb.py", "full_ui_review.py", "full_ui_activation.py", "full_ui_activation_usb.py")}}
        return digest, manifest, canonical

    def test_permanent_computer_uses_same_engine_once_and_local_history_without_usb(self):
        digest, manifest, canonical = self.recorded_full_trial()
        async def operate(adb, plan, profile, actual, trial_job, boot):
            self.assertIs(actual, canonical)
            self.assertTrue((self.state / "full-ui-activation-intent.json").exists())
            return {"state": "full_ui_active_observed", "trial_job": trial_job, "boot_id": boot, "native_job": "e" * 16,
                    "native_observations": 2, "store_installed": True, "boot_enabled": True, "start_requested": True,
                    "start_acknowledged": False, "installed": False, "installation_ready": False,
                    "replay_allowed": False, "forward_cleanup": "removed"}
        with patch.object(full_ui_activation_usb, "run_usb", new=AsyncMock(side_effect=operate)) as writer:
            with self.assertRaises(ValueError):
                asyncio.run(desktop.full_activate(self.root, self.modules, None, manifest, digest, True, False))
            writer.assert_not_awaited()
            result = asyncio.run(desktop.full_activate(self.root, self.modules, None, manifest, digest, True, True))
            self.assertEqual(result["state"], "full_ui_active_observed")
            self.assertTrue(result["boot_enabled"] and result["store_installed"] and result["local_receipt_only"])
            self.assertNotIn("trial_job", result); self.assertNotIn("boot_id", result)
            self.assertEqual(desktop.full_activation_status(self.root, manifest), result)
            with self.assertRaises(ValueError):
                asyncio.run(desktop.full_activate(self.root, self.modules, None, manifest, digest, True, True))
            writer.assert_awaited_once()
        with patch.object(sys, "argv", ["computer_install.py", "full-activation-status"]), \
                patch.object(desktop, "load_bundle", return_value=(self.root, None, manifest)), \
                patch.object(desktop, "engines") as engine, patch.object(desktop.shutil, "which") as adb, \
                patch("builtins.print"):
            desktop.main()
            engine.assert_not_called(); adb.assert_not_called()

    def recorded_pm_basis(self):
        source = next(iter(desktop.TRIAL_SOURCE_COMMITS))
        profile = {"node_name": "fixture", "api_mac": "02:00:00:00:00:01"}
        plan = {"basis": {"profile_sha256": self.profile_sha, "source_commit": source}, "api_identity": profile,
                "target": {"boot_id": "11111111-1111-1111-1111-111111111111", "wlan_mac": "02:00:00:00:00:01", "co2_type": 3}}
        plan_root = self.state / "install-plan";plan_root.mkdir(mode=0o700)
        desktop.write_new(plan_root / "plan.json", plan)
        digest = hashlib.sha256((plan_root / "plan.json").read_bytes()).hexdigest()
        (self.state / "prepared.json").write_text(json.dumps({"plan_sha256": digest, "profile_sha256": self.profile_sha}))
        desktop.write_new(self.state / "install-intent.json", {"plan_sha256": digest, "experimental_reviewed": True})
        canonical = SimpleNamespace(candidate=SimpleNamespace(read_profile=Mock(return_value=(profile, self.profile_sha))),
            review=SimpleNamespace(preflight=SimpleNamespace(identity=Mock(return_value="33333333-3333-3333-3333-333333333333"))))
        self.sequence.trial = canonical
        manifest = {"source_commit": source, "profile_sha256": self.profile_sha,
                    "files": {key: {} for key in ("pm_extension_guard.py", "pm_extension_usb.py")}}
        return plan, digest, canonical, manifest

    def test_computer_pm_is_consumed_once_and_status_never_imports_engines(self):
        plan, digest, canonical, manifest = self.recorded_pm_basis()
        async def operate(adb, directory, actual, profile_path, observer, nonce):
            self.assertTrue((self.state / "pm-extension-intent.json").exists())
            return {"state": "pm_extension_armed_waiting_reboot", "nonce": nonce,
                "boot_id": "22222222-2222-2222-2222-222222222222", "device_request_sent": True,
                "arming_acknowledged": False, "completion_observed": True, "api_disconnect": "completed", "forward_cleanup": "removed",
                "installed": False, "installation_ready": False, "replay_allowed": False}
        with patch.object(pm_extension_usb, "arm_next_boot", new=AsyncMock(side_effect=operate)) as writer:
            with self.assertRaises(ValueError):asyncio.run(desktop.pm_enable(self.root, self.modules, None, manifest, digest, False))
            writer.assert_not_awaited()
            result = asyncio.run(desktop.pm_enable(self.root, self.modules, None, manifest, digest, True))
            self.assertEqual(result["state"], "pm_extension_armed_waiting_reboot")
            self.assertTrue(result["local_receipt_only"] and result["next_boot_armed"])
            self.assertNotIn("nonce", result);self.assertNotIn("boot_id", result)
            with self.assertRaises(ValueError):asyncio.run(desktop.pm_enable(self.root, self.modules, None, manifest, digest, True))
            writer.assert_awaited_once()
        with patch.object(sys, "argv", ["computer_install.py", "pm-status"]), \
                patch.object(desktop, "load_bundle", return_value=(self.root, None, manifest)), \
                patch.object(desktop, "engines") as engine, patch.object(desktop.shutil, "which") as adb, patch("builtins.print"):
            desktop.main();engine.assert_not_called();adb.assert_not_called()
        # After PM enable, the old bridge-only observer's disabled flag is
        # intentionally absent. Require a NEW boot and Full UI preflight,
        # rather than weakening that original observer or fabricating proof.
        with patch.object(desktop, "observe", new=AsyncMock()) as old, \
                patch.object(desktop, "full_review", new=AsyncMock(return_value={"state": "full_ui_preflight_observed"})) as review:
            canonical.review.preflight.identity.return_value = "22222222-2222-2222-2222-222222222222"
            with self.assertRaises(ValueError):asyncio.run(desktop.trial_admission(self.root, self.modules, None, manifest, canonical, plan))
            review.assert_not_awaited();old.assert_not_awaited()
            canonical.review.preflight.identity.return_value = "33333333-3333-3333-3333-333333333333"
            asyncio.run(desktop.trial_admission(self.root, self.modules, None, manifest, canonical, plan))
            review.assert_awaited_once();old.assert_not_awaited()

    def test_full_trial_waits_for_actual_bridge_boot_before_consuming_intent(self):
        source = next(iter(desktop.TRIAL_SOURCE_COMMITS))
        plan = {"basis": {"profile_sha256": self.profile_sha, "source_commit": source}}
        canonical = SimpleNamespace(review=SimpleNamespace(staging=SimpleNamespace(load_plan=Mock(return_value=(None, plan)))),
            candidate=SimpleNamespace(read_profile=Mock(return_value=({}, self.profile_sha))))
        self.sequence.trial = canonical
        manifest = {"source_commit": source, "profile_sha256": self.profile_sha,
                    "files": {k: {} for k in ("full_ui_trial.py", "full_ui_trial_usb.py", "full_ui_review.py")}}
        desktop.write_new(self.state / "install-intent.json", {"plan_sha256": self.digest, "experimental_reviewed": True})
        with patch.object(desktop, "observe", new=AsyncMock(return_value={"state": "awaiting_reboot"})), \
                patch.object(full_ui_trial_usb, "run_usb", new=AsyncMock()) as writer:
            with self.assertRaises(ValueError):
                asyncio.run(desktop.full_trial(self.root, self.modules, None, manifest, self.digest, True))
            writer.assert_not_awaited()
        self.assertFalse((self.state / "full-ui-trial-intent.json").exists())

    def test_observer_uses_same_boot_after_effects_or_new_boot_proof_without_writer(self):
        plan_root = self.state / "install-plan"
        plan_root.mkdir(mode=0o700)
        desktop.write_new(plan_root / "plan.json", {"plan_id": "c" * 32})
        digest = hashlib.sha256((plan_root / "plan.json").read_bytes()).hexdigest()
        # Rewrite only this isolated synthetic fixture's unconsumed metadata.
        # Real command code never updates prepared.json or removes an intent.
        (self.state / "prepared.json").write_text(json.dumps({"plan_sha256": digest, "profile_sha256": self.profile_sha}))
        desktop.write_new(self.state / "install-intent.json", {"plan_sha256": digest, "experimental_reviewed": True})
        self.sequence.status = Mock(return_value={"stage": "read_only_armed", "autostart_armed": True,
            "receipt_update_incomplete": False, "installed": False, "activated": False,
            "installation_ready": False, "retry_authorized": False})
        observer = SimpleNamespace(verify=AsyncMock(return_value={"stage": "post_boot_bridge_observed",
            "runtime_observed": True, "plan_id": "c" * 32, "plan_sha256": digest, "api_disconnect": "completed",
            "forward_cleanup": "removed", "installed": False, "activated": False, "installation_ready": False, "device_writes": 0}))
        modules = (*self.modules[:5], observer)
        same = asyncio.run(desktop.observe(self.root, modules, None))
        self.assertEqual(same["state"], "awaiting_reboot")
        observer.verify.assert_not_awaited()
        self.sequence.status.side_effect = ValueError("different boot; synthetic")
        new = asyncio.run(desktop.observe(self.root, modules, None))
        self.assertEqual(new["state"], "bridge_observed")
        observer.verify.assert_awaited_once()
        self.sequence.run.assert_not_awaited()
        self.arm.arm.assert_not_called()
        observer.verify.return_value["forward_cleanup"] = "cleanup_unverified_preserved"
        with self.assertRaises(ValueError):
            asyncio.run(desktop.observe(self.root, modules, None))


if __name__ == "__main__":
    unittest.main()
