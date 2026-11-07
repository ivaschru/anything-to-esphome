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
