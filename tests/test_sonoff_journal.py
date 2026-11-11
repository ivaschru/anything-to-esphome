"""Real kernel locks and durable receipts; no provider or firmware IO."""
import importlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
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

    def test_original_lease_survives_python_grandchild_and_parent_exit(self):
        from test_sonoff import ROOT
        with tempfile.TemporaryDirectory() as temporary:
            job = Path(temporary); upstream = job / "upstream"; upstream.mkdir()
            tools = upstream / "tools"; tools.mkdir()
            (tools / "__init__.py").write_text("")
            (tools / "get_device_key.py").write_text("def get_devices(*args): return []\n")
            lease = journal.acquire(job)
            read_end, write_end = os.pipe()
            request = {"format": "anything-sonoff-job-v2", "lease_fd": lease,
                       "receipt_nonce": "a" * 32, "mac": "AA:BB:CC:11:22:33"}
            request_path = job / "request.json"; request_path.write_text(json.dumps(request)); request_path.chmod(0o600)
            journal.finish(job, request, 0)
            # The child's adapter, rather than this test, must add the original
            # lease to its grandchild's pass_fds. A distinct pipe lets the test
            # end the harmless grandchild without a serialized/adopted PID.
            child = "import os,sys; print('ready',flush=True); os.read(int(sys.argv[1]),1)"
            parent = ("import subprocess,sys; "
                      f"p=subprocess.Popen([sys.executable,'-c',{child!r},{str(read_end)!r}],"
                      f"pass_fds=({read_end},),stdout=subprocess.PIPE); "
                      "print(p.stdout.readline().decode().strip(),flush=True)")
            environment = {"PATH": os.environ.get("PATH", "/usr/bin:/bin"),
                           "PYTHONPATH": str(ROOT / "custom_components/qingping_esphome/sonoff_worker") + os.pathsep + str(upstream)}
            process = subprocess.Popen([sys.executable, "-c", parent], cwd=upstream, env=environment,
                                       pass_fds=(lease, read_end), stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            os.close(lease); os.close(read_end)
            try:
                self.assertEqual(process.stdout.readline(), b"ready\n")
                self.assertEqual(process.wait(timeout=5), 0)
                self.assertEqual(journal.settlement(job, "a" * 32, request["mac"]), "active",
                                 "Parent exit and a terminal receipt cannot retire a live descendant")
                os.write(write_end, b"x")
                deadline = time.monotonic() + 5
                while journal.settlement(job, "a" * 32, request["mac"]) == "active" and time.monotonic() < deadline:
                    time.sleep(0.01)
                self.assertEqual(journal.settlement(job, "a" * 32, request["mac"]), "settled")
            finally:
                os.close(write_end)
                if process.poll() is None: process.terminate(); process.wait(timeout=5)
                process.stdout.close(); process.stderr.close()
