"""Real actor, registry, loopback/Noise SDK; emulated monitor and accelerated time."""
import asyncio
import base64
import copy
import importlib.util
import json
import sys
import time
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, Mock, patch

import test_usb_browser_boot_context as contexts
import test_usb_browser_bridge_boot_review as readers
import test_usb_browser_initial_ram as registry_fixture
import test_usb_browser_initial_noise as noise

sys.modules.setdefault('qingping_browser_contract.monitor1_browser_bridge_boot', readers.review)
spec = importlib.util.spec_from_file_location('qingping_browser_contract.monitor1_browser_boot_observer',
                                            readers.review.ROOT.parent / 'monitor1_browser_boot_observer.py')
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
Refusal = readers.Refusal


class BootObserverTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.j = contexts.ObserverContextTests(methodName='runTest'); self.j.setUp(); self.addCleanup(self.j.doCleanups)
        self.j.complete(); self.checked = self.j.read()
        self.registry = registry_fixture.readers.fixtures.fixtures.fixtures.registry_module.BrowserRegistry()
        self.addCleanup(self.registry.stop)
        core = contexts.fixtures.fixtures.fixtures.fixtures.commits.fixtures.plans.core_actor
        app = core.Companion(usb=object(), job_root=self.j.directory.parent); app.browser_stages = self.j.stages
        self.owner, self.nonce = self.j.owner, app.page(self.j.owner)
        self.actor = core.Actor(app, usb_ready=Mock(side_effect=AssertionError('No native USB setup')))
        self.old = self.checked['arming']['context']['meta']['target']
        self.target = {**self.old, 'boot_id': '59999999-5999-5999-5999-599999999999'}
        self.register()
        self.lock = asyncio.Lock(); await self.lock.acquire(); self.addCleanup(self.lock.release)
        self.process = SimpleNamespace(returncode=None)
        self.service = SimpleNamespace(browser_registry=self.registry, lock=self.lock, process=self.process,
            failed=False, closing=False, exchange=AsyncMock(side_effect=self.exchange))
        self.frames, self.operations = [], []
        self.tasks = set(); self.stop = self.bad_scope = self.change_actor = False; self.fail_op = None
        self.remote_reader = self.remote_writer = None

    def register(self):
        evidence = {'kind': 'browser_webusb', 'channel': '99999999-9999-4999-8999-999999999999',
                    'serial': self.target['usb_serial'], **{k: self.target[k] for k in ('wlan_mac', 'boot_id', 'co2_type', 'stock_version')},
                    'native_get_devpath': False}
        self.channel = self.registry.open(self.owner, self.nonce, {'evidence': evidence})['channel_id']
        self.cap = self.registry.capability(self.owner, self.nonce, self.channel)
        self.data = {'job_id': self.j.job, 'expected_plan_sha256': self.j.sha, 'channel_id': self.channel}

    async def exchange(self, owner, nonce, operation, data):
        self.operations.append(operation)
        value, mime = self.actor.dispatch({'user': owner, 'nonce': nonce, 'operation': operation, 'data': data})
        return True, mime, value if isinstance(value, bytes) else json.dumps(value).encode()

    def scope(self):
        common = {'job_id': self.j.job, 'plan_sha256': self.j.sha, 'target': self.target,
                  'arming_intent_sha256': self.checked['arming']['intent_sha256'],
                  'arming_proof_sha256': self.checked['arming_proof_sha256'], 'context_only': True, 'device_writes': 0}
        if self.target['boot_id'] == self.old['boot_id']: return {'kind': 'browser_bridge_boot_waiting', **common}
        value = {'kind': 'browser_bridge_boot_runtime_scope', **common,
                 'root_identity': self.checked['arming']['preparation']['preparation']['scope']['root_identity'],
                 'processes': {'child': [301, 300, '1901'], 'supervisor': [300, 1, '1900'],
                               'stock': [150, 151, '1100'], 'watchdog': [151, 1, '1110']},
                 'pm_disabled': True, 'recovery_backup': True, 'bridge_disabled': False, 'canonical_scope_checked': True,
                 'memory_free_bytes': 64 * 1024**2, 'memory_total_bytes': 128 * 1024**2}
        if self.bad_scope: value['pm_disabled'] = 1
        return value

    async def answer(self, frame):
        op, data = frame['operation'], frame['data']; self.frames.append(copy.deepcopy(frame))
        value = None
        if op == 'boot-observe':
            self.assertEqual(data, {'context': self.checked}); value = self.scope()
            if self.change_actor: self.service.process = SimpleNamespace(returncode=None)
        elif op == 'api-open':
            self.remote_reader, self.remote_writer = await asyncio.open_connection('127.0.0.1', self.server.sockets[0].getsockname()[1])
        elif op == 'api-read': value = base64.b64encode(await self.remote_reader.read(65536)).decode()
        elif op == 'api-write':
            self.remote_writer.write(base64.b64decode(data, validate=True)); await self.remote_writer.drain()
        elif op == 'api-close':
            self.remote_writer.close(); await self.remote_writer.wait_closed()
        else: self.assertEqual(op, 'channel-close')
        try: self.cap.answer({'id': frame['id'], 'ok': op != self.fail_op, 'data': value})
        except Refusal:
            if not self.cap.closed: raise

    async def pump(self):
        while not self.stop and not self.cap.closed:
            frame = await self.cap.poll()
            if frame is None: continue
            task = asyncio.create_task(self.answer(frame)); self.tasks.add(task); task.add_done_callback(self.tasks.discard)
            if frame['operation'] == 'channel-close': return

    async def run_observe(self):
        self.service.pending = asyncio.current_task(); pump = asyncio.create_task(self.pump())
        try:
            async with asyncio.timeout(10): return await module.observe(self.service, self.owner, self.nonce, self.data)
        finally:
            self.stop = True; pump.cancel(); await asyncio.gather(pump, return_exceptions=True)
            for task in self.tasks: task.cancel()
            await asyncio.gather(*self.tasks, return_exceptions=True)

    async def test_same_boot_reports_waiting_after_exact_context_and_close_without_key_or_api(self):
        self.target['boot_id'] = self.old['boot_id']
        self.registry.current['reported_evidence']['boot_id'] = self.old['boot_id']
        result = await self.run_observe()
        self.assertEqual(result['state'], 'bridge_autostart_waiting_for_boot'); self.assertFalse(result['runtime_observed'])
        self.assertEqual([f['operation'] for f in self.frames], ['boot-observe', 'channel-close'])
        self.assertEqual(self.operations, ['internal-browser-boot-observer-context'] * 2)
        self.assertIsNone(self.j.stages.lease_fd)

    async def test_invalid_runtime_scope_refuses_before_private_key_or_api(self):
        self.bad_scope = True
        with self.assertRaises(Refusal): await self.run_observe()
        self.assertNotIn('internal-browser-boot-observer-api', self.operations)
        self.assertNotIn('api-open', [f['operation'] for f in self.frames])

    async def test_replaced_actor_foreign_task_and_lost_close_never_claim_runtime(self):
        self.change_actor = True
        with self.assertRaises(Refusal): await self.run_observe()
        self.assertNotIn('internal-browser-boot-observer-api', self.operations)

    async def test_foreign_task_performs_no_pipe_or_channel_io(self):
        self.service.pending = asyncio.current_task()
        with self.assertRaises(Refusal): await asyncio.create_task(module.observe(self.service, self.owner, self.nonce, self.data))
        self.assertEqual(self.operations, []); self.assertTrue(self.cap.queue.empty())


@unittest.skipUnless(noise.HAS_API, 'Actual HA aioesphomeapi/Noise SDK required')
class EncryptedBootObserverTests(BootObserverTests):
    # Reuse only the existing test peer implementation, not its initial-trial
    # fixtures. Production Core/actor/registry/loopback/Noise are real here.
    peer = noise.EncryptedObserverTests.peer
    send = noise.EncryptedObserverTests.send
    vector = noise.EncryptedObserverTests.vector
    accept = noise.EncryptedObserverTests.accept
    stop_server = noise.EncryptedObserverTests.stop_server
    fast_wait = noise.EncryptedObserverTests.fast_wait

    async def start_peer(self):
        self.peer_writers, self.peer_tasks, self.peer_errors = [], set(), []
        self.raw_frames, self.protocol, self.peer_writer = [], None, None
        self.wrong_identity = False; self.subscribed = False
        self.clock = time.monotonic() + .5
        self.identity = self.checked['api_identity']
        self.key = json.loads((self.j.directory / 'profile.json').read_bytes())['api_encryption_key']
        self.server = await asyncio.start_server(self.accept, '127.0.0.1', 0)
        self.addAsyncCleanup(self.stop_server)

    async def test_real_noise_and_two_fresh_vectors_need_final_scope_api_and_usb_close(self):
        await self.start_peer()
        with patch.object(module, '_now', lambda: self.clock), patch.object(noise.module, '_now', lambda: self.clock), patch.object(module, '_wait', self.fast_wait):
            result = await self.run_observe()
        self.assertEqual(result['state'], 'post_boot_bridge_observed'); self.assertTrue(result['runtime_observed'])
        self.assertGreaterEqual(result['api']['samples'], 2); self.assertLessEqual(result['api']['last_sample_age_at_final_scope_s'], 20)
        self.assertFalse(result['installed'] or result['activated'] or result['installation_ready'])
        self.assertEqual(self.frames[-1]['operation'], 'channel-close'); self.assertTrue(self.cap.closed)
        self.assertNotIn(self.key, json.dumps(self.frames)); self.assertNotIn(base64.b64decode(self.key), b''.join(self.raw_frames))
        self.assertIsNone(self.j.stages.lease_fd)

    async def test_lost_usb_close_ack_cannot_report_authenticated_runtime_success(self):
        await self.start_peer(); self.fail_op = 'channel-close'
        with patch.object(module, '_now', lambda: self.clock), patch.object(noise.module, '_now', lambda: self.clock), patch.object(module, '_wait', self.fast_wait):
            with self.assertRaises(Refusal): await self.run_observe()
        self.assertTrue(self.cap.failed)

    async def test_wrong_noise_identity_cannot_become_runtime_success(self):
        await self.start_peer(); self.wrong_identity = True
        with patch.object(module, '_now', lambda: self.clock), patch.object(noise.module, '_now', lambda: self.clock), patch.object(module, '_wait', self.fast_wait):
            with self.assertRaises(Refusal): await self.run_observe()
        self.assertTrue(self.cap.closed)
