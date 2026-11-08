"""Actual actor/fsync/flock + Core registry pipeline, synthetic device frames."""
import asyncio
import copy
import importlib.util
import json
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, Mock

import test_usb_browser_bridge_boot_journal as journals
import test_usb_browser_initial_ram as registry_fixtures
import test_usb_browser_bridge_boot_review as readers

transfer = readers.review
Refusal = readers.Refusal


class BootTransferTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.j = journals.BootJournalTests(methodName='runTest'); self.j.setUp(); self.addCleanup(self.j.doCleanups)
        self.registry = registry_fixtures.readers.fixtures.fixtures.fixtures.registry_module.BrowserRegistry()
        self.addCleanup(self.registry.stop)
        core = journals.fixtures.fixtures.fixtures.commits.fixtures.plans.core_actor
        app = core.Companion(usb=object(), job_root=self.j.directory.parent); app.browser_stages = self.j.stages
        self.owner, self.nonce = self.j.owner, app.page(self.j.owner)
        self.usb = Mock(side_effect=AssertionError('No native ADB setup'))
        self.actor = core.Actor(app, usb_ready=self.usb)
        target = self.j.basis['meta']['target']
        evidence = {'kind': 'browser_webusb', 'channel': self.j.scope['channel_nonce'], 'serial': target['usb_serial'],
                    **{k: target[k] for k in ('wlan_mac', 'boot_id', 'co2_type', 'stock_version')}, 'native_get_devpath': False}
        self.channel = self.registry.open(self.owner, self.nonce, {'evidence': evidence})['channel_id']
        self.cap = self.registry.capability(self.owner, self.nonce, self.channel)
        self.data = {'job_id': self.j.job, 'expected_plan_sha256': self.j.sha, 'channel_id': self.channel, 'experimental_reviewed': True}
        self.lock = asyncio.Lock(); await self.lock.acquire(); self.addCleanup(self.lock.release)
        self.process = SimpleNamespace(returncode=None)
        self.service = SimpleNamespace(browser_registry=self.registry, exchange=AsyncMock(side_effect=self.exchange),
            lock=self.lock, process=self.process, failed=False, closing=False)
        self.frames, self.operations = [], []
        self.prepared = None; self.record_calls = 0
        self.lost_packet = self.lost_record = self.changed_actor = self.false_probe = self.bad_scope = False

    async def exchange(self, owner, nonce, op, data):
        self.operations.append(op)
        if op == 'internal-browser-bridge-boot-record':
            self.record_calls += 1
            self.assertTrue(self.cap.closed)
            self.assertEqual(self.frames[-1], 'channel-close')
            self.assertIsNotNone(self.j.stages.lease_fd)
        value, mime = self.actor.dispatch({'user': owner, 'nonce': nonce, 'operation': op, 'data': data})
        if op == 'internal-browser-bridge-boot-prepare':
            self.prepared = value
            self.assertEqual(self.frames, ['bridge-boot-stream-check', 'bridge-boot-preparation'])
            self.assertTrue((self.j.directory / journals.journal.INTENT).exists())
            self.assertIsNotNone(self.j.stages.lease_fd)
            if self.lost_packet: raise OSError('synthetic private packet loss')
        if op == 'internal-browser-bridge-boot-record' and self.lost_record:
            raise OSError('synthetic reply loss after immutable record')
        return True, mime, json.dumps(value).encode()

    async def pump(self, fail=None, expire=None):
        while True:
            frame = await self.cap.poll()
            if frame is None: continue
            op, data = frame['operation'], frame['data']
            phase = data.get('phase') if isinstance(data, dict) else None
            event = op + (':' + phase if op == 'bridge-boot-step' else '')
            self.frames.append(event)
            if op == 'bridge-boot-stream-check':
                self.assertIsNone(data)
                value = {'kind': 'browser_fixed_stdin_probe', 'service': 'exec:/bin/sh', 'ready': True,
                         'device_files_changed': False, 'writer_enabled': False}
                if self.false_probe: value['device_files_changed'] = 0
            elif op == 'bridge-boot-preparation':
                self.assertEqual(data, {'meta': self.j.basis['meta'], 'trial_marker': self.j.basis['trial_marker']})
                value = copy.deepcopy(self.j.preparation)
            elif op == 'bridge-boot-prepare':
                self.assertEqual(data, {'packet': self.prepared})
                value = {'state': 'bridge_boot_scope_rechecked', 'writer_enabled': False}
            elif op == 'bridge-boot-step':
                self.assertIn(phase, ('before', 'arm', 'armed', 'complete'))
                value = {'phase': phase, 'completed': True}
                if self.changed_actor and phase == 'arm': self.service.process = object()
            elif op == 'bridge-boot-complete':
                self.assertIsNone(data)
                value = self.j.proof(self.prepared); value['channel_closed'] = False
                if self.bad_scope: value['armed_scope']['root_identity'][1] += 1
            elif op == 'channel-close':
                self.assertIsNone(data); value = None
            else:
                self.fail('No generic shell/API/launch/reboot/PID or alternate writer frame')
            if event == expire: self.registry.current['deadline'] = 0
            self.cap.answer({'id': frame['id'], 'ok': event != fail, 'data': value})
            if op == 'channel-close' or event in (fail, expire): return

    async def run_arm(self, fail=None, expire=None):
        self.service.pending = asyncio.current_task()
        pump = asyncio.create_task(self.pump(fail, expire))
        try:
            async with asyncio.timeout(4):
                return await transfer.arm(self.service, self.owner, self.nonce, self.data)
        finally:
            pump.cancel(); await asyncio.gather(pump, return_exceptions=True)

    def uncertain(self):
        self.assertEqual(self.record_calls, 0)
        self.assertIsNotNone(self.j.stages.lease_fd)
        self.assertFalse((self.j.directory / journals.journal.COMPLETE).exists())

    async def test_actual_actor_journal_and_original_registry_require_two_closes_before_terminal_release(self):
        result = await self.run_arm()
        self.assertEqual(result['state'], 'bridge_autostart_armed_next_boot_unverified')
        self.assertFalse(result['installed'] or result['activated'] or result['installation_ready'])
        self.assertEqual(self.frames, ['bridge-boot-stream-check', 'bridge-boot-preparation', 'bridge-boot-prepare',
            'bridge-boot-step:before', 'bridge-boot-step:arm', 'bridge-boot-step:armed', 'bridge-boot-step:complete',
            'bridge-boot-complete', 'channel-close'])
        self.assertEqual(self.record_calls, 1); self.assertIsNone(self.j.stages.lease_fd)
        self.usb.assert_not_called()

    async def test_lost_packet_never_reaches_the_first_device_command_or_releases_lease(self):
        self.lost_packet = True
        with self.assertRaises(Refusal): await self.run_arm()
        self.uncertain(); self.assertNotIn('bridge-boot-prepare', self.frames)
        self.assertEqual(self.operations.count('internal-browser-bridge-boot-prepare'), 1)

    async def test_lost_arm_ack_preserves_uncertainty_without_advancing_or_repeating(self):
        with self.assertRaises(Refusal): await self.run_arm(fail='bridge-boot-step:arm')
        self.uncertain(); self.assertNotIn('bridge-boot-step:armed', self.frames)
        self.assertEqual(self.frames.count('bridge-boot-step:arm'), 1)

    async def test_bad_independent_readback_cannot_record_reported_command_success(self):
        self.bad_scope = True
        with self.assertRaises(Refusal): await self.run_arm()
        self.uncertain(); self.assertEqual(self.frames[-1], 'channel-close')

    async def test_lost_separate_channel_ack_cannot_release_after_actual_usb_close_report(self):
        with self.assertRaises(Refusal): await self.run_arm(fail='channel-close')
        self.uncertain(); self.assertIn('bridge-boot-complete', self.frames)

    async def test_expiry_or_actor_replacement_stops_the_original_operation(self):
        self.changed_actor = True
        with self.assertRaises(Refusal): await self.run_arm()
        self.uncertain(); self.assertNotIn('bridge-boot-step:armed', self.frames)

    async def test_original_deadline_is_not_renewed_after_intent_consumption(self):
        with self.assertRaises(Refusal): await self.run_arm(expire='bridge-boot-prepare')
        self.uncertain(); self.assertNotIn('bridge-boot-step:before', self.frames)

    async def test_lost_terminal_reply_is_reconciled_only_by_historical_status(self):
        self.lost_record = True
        with self.assertRaises(Refusal): await self.run_arm()
        self.assertEqual(self.record_calls, 1); self.assertIsNone(self.j.stages.lease_fd)
        status = self.j.manager.status(self.owner, self.j.job)
        self.assertEqual(status['state'], 'bridge_autostart_armed_next_boot_unverified')

    async def test_foreign_task_or_truthy_probe_cannot_obtain_the_consumed_packet(self):
        self.service.pending = asyncio.current_task()
        with self.assertRaises(Refusal):
            await asyncio.create_task(transfer.arm(self.service, self.owner, self.nonce, self.data))
        self.service.exchange.assert_not_awaited(); self.assertTrue(self.cap.queue.empty())
        self.false_probe = True
        with self.assertRaises(Refusal): await self.run_arm()
        self.assertFalse((self.j.directory / journals.journal.INTENT).exists())
        self.assertIsNone(self.j.stages.lease_fd)
