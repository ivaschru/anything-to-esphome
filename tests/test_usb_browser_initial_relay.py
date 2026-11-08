"""Original actor/lease/finite frames plus real kernel loopback byte pumps.

All USB, guardian records and payloads are synthetic. The echo proves opaque
transport composition only: no Noise handshake, physical sample, stop timing,
monitor program or terminal journal verifier executes here.
"""
import asyncio
import base64
import importlib.util
import json
import sys
import time
import unittest

import test_usb_browser_initial_api as fixtures

sys.modules.setdefault('qingping_browser_contract.monitor1_browser_initial_api', fixtures.core_api)
spec = importlib.util.spec_from_file_location('qingping_browser_contract.monitor1_browser_initial_relay',
    fixtures.joins.fixtures.readers.fixtures.fixtures.ROOT / 'monitor1_browser_initial_relay.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
Refusal = fixtures.joins.Refusal


class InitialRelayTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.f = fixtures.CoreApiTests(methodName='runTest')
        await self.f.asyncSetUp()
        for function, args, kwargs in self.f._cleanups:
            self.addCleanup(function, *args, **kwargs)
        self.f._cleanups.clear()
        self.b = self.f.f.b
        self.reply = asyncio.Queue()
        self.handlers = set()
        self.handler_errors = []
        self.frames = []
        self.fail_phase = None
        self.replace_actor = False
        self.close_gate = asyncio.Event()
        self.close_gate.set()
        self.writers = []
        self.addAsyncCleanup(self.close_writers)

    async def original_flow(self):
        # unittest setup and test methods are separate tasks. Construct the
        # original continuation in this actual test operation, never rebind it.
        self.running = await self.f.running()
        self.context = await fixtures.core_api.read_initial_api_context(self.running)
        self.pump_task = asyncio.create_task(self.pump())
        self.addAsyncCleanup(self.stop_pump)

    async def close_writers(self):
        for writer in self.writers:
            writer.close()
            await writer.wait_closed()

    async def stop_pump(self):
        self.pump_task.cancel()
        for task in self.handlers:
            task.cancel()
        await asyncio.gather(self.pump_task, *self.handlers, return_exceptions=True)
        self.assertEqual(self.handler_errors, [])

    async def pump(self):
        while True:
            frame = await self.b.cap.poll()
            if frame is None:
                continue
            self.frames.append(frame)
            task = asyncio.create_task(self.answer(frame))
            self.handlers.add(task)
            def completed(done):
                self.handlers.discard(done)
                if not done.cancelled() and done.exception() is not None:
                    self.handler_errors.append(done.exception())
            task.add_done_callback(completed)

    async def answer(self, frame):
        op = frame['operation']
        if op == 'api-read':
            self.assertEqual(frame['data'], {'max_bytes': 65536})
        elif op != 'api-write':
            self.assertIsNone(frame['data'], 'No host, key, PID, command or replacement packet selector')
        if op == 'guardian-scope-observe':
            value = self.f.f.scope_observation()
        elif op == 'guardian-return-observe':
            value = self.f.f.scope_observation()
            process = value.pop('process')
            value.update(kind='browser_initial_return_observation', guardian=process['guardian'],
                         child=process['child'], own_programs_absent=True)
        elif op == 'guardian-finish':
            _, value = self.f.f.records()
        elif op == 'api-open':
            value = None
            if self.replace_actor:
                self.b.service.process = object()
        elif op == 'api-read':
            data = await self.reply.get()
            value = base64.b64encode(data).decode()
        elif op == 'api-write':
            await self.reply.put(base64.b64decode(frame['data'], validate=True))
            value = None
        elif op == 'api-close':
            await self.close_gate.wait()
            await self.reply.put(b'')
            value = None
        elif op == 'channel-close':
            value = None
        else:
            self.fail('Only fixed guardian API/scope/END/close frames belong to this fixture')
        try:
            self.b.cap.answer({'id': frame['id'], 'ok': op != self.fail_phase, 'data': value})
        except Refusal:
            # Negative answers deliberately retire the original capability.
            # The caller receives its own fixed refusal, never a replay grant.
            if op != self.fail_phase and not self.b.cap.closed:
                raise

    async def wait_until(self, condition):
        async with asyncio.timeout(2):
            while not condition():
                await asyncio.sleep(.005)

    async def connect(self, port):
        reader, writer = await asyncio.open_connection('127.0.0.1', port)
        self.writers.append(writer)
        return reader, writer

    async def started(self):
        await self.original_flow()
        relay = module.InitialGuardianApiRelay(self.context)
        port = await relay.start()
        # Always clean the listener even if a following assertion fails. This
        # callback closes only owned host sockets, never a monitor process.
        self.addAsyncCleanup(relay.relay.close)
        return relay, port

    def assert_fenced(self):
        self.assertIsNotNone(self.b.j.stages.lease_fd)
        self.assertFalse((self.b.j.directory / fixtures.journals.journal.COMPLETE).exists())
        self.b.usb.assert_not_called()

    async def test_original_loopback_scope_and_independent_api_end_usb_closes(self):
        relay, port = await self.started()
        self.assertEqual(relay.deadline, min(self.running.issued_at + 50, self.b.registry.current['deadline']))
        self.assertEqual(relay.relay.deadline, relay.deadline)
        reader, writer = await self.connect(port)
        body = b'synthetic opaque ciphertext, not a Noise handshake'
        writer.write(body)
        await writer.drain()
        self.assertEqual(await asyncio.wait_for(reader.readexactly(len(body)), 2), body)
        await self.wait_until(lambda: 'api-read' in self.b.cap.pending_operations.values())
        scope = await self.running.observe_scope()
        self.assertTrue(scope['context_only'])
        # A complete scope read must not kill the pending opaque read.
        writer.write(b'next')
        await writer.drain()
        self.assertEqual(await asyncio.wait_for(reader.readexactly(4), 2), b'next')
        self.close_gate.clear()
        # close() belongs to the original task, so use a helper only to release
        # the simulated browser ACK and inspect that cleanup hasn't completed.
        async def release():
            await self.wait_until(lambda: any(f['operation'] == 'api-close' for f in self.frames))
            self.assertFalse(relay._cleanup.done())
            self.assertFalse(self.b.cap.closed)
            self.close_gate.set()
        release_task = asyncio.create_task(release())
        try:
            proof = await relay.close()
        finally:
            await release_task
        self.assertEqual(proof, {'api_closed': True, 'transport_closed': False, 'context_only': True})
        self.assertEqual(await relay.close(), proof, 'One shared actual cleanup result, not another frame')
        self.assertEqual(sum(f['operation'] == 'api-close' for f in self.frames), 1)
        self.assertFalse(self.b.cap.closed)
        self.assertFalse(self.b.cap.opened)
        self.assert_fenced()
        result = await self.running.finish_records()
        self.assertTrue(result['records_only'])
        await self.running.close()
        self.assertTrue(self.b.cap.closed)
        self.assertEqual(self.frames[-1]['operation'], 'channel-close')
        self.assert_fenced()
        profile = json.loads((self.b.j.directory / 'profile.json').read_bytes())
        self.assertNotIn(profile['api_encryption_key'], json.dumps(self.frames))

    async def test_foreign_task_or_copy_cannot_start_or_borrow_owned_pumps(self):
        await self.original_flow()
        with self.assertRaises(Refusal):
            module.InitialGuardianApiRelay({'identity': self.context.identity})
        async def foreign_constructor():
            return module.InitialGuardianApiRelay(self.context)
        with self.assertRaises(Refusal):
            await asyncio.create_task(foreign_constructor())
        relay = module.InitialGuardianApiRelay(self.context)
        with self.assertRaises(Refusal):
            await asyncio.create_task(relay.start())
        with self.assertRaises(Refusal):
            module.InitialGuardianApiRelay(self.context)
        port = await relay.start()
        self.addAsyncCleanup(relay.relay.close)
        with self.assertRaises(Refusal):
            await asyncio.create_task(relay.relay.channel.open_api())
        self.assertFalse(any(f['operation'] == 'api-open' for f in self.frames))
        await relay.close()
        await self.running.close()
        self.assert_fenced()

    async def test_lost_api_close_ack_retires_original_transport_without_reopen(self):
        relay, port = await self.started()
        reader, writer = await self.connect(port)
        writer.write(b'x')
        await writer.drain()
        self.assertEqual(await asyncio.wait_for(reader.readexactly(1), 2), b'x')
        self.fail_phase = 'api-close'
        with self.assertRaises(Refusal):
            await relay.close()
        self.assertTrue(self.b.cap.closed)
        self.assertTrue(relay.relay.failed)
        self.assertEqual(sum(f['operation'] == 'api-open' for f in self.frames), 1)
        with self.assertRaises(Refusal):
            await relay.start()
        self.assertFalse(any(f['operation'] == 'guardian-finish' for f in self.frames))
        self.assert_fenced()

    async def test_late_open_after_actor_replacement_cannot_be_adopted(self):
        relay, port = await self.started()
        self.replace_actor = True
        reader, _ = await self.connect(port)
        self.assertEqual(await asyncio.wait_for(reader.read(), 2), b'')
        await self.wait_until(lambda: relay.relay.active is None)
        self.assertTrue(self.b.cap.closed)
        with self.assertRaises(Refusal):
            await relay.close()
        self.assertEqual(sum(f['operation'] == 'api-open' for f in self.frames), 1)
        self.assert_fenced()

    async def test_expired_observer_cannot_reopen_or_claim_usb_closed(self):
        relay, port = await self.started()
        reader, writer = await self.connect(port)
        writer.write(b'x')
        await writer.drain()
        self.assertEqual(await asyncio.wait_for(reader.readexactly(1), 2), b'x')
        relay.deadline = time.monotonic() - 1  # Synthetic clock expiry only.
        with self.assertRaises(Refusal):
            await relay.close()
        self.assertTrue(self.b.cap.closed)
        self.assert_fenced()
