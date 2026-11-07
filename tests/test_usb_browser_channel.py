"""Real asyncio framing/loopback with a synthetic browser; no USB or HA."""
import asyncio
import base64
import importlib.util
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).resolve().parents[1]/'custom_components/qingping_esphome'
for name in ('monitor1_browser_relay','monitor1_browser_channel'):
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
