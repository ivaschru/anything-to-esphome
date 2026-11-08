"""Terminal browser history + real source/FD joins; synthetic programs only.

The parent runner is explicitly replaced: a fake SDK is never executed. The
optional ELF test calls the unchanged canonical parser on a tiny synthetic
header, never an ARM program. None of these tests establish hardware admission.
"""
import hashlib
import importlib
import importlib.util
import json
import os
from pathlib import Path
import struct
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

import test_usb_browser_commit as commits

HERE = commits.fixtures.plans.HERE
ROOT = Path(__file__).resolve().parents[1]
with patch.object(sys, 'path', [str(HERE), *sys.path]):
    import browser_initial_trial as trial
    import browser_initial_trial_job as child


class TrialContextTests(unittest.TestCase):
    def setUp(self):
        native = commits.fixtures.plans.native.PlanTests
        original = native.setUp
        contract = json.loads((HERE / 'initial-trial-contract.json').read_bytes())
        def sources(fixture):
            original(fixture)
            report_path = fixture.directory / 'candidate/result.json'
            report = json.loads(report_path.read_bytes())
            for name, digest in contract['source_sha256'].items():
                data = (ROOT / 'ports/monitor1' / name).read_bytes()
                self.assertEqual(hashlib.sha256(data).hexdigest(), digest)
                (fixture.source / name).write_bytes(data)
                (fixture.source / name).chmod(0o644)
                report['source_sha256'][name] = digest
            # Candidate/result is pinned by the plan AFTER this fixture setup.
            # This is deliberately non-ELF; only the runner boundary is mocked.
            guardian = fixture.directory / 'candidate/initial-trial-guardian-program'
            guardian.write_bytes(b'synthetic initial guardian; not an ELF or firmware\n' * 2)
            report['initial_trial_guardian'] = {'size': guardian.stat().st_size,
                'sha256': hashlib.sha256(guardian.read_bytes()).hexdigest()}
            report_path.write_text(json.dumps(report))
            completion_path = fixture.directory / 'build-complete.json'
            completion = json.loads(completion_path.read_bytes())
            completion['artifacts']['initial-trial-guardian-program'] = report['initial_trial_guardian']
            completion_path.write_text(json.dumps(completion))
        self.f = commits.CommitTests(methodName='runTest')
        with patch.object(native, 'setUp', sources):
            self.f.setUp()
        self.addCleanup(self.f.doCleanups)
        self.packet = self.f.prepare()
        self.f.manager.record(self.f.owner, self.f.id, self.packet['intent_sha256'], self.f.proof(self.packet))
        self.stages, self.directory = self.f.stages, self.f.directory
        self.source = self.directory / 'candidate/ports/monitor1'
        self.sdk = self.source / '.venv/bin/python'
        self.sdk.parent.mkdir(parents=True)
        self.sdk.write_bytes(b'fake SDK; never execute\n')
        self.guardian = self.directory / 'candidate/initial-trial-guardian-program'
        self.calls = []

    def checked(self):
        return trial.checked(self.stages, self.f.owner, self.f.id, self.f.sha)

    def read(self, runner=None):
        return trial.context(self.stages, self.f.owner, self.f.id, self.f.sha, runner or self.runner)

    def runner(self, command, cwd, env, raw):
        self.calls.append((command, cwd, env, raw))
        self.assertEqual(command, [str(self.sdk), '-B', str(HERE / 'browser_initial_trial_job.py'), '--job', self.f.id])
        self.assertEqual(cwd, self.directory)
        self.assertEqual(set(env), {'PATH', 'PYTHONDONTWRITEBYTECODE', 'PYTHONNOUSERSITE', 'PYTHONUTF8'})
        self.assertEqual(json.loads(raw)['guardian'], json.loads((self.directory / 'candidate/result.json').read_bytes())['initial_trial_guardian'])
        return trial.encoded(trial.artifact_result(raw))

    def test_terminal_read_binds_separate_guardian_and_original_proof_without_any_write(self):
        before = {p.relative_to(self.directory): p.read_bytes() for p in self.directory.rglob('*') if p.is_file()}
        with patch.dict(os.environ, {'SUPERVISOR_TOKEN': 'private-test-value', 'ADB_SERVER_SOCKET': 'tcp:unsafe'}):
            result = self.read()
        self.assertTrue(result['guardian_artifact_checked'] and result['context_only'])
        self.assertFalse(result['image_fd_admitted'] or result['writer_enabled'] or result['installation_ready'] or result['hardware_contacted'])
        self.assertEqual(result['meta']['commit_nonce'], self.packet['nonce'])
        self.assertNotIn('usb_transport', result['meta']['target'])
        self.assertEqual(result['commit_proof_sha256'], hashlib.sha256((self.directory / commits.commits.COMPLETE).read_bytes()).hexdigest())
        profile = json.loads((self.directory / 'profile.json').read_bytes())
        self.assertNotIn(profile['api_encryption_key'], repr([result, self.calls]))
        self.assertEqual(self.read(), result, 'A repeated artifact read creates no trial/replay capability')
        self.assertEqual(before, {p.relative_to(self.directory): p.read_bytes() for p in self.directory.rglob('*') if p.is_file()})
        self.assertIsNone(self.stages.lease_fd)

    def test_missing_or_unknown_commit_history_owner_or_plan_refuses_before_sdk(self):
        with self.assertRaises(Exception):
            trial.context(self.stages, 'b' * 32, self.f.id, self.f.sha, self.runner)
        with self.assertRaises(Exception):
            trial.context(self.stages, self.f.owner, self.f.id, '0' * 64, self.runner)
        (self.directory / commits.commits.COMPLETE).unlink()  # This fixture's synthetic record only.
        with self.assertRaises(Exception):
            self.read()
        self.assertFalse(self.calls)

    def test_guardian_mismatch_missing_symlink_hardlink_and_public_mode_refuse(self):
        original = self.guardian.read_bytes()
        other = self.directory / 'candidate/guardian-program'
        cases = ('changed', 'missing', 'symlink', 'hardlink', 'public')
        for case in cases:
            with self.subTest(case=case):
                self.guardian.unlink()
                if case == 'changed': self.guardian.write_bytes(b'changed')
                elif case == 'symlink': self.guardian.symlink_to(other)
                elif case == 'hardlink': os.link(other, self.guardian)
                elif case == 'public': self.guardian.write_bytes(original);self.guardian.chmod(0o644)
                with self.assertRaises(Exception): self.read()
                if self.guardian.exists() or self.guardian.is_symlink(): self.guardian.unlink()
                self.guardian.write_bytes(original);self.guardian.chmod(0o600)
        self.assertFalse(self.calls)

    def test_required_canonical_source_drift_is_not_accepted_by_a_historical_result(self):
        path = self.source / 'trial_initial_bridge_adb.py'
        path.write_bytes(path.read_bytes() + b'\n')
        with self.assertRaises(Exception): self.read()
        self.assertFalse(self.calls)

    def test_sdk_answer_cannot_replace_exact_input_or_fd_admission_with_truthy_json(self):
        for key, value in [('input_sha256', '0' * 64), ('image_fd_admitted', True), ('guardian_artifact_checked', 1), ('device_writes', False)]:
            def runner(command, cwd, env, raw):
                result = trial.artifact_result(raw);result[key] = value
                return trial.encoded(result)
            with self.subTest(key=key), self.assertRaises(Exception): self.read(runner)
        for body in (b'{}', b'x' * 8193, 'not bytes'):
            with self.subTest(body_type=type(body)), self.assertRaises(Exception):
                self.read(lambda *args: body)
        self.assertFalse(any('trial-intent' in p.name for p in self.directory.iterdir()))

    def test_changed_artifact_or_profile_during_sdk_io_refuses_without_retry(self):
        for name in ('candidate/initial-trial-guardian-program', 'profile.json'):
            path = self.directory / name;before = path.read_bytes();count = []
            def runner(command, cwd, env, raw):
                count.append(True);path.write_bytes(before + b'\n')
                return trial.encoded(trial.artifact_result(raw))
            with self.subTest(name=name), self.assertRaises(Exception): self.read(runner)
            path.write_bytes(before)
            self.assertEqual(count, [True])
        self.assertIsNone(self.stages.lease_fd)

    def test_child_uses_only_canonical_guardian_artifact_without_native_loader_or_execution(self):
        _, _, plan, context, _ = self.checked()
        canonical = Mock()
        canonical.guardian_artifact.return_value = (self.guardian, context['guardian'])
        child.inspect_artifact(canonical, self.directory, plan, context['guardian'])
        canonical.guardian_artifact.assert_called_once_with(plan, self.directory / 'candidate')
        self.assertEqual([call[0] for call in canonical.mock_calls], ['guardian_artifact'])
        for path, spec in ((self.directory / 'candidate/guardian-program', context['guardian']),
                           (self.guardian, {**context['guardian'], 'sha256': '0' * 64})):
            canonical.guardian_artifact.return_value = (path, spec)
            with self.assertRaises(Exception): child.inspect_artifact(canonical, self.directory, plan, context['guardian'])

    def test_actual_private_actor_read_never_initializes_adb_and_rejects_extra_fields(self):
        app = commits.fixtures.plans.core_actor.Companion(self.f.f.fixture.fixture.fixture.fixture.capture.usb, self.directory.parent)
        app.browser_stages = self.stages
        nonce = app.page(self.f.owner);usb = Mock()
        actor = commits.fixtures.plans.core_actor.Actor(app, usb_ready=usb)
        request = {'user': self.f.owner, 'nonce': nonce, 'operation': 'internal-browser-initial-trial-context',
                   'data': {'job_id': self.f.id, 'expected_plan_sha256': self.f.sha}}
        original = trial.context
        with patch.object(trial, 'run') as unused, patch.object(trial, 'context', side_effect=lambda stages, owner, job, sha: original(stages, owner, job, sha, self.runner)):
            result, mime = actor.dispatch(request)
        self.assertEqual(mime, 'application/json');self.assertTrue(result['guardian_artifact_checked'])
        usb.assert_not_called();unused.assert_not_called()
        request['data']['command'] = 'not admitted'
        with self.assertRaises(Exception): actor.dispatch(request)


class CanonicalArtifactTests(unittest.TestCase):
    @unittest.skipUnless(importlib.util.find_spec('elftools'), 'Actual ELF parser requires the optional build SDK dependency')
    def test_unchanged_canonical_auditor_checks_a_synthetic_arm_header_without_running_it(self):
        with patch.object(sys, 'path', [str(ROOT / 'ports/monitor1'), *sys.path]):
            canonical = importlib.import_module('trial_initial_bridge_adb')
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve();root.chmod(0o700)
            header = b'\x7fELF\x01\x01\x01' + b'\0' * 9
            header += struct.pack('<HHIIIIIHHHHHH', 2, 40, 1, 0, 0, 0, 0x5000400, 52, 32, 0, 40, 0, 0)
            program = root / 'initial-trial-guardian-program';program.write_bytes(header);program.chmod(0o600)
            spec = {'size': len(header), 'sha256': hashlib.sha256(header).hexdigest()}
            report = {'complete_build': True, 'source_commit': 'a' * 40, 'initial_trial_guardian': spec}
            raw = json.dumps(report).encode();(root / 'result.json').write_bytes(raw);(root / 'result.json').chmod(0o600)
            plan = {'basis': {'source_commit': report['source_commit'], 'candidate_sha256': hashlib.sha256(raw).hexdigest()}}
            self.assertEqual(canonical.guardian_artifact(plan, root), (program, spec))
            wrong = bytearray(header);wrong[18:20] = struct.pack('<H', 62)
            program.write_bytes(wrong)
            with self.assertRaises(Exception): canonical.guardian_artifact(plan, root)


if __name__ == '__main__':
    unittest.main()
