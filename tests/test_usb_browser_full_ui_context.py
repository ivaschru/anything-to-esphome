"""Post-PM original host journals, real private file checks; no monitor IO."""
import importlib
import json
import sys
import unittest
from unittest.mock import patch

import test_usb_browser_pm_boot_journal as fixtures

with patch.object(sys, 'path', [str(fixtures.pm.ROOT), *sys.path]):
    full = importlib.import_module('browser_full_ui_context')


class FullUiContextTests(unittest.TestCase):
    def setUp(self):
        self.f = fixtures.PmJournalTests(methodName='runTest'); self.f.setUp(); self.addCleanup(self.f.doCleanups)
        self.stages, self.directory = self.f.stages, self.f.directory
        self.owner, self.job, self.sha = self.f.owner, self.f.job, self.f.sha

    def complete(self):
        p = self.f.prepare()
        self.f.manager.record(self.owner, self.job, p['intent_sha256'], self.f.proof(p))

    def read(self): return full.context(self.stages, self.owner, self.job, self.sha)

    def test_completed_pm_history_is_read_twice_without_sdk_lease_or_secrets(self):
        self.complete(); before = {str(p): p.read_bytes() for p in self.directory.rglob('*') if p.is_file()}
        c = self.read(); self.assertEqual(c, self.read()); self.assertEqual(c['pm_armed_boot'], self.f.target['boot_id'])
        self.assertEqual(c['native_pair'], self.f.manager._intent(self.owner, self.job)[1]['native_pair'])
        profile = json.loads((self.directory / 'profile.json').read_bytes())
        self.assertNotIn(profile['api_encryption_key'], json.dumps(c)); self.assertIsNone(self.stages.lease_fd)
        self.assertEqual(before, {str(p): p.read_bytes() for p in self.directory.rglob('*') if p.is_file()})
        self.assertFalse(c['writer_enabled']); self.assertEqual(c['device_writes'], 0)

    def test_incomplete_wrong_owner_plan_or_changed_complete_cannot_pass(self):
        with self.assertRaises(Exception): self.read()
        self.f.prepare()
        with self.assertRaises(Exception): self.read()
        self.assertIsNotNone(self.stages.lease_fd)

    def test_private_api_package_is_bound_to_exact_pm_history_and_profile(self):
        self.complete(); c = self.read(); request = {k: c[k] for k in ('job_id', 'plan_sha256', 'pm_intent_sha256', 'pm_proof_sha256')}
        p = json.loads(full.api_package(self.stages, self.owner, request))
        self.assertEqual(p['noise_psk'], json.loads((self.directory / 'profile.json').read_bytes())['api_encryption_key'])
        for change in ({'pm_proof_sha256': '0' * 64}, {'host': '127.0.0.1'}, {'plan_sha256': '0' * 64}):
            with self.assertRaises(Exception): full.api_package(self.stages, self.owner, {**request, **change})
        with self.assertRaises(Exception): full.api_package(self.stages, '0' * 32, request)
        self.assertIsNone(self.stages.lease_fd)
        (self.directory / fixtures.pm.COMPLETE).write_bytes(b'{}')
        with self.assertRaises(Exception): self.read()

    def test_private_actor_routes_require_exact_fields_and_do_not_start_adb(self):
        self.complete()
        core = fixtures.fixtures.fixtures.fixtures.fixtures.fixtures.commits.fixtures.plans.core_actor
        app = core.Companion(usb=object(), job_root=self.directory.parent); app.browser_stages = self.stages
        from unittest.mock import Mock
        usb = Mock(side_effect=AssertionError('No ADB')); actor = core.Actor(app, usb_ready=usb); nonce = app.page(self.owner)
        data = {'job_id': self.job, 'expected_plan_sha256': self.sha}
        request = {'user': self.owner, 'nonce': nonce, 'operation': 'internal-browser-full-ui-context', 'data': data}
        c, mime = actor.dispatch(request); self.assertEqual(c, self.read()); self.assertEqual(mime, 'application/json')
        for change in ({'path': '/proc'}, {'host': '127.0.0.1'}):
            with self.assertRaises(Exception): actor.dispatch({**request, 'data': {**data, **change}})
        value, mime = actor.dispatch({**request, 'operation': 'internal-browser-full-ui-api',
            'data': {k: c[k] for k in ('job_id', 'plan_sha256', 'pm_intent_sha256', 'pm_proof_sha256')}})
        self.assertEqual(mime, full.MIME); self.assertEqual(json.loads(value)['kind'], 'browser_full_ui_api_context')
        usb.assert_not_called()
