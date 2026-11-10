"""Real kernel locks and durable receipts; no provider or firmware IO."""
import importlib
import json
import os
from pathlib import Path
import tempfile
import unittest

from test_sonoff import package

journal = importlib.import_module(package.__name__ + ".sonoff_journal")


class SonoffJournalTests(unittest.TestCase):
    def test_only_exact_original_terminal_and_released_lock_settle_a_job(self):
        with tempfile.TemporaryDirectory() as temporary:
            job = Path(temporary)
            request = {"format": "anything-sonoff-job-v2", "receipt_nonce": "a" * 32,
                       "mac": "AA:BB:CC:11:22:33"}
            status = lambda nonce="a" * 32, mac=request["mac"]: journal.settlement(job, nonce, mac)
            self.assertEqual(status(), "unknown")
            lease = journal.acquire(job)
            try:
                journal.finish(job, request, 2)
                self.assertEqual(status(), "active", "Receipt cannot retire a live original worker")
                with self.assertRaises(OSError): journal.acquire(job)
            finally:
                os.close(lease)
            self.assertEqual(status(), "settled", "A failed but settled engine frees unrelated devices only")
            self.assertEqual(status("b" * 32), "unknown")
            self.assertEqual(status(mac="AA:BB:CC:11:22:44"), "unknown")
            with self.assertRaises(OSError): journal.acquire(job)
            (job / "terminal.json").write_text('{"format":')
            self.assertEqual(status(), "unknown", "Partial receipt is not empty history")
            (job / "terminal.json").unlink()
            (job / "terminal.json").symlink_to(job / "worker.lock")
            self.assertEqual(status(), "unknown")

    def test_crash_or_legacy_job_does_not_manufacture_a_terminal_receipt(self):
        with tempfile.TemporaryDirectory() as temporary:
            job = Path(temporary)
            lease = journal.acquire(job)
            journal.finish(job, {"format": "anything-sonoff-job-v1"}, 0)
            os.close(lease)
            self.assertEqual(journal.settlement(job, "a" * 32, "AA:BB:CC:11:22:33"), "unknown")
            self.assertFalse((job / "terminal.json").exists())
