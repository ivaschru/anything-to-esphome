"""Host fsync/flock/no-replay journal; synthetic device result, no execution."""
import base64
import copy
import importlib
import os
import sys
import unittest
from unittest.mock import patch

import test_usb_browser_full_ui_context as fixtures

with patch.object(sys, 'path', [str(fixtures.full.ROOT), *sys.path]):
    trial = importlib.import_module('browser_full_ui_trial')


class FullUiTrialJournalTests(unittest.TestCase):
    def setUp(self):
        self.f = fixtures.FullUiContextTests(methodName='runTest'); self.f.setUp(); self.addCleanup(self.f.doCleanups); self.f.complete()
        self.stages, self.directory = self.f.stages, self.f.directory
        self.owner, self.job, self.sha = self.f.owner, self.f.job, self.f.sha
        self.c = self.f.read(); self.manager = trial.BrowserFullUiTrials(self.stages)
        self.target = {**self.c['target'], 'boot_id': '59999999-5999-4999-8999-599999999999'}
        self.scope = {'kind': 'browser_full_ui_scope', **{k: self.c[k] for k in ('job_id', 'plan_sha256', 'pm_intent_sha256', 'pm_proof_sha256')},
            'target': self.target, 'bridge_checked': True, 'context_only': True, 'device_writes': 0}
        self.preflight = {'state': 'full_ui_preflight_observed', 'read_only': True, 'device_writes': 0, 'launch_authorized': False,
            'installation_ready': False, 'installed': False, 'live_recheck_required': True}
        self.selected = {'channel_id': '8' * 32, 'channel_nonce': '88888888-8888-4888-8888-888888888888',
                         'observation': {'scope': self.scope, 'preflight': self.preflight}}

    def prepare(self): return self.manager.prepare(self.owner, self.job, self.sha, self.selected, True)

    def proof(self, p):
        return {'schema_version': 1, **{k: p[k] for k in ('job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'intent_sha256', 'trial_job')},
                'result': {'state': 'full_ui_trial_returned_observed', 'native_observations': 2, 'stock_return_observed': True,
                    'launch_acknowledged': True, 'job': p['trial_job'], 'hard_runtime_ms': 60000, 'installed': False,
                    'installation_ready': False, 'boot_enabled': False, 'replay_allowed': False, 'boot_id': self.target['boot_id']},
                'final_scope': self.scope, 'api_closed': True, 'transport_closed': True, 'channel_closed': True}

    def test_original_pair_delivered_once_only_after_intent_and_retained_lease(self):
        p = self.prepare(); self.assertTrue((self.directory / trial.INTENT).is_file()); self.assertIsNotNone(self.stages.lease_fd)
        for kind, body in p['images'].items(): self.assertEqual(base64.b64decode(body), (self.directory / 'browser-plan' / kind).read_bytes())
        with self.assertRaises(Exception): self.prepare()
        result = self.manager.record(self.owner, self.job, p['intent_sha256'], self.proof(p))
        self.assertEqual(result['state'], 'browser_full_ui_trial_returned_observed'); self.assertIsNone(self.stages.lease_fd)
        self.assertFalse(result['installed'] or result['installation_ready'] or result['replay_allowed']); self.stages.fence_all()

    def test_wrong_boot_or_preflight_is_refused_before_consumption(self):
        for edit in (lambda v: v['observation']['scope']['target'].update(boot_id=self.c['pm_armed_boot']),
                     lambda v: v['observation']['scope'].update(bridge_checked=1),
                     lambda v: v['observation']['preflight'].update(state='full_ui_unverified')):
            selected = copy.deepcopy(self.selected); edit(selected)
            with self.assertRaises(Exception): self.manager.prepare(self.owner, self.job, self.sha, selected, True)
            self.assertFalse((self.directory / trial.INTENT).exists()); self.assertIsNone(self.stages.lease_fd)

    def test_lost_body_or_restart_keeps_global_fence_and_never_adopts_lease(self):
        with patch.object(trial, 'private_bytes', side_effect=OSError('synthetic lost body')):
            with self.assertRaises(OSError): self.prepare()
        self.assertTrue((self.directory / trial.INTENT).is_file()); self.stages.close()
        with self.assertRaisesRegex(Exception, 'usb_browser_stage_previous_unverified'): self.stages.fence_all()
        other = trial.BrowserFullUiTrials(type(self.stages)(self.stages.plans))
        self.assertEqual(other.status(self.owner, self.job)['state'], 'browser_full_ui_trial_unverified')
        with self.assertRaises(Exception): other.prepare(self.owner, self.job, self.sha, self.selected, True)
        self.assertIsNone(other.stages.lease_fd)

    def test_missing_actual_closure_return_or_pair_scope_never_records(self):
        p = self.prepare()
        for edit in (lambda v: v.update(api_closed=False), lambda v: v.update(channel_closed=1), lambda v: v.update(transport_closed=False),
                     lambda v: v['result'].update(native_observations=True), lambda v: v['result'].update(boot_enabled=True),
                     lambda v: v['result'].update(hard_runtime_ms=60001), lambda v: v['result'].update(stock_return_observed=False)):
            proof = copy.deepcopy(self.proof(p)); edit(proof)
            with self.assertRaises(Exception): self.manager.proof(p, p['intent_sha256'], proof)
            self.assertFalse((self.directory / trial.COMPLETE).exists()); self.assertIsNotNone(self.stages.lease_fd)
        proof = self.proof(p); proof['transport_closed'] = False
        with self.assertRaises(Exception): self.manager.record(self.owner, self.job, p['intent_sha256'], proof)
        self.assertFalse((self.directory / trial.COMPLETE).exists()); self.assertIsNotNone(self.stages.lease_fd)

    def test_orphan_completion_is_not_empty(self):
        trial.write_new(self.directory / trial.COMPLETE, b'{}')
        with self.assertRaises(Exception): self.manager.status(self.owner, self.job)
        with self.assertRaisesRegex(Exception, 'usb_browser_stage_previous_unverified'): self.stages.fence_all()
