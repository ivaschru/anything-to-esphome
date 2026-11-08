"""Actual host intent/fsync/flock; synthetic live scope/wire, no device IO."""
import copy
import fcntl
import importlib
import os
import sys
import unittest
from unittest.mock import patch

import test_usb_browser_boot_context as fixtures

with patch.object(sys, 'path', [str(fixtures.observer.ROOT), *sys.path]):
    pm = importlib.import_module('browser_pm_boot_journal')


class PmJournalTests(unittest.TestCase):
    def setUp(self):
        self.j = fixtures.ObserverContextTests(methodName='runTest'); self.j.setUp(); self.addCleanup(self.j.doCleanups)
        self.j.complete(); self.context = self.j.read()
        self.stages, self.directory = self.j.stages, self.j.directory
        self.owner, self.job, self.sha = self.j.owner, self.j.job, self.j.sha
        self.manager = pm.BrowserPmBoot(self.stages)
        c = self.context; self.target = {**c['arming']['context']['meta']['target'], 'boot_id': '99999999-9999-4999-8999-999999999999'}
        scope = {'kind': 'browser_bridge_boot_runtime_scope', 'job_id': self.job, 'plan_sha256': self.sha,
            'arming_intent_sha256': c['arming']['intent_sha256'], 'arming_proof_sha256': c['arming_proof_sha256'],
            'target': self.target, 'root_identity': c['arming']['preparation']['preparation']['scope']['root_identity'],
            'processes': {'child': [301, 300, '1901'], 'supervisor': [300, 1, '1900'], 'stock': [150, 151, '1100'], 'watchdog': [151, 1, '1110']},
            'pm_disabled': True, 'recovery_backup': True, 'bridge_disabled': False, 'canonical_scope_checked': True,
            'memory_free_bytes': 64 * 1024**2, 'memory_total_bytes': 128 * 1024**2, 'context_only': True, 'device_writes': 0}
        self.selected = {'channel_id': '9' * 32, 'channel_nonce': '99999999-9999-4999-8999-999999999998',
            'observation': {'scope': scope, 'wire': {'samples': 2, 'last_sample_age_at_prepare_s': .5,
                'identity': c['api_identity'], 'api_closed': True, 'final_scope_checked': True}}}

    def prepare(self, selected=None, reviewed=True):
        return self.manager.prepare(self.owner, self.job, self.sha, selected or self.selected, reviewed)

    def proof(self, p):
        return {'schema_version': 1, **{k: p[k] for k in ('job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'nonce', 'intent_sha256')},
            'commands_acknowledged': ['arm', 'complete'], 'target': self.target, 'after_effects_read_acknowledged': True,
            'current_boot_preserved': True, 'transport_closed': True, 'channel_closed': True, 'pm_next_boot_armed': True}

    def test_consumed_packet_keeps_kernel_lock_until_after_read_and_both_closes(self):
        p = self.prepare(); self.assertEqual(p['context'], self.context)
        self.assertTrue((self.directory / pm.INTENT).is_file()); self.assertIsNotNone(self.stages.lease_fd)
        self.assertEqual(set(p['native_pair']), {'native-program', 'guardian-program'})
        fd = os.open(self.directory.parent.parent / 'native-install.lock', os.O_RDWR | os.O_NOFOLLOW)
        try:
            with self.assertRaises(BlockingIOError): fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        finally: os.close(fd)
        self.assertEqual(self.manager.status(self.owner, self.job)['state'], 'browser_pm_boot_unverified')
        with self.assertRaises(Exception): self.prepare()
        result = self.manager.record(self.owner, self.job, p['intent_sha256'], self.proof(p))
        self.assertEqual(result['state'], 'browser_pm_next_boot_armed_waiting_reboot')
        self.assertTrue(result['pm_next_boot_armed']); self.assertIsNone(self.stages.lease_fd)
        self.assertFalse(result['installed'] or result['activated'] or result['installation_ready'] or result['replay_allowed'])
        self.stages.fence_all()

    def test_review_current_boot_scope_and_fresh_wire_are_required_before_consumption(self):
        with self.assertRaises(Exception): self.prepare(reviewed=False)
        edits = [lambda v: v['observation']['wire'].update(samples=True),
                 lambda v: v['observation']['wire'].update(last_sample_age_at_prepare_s=21),
                 lambda v: v['observation']['wire'].update(api_closed=1),
                 lambda v: v['observation']['scope'].update(pm_disabled=1),
                 lambda v: v['observation']['scope']['processes']['child'].__setitem__(1, 1),
                 lambda v: v['observation']['scope']['target'].update(boot_id=self.context['arming']['context']['meta']['target']['boot_id']),
                 lambda v: v.update(channel_id=self.context['arming']['channel_id'])]
        for edit in edits:
            value = copy.deepcopy(self.selected); edit(value)
            with self.subTest(index=edits.index(edit)), self.assertRaises(Exception): self.prepare(value)
            self.assertFalse((self.directory / pm.INTENT).exists()); self.assertIsNone(self.stages.lease_fd)

    def test_lost_packet_or_actor_exit_is_fenced_without_restart_adoption(self):
        with patch.object(pm.BrowserPmBoot, '_packet', side_effect=RuntimeError('synthetic lost packet')):
            with self.assertRaises(RuntimeError): self.prepare()
        self.assertIsNotNone(self.stages.lease_fd); self.stages.close()
        with self.assertRaisesRegex(Exception, 'usb_browser_stage_previous_unverified'): self.stages.fence_all()
        fresh = type(self.stages)(self.stages.plans); other = pm.BrowserPmBoot(fresh)
        self.assertEqual(other.status(self.owner, self.job)['state'], 'browser_pm_boot_unverified')
        with self.assertRaises(Exception): other.prepare(self.owner, self.job, self.sha, self.selected, True)
        self.assertIsNone(fresh.lease_fd)

    def test_bad_after_read_target_or_lost_close_cannot_record_or_release(self):
        p = self.prepare()
        for edit in (lambda v: v.update(after_effects_read_acknowledged=1), lambda v: v.update(channel_closed=False),
                     lambda v: v.update(transport_closed=False), lambda v: v.update(current_boot_preserved=False),
                     lambda v: v.update(commands_acknowledged=['arm']),
                     lambda v: v['target'].update(boot_id='00000000-0000-4000-8000-000000000001')):
            proof = copy.deepcopy(self.proof(p)); edit(proof)
            with self.assertRaises(Exception): self.manager.record(self.owner, self.job, p['intent_sha256'], proof)
            self.assertIsNotNone(self.stages.lease_fd); self.assertFalse((self.directory / pm.COMPLETE).exists())

    def test_orphan_completion_is_not_empty_history(self):
        pm.write_new(self.directory / pm.COMPLETE, b'{}')
        with self.assertRaises(Exception): self.manager.status(self.owner, self.job)
        with self.assertRaisesRegex(Exception, 'usb_browser_stage_previous_unverified'): self.stages.fence_all()
