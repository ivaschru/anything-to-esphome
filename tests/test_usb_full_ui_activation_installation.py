"""Permanent owner intent/child/USB boundaries with synthetic jobs only."""
import asyncio
import hashlib
import json
import sys
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, Mock, patch
import test_usb_full_ui_installation as fixtures

HERE = Path(__file__).resolve().parents[1] / 'apps/monitor1_usb/rootfs'
with patch.object(sys, 'path', [str(HERE), *sys.path]):
    import full_ui_activation_installation as permanent
    import full_ui_activation_usb as usb


class AuthorityTests(unittest.TestCase):
    def setUp(self):
        prior = self.prior = fixtures.TrialAuthorityTests(methodName='runTest')
        prior.setUp()
        self.addCleanup(prior.doCleanups)
        prior.start()
        self.owner, self.id, self.digest, self.directory = prior.owner, prior.id, prior.digest, prior.directory
        self.manager = permanent.FullUiActivations(prior.fixture.app)

    def proof(self, intent, **changes):
        return {'state': 'full_ui_active_observed', 'trial_job': intent['trial_job'], 'boot_id': intent['boot_id'],
                'native_job': 'e' * 16, 'native_observations': 2, 'store_installed': True, 'boot_enabled': True,
                'start_requested': True, 'start_acknowledged': True, 'installed': False, 'installation_ready': False,
                'replay_allowed': False, 'forward_cleanup': 'removed', **changes}

    def runner(self, command, cwd, env, log, deadline):
        self.assertEqual(command[-3:], ['--job', self.id, '--full-activate'])
        self.assertEqual(cwd, self.directory)
        intent, raw = permanent.checked_intent(cwd, self.owner, self.id)
        self.assertEqual(intent['plan_sha256'], self.digest)
        permanent.write_new(cwd / permanent.RESULT, json.dumps({'intent_sha256': hashlib.sha256(raw).hexdigest(),
            'proof': self.proof(intent)}).encode())

    def start(self, runner=None):
        return self.manager.start(self.owner, self.id, self.digest, True, True, runner or self.runner)

    def test_independent_review_owner_and_trial_bound_consumption(self):
        for digest, review, screen in [('0' * 64, True, True), (self.digest, False, True), (self.digest, True, False)]:
            with self.assertRaisesRegex(Exception, 'usb_full_ui_activation_review_required'):
                self.manager.start(self.owner, self.id, digest, review, screen, self.runner)
        self.assertFalse((self.directory / permanent.INTENT).exists())
        with self.assertRaises(Exception):
            self.manager.start('b' * 32, self.id, self.digest, True, True, self.runner)
        result = self.start()
        self.assertEqual(result['state'], 'full_ui_active_observed')
        self.assertNotIn('trial_job', result)
        self.assertNotIn('boot_id', result)
        self.assertFalse(result['activation_available'] or result['installed'] or result['installation_ready'])
        self.assertEqual(self.manager.status(self.owner, self.id), result)
        with self.assertRaisesRegex(Exception, 'usb_full_ui_activation_consumed'):
            self.start()

    def test_lost_child_is_durable_after_restart_and_blocks_all_other_writers(self):
        result = self.start(lambda *args: (_ for _ in ()).throw(TimeoutError()))
        self.assertEqual(result['state'], 'full_ui_activation_unverified')
        other = permanent.FullUiActivations(self.prior.fixture.app)
        self.assertEqual(other.status(self.owner, self.id), result)
        with self.assertRaisesRegex(Exception, 'usb_full_ui_activation_previous_unverified'):
            other.fence(self.directory, self.owner)
        with self.assertRaisesRegex(Exception, 'usb_full_ui_activation_consumed'):
            other.start(self.owner, self.id, self.digest, True, True, self.runner)

    def test_changed_trial_proof_or_plan_never_becomes_new_authority(self):
        self.start()
        path = self.directory / permanent.trials.RESULT
        original = path.read_bytes()
        path.write_bytes(original + b'\n')
        with self.assertRaises(Exception):
            self.manager.status(self.owner, self.id)
        path.write_bytes(original)
        path = self.directory / permanent.RESULT
        record = json.loads(path.read_text())
        for changes in ({'boot_id': 'foreign'}, {'native_job': record['proof']['trial_job']}, {'native_observations': True},
                        {'boot_enabled': False}, {'installed': True}, {'forward_cleanup': 'ambiguous_forward_preserved'}):
            path.write_text(json.dumps({**record, 'proof': {**record['proof'], **changes}}))
            with self.subTest(changes=changes), self.assertRaises(Exception):
                self.manager.status(self.owner, self.id)

    def test_child_rechecks_profile_before_usb(self):
        from test_usb_install import job
        def child(command, cwd, env, log, deadline):
            canonical = SimpleNamespace(TrialAdb=Mock(), candidate=SimpleNamespace(read_profile=Mock(return_value=(
                {'node_name': 'fixture', 'api_mac': '02:00:00:00:00:01'}, 'wrong'))))
            operation = AsyncMock()
            with patch.dict(sys.modules, {'trial_initial_bridge_adb': canonical}), patch.object(usb, 'run_usb', operation):
                with self.assertRaises(Exception):
                    job.full_activation_job(cwd)
                operation.assert_not_awaited()
        self.assertEqual(self.start(child)['state'], 'full_ui_activation_unverified')
        self.assertFalse((self.directory / permanent.RESULT).exists())

    def test_actual_fixed_child_joins_private_profile_and_saves_bound_result(self):
        from test_usb_install import job
        def child(command, cwd, env, log, deadline):
            plan = permanent.build_report(cwd / "install-plan/plan.json")
            intent, _ = permanent.checked_intent(cwd, self.owner, self.id)
            canonical = SimpleNamespace(TrialAdb=Mock(return_value="synthetic-adb"), candidate=SimpleNamespace(
                read_profile=Mock(return_value=(plan["api_identity"], plan["basis"]["profile_sha256"]))))
            operation = AsyncMock(return_value=self.proof(intent))
            with patch.dict(sys.modules, {"trial_initial_bridge_adb": canonical}), patch.object(usb, "run_usb", operation), \
                    patch.object(job, "adb_executable", return_value="synthetic-adb"):
                job.full_activation_job(cwd)
                operation.assert_awaited_once_with("synthetic-adb", plan, plan["api_identity"], canonical,
                    intent["trial_job"], intent["boot_id"])
        self.assertEqual(self.start(child)["state"], "full_ui_active_observed")

    def test_server_auth_exact_body_and_delivery_lease(self):
        server = self.prior.fixture.fixture.fixture.fixture.capture.usb
        from test_usb_install import plan_fixtures
        cls = plan_fixtures.builds.preparations.captures.server.Companion
        companion = cls(server, self.manager.parent)
        nonce = companion.page(self.owner)
        companion.full_activations = SimpleNamespace(start=Mock(return_value={'synthetic': True}))
        body = {'job_id': self.id, 'expected_plan_sha256': self.digest, 'experimental_reviewed': True, 'screen_reviewed': True}
        def delivered(value):
            self.assertTrue(companion.device_lock.locked())
            self.assertEqual(value, {'synthetic': True})
        companion.install(self.owner, nonce, lambda: body, delivered, permanent=True)
        companion.full_activations.start.assert_called_once_with(self.owner, self.id, self.digest, True, True)
        with self.assertRaises(Exception):
            companion.install(self.owner, 'bad', lambda: self.fail('Unauthorized body read'), delivered, permanent=True)
        with self.assertRaises(Exception):
            companion.install(self.owner, nonce, lambda: {**body, 'duration': 0}, delivered, permanent=True)


class UsbTests(unittest.TestCase):
    def setUp(self):
        fixture = fixtures.TrialUsbTests(methodName='runTest'); fixture.setUp()
        self.fixture = fixture
        self.boot = '22222222-2222-2222-2222-222222222222'
        fixture.canonical.review.preflight.identity.return_value = self.boot
        self.operation = AsyncMock(return_value={'state': 'full_ui_activation_unverified'})

    def run_usb(self):
        f = self.fixture
        return asyncio.run(usb.run_usb(f.adb, f.plan, {}, f.canonical, f.nonce, self.boot, self.operation))

    def test_another_boot_refuses_before_forward_or_api(self):
        self.fixture.canonical.review.preflight.identity.return_value = 'other-boot'
        result = self.run_usb()
        self.assertEqual(result['state'], 'full_ui_activation_unverified')
        self.fixture.canonical.install_forward.assert_not_called()
        self.operation.assert_not_awaited()

    def test_lost_forward_ack_preserves_mapping_without_api(self):
        self.fixture.canonical.install_forward.side_effect = TimeoutError()
        result = self.run_usb()
        self.assertEqual(result['state'], 'full_ui_activation_close_unverified')
        self.operation.assert_not_awaited()
        self.fixture.canonical.remove_forward.assert_not_called()

    def test_api_failure_still_removes_only_owned_forward(self):
        self.operation.side_effect = TimeoutError()
        result = self.run_usb()
        self.assertEqual(result['forward_cleanup'], 'removed')
        self.fixture.canonical.remove_forward.assert_called_once_with(self.fixture.adb, 16053)
        self.assertIsNone(self.fixture.adb.deadline)


if __name__ == '__main__':
    unittest.main()
