"""Real actor/registry/Noise plus PM journal; device command ACKs are emulated."""
import asyncio
import base64
import importlib.util
import json
import sys
from unittest.mock import patch

import test_usb_browser_boot_observer as fixtures
import test_usb_browser_pm_boot_journal as journal_fixtures  # Load the standalone actor module under its own worker path.

name = 'qingping_browser_contract.monitor1_worker.browser_pm_boot_observation'
spec = importlib.util.spec_from_file_location(name, fixtures.readers.review.ROOT / 'browser_pm_boot_observation.py')
policy = importlib.util.module_from_spec(spec); sys.modules.setdefault(name, policy); spec.loader.exec_module(policy)
name = 'qingping_browser_contract.monitor1_browser_boot_observer'
sys.modules.setdefault(name, fixtures.module)
spec = importlib.util.spec_from_file_location('qingping_browser_contract.monitor1_browser_pm_boot',
                                            fixtures.readers.review.ROOT.parent / 'monitor1_browser_pm_boot.py')
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
Refusal = fixtures.Refusal


class PmBootTransferTests(fixtures.EncryptedBootObserverTests):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        self.prepared = None; self.pm_phase_loss = None; self.lose_packet = self.lose_record = False
        self.pm_frames = []; self.record_calls = 0

    async def exchange(self, owner, nonce, operation, data):
        if operation == 'internal-browser-pm-boot-record':
            self.record_calls += 1
            self.assertTrue(self.cap.closed); self.assertIsNotNone(self.j.stages.lease_fd)
            self.assertEqual(self.pm_frames[-1], 'channel-close')
        result = await super().exchange(owner, nonce, operation, data)
        if operation == 'internal-browser-pm-boot-prepare':
            self.prepared = json.loads(result[2]); self.assertIsNotNone(self.j.stages.lease_fd)
            self.assertTrue((self.j.directory / 'browser-pm-boot-intent.json').is_file())
            if self.lose_packet: raise OSError('synthetic lost packet')
        if operation == 'internal-browser-pm-boot-record' and self.lose_record: raise OSError('synthetic terminal reply loss')
        return result

    async def answer(self, frame):
        op, data = frame['operation'], frame['data']
        phase = data.get('phase') if isinstance(data, dict) else None
        event = op + (':' + phase if op == 'pm-step' else '')
        self.pm_frames.append(event)
        if not op.startswith('pm-'): return await super().answer(frame)
        self.frames.append(frame)
        if op == 'pm-stream-check':
            self.assertIsNone(data)
            value = {'kind': 'browser_pm_fixed_stdin_probe', 'service': 'exec:/bin/sh', 'ready': True,
                     'device_files_changed': False, 'writer_enabled': False, 'maximum_body_bytes': 65536, 'probe_body_bytes': 65536}
        elif op == 'pm-prepare':
            self.assertEqual(data, {'packet': self.prepared}); value = {'state': 'pm_boot_scope_rechecked', 'writer_enabled': False}
        elif op == 'pm-step': value = {'phase': phase, 'completed': True}
        else:
            self.assertEqual(op, 'pm-complete'); self.assertIsNone(data)
            p = self.prepared
            value = {'schema_version': 1, **{k: p[k] for k in ('job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'nonce', 'intent_sha256')},
                     'commands_acknowledged': ['arm', 'complete'], 'after_effects_read_acknowledged': True,
                     'target': self.target, 'current_boot_preserved': True, 'transport_closed': True,
                     'channel_closed': False, 'pm_next_boot_armed': True}
        self.cap.answer({'id': frame['id'], 'ok': event != self.pm_phase_loss, 'data': value})

    async def run_pm(self):
        self.service.pending = asyncio.current_task(); pump = asyncio.create_task(self.pump())
        try:
            async with asyncio.timeout(10):
                return await module.arm(self.service, self.owner, self.nonce, {**self.data, 'experimental_reviewed': True})
        finally:
            self.stop = True; pump.cancel(); await asyncio.gather(pump, return_exceptions=True)
            for task in self.tasks: task.cancel()
            await asyncio.gather(*self.tasks, return_exceptions=True)

    async def flow_pm(self):
        await self.start_peer()
        with patch.object(fixtures.module, '_now', lambda: self.clock), patch.object(fixtures.noise.module, '_now', lambda: self.clock), patch.object(fixtures.module, '_wait', self.fast_wait):
            return await self.run_pm()

    async def test_pm_real_noise_original_actor_and_both_closes_precede_record_release(self):
        result = await self.flow_pm()
        self.assertEqual(result['state'], 'browser_pm_next_boot_armed_waiting_reboot')
        self.assertEqual(self.record_calls, 1); self.assertIsNone(self.j.stages.lease_fd)
        self.assertFalse(result['installed'] or result['activated'] or result['installation_ready'])
        self.assertEqual([op for op in self.pm_frames if op.startswith('pm-')],
                         ['pm-stream-check', 'pm-prepare', 'pm-step:arm', 'pm-step:complete', 'pm-complete'])
        self.assertNotIn(self.key, json.dumps(self.frames)); self.assertNotIn(base64.b64decode(self.key), b''.join(self.raw_frames))

    async def test_pm_lost_packet_is_consumed_before_any_device_writer_frame(self):
        self.lose_packet = True
        with self.assertRaises(Refusal): await self.flow_pm()
        self.assertIsNotNone(self.j.stages.lease_fd); self.assertNotIn('pm-prepare', self.pm_frames)
        self.assertEqual(self.operations.count('internal-browser-pm-boot-prepare'), 1)
        self.assertFalse((self.j.directory / 'browser-pm-boot-complete.json').exists())

    async def test_pm_lost_arm_ack_does_not_repeat_or_advance_or_release(self):
        self.pm_phase_loss = 'pm-step:arm'
        with self.assertRaises(Refusal): await self.flow_pm()
        self.assertIsNotNone(self.j.stages.lease_fd); self.assertNotIn('pm-step:complete', self.pm_frames)
        self.assertEqual(self.pm_frames.count('pm-step:arm'), 1); self.assertEqual(self.record_calls, 0)

    async def test_pm_lost_separate_close_ack_preserves_unverified_journal(self):
        self.fail_op = 'channel-close'
        with self.assertRaises(Refusal): await self.flow_pm()
        self.assertIn('pm-complete', self.pm_frames); self.assertIsNotNone(self.j.stages.lease_fd)
        self.assertEqual(self.record_calls, 0)

    async def test_pm_lost_terminal_reply_uses_history_only_without_replay(self):
        self.lose_record = True
        with self.assertRaises(Refusal): await self.flow_pm()
        self.assertEqual(self.record_calls, 1); self.assertIsNone(self.j.stages.lease_fd)
        self.assertEqual(self.j.stages.pm_boot_status(self.owner, self.j.job)['state'], 'browser_pm_next_boot_armed_waiting_reboot')
