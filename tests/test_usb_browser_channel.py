"""Real asyncio framing/loopback with a synthetic browser; no USB or HA."""
import asyncio
import base64
import copy
import importlib.util
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]/'custom_components/qingping_esphome'
for name in ('monitor1_browser_relay','monitor1_browser_process_observation','monitor1_browser_channel','monitor1_browser_registry'):
    spec=importlib.util.spec_from_file_location('qingping_browser_contract.'+name,ROOT/(name+'.py'))
    module=importlib.util.module_from_spec(spec);sys.modules[spec.name]=module;spec.loader.exec_module(module)
channel_module=sys.modules['qingping_browser_contract.monitor1_browser_channel']
relay_module=sys.modules['qingping_browser_contract.monitor1_browser_relay']


class ChannelTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):self.channel=channel_module.BrowserChannel()

    async def roundtrip(self,task,operation,data=None):
        pending=asyncio.create_task(task);request=await self.channel.poll()
        self.assertEqual(request['operation'],operation)
        self.channel.answer({'id':request['id'],'ok':True,'data':data})
        return await pending

    async def test_exact_request_answers_and_canonical_opaque_bytes(self):
        stream=await self.roundtrip(self.channel.open_api(),'api-open')
        await self.roundtrip(stream.write(b'synthetic bytes'),'api-write')
        self.assertEqual(await self.roundtrip(stream.read(64),'api-read',base64.b64encode(b'synthetic bytes').decode()),b'synthetic bytes')
        await self.roundtrip(stream.close(),'api-close');self.assertFalse(self.channel.opened)
        await self.roundtrip(self.channel.close(),'channel-close');self.assertFalse(self.channel.failed)

    async def test_unsolicited_or_duplicate_answer_retires_channel(self):
        task=asyncio.create_task(self.channel.open_api());request=await self.channel.poll()
        with self.assertRaises(relay_module.RelayRefusal):self.channel.answer({'id':'foreign','ok':True,'data':None})
        with self.assertRaises(relay_module.RelayRefusal):await task
        self.assertTrue(self.channel.failed)
        with self.assertRaises(relay_module.RelayRefusal):await self.channel.poll()

    async def test_cancelled_pure_read_is_retired_only_by_positive_close_ack(self):
        stream=await self.roundtrip(self.channel.open_api(),'api-open')
        read=asyncio.create_task(stream.read(64));request=await self.channel.poll()
        read.cancel()
        with self.assertRaises(asyncio.CancelledError):await read
        self.assertFalse(self.channel.closed)
        await self.roundtrip(stream.close(),'api-close')
        # One late old read response is discarded, never reused by a new read.
        self.channel.answer({'id':request['id'],'ok':True,'data':''})
        other=await self.roundtrip(self.channel.open_api(),'api-open')
        await self.roundtrip(other.close(),'api-close')
        await self.roundtrip(self.channel.close(),'channel-close')

    async def test_bad_read_frame_or_failed_write_ack_never_opens_another_stream(self):
        stream=await self.roundtrip(self.channel.open_api(),'api-open')
        with self.assertRaises(relay_module.RelayRefusal):await self.roundtrip(stream.read(2),'api-read','not-base64!')
        with self.assertRaises(relay_module.RelayRefusal):await self.channel.open_api()
        self.assertTrue(self.channel.failed)

    async def test_framing_and_actual_loopback_roundtrip_in_one_lifecycle(self):
        streams=[];tasks=set();running=True
        async def handle(request):
            operation=request['operation'];data=request['data'];result=None
            if operation=='api-open':streams.append(asyncio.Queue())
            elif operation=='api-write':await streams[-1].put(base64.b64decode(data,validate=True))
            elif operation=='api-read':result=base64.b64encode(await streams[-1].get()).decode()
            elif operation=='api-close':await streams[-1].put(b'')
            elif operation=='channel-close':pass
            else:self.fail(operation)
            self.channel.answer({'id':request['id'],'ok':True,'data':result})
        async def browser():
            while running:
                request=await self.channel.poll()
                if request is None:continue
                task=asyncio.create_task(handle(request));tasks.add(task);task.add_done_callback(tasks.discard)
        browser_task=asyncio.create_task(browser());relay=relay_module.BrowserApiRelay(self.channel)
        port=await relay.start()
        try:
            for value in (b'first opaque stream',b'second opaque stream'):
                reader,writer=await asyncio.open_connection('127.0.0.1',port)
                writer.write(value);await writer.drain()
                self.assertEqual(await asyncio.wait_for(reader.readexactly(len(value)),1),value)
                writer.close();await writer.wait_closed()
                for _ in range(50):
                    if relay.active is None:break
                    await asyncio.sleep(.001)
                self.assertIsNone(relay.active);self.assertFalse(relay.failed)
            await relay.close();self.assertTrue(self.channel.closed);self.assertFalse(self.channel.failed)
        finally:
            running=False;browser_task.cancel()
            for task in list(tasks):task.cancel()
            await asyncio.gather(browser_task,*tasks,return_exceptions=True)
            await relay.close()


class DisabledScopeFramesTests(unittest.IsolatedAsyncioTestCase):
    async def test_only_private_caller_can_enqueue_fixed_disabled_scope_metadata(self):
        channel=channel_module.BrowserChannel()
        meta={"synthetic":"private checked stage metadata"}
        task=asyncio.create_task(channel.check_disabled_scope(meta))
        request=await channel.poll()
        self.assertEqual(request['operation'],'disabled-scope')
        self.assertEqual(request['data'],{'meta':meta})
        self.assertFalse(channel.opened)
        # This layer returns evidence only; the later private policy join must
        # validate the full observation, target and original current channel.
        observed={'kind':'synthetic-evidence-not-authority'}
        channel.answer({'id':request['id'],'ok':True,'data':observed})
        self.assertEqual(await task,observed)
        channel._retire()


class RegistryTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.registry=sys.modules['qingping_browser_contract.monitor1_browser_registry'].BrowserRegistry()
        self.addCleanup(self.registry.stop)
        self.evidence={'kind':'browser_webusb','channel':'22222222-2222-2222-2222-222222222222','serial':'synthetic-usb',
            'wlan_mac':'02:00:00:00:00:01','boot_id':'33333333-3333-3333-3333-333333333333','co2_type':3,
            'stock_version':'4.1.8_0287','native_get_devpath':False}

    async def test_reported_context_grants_no_writer_and_capability_stays_owner_page_bound(self):
        result=self.registry.open('owner','nonce',{'evidence':self.evidence})
        self.assertEqual(set(result),{'channel_id','state','writer_enabled'});self.assertFalse(result['writer_enabled'])
        capability=self.registry.capability('owner','nonce',result['channel_id'])
        self.assertIsInstance(capability,channel_module.BrowserChannel)
        for owner,nonce,identity in [('foreign','nonce',result['channel_id']),('owner','foreign',result['channel_id']),('owner','nonce','0'*32)]:
            with self.assertRaises(relay_module.RelayRefusal):self.registry.capability(owner,nonce,identity)
        self.assertEqual(capability.pending,{})

    async def test_re_registration_cannot_adopt_a_live_or_retired_browser_nonce(self):
        first=self.registry.open('owner','nonce',{'evidence':self.evidence})
        with self.assertRaises(relay_module.RelayRefusal):self.registry.open('owner','nonce',{'evidence':self.evidence})
        await self.registry.dispatch('owner','nonce','close',{'channel_id':first['channel_id']})
        with self.assertRaises(relay_module.RelayRefusal):self.registry.open('owner','nonce',{'evidence':self.evidence})

    async def test_native_path_or_command_fields_are_refused_before_registration(self):
        for change in [{'native_get_devpath':True},{'usb_transport':'usb:invented'},{'host':'foreign'},{'co2_type':True}]:
            with self.assertRaises(relay_module.RelayRefusal):self.registry.open('owner','nonce',{'evidence':{**self.evidence,**change}})
        self.assertIsNone(self.registry.current)


class InitialRamFramesTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.channel = channel_module.BrowserChannel()

    async def exchange(self, coroutine, operation, answer):
        task = asyncio.create_task(coroutine)
        frame = await self.channel.poll()
        self.assertEqual(frame['operation'], operation)
        self.channel.answer({'id': frame['id'], 'ok': True, 'data': answer})
        return await task, frame['data']

    async def probe(self):
        return await self.exchange(self.channel.probe_initial_ram_stream(), 'ram-stream-check',
            {'kind': 'browser_fixed_stdin_probe', 'service': 'exec:/bin/sh', 'ready': True,
             'device_files_changed': False, 'writer_enabled': False})

    async def begin(self):
        return await self.exchange(self.channel.begin_initial_ram({'synthetic': 'private consumed packet'}), 'ram-prepare',
            {'state': 'ram_precreated', 'precreated': {'synthetic': 'readback'}, 'writer_enabled': False, 'image_fd_admitted': False})

    async def test_finite_frames_keep_original_channel_for_later_guardian_without_admission(self):
        await self.probe()
        _, request = await self.exchange(self.channel.check_initial_trial_preparation({'checked': 'meta'}),
                                         'initial-trial-preparation', {'synthetic': 'fresh scope'})
        self.assertEqual(request, {'meta': {'checked': 'meta'}})
        precreated, packet = await self.begin()
        self.assertEqual(precreated, {'synthetic': 'readback'})
        self.assertEqual(packet, {'packet': {'synthetic': 'private consumed packet'}})
        for offset, body in ((0, b'first'), (5, b'second')):
            _, request = await self.exchange(self.channel.initial_ram_chunk(offset, body), 'ram-chunk', {'offset': offset + len(body)})
            self.assertEqual(request, {'offset': offset, 'body': base64.b64encode(body).decode()})
        proof = {'kind': 'browser_initial_ram_ready', 'precreated': {}, 'uploaded': {}, 'preparation': {},
                 'transport_closed': False, 'guardian_started': False, 'image_fd_admitted': False,
                 'execution_authority': False, 'context_only': True}
        value, _ = await self.exchange(self.channel.finish_initial_ram(), 'ram-complete', proof)
        self.assertEqual(value, proof)
        self.assertFalse(self.channel.closed)
        with self.assertRaises(relay_module.RelayRefusal):
            await self.channel.finish_initial_ram()
        with self.assertRaises(relay_module.RelayRefusal):
            await self.channel.initial_ram_chunk(11, b'again')
        await self.exchange(self.channel.close(), 'channel-close', None)
        self.assertTrue(self.channel.closed)
        self.assertFalse(self.channel.failed)

    async def test_probe_and_prepared_state_exclude_other_writer_api_or_transport(self):
        with self.assertRaises(relay_module.RelayRefusal):
            await self.channel.begin_initial_ram({})
        await self.probe()
        for operation in (self.channel.open_api, self.channel.check_scope, self.channel.probe_commit_stream, self.channel.probe_initial_ram_stream):
            with self.assertRaises(relay_module.RelayRefusal):
                await operation()
        await self.begin()
        with self.assertRaises(relay_module.RelayRefusal):
            await self.channel.check_initial_trial_preparation({})
        for offset, body in ((True, b'x'), (1, b'x'), (0, b''), (0, b'x' * 65537), (0, 'not bytes')):
            with self.subTest(offset=offset, size=len(body)), self.assertRaises(relay_module.RelayRefusal):
                await self.channel.initial_ram_chunk(offset, body)
        self.assertTrue(self.channel.queue.empty(), 'Invalid arguments never create a frame')
        await self.exchange(self.channel.close(), 'channel-close', None)

    async def test_lost_prepare_and_chunk_ack_retire_without_replay_or_adopting_ids(self):
        for step in ('prepare', 'chunk'):
            channel = self.channel = channel_module.BrowserChannel()
            await self.probe()
            if step == 'chunk':
                await self.begin()
            task = asyncio.create_task(channel.begin_initial_ram({}) if step == 'prepare' else channel.initial_ram_chunk(0, b'body'))
            frame = await channel.poll()
            task.cancel()
            with self.assertRaises(relay_module.RelayRefusal):
                await task
            self.assertTrue(channel.closed and channel.failed)

            with self.assertRaises(relay_module.RelayRefusal):
                channel.answer({'id': frame['id'], 'ok': True, 'data': None})
            with self.assertRaises(relay_module.RelayRefusal):
                await channel.begin_initial_ram({})

    async def test_bad_precreate_chunk_or_readback_response_never_promotes_or_repeats(self):
        for step in ('prepare', 'chunk', 'complete'):
            channel = self.channel = channel_module.BrowserChannel()
            await self.probe()
            if step != 'prepare':
                await self.begin()
            if step == 'prepare':
                operation, call, answer = 'ram-prepare', channel.begin_initial_ram({}), {'state': 'ram_precreated', 'precreated': {}, 'writer_enabled': 0, 'image_fd_admitted': False}
            elif step == 'chunk':
                operation, call, answer = 'ram-chunk', channel.initial_ram_chunk(0, b'body'), {'offset': True}
            else:
                operation, call, answer = 'ram-complete', channel.finish_initial_ram(), {'kind': 'browser_initial_ram_ready', 'guardian_started': True}
            with self.subTest(step=step), self.assertRaises(relay_module.RelayRefusal):
                await self.exchange(call, operation, answer)
            self.assertTrue(channel.closed and channel.failed)


class GuardianFramesTests(unittest.IsolatedAsyncioTestCase):
    """Real finite request state, synthetic records only; no device execution."""
    asyncSetUp = InitialRamFramesTests.asyncSetUp
    exchange = InitialRamFramesTests.exchange
    probe = InitialRamFramesTests.probe

    async def ram_ready(self):
        await self.probe()
        self.process_binding = {'job_id': '1' * 32, 'plan_sha256': '2' * 64, 'intent_sha256': '3' * 64,
            'channel_id': '4' * 32, 'channel_nonce': '55555555-5555-5555-5555-555555555555', 'nonce': 'a' * 32,
            'ram_job_id': '6' * 32, 'guardian_job_id': '7' * 32}
        packet = {**self.process_binding, 'context': {'committed_scope': {
            'root_identity': [1, 2], 'stock_process': [10, 1000], 'watchdog_process': [11, 1001]}}}
        await self.exchange(self.channel.begin_initial_ram(packet), 'ram-prepare',
            {'state': 'ram_precreated', 'precreated': {}, 'writer_enabled': False, 'image_fd_admitted': False})
        await self.exchange(self.channel.finish_initial_ram(), 'ram-complete',
            {'kind': 'browser_initial_ram_ready', 'precreated': {}, 'uploaded': {'guardian_file_identity': [7, 102], 'ram_root_identity': [7, 100]}, 'preparation': {},
             'transport_closed': False, 'guardian_started': False, 'image_fd_admitted': False,
             'execution_authority': False, 'context_only': True})

    def records(self):
        start = {'kind': 'start', 'nonce': 'a' * 32, 'stamp': [123, str(2**64 - 1)]}
        child = {'kind': 'child', 'nonce': 'a' * 32, 'stamp': [124, '456']}
        first = {'kind': 'browser_initial_guardian_started_record', 'start': start, 'child': child, 'records_only': True}
        end = {'kind': 'end', 'nonce': 'a' * 32, 'guardian': start['stamp'], 'child': child['stamp'],
               'elapsed_ms': 60000, 'reaped': True, 'protection_ack': True, 'term_sent': True, 'forced': False, 'wait_status': 15}
        last = {'kind': 'browser_initial_guardian_records', 'start': copy.deepcopy(start), 'child': copy.deepcopy(child),
                'end': copy.deepcopy(end), 'raw_closed': True, 'transport_closed': False, 'records_only': True}
        return first, last

    def observation(self):
        first, _ = self.records()
        return {'kind': 'browser_initial_process_observation', **self.process_binding,
            'guardian': first['start']['stamp'], 'child': first['child']['stamp'], 'guardian_parent': 1,
            'guardian_image': ['7', '102'], 'child_image': ['1', '104'], 'kernel_child_checked': True,
            'process_images_checked': True, 'endpoint_ownership_checked': True,
            'image_fd_admitted': False, 'execution_authority': False, 'context_only': True}

    def scope_observation(self):
        return {'kind': 'browser_initial_scope_observation', **self.process_binding, 'process': self.observation(),
            'root_identity': [1, 2], 'ram_root_identity': [7, 100], 'stock_process': [10, '1000'],
            'watchdog_process': [11, '1001'], 'prefs_layout': 'prefs_file', 'memory_free_bytes': 64 * 1024**2,
            'memory_total_bytes': 128 * 1024**2,
            'kernel_scope_checked': True, 'image_fd_admitted': False, 'execution_authority': False, 'context_only': True}

    async def test_complete_scope_uses_null_frame_and_independent_original_root_birth_join(self):
        await self.ram_ready()
        first, _ = self.records()
        await self.exchange(self.channel.start_initial_guardian(), 'guardian-start', first)
        value, data = await self.exchange(self.channel.observe_initial_guardian_scope(), 'guardian-scope-observe', self.scope_observation())
        self.assertIsNone(data)
        self.assertTrue(value['kernel_scope_checked'])
        self.assertEqual(value['process']['guardian'][1], str(2**64 - 1))
        bad = self.scope_observation()
        bad['stock_process'][1] = '999'
        with self.assertRaises(relay_module.RelayRefusal):
            await self.exchange(self.channel.observe_initial_guardian_scope(), 'guardian-scope-observe', bad)
        self.assertTrue(self.channel.closed and self.channel.failed)

    async def test_complete_scope_dto_rejects_impossible_memory_and_process_aliases(self):
        await self.ram_ready()
        first, _ = self.records()
        validate = sys.modules['qingping_browser_contract.monitor1_browser_process_observation'].validate_scope
        for delta in ({'memory_total_bytes': 1024}, {'memory_free_bytes': True}, {'memory_total_bytes': 2**40 + 1},
                      {'kernel_scope_checked': 1}, {'ram_root_identity': [True, 100]}):
            with self.subTest(fields=list(delta)), self.assertRaises(relay_module.RelayRefusal):
                validate({**self.scope_observation(), **delta}, self.process_binding, first, [7, 102], [7, 100],
                         self.channel.guardian_scope_basis)
        value = self.scope_observation()
        value['process']['guardian'][0] = 10
        aliased = copy.deepcopy(first)
        aliased['start']['stamp'][0] = 10
        with self.assertRaises(relay_module.RelayRefusal):
            validate(value, self.process_binding, aliased, [7, 102], [7, 100], self.channel.guardian_scope_basis)

    async def test_complete_scope_timeout_retires_original_wait_and_rejects_late_answer(self):
        await self.ram_ready()
        first, _ = self.records()
        await self.exchange(self.channel.start_initial_guardian(), 'guardian-start', first)
        with patch.object(channel_module, 'SCOPE_WINDOW', .001):
            task = asyncio.create_task(self.channel.observe_initial_guardian_scope())
            frame = await self.channel.poll()
            self.assertEqual(frame['operation'], 'guardian-scope-observe')
            with self.assertRaises(relay_module.RelayRefusal): await task
        with self.assertRaises(relay_module.RelayRefusal):
            self.channel.answer({'id': frame['id'], 'ok': True, 'data': self.scope_observation()})
        self.assertTrue(self.channel.closed and self.channel.failed)

    async def test_guardian_api_read_and_scope_keep_two_frames_while_writes_wait(self):
        await self.ram_ready()
        first, last = self.records()
        await self.exchange(self.channel.start_initial_guardian(), 'guardian-start', first)
        with self.assertRaises(relay_module.RelayRefusal): await self.channel.open_api()
        stream, data = await self.exchange(self.channel.open_initial_guardian_api(), 'api-open', None)
        self.assertIsNone(data)
        self.assertTrue(stream.guardian)
        read = asyncio.create_task(stream.read(64))
        read_frame = await self.channel.poll()
        scope = asyncio.create_task(self.channel.observe_initial_guardian_scope())
        scope_frame = await self.channel.poll()
        self.assertEqual(scope_frame['operation'], 'guardian-scope-observe')
        self.assertIsNone(scope_frame['data'])
        self.assertEqual(len(self.channel.pending), 2)
        write = asyncio.create_task(stream.write(b'opaque synthetic bytes'))
        await asyncio.sleep(0)
        self.assertTrue(self.channel.queue.empty(), 'A write cannot become a third frame during scope')
        self.channel.answer({'id': read_frame['id'], 'ok': True, 'data': base64.b64encode(b'x').decode()})
        self.assertEqual(await read, b'x')
        another = asyncio.create_task(stream.read(64))
        another_frame = await self.channel.poll()
        self.assertEqual(another_frame['operation'], 'api-read')
        self.assertEqual(len(self.channel.pending), 2)
        self.channel.answer({'id': another_frame['id'], 'ok': True, 'data': base64.b64encode(b'y').decode()})
        self.assertEqual(await another, b'y')
        self.channel.answer({'id': scope_frame['id'], 'ok': True, 'data': self.scope_observation()})
        self.assertTrue((await scope)['kernel_scope_checked'])
        write_frame = await self.channel.poll()
        self.assertEqual(write_frame['operation'], 'api-write')
        self.assertEqual(base64.b64decode(write_frame['data']), b'opaque synthetic bytes')
        self.channel.answer({'id': write_frame['id'], 'ok': True, 'data': None})
        await write
        pending = asyncio.create_task(stream.read(64))
        pending_frame = await self.channel.poll()
        pending.cancel()
        with self.assertRaises(asyncio.CancelledError): await pending
        await self.exchange(stream.close(), 'api-close', None)
        self.assertFalse(self.channel.opened or self.channel.guardian_api_mode or self.channel.closed)
        self.assertTrue(self.channel.queue.empty())
        self.channel.answer({'id': pending_frame['id'], 'ok': True, 'data': ''})
        await self.exchange(self.channel.finish_initial_guardian(), 'guardian-finish', last)
        await self.exchange(self.channel.close(), 'channel-close', None)

    async def test_guardian_api_close_ack_loss_retires_without_open_or_launch_replay(self):
        await self.ram_ready()
        first, _ = self.records()
        await self.exchange(self.channel.start_initial_guardian(), 'guardian-start', first)
        stream, _ = await self.exchange(self.channel.open_initial_guardian_api(), 'api-open', None)
        close = asyncio.create_task(stream.close())
        frame = await self.channel.poll()
        self.assertEqual(frame['operation'], 'api-close')
        with self.assertRaises(relay_module.RelayRefusal):
            self.channel.answer({'id': frame['id'], 'ok': False, 'data': None})
        with self.assertRaises(relay_module.RelayRefusal): await close
        self.assertTrue(self.channel.closed and self.channel.failed)
        with self.assertRaises(relay_module.RelayRefusal): await self.channel.open_initial_guardian_api()
        self.assertTrue(self.channel.queue.empty())

    async def test_guardian_terminal_records_require_acknowledged_api_close(self):
        await self.ram_ready()
        first, last = self.records()
        await self.exchange(self.channel.start_initial_guardian(), 'guardian-start', first)
        stream, _ = await self.exchange(self.channel.open_initial_guardian_api(), 'api-open', None)
        with self.assertRaises(relay_module.RelayRefusal): await self.channel.finish_initial_guardian()
        self.assertTrue(self.channel.queue.empty())
        await self.exchange(stream.close(), 'api-close', None)
        await self.exchange(self.channel.finish_initial_guardian(), 'guardian-finish', last)

    async def test_process_subset_uses_null_frame_original_bindings_and_lossless_ids(self):
        await self.ram_ready()
        first, _ = self.records()
        await self.exchange(self.channel.start_initial_guardian(), 'guardian-start', first)
        value, data = await self.exchange(self.channel.observe_initial_guardian_processes(), 'guardian-process-observe', self.observation())
        self.assertIsNone(data)
        self.assertEqual(value['guardian'][1], str(2**64 - 1))
        self.assertTrue(value['context_only'])
        self.assertFalse(value['image_fd_admitted'])
        await self.exchange(self.channel.close(), 'channel-close', None)

    async def test_process_subset_refuses_wrong_phase_before_request(self):
        with self.assertRaises(relay_module.RelayRefusal): await self.channel.observe_initial_guardian_processes()
        self.assertTrue(self.channel.queue.empty())
        await self.ram_ready()
        first, last = self.records()
        await self.exchange(self.channel.start_initial_guardian(), 'guardian-start', first)
        await self.exchange(self.channel.finish_initial_guardian(), 'guardian-finish', last)
        with self.assertRaises(relay_module.RelayRefusal): await self.channel.observe_initial_guardian_processes()
        self.assertTrue(self.channel.queue.empty())

    async def test_process_reply_cannot_replace_original_inode_stamp_nonce_or_typed_flags(self):
        for bad in ('binding', 'stamp', 'inode', 'device', 'parent', 'flag', 'fd', 'extra'):
            self.channel = channel_module.BrowserChannel()
            await self.ram_ready()
            first, _ = self.records()
            await self.exchange(self.channel.start_initial_guardian(), 'guardian-start', first)
            value = self.observation()
            if bad == 'binding': value['channel_id'] = 'b' * 32
            elif bad == 'stamp': value['guardian'][1] = 1
            elif bad == 'inode': value['guardian_image'][1] = '999'
            elif bad == 'device': value['child_image'][0] = '9'
            elif bad == 'parent': value['guardian_parent'] = True
            elif bad == 'flag': value['process_images_checked'] = 1
            elif bad == 'fd': value['image_fd_admitted'] = True
            else: value['command'] = 'not admitted'
            with self.subTest(bad=bad), self.assertRaises(relay_module.RelayRefusal):
                await self.exchange(self.channel.observe_initial_guardian_processes(), 'guardian-process-observe', value)
            self.assertTrue(self.channel.closed and self.channel.failed)

    async def test_cancelled_process_read_retires_old_frame_without_replay(self):
        await self.ram_ready()
        first, _ = self.records()
        await self.exchange(self.channel.start_initial_guardian(), 'guardian-start', first)
        task = asyncio.create_task(self.channel.observe_initial_guardian_processes())
        frame = await self.channel.poll()
        self.assertEqual(frame['operation'], 'guardian-process-observe')
        self.assertIsNone(frame['data'])
        task.cancel()
        with self.assertRaises(relay_module.RelayRefusal): await task
        with self.assertRaises(relay_module.RelayRefusal): self.channel.answer({'id': frame['id'], 'ok': True, 'data': self.observation()})
        self.assertTrue(self.channel.closed and self.channel.failed)

    async def test_original_ram_sequence_then_null_start_finish_and_independent_close(self):
        await self.ram_ready()
        first, last = self.records()
        value, data = await self.exchange(self.channel.start_initial_guardian(), 'guardian-start', first)
        self.assertIsNone(data)
        value['start']['stamp'][1] = '999'  # Retained reference must be detached.
        value['child']['nonce'] = 'b' * 32
        value, data = await self.exchange(self.channel.finish_initial_guardian(), 'guardian-finish', last)
        self.assertIsNone(data)
        self.assertEqual(value, last)
        self.assertFalse(self.channel.closed)
        for action in (self.channel.start_initial_guardian, self.channel.finish_initial_guardian, self.channel.open_api):
            with self.assertRaises(relay_module.RelayRefusal):
                await action()
        await self.exchange(self.channel.close(), 'channel-close', None)

    async def test_no_start_before_original_ram_proof_or_end_before_start(self):
        for action in (self.channel.start_initial_guardian, self.channel.finish_initial_guardian):
            with self.assertRaises(relay_module.RelayRefusal):
                await action()
        self.assertTrue(self.channel.queue.empty())
        await self.ram_ready()
        with self.assertRaises(relay_module.RelayRefusal):
            await self.channel.finish_initial_guardian()
        self.assertTrue(self.channel.queue.empty())

    async def test_bad_start_nonce_stamp_or_scalar_retires_without_replay(self):
        for bad in ('nonce', 'number_birth', 'overflow', 'pid_bool', 'same_pid', 'records_bool', 'extra'):
            self.channel = channel_module.BrowserChannel()
            await self.ram_ready()
            first, _ = self.records()
            if bad == 'nonce': first['start']['nonce'] = 'b' * 32
            elif bad == 'number_birth': first['start']['stamp'][1] = 12345
            elif bad == 'overflow': first['start']['stamp'][1] = str(2**64)
            elif bad == 'pid_bool': first['start']['stamp'][0] = True
            elif bad == 'same_pid': first['child']['stamp'][0] = 123
            elif bad == 'records_bool': first['records_only'] = 1
            else: first['command'] = 'not admitted'
            with self.subTest(bad=bad), self.assertRaises(relay_module.RelayRefusal):
                await self.exchange(self.channel.start_initial_guardian(), 'guardian-start', first)
            self.assertTrue(self.channel.closed and self.channel.failed)

    async def test_end_must_match_original_records_exact_stamps_and_flags(self):
        for bad in ('birth', 'child', 'duration', 'flag', 'wait_bool', 'close', 'transport'):
            self.channel = channel_module.BrowserChannel()
            await self.ram_ready()
            first, last = self.records()
            await self.exchange(self.channel.start_initial_guardian(), 'guardian-start', first)
            if bad == 'birth': last['end']['guardian'][1] = '1'
            elif bad == 'child': last['child']['stamp'][1] = '1'
            elif bad == 'duration': last['end']['elapsed_ms'] = 59999
            elif bad == 'flag': last['end']['reaped'] = 1
            elif bad == 'wait_bool': last['end']['wait_status'] = False
            elif bad == 'close': last['raw_closed'] = 1
            else: last['transport_closed'] = True
            with self.subTest(bad=bad), self.assertRaises(relay_module.RelayRefusal):
                await self.exchange(self.channel.finish_initial_guardian(), 'guardian-finish', last)
            self.assertTrue(self.channel.closed and self.channel.failed)

    async def test_cancelled_start_or_end_ack_never_replays(self):
        for phase in ('start', 'finish'):
            self.channel = channel_module.BrowserChannel()
            await self.ram_ready()
            first, _ = self.records()
            if phase == 'finish': await self.exchange(self.channel.start_initial_guardian(), 'guardian-start', first)
            task = asyncio.create_task(getattr(self.channel, phase + '_initial_guardian')())
            request = await self.channel.poll()
            task.cancel()
            with self.assertRaises(relay_module.RelayRefusal): await task
            with self.assertRaises(relay_module.RelayRefusal): self.channel.answer({'id': request['id'], 'ok': True, 'data': first})
            self.assertTrue(self.channel.closed and self.channel.failed)
