"""Real private stopped journal/FD joins; synthetic device proof, no execution."""
import copy
import hashlib
import importlib
import json
import sys
import unittest
from unittest.mock import Mock, patch

import test_usb_browser_initial_journal as fixtures

with patch.object(sys, 'path', [str(fixtures.fixtures.HERE), *sys.path]):
    boot = importlib.import_module('browser_bridge_boot')


class BootContextTests(unittest.TestCase):
    def setUp(self):
        self.f = fixtures.JournalTests(methodName='runTest')
        self.f.setUp()
        self.addCleanup(self.f.doCleanups)
        self.directory, self.stages = self.f.directory, self.f.stages
        self.owner, self.job, self.sha = self.f.owner, self.f.job, self.f.sha
        # The fixture's admitted source is public and synthetic. Populate the
        # extra frozen arming inputs without changing any private build/report.
        contract = json.loads((boot.ROOT / 'bridge-next-boot-contract.json').read_bytes())
        for name, digest in contract['source_sha256'].items():
            body = (fixtures.fixtures.ROOT / 'ports/monitor1' / name).read_bytes()
            self.assertEqual(hashlib.sha256(body).hexdigest(), digest)
            p = self.f.f.source / name
            p.write_bytes(body)
            p.chmod(0o644)

    def stopped(self):
        packet = json.loads(self.f.prepare())
        binding = {k: packet[k] for k in ('job_id', 'plan_sha256', 'intent_sha256', 'channel_id',
                                         'channel_nonce', 'nonce', 'ram_job_id', 'guardian_job_id')}
        guardian, child = [21001, str(2**64 - 1)], [21002, '10001']
        start = {'kind': 'start', 'nonce': packet['nonce'], 'stamp': guardian}
        child_row = {'kind': 'child', 'nonce': packet['nonce'], 'stamp': child}
        end = {'kind': 'end', 'nonce': packet['nonce'], 'guardian': guardian, 'child': child,
               'elapsed_ms': 60000, 'reaped': True, 'protection_ack': True, 'term_sent': True, 'forced': False, 'wait_status': 15}
        scope = packet['context']['committed_scope']
        returned = {'kind': 'browser_initial_return_observation', **binding, 'guardian': guardian, 'child': child,
            'own_programs_absent': True, 'root_identity': scope['root_identity'], 'ram_root_identity': [7, 100],
            'stock_process': [scope['stock_process'][0], str(scope['stock_process'][1])],
            'watchdog_process': [scope['watchdog_process'][0], str(scope['watchdog_process'][1])],
            'prefs_layout': 'empty', 'memory_free_bytes': 64 * 1024**2, 'memory_total_bytes': 128 * 1024**2,
            'kernel_scope_checked': True, 'image_fd_admitted': False, 'execution_authority': False, 'context_only': True}
        proof = {'binding': binding, 'ram_root_identity': [7, 100],
            'records': {'kind': 'browser_initial_guardian_records', 'start': start, 'child': child_row, 'end': end,
                        'raw_closed': True, 'transport_closed': False, 'records_only': True},
            'wire': {'samples': 3, 'identity': packet['context']['api_identity'], 'last_sample_age_at_reap_s': 17},
            'returned': returned, 'transport': {'kind': 'browser_initial_return_closed', 'observation': returned,
                                              'transport_closed': True, 'context_only': True},
            'channel_closed': True, 'core_elapsed_at_end_ms': 60000}
        self.f.manager.record(self.owner, self.job, packet['intent_sha256'], proof)
        return packet, proof

    def read(self, owner=None, sha=None):
        return boot.context(self.stages, owner or self.owner, self.job, sha or self.sha)

    def test_exact_stopped_bytes_and_sources_are_read_without_sdk_write_key_or_lease(self):
        packet, proof = self.stopped()
        before = {p.relative_to(self.directory): p.read_bytes() for p in self.directory.rglob('*') if p.is_file()}
        calls = len(self.f.f.calls)
        value = self.read()
        self.assertEqual(value, self.read(), 'Repeated reads create no new attempt or lease')
        self.assertEqual(value['trial_intent_sha256'], packet['intent_sha256'])
        self.assertEqual(value['trial_proof_sha256'], hashlib.sha256((self.directory / fixtures.journal.COMPLETE).read_bytes()).hexdigest())
        self.assertFalse(value['writer_enabled'] or value['installed'] or value['installation_ready'])
        self.assertTrue(value['live_recheck_required'] and value['context_only'])
        self.assertIsNone(self.stages.lease_fd)
        self.assertEqual(len(self.f.f.calls), calls, 'Arming context never starts an SDK')
        profile = json.loads((self.directory / 'profile.json').read_bytes())
        self.assertNotIn(profile['api_encryption_key'], json.dumps(value))
        self.assertNotIn('guardian_body', value)
        self.assertNotIn('usb_transport', value['meta']['target'])
        self.assertEqual(before, {p.relative_to(self.directory): p.read_bytes() for p in self.directory.rglob('*') if p.is_file()})
        # Compare the fixed marker against the actual unchanged native builder.
        # Stop at its first fake verifier callback: no read/script is executed.
        with patch.object(sys, 'path', [str(fixtures.fixtures.ROOT / 'ports/monitor1'), *sys.path]):
            native = importlib.import_module('trial_initial_bridge_adb')
        observed = []
        class Captured(Exception):
            pass
        def capture(adb, path, pin):
            observed.append((path, pin)); raise Captured
        plan = {'plan_id': value['meta']['descriptor']['plan_id'], 'files': value['meta']['descriptor']['files'],
                'target': {'boot_id': value['meta']['target']['boot_id']}}
        receipt = {'guardian': packet['context']['guardian'], 'nonce': packet['nonce']}
        with patch.object(native.review.staging, 'verify_remote_file', side_effect=capture), self.assertRaises(Captured):
            native.intent_and_ram(object(), self.directory, plan, self.sha, receipt,
                                  proof['records']['start']['stamp'], proof['ram_root_identity'], 'synthetic-node')
        self.assertEqual(observed, [('/data/.esphome-cgs1/initial-trial.intent', value['trial_marker'])])

    def test_unstarted_or_consumed_unverified_history_is_not_an_arming_basis(self):
        with self.assertRaises(Exception): self.read()
        self.f.prepare()
        with self.assertRaises(Exception): self.read()
        self.assertIsNotNone(self.stages.lease_fd)
        self.assertFalse((self.directory / fixtures.journal.COMPLETE).exists())

    def test_foreign_owner_plan_and_changed_terminal_or_source_refuse_without_repair(self):
        self.stopped()
        for owner, sha in (('b' * 32, None), (None, '0' * 64)):
            with self.assertRaises(Exception): self.read(owner, sha)
        for p in (self.directory / fixtures.journal.COMPLETE, self.f.f.source / 'arm_bridge_next_boot_adb.py'):
            original = p.read_bytes(); p.write_bytes(original + b' ')
            # Whitespace alone need not change a JSON proof's meaning. The
            # exact bytes are pinned in output; semantic corruption must refuse.
            if p.name == fixtures.journal.COMPLETE:
                p.write_bytes(b'{}')
            with self.subTest(path=p.name), self.assertRaises(Exception): self.read()
            self.assertNotEqual(p.read_bytes(), original, 'No automatic repair of unknown history')
            p.write_bytes(original)  # This fixture's private synthetic file only.
        self.assertIsNone(self.stages.lease_fd)

    def test_actor_pipe_route_is_read_only_and_has_no_generic_fields_or_native_usb(self):
        self.stopped()
        core = fixtures.fixtures.commits.fixtures.plans.core_actor
        app = core.Companion(usb=object(), job_root=self.directory.parent)
        app.browser_stages = self.stages
        nonce = app.page(self.owner); usb = Mock()
        actor = core.Actor(app, usb_ready=usb)
        request = {'user': self.owner, 'nonce': nonce, 'operation': 'internal-browser-bridge-boot-context',
                   'data': {'job_id': self.job, 'expected_plan_sha256': self.sha}}
        result, mime = actor.dispatch(request)
        self.assertEqual(mime, 'application/json')
        self.assertEqual(result['kind'], 'browser_bridge_next_boot_context')
        usb.assert_not_called()
        request['data']['command'] = 'not admitted'
        with self.assertRaises(Exception): actor.dispatch(request)
