"""Real actor/registry/Noise/API review; synthetic selected USB and device RPCs."""
import asyncio
import base64
import copy
import importlib.util
import json
import struct
import sys
import types
import unittest
from unittest.mock import AsyncMock, Mock, patch

import test_usb_browser_full_ui_context as contexts
import test_usb_browser_boot_observer as observers

# Load the real packaged pure API engine without HA integration startup. The
# generated package is byte-checked against the authored rootfs by CI.
namespace = 'qingping_browser_contract'
parent = types.ModuleType(namespace); parent.__path__ = [str(observers.module.ROOT.parent)]
sys.modules.setdefault(namespace, parent)
sys.modules.setdefault(namespace + '.monitor1_browser_boot_observer', observers.module)
package = types.ModuleType(namespace + '.monitor1_worker'); package.__path__ = [str(observers.module.ROOT)]
sys.modules.setdefault(package.__name__, package)
spec = importlib.util.spec_from_file_location(namespace + '.monitor1_browser_full_ui', observers.module.ROOT.parent / 'monitor1_browser_full_ui.py')
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)


class FullUiBrowserFixture:
    async def asyncSetUp(self):
        self.j = contexts.FullUiContextTests(methodName='runTest'); self.j.setUp(); self.addCleanup(self.j.doCleanups); self.j.complete()
        self.checked = self.j.read()
        self.registry = observers.registry_fixture.readers.fixtures.fixtures.fixtures.registry_module.BrowserRegistry()
        self.addCleanup(self.registry.stop)
        core = contexts.fixtures.fixtures.fixtures.fixtures.fixtures.fixtures.commits.fixtures.plans.core_actor
        app = core.Companion(usb=object(), job_root=self.j.directory.parent); app.browser_stages = self.j.stages
        self.owner, self.nonce = self.j.owner, app.page(self.j.owner)
        self.actor = core.Actor(app, usb_ready=Mock(side_effect=AssertionError('No ADB')))
        self.target = {**self.checked['target'], 'boot_id': '59999999-5999-4999-8999-599999999999'}
        evidence = {'kind': 'browser_webusb', 'channel': '99999999-9999-4999-8999-999999999999', 'serial': self.target['usb_serial'],
                    **{k: self.target[k] for k in ('wlan_mac', 'boot_id', 'co2_type', 'stock_version')}, 'native_get_devpath': False}
        self.channel = self.registry.open(self.owner, self.nonce, {'evidence': evidence, 'purpose': 'full-ui'})['channel_id']
        self.cap = self.registry.capability(self.owner, self.nonce, self.channel)
        self.data = {'job_id': self.j.job, 'expected_plan_sha256': self.j.sha, 'channel_id': self.channel}
        self.lock = asyncio.Lock(); await self.lock.acquire(); self.addCleanup(self.lock.release)
        self.service = types.SimpleNamespace(browser_registry=self.registry, lock=self.lock, process=types.SimpleNamespace(returncode=None),
            failed=False, closing=False, exchange=AsyncMock(side_effect=self.exchange))
        self.frames, self.operations = [], []; self.tasks = set(); self.stop = self.bad_scope = False; self.fail_op = None
        self.remote_reader = self.remote_writer = None

    exchange = observers.BootObserverTests.exchange
    pump = observers.BootObserverTests.pump

    def scope(self):
        result = {'kind': 'browser_full_ui_waiting_for_pm_boot' if self.target['boot_id'] == self.checked['pm_armed_boot'] else 'browser_full_ui_scope',
                  **{k: self.checked[k] for k in module.BINDINGS}, 'target': self.target, 'bridge_checked': True, 'context_only': True, 'device_writes': 0}
        if self.bad_scope: result['bridge_checked'] = 1
        return result

    async def answer(self, frame):
        op, data = frame['operation'], frame['data']; self.frames.append(copy.deepcopy(frame)); value = None
        if op == 'full-ui-scope':
            self.assertEqual(data, {'context': self.checked}); value = self.scope()
        elif op == 'api-open':
            self.remote_reader, self.remote_writer = await asyncio.open_connection('127.0.0.1', self.server.sockets[0].getsockname()[1])
        elif op == 'api-read': value = base64.b64encode(await self.remote_reader.read(65536)).decode()
        elif op == 'api-write':
            self.remote_writer.write(base64.b64decode(data, validate=True)); await self.remote_writer.drain()
        elif op == 'api-close':
            self.remote_writer.close(); await self.remote_writer.wait_closed()
        else: self.assertEqual(op, 'channel-close')
        try: self.cap.answer({'id': frame['id'], 'ok': op != self.fail_op, 'data': value})
        except observers.Refusal:
            if not self.cap.closed: raise

    async def run_review(self):
        self.service.pending = asyncio.current_task(); pump = asyncio.create_task(self.pump())
        try:
            async with asyncio.timeout(60): return await module.inspect(self.service, self.owner, self.nonce, self.data)
        finally:
            self.stop = True; pump.cancel(); await asyncio.gather(pump, return_exceptions=True)
            for task in self.tasks: task.cancel()
            await asyncio.gather(*self.tasks, return_exceptions=True)

# Keep reusable actor/transport setup separate from TestCase inheritance.
# Transfer suites reuse this fixture without rerunning unrelated read tests.
class FullUiBrowserTests(FullUiBrowserFixture, unittest.IsolatedAsyncioTestCase):
    async def test_same_pm_boot_only_waits_and_never_reads_key_or_opens_api(self):
        self.target['boot_id'] = self.checked['pm_armed_boot']; self.registry.current['reported_evidence']['boot_id'] = self.target['boot_id']
        result = await self.run_review(); self.assertEqual(result['state'], 'full_ui_waiting_for_pm_boot')
        self.assertEqual(self.operations, ['internal-browser-full-ui-context'] * 2)
        self.assertEqual([f['operation'] for f in self.frames], ['full-ui-scope', 'channel-close'])
        self.assertIsNone(self.j.stages.lease_fd)

    async def test_scope_boolean_drift_refuses_before_key_or_api(self):
        self.bad_scope = True
        with self.assertRaises(observers.Refusal): await self.run_review()
        self.assertNotIn('internal-browser-full-ui-api', self.operations)

    async def test_old_resource_class_and_foreign_task_do_no_io(self):
        self.service.pending = asyncio.current_task()
        with self.assertRaises(observers.Refusal): await asyncio.create_task(module.inspect(self.service, self.owner, self.nonce, self.data))
        self.assertEqual(self.operations, [])
        self.registry.current['purpose'] = 'standard'
        with self.assertRaises(observers.Refusal): await module.inspect(self.service, self.owner, self.nonce, self.data)
        self.assertTrue(self.cap.queue.empty())


@unittest.skipUnless(observers.noise.HAS_API, 'Actual HA Noise SDK required')
class EncryptedFullUiFixture(FullUiBrowserFixture):
    accept = observers.noise.EncryptedObserverTests.accept
    stop_server = observers.noise.EncryptedObserverTests.stop_server

    async def start_peer(self):
        self.peer_writers, self.peer_tasks, self.peer_errors, self.raw_frames, self.rpc_calls = [], set(), [], [], []
        self.identity = self.checked['api_identity']; self.wrong_identity = False
        self.key = json.loads((self.j.directory / 'profile.json').read_bytes())['api_encryption_key']
        self.server = await asyncio.start_server(self.accept, '127.0.0.1', 0); self.addAsyncCleanup(self.stop_server)

    async def list_services(self):
        return [(1, 'full_runtime_status', ()), (2, 'full_runtime_inspect_start', ())]

    async def execute(self, req, listed):
        self.rpc_calls.append(req.key); self.assertTrue(req.return_response); self.assertEqual(list(req.args), [])
        if req.key == 1:
            result = {'job': '', 'phase': 0, 'hardware_trial_active': False, 'core_boot_enabled': False, 'core_release_autostart_supported': True,
                      'artifacts': [{'kind': k, **pin} for k, pin in self.checked['native_pair'].items()]}
        else:
            self.assertEqual(req.key, 2)
            result = {'ok': True, 'read_only': True, 'process_signals_exposed': False, 'network_mutations_exposed': False,
                      'boot_id': self.target['boot_id'], 'bridge_sha256': self.checked['bridge']['sha256']}
        return True, json.dumps(result).encode()

    async def peer(self, reader, writer):
        from noise.connection import NoiseConnection
        from aioesphomeapi import api_pb2 as p
        try:
            async def frame():
                h = await reader.readexactly(3); self.assertEqual(h[0], 1)
                b = await reader.readexactly(int.from_bytes(h[1:], 'big')); self.raw_frames.append(b); return b
            async def raw(b):
                writer.write(b'\1' + struct.pack('>H', len(b)) + b); await writer.drain()
            self.assertEqual(await frame(), b''); await raw(b'\1' + self.identity['node_name'].encode() + b'\0')
            protocol = NoiseConnection.from_name(b'Noise_NNpsk0_25519_ChaChaPoly_SHA256'); protocol.set_as_responder()
            protocol.set_psks(base64.b64decode(self.key)); protocol.set_prologue(b'NoiseAPIInit\0\0'); protocol.start_handshake()
            first = await frame(); self.assertEqual(first[0], 0); protocol.read_message(first[1:]); await raw(b'\0' + bytes(protocol.write_message()))
            async def send(n, msg):
                b = msg.SerializeToString(); await raw(bytes(protocol.encrypt(struct.pack('>HH', n, len(b)) + b)))
            while True:
                plain = bytes(protocol.decrypt(await frame())); n, length = struct.unpack('>HH', plain[:4]); body = plain[4:]; self.assertEqual(len(body), length)
                if n == 1: await send(2, p.HelloResponse(api_version_major=1, api_version_minor=14, name=self.identity['node_name'], server_info='fixture'))
                elif n == 3: await send(4, p.AuthenticationResponse())
                elif n == 9: await send(10, p.DeviceInfoResponse(name='wrong' if self.wrong_identity else self.identity['node_name'], mac_address=self.identity['api_mac']))
                elif n == 11:
                    listed = await self.list_services()
                    for key, name, arguments in listed:
                        service = p.ListEntitiesServicesResponse(key=key, name=name, supports_response=2)
                        for arg_name, arg_type in arguments: service.args.add(name=arg_name, type=arg_type)
                        await send(41, service)
                    await send(19, p.ListEntitiesDoneResponse())
                elif n == 42:
                    req = p.ExecuteServiceRequest.FromString(body)
                    ok, result = await self.execute(req, listed)
                    await send(131, p.ExecuteServiceResponse(call_id=req.call_id, success=ok, response_data=result))
                elif n == 7: await send(8, p.PingResponse())
                elif n == 5: await send(6, p.DisconnectResponse()); return
                else: self.fail('Unexpected mutation/time message')
        except asyncio.IncompleteReadError: pass
        except BaseException as error: self.peer_errors.append(error)
        finally:
            writer.close(); await writer.wait_closed()

@unittest.skipUnless(observers.noise.HAS_API, 'Actual HA Noise SDK required')
class EncryptedFullUiTests(EncryptedFullUiFixture, unittest.IsolatedAsyncioTestCase):
    async def test_real_noise_api_reader_and_both_closes_are_required(self):
        await self.start_peer(); result = await self.run_review()
        self.assertEqual(result['state'], 'full_ui_preflight_observed'); self.assertFalse(result['installed'] or result['installation_ready'] or result['launch_authorized'])
        self.assertEqual(self.rpc_calls, [1, 2]); self.assertFalse(self.peer_errors); self.assertTrue(self.cap.closed)
        self.assertEqual(self.frames[-1]['operation'], 'channel-close'); self.assertNotIn(self.key, json.dumps(self.frames))
        self.assertNotIn(base64.b64decode(self.key), b''.join(self.raw_frames)); self.assertIsNone(self.j.stages.lease_fd)

    async def test_lost_channel_close_or_wrong_identity_cannot_claim_preflight(self):
        await self.start_peer(); self.fail_op = 'channel-close'
        with self.assertRaises(observers.Refusal): await self.run_review()
        self.assertTrue(self.cap.failed)

    async def test_wrong_encrypted_device_identity_never_reaches_a_service(self):
        await self.start_peer(); self.wrong_identity = True
        with self.assertRaises(observers.Refusal): await self.run_review()
        self.assertEqual(self.rpc_calls, [])


@unittest.skipUnless(observers.noise.HAS_API, 'Actual HA Noise SDK required')
class EncryptedLanEnrollmentTests(EncryptedFullUiFixture, unittest.IsolatedAsyncioTestCase):
    async def list_services(self): return [(1, 'full_native_status', ())]

    async def execute(self, req, listed):
        self.assertEqual(req.key, 1); self.assertTrue(req.return_response); self.assertEqual(list(req.args), [])
        self.rpc_calls.append(req.key); n = len(self.rpc_calls)
        value = {'nonce': 'e' * 16, 'boot_id': self.target['boot_id'],
            'native_sha256': self.checked['native_pair']['native-program']['sha256'],
            'guardian_sha256': self.checked['native_pair']['guardian-program']['sha256'],
            'connected_guardians': True, 'panel_ready': True, 'core_sensors_ready': True,
            'native_state': 1, 'guardian_generations': [n, n]}
        return True, json.dumps(value).encode()

    async def test_actual_sdk_byte_responses_pass_independent_native_lan_verification(self):
        import test_usb_ha_enrollment_core as enrollment
        from aioesphomeapi import APIClient
        await self.start_peer()
        data = {**enrollment.DATA, **self.checked['api_identity'], 'noise_psk': self.key,
            'boot_id': self.target['boot_id'], 'native_sha256': self.checked['native_pair']['native-program']['sha256'],
            'guardian_sha256': self.checked['native_pair']['guardian-program']['sha256']}
        def factory(host, port, password, **kwargs):
            self.assertEqual(host, data['host']); self.assertEqual(port, 6053)
            # Only the synthetic network edge is redirected to the real local
            # responder. Production still uses the exact USB-derived address.
            return APIClient('127.0.0.1', self.server.sockets[0].getsockname()[1], password, **kwargs)
        await enrollment.module.verify_lan(data, factory=factory, sleep=AsyncMock())
        self.assertEqual(self.rpc_calls, [1, 1]); self.assertFalse(self.peer_errors)
