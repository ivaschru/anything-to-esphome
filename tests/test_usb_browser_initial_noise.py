"""Pure generation policy plus real HA Noise through the finite USB relay.

The peer and USB device are synthetic and the observation clock is accelerated
only inside this test module. These checks do not run a monitor/guardian or
qualify its physical samples, timer or first installation. The actual host
terminal journal verifier/fsync/flock are exercised with synthetic device IO.
"""
import asyncio
import base64
import copy
from dataclasses import dataclass
import importlib.util
import json
import math
import struct
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import test_usb_browser_initial_relay as fixtures

sys.modules.setdefault('qingping_browser_contract.monitor1_browser_initial_relay', fixtures.module)
spec = importlib.util.spec_from_file_location('qingping_browser_contract.monitor1_browser_initial_noise',
    fixtures.fixtures.joins.fixtures.readers.fixtures.fixtures.ROOT / 'monitor1_browser_initial_noise.py')
module = importlib.util.module_from_spec(spec)
sys.modules.setdefault(spec.name, module)
spec.loader.exec_module(module)
Refusal = fixtures.Refusal


@dataclass
class SensorInfo:
    key: int
    object_id: str
    device_id: int = 0


@dataclass
class SensorState:
    key: int
    state: float
    missing_state: bool = False
    device_id: int = 0


class GenerationTests(unittest.TestCase):
    def setUp(self):
        self.entities = [SensorInfo(i + 1, name) for i, name in enumerate(module.REQUIRED)]
        self.clock = 100.0
        clock_patch = patch.object(module, '_now', lambda: self.clock)
        clock_patch.start()
        self.addCleanup(clock_patch.stop)
        self.samples = module._WireSamples(self.entities)
        self.values = [600., 22., 45., .145, 1.]

    def emit(self, indices=range(5)):
        for i in indices:
            self.samples.received(SensorState(i + 1, self.values[i]))

    def test_equal_values_need_independent_new_messages_for_every_physical_field_and_ten_seconds(self):
        self.emit()
        self.assertTrue(self.samples.accept(self.clock))
        self.clock += 10
        self.assertFalse(self.samples.accept(self.clock), 'Cached reads are not new wire generations')
        self.emit(range(3))
        self.assertFalse(self.samples.accept(self.clock), 'Every physical field must advance')
        self.emit((3, 4))
        self.assertTrue(self.samples.accept(self.clock))
        self.clock += 9.999
        self.emit()
        self.assertFalse(self.samples.accept(self.clock))
        self.clock += .001
        self.assertTrue(self.samples.accept(self.clock))
        self.assertEqual(self.samples.samples, 3)

    def test_ambiguous_metadata_or_display_subdevice_is_not_a_physical_source(self):
        for entities in (self.entities[:-1], self.entities + [SensorInfo(90, 'co2')],
                         self.entities + [SensorInfo(1, 'unrelated')],
                         [SensorInfo(1, 'co2', device_id=1), *self.entities[1:]]):
            with self.subTest(entities=entities), self.assertRaises(Refusal):
                module._WireSamples(entities)

    def test_nonfinite_sentinel_range_and_missing_states_refuse(self):
        for index, value in ((0, 0), (0, 99999), (0, math.nan), (1, math.inf),
                             (2, -1), (2, 101), (3, -1), (4, -1), (4, 30), (4, True)):
            samples = module._WireSamples(self.entities)
            for i, normal in enumerate(self.values):
                samples.received(SensorState(i + 1, value if i == index else normal))
            self.assertFalse(samples.accept(self.clock), (index, value))
        self.emit()
        self.samples.received(SensorState(1, 600., missing_state=True))
        self.assertFalse(self.samples.accept(self.clock))

    def test_stale_stock_age_or_wire_never_becomes_fresh_from_scope_or_cache(self):
        self.emit()
        self.clock += 21
        self.emit(range(4))
        self.assertFalse(self.samples.accept(self.clock))
        self.emit((4,))
        self.assertTrue(self.samples.accept(self.clock))
        self.clock += 21
        self.emit((4,))
        self.assertFalse(self.samples.accept(self.clock))


HAS_API = importlib.util.find_spec('aioesphomeapi') is not None


@unittest.skipUnless(HAS_API, 'Actual aioesphomeapi SDK required')
class SdkDisconnectContractTests(unittest.IsolatedAsyncioTestCase):
    async def test_actual_sdk_public_force_disconnect_without_socket_or_graceful_request(self):
        from aioesphomeapi import APIClient
        # Even an unconnected real client reproduces the old46.3 AttributeError.
        # No network edge or invented APIClient double can hide that mismatch.
        client = APIClient('127.0.0.1', 16053, None)
        await module._disconnect(client)


@unittest.skipUnless(HAS_API, 'Actual HA aioesphomeapi/Noise SDK required')
class EncryptedObserverTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.f = fixtures.InitialRelayTests(methodName='runTest')
        await self.f.asyncSetUp()
        for function, args, kwargs in self.f._cleanups:
            self.addCleanup(function, *args, **kwargs)
        self.f._cleanups.clear()
        self.peer_writers, self.peer_tasks, self.peer_errors = [], set(), []
        self.raw_frames, self.protocol, self.peer_writer = [], None, None
        self.remote_reader = self.remote_writer = None
        self.wrong_identity = False
        self.api_open_delay = 0
        self.api_read_delay = 0
        self.subscribed = False
        self.subscription_seen = asyncio.Event()
        self.wire_changed = asyncio.Event()
        self.wire_samples = None
        self.wire_callbacks = {name: 0 for name in module.REQUIRED}
        fixture = self

        class ObservedWireSamples(module._WireSamples):
            """Observe actual SDK callbacks without replacing their validation.

            The synthetic clock must not outrun the real encrypted TCP/frame
            pipeline. Count only callbacks delivered to the production reader;
            sending bytes or sleeping briefly does not prove their reception.
            """
            def __init__(self, entities):
                super().__init__(entities)
                fixture.wire_samples = self

            def received(self, state):
                super().received(state)
                name = self.names.get(state.key)
                if type(state).__name__ == 'SensorState' and name in fixture.wire_callbacks:
                    fixture.wire_callbacks[name] += 1
                    fixture.wire_changed.set()

        wire_patch = patch.object(module, '_WireSamples', ObservedWireSamples)
        wire_patch.start()
        self.addCleanup(wire_patch.stop)
        self.composed_end_at = None
        self.base_answer = self.f.answer
        self.base_exchange = self.f.f.exchange
        self.f.f.f.b.service.exchange.side_effect = self.exchange
        self.terminal_calls = 0
        self.lose_terminal_reply = False
        self.f.answer = self.answer

    async def exchange(self, owner, nonce, operation, data):
        if operation != 'internal-browser-initial-trial-record':
            return await self.base_exchange(owner, nonce, operation, data)
        self.terminal_calls += 1
        self.assertTrue(self.f.b.cap.closed)
        self.assertEqual(self.f.frames[-1]['operation'], 'channel-close')
        self.assertIsNotNone(self.f.b.j.stages.lease_fd)
        body, mime = self.f.b.actor.dispatch({'user': owner, 'nonce': nonce, 'operation': operation, 'data': data})
        if self.lose_terminal_reply:
            raise OSError('Synthetic private response loss after immutable record')
        return True, mime, json.dumps(body).encode()

    async def flow(self, prepared_only=False):
        if prepared_only:
            # Prepare the actual original RAM grant in this test operation, then
            # let the production coordinator start/read/observe/stop/record it.
            # Only browser USB replies and time are simulated, not continuations.
            self.ram = await self.f.b.run_prepare()
            self.clock = module._now() + .5
            self.identity = copy.deepcopy(self.ram.packet['context']['api_identity'])
            self.key = json.loads((self.f.b.j.directory / 'profile.json').read_bytes())['api_encryption_key']
            self.f.pump_task = asyncio.create_task(self.f.pump())
            self.addAsyncCleanup(self.f.stop_pump)
        else:
            await self.f.original_flow()
            self.clock = self.f.running.issued_at + .5
            self.identity = self.f.context.identity
            self.key = self.f.context._noise_psk  # Synthetic fixture key, never a device secret.
        self.server = await asyncio.start_server(self.accept, '127.0.0.1', 0)
        self.addAsyncCleanup(self.stop_server)

    async def stop_server(self):
        self.server.close()
        for writer in self.peer_writers:
            writer.close()
        if self.remote_writer is not None:
            self.remote_writer.close()
        await self.server.wait_closed()
        if self.peer_tasks:
            await asyncio.wait_for(asyncio.gather(*self.peer_tasks, return_exceptions=True), 2)
        self.assertEqual(self.peer_errors, [])

    def accept(self, reader, writer):
        self.peer_writers.append(writer)
        task = asyncio.create_task(self.peer(reader, writer))
        self.peer_tasks.add(task)
        task.add_done_callback(self.peer_tasks.discard)

    async def peer(self, reader, writer):
        from noise.connection import NoiseConnection
        from aioesphomeapi import api_pb2 as p
        try:
            async def frame():
                header = await reader.readexactly(3)
                self.assertEqual(header[0], 1)
                body = await reader.readexactly(int.from_bytes(header[1:], 'big'))
                self.raw_frames.append(body)
                return body

            async def raw(body):
                writer.write(b'\1' + struct.pack('>H', len(body)) + body)
                await writer.drain()

            self.assertEqual(await frame(), b'')
            await raw(b'\1' + self.identity['node_name'].encode() + b'\0')
            protocol = NoiseConnection.from_name(b'Noise_NNpsk0_25519_ChaChaPoly_SHA256')
            protocol.set_as_responder()
            protocol.set_psks(base64.b64decode(self.key))
            protocol.set_prologue(b'NoiseAPIInit\0\0')
            protocol.start_handshake()
            first = await frame()
            self.assertEqual(first[0], 0)
            protocol.read_message(first[1:])
            await raw(b'\0' + bytes(protocol.write_message()))
            self.protocol, self.peer_writer = protocol, writer
            while True:
                plain = bytes(protocol.decrypt(await frame()))
                kind, size = struct.unpack('>HH', plain[:4])
                self.assertEqual(len(plain[4:]), size)
                if kind == 1:
                    await self.send(2, p.HelloResponse(api_version_major=1, api_version_minor=10,
                                                    name=self.identity['node_name'], server_info='fixture'))
                elif kind == 3:
                    await self.send(4, p.AuthenticationResponse())
                elif kind == 9:
                    await self.send(10, p.DeviceInfoResponse(name='wrong-node' if self.wrong_identity else self.identity['node_name'],
                                                           mac_address=self.identity['api_mac']))
                elif kind == 11:
                    for i, name in enumerate(module.REQUIRED):
                        await self.send(16, p.ListEntitiesSensorResponse(key=i + 1, object_id=name, name=name))
                    await self.send(19, p.ListEntitiesDoneResponse())
                elif kind == 20:
                    self.subscribed = True
                    self.subscription_seen.set()
                    await self.vector()
                elif kind == 7:
                    await self.send(8, p.PingResponse())
                elif kind == 5:
                    await self.send(6, p.DisconnectResponse())
                    return
                else:
                    self.fail('Unexpected non-read API message in synthetic Noise peer')
        except asyncio.IncompleteReadError:
            pass  # Owned client cleanup can close before a protocol disconnect.
        except BaseException as error:
            self.peer_errors.append(error)
        finally:
            writer.close()
            await writer.wait_closed()

    async def send(self, kind, message):
        payload = message.SerializeToString()
        body = bytes(self.protocol.encrypt(struct.pack('>HH', kind, len(payload)) + payload))
        self.peer_writer.write(b'\1' + struct.pack('>H', len(body)) + body)
        await self.peer_writer.drain()

    async def vector(self):
        from aioesphomeapi import api_pb2 as p
        for i, value in enumerate((600., 22., 45., .145, 1.)):
            await self.send(25, p.SensorStateResponse(key=i + 1, state=value))

    async def fast_wait(self, seconds):
        if self.wire_samples is None:
            # Connection retry precedes subscription. Do not manufacture any
            # sensor callbacks or hide a missing real encrypted connection.
            self.clock += seconds
            await asyncio.sleep(.01)
            return
        async with asyncio.timeout(3):
            await self.subscription_seen.wait()
            await self.await_wire({name: 1 for name in module.REQUIRED})
            self.clock += seconds
            expected = {name: count + 1 for name, count in self.wire_callbacks.items()}
            await self.vector()
            await self.await_wire(expected)
        # Only test observation time advances. Actual Noise, loopback, finite
        # frames, production callbacks and the relay deadline use real asyncio.
        # The next virtual tick is allowed only after this full vector arrived.

    async def await_wire(self, expected):
        while True:
            self.wire_changed.clear()
            if all(self.wire_callbacks[name] >= count for name, count in expected.items()):
                return
            await self.wire_changed.wait()

    async def answer(self, frame):
        op = frame['operation']
        if op == 'guardian-start':
            first, _ = self.f.f.f.records()
            self.f.b.cap.answer({'id': frame['id'], 'ok': True, 'data': first})
            return
        if op == 'guardian-finish' and self.composed_end_at is not None:
            self.clock = self.composed_end_at  # Test-only device wait; no production sleep/clock override.
        if op not in ('api-open', 'api-read', 'api-write', 'api-close'):
            return await self.base_answer(frame)
        if op == 'api-open':
            if self.api_open_delay: await asyncio.sleep(self.api_open_delay)
            self.assertIsNone(frame['data'])
            self.remote_reader, self.remote_writer = await asyncio.open_connection(
                '127.0.0.1', self.server.sockets[0].getsockname()[1])
            value = None
        elif op == 'api-read':
            self.assertEqual(frame['data'], {'max_bytes': 65536})
            if self.api_read_delay:
                await asyncio.sleep(self.api_read_delay)
            value = base64.b64encode(await self.remote_reader.read(65536)).decode()
        elif op == 'api-write':
            self.remote_writer.write(base64.b64decode(frame['data'], validate=True))
            await self.remote_writer.drain()
            value = None
        else:
            self.assertIsNone(frame['data'])
            self.remote_writer.close()
            await self.remote_writer.wait_closed()
            value = None
        try:
            self.f.b.cap.answer({'id': frame['id'], 'ok': True, 'data': value})
        except Refusal:
            if not self.f.b.cap.closed:
                raise  # Only an already-retired late read answer is disposable.

    async def test_complete_scope_before_socket_open_can_spend_more_than_two_seconds(self):
        # The real Native channel repeats a complete fixed scope (up to 5s)
        # before tcp:6053 OPEN. Model 2.2s of that prerequisite, not a lost ACK.
        # Production's 30s connect/50s observation and device 60s limit remain.
        self.api_open_delay = 2.2
        await self.test_real_sdk_noise_generations_use_original_relay_and_leave_end_usb_separate()

    async def test_delayed_real_noise_callbacks_do_not_race_the_accelerated_test_clock(self):
        # Six old fixed10ms sleeps could elapse before one real read delivered
        # its encrypted vector. That reproduced a last wire age of25.5s at END
        # and the correct production refusal. Wait for actual callbacks instead
        # of weakening the20s freshness gate or changing the device60s timer.
        self.api_read_delay = .06
        await self.test_real_sdk_noise_generations_use_original_relay_and_leave_end_usb_separate()

    async def test_real_sdk_noise_generations_use_original_relay_and_leave_end_usb_separate(self):
        await self.flow()
        with patch.object(module, '_now', lambda: self.clock), patch.object(module, '_wait', self.fast_wait):
            result = await module.observe_initial_noise(self.f.context)
        self.assertGreaterEqual(result.reported['samples'], 2)
        self.assertTrue(result.reported['context_only'])
        self.assertFalse(result.reported['transport_closed'])
        self.assertTrue(result.reported['api_closed'])
        self.assertIsNone(self.f.context._noise_psk)
        self.assertFalse(self.f.b.cap.closed)
        self.assertFalse(self.f.b.cap.opened)
        self.assertLessEqual(self.clock - result._last_sample_at, 20)
        with self.assertRaises(TypeError):
            json.dumps(result)
        with self.assertRaises(Refusal):
            await module.observe_initial_noise(self.f.context)
        self.assertEqual(sum(frame['operation'] == 'api-open' for frame in self.f.frames), 1)
        self.assertNotIn(self.key, json.dumps(self.f.frames))
        self.assertNotIn(base64.b64decode(self.key), b''.join(self.raw_frames))
        self.f.assert_fenced()
        with patch.object(fixtures.fixtures.joins.guardian, 'time', SimpleNamespace(monotonic=lambda: self.f.running.issued_at + 60)):
            await self.f.running.finish_records()
            returned = await self.f.running.observe_return()
        self.assertTrue(returned['own_programs_absent'])
        self.assertTrue(returned['context_only'])
        self.assertFalse(self.f.b.cap.closed, 'Actual USB closure remains independent')
        with self.assertRaises(Refusal):
            await self.f.running.observe_return()
        self.assertEqual(sum(frame['operation'] == 'guardian-return-observe' for frame in self.f.frames), 1)
        closed = await self.f.running.close_return_transport()
        self.assertTrue(closed.reported['transport_closed'])
        self.assertTrue(closed.reported['channel_closed'])
        self.assertTrue(self.f.b.cap.closed)
        with self.assertRaises(TypeError):
            json.dumps(closed)
        async def other_task():
            return closed.reported
        with self.assertRaises(Refusal):
            await asyncio.create_task(other_task())
        with self.assertRaises(Refusal):
            await self.f.running.close_return_transport()
        with self.assertRaises(Refusal):
            await asyncio.create_task(closed.record())
        self.assertEqual(self.terminal_calls, 0, 'A new task cannot write the terminal actor journal')
        status = await closed.record()
        self.assertEqual(status['state'], 'browser_initial_trial_stopped_observed')
        self.assertFalse(status['installed'])
        self.assertIsNone(self.f.b.j.stages.lease_fd)
        self.assertTrue((self.f.b.j.directory / fixtures.fixtures.journals.journal.COMPLETE).is_file())
        with self.assertRaises(Refusal):
            await closed.record()
        self.assertEqual(self.terminal_calls, 1)
        journal = fixtures.fixtures.journals.journal
        intent = json.loads((self.f.b.j.directory / journal.INTENT).read_bytes())
        complete = json.loads((self.f.b.j.directory / journal.COMPLETE).read_bytes())
        original = complete['proof']
        # Exercise the ACTUAL independent actor verifier with copies only. No
        # real history is rewritten; each forged scalar must preserve refusal.
        edits = [
            lambda p: p.update(extra=True), lambda p: p.update(channel_closed=1),
            lambda p: p.update(core_elapsed_at_end_ms=59999),
            lambda p: p['wire'].update(samples=1), lambda p: p['wire'].update(samples=True),
            lambda p: p['wire'].update(last_sample_age_at_reap_s=21),
            lambda p: p['wire']['identity'].update(node_name='wrong-node'),
            lambda p: p['records'].update(raw_closed=1),
            lambda p: p['records']['end'].update(reaped=False),
            lambda p: p['records']['end'].update(forced=True),
            lambda p: p['records']['end'].update(wait_status=9),
            lambda p: p['records']['end'].update(elapsed_ms=59999),
            lambda p: p['records']['end']['guardian'].__setitem__(0, 123.0),
            lambda p: p['returned'].update(own_programs_absent=1),
            lambda p: p['returned']['ram_root_identity'].__setitem__(0, 7.0),
            lambda p: p['returned']['guardian'].__setitem__(0, 123.0),
            lambda p: p['returned']['stock_process'].__setitem__(1, '999'),
            lambda p: p['returned'].update(memory_free_bytes=1),
            lambda p: p['transport'].update(transport_closed=1),
            lambda p: p['transport']['observation']['guardian'].__setitem__(0, 123.0)]
        for key in original['binding']:
            edits.append(lambda p, key=key: p['binding'].__setitem__(key, 'wrong-binding'))
        for edit in edits:
            altered = copy.deepcopy(original); edit(altered)
            with self.subTest(edit=edits.index(edit)), self.assertRaises(Exception):
                journal.BrowserInitialTrials._proof(intent, complete['intent_sha256'], altered)
        self.assertEqual(self.f.b.j.manager.status(self.f.b.owner, self.f.b.j.job)['state'], status['state'])

    async def test_immediate_reported_end_never_qualifies_a_real_stop(self):
        await self.flow()
        with patch.object(module, '_now', lambda: self.clock), patch.object(module, '_wait', self.fast_wait):
            await module.observe_initial_noise(self.f.context)
        # The synthetic raw parser can immediately report elapsed_ms=60000;
        # Core's real monotonic observation must not accept that as 60s.
        await self.f.running.finish_records()
        with self.assertRaises(Refusal):
            await self.f.running.observe_return()
        self.assertTrue(self.f.b.cap.closed)
        self.assertFalse(any(frame['operation'] == 'guardian-return-observe' for frame in self.f.frames))
        self.f.assert_fenced()

    async def test_stale_wire_at_end_never_reads_or_completes_return_scope(self):
        await self.flow()
        with patch.object(module, '_now', lambda: self.clock), patch.object(module, '_wait', self.fast_wait):
            await module.observe_initial_noise(self.f.context)
        with patch.object(fixtures.fixtures.joins.guardian, 'time', SimpleNamespace(monotonic=lambda: self.f.running.issued_at + 70)):
            await self.f.running.finish_records()
            with self.assertRaises(Refusal):
                await self.f.running.observe_return()
        self.assertTrue(self.f.b.cap.closed)
        self.assertFalse(any(frame['operation'] == 'guardian-return-observe' for frame in self.f.frames))
        self.f.assert_fenced()

    async def stopped_returned(self):
        await self.flow()
        with patch.object(module, '_now', lambda: self.clock), patch.object(module, '_wait', self.fast_wait):
            await module.observe_initial_noise(self.f.context)
        with patch.object(fixtures.fixtures.joins.guardian, 'time', SimpleNamespace(monotonic=lambda: self.f.running.issued_at + 60)):
            await self.f.running.finish_records()
            await self.f.running.observe_return()

    async def test_lost_terminal_response_preserves_verified_history_and_never_repeats_record(self):
        await self.stopped_returned()
        closed = await self.f.running.close_return_transport()
        self.lose_terminal_reply = True
        with self.assertRaises(Refusal):
            await closed.record()
        self.assertEqual(self.terminal_calls, 1)
        self.assertIsNone(self.f.b.j.stages.lease_fd)
        journal = fixtures.fixtures.journals.journal
        stored = json.loads((self.f.b.j.directory / journal.COMPLETE).read_bytes())
        self.assertEqual(self.f.b.j.manager.status(self.f.b.owner, self.f.b.j.job)['state'],
                         'browser_initial_trial_stopped_observed')
        with self.assertRaises(Refusal):
            await closed.record()
        self.assertEqual(self.terminal_calls, 1)
        fresh = fixtures.fixtures.journals.fixtures.commits.fixtures.stage.BrowserStages(self.f.b.j.stages.plans)
        other = journal.BrowserInitialTrials(fresh)
        self.assertEqual(other.status(self.f.b.owner, self.f.b.j.job)['state'], 'browser_initial_trial_stopped_observed')
        with self.assertRaises(Exception):
            other.record(self.f.b.owner, self.f.b.j.job, stored['intent_sha256'], stored['proof'])
        self.assertIsNone(fresh.lease_fd, 'Historical status does not adopt a lease')
        self.f.b.j.stages.fence_all()  # Valid original history no longer counts as uncertain.

    async def test_actual_usb_close_loss_keeps_unknown_journal_and_original_lease(self):
        await self.stopped_returned()
        self.f.fail_phase = 'guardian-return-close'
        with self.assertRaises(Refusal):
            await self.f.running.close_return_transport()
        self.assertEqual(self.terminal_calls, 0)
        self.f.assert_fenced()
        self.assertTrue(self.f.b.cap.closed)
        self.assertIsNone(self.f.running._closed_transport)

    async def test_independent_channel_ack_loss_cannot_complete_after_actual_usb_close(self):
        await self.stopped_returned()
        self.f.fail_phase = 'channel-close'
        with self.assertRaises(Refusal):
            await self.f.running.close_return_transport()
        self.assertTrue(any(frame['operation'] == 'guardian-return-close' for frame in self.f.frames))
        self.assertEqual(self.terminal_calls, 0)
        self.f.assert_fenced()
        self.assertIsNone(self.f.running._closed_transport)

    async def test_authenticated_wrong_device_info_is_refused_without_a_second_open(self):
        await self.flow()
        self.wrong_identity = True
        with patch.object(module, '_now', lambda: self.clock), patch.object(module, '_wait', self.fast_wait), self.assertRaises(Refusal):
            await module.observe_initial_noise(self.f.context)
        self.assertIsNone(self.f.running._wire_observation)
        self.assertIsNone(self.f.context._noise_psk)
        self.assertTrue(self.f.b.cap.closed)
        self.assertEqual(sum(frame['operation'] == 'api-open' for frame in self.f.frames), 1)
        self.f.assert_fenced()


    async def test_private_composition_runs_original_grant_through_real_noise_and_actor_record(self):
        await self.flow(prepared_only=True)
        guardian = fixtures.fixtures.joins.guardian
        self.composed_end_at = self.clock + 60
        with patch.object(module, '_now', lambda: self.clock), patch.object(module, '_wait', self.fast_wait), \
                patch.object(guardian, 'time', SimpleNamespace(monotonic=lambda: self.clock)):
            result = await guardian.run_guardian_trial(self.ram)
        self.assertEqual(result['state'], 'browser_initial_trial_stopped_observed')
        self.assertFalse(result['installed'])
        self.assertFalse(result['activated'])
        self.assertEqual(self.terminal_calls, 1)
        self.assertIsNone(self.f.b.j.stages.lease_fd)
        order = [frame['operation'] for frame in self.f.frames]
        self.assertEqual(order.count('guardian-start'), 1)
        phases = ('guardian-start', 'api-open', 'api-close', 'guardian-finish',
                  'guardian-return-observe', 'guardian-return-close', 'channel-close')
        self.assertEqual([op for op in order if op in phases], list(phases))
        self.f.b.usb.assert_not_called()
        with self.assertRaises(Refusal):
            await guardian.run_guardian_trial(self.ram)
        self.assertEqual(self.terminal_calls, 1, 'A consumed composition never retries its terminal write')
        self.assertEqual(order, [frame['operation'] for frame in self.f.frames])
        self.assertNotIn(self.key, json.dumps(self.f.frames))

    async def test_private_composition_identity_failure_closes_without_finish_or_record(self):
        await self.flow(prepared_only=True)
        self.wrong_identity = True
        guardian = fixtures.fixtures.joins.guardian
        with patch.object(module, '_now', lambda: self.clock), patch.object(module, '_wait', self.fast_wait), \
                patch.object(guardian, 'time', SimpleNamespace(monotonic=lambda: self.clock)), self.assertRaises(Refusal):
            await guardian.run_guardian_trial(self.ram)
        self.assertEqual(self.terminal_calls, 0)
        self.assertTrue(self.f.b.cap.closed)
        self.f.assert_fenced()
        self.assertFalse(any(frame['operation'] in ('guardian-finish', 'guardian-return-observe') for frame in self.f.frames))
