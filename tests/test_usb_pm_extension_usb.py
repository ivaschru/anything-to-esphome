"""One next-boot flag request against synthetic transports, never a device."""
import asyncio
from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, Mock, patch
from types import SimpleNamespace
import test_usb_pm_extension_guard as fixtures

with patch.object(sys, 'path', [str(fixtures.ROOT / 'apps/monitor1_usb/rootfs'), *sys.path]):
    import pm_extension_usb as adapter


class AdapterTests(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.PmGuardTests(methodName='runTest');self.fixture.setUp()
        self.fixture.plan['target'].update(usb_serial='synthetic', usb_transport='usb:fixture')
        self.canonical = fixtures.observer
        f = self.fixture
        self.observation = {'stage': 'post_boot_bridge_observed', 'runtime_observed': True,
            'plan_id': f.plan['plan_id'], 'plan_sha256': f.digest, 'scope': f.frame,
            'api_disconnect': 'completed', 'forward_cleanup': 'removed', 'installed': False,
            'activated': False, 'installation_ready': False, 'device_writes': 0}
        self.adb = SimpleNamespace(serial='synthetic', usb=Mock(return_value='usb:fixture'), read=Mock(), deadline=None)

    def run_adapter(self, frame=None):
        f = self.fixture
        with patch.object(self.canonical, 'basis', return_value=(Path('/synthetic'), f.plan, f.baseline, {'nonce': 'a' * 32}, {})), \
             patch.object(self.canonical, 'verify', new=AsyncMock(return_value=self.observation)), \
             patch.object(self.canonical, 'scope', return_value=f.frame if frame is None else frame):
            return asyncio.run(adapter.arm_next_boot(self.adb, Path('/synthetic'), f.digest, Path('/synthetic/profile.json'),
                self.canonical, f.nonce))

    def test_lost_write_ack_only_reads_completion_and_never_sends_writer_twice(self):
        self.adb.read.side_effect = [TimeoutError('synthetic lost write ACK'), '']
        result = self.run_adapter()
        self.assertEqual(result['state'], 'pm_extension_armed_waiting_reboot')
        self.assertFalse(result['arming_acknowledged'])
        self.assertTrue(result['completion_observed'])
        self.assertEqual(self.adb.read.call_count, 2)
        first, second = [call.args[0] for call in self.adb.read.call_args_list]
        self.assertIn('\nrm ' + fixtures.policy.BASE + '/' + fixtures.policy.FLAG + '\n', first)
        self.assertNotIn('\nrm ', second);self.assertNotIn('\nmkdir ', second)
        self.assertIsNone(self.adb.deadline)
        adapter.checked_proof(result, self.fixture.nonce, self.fixture.frame['boot_id'])

    def test_unknown_completion_stays_unknown_without_retry_or_reboot(self):
        self.adb.read.side_effect = TimeoutError('synthetic lost request and read')
        result = self.run_adapter()
        self.assertEqual(result['state'], 'pm_extension_unverified')
        self.assertTrue(result['device_request_sent'])
        self.assertFalse(result['completion_observed'])
        self.assertEqual(self.adb.read.call_count, 2)
        self.assertIsNone(self.adb.deadline)

    def test_cleanup_failure_or_changed_process_scope_refuses_before_flag_write(self):
        for change in ('cleanup', 'scope'):
            with self.subTest(change=change):
                if change == 'cleanup':self.observation['api_disconnect'] = 'unverified'
                else:self.observation['api_disconnect'] = 'completed'
                result = self.run_adapter(frame={**self.fixture.frame, 'child': (201, 2001)} if change == 'scope' else None)
                self.assertEqual(result['state'], 'pm_extension_unverified')
                self.assertFalse(result['device_request_sent'])
                self.adb.read.assert_not_called()


if __name__ == '__main__':unittest.main()
