"""Private pure-policy child admission; synthetic jobs, no SDK/device execution.

Use real public canonical policy modules for constructor semantics. The parent
runner is replaced explicitly: a fake interpreter file is never executed or
claimed to qualify its SDK, a firmware build or physical hardware.
"""
import copy
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import test_usb_browser_disabled_review as reviews
import test_usb_browser_disabled_policy as pure
import test_usb_browser_stage as stages

HERE = stages.plans.HERE
with patch.object(sys, 'path', [str(HERE), *sys.path]):
    import browser_disabled_policy as admission
    import browser_disabled_policy_job as child


class AssessmentTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.fixture = reviews.DisabledReviewTests(methodName='runTest')
        await self.fixture.asyncSetUp()
        self.addCleanup(self.fixture.doCleanups)
        f = self.fixture
        self.context, self.scope = copy.deepcopy(f.context), copy.deepcopy(f.scope)
        self.job, self.sha = f.data['job_id'], f.data['expected_plan_sha256']
        self.owner, self.channel, self.nonce = f.fixture.owner, f.data['channel_id'], f.fixture.evidence['channel']
        self.temp = tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name) / self.job
        self.directory.mkdir(mode=0o700)
        self.source = self.directory / 'candidate/ports/monitor1'
        self.source.mkdir(parents=True)
        # Match actual Git archive source permissions. Private payload rules
        # must not incorrectly demand 0600 for these public committed files.
        for name, digest in f.reader['source_sha256'].items():
            body = (pure.ROOT / 'ports/monitor1' / name).read_bytes()
            self.assertEqual(hashlib.sha256(body).hexdigest(), digest)
            path = self.source / name;path.write_bytes(body);path.chmod(0o644)
        self.sdk = self.source / '.venv/bin/python'
        self.sdk.parent.mkdir(parents=True);self.sdk.write_bytes(b'not an interpreter; NEVER executed\n')
        self.manager = SimpleNamespace(disabled_context=Mock(return_value=self.context),
            _plan=Mock(return_value=(self.directory, {})))
        self.closure = patch.object(admission, 'source_closure', return_value=self.source)
        self.closure.start();self.addCleanup(self.closure.stop)
        self.calls = []

    def args(self):
        return self.manager, self.owner, self.job, self.sha, self.channel, self.nonce, self.scope

    def runner(self, command, cwd, env, raw):
        self.calls.append((command, cwd, env, raw))
        self.assertEqual(command, [str(self.sdk), '-B', str(HERE / 'browser_disabled_policy_job.py'), '--job', self.job])
        self.assertEqual(cwd, self.directory)
        self.assertEqual(set(env), {'PATH','PYTHONDONTWRITEBYTECODE','PYTHONNOUSERSITE','PYTHONUTF8'})
        self.assertEqual(env['PATH'], '/usr/local/bin:/usr/bin:/bin')
        self.assertNotIn(self.nonce, json.dumps([command, env]))
        value = json.loads(raw)
        self.assertEqual(value['scope'], self.scope)
        self.assertEqual(value['channel_nonce'], self.nonce)
        return admission.encoded({'schema_version':1, 'job_id':self.job, 'plan_sha256':self.sha,
            'source_commit':self.context['source_commit'], 'observation_sha256':hashlib.sha256(raw).hexdigest(),
            'sdk_policy_checked':True, 'commit_admissible_for_review':True, 'state':'factory_commit_admissible_for_review',
            'device_writes':0, 'writer_enabled':False, 'installation_ready':False, 'live_recheck_required':True})

    def test_fixed_child_stdin_only_clean_environment_rehashes_before_and_after(self):
        with patch.dict(os.environ, {'SUPERVISOR_TOKEN':'private-test-value','ADB_SERVER_SOCKET':'tcp:unsafe'}):
            result = admission.assess(*self.args(), runner=self.runner)
        self.assertTrue(result['sdk_policy_checked'])
        self.assertFalse(result['writer_enabled'] or result['installation_ready'])
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(self.manager.disabled_context.call_count, 2)
        self.assertEqual(list(self.directory.iterdir()), [self.directory / 'candidate'], 'Analysis creates no intent/result/log')

    def test_public_required_source_fingerprint_drift_or_symlink_refuses_before_child(self):
        path = self.source / 'disabled_commit_policy.py';body = path.read_bytes()
        path.write_bytes(body + b'\n# unreviewed drift\n')
        with self.assertRaises(Exception):admission.assess(*self.args(), runner=self.runner)
        self.assertFalse(self.calls)
        path.unlink();path.symlink_to(pure.ROOT / 'ports/monitor1/disabled_commit_policy.py')
        with self.assertRaises(Exception):admission.assess(*self.args(), runner=self.runner)
        self.assertFalse(self.calls)

    def test_source_change_while_child_runs_discards_result_and_never_repeats(self):
        def changed(*args):
            result = self.runner(*args)
            path = self.source / 'preflight_adb.py';path.write_bytes(path.read_bytes() + b'\n')
            return result
        with self.assertRaises(Exception):admission.assess(*self.args(), runner=changed)
        self.assertEqual(len(self.calls), 1)

    def test_child_hash_fields_or_timeout_never_become_a_positive_result(self):
        for delta in ({'observation_sha256':'0'*64}, {'writer_enabled':True}, {'sdk_policy_checked':False},
                      {'device_writes':True}, {'state':'installed'}, {'source_commit':'0'*40}):
            def bad(*args):
                value=json.loads(self.runner(*args));value.update(delta)
                return admission.encoded(value)
            with self.subTest(delta=delta),self.assertRaises(Exception):admission.assess(*self.args(), runner=bad)
        count=len(self.calls)
        def timed_out(*args):raise TimeoutError('no raw error disclosure')
        with self.assertRaisesRegex(Exception, '^usb_browser_scope_unverified$'):
            admission.assess(*self.args(), runner=timed_out)
        self.assertEqual(len(self.calls), count)

    def test_missing_sdk_invalid_binding_and_unknown_scope_refuse_before_spawn(self):
        for index, value in ((4,'usb:invented'), (5,'bad'), (6,{**self.scope,'pm_helper_loaded':None})):
            args=list(self.args());args[index]=value
            with self.subTest(index=index),self.assertRaises(Exception):admission.assess(*args,runner=self.runner)
        self.sdk.unlink()
        with self.assertRaises(Exception):admission.assess(*self.args(),runner=self.runner)
        self.assertFalse(self.calls)

    def test_real_canonical_constructor_is_read_only_and_known_partial_is_not_forward_admissible(self):
        # Same production adapter, actual public canonical policy, synthetic
        # scope. No issue/ack or any shell, ADB or SDK interpreter is invoked.
        with patch.object(pure.browser.BrowserVendorTransaction, 'issue', side_effect=AssertionError('no write issue')):
            self.assertTrue(child.evaluate(pure.browser,self.context['meta'],self.scope,self.channel,self.nonce))
            changed=copy.deepcopy(self.scope)
            for entry in changed['vendor_hashes']:
                if entry[0]==pure.native.policy.WATCHDOG:entry[1]=pure.native.policy.PATCHED[entry[0]]
            self.assertFalse(child.evaluate(pure.browser,self.context['meta'],changed,self.channel,self.nonce))

    def test_child_main_joins_exact_stdin_cwd_and_checked_source_before_policy_import(self):
        # Exercise the fixed child entry with its source verifier replaced at
        # the boundary, not a claim of real candidate/ELF/SDK qualification.
        raw=admission.policy_input(self.job,self.sha,self.channel,self.nonce,self.scope)
        output=io.BytesIO()
        with patch.object(sys,'argv',['fixed-child','--job',self.job]), \
             patch.object(sys,'stdin',SimpleNamespace(buffer=io.BytesIO(raw))), \
             patch.object(sys,'stdout',SimpleNamespace(buffer=output)), \
             patch.object(sys,'path',list(sys.path)), \
             patch.object(child,'child_job_directory',return_value=self.directory), \
             patch.object(child,'read_private',return_value=json.dumps({'owner':self.owner}).encode()), \
             patch.object(child,'checked_input',return_value=(self.directory,self.source,self.context,raw)) as check:
            child.main()
        self.assertEqual(check.call_args.args[1:], (self.owner,self.job,self.sha,self.channel,self.nonce,self.scope))
        result=json.loads(output.getvalue())
        self.assertTrue(result['sdk_policy_checked'] and result['commit_admissible_for_review'])
        self.assertFalse(result['writer_enabled'] or result['installation_ready'])
        self.assertEqual(result['observation_sha256'],hashlib.sha256(raw).hexdigest())

    def test_trusted_runner_has_fixed_timeout_no_stderr_and_bounded_result(self):
        args=([str(self.sdk),'fixed-child'],self.directory,{},b'{}')
        with patch.object(admission.subprocess,'run',return_value=SimpleNamespace(returncode=0,stdout=b'{}')) as run:
            self.assertEqual(admission.run(*args),b'{}')
        self.assertEqual(run.call_args.kwargs['timeout'],15)
        self.assertIs(run.call_args.kwargs['stderr'],admission.subprocess.DEVNULL)
        for result in (SimpleNamespace(returncode=1,stdout=b'private raw failure'),
                       SimpleNamespace(returncode=0,stdout=b'x'*(admission.MAX_OUTPUT+1))):
            with patch.object(admission.subprocess,'run',return_value=result),self.assertRaises(Exception):admission.run(*args)

    def test_fixed_child_rejects_malformed_input_before_owned_source_lookup(self):
        raw=admission.encoded({'job_id':self.job, 'scope':self.scope, 'command':'not accepted'})
        with patch.object(sys,'argv',['fixed-child','--job',self.job]), \
             patch.object(sys,'stdin',SimpleNamespace(buffer=io.BytesIO(raw))), \
             patch.object(child,'child_job_directory',return_value=self.directory), \
             patch.object(child,'checked_input') as check:
            with self.assertRaises(ValueError):child.main()
        check.assert_not_called()


if __name__=='__main__':unittest.main()
