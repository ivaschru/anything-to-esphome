"""Private one-use staging journal/packet with synthetic payloads, no device."""
import base64
import hashlib
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import test_usb_browser_plan as plans

with patch.object(sys, 'path', [str(plans.HERE), *sys.path]):
    import browser_stage as stage


class StageTests(unittest.TestCase):
    def setUp(self):
        self.fixture = plans.BrowserPlanTests(methodName='runTest')
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.plan = self.fixture.prepare()
        self.directory, self.owner, self.id = self.fixture.directory, self.fixture.owner, self.fixture.id
        self.manager = stage.BrowserStages(self.fixture.manager)
        self.raw_plan = json.loads((self.directory / 'browser-plan/plan.json').read_bytes())
        self.scope = {'channel_id': 'e' * 32, 'channel_nonce': '22222222-2222-2222-2222-222222222222',
            'target': self.raw_plan['target'], 'filesystem': {'magic': 'ef53', 'available_blocks': 10000, 'block_bytes': 4096}}
        self.before = (self.directory / 'profile.json').read_bytes()

    def prepare(self, scope=None, reviewed=True):
        return self.manager.prepare(self.owner, self.id, self.plan['plan_sha256'], self.scope if scope is None else scope, reviewed)

    def proof(self, packet):
        descriptor = packet['descriptor']
        marker = (descriptor['plan_id'] + ' ' + descriptor['plan_sha256'] + ' ' + descriptor['intent_sha256'] + '\n').encode()
        return {'plan_id': descriptor['plan_id'], 'plan_sha256': descriptor['plan_sha256'], 'intent_sha256': descriptor['intent_sha256'],
                'channel_id': self.scope['channel_id'], 'channel_nonce': self.scope['channel_nonce'], 'target': self.scope['target'],
                'files': descriptor['files'], 'stock_files': json.loads((self.directory / 'capture/result.json').read_bytes())['files'],
                'root_mode_uid': '700 0', 'stage_metadata_mode_uid': '700 0', 'optouts_empty_regular': True, 'transport_closed': True,
                'vendor_files_changed': False, 'program_started': False, 'after_effects_sha256': hashlib.sha256(marker).hexdigest()}

    def test_intent_is_consumed_before_private_fixed_packet_delivery(self):
        read = stage.private_bytes
        def checked_read(path, pin):
            self.assertTrue((self.directory / stage.INTENT).is_file())
            self.assertFalse((self.directory / stage.COMPLETE).exists())
            return read(path, pin)
        with patch.object(stage, 'private_bytes', side_effect=checked_read):
            packet = json.loads(self.prepare())
        self.assertEqual(set(packet['payloads']), set(stage.ROLES))
        self.assertEqual(packet['target']['kind'], 'browser_webusb')
        self.assertNotIn('usb_transport', packet['target'])
        for role, encoded in packet['payloads'].items():
            self.assertEqual(base64.b64decode(encoded), (self.directory / 'browser-plan' / role).read_bytes())
            self.assertEqual(packet['descriptor']['files'][role], self.raw_plan['files'][role])
        result = self.manager.status(self.owner, self.id)
        self.assertEqual(result['state'], 'browser_stage_unverified')
        self.assertIsNone(result['device_write_attempted'], 'An issued packet cannot assert zero device writes')
        self.assertNotIn('channel_nonce', result)
        self.assertFalse(result['replay_allowed'] or result['installed'] or result['installation_ready'])
        with self.assertRaisesRegex(Exception, 'usb_browser_stage_consumed'):
            self.prepare()
        self.assertEqual((self.directory / 'profile.json').read_bytes(), self.before)

    def test_bad_scope_review_owner_digest_and_capacity_refuse_before_consumption(self):
        cases = [None, {**self.scope, 'target': {**self.scope['target'], 'boot_id': '33333333-3333-3333-3333-333333333333'}},
                 {**self.scope, 'channel_id': 'bad'}, {**self.scope, 'command': 'arbitrary'},
                 {**self.scope, 'filesystem': {'magic': 'tmpfs', 'available_blocks': 10000, 'block_bytes': 4096}},
                 {**self.scope, 'filesystem': {'magic': 'ef53', 'available_blocks': 1, 'block_bytes': 4096}},
                 {**self.scope, 'filesystem': {'magic': 'ef53', 'available_blocks': True, 'block_bytes': 4096}}]
        for scope in cases:
            with self.subTest(scope=scope), self.assertRaises(Exception):
                if scope is None:
                    self.prepare(reviewed=False)
                else:
                    self.prepare(scope)
            self.assertFalse((self.directory / stage.INTENT).exists())
        for owner, digest in (('b' * 32, self.plan['plan_sha256']), (self.owner, 'f' * 64)):
            with self.assertRaises(Exception):
                self.manager.prepare(owner, self.id, digest, self.scope, True)
        self.assertFalse((self.directory / stage.INTENT).exists())

    def test_packet_failure_stays_unknown_after_restart_without_another_payload(self):
        with patch.object(stage, 'private_bytes', side_effect=RuntimeError('synthetic private read failure')):
            with self.assertRaises(RuntimeError):
                self.prepare()
        restarted = stage.BrowserStages(self.fixture.manager)
        self.assertEqual(restarted.status(self.owner, self.id)['state'], 'browser_stage_unverified')
        with self.assertRaisesRegex(Exception, 'usb_browser_stage_consumed'):
            restarted.prepare(self.owner, self.id, self.plan['plan_sha256'], self.scope, True)
        self.assertTrue((self.directory / 'browser-plan/bridge-program').is_file())
        self.assertEqual((self.directory / 'profile.json').read_bytes(), self.before)

    def test_terminal_record_needs_all_exact_readback_after_effects_and_close_fields(self):
        packet = json.loads(self.prepare())
        proof = self.proof(packet)
        for change in ({'transport_closed': False}, {'transport_closed': 1}, {'program_started': True},
                       {'vendor_files_changed': True}, {'root_mode_uid': '755 0'}, {'after_effects_sha256': 'f' * 64},
                       {'channel_id': 'f' * 32}, {'files': {}}, {'stock_files': {}}):
            with self.subTest(change=change), self.assertRaises(Exception):
                self.manager.record(self.owner, self.id, packet['descriptor']['intent_sha256'], {**proof, **change})
            self.assertFalse((self.directory / stage.COMPLETE).exists())
        result = self.manager.record(self.owner, self.id, packet['descriptor']['intent_sha256'], proof)
        self.assertEqual(result['state'], 'staged_disabled_verified')
        self.assertTrue(result['device_write_attempted'])
        self.assertFalse(result['installed'] or result['installation_ready'] or result['replay_allowed'])
        before = (self.directory / stage.COMPLETE).read_bytes()
        self.assertEqual(self.manager.record(self.owner, self.id, packet['descriptor']['intent_sha256'], proof), result)
        self.assertEqual((self.directory / stage.COMPLETE).read_bytes(), before)
        with self.assertRaisesRegex(Exception, 'usb_browser_stage_consumed'):
            self.prepare()

    def test_mutated_private_plan_or_unknown_prior_writer_is_not_new_authority(self):
        marker = self.directory / 'install-intent.json'
        stage.write_new(marker, b'{}')
        with self.assertRaises(Exception):
            self.prepare()
        marker.unlink()  # Only this test's synthetic marker.
        (self.directory / 'browser-plan/bridge-program').write_bytes(b'changed')
        with self.assertRaises(Exception):
            self.prepare()
        self.assertFalse((self.directory / stage.INTENT).exists())

    def test_private_host_space_floor_precedes_consumption(self):
        with patch.object(stage.shutil, 'disk_usage', return_value=SimpleNamespace(free=stage.STOP_FREE - 1)):
            with self.assertRaisesRegex(Exception, 'usb_install_host_space'):
                self.prepare()
        self.assertFalse((self.directory / stage.INTENT).exists())


if __name__ == '__main__':
    unittest.main()
