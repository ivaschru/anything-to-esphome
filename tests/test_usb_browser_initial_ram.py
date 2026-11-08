"""Real actor/journal/fsync/flock + registry/finite frames; synthetic USB/SDK.

Private guardian bytes are never ELF-executed. There is no public route or
terminal trial record. A positive handoff keeps the original live capability
and the actor's retained lease, not a reconstructed or serializable handle.
"""
import asyncio
import base64
import copy
import importlib.util
import json
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, Mock, patch

import test_usb_browser_initial_journal as journals
import test_usb_browser_initial_review as readers

sys.modules.setdefault('qingping_browser_contract.monitor1_browser_initial_review', readers.review)
spec = importlib.util.spec_from_file_location('qingping_browser_contract.monitor1_browser_initial_ram',
                                             readers.fixtures.fixtures.ROOT / 'monitor1_browser_initial_ram.py')
transfer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transfer)
Refusal = readers.Refusal


class InitialRamTransferTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.j = journals.JournalTests(methodName='runTest')
        self.j.setUp()
        self.addCleanup(self.j.doCleanups)
        self.registry = readers.fixtures.fixtures.fixtures.registry_module.BrowserRegistry()
        self.addCleanup(self.registry.stop)
        core = journals.fixtures.commits.fixtures.plans.core_actor
        app = core.Companion(usb=object(), job_root=self.j.directory.parent)
        app.browser_stages = self.j.stages
        self.owner, self.nonce = self.j.owner, app.page(self.j.owner)
        self.usb = Mock(side_effect=AssertionError('No native ADB initialization'))
        self.actor = core.Actor(app, usb_ready=self.usb)
        self.context = self.j.f.read()
        target = self.context['meta']['target']
        self.evidence = {'kind': 'browser_webusb', 'channel': self.j.f.f.channel_nonce, 'serial': target['usb_serial'],
                         **{k: target[k] for k in ('wlan_mac', 'boot_id', 'co2_type', 'stock_version')}, 'native_get_devpath': False}
        self.channel = self.registry.open(self.owner, self.nonce, {'evidence': self.evidence})['channel_id']
        self.cap = self.registry.capability(self.owner, self.nonce, self.channel)
        self.data = {'job_id': self.j.job, 'expected_plan_sha256': self.j.sha, 'channel_id': self.channel, 'experimental_reviewed': True}
        self.events, self.operations, self.chunks = [], [], []
        self.prepared = None
        self.context_reads = 0
        self.lost_packet = self.bad_packet = self.bad_inode = self.bad_scope = self.changed_context = self.bad_type = False
        self.lock = asyncio.Lock()
        await self.lock.acquire()
        self.addCleanup(self.lock.release)
        self.process = SimpleNamespace(returncode=None)  # Synthetic actor boundary, no subprocess is executed.
        self.service = SimpleNamespace(browser_registry=self.registry, exchange=AsyncMock(side_effect=self.exchange),
                                       process=self.process, lock=self.lock, failed=False, closing=False)

    async def exchange(self, owner, nonce, operation, data):
        self.assertEqual((owner, nonce), (self.owner, self.nonce))
        self.operations.append(operation)
        if operation == 'internal-browser-initial-trial-context':
            self.context_reads += 1
            result = self.j.f.read()
            if self.changed_context and self.context_reads > 1:
                result['commit_proof_sha256'] = '0' * 64
            return True, 'application/json', json.dumps(result).encode()
        self.assertEqual(operation, 'internal-browser-initial-trial-prepare')
        self.assertEqual(self.events, ['ram-stream-check', 'initial-trial-preparation'])
        value, mime = self.actor.dispatch({'user': owner, 'nonce': nonce, 'operation': operation, 'data': data})
        self.assertIsNotNone(self.j.stages.lease_fd)
        self.assertTrue((self.j.directory / journals.journal.INTENT).is_file())
        self.prepared = json.loads(value)
        if self.lost_packet:
            raise RuntimeError('synthetic lost private packet')
        if self.bad_packet:
            self.prepared['producer_sha256'] = {}
        if self.bad_type:
            self.prepared['context']['device_writes'] = False
        return True, mime, json.dumps(self.prepared).encode()

    def observation(self, uploaded=False):
        prepared = self.prepared
        value = {'kind': 'browser_initial_ram_observation', 'phase': 'uploaded' if uploaded else 'precreated',
                 **{k: prepared[k] for k in transfer.BINDING}, 'ram_root_identity': [7, 100],
                 'guardian_root_identity': [7, 101], 'guardian_file_identity': [7, 102],
                 'guardian_size': prepared['context']['guardian']['size'] if uploaded else 0,
                 'guardian_sha256': prepared['context']['guardian']['sha256'] if uploaded else transfer.EMPTY,
                 'tmpfs_available_bytes': 64 * 1024**2, 'image_fd_admitted': False,
                 'execution_authority': False, 'context_only': True}
        if uploaded and self.bad_inode:
            value['guardian_file_identity'] = [7, 103]
        return value

    async def pump(self, fail=None, expire=None):
        while True:
            frame = await self.cap.poll()
            if frame is None:
                continue
            op, data = frame['operation'], frame['data']
            self.events.append(op)
            if op == 'ram-stream-check':
                self.assertIsNone(data)
                value = {'kind': 'browser_fixed_stdin_probe', 'service': 'exec:/bin/sh', 'ready': True,
                         'device_files_changed': False, 'writer_enabled': False}
            elif op == 'initial-trial-preparation':
                self.assertEqual(data, {'meta': self.context['meta']})
                value = copy.deepcopy(self.j.preparation)
                if self.bad_scope:
                    value['scope']['root_identity'][1] += 1
            elif op == 'ram-prepare':
                self.assertEqual(data['packet'], {k: v for k, v in self.prepared.items() if k != 'guardian_body'})
                value = {'state': 'ram_precreated', 'precreated': self.observation(), 'writer_enabled': False, 'image_fd_admitted': False}
            elif op == 'ram-chunk':
                self.assertEqual(data['offset'], sum(map(len, self.chunks)))
                self.chunks.append(base64.b64decode(data['body'], validate=True))
                value = {'offset': sum(map(len, self.chunks))}
            elif op == 'ram-complete':
                self.assertEqual(b''.join(self.chunks), self.j.f.guardian.read_bytes())
                value = {'kind': 'browser_initial_ram_ready', 'precreated': self.observation(), 'uploaded': self.observation(True),
                         'preparation': copy.deepcopy(self.j.preparation), 'transport_closed': False, 'guardian_started': False,
                         'image_fd_admitted': False, 'execution_authority': False, 'context_only': True}
            elif op == 'channel-close':
                value = None
            else:
                self.fail('No generic shell/API/launch/terminal record frame')
            if op == expire:
                self.registry.current['deadline'] = 0
            self.cap.answer({'id': frame['id'], 'ok': op != fail, 'data': value})
            if op in ('channel-close', fail):
                return

    async def run_prepare(self, fail=None, expire=None):
        pump = asyncio.create_task(self.pump(fail, expire))
        try:
            self.service.pending = asyncio.current_task()
            async with asyncio.timeout(3):
                return await transfer.prepare_ram(self.service, self.owner, self.nonce, self.data)
        finally:
            pump.cancel()
            await asyncio.gather(pump, return_exceptions=True)

    async def test_real_consumption_fixed_frames_private_bytes_and_live_nonterminal_handoff(self):
        handoff = await self.run_prepare()
        self.assertIsInstance(handoff, transfer.PreparedBrowserRam)
        self.assertIs(handoff.capability, self.cap)
        handoff.live()
        self.assertEqual(self.events, ['ram-stream-check', 'initial-trial-preparation', 'ram-prepare', 'ram-chunk', 'ram-complete'])
        self.assertEqual(self.context_reads, 2)
        self.assertFalse(self.cap.closed)
        self.assertNotIn('guardian_body', handoff.packet)
        edited = handoff.packet
        edited['intent_sha256'] = '0' * 64
        self.assertNotEqual(edited, handoff.packet)
        handoff.live()
        with self.assertRaises(TypeError):
            json.dumps(handoff)
        self.assertIsNotNone(self.j.stages.lease_fd)
        self.assertEqual(self.j.manager.status(self.owner, self.j.job)['state'], 'browser_initial_trial_unverified')
        self.assertFalse((self.j.directory / journals.journal.COMPLETE).exists())
        self.usb.assert_not_called()
        with self.assertRaises(Exception):
            self.j.stages.fence_all()
        close = asyncio.create_task(handoff.close())
        frame = await self.cap.poll()
        self.assertEqual(frame['operation'], 'channel-close')
        self.cap.answer({'id': frame['id'], 'ok': True, 'data': None})
        await close
        self.assertIsNotNone(self.j.stages.lease_fd, 'Transport close alone cannot release the trial lease')
        with self.assertRaises(Refusal):
            handoff.live()

    async def test_probe_or_fresh_scope_failure_precedes_consumption(self):
        with self.assertRaises(Refusal):
            await self.run_prepare(fail='ram-stream-check')
        self.assertFalse((self.j.directory / journals.journal.INTENT).exists())
        self.assertEqual(self.operations, ['internal-browser-initial-trial-context'])

    async def test_changed_original_root_refuses_before_packet(self):
        self.bad_scope = True
        with self.assertRaises(Refusal):
            await self.run_prepare()
        self.assertFalse((self.j.directory / journals.journal.INTENT).exists())
        self.assertNotIn('ram-prepare', self.events)

    async def test_lost_packet_and_bad_producer_preserve_consumed_history_without_ram_frame(self):
        self.lost_packet = True
        with self.assertRaises(Refusal):
            await self.run_prepare()
        self.assertTrue((self.j.directory / journals.journal.INTENT).is_file())
        self.assertIsNotNone(self.j.stages.lease_fd)
        self.assertNotIn('ram-prepare', self.events)
        self.assertNotIn('ram-complete', self.events)

    async def test_wrong_packet_fingerprint_never_creates_a_ram_job(self):
        self.bad_packet = True
        with self.assertRaises(Refusal):
            await self.run_prepare()
        self.assertNotIn('ram-prepare', self.events)
        self.assertIsNotNone(self.j.stages.lease_fd)

    async def test_changed_inode_or_lost_transfer_ack_never_closes_as_a_terminal_trial(self):
        self.bad_inode = True
        with self.assertRaises(Refusal):
            await self.run_prepare()
        self.assertEqual(self.events.count('ram-complete'), 1)
        self.assertIsNotNone(self.j.stages.lease_fd)
        self.assertFalse((self.j.directory / journals.journal.COMPLETE).exists())

    async def test_lost_guardian_chunk_ack_is_never_replayed(self):
        with self.assertRaises(Refusal):
            await self.run_prepare(fail='ram-chunk')
        self.assertEqual(self.events.count('ram-chunk'), 1)
        self.assertNotIn('ram-complete', self.events)
        self.assertIsNotNone(self.j.stages.lease_fd)

    async def test_post_readback_sdk_drift_retires_original_channel_and_keeps_lease(self):
        self.changed_context = True
        with self.assertRaises(Refusal):
            await self.run_prepare()
        self.assertTrue(self.cap.closed)
        self.assertIsNotNone(self.j.stages.lease_fd)
        self.assertEqual(self.context_reads, 2)

    async def test_expired_original_registration_never_becomes_a_new_handoff(self):
        with self.assertRaises(Refusal):
            await self.run_prepare(expire='ram-complete')
        self.assertTrue(self.cap.closed)
        self.assertIsNotNone(self.j.stages.lease_fd)

    async def test_foreign_owner_or_extra_command_never_contacts_worker_or_browser(self):
        for owner, data in (('b' * 32, self.data), (self.owner, {**self.data, 'command': 'not admitted'})):
            with self.assertRaises(Refusal):
                await transfer.prepare_ram(self.service, owner, self.nonce, data)
        self.service.exchange.assert_not_awaited()
        self.assertTrue(self.cap.queue.empty())


    async def test_actor_replacement_or_lost_reservation_cannot_adopt_a_live_handoff(self):
        handoff = await self.run_prepare()
        original = self.service.process
        pending = self.service.pending
        self.service.pending = None
        with self.assertRaises(Refusal):
            handoff.live()
        self.service.pending = pending
        self.service.process = SimpleNamespace(returncode=None)
        with self.assertRaises(Refusal):
            handoff.live()
        self.service.process = original
        original.returncode = 0
        with self.assertRaises(Refusal):
            handoff.live()
        original.returncode = None
        self.lock.release()
        with self.assertRaises(Refusal):
            handoff.live()
        await self.lock.acquire()  # Restore only the fixture's cleanup ownership.
        task = asyncio.create_task(handoff.close())
        frame = await self.cap.poll()
        self.cap.answer({'id': frame['id'], 'ok': True, 'data': None})
        await task


    async def test_missing_original_operation_reservation_refuses_before_worker_pipe(self):
        self.service.pending = None
        task = asyncio.create_task(transfer.prepare_ram(self.service, self.owner, self.nonce, self.data))
        frame = await self.cap.poll()
        self.assertEqual(frame['operation'], 'channel-close')
        self.cap.answer({'id': frame['id'], 'ok': True, 'data': None})
        with self.assertRaises(Refusal):
            await task
        self.service.exchange.assert_not_awaited()
        self.assertFalse((self.j.directory / journals.journal.INTENT).exists())


    async def test_json_bool_int_coercion_in_packet_refuses_before_ram_creation(self):
        self.bad_type = True
        with self.assertRaises(Refusal):
            await self.run_prepare()
        self.assertNotIn('ram-prepare', self.events)
        self.assertIsNotNone(self.j.stages.lease_fd)

    def test_fixed_producer_contract_and_typed_comparison(self):
        definition = json.loads((transfer.ROOT / 'initial-ram-contract.json').read_bytes())
        self.assertEqual(definition['producer_files'], list(transfer.PRODUCERS))
        self.assertFalse(transfer.same({'flag': False}, {'flag': 0}))
        self.assertFalse(transfer.same({'value': 1}, {'value': 1.0}))
        self.assertTrue(transfer.same({'a': 1, 'b': 2}, {'b': 2, 'a': 1}))
