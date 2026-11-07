"""Actual USB/API orchestration with explicit fake readers, no hardware."""
import asyncio
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, Mock, patch
import test_usb_install as fixtures

HERE = Path(__file__).resolve().parents[1] / "apps/monitor1_usb/rootfs"
with patch.object(sys, "path", [str(HERE), *sys.path]):
    import full_ui_usb as usb


class FullUiUsbTests(unittest.TestCase):
    def setUp(self):
        self.old_boot, self.boot = "1" * 36, "2" * 36
        self.plan = {"target": {"usb_serial": "fixture", "usb_transport": "usb:fixture", "boot_id": self.old_boot,
                      "wlan_mac": "02:00:00:00:00:01", "co2_type": 3},
                     "files": {name: {"size": 100, "sha256": "a" * 64} for name in ("bridge-program", "native-program", "guardian-program")}}
        self.adb = SimpleNamespace(serial="fixture", usb=Mock(return_value="usb:fixture"), deadline=None)
        self.identity = Mock(return_value=self.boot)
        self.canonical = SimpleNamespace(BASE="/data/.esphome-cgs1", reserve_port=Mock(return_value=16053),
            install_forward=Mock(), remove_forward=Mock(return_value="removed"), review=SimpleNamespace(
                preflight=SimpleNamespace(identity=self.identity), staging=SimpleNamespace(verify_remote_file=Mock())))
        self.reader = AsyncMock(return_value={"state": "pm_extension_required", "read_only": True,
            "device_writes": 0, "launch_authorized": False, "installation_ready": False, "installed": False,
            "live_recheck_required": True})

    def test_read_uses_fresh_identity_and_retires_only_acknowledged_forward(self):
        result = asyncio.run(usb.inspect(self.adb, self.plan, {}, self.canonical, self.reader))
        self.assertEqual(result["state"], "pm_extension_required")
        self.assertFalse(result["launch_authorized"] or result["installation_ready"])
        self.canonical.install_forward.assert_called_once_with(self.adb, 16053)
        self.canonical.remove_forward.assert_called_once_with(self.adb, 16053)
        self.assertEqual(self.identity.call_count, 2)
        self.assertIsNone(self.adb.deadline)

    def test_lost_forward_ack_preserves_mapping_and_never_calls_api_reader(self):
        self.canonical.install_forward.side_effect = RuntimeError("synthetic lost ack")
        result = asyncio.run(usb.inspect(self.adb, self.plan, {}, self.canonical, self.reader))
        self.assertEqual(result["state"], "full_ui_close_unverified")
        self.canonical.remove_forward.assert_not_called()
        self.reader.assert_not_awaited()

    def test_changed_boot_or_api_close_failure_keeps_forward_cleanup_independent(self):
        self.identity.side_effect = [self.boot, "3" * 36]
        result = asyncio.run(usb.inspect(self.adb, self.plan, {}, self.canonical, self.reader))
        self.assertEqual(result["state"], "full_ui_unverified")
        self.canonical.remove_forward.assert_called_once()
        self.identity.side_effect = None
        self.reader.side_effect = usb.FullUiReviewError("usb_full_ui_close_unverified")
        result = asyncio.run(usb.inspect(self.adb, self.plan, {}, self.canonical, self.reader))
        self.assertEqual(result["state"], "full_ui_close_unverified")
        self.assertEqual(self.canonical.remove_forward.call_count, 2)

    def test_initial_wrapper_candidate_needs_positive_scope_after_forward_cleanup(self):
        self.reader.return_value["state"] = "pm_extension_scope_required"
        async def initial(boot):
            self.assertEqual(boot, self.boot)
            self.canonical.remove_forward.assert_called_once_with(self.adb, 16053)
            return "pm_extension_required"
        result = asyncio.run(usb.inspect(self.adb, self.plan, {}, self.canonical, self.reader, initial_pm_reader=initial))
        self.assertEqual(result["state"], "pm_extension_required")
        self.reader.return_value["state"] = "pm_extension_scope_required"
        result = asyncio.run(usb.inspect(self.adb, self.plan, {}, self.canonical, self.reader))
        self.assertEqual(result["state"], "full_ui_unverified")
        self.reader.return_value["state"] = "pm_extension_scope_required"
        self.canonical.remove_forward.side_effect = TimeoutError()
        further = AsyncMock(return_value="pm_extension_required")
        result = asyncio.run(usb.inspect(self.adb, self.plan, {}, self.canonical, self.reader, initial_pm_reader=further))
        self.assertEqual(result["state"], "full_ui_close_unverified")
        further.assert_not_awaited()


class FullUiManagerTests(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.InstallTests(methodName="runTest")
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.fixture.start()
        previous = fixtures.os.umask(0o077)
        try:
            self.fixture.app.observe(self.fixture.owner, self.fixture.id, self.fixture.observation_runner())
        finally:
            fixtures.os.umask(previous)

    def test_fixed_child_and_proof_do_not_enable_or_launch_full_ui(self):
        def runner(command, cwd, env, log, deadline):
            self.assertEqual(command[-2], "--full-review")
            self.assertNotIn("api_encryption_key", str(command) + str(env))
            proof = {"state": "pm_extension_required", "read_only": True, "device_writes": 0,
                     "launch_authorized": False, "installation_ready": False, "installed": False,
                     "live_recheck_required": True, "forward_cleanup": "removed",
                     "plan_sha256": fixtures.installation.private_hash(self.fixture.directory / "install-plan/plan.json")["sha256"]}
            fixtures.installation.write_new(self.fixture.directory / "observations" / command[-1] / "full-ui-review.json",
                fixtures.json.dumps(proof).encode())
        previous = fixtures.os.umask(0o077)
        try:
            result = self.fixture.app.full_review(self.fixture.owner, self.fixture.id, runner)
        finally:
            fixtures.os.umask(previous)
        self.assertEqual(result["state"], "pm_extension_required")
        self.assertFalse(result["launch_authorized"] or result["installation_ready"])
        with self.assertRaises(Exception):
            self.fixture.app.full_review("b" * 32, self.fixture.id, runner)

    def test_owner_nonce_and_usb_lease_apply_before_body_and_through_delivery(self):
        server = fixtures.plan_fixtures.builds.preparations.captures.server
        companion = server.Companion(self.fixture.fixture.fixture.fixture.capture.usb, self.fixture.app.parent)
        nonce = companion.page(self.fixture.owner)
        companion.installations = SimpleNamespace(full_review=Mock(return_value={"synthetic": True}))
        def deliver(result):
            self.assertTrue(companion.device_lock.locked())
            self.assertEqual(result, {"synthetic": True})
        companion.observe(self.fixture.owner, nonce, lambda: {"job_id": self.fixture.id}, deliver, full=True)
        with self.assertRaises(Exception):
            companion.observe(self.fixture.owner, "invalid", lambda: self.fail("unauthorized body read"), deliver, full=True)


if __name__ == "__main__":
    unittest.main()
