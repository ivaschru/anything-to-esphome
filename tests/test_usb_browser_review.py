"""Real async channel/plan join with synthetic browser reads; no USB writes."""
import asyncio
import importlib.util
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

import test_usb_browser_channel as fixtures

ROOT = Path(__file__).resolve().parents[1] / 'custom_components/qingping_esphome'
spec = importlib.util.spec_from_file_location('qingping_browser_contract.monitor1_browser_review', ROOT / 'monitor1_browser_review.py')
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)
registry_module = sys.modules['qingping_browser_contract.monitor1_browser_registry']
Refusal = fixtures.relay_module.RelayRefusal


class ReviewTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.registry = registry_module.BrowserRegistry()
        self.addCleanup(self.registry.stop)
        self.owner, self.nonce = 'a' * 32, 'b' * 64
        self.evidence = {'kind': 'browser_webusb', 'channel': '22222222-2222-2222-2222-222222222222',
            'serial': 'synthetic-usb', 'wlan_mac': '02:00:00:00:00:01', 'boot_id': '33333333-3333-3333-3333-333333333333',
            'co2_type': 2, 'stock_version': '4.1.8_0287', 'native_get_devpath': False}
        opened = self.registry.open(self.owner, self.nonce, {'evidence': self.evidence})
        self.id = opened['channel_id']
        self.capability = self.registry.capability(self.owner, self.nonce, self.id)
        self.data = {'job_id': 'c' * 32, 'channel_id': self.id, 'expected_plan_sha256': 'd' * 64}
        self.context = {'schema_version': 1, 'job_id': self.data['job_id'], 'plan_sha256': self.data['expected_plan_sha256'],
            'source_commit': review.SOURCE, 'writer_enabled': False,
            'target': {'kind': 'browser_webusb', **{key: self.evidence[source] for key, source in
                (('usb_serial', 'serial'), ('wlan_mac', 'wlan_mac'), ('boot_id', 'boot_id'),
                 ('co2_type', 'co2_type'), ('stock_version', 'stock_version'))}}}
        self.service = SimpleNamespace(browser_registry=self.registry,
            exchange=AsyncMock(side_effect=lambda *args: (True, 'application/json', json.dumps(self.context).encode())))

    async def answer(self, task, observed=None):
        pending = asyncio.create_task(task)
        request = await self.capability.poll()
        self.assertEqual(request['operation'], 'scope-check')
        self.assertIsNone(request['data'], 'No remote command/target/path may be chosen by a frame')
        self.capability.answer({'id': request['id'], 'ok': True, 'data': self.evidence if observed is None else observed})
        return await pending

    async def test_fresh_scope_joins_private_plan_without_native_path_or_writer_authority(self):
        result = await self.answer(review.review(self.service, self.owner, self.nonce, self.data))
        self.assertEqual(result['state'], 'browser_scope_verified')
        self.assertTrue(result['hardware_contacted'])
        self.assertEqual(result['device_writes'], 0)
        self.assertFalse(result['writer_enabled'] or result['native_get_devpath'] or result['installed'] or result['installation_ready'])
        self.service.exchange.assert_awaited_once_with(self.owner, self.nonce, 'internal-browser-plan-context',
            {'job_id': self.data['job_id'], 'expected_plan_sha256': self.data['expected_plan_sha256']})
        # A previous success is never cached as another read/write permission.
        self.service.exchange.reset_mock()
        again = await self.answer(review.review(self.service, self.owner, self.nonce, self.data))
        self.assertEqual(again['state'], 'browser_scope_verified')
        self.service.exchange.assert_awaited_once()

    async def test_owner_channel_and_request_fields_fail_before_private_actor(self):
        for data in ({**self.data, 'target': self.context['target']}, {**self.data, 'host': 'foreign'},
                     {**self.data, 'channel_id': 'e' * 32}, {**self.data, 'expected_plan_sha256': 'bad'}):
            with self.subTest(data=data), self.assertRaises(Refusal):
                await review.review(self.service, self.owner, self.nonce, data)
        for owner, nonce in (('b' * 32, self.nonce), (self.owner, 'c' * 64)):
            with self.assertRaises(Refusal):
                await review.review(self.service, owner, nonce, self.data)
        self.service.exchange.assert_not_awaited()
        self.assertTrue(self.capability.queue.empty())

    async def test_detached_plan_target_mismatch_refuses_before_any_browser_read(self):
        self.context['target']['boot_id'] = '44444444-4444-4444-4444-444444444444'
        with self.assertRaises(Refusal):
            await review.review(self.service, self.owner, self.nonce, self.data)
        self.assertTrue(self.capability.queue.empty())

    async def test_current_handle_scope_drift_or_fake_devpath_retires_channel(self):
        for change in ({'boot_id': '44444444-4444-4444-4444-444444444444'}, {'native_get_devpath': True},
                       {'serial': 'foreign'}, {'co2_type': 3}, {'usb_transport': 'usb:invented'}):
            # Each subcase owns its own channel. Never reopen a failed one.
            other = registry_module.BrowserRegistry()
            try:
                opened = other.open(self.owner, self.nonce, {'evidence': self.evidence})
                self.service.browser_registry = other
                cap = other.capability(self.owner, self.nonce, opened['channel_id'])
                task = asyncio.create_task(review.review(self.service, self.owner, self.nonce,
                    {**self.data, 'channel_id': opened['channel_id']}))
                request = await cap.poll()
                cap.answer({'id': request['id'], 'ok': True, 'data': {**self.evidence, **change}})
                with self.subTest(change=change), self.assertRaises(Refusal):
                    await task
                self.assertTrue(cap.closed)
            finally:
                other.stop()

    async def test_expiry_during_scope_read_does_not_renew_or_cache_success(self):
        task = asyncio.create_task(review.review(self.service, self.owner, self.nonce, self.data))
        request = await self.capability.poll()
        self.registry.current['deadline'] = 0
        self.capability.answer({'id': request['id'], 'ok': True, 'data': self.evidence})
        with self.assertRaises(Refusal):
            await task
        self.assertTrue(self.capability.closed)

    async def test_bad_private_context_never_delivers_browser_commands(self):
        for change in ({'schema_version': True}, {'source_commit': 'e' * 40}, {'writer_enabled': True},
                       {'plan_sha256': 'f' * 64}, {'arbitrary': 'extra'}):
            context = {**self.context, **change}
            self.service.exchange = AsyncMock(return_value=(True, 'application/json', json.dumps(context).encode()))
            with self.subTest(change=change), self.assertRaises(Refusal):
                await review.review(self.service, self.owner, self.nonce, self.data)
            self.assertTrue(self.capability.queue.empty())

    async def test_cancelled_scope_retires_the_original_request_without_new_authority(self):
        errors = []
        loop = asyncio.get_running_loop()
        previous = loop.get_exception_handler()
        loop.set_exception_handler(lambda loop, value: errors.append(value))
        self.addCleanup(loop.set_exception_handler, previous)
        task = asyncio.create_task(review.review(self.service, self.owner, self.nonce, self.data))
        request = await self.capability.poll()
        self.assertEqual(request['operation'], 'scope-check')
        task.cancel()
        with self.assertRaises(Refusal):
            await task
        self.assertTrue(self.capability.closed)
        self.assertFalse(self.capability.pending)
        await asyncio.sleep(0)
        self.assertEqual(errors, [], 'Cancellation must not leak a shielded future exception')
        with self.assertRaises(Refusal):
            self.capability.answer({'id': request['id'], 'ok': True, 'data': self.evidence})

    async def test_read_is_refused_while_api_is_open(self):
        self.capability.opened = True
        with self.assertRaises(Refusal):
            await review.review(self.service, self.owner, self.nonce, self.data)
        self.assertTrue(self.capability.closed)
        self.assertTrue(self.capability.queue.empty())


if __name__ == '__main__':
    unittest.main()
