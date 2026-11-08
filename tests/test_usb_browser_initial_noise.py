"""Pure generation policy plus real HA Noise through the finite USB relay.

The peer and USB device are synthetic and the observation clock is accelerated
only inside this test module. These checks do not run a monitor/guardian or
qualify its physical samples, timer, post-stop return or terminal journal.
"""
import asyncio
import base64
from dataclasses import dataclass
import importlib.util
import json
import math
import struct
import sys
import unittest
from unittest.mock import patch

import test_usb_browser_initial_relay as fixtures

sys.modules.setdefault('qingping_browser_contract.monitor1_browser_initial_relay', fixtures.module)
spec = importlib.util.spec_from_file_location('qingping_browser_contract.monitor1_browser_initial_noise',
    fixtures.fixtures.joins.fixtures.readers.fixtures.fixtures.ROOT / 'monitor1_browser_initial_noise.py')
module = importlib.util.module_from_spec(spec)
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
        self.subscribed = False
        self.base_answer = self.f.answer
        self.f.answer = self.answer

    async def flow(self):
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
        self.clock += seconds
        if self.subscribed:
            await self.vector()
        # Only test observation time is accelerated; real asyncio/Noise/USB
        # framing and the original relay deadline continue using the real clock.
        await asyncio.sleep(.01)

    async def answer(self, frame):
        op = frame['operation']
        if op not in ('api-open', 'api-read', 'api-write', 'api-close'):
            return await self.base_answer(frame)
        if op == 'api-open':
            self.assertIsNone(frame['data'])
            self.remote_reader, self.remote_writer = await asyncio.open_connection(
                '127.0.0.1', self.server.sockets[0].getsockname()[1])
            value = None
        elif op == 'api-read':
            self.assertEqual(frame['data'], {'max_bytes': 65536})
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
        self.f.b.cap.answer({'id': frame['id'], 'ok': True, 'data': value})

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
        await self.f.running.finish_records()
        await self.f.running.close()
        self.f.assert_fenced()

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
