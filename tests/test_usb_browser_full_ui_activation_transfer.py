"""Real Core/actor/registry/Noise permanent sequence; synthetic device state.

The historical RAM trial and device API effects are explicit fixtures. No
monitor, image FD, panel, boot flag or real HA config entry is touched.
"""
import asyncio
import importlib.util
import json
from types import SimpleNamespace
import unittest

import test_usb_browser_full_ui as fixtures
import test_usb_browser_full_ui_activation as journals
import test_usb_full_ui_activation as runtime

spec = importlib.util.spec_from_file_location('qingping_browser_contract.monitor1_browser_full_ui_activation',
    fixtures.observers.module.ROOT.parent / 'monitor1_browser_full_ui_activation.py')
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)


@unittest.skipUnless(fixtures.observers.noise.HAS_API, 'Actual HA Noise SDK required')
class ActivationTransferFixture(fixtures.EncryptedFullUiFixture):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        trials = journals.fixtures.trial.BrowserFullUiTrials(self.j.stages)
        prior = trials.prepare(self.owner, self.j.job, self.j.sha,
            {'channel_id': '8' * 32, 'channel_nonce': '88888888-8888-4888-8888-888888888888',
             'observation': {'scope': self.scope(), 'preflight': {'state': 'full_ui_preflight_observed', 'read_only': True,
                'device_writes': 0, 'launch_authorized': False, 'installation_ready': False, 'installed': False, 'live_recheck_required': True}}}, True)
        proof = {'schema_version': 1, **{k: prior[k] for k in ('job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'intent_sha256', 'trial_job')},
                 'result': {'state': 'full_ui_trial_returned_observed', 'native_observations': 2, 'stock_return_observed': True,
                    'launch_acknowledged': True, 'job': prior['trial_job'], 'hard_runtime_ms': 60000, 'installed': False,
                    'installation_ready': False, 'boot_enabled': False, 'replay_allowed': False, 'boot_id': self.target['boot_id']},
                 'final_scope': self.scope(), 'api_closed': True, 'transport_closed': True, 'channel_closed': True}
        trials.record(self.owner, self.j.job, prior['intent_sha256'], proof)
        self.activation_context = journals.activation.context(self.j.stages, self.owner, self.j.job, self.j.sha)
        self.runtime = runtime.ActivationPeer(); self.runtime.expected = self.checked['native_pair']
        self.runtime.boot = self.target['boot_id']; self.runtime.bridge = self.checked['bridge']['sha256']; self.runtime.job = prior['trial_job']
        if self.runtime.boot_job == prior['trial_job']: self.runtime.boot_job = 'f' * 16
        self.runtime.disk['bridge'].update(bytes=self.checked['bridge']['size'], sha256=self.checked['bridge']['sha256'])
        self.record_calls = 0; self.packet = None; self.lose_packet = self.lose_record = False

    async def exchange(self, owner, nonce, operation, data):
        result = await super().exchange(owner, nonce, operation, data)
        if operation == 'internal-browser-full-ui-activation-prepare':
            self.packet = json.loads(result[2]); self.assertIsNotNone(self.j.stages.lease_fd)
            if self.lose_packet: raise OSError('synthetic lost permanent packet')
        if operation == 'internal-browser-full-ui-activation-record':
            self.record_calls += 1; self.assertTrue(self.cap.closed)
            if self.lose_record: raise OSError('synthetic lost terminal reply')
        return result

    async def list_services(self):
        self.fake_client = self.runtime.factory('127.0.0.1', 16053, noise_psk='synthetic-only')
        _, services = await self.fake_client.list_entities_services()
        args = {'full_runtime_install_core_release': (('job', 3),), 'full_runtime_set_core_boot_mode': (('enabled', 0),),
                'full_runtime_new_session': (('previous_job', 3),)}
        return [(i, s.name, args.get(s.name, ())) for i, s in enumerate(services, 1)]

    async def execute(self, req, listed):
        selected = [row for row in listed if row[0] == req.key]; self.assertEqual(len(selected), 1)
        _, name, args = selected[0]; self.assertTrue(req.return_response); self.assertEqual(len(args), len(req.args))
        data = {n: arg.string_ if t == 3 else arg.bool_ for (n, t), arg in zip(args, req.args)}
        result = await self.fake_client.execute_service(SimpleNamespace(name=name), data)
        return result.success, result.response_data.encode()

    async def run_activation(self, **changes):
        self.service.pending = asyncio.current_task(); pump = asyncio.create_task(self.pump())
        data = {**self.data, 'expected_trial_proof_sha256': self.activation_context['trial_proof_sha256'],
                'screen_reviewed': True, 'experimental_reviewed': True, **changes}
        try:
            async with asyncio.timeout(180): return await module.activate(self.service, self.owner, self.nonce, data)
        finally:
            self.stop = True; pump.cancel(); await asyncio.gather(pump, return_exceptions=True)
            for task in self.tasks: task.cancel()
            await asyncio.gather(*self.tasks, return_exceptions=True)

@unittest.skipUnless(fixtures.observers.noise.HAS_API, 'Actual HA Noise SDK required')
class ActivationTransferTests(ActivationTransferFixture, unittest.IsolatedAsyncioTestCase):
    async def test_real_noise_exact_four_mutations_and_terminal_only_after_closed_transport(self):
        await self.start_peer(); result = await self.run_activation()
        self.assertEqual(result['state'], 'browser_full_ui_active_observed'); self.assertEqual(self.runtime.writes(), list(runtime.WRITES))
        self.assertEqual(self.record_calls, 1); self.assertTrue(self.cap.closed); self.assertFalse(self.peer_errors)
        self.assertIsNone(self.j.stages.lease_fd); self.assertNotIn(self.key, json.dumps(self.frames))
        self.assertFalse(result['installed'] or result['installation_ready'] or result['replay_allowed'])

    async def test_preflight_capacity_failure_consumes_no_permanent_intent_and_writes_nothing(self):
        await self.start_peer(); self.runtime.disk['blocks_available'] = 1
        with self.assertRaises(fixtures.observers.Refusal): await self.run_activation()
        self.assertEqual(self.runtime.writes(), []); self.assertIsNone(self.packet)
        self.assertFalse((self.j.directory / journals.activation.INTENT).exists()); self.assertIsNone(self.j.stages.lease_fd)

    async def test_lost_packet_preserves_consumed_attempt_without_device_writes(self):
        await self.start_peer(); self.lose_packet = True
        with self.assertRaises(fixtures.observers.Refusal): await self.run_activation()
        self.assertEqual(self.runtime.writes(), []); self.assertIsNotNone(self.packet)
        self.assertTrue(self.cap.closed); self.assertIsNotNone(self.j.stages.lease_fd)
        with self.assertRaises(Exception): self.j.stages.fence_all()
        self.assertFalse((self.j.directory / journals.activation.COMPLETE).exists())

    async def test_lost_terminal_reply_reconciles_only_history_without_repeating_commands(self):
        await self.start_peer(); self.lose_record = True
        with self.assertRaises(fixtures.observers.Refusal): await self.run_activation()
        self.assertEqual(self.runtime.writes(), list(runtime.WRITES)); self.assertEqual(self.record_calls, 1)
        self.assertTrue(self.cap.closed); self.assertIsNone(self.j.stages.lease_fd)
        # The real actor already committed before its response was lost. A
        # historical status read must neither reconnect nor repeat a mutation.
        result = journals.activation.BrowserFullUiActivations(self.j.stages).status(self.owner, self.j.job)
        self.assertEqual(result['state'], 'browser_full_ui_active_observed')
        self.assertEqual(self.runtime.writes(), list(runtime.WRITES))
