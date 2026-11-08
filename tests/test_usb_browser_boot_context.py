"""Original host journal context, no fake USB, SDK execution or device IO."""
import hashlib
import importlib
import json
import sys
import unittest
from unittest.mock import Mock, patch

import test_usb_browser_bridge_boot_journal as fixtures

with patch.object(sys, 'path', [str(fixtures.journal.ROOT), *sys.path]):
    observer = importlib.import_module('browser_boot_context')


class ObserverContextTests(unittest.TestCase):
    def setUp(self):
        self.f = fixtures.BootJournalTests(methodName='runTest'); self.f.setUp(); self.addCleanup(self.f.doCleanups)
        self.stages, self.directory = self.f.stages, self.f.directory
        self.owner, self.job, self.sha = self.f.owner, self.f.job, self.f.sha
        contract = json.loads((observer.ROOT / 'bridge-observer-contract.json').read_bytes())
        for name, digest in contract['source_sha256'].items():
            body = (fixtures.fixtures.fixtures.fixtures.ROOT / 'ports/monitor1' / name).read_bytes()
            self.assertEqual(hashlib.sha256(body).hexdigest(), digest)
            path = self.f.f.f.f.source / name; path.write_bytes(body); path.chmod(0o644)

    def complete(self):
        packet = self.f.prepare()
        self.f.manager.record(self.owner, self.job, packet['intent_sha256'], self.f.proof(packet))
        return packet

    def read(self):
        return observer.context(self.stages, self.owner, self.job, self.sha)

    def test_exact_complete_context_is_repeatable_without_lease_sdk_or_secret_output(self):
        packet = self.complete()
        before = {str(p): p.read_bytes() for p in self.directory.rglob('*') if p.is_file()}
        value = self.read()
        self.assertEqual(value, self.read()); self.assertEqual(value['arming'], packet)
        self.assertIsNone(self.stages.lease_fd)
        self.assertEqual(before, {str(p): p.read_bytes() for p in self.directory.rglob('*') if p.is_file()})
        profile = json.loads((self.directory / 'profile.json').read_bytes())
        self.assertNotIn(profile['api_encryption_key'], json.dumps(value))
        self.assertNotIn('usb_transport', value['arming']['context']['meta']['target'])

    def test_unfinished_changed_history_or_source_is_not_a_readable_success(self):
        with self.assertRaises(Exception): self.read()
        packet = self.f.prepare()
        with self.assertRaises(Exception): self.read()
        self.f.manager.record(self.owner, self.job, packet['intent_sha256'], self.f.proof(packet))
        source = self.f.f.f.f.source / 'verify_bridge_boot_adb.py'; source.write_bytes(b'changed')
        with self.assertRaises(Exception): self.read()
        self.assertIsNone(self.stages.lease_fd)

    def test_actor_route_has_exact_fields_and_never_initializes_usb(self):
        self.complete()
        core = fixtures.fixtures.fixtures.fixtures.commits.fixtures.plans.core_actor
        app = core.Companion(usb=object(), job_root=self.directory.parent); app.browser_stages = self.stages
        nonce = app.page(self.owner); usb = Mock(); actor = core.Actor(app, usb_ready=usb)
        request = {'user': self.owner, 'nonce': nonce, 'operation': 'internal-browser-boot-observer-context',
                   'data': {'job_id': self.job, 'expected_plan_sha256': self.sha}}
        value, mime = actor.dispatch(request)
        self.assertEqual(value, self.read()); self.assertEqual(mime, 'application/json'); usb.assert_not_called()
        for data in ({**request['data'], 'path': '/proc'}, {'job_id': self.job}):
            with self.assertRaises(Exception): actor.dispatch({**request, 'data': data})

    def test_key_package_is_private_bound_to_complete_bytes_and_does_not_take_a_lease(self):
        packet = self.complete(); value = self.read()
        request = {'job_id': self.job, 'plan_sha256': self.sha, 'arming_intent_sha256': packet['intent_sha256'],
                   'arming_proof_sha256': value['arming_proof_sha256']}
        profile = json.loads((self.directory / 'profile.json').read_bytes())
        result = json.loads(observer.api_package(self.stages, self.owner, request))
        self.assertEqual(result['noise_psk'], profile['api_encryption_key'])
        self.assertNotIn('wifi', result); self.assertNotIn('ota_password', result)
        self.assertIsNone(self.stages.lease_fd)
        for change in ({'arming_intent_sha256': '0' * 64}, {'arming_proof_sha256': '0' * 64}, {'host': '127.0.0.1'}):
            with self.assertRaises(Exception): observer.api_package(self.stages, self.owner, {**request, **change})
        with self.assertRaises(Exception): observer.api_package(self.stages, 'b' * 32, request)
