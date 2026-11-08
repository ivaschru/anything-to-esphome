"""Real private actor/journal/lease + Core continuation; synthetic profile only.

No monitor, socket, SDK program or guardian executes. These tests verify the
secret boundary, not authenticated wire samples or a completed trial.
"""
import asyncio
import importlib.util
import json
import sys
import unittest
from unittest.mock import AsyncMock, patch

import test_usb_browser_initial_journal as journals
import test_usb_browser_initial_guardian as joins

sys.modules.setdefault('qingping_browser_contract.monitor1_browser_initial_guardian', joins.guardian)

with patch.object(sys, 'path', [str(journals.fixtures.HERE), *sys.path]):
    import browser_initial_api as actor_api

spec = importlib.util.spec_from_file_location('qingping_browser_contract.monitor1_browser_initial_api',
    joins.fixtures.readers.fixtures.fixtures.ROOT / 'monitor1_browser_initial_api.py')
core_api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core_api)


class ActorApiTests(unittest.TestCase):
    def setUp(self):
        self.f = journals.JournalTests(methodName='runTest')
        self.f.setUp()
        self.addCleanup(self.f.doCleanups)
        self.packet = json.loads(self.f.prepare())
        self.request = {k: self.packet[k] for k in actor_api.BINDING}
        self.profile = json.loads((self.f.directory / 'profile.json').read_bytes())

    def read(self, request=None, owner=None, stages=None):
        return actor_api.package(stages or self.f.stages, owner or self.f.owner,
                                 self.request if request is None else request)

    def test_private_package_rechecks_plan_profile_and_all_bindings_without_writes_or_sdk(self):
        before = {p.relative_to(self.f.directory): p.read_bytes()
                  for p in self.f.directory.rglob('*') if p.is_file()}
        sdk_calls = len(self.f.f.calls)
        value = json.loads(self.read())
        self.assertEqual(set(value), {'kind', *actor_api.BINDING, 'node_name', 'api_mac', 'noise_psk'})
        self.assertEqual(value['noise_psk'], self.profile['api_encryption_key'])
        self.assertEqual(value['node_name'], self.profile['node_name'])
        self.assertEqual({k: value[k] for k in actor_api.BINDING}, self.request)
        self.assertNotIn('host', value)
        self.assertNotIn('wifi_password', value)
        self.assertEqual(sdk_calls, len(self.f.f.calls), 'No SDK or ADB starts on this read')
        self.assertEqual(before, {p.relative_to(self.f.directory): p.read_bytes()
                                for p in self.f.directory.rglob('*') if p.is_file()})
        public = self.f.manager.status(self.f.owner, self.f.job)
        self.assertNotIn(value['noise_psk'], json.dumps([self.packet, public]))
        self.assertIsNotNone(self.f.stages.lease_fd)

    def test_foreign_binding_extra_selector_or_owner_cannot_read_key(self):
        for key in actor_api.BINDING:
            request = {**self.request, key: 'f' * len(self.request[key])}
            with self.subTest(key=key), self.assertRaises(Exception):
                self.read(request)
        for request in ({**self.request, 'host': '127.0.0.1'}, {**self.request, 'noise_psk': 'not admitted'}, {}):
            with self.assertRaises(Exception): self.read(request)
        with self.assertRaises(Exception): self.read(owner='b' * 32)
        self.assertFalse((self.f.directory / journals.journal.COMPLETE).exists())

    def test_restart_or_lost_lease_cannot_adopt_consumed_key_context(self):
        fresh = journals.fixtures.commits.fixtures.stage.BrowserStages(self.f.stages.plans)
        with self.assertRaises(Exception): self.read(stages=fresh)
        self.f.stages.close()
        with self.assertRaises(Exception): self.read()
        self.assertIsNone(fresh.lease_fd)

    def test_changed_profile_intent_or_unknown_completion_refuses_without_repair(self):
        for name in ('profile.json', journals.journal.INTENT):
            path = self.f.directory / name
            original = path.read_bytes()
            path.write_bytes(original + b' ')
            with self.subTest(name=name), self.assertRaises(Exception): self.read()
            self.assertEqual(path.read_bytes(), original + b' ')
            path.write_bytes(original)  # Synthetic fixture reset only, no device history.
        journals.fixtures.commits.fixtures.stage.write_new(self.f.directory / journals.journal.COMPLETE, b'{}')
        with self.assertRaises(Exception): self.read()
        self.assertIsNotNone(self.f.stages.lease_fd)

    def test_actor_route_uses_only_private_mime_and_never_initializes_usb(self):
        actor = journals.fixtures.commits.fixtures.plans.core_actor
        app = actor.Companion(usb=object(), job_root=self.f.directory.parent)
        app.browser_stages = self.f.stages
        nonce = app.page(self.f.owner)
        def no_usb(): self.fail('No native USB setup is authorized by a key read')
        worker = actor.Actor(app, usb_ready=no_usb)
        body, mime = worker.dispatch({'user': self.f.owner, 'nonce': nonce,
            'operation': 'internal-browser-initial-trial-api', 'data': self.request})
        self.assertEqual(mime, actor_api.MIME)
        self.assertEqual(json.loads(body)['noise_psk'], self.profile['api_encryption_key'])

    def test_lease_loss_during_profile_read_never_returns_private_bytes(self):
        original = actor_api.read_private
        def retire(path):
            raw = original(path)
            if path.name == 'profile.json': self.f.stages.close()
            return raw
        with patch.object(actor_api, 'read_private', side_effect=retire), self.assertRaises(Exception):
            self.read()
        self.assertTrue((self.f.directory / journals.journal.INTENT).is_file())

    def test_core_payload_rejects_wrong_mime_duplicate_fields_and_invalid_secret_encoding(self):
        value = json.loads(self.read())
        result = lambda body, mime=core_api.MIME: (True, mime, body)
        with self.assertRaises(joins.Refusal): core_api._payload(result(json.dumps(value).encode(), 'application/json'), self.packet)
        raw = json.dumps(value).encode()
        duplicate = raw[:-1] + b',"noise_psk":"duplicate"}'
        with self.assertRaises(joins.Refusal): core_api._payload(result(duplicate), self.packet)
        for delta in ({'noise_psk': 'A' * 43}, {'noise_psk': 'A' * 44}, {'noise_psk': 1},
                      {'api_mac': '01:00:00:00:00:01'}, {'api_mac': '00:00:00:00:00:00'},
                      {'node_name': '../not-a-node'}, {'host': 'not permitted'}, {'channel_id': True}):
            with self.subTest(fields=list(delta)), self.assertRaises(joins.Refusal):
                core_api._payload(result(json.dumps({**value, **delta}).encode()), self.packet)


class CoreApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.f = joins.InitialGuardianJoinTests(methodName='runTest')
        await self.f.asyncSetUp()
        for function, args, kwargs in self.f._cleanups:
            self.addCleanup(function, *args, **kwargs)
        self.f._cleanups.clear()
        self.bad = self.lost = self.expire = False
        self.original_exchange = self.f.b.exchange
        self.f.b.service.exchange = AsyncMock(side_effect=self.exchange)

    async def exchange(self, owner, nonce, operation, data):
        if operation != 'internal-browser-initial-trial-api':
            return await self.original_exchange(owner, nonce, operation, data)
        self.f.b.operations.append(operation)
        body, mime = self.f.b.actor.dispatch({'user': owner, 'nonce': nonce, 'operation': operation, 'data': data})
        if self.lost: raise OSError('synthetic lost private answer')
        if self.expire: self.f.b.registry.current['deadline'] = 0
        if self.bad:
            value = json.loads(body)
            value['channel_id'] = '0' * 32
            body = json.dumps(value).encode()
        return True, mime, body

    async def running(self):
        ram = await self.f.b.run_prepare()
        return await self.f.run_pumped(lambda: joins.guardian.start_guardian(ram))

    async def test_original_live_context_is_private_nonserializable_and_read_once(self):
        running = await self.running()
        context = await core_api.read_initial_api_context(running)
        profile = json.loads((self.f.b.j.directory / 'profile.json').read_bytes())
        self.assertEqual(context.identity, {k: profile[k] for k in ('node_name', 'api_mac')})
        self.assertNotIn(profile['api_encryption_key'], repr(context))
        with self.assertRaises(TypeError): json.dumps(context)
        with self.assertRaises(joins.Refusal): await core_api.read_initial_api_context(running)
        self.assertEqual(self.f.b.operations.count('internal-browser-initial-trial-api'), 1)
        self.assertNotIn('api-open', self.f.b.events, 'A key read is not socket admission')
        await self.f.run_pumped(running.finish_records)
        with self.assertRaises(joins.Refusal): _ = context.identity
        context.close()
        self.assertIsNone(context._noise_psk)
        await self.f.run_pumped(running.close)
        self.assertIsNotNone(self.f.b.j.stages.lease_fd)
        self.f.b.usb.assert_not_called()

    async def test_foreign_task_or_json_cannot_request_secret_context(self):
        running = await self.running()
        with self.assertRaises(joins.Refusal): await core_api.read_initial_api_context(running.reported_start)
        with self.assertRaises(joins.Refusal): await asyncio.create_task(core_api.read_initial_api_context(running))
        self.assertNotIn('internal-browser-initial-trial-api', self.f.b.operations)
        await self.f.run_pumped(running.close)

    async def test_lost_answer_or_changed_binding_consumes_read_and_keeps_trial_fence(self):
        running = await self.running()
        self.bad = True
        with self.assertRaises(joins.Refusal):
            await self.f.run_pumped(lambda: core_api.read_initial_api_context(running))
        self.assertTrue(self.f.b.cap.closed)
        self.assertIsNotNone(self.f.b.j.stages.lease_fd)
        with self.assertRaises(joins.Refusal): await core_api.read_initial_api_context(running)
        self.assertEqual(self.f.b.operations.count('internal-browser-initial-trial-api'), 1)

    async def test_lost_private_answer_is_not_replayed(self):
        running = await self.running()
        self.lost = True
        with self.assertRaises(joins.Refusal):
            await self.f.run_pumped(lambda: core_api.read_initial_api_context(running))
        self.assertTrue(self.f.b.cap.closed)
        self.assertEqual(self.f.b.operations.count('internal-browser-initial-trial-api'), 1)

    async def test_capability_expiry_during_private_read_does_not_renew_context(self):
        running = await self.running()
        self.expire = True
        with self.assertRaises(joins.Refusal):
            await self.f.run_pumped(lambda: core_api.read_initial_api_context(running))
        self.assertIsNotNone(self.f.b.j.stages.lease_fd)
