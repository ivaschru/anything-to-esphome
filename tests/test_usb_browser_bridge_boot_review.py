"""Actual registry/finite Core frames; synthetic stopped journal/device DTOs."""
import asyncio
import copy
import hashlib
import importlib.util
import json
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock

import test_usb_browser_initial_review as fixtures

sys.modules.setdefault('qingping_browser_contract.monitor1_browser_initial_review', fixtures.review)
spec = importlib.util.spec_from_file_location('qingping_browser_contract.monitor1_browser_bridge_boot',
    fixtures.fixtures.fixtures.ROOT / 'monitor1_browser_bridge_boot.py')
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)
Refusal = fixtures.Refusal


class BootReviewTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.f = fixtures.InitialReviewTests(methodName='runTest')
        await self.f.asyncSetUp()
        for function, args, kwargs in self.f._cleanups:
            self.addCleanup(function, *args, **kwargs)
        self.f._cleanups.clear()
        self.b = self.f.f.fixture
        self.data = self.f.f.data
        self.marker = {'size': 420, 'sha256': 'a' * 64}
        self.context = {'schema_version': 1, 'kind': 'browser_bridge_next_boot_context',
            'job_id': self.data['job_id'], 'plan_sha256': self.data['expected_plan_sha256'], 'source_commit': review.SOURCE,
            'trial_intent_sha256': '1' * 64, 'trial_proof_sha256': '2' * 64,
            'meta': self.f.meta, 'committed_scope': copy.deepcopy(self.f.scope), 'trial_marker': self.marker,
            'producer_sha256': {name: hashlib.sha256((review.ROOT / name).read_bytes()).hexdigest()
                               for name in ('browser_bridge_boot.py', 'bridge-next-boot-contract.json')},
            'context_only': True, 'writer_enabled': False, 'installed': False,
            'installation_ready': False, 'device_writes': 0, 'live_recheck_required': True}
        self.value = {'kind': 'browser_bridge_boot_preparation', 'preparation': self.f.preparation,
                      'trial_marker': copy.deepcopy(self.marker), 'trial_marker_checked': True, 'context_only': True}
        self.reads = 0; self.events = []
        self.service = SimpleNamespace(browser_registry=self.b.registry, exchange=AsyncMock(side_effect=self.exchange))

    async def exchange(self, owner, nonce, operation, data):
        self.assertEqual((owner, nonce), (self.b.owner, self.b.nonce))
        self.assertEqual(operation, 'internal-browser-bridge-boot-context')
        self.assertEqual(data, {k: self.data[k] for k in ('job_id', 'expected_plan_sha256')})
        self.reads += 1
        return True, 'application/json', json.dumps(self.context).encode()

    async def pump(self, fail=None, expiry=False):
        while True:
            frame = await self.b.cap.poll()
            if frame is None: continue
            op = frame['operation']; self.events.append(op)
            self.assertIn(op, ('bridge-boot-preparation', 'channel-close'), 'No generic command, API or writer frame')
            if op == 'bridge-boot-preparation':
                self.assertEqual(frame['data'], {'meta': self.f.meta, 'trial_marker': self.marker})
                if expiry: self.b.registry.current['deadline'] = 0
            self.b.cap.answer({'id': frame['id'], 'ok': op != fail,
                               'data': self.value if op == 'bridge-boot-preparation' else None})
            if op == 'channel-close' or op == fail or expiry: return

    async def run_review(self, fail=None, expiry=False):
        pump = asyncio.create_task(self.pump(fail, expiry))
        try:
            return await asyncio.wait_for(review.review(self.service, self.b.owner, self.b.nonce, self.data), 2)
        finally:
            pump.cancel(); await asyncio.gather(pump, return_exceptions=True)

    async def test_original_stopped_basis_fresh_scope_and_independent_close_are_all_required(self):
        self.f.scope['data_available_bytes'] -= 4096  # Capacity alone may vary.
        result = await self.run_review()
        self.assertEqual(self.events, ['bridge-boot-preparation', 'channel-close'])
        self.assertEqual(self.reads, 2)
        self.assertEqual(result['state'], 'browser_bridge_boot_preparation_observed')
        self.assertTrue(result['hardware_contacted'] and result['live_recheck_required'])
        self.assertFalse(result['writer_enabled'] or result['installed'] or result['installation_ready'])
        self.assertEqual(result['device_writes'], 0)
        self.assertNotIn(self.marker['sha256'], json.dumps(result))

    async def test_recreated_root_or_false_marker_cannot_qualify_stopped_history(self):
        self.value['trial_marker_checked'] = 1
        with self.assertRaises(Refusal): await self.run_review()
        self.assertEqual(self.reads, 1)
        self.assertEqual(self.events, ['bridge-boot-preparation', 'channel-close'])

    async def test_changed_stopped_proof_between_reads_is_refused_without_retry(self):
        original = self.exchange
        async def changed(owner, nonce, operation, data):
            if self.reads: self.context['trial_proof_sha256'] = '3' * 64
            return await original(owner, nonce, operation, data)
        self.service.exchange.side_effect = changed
        with self.assertRaises(Refusal): await self.run_review()
        self.assertEqual(self.reads, 2)

    async def test_expired_original_channel_is_not_renewed_or_replaced(self):
        with self.assertRaises(Refusal): await self.run_review(expiry=True)
        self.assertEqual(self.reads, 1)
        self.assertEqual(self.events, ['bridge-boot-preparation'])

    async def test_lost_close_ack_cannot_claim_a_successful_preparation(self):
        with self.assertRaises(Refusal): await self.run_review(fail='channel-close')
        self.assertTrue(self.b.cap.failed)

    async def test_foreign_owner_extra_selector_and_changed_producer_fail_before_scope(self):
        with self.assertRaises(Refusal):
            await review.review(self.service, 'b' * 32, self.b.nonce, self.data)
        with self.assertRaises(Refusal):
            await review.review(self.service, self.b.owner, self.b.nonce, {**self.data, 'command': 'not admitted'})
        self.service.exchange.assert_not_awaited()
        self.context['producer_sha256']['browser_bridge_boot.py'] = '0' * 64
        with self.assertRaises(Refusal): await self.run_review()
        self.assertEqual(self.events, ['channel-close'])

    def test_context_and_marker_types_are_strict_not_json_truthiness(self):
        for delta in ({'writer_enabled': 0}, {'device_writes': False}, {'trial_marker': {'size': 420.0, 'sha256': 'a' * 64}},
                      {'trial_proof_sha256': 'bad'}, {'context_only': 1}, {'committed_scope': {}}):
            with self.subTest(delta=delta), self.assertRaises(Refusal):
                review.context((True, 'application/json', json.dumps({**self.context, **delta}).encode()), self.data)
        checked, reader = review.context((True, 'application/json', json.dumps(self.context).encode()), self.data)
        for delta in ({'trial_marker_checked': 1}, {'trial_marker': {'size': 420.0, 'sha256': 'a' * 64}},
                      {'command': 'not admitted'}):
            with self.subTest(delta=delta), self.assertRaises(Refusal):
                review.observation({**self.value, **delta}, checked, reader)
