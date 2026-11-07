"""Detached browser plans with synthetic source bodies, never USB or firmware.

The canonical binary auditor is replaced only at its read-only boundary. The
browser producer, hashes, recipe checks, durable intent and owner/actor route
run for real. A native plan is never manufactured from a browser report.
"""
import hashlib
import json
import os
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import test_usb_plan as native
import test_usb_preparation as preparation

HERE = Path(__file__).resolve().parents[1] / 'apps/monitor1_usb/rootfs'
with patch.object(sys, 'path', [str(HERE), *sys.path]):
    import browser_plan as plans
    import browser_payload as payload
    import browser_plan_job as child
    import core_actor


def browser_fixture(entries):
    # Test archive generation only. Production retains the report exactly as
    # captured by its real browser transport and cannot relabel native data.
    for item, body in entries:
        if item.name.endswith('/result.json'):
            report = json.loads(body)
            report.pop('usb_transport')
            report.update(stage='read_only_browser_capture_complete', transport='browser_usb')
            body = json.dumps(report).encode()
        yield item, body


class BrowserPlanTests(unittest.TestCase):
    def setUp(self):
        old_prepare = preparation.PreparationTests.prepare
        def prepare_browser(fixture, data=None):
            return old_prepare(fixture, fixture.rewrite(browser_fixture) if data is None else data)
        self.fixture = native.PlanTests(methodName='runTest')
        with patch.object(preparation.PreparationTests, 'prepare', prepare_browser):
            self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.directory, self.owner, self.id = self.fixture.directory, self.fixture.owner, self.fixture.id
        self.manager = plans.BrowserPlans(self.fixture.fixture.manager)
        self.calls, self.audits = [], []
        self.assets = {name: ('synthetic asset ' + name).encode()
                       for name in ('launch.sh', 'SnowApp-with-PM', 'startup-hook.sh')}

    def canonical(self):
        def read_json(path):
            body = path.read_bytes()
            return json.loads(body), hashlib.sha256(body).hexdigest()
        def candidate_files(build, profile_sha):
            self.audits.append((build, profile_sha))
            report, digest = read_json(build / 'result.json')
            result = {name: plans.read_private(build / name) for name in ('native-program', 'bridge-program', 'guardian-program')}
            result['pm_qt_bridge.so'] = b'synthetic helper, not a shared library'
            return result, report, digest
        contract = self.fixture.fixture.fixture.contract
        return SimpleNamespace(private_directory=plans.private_directory, read_json=read_json,
            child=lambda root, name: root / name,
            preflight=SimpleNamespace(FILES={v['path']: (v['sha256'], v['size']) for v in contract['files']}),
            candidate=SimpleNamespace(read_profile=read_json), candidate_files=candidate_files,
            bootstrap=SimpleNamespace(read_regular=lambda path, *args: path.read_bytes(),
                patch_bytes=lambda start, watchdog, hook: (start + hook, watchdog + hook),
                ASSET_PINS={name: hashlib.sha256(body).hexdigest() for name, body in self.assets.items()}))

    def runner(self, command, cwd, env, log, deadline):
        self.assertTrue((self.directory / plans.INTENT).is_file())
        self.assertEqual(cwd, self.directory)
        self.assertNotIn('api_encryption_key', json.dumps([command, env]))
        self.assertFalse(any(token in command for token in ('adb', 'push', 'reboot', 'shell', 'git')))
        self.calls.append(command)
        if str(command[1]).endswith('bootstrap_patches.py'):
            root = self.directory / 'browser-bootstrap'
            root.mkdir(mode=0o700)
            start = (self.directory / 'capture/data/etc/init.d/start.sh').read_bytes()
            watchdog = (self.directory / 'capture/data/bin/watchdog.sh').read_bytes()
            bodies = {'stock-start.sh.original': start, 'stock-watchdog.sh.original': watchdog,
                      'start.sh.candidate': start + self.assets['startup-hook.sh'],
                      'watchdog.sh.candidate': watchdog + self.assets['startup-hook.sh'], **self.assets}
            pins = {}
            for name, body in bodies.items():
                plans.write_new(root / name, body)
                pins[name] = {'size': len(body), 'sha256': hashlib.sha256(body).hexdigest()}
            recipe = {'schema_version': 1, 'stage': 'patches_prepared_not_installed', 'hardware_contacted': False,
                      'installed': False, 'installation_ready': False, 'files': pins}
            plans.write_new(root / 'result.json', json.dumps(recipe).encode())
        elif str(command[1]).endswith('browser_plan_job.py'):
            self.assertEqual(command, [str(self.fixture.source / '.venv/bin/python'), str(HERE / 'browser_plan_job.py'), '--job', self.id])
            root = self.directory / 'browser-plan'
            root.mkdir(mode=0o700)
            payload.prepare(self.canonical(), self.directory / 'capture', self.directory / 'candidate',
                self.directory / 'browser-bootstrap', self.directory / 'profile.json', root, plans.producer_digest())
        else:
            self.fail('Unexpected child operation')

    def prepare(self, runner=None):
        previous = os.umask(0o077)
        try:
            return self.manager.prepare(self.owner, self.id, runner or self.runner)
        finally:
            os.umask(previous)

    def test_detached_plan_keeps_browser_schema_and_no_write_authority(self):
        result = self.prepare()
        self.assertEqual(result['state'], 'browser_plan_prepared')
        self.assertEqual(len(self.calls), 2)
        self.assertEqual(len(self.audits), 1)
        self.assertFalse(result['native_get_devpath'] or result['writer_enabled'] or result['hardware_contacted'] or result['installed'])
        self.assertEqual(result['device_writes'], 0)
        self.assertEqual(self.manager.status(self.owner, self.id), result)
        plan = json.loads((self.directory / 'browser-plan/plan.json').read_text())
        self.assertEqual(plan['schema_version'], 2)
        self.assertEqual(plan['target']['kind'], 'browser_webusb')
        self.assertNotIn('usb_transport', plan['target'])
        self.assertNotIn('channel', plan['target'])
        self.assertEqual(set(plan['files']), plans.ROLES)
        key = json.loads((self.directory / 'profile.json').read_text())['api_encryption_key']
        self.assertNotIn(key, json.dumps([result, plan, self.calls]))
        self.assertFalse((self.directory / 'install-plan').exists())
        self.assertEqual(self.fixture.manager.status(self.owner, self.id)['state'], 'browser_adapter_pending')
        with self.assertRaisesRegex(Exception, 'usb_plan_browser_pending'):
            self.fixture.manager.prepare(self.owner, self.id)
        with self.assertRaisesRegex(Exception, 'usb_browser_plan_consumed'):
            self.prepare()
        self.assertEqual(len(self.calls), 2)

    def test_wrong_owner_and_native_transport_fail_before_consumption(self):
        with self.assertRaises(Exception):
            self.manager.prepare('b' * 32, self.id, self.runner)
        with patch.object(plans, 'owned_intent', return_value=(self.directory, {'transport': 'ha_usb'}, b'')):
            with self.assertRaisesRegex(Exception, 'usb_browser_plan_transport_required'):
                self.prepare()
        self.assertFalse(self.calls)
        self.assertFalse((self.directory / plans.INTENT).exists())

    def test_source_and_capture_drift_refuse_before_child_or_intent(self):
        for path in (self.fixture.source / 'prepare_install.py', self.directory / 'capture/data/bin/watchdog.sh'):
            before = path.read_bytes()
            path.write_bytes(b'changed')
            with self.subTest(path=path.name), self.assertRaises(Exception):
                self.prepare()
            self.assertFalse(self.calls)
            self.assertFalse((self.directory / plans.INTENT).exists())
            path.write_bytes(before)

    def test_existing_native_or_browser_history_never_becomes_new_plan(self):
        for name in ('plan-intent.json', 'install-intent.json', 'full-ui-trial-intent.json',
                     'full-ui-activation-intent.json', 'pm-extension-intent.json', 'browser-install-intent.json'):
            plans.write_new(self.directory / name, b'{}')
            with self.subTest(name=name), self.assertRaisesRegex(Exception, 'usb_browser_plan_unverified'):
                self.prepare()
            self.assertFalse((self.directory / plans.INTENT).exists())
            (self.directory / name).unlink()  # Only this synthetic test's marker.
        self.assertFalse(self.calls)

    def test_failure_is_terminal_and_a_restart_only_reads_history(self):
        with self.assertRaises(RuntimeError):
            self.prepare(lambda *args: (_ for _ in ()).throw(RuntimeError('synthetic')))
        restarted = plans.BrowserPlans(self.fixture.fixture.manager)
        self.assertEqual(restarted.status(self.owner, self.id)['state'], 'browser_plan_failed')
        with self.assertRaisesRegex(Exception, 'usb_browser_plan_consumed'):
            restarted.prepare(self.owner, self.id, self.runner)
        self.assertFalse(self.calls)
        self.assertTrue((self.directory / 'profile.json').is_file())

    def test_partial_intent_and_unknown_outputs_are_preserved(self):
        (self.directory / 'browser-plan').mkdir(mode=0o700)
        with self.assertRaisesRegex(Exception, 'usb_browser_plan_unverified'):
            self.prepare()
        self.assertFalse((self.directory / plans.INTENT).exists())
        (self.directory / 'browser-plan').rmdir()
        # Simulate the producer dying after fsynced intent, not a failed ACK.
        with self.assertRaises(BaseException):
            self.prepare(lambda *args: (_ for _ in ()).throw(KeyboardInterrupt()))
        (self.directory / plans.COMPLETE).unlink()  # Test-only crash window.
        self.assertEqual(self.manager.status(self.owner, self.id)['state'], 'browser_plan_unverified')
        with self.assertRaisesRegex(Exception, 'usb_browser_plan_consumed'):
            self.prepare()

    def test_payload_schema_hash_metadata_and_extra_files_are_rechecked(self):
        self.prepare()
        path = self.directory / 'browser-plan/plan.json'
        before = path.read_bytes()
        value = json.loads(before)
        for change in ({'schema_version': 1}, {'writer_enabled': True}, {'device_writes': False},
                       {'native_get_devpath': True}, {'requested_data_free_bytes': 1},
                       {'target': {**value['target'], 'usb_transport': 'usb:invented'}}):
            path.write_text(json.dumps({**value, **change}))
            # Exercise semantic admission as well as the immutable receipt.
            intent, _ = plans.checked_intent(self.directory, self.owner, self.id)
            with self.subTest(change=change), self.assertRaises(Exception):
                plans.verify(self.directory, intent)
            with self.assertRaises(Exception):
                self.manager.status(self.owner, self.id)
            path.write_bytes(before)
        extra = self.directory / 'browser-plan/unknown'
        plans.write_new(extra, b'unknown')
        with self.assertRaises(Exception):
            self.manager.status(self.owner, self.id)
        extra.unlink()
        program = self.directory / 'browser-plan/native-program'
        program.chmod(0o644)
        with self.assertRaises(Exception):
            self.manager.status(self.owner, self.id)

    def test_payload_bytes_and_source_are_not_trusted_after_completion(self):
        self.prepare()
        for path in (self.directory / 'browser-plan/native-program', self.fixture.source / 'prepare_install.py',
                     self.directory / 'capture/data/bin/watchdog.sh'):
            before = path.read_bytes()
            path.write_bytes(b'changed')
            with self.subTest(path=path.name), self.assertRaises(Exception):
                self.manager.status(self.owner, self.id)
            path.write_bytes(before)

    def test_historical_producer_is_readable_without_restarting_updated_code(self):
        result = self.prepare()
        with patch.object(plans, 'producer_digest', return_value='e' * 64):
            self.assertEqual(self.manager.status(self.owner, self.id), result)
            with self.assertRaisesRegex(Exception, 'usb_browser_plan_consumed'):
                self.prepare()
        self.assertEqual(len(self.calls), 2)

    def test_new_sdk_child_refuses_changed_producer_before_importing_runtime(self):
        self.prepare()
        with patch.object(child, 'producer_digest', return_value='e' * 64), patch.object(child, 'source_closure') as source:
            with self.assertRaisesRegex(Exception, 'usb_browser_plan_unverified'):
                child.run(self.directory)
            source.assert_not_called()

    def test_sdk_child_joins_exact_producer_and_calls_only_offline_auditors(self):
        original_runner = self.runner
        def runner(command, *args):
            if str(command[1]).endswith('browser_plan_job.py'):
                canonical = self.canonical()
                def new_output(path):
                    path.mkdir(mode=0o700)
                    return path
                canonical.pm = SimpleNamespace(private_output=new_output)
                # Only the child import is stubbed. Its owned job/source/
                # producer checks and actual payload preparation run here.
                with patch.dict(sys.modules, {'prepare_install': canonical}), patch.object(sys, 'path', list(sys.path)):
                    child.run(self.directory)
                self.calls.append(command)
            else:
                original_runner(command, *args)
        self.assertEqual(self.prepare(runner)['state'], 'browser_plan_prepared')
        self.assertEqual(len(self.audits), 1)
        self.assertEqual(len(self.calls), 2)

    def test_payload_refuses_a_native_report_even_inside_a_browser_job(self):
        def runner(command, *args):
            if str(command[1]).endswith('browser_plan_job.py'):
                path = self.directory / 'capture/result.json'
                report = json.loads(path.read_bytes())
                report.update(stage='read_only_capture_complete', usb_transport='usb:invented')
                path.write_text(json.dumps(report))
            self.runner(command, *args)
        with self.assertRaisesRegex(ValueError, 'Browser capture/profile binding required'):
            self.prepare(runner)
        self.assertFalse(self.audits)
        self.assertEqual(list((self.directory / 'browser-plan').iterdir()), [])

    def test_old_reviewed_source_is_not_upgraded_or_mixed_into_new_browser_plan(self):
        with patch.object(plans, 'bound_build_intent', return_value={'source_commit': '0' * 40}):
            with self.assertRaisesRegex(Exception, 'usb_browser_plan_source_required'):
                self.prepare()
        self.assertFalse(self.calls)
        self.assertFalse((self.directory / plans.INTENT).exists())

    def test_private_plan_context_rehashes_target_and_never_exports_key(self):
        result = self.prepare()
        context = self.manager.context(self.owner, self.id, result['plan_sha256'])
        self.assertEqual(context['target']['kind'], 'browser_webusb')
        self.assertFalse(context['writer_enabled'])
        key = json.loads((self.directory / 'profile.json').read_text())['api_encryption_key']
        self.assertNotIn(key, json.dumps(context))
        app = core_actor.Companion(self.fixture.fixture.fixture.capture.usb, self.fixture.fixture.fixture.parent)
        app.browser_plans = self.manager
        nonce = app.page(self.owner)
        usb = Mock()
        actor = core_actor.Actor(app, usb_ready=usb)
        body, mime = actor.dispatch({'user': self.owner, 'nonce': nonce, 'operation': 'internal-browser-plan-context',
            'data': {'job_id': self.id, 'expected_plan_sha256': result['plan_sha256']}})
        self.assertEqual(body, context)
        self.assertEqual(mime, 'application/json')
        usb.assert_not_called()
        for owner, digest in (('b' * 32, result['plan_sha256']), (self.owner, 'e' * 64)):
            with self.assertRaises(Exception):
                self.manager.context(owner, self.id, digest)
        (self.directory / 'browser-plan/bridge-program').write_bytes(b'changed')
        with self.assertRaises(Exception):
            self.manager.context(self.owner, self.id, result['plan_sha256'])

    def test_actual_core_actor_uses_only_fixed_local_plan_routes(self):
        app = core_actor.Companion(self.fixture.fixture.fixture.capture.usb,
                                                    self.fixture.fixture.fixture.parent)
        nonce = app.page(self.owner)
        operation = app.browser_plans = SimpleNamespace(prepare=Mock(return_value={'state': 'offline'}),
                                                        status=Mock(return_value={'state': 'history'}))
        usb = Mock()
        actor = core_actor.Actor(app, usb_ready=usb, tools_ready=Mock(side_effect=AssertionError('No tools setup')))
        def request(op, data=None, page_nonce=nonce):
            return {'user': self.owner, 'nonce': page_nonce, 'operation': op, 'data': data}
        self.assertEqual(actor.dispatch(request('browser-plan', {'job_id': self.id}))[0], {'state': 'offline'})
        self.assertEqual(actor.dispatch(request('jobs/' + self.id + '/browser-plan'))[0], {'state': 'history'})
        operation.prepare.assert_called_once_with(self.owner, self.id)
        operation.status.assert_called_once_with(self.owner, self.id)
        for data in ({'job_id': self.id, 'source': 'arbitrary'}, {'job_id': self.id, 'command': 'shell'}):
            with self.assertRaises(core_actor.Refusal):
                actor.dispatch(request('browser-plan', data))
        with self.assertRaises(core_actor.Refusal):
            actor.dispatch(request('browser-plan', {'job_id': self.id}, '0' * 64))
        usb.assert_not_called()


if __name__ == '__main__':
    unittest.main()
