"""Actual actor/registry/Noise + native enrollment engine, synthetic USB/HA store.

The network edge maps the fixture's USB-reported private IP to its independent
loopback responder. Production never receives this override. No HA instance,
monitor, persistent boot flag, config file or private device key is changed.
"""
import asyncio
import importlib.util
import json
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, Mock, patch

import test_usb_browser_full_ui_activation_transfer as previous
import test_usb_ha_enrollment_core as enrollment

fixtures, journals = previous.fixtures, previous.journals
spec = importlib.util.spec_from_file_location('qingping_browser_contract.monitor1_browser_enrollment',
    fixtures.observers.module.ROOT.parent / 'monitor1_browser_enrollment.py')
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)


@unittest.skipUnless(fixtures.observers.noise.HAS_API, 'Actual HA Noise SDK required')
class BrowserEnrollmentTests(previous.ActivationTransferFixture, unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        manager = journals.activation.BrowserFullUiActivations(self.j.stages)
        c = self.activation_context
        p = manager.prepare(self.owner, self.j.job, self.j.sha, c['trial_proof_sha256'],
            {'channel_id': '7' * 32, 'channel_nonce': '77777777-7777-4777-8777-777777777777', 'observation': self.scope()}, True, True)
        result = {'state': 'full_ui_active_observed', 'trial_job': c['trial_job'], 'boot_id': c['boot_id'],
                  'native_job': self.runtime.boot_job, 'native_observations': 2, 'store_installed': True, 'boot_enabled': True,
                  'start_requested': True, 'start_acknowledged': True, 'installed': False, 'installation_ready': False, 'replay_allowed': False}
        manager.record(self.owner, self.j.job, p['intent_sha256'], {'schema_version': 1,
            **{k: p[k] for k in ('job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'intent_sha256')},
            'result': result, 'final_scope': self.scope(), 'api_closed': True, 'transport_closed': True, 'channel_closed': True})
        self.runtime.started = True; self.runtime.bridge_reads = 2; self.runtime.stored = self.runtime.enabled = True
        self.entries = []; self.flow = SimpleNamespace(async_init=AsyncMock(), async_configure=AsyncMock(), async_progress=Mock(return_value=[]), async_abort=Mock())
        self.service.hass = SimpleNamespace(config_entries=SimpleNamespace(async_entries=lambda domain: self.entries, flow=self.flow))
        self.flow.async_init.return_value = {'type': 'form', 'step_id': 'encryption_key', 'flow_id': 'OWN_FLOW', 'errors': {}}
        async def configure(identity, data):
            self.assertEqual(identity, 'OWN_FLOW'); self.assertEqual(data, {'noise_psk': self.key})
            entry = SimpleNamespace(unique_id=self.checked['api_identity']['api_mac'], entry_id='BROWSER_ENTRY',
                data={'host': '192.168.1.25', 'port': 6053, 'noise_psk': self.key, 'device_name': self.checked['api_identity']['node_name']})
            self.entries.append(entry); return {'type': 'create_entry', 'result': entry}
        self.flow.async_configure.side_effect = configure
        self.lose_prepare = self.lose_terminal = False; self.host_reads = 0
        with patch.object(sys, "path", [str(fixtures.observers.module.ROOT), *sys.path]):
            import browser_ha_enrollment as root
        self.root = root

    list_services = previous.ActivationTransferFixture.list_services
    execute = previous.ActivationTransferFixture.execute

    async def answer(self, frame):
        if frame['operation'] == 'full-ui-network':
            self.host_reads += 1; self.frames.append(frame)
            self.assertIsNone(frame['data'])
            self.cap.answer({'id': frame['id'], 'ok': self.fail_op != 'full-ui-network',
                'data': {'kind': 'browser_full_ui_network', 'host': '192.168.1.25', 'device_writes': 0}})
        else: await super().answer(frame)

    async def exchange(self, owner, nonce, operation, data):
        result = await super().exchange(owner, nonce, operation, data)
        if operation == 'internal-browser-enrollment-prepare' and self.lose_prepare: raise OSError('synthetic packet loss')
        if operation == 'internal-browser-enrollment-record' and self.lose_terminal: raise OSError('synthetic terminal loss')
        return result

    async def run_enrollment(self):
        from aioesphomeapi import APIClient
        self.service.pending = asyncio.current_task(); pump = asyncio.create_task(self.pump())
        def factory(host, port, password, **kwargs):
            self.assertEqual(host, '192.168.1.25'); self.assertEqual(port, 6053)
            return APIClient('127.0.0.1', self.server.sockets[0].getsockname()[1], password, **kwargs)
        async def verifier(data):
            self.assertTrue(self.cap.closed, 'USB must close before independent LAN/native flow')
            await real_enroll.__globals__['verify_lan'](data, factory=factory, sleep=AsyncMock())
        real_enroll = module.enroll
        async def checked(hass, data): return await real_enroll(hass, data, verifier=verifier)
        try:
            with patch.object(module, 'enroll', checked):
                async with asyncio.timeout(180): return await module.run(self.service, self.owner, self.nonce, {**self.data, 'reviewed': True})
        finally:
            self.stop = True; pump.cancel(); await asyncio.gather(pump, return_exceptions=True)
            for task in self.tasks: task.cancel()
            await asyncio.gather(*self.tasks, return_exceptions=True)

    async def test_usb_noise_then_independent_lan_then_only_native_flow_and_closed_record(self):
        await self.start_peer(); result = await self.run_enrollment()
        self.assertEqual(result['state'], 'created'); self.assertEqual(result['entry_id'], 'BROWSER_ENTRY')
        self.assertTrue(self.cap.closed); self.assertIsNone(self.j.stages.lease_fd)
        self.assertEqual(self.host_reads, 2); self.assertEqual(self.runtime.writes(), [])
        self.assertEqual(self.flow.async_init.await_count, 1); self.assertEqual(self.flow.async_configure.await_count, 1)
        self.assertEqual(self.runtime.observations, 4); self.assertNotIn(self.key, json.dumps(self.frames)); self.assertFalse(self.peer_errors)
        with self.assertRaises(Exception): await module.run(self.service, self.owner, self.nonce, {**self.data, 'reviewed': True})
        self.assertEqual(self.flow.async_init.await_count, 1)

    async def test_lost_prepare_consumes_before_network_or_flow_and_fences_restart(self):
        await self.start_peer(); self.lose_prepare = True
        with self.assertRaises(fixtures.observers.Refusal): await self.run_enrollment()
        self.assertEqual(self.host_reads, 0); self.flow.async_init.assert_not_awaited()
        self.assertTrue((self.j.directory / self.root.INTENT).is_file()); self.assertIsNotNone(self.j.stages.lease_fd)
        self.j.stages.close()
        with self.assertRaises(Exception): self.j.stages.fence_all()
        self.assertEqual(self.root.BrowserHaEnrollments(self.j.stages).status(self.owner, self.j.job)['state'], 'unverified')

    async def test_lost_terminal_reply_does_not_repeat_flow_and_reconciles_historical_status(self):
        await self.start_peer(); self.lose_terminal = True
        with self.assertRaises(fixtures.observers.Refusal): await self.run_enrollment()
        self.assertEqual(self.flow.async_init.await_count, 1); self.assertIsNone(self.j.stages.lease_fd)
        self.lose_terminal = False
        result = await module.status(self.service, self.owner, self.nonce, self.j.job)
        self.assertEqual(result['state'], 'created'); self.assertEqual(self.flow.async_init.await_count, 1)
        self.assertEqual(self.host_reads, 2); self.assertEqual(self.runtime.writes(), [])
