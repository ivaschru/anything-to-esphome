"""Actual loopback byte relay with synthetic USB streams, never hardware."""
import asyncio
import importlib.util
from pathlib import Path
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('qingping_browser_relay',ROOT/'custom_components/qingping_esphome/monitor1_browser_relay.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)


class RelayTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.queue=asyncio.Queue()
        async def read(size):return await self.queue.get()
        self.remote=SimpleNamespace(write=AsyncMock(side_effect=self.queue.put),read=AsyncMock(side_effect=read),close=AsyncMock())
        self.channel=SimpleNamespace(open_api=AsyncMock(return_value=self.remote),close=AsyncMock())
        self.relay=module.BrowserApiRelay(self.channel)
        self.port=await self.relay.start();self.addAsyncCleanup(self.relay.close)

    async def test_kernel_loopback_listener_carries_only_opaque_bytes_and_closes(self):
        reader,writer=await asyncio.open_connection('127.0.0.1',self.port)
        writer.write(b'synthetic opaque API bytes');await writer.drain()
        self.assertEqual(await asyncio.wait_for(reader.readexactly(26),1),b'synthetic opaque API bytes')
        writer.close();await writer.wait_closed();await asyncio.sleep(.01)
        self.remote.close.assert_awaited_once();self.assertIsNone(self.relay.active)
        self.assertFalse(self.relay.failed);self.assertEqual(self.relay.opens,1)
        with self.assertRaises(module.RelayRefusal):await self.relay.start()

    async def test_second_client_cannot_open_or_share_the_active_usb_stream(self):
        first,writer=await asyncio.open_connection('127.0.0.1',self.port)
        writer.write(b'x');await writer.drain();self.assertEqual(await first.readexactly(1),b'x')
        second,other=await asyncio.open_connection('127.0.0.1',self.port)
        self.assertEqual(await asyncio.wait_for(second.read(),1),b'')
        self.channel.open_api.assert_awaited_once()
        writer.close();other.close();await writer.wait_closed();await other.wait_closed()

    async def test_close_retires_active_tcp_before_waiting_for_server_close(self):
        # Python3.14 waits for accepted connections in Server.wait_closed.
        # An idle pending USB read must not hold this normal close hostage.
        reader, writer = await asyncio.open_connection('127.0.0.1', self.port)
        writer.write(b'x')
        await writer.drain()
        self.assertEqual(await asyncio.wait_for(reader.readexactly(1), 1), b'x')
        await asyncio.wait_for(self.relay.close(), 1)
        self.assertFalse(self.relay.failed)
        self.remote.close.assert_awaited_once()
        self.channel.close.assert_awaited_once()
        self.assertIsNone(self.relay.active)
        self.assertEqual(await reader.read(), b'')
        writer.close()
        await writer.wait_closed()

    async def test_lost_open_ack_retires_channel_and_never_retries(self):
        self.channel.open_api.side_effect=TimeoutError('synthetic private transport error')
        reader,writer=await asyncio.open_connection('127.0.0.1',self.port)
        self.assertEqual(await asyncio.wait_for(reader.read(),1),b'')
        writer.close();await writer.wait_closed();await asyncio.sleep(.01)
        self.assertTrue(self.relay.failed);self.channel.open_api.assert_awaited_once()
        second,other=await asyncio.open_connection('127.0.0.1',self.port)
        self.assertEqual(await asyncio.wait_for(second.read(),1),b'');other.close();await other.wait_closed()
        self.channel.open_api.assert_awaited_once()

    async def test_failed_remote_close_never_allows_another_connection(self):
        self.remote.close.side_effect=TimeoutError()
        reader,writer=await asyncio.open_connection('127.0.0.1',self.port)
        writer.write(b'x');await writer.drain();await reader.readexactly(1)
        writer.close();await writer.wait_closed();await asyncio.sleep(.01)
        self.assertTrue(self.relay.failed);self.channel.close.assert_awaited()

    async def test_malformed_remote_frame_is_not_forwarded_or_retried(self):
        self.remote.read.side_effect=None;self.remote.read.return_value='not bytes'
        reader,writer=await asyncio.open_connection('127.0.0.1',self.port)
        self.assertEqual(await asyncio.wait_for(reader.read(),1),b'')
        writer.close();await writer.wait_closed();await asyncio.sleep(.01)
        self.assertTrue(self.relay.failed);self.channel.close.assert_awaited()

    def test_aggregate_byte_budget_is_monotonic_across_connections(self):
        self.relay.bytes=8*1024**2-1
        self.relay._charge(b'x')
        with self.assertRaises(module.RelayRefusal):self.relay._charge(b'x')


class FullUiBudgets(unittest.IsolatedAsyncioTestCase):
    async def test_fixed_extended_class_is_bounded_and_standard_stays_small(self):
        channel = SimpleNamespace(close=AsyncMock())
        for purpose, lifetime, byte_limit, opens in (("standard", 240, 8*1024**2, 16), ("full-ui", 900, 256*1024**2, 1024)):
            relay = module.BrowserApiRelay(channel, purpose=purpose)
            port = await relay.start()
            self.assertIsInstance(port, int)
            self.assertLessEqual(relay.deadline - __import__('time').monotonic(), lifetime)
            self.assertGreater(relay.deadline - __import__('time').monotonic(), lifetime - 1)
            self.assertEqual(relay.open_limit, opens)
            relay.bytes = byte_limit - 1; relay._charge(b'x')
            with self.assertRaises(module.RelayRefusal): relay._charge(b'x')
            await relay.close()
        with self.assertRaises(module.RelayRefusal): module.BrowserApiRelay(channel, purpose="unbounded")


class WaitingRelay(unittest.IsolatedAsyncioTestCase):
    async def test_positive_no_listener_without_socket_is_read_reconnect_not_unknown_open(self):
        channel = SimpleNamespace(open_api=AsyncMock(side_effect=module.RelayNotReady()), close=AsyncMock())
        relay = module.BrowserApiRelay(channel, purpose="full-ui")
        port = await relay.start(); self.addAsyncCleanup(relay.close)
        for _ in range(2):
            reader, writer = await asyncio.open_connection('127.0.0.1', port)
            self.assertEqual(await asyncio.wait_for(reader.read(), 1), b'')
            writer.close(); await writer.wait_closed()
            while relay.active is not None: await asyncio.sleep(0)
        self.assertFalse(relay.failed); self.assertEqual(channel.open_api.await_count, 2)
        channel.close.assert_not_awaited()
