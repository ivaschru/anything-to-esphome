"""Full private RAM trial over real Core/Noise, synthetic monitor lifecycle.

The peer models the unchanged device API; no ARM, shell, image FD, actual panel
or sixty-second hardware timer executes. It is host composition proof only.
"""
import asyncio
import base64
import json
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import test_usb_browser_full_ui as fixtures
import test_usb_browser_full_ui_trial as journals  # Standalone actor imports are loaded under their actual path.
import test_usb_full_ui_trial as runtime


@unittest.skipUnless(fixtures.observers.noise.HAS_API, 'Actual HA Noise SDK required')
class FullUiTransferTests(fixtures.EncryptedFullUiFixture, unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await super().asyncSetUp(); self.runtime = runtime.Peer(); self.runtime.images = {
            kind: (self.j.directory / 'browser-plan' / kind).read_bytes() for kind in self.checked['native_pair']}
        self.runtime.expected = self.checked['native_pair']; self.runtime.rows = [
            {'kind': k, **pin, 'offset': 0, 'verified': False} for k, pin in self.runtime.expected.items()]
        self.runtime.boot = self.target['boot_id']; self.runtime.bridge = self.checked['bridge']['sha256']
        self.packet = None; self.lose_packet = self.lose_record = False; self.record_calls = 0
        self.do_trial = False; self.waiting_open = 0

    async def exchange(self, owner, nonce, operation, data):
        result = await super().exchange(owner, nonce, operation, data)
        if operation == 'internal-browser-full-ui-trial-prepare':
            self.packet = json.loads(result[2]); self.runtime.job = self.packet['trial_job']
            self.assertIsNotNone(self.j.stages.lease_fd)
            self.assertTrue((self.j.directory / journals.trial.INTENT).is_file())
            if self.lose_packet: raise OSError('synthetic lost private body')
        if operation == 'internal-browser-full-ui-trial-record':
            self.record_calls += 1; self.assertTrue(self.cap.closed)
            if self.lose_record: raise OSError('synthetic lost terminal reply')
        return result

    async def answer(self, frame):
        if frame['operation'] == 'api-open' and self.do_trial and self.runtime.launched and self.waiting_open > 0:
            self.frames.append(frame); self.waiting_open -= 1
            self.cap.answer({'id': frame['id'], 'ok': True, 'data': {'kind': 'browser_full_ui_api_waiting',
                'socket_open_issued': False, 'listener_absence_checked': True}})
            return
        return await super().answer(frame)

    async def list_services(self):
        if not self.do_trial: return await super().list_services()
        self.fake_client = self.runtime.factory('127.0.0.1', 16053, noise_psk='synthetic-only')
        _, services = await self.fake_client.list_entities_services()
        args = {'full_runtime_begin': (('job', 3), ('kind', 3)),
                'full_runtime_chunk': (('job', 3), ('kind', 3), ('offset', 1), ('hex_data', 3)),
                'full_runtime_seal': (('job', 3), ('kind', 3)),
                'full_runtime_prepare': (('job', 3),), 'full_runtime_launch_trial': (('job', 3),)}
        return [(i, s.name, args.get(s.name, ())) for i, s in enumerate(services, 1)]

    async def execute(self, req, listed):
        if not self.do_trial: return await super().execute(req, listed)
        rows = [row for row in listed if row[0] == req.key]; self.assertEqual(len(rows), 1)
        _, name, args = rows[0]; self.assertTrue(req.return_response); self.assertEqual(len(args), len(req.args))
        data = {n: arg.string_ if t == 3 else arg.int_ for (n, t), arg in zip(args, req.args)}
        response = await self.fake_client.execute_service(SimpleNamespace(name=name), data)
        return response.success, response.response_data.encode()

    async def run_trial(self):
        self.do_trial = True; self.service.pending = asyncio.current_task(); pump = asyncio.create_task(self.pump())
        try:
            async with asyncio.timeout(90):
                return await fixtures.module.trial(self.service, self.owner, self.nonce, {**self.data, 'experimental_reviewed': True})
        finally:
            self.stop = True; pump.cancel(); await asyncio.gather(pump, return_exceptions=True)
            for task in self.tasks: task.cancel()
            await asyncio.gather(*self.tasks, return_exceptions=True)

    async def test_real_noise_transfers_exact_original_pair_once_and_records_after_both_closes(self):
        await self.start_peer(); self.waiting_open = 1
        try:
            result = await self.run_trial()
        except Exception as error:
            self.fail(str({'operations': self.operations, 'rpc_names': [n for n, _ in self.runtime.calls],
                           'packet': self.packet is not None, 'peer_errors': [type(e).__name__ for e in self.peer_errors]}))
        self.assertEqual(result['state'], 'browser_full_ui_trial_returned_observed'); self.assertEqual(self.record_calls, 1)
        self.assertEqual(self.waiting_open, 0, 'Known handoff absence was observed without an issued socket')
        self.assertEqual(sum(n == 'full_runtime_launch_trial' for n, _ in self.runtime.calls), 1)
        self.assertEqual(sum(n == 'full_runtime_begin' for n, _ in self.runtime.calls), 2)
        self.assertEqual(self.frames[-1]['operation'], 'channel-close'); self.assertTrue(self.cap.closed)
        self.assertIsNone(self.j.stages.lease_fd); self.assertFalse(self.peer_errors)
        self.assertFalse(result['installed'] or result['installation_ready'] or result['replay_allowed'])
        self.assertNotIn(self.key, json.dumps(self.frames)); self.assertNotIn(base64.b64decode(self.key), b''.join(self.raw_frames))
        self.j.stages.fence_all()

    async def test_lost_private_packet_preserves_consumed_history_without_any_trial_rpc(self):
        await self.start_peer(); self.lose_packet = True
        with self.assertRaises(fixtures.observers.Refusal): await self.run_trial()
        self.assertIsNotNone(self.j.stages.lease_fd); self.assertEqual(self.record_calls, 0)
        self.assertFalse(any(n == 'full_runtime_begin' for n, _ in self.runtime.calls))
        self.j.stages.close()
        with self.assertRaises(Exception): self.j.stages.fence_all()

    async def test_lost_terminal_reply_reconciles_status_without_repeating_trial(self):
        await self.start_peer(); self.lose_record = True
        with self.assertRaises(fixtures.observers.Refusal): await self.run_trial()
        self.assertEqual(self.record_calls, 1); self.assertIsNone(self.j.stages.lease_fd)
        self.assertEqual(journals.trial.BrowserFullUiTrials(self.j.stages).status(self.owner, self.j.job)['state'], 'browser_full_ui_trial_returned_observed')
        self.assertEqual(sum(n == 'full_runtime_launch_trial' for n, _ in self.runtime.calls), 1)
