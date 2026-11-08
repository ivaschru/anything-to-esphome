"""Actual consumed arming journal/fsync/flock, with synthetic device proof."""
import copy
import fcntl
import importlib
import json
import os
import sys
import unittest
from unittest.mock import Mock, patch

import test_usb_browser_bridge_boot_context as fixtures

with patch.object(sys, 'path', [str(fixtures.boot.ROOT), *sys.path]):
    journal = importlib.import_module('browser_bridge_boot_journal')


class BootJournalTests(unittest.TestCase):
    def setUp(self):
        self.f = fixtures.BootContextTests(methodName='runTest'); self.f.setUp(); self.addCleanup(self.f.doCleanups)
        self.f.stopped()
        self.owner, self.job, self.sha = self.f.owner, self.f.job, self.f.sha
        self.directory, self.stages = self.f.directory, self.f.stages
        self.manager = journal.BrowserBridgeBoot(self.stages)
        self.basis = self.f.read()
        self.preparation = {'kind': 'browser_bridge_boot_preparation', 'preparation': self.f.f.preparation,
                            'trial_marker': self.basis['trial_marker'], 'trial_marker_checked': True, 'context_only': True}
        self.scope = {'channel_id': '3' * 32, 'channel_nonce': '33333333-3333-3333-3333-333333333333',
                      'observation': self.preparation}

    def prepare(self, scope=None, reviewed=True):
        return self.manager.prepare(self.owner, self.job, self.sha, scope or self.scope, reviewed)

    def proof(self, packet):
        armed = copy.deepcopy(packet['preparation']['preparation']['scope'])
        armed.pop('disabled_flags'); armed['kind'] = 'browser_bridge_armed_scope'
        armed['boot_flags'] = {'bridge_disabled': False, 'recovery_backup': True, 'pm_disabled': True}
        armed['arm_marker'] = journal.completion_pin(packet['context']['meta'], packet['nonce'])
        return {'schema_version': 1, **{k: packet[k] for k in ('job_id', 'plan_sha256', 'intent_sha256', 'channel_id', 'channel_nonce', 'nonce')},
                'commands_acknowledged': ['before', 'arm', 'armed', 'complete'], 'armed_scope': armed,
                'transport_closed': True, 'channel_closed': True, 'program_started': False, 'autostart_armed': True, 'pm_disabled': True}

    def test_one_packet_is_consumed_and_fsynced_before_delivery_and_lock_release_needs_exact_terminal_proof(self):
        packet = self.prepare()
        self.assertEqual(packet['context'], self.basis)
        self.assertTrue((self.directory / journal.INTENT).is_file())
        self.assertIsNotNone(self.stages.lease_fd)
        fd = os.open(self.directory.parent.parent / 'native-install.lock', os.O_RDWR | os.O_NOFOLLOW)
        try:
            with self.assertRaises(BlockingIOError): fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        finally: os.close(fd)
        with self.assertRaises(Exception): self.prepare()
        self.assertEqual(self.manager.status(self.owner, self.job)['state'], 'browser_bridge_boot_unverified')
        done = self.manager.record(self.owner, self.job, packet['intent_sha256'], self.proof(packet))
        self.assertEqual(done['state'], 'bridge_autostart_armed_next_boot_unverified')
        self.assertTrue(done['autostart_armed'])
        self.assertFalse(done['installed'] or done['activated'] or done['installation_ready'] or done['replay_allowed'])
        self.assertIsNone(self.stages.lease_fd)
        with self.assertRaises(Exception): self.manager.record(self.owner, self.job, packet['intent_sha256'], self.proof(packet))
        self.stages.fence_all()  # Only the exact terminal host record removes uncertainty.

    def test_lost_packet_and_actor_restart_preserve_uncertainty_without_lease_adoption(self):
        with patch.object(journal.BrowserBridgeBoot, '_packet', side_effect=RuntimeError('synthetic lost packet')):
            with self.assertRaises(RuntimeError): self.prepare()
        self.assertIsNotNone(self.stages.lease_fd)
        self.stages.close()
        with self.assertRaisesRegex(Exception, 'usb_browser_stage_previous_unverified'): self.stages.fence_all()
        fresh = type(self.stages)(self.stages.plans)
        other = journal.BrowserBridgeBoot(fresh)
        self.assertEqual(other.status(self.owner, self.job)['state'], 'browser_bridge_boot_unverified')
        with self.assertRaises(Exception): other.prepare(self.owner, self.job, self.sha, self.scope, True)
        self.assertIsNone(fresh.lease_fd)

    def test_bad_review_marker_scope_or_reused_trial_channel_refuses_without_consumption(self):
        with self.assertRaises(Exception): self.prepare(reviewed=False)
        old = fixtures.fixtures.journal.BrowserInitialTrials(self.stages)._intent(self.owner, self.job)
        for key in ('channel_id', 'channel_nonce'):
            scope = {**self.scope, key: old[key]}
            with self.subTest(key=key), self.assertRaises(Exception): self.prepare(scope)
        for change in (lambda s: s['observation'].update(trial_marker_checked=1),
                       lambda s: s['observation']['preparation']['scope'].update(root_identity=[1, 999])):
            scope = copy.deepcopy(self.scope); change(scope)
            with self.assertRaises(Exception): self.prepare(scope)
        self.assertFalse((self.directory / journal.INTENT).exists())
        self.assertIsNone(self.stages.lease_fd)

    def test_false_close_wrong_flags_changed_root_or_forged_completion_never_release_lease(self):
        packet = self.prepare()
        edits = [lambda p: p.update(transport_closed=1), lambda p: p.update(channel_closed=False),
                 lambda p: p.update(program_started=True), lambda p: p.update(autostart_armed=1),
                 lambda p: p.update(commands_acknowledged=['arm']),
                 lambda p: p['armed_scope']['boot_flags'].update(bridge_disabled=True),
                 lambda p: p['armed_scope']['boot_flags'].update(pm_disabled=1),
                 lambda p: p['armed_scope']['arm_marker'].update(sha256='0' * 64),
                 lambda p: p['armed_scope']['root_identity'].__setitem__(1, 999),
                 lambda p: p['armed_scope']['root_identity'].__setitem__(0, 1.0)]
        for edit in edits:
            proof = self.proof(packet); edit(proof)
            with self.subTest(index=edits.index(edit)), self.assertRaises(Exception):
                self.manager.record(self.owner, self.job, packet['intent_sha256'], proof)
            self.assertIsNotNone(self.stages.lease_fd)
            self.assertFalse((self.directory / journal.COMPLETE).exists())

    def test_orphan_or_changed_producer_is_never_empty_or_successful_history(self):
        fixtures.fixtures.fixtures.commits.fixtures.stage.write_new(self.directory / journal.COMPLETE, b'{}')
        with self.assertRaises(Exception): self.manager.status(self.owner, self.job)
        with self.assertRaisesRegex(Exception, 'usb_browser_stage_previous_unverified'): self.stages.fence_all()

    def test_actor_routes_are_private_and_do_not_initialize_native_usb(self):
        core = fixtures.fixtures.fixtures.commits.fixtures.plans.core_actor
        app = core.Companion(usb=object(), job_root=self.directory.parent); app.browser_stages = self.stages
        nonce = app.page(self.owner); usb = Mock(); actor = core.Actor(app, usb_ready=usb)
        request = {'user': self.owner, 'nonce': nonce, 'operation': 'internal-browser-bridge-boot-prepare',
                   'data': {'job_id': self.job, 'expected_plan_sha256': self.sha, 'scope': self.scope, 'experimental_reviewed': True}}
        packet, mime = actor.dispatch(request)
        self.assertEqual(mime, 'application/json'); self.assertNotIn('guardian_body', packet)
        request.update(operation='internal-browser-bridge-boot-status', data={'job_id': self.job})
        result, _ = actor.dispatch(request); self.assertIsNone(result['autostart_armed'])
        usb.assert_not_called()
