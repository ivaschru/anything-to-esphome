"""Real host journal/lease, synthetic terminal trial; no API or monitor writes."""
import copy
import importlib
import sys
import unittest
from unittest.mock import patch

import test_usb_browser_full_ui_trial as fixtures

with patch.object(sys, 'path', [str(fixtures.trial.ROOT), *sys.path]):
    activation = importlib.import_module('browser_full_ui_activation')


class BrowserActivationTests(unittest.TestCase):
    def setUp(self):
        self.f = fixtures.FullUiTrialJournalTests(methodName='runTest'); self.f.setUp(); self.addCleanup(self.f.doCleanups)
        p = self.f.prepare(); self.f.manager.record(self.f.owner, self.f.job, p['intent_sha256'], self.f.proof(p))
        self.stages, self.directory = self.f.stages, self.f.directory
        self.owner, self.job, self.sha = self.f.owner, self.f.job, self.f.sha
        self.manager = activation.BrowserFullUiActivations(self.stages)

    def prepare(self, c, screen=True, startup=True):
        return self.manager.prepare(self.owner, self.job, self.sha, c['trial_proof_sha256'],
            {'channel_id': '7' * 32, 'channel_nonce': '77777777-7777-4777-8777-777777777777', 'observation': self.f.scope}, screen, startup)

    def proof(self, packet):
        c = packet['context']
        return {'schema_version': 1, **{k: packet[k] for k in ('job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'intent_sha256')},
            'result': {'state': 'full_ui_active_observed', 'trial_job': c['trial_job'], 'boot_id': c['boot_id'],
                'native_job': 'f' * 16 if c['trial_job'] != 'f' * 16 else 'e' * 16, 'native_observations': 2,
                'store_installed': True, 'boot_enabled': True, 'start_requested': True, 'start_acknowledged': True,
                'installed': False, 'installation_ready': False, 'replay_allowed': False},
            'final_scope': packet['scope'], 'api_closed': True, 'transport_closed': True, 'channel_closed': True}

    def test_exact_trial_two_human_decisions_consumed_once_and_closed_terminal(self):
        c = activation.context(self.stages, self.owner, self.job, self.sha)
        self.assertEqual(c['trial_job'], self.f.manager._intent(self.owner, self.job)[1]['trial_job'])
        self.assertIsNone(self.stages.lease_fd)
        for screen, startup in ((False, True), (True, False), (1, True), (True, 1)):
            with self.assertRaises(Exception): self.prepare(c, screen, startup)
            self.assertFalse((self.directory / activation.INTENT).exists())
        p = self.prepare(c); self.assertEqual(p['context'], c); self.assertIsNotNone(self.stages.lease_fd)
        with self.assertRaises(Exception): self.prepare(c)
        valid = self.proof(p)
        # Every schema/semantic fault uses the actual pure verifier, without
        # repeating the expensive source/journal chain for each scalar field.
        for edit in (lambda v: v.update(channel_closed=False), lambda v: v.update(api_closed=1),
                     lambda v: v['result'].update(native_job=c['trial_job']), lambda v: v['result'].update(native_observations=True),
                     lambda v: v['result'].update(store_installed=False), lambda v: v['result'].update(start_requested=False),
                     lambda v: v['result'].update(installed=True)):
            proof = copy.deepcopy(valid); edit(proof)
            with self.assertRaises(Exception): self.manager.proof(p, p['intent_sha256'], proof)
        result = self.manager.record(self.owner, self.job, p['intent_sha256'], valid)
        self.assertEqual(result['state'], 'browser_full_ui_active_observed'); self.assertIsNone(self.stages.lease_fd)
        self.assertFalse(result['installed'] or result['installation_ready'] or result['replay_allowed']); self.stages.fence_all()

    def test_lost_packet_or_restart_never_adopts_consumed_permanent_attempt(self):
        c = activation.context(self.stages, self.owner, self.job, self.sha)
        # Simulate response loss AFTER the real actor has durably prepared.
        p = self.prepare(c); self.assertTrue((self.directory / activation.INTENT).is_file())
        self.stages.close()
        with self.assertRaises(Exception): self.stages.fence_all()
        fresh = activation.BrowserFullUiActivations(type(self.stages)(self.stages.plans))
        self.assertEqual(fresh.status(self.owner, self.job)['state'], 'browser_full_ui_activation_unverified')
        with self.assertRaises(Exception): fresh.record(self.owner, self.job, p['intent_sha256'], self.proof(p))
        self.assertIsNone(fresh.stages.lease_fd); self.assertFalse((self.directory / activation.COMPLETE).exists())
