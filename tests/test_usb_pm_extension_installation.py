"""PM owner/child authority with private synthetic jobs, never USB."""
import hashlib
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, Mock, patch
import test_usb_full_ui_installation as fixtures

HERE = Path(__file__).resolve().parents[1] / 'apps/monitor1_usb/rootfs'
with patch.object(sys, 'path', [str(HERE), *sys.path]):
    import pm_extension_installation as pm
    import pm_extension_usb as usb
    import usb_install_job as child


class AuthorityTests(unittest.TestCase):
    def setUp(self):
        prior = self.prior = fixtures.TrialAuthorityTests(methodName='runTest');prior.setUp()
        self.addCleanup(prior.doCleanups)
        self.directory, self.owner, self.id, self.digest = prior.directory, prior.owner, prior.id, prior.digest
        self.manager = pm.PmExtensions(prior.fixture.app)

    def proof(self, nonce):
        return {'state': 'pm_extension_armed_waiting_reboot', 'nonce': nonce,
                'boot_id': '22222222-2222-2222-2222-222222222222', 'device_request_sent': True,
                'arming_acknowledged': False, 'completion_observed': True, 'api_disconnect': 'completed',
                'forward_cleanup': 'removed', 'installed': False, 'installation_ready': False, 'replay_allowed': False}

    def runner(self, command, cwd, env, log, deadline):
        self.assertEqual(command[-3:], ['--job', self.id, '--pm-enable'])
        intent, raw = pm.checked_intent(cwd, self.owner, self.id)
        pm.write_new(cwd / pm.RESULT, json.dumps({'intent_sha256': hashlib.sha256(raw).hexdigest(),
            'proof': self.proof(intent['nonce'])}).encode())

    def start(self, runner=None):
        return self.manager.start(self.owner, self.id, self.digest, True, runner or self.runner)

    def test_owner_review_original_plan_and_one_consumed_child(self):
        for digest, reviewed in [('0' * 64, True), (self.digest, False)]:
            with self.assertRaisesRegex(Exception, 'usb_pm_extension_review_required'):
                self.manager.start(self.owner, self.id, digest, reviewed, self.runner)
        self.assertFalse((self.directory / pm.INTENT).exists())
        self.assertTrue(self.manager.status(self.owner, self.id)['pm_available'])
        result = self.start()
        self.assertEqual(result['state'], 'pm_extension_armed_waiting_reboot')
        self.assertTrue(result['next_boot_armed'])
        self.assertNotIn('nonce', result);self.assertNotIn('boot_id', result)
        self.assertFalse(result['installed'] or result['installation_ready'] or result['replay_allowed'])
        with self.assertRaisesRegex(Exception, 'usb_pm_extension_consumed'):self.start()
        self.manager.fence(self.directory, self.owner)

    def test_lost_result_is_preserved_and_blocks_every_other_writer(self):
        result = self.start(lambda *args: (_ for _ in ()).throw(TimeoutError()))
        self.assertEqual(result['state'], 'pm_extension_unverified')
        restarted = pm.PmExtensions(self.prior.fixture.app)
        self.assertEqual(restarted.status(self.owner, self.id), result)
        with self.assertRaisesRegex(Exception, 'usb_pm_extension_previous_unverified'):
            restarted.fence(self.directory, self.owner)
        with self.assertRaisesRegex(Exception, 'usb_pm_extension_consumed'):
            restarted.start(self.owner, self.id, self.digest, True, self.runner)

    def test_an_existing_full_ui_attempt_never_allows_pm_flag_reconfiguration(self):
        pm.write_new(self.directory / 'full-ui-trial-intent.json', b'{"partial":true}')
        self.assertFalse(self.manager.status(self.owner, self.id)['pm_available'])
        with self.assertRaisesRegex(Exception, 'usb_pm_extension_bridge_required'):self.start()
        self.assertFalse((self.directory / pm.INTENT).exists())

    def test_fixed_sdk_child_rejoins_profile_and_saves_exact_bound_proof(self):
        def run(command, cwd, env, log, deadline):
            plan = pm.build_report(cwd / 'install-plan/plan.json')
            intent, _ = pm.checked_intent(cwd, self.owner, self.id)
            observer = SimpleNamespace(trial=SimpleNamespace(TrialAdb=Mock(return_value='synthetic-adb'),
                candidate=SimpleNamespace(read_profile=Mock(return_value=(plan['api_identity'], plan['basis']['profile_sha256'])))))
            operation = AsyncMock(return_value=self.proof(intent['nonce']))
            with patch.dict(sys.modules, {'verify_bridge_boot_adb': observer}), patch.object(usb, 'arm_next_boot', operation), \
                    patch.object(child, 'adb_executable', return_value='synthetic-adb'):
                child.pm_enable_job(cwd)
                operation.assert_awaited_once_with('synthetic-adb', cwd / 'install-plan', self.digest, cwd / 'profile.json', observer, intent['nonce'])
        self.assertEqual(self.start(run)['state'], 'pm_extension_armed_waiting_reboot')


if __name__ == '__main__':unittest.main()
