"""Real consumed actor/journal/registry join with synthetic guardian records.

No guardian, monitor code, ADB or physical USB executes. The real host fsync/
flock and finite channel are retained across RAM/start/end/close; records never
release that lease or create a terminal trial result.
"""
import asyncio
import copy
import importlib.util
import json
import sys
import unittest
from unittest.mock import AsyncMock, patch

import test_usb_browser_initial_ram as fixtures

sys.modules.setdefault('qingping_browser_contract.monitor1_browser_initial_ram', fixtures.transfer)
spec = importlib.util.spec_from_file_location('qingping_browser_contract.monitor1_browser_initial_guardian',
    fixtures.readers.fixtures.fixtures.ROOT / 'monitor1_browser_initial_guardian.py')
guardian = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guardian)
Refusal = fixtures.Refusal


class InitialGuardianJoinTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.b = fixtures.InitialRamTransferTests(methodName='runTest')
        await self.b.asyncSetUp()
        # A manually-created IsolatedAsyncioTestCase has no asyncio runner.
        # Its doCleanups would suppress runner-assertion failures and leak the
        # nested class-level journal mocks into later tests. Register the
        # actual cleanup callbacks on this running case, preserving LIFO.
        for function, args, kwargs in self.b._cleanups:
            self.addCleanup(function, *args, **kwargs)
        self.b._cleanups.clear()
        self.fail_phase = self.expire_phase = self.drift_phase = None

    def records(self):
        nonce = self.b.prepared['nonce']
        start = {'kind': 'start', 'nonce': nonce, 'stamp': [123, str(2**64 - 1)]}
        child = {'kind': 'child', 'nonce': nonce, 'stamp': [124, '456']}
        first = {'kind': 'browser_initial_guardian_started_record', 'start': start, 'child': child, 'records_only': True}
        end = {'kind': 'end', 'nonce': nonce, 'guardian': copy.deepcopy(start['stamp']), 'child': copy.deepcopy(child['stamp']),
               'elapsed_ms': 60000, 'reaped': True, 'protection_ack': True, 'term_sent': True, 'forced': False, 'wait_status': 15}
        last = {'kind': 'browser_initial_guardian_records', 'start': copy.deepcopy(start), 'child': copy.deepcopy(child),
                'end': end, 'raw_closed': True, 'transport_closed': False, 'records_only': True}
        return first, last

    async def pump(self):
        while True:
            frame = await self.b.cap.poll()
            if frame is None: continue
            op = frame['operation']
            self.b.events.append(op)
            self.assertIsNone(frame['data'], 'No replacement packet, command or PID selector crosses these frames')
            first, last = self.records()
            if op == 'guardian-start': value = first
            elif op == 'guardian-finish': value = last
            elif op == 'channel-close': value = None
            else: self.fail('No public/generic writer, API or observer exists in this fixture')
            if op == self.expire_phase: self.b.registry.current['deadline'] = 0
            if op == self.drift_phase: self.b.changed_context = True
            self.b.cap.answer({'id': frame['id'], 'ok': op != self.fail_phase, 'data': value})
            if op in ('channel-close', self.fail_phase): return

    async def run_pumped(self, action):
        pump = asyncio.create_task(self.pump())
        try:
            async with asyncio.timeout(3): return await action()
        finally:
            pump.cancel()
            await asyncio.gather(pump, return_exceptions=True)

    async def test_original_live_join_brackets_records_with_sdk_and_keeps_consumed_lease(self):
        ram = await self.b.run_prepare()
        running = await self.run_pumped(lambda: guardian.start_guardian(ram))
        self.assertIsInstance(running, guardian.RunningBrowserGuardian)
        self.assertEqual(self.b.context_reads, 4)
        running.live()
        self.assertGreater(running.issued_at, 0)
        edited = running.reported_start
        edited['start']['stamp'][1] = '1'
        self.assertEqual(running.reported_start['start']['stamp'][1], str(2**64 - 1))
        with self.assertRaises(TypeError): json.dumps(running)
        with self.assertRaises(Refusal): await guardian.start_guardian(ram)
        self.assertEqual(self.b.events.count('guardian-start'), 1)
        value = await self.run_pumped(running.finish_records)
        self.assertTrue(value['records_only'])
        self.assertFalse(value['transport_closed'])
        self.assertEqual(self.b.context_reads, 5)
        with self.assertRaises(Refusal): await running.finish_records()
        self.assertEqual(self.b.events.count('guardian-finish'), 1)
        await self.run_pumped(running.close)
        self.assertTrue(self.b.cap.closed)
        self.assertIsNotNone(self.b.j.stages.lease_fd)
        self.assertFalse((self.b.j.directory / fixtures.journals.journal.COMPLETE).exists())
        self.assertEqual(self.b.j.manager.status(self.b.owner, self.b.j.job)['state'], 'browser_initial_trial_unverified')
        self.b.usb.assert_not_called()

    async def test_serialized_or_foreign_task_handoff_never_reads_sdk_or_launches(self):
        ram = await self.b.run_prepare()
        reads = self.b.context_reads
        with self.assertRaises(Refusal): await guardian.start_guardian(ram.packet)
        with self.assertRaises(Refusal): await asyncio.create_task(guardian.start_guardian(ram))
        self.assertEqual(self.b.context_reads, reads)
        self.assertNotIn('guardian-start', self.b.events)
        ram.live()
        await self.run_pumped(ram.close)

    async def test_changed_sdk_before_start_consumes_continuation_but_never_launches(self):
        ram = await self.b.run_prepare()
        self.b.changed_context = True
        with self.assertRaises(Refusal): await self.run_pumped(lambda: guardian.start_guardian(ram))
        self.assertNotIn('guardian-start', self.b.events)
        self.assertTrue(self.b.cap.closed)
        self.assertIsNotNone(self.b.j.stages.lease_fd)

    async def test_changed_sdk_after_start_closes_without_replay_or_terminal_result(self):
        ram = await self.b.run_prepare()
        self.drift_phase = 'guardian-start'
        with self.assertRaises(Refusal): await self.run_pumped(lambda: guardian.start_guardian(ram))
        self.assertEqual(self.b.events.count('guardian-start'), 1)
        self.assertNotIn('guardian-finish', self.b.events)
        self.assertTrue(self.b.cap.closed)
        self.assertIsNotNone(self.b.j.stages.lease_fd)

    async def test_lost_start_ack_preserves_original_attempt_and_cannot_be_replayed(self):
        ram = await self.b.run_prepare()
        self.fail_phase = 'guardian-start'
        with self.assertRaises(Refusal): await self.run_pumped(lambda: guardian.start_guardian(ram))
        self.assertEqual(self.b.events.count('guardian-start'), 1)
        self.assertTrue(self.b.cap.closed)
        with self.assertRaises(Refusal): await guardian.start_guardian(ram)
        self.assertIsNotNone(self.b.j.stages.lease_fd)

    async def test_expired_original_capability_cannot_adopt_reported_start(self):
        ram = await self.b.run_prepare()
        self.expire_phase = 'guardian-start'
        with self.assertRaises(Refusal): await self.run_pumped(lambda: guardian.start_guardian(ram))
        self.assertTrue(self.b.cap.closed)
        self.assertIsNotNone(self.b.j.stages.lease_fd)

    async def test_stock_pid_collision_is_refused_by_core_join_too(self):
        ram = await self.b.run_prepare()
        first, _ = self.records()
        first['child']['stamp'][0] = ram.packet['context']['committed_scope']['stock_process'][0]
        with patch.object(self.b.cap, 'start_initial_guardian', AsyncMock(return_value=first)):
            with self.assertRaises(Refusal): await self.run_pumped(lambda: guardian.start_guardian(ram))
        self.assertTrue(self.b.cap.closed)
        self.assertIsNotNone(self.b.j.stages.lease_fd)

    async def test_post_end_sdk_drift_never_releases_lease(self):
        ram = await self.b.run_prepare()
        running = await self.run_pumped(lambda: guardian.start_guardian(ram))
        self.drift_phase = 'guardian-finish'
        with self.assertRaises(Refusal): await self.run_pumped(running.finish_records)
        self.assertEqual(self.b.events.count('guardian-finish'), 1)
        self.assertTrue(self.b.cap.closed)
        self.assertIsNotNone(self.b.j.stages.lease_fd)
        self.assertFalse((self.b.j.directory / fixtures.journals.journal.COMPLETE).exists())

    async def test_lost_end_ack_never_releases_or_replays_original_attempt(self):
        ram = await self.b.run_prepare()
        running = await self.run_pumped(lambda: guardian.start_guardian(ram))
        self.fail_phase = 'guardian-finish'
        with self.assertRaises(Refusal): await self.run_pumped(running.finish_records)
        self.assertEqual(self.b.events.count('guardian-finish'), 1)
        self.assertTrue(self.b.cap.closed)
        self.assertIsNotNone(self.b.j.stages.lease_fd)
        with self.assertRaises(Refusal): await running.finish_records()

    async def test_replaced_actor_cannot_finish_or_adopt_the_original_running_object(self):
        ram = await self.b.run_prepare()
        running = await self.run_pumped(lambda: guardian.start_guardian(ram))
        self.b.service.process = object()
        with self.assertRaises(Refusal): await running.finish_records()
        self.assertNotIn('guardian-finish', self.b.events)
        self.assertIsNotNone(self.b.j.stages.lease_fd)
        await self.run_pumped(running.close)
