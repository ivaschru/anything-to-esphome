"""Disk waits must release HA's loop without granting a stale continuation."""
import asyncio
import hashlib
from pathlib import Path
import tempfile
import threading
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import test_usb_browser_stage_transfer as stage
import test_usb_browser_initial_ram as ram

try:
    from homeassistant.core import HomeAssistant
except ImportError:
    HomeAssistant = None


class ExecutorTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        # CI runs this with both supported HA SDKs. The pure protocol job
        # keeps a real thread executor without requiring Home Assistant.
        if HomeAssistant is not None:
            directory = tempfile.TemporaryDirectory()
            self.addCleanup(directory.cleanup)
            hass = HomeAssistant(directory.name)
        else:
            hass = SimpleNamespace(async_add_executor_job=asyncio.to_thread)
        self.service = SimpleNamespace(hass=hass)
        self.loop = asyncio.get_running_loop()
        self.loop_thread = threading.get_ident()
        self.started = asyncio.Event()
        self.finished = asyncio.Event()
        self.release = threading.Event()
        self.addCleanup(self.release.set)

    def slow_read(self):
        # A thread gate, not a timing/speed assertion: only the event loop can
        # release this simulated slow filesystem operation. An inline check
        # fails immediately instead of hanging the test or hiding the bug.
        self.assertNotEqual(threading.get_ident(), self.loop_thread)
        self.loop.call_soon_threadsafe(self.started.set)
        try:
            self.assertTrue(self.release.wait(3), 'Event loop did not release the disk read')
            return 'verified'
        finally:
            self.loop.call_soon_threadsafe(self.finished.set)

    async def test_loop_progresses_during_disk_read_and_guards_stay_in_original_task(self):
        guards = []
        async def operation():
            original = asyncio.current_task()
            def live():
                self.assertEqual(threading.get_ident(), self.loop_thread)
                self.assertIs(asyncio.current_task(), original)
                guards.append(True)
            return await stage.transfer.async_checked(self.service, live, self.slow_read)
        task = asyncio.create_task(operation())
        try:
            await asyncio.wait_for(self.started.wait(), 2)
            self.assertFalse(task.done())
            self.assertEqual(len(guards), 1)
            self.release.set()
            self.assertEqual(await task, 'verified')
            self.assertEqual(len(guards), 2)
        finally:
            self.release.set()
            await asyncio.gather(task, return_exceptions=True)

    async def test_expired_capability_discards_result_after_disk_wait(self):
        valid = True
        def live():
            if not valid:
                raise stage.Refusal
        task = asyncio.create_task(stage.transfer.async_checked(self.service, live, self.slow_read))
        try:
            await asyncio.wait_for(self.started.wait(), 2)
            valid = False
            self.release.set()
            with self.assertRaises(stage.Refusal):
                await task
        finally:
            self.release.set()
            await asyncio.gather(task, return_exceptions=True)

    async def test_cancellation_cannot_deliver_a_late_result_or_run_continuation(self):
        guards = []
        task = asyncio.create_task(stage.transfer.async_checked(self.service, lambda: guards.append(True), self.slow_read))
        try:
            await asyncio.wait_for(self.started.wait(), 2)
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task
            self.release.set()
            await asyncio.wait_for(self.finished.wait(), 2)
            self.assertEqual(guards, [True], 'Cancelled caller must not regain continuation authority')
        finally:
            self.release.set()
            await asyncio.gather(task, return_exceptions=True)

    async def test_source_hashes_are_read_again_instead_of_cached(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'producer.py'
            path.write_bytes(b'first')
            with patch.object(ram.transfer, 'ROOT', Path(directory)), patch.object(ram.transfer, 'PRODUCERS', ('producer.py',)):
                first = await stage.transfer.async_checked(self.service, lambda: None, ram.transfer.producer)
                path.write_bytes(b'changed')
                second = await stage.transfer.async_checked(self.service, lambda: None, ram.transfer.producer)
            self.assertEqual(first, {'producer.py': hashlib.sha256(b'first').hexdigest()})
            self.assertEqual(second, {'producer.py': hashlib.sha256(b'changed').hexdigest()})
