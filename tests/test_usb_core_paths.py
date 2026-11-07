"""Actual private-directory admission, without a worker, USB or HA process."""
from pathlib import Path
import tempfile
import os
import unittest
from unittest.mock import patch
import test_usb_preparation
import sys

worker = sys.modules["build_worker"]


class CoreJobDirectoryTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.parent = self.root / "jobs"
        self.parent.mkdir(mode=0o700)
        self.job_id = "a" * 32
        self.directory = self.parent / self.job_id
        self.directory.mkdir(mode=0o700)

    def test_original_private_job_can_live_outside_data(self):
        with patch.object(worker.Path, "cwd", return_value=self.directory):
            self.assertEqual(worker.child_job_directory(self.job_id), self.directory)

    def test_mismatching_cwd_never_falls_back_to_data(self):
        with patch.object(worker.Path, "cwd", return_value=self.directory):
            with self.assertRaisesRegex(Exception, "usb_job_unavailable"):
                worker.child_job_directory("b" * 32)

    def test_invalid_identifier_precedes_filesystem_admission(self):
        with patch.object(worker, "private_directory") as admit:
            with self.assertRaisesRegex(Exception, "usb_job_unavailable"):
                worker.child_job_directory("../" + self.job_id)
            admit.assert_not_called()

    def test_public_parent_or_job_is_refused(self):
        for path in (self.parent, self.directory):
            path.chmod(0o755)
            with patch.object(worker.Path, "cwd", return_value=self.directory):
                with self.assertRaisesRegex(Exception, "usb_job_unavailable"):
                    worker.child_job_directory(self.job_id)
            path.chmod(0o700)

    def test_symlinked_job_parent_is_refused(self):
        alias = self.root / "alias"
        alias.symlink_to(self.parent, target_is_directory=True)
        with patch.object(worker.Path, "cwd", return_value=alias / self.job_id):
            with self.assertRaisesRegex(Exception, "usb_job_unavailable"):
                worker.child_job_directory(self.job_id)

    def tools(self):
        (self.root / "tools").mkdir(mode=0o700)
        (self.root / "tools/bin").mkdir(mode=0o700)
        adb = self.root / "tools/bin/adb"
        adb.write_text("synthetic-not-an-executable\n")
        adb.chmod(0o700)
        return adb

    def test_core_children_receive_only_the_bound_private_tools_and_loopback(self):
        adb = self.tools()
        with patch.dict(os.environ, {"QINGPING_MONITOR1_CORE_ROOT": str(self.root),
                "QINGPING_MONITOR1_ADB_PORT": "45678", "SUPERVISOR_TOKEN": "synthetic-do-not-inherit"}, clear=True):
            result = worker.adb_environment(self.directory)
            self.assertEqual(worker.adb_executable(self.directory), adb)
        self.assertTrue(result["PATH"].startswith(str(self.root / "tools/bin") + ":"))
        self.assertEqual(result["ADB_SERVER_SOCKET"], "tcp:127.0.0.1:45678")
        self.assertEqual(result["ANDROID_USER_HOME"], str(self.root / "adb"))
        self.assertNotIn("SUPERVISOR_TOKEN", result)
        self.assertNotIn("synthetic-do-not-inherit", str(result))

    def test_core_context_cannot_choose_another_job_root(self):
        self.tools()
        with patch.dict(os.environ, {"QINGPING_MONITOR1_CORE_ROOT": str(self.root)}, clear=True):
            with self.assertRaisesRegex(Exception, "usb_job_unavailable"):
                worker.core_root(self.root / self.job_id)

    def test_missing_or_invalid_core_adb_context_never_falls_back_to_5037(self):
        self.tools()
        with patch.dict(os.environ, {"QINGPING_MONITOR1_CORE_ROOT": str(self.root)}, clear=True):
            with self.assertRaisesRegex(Exception, "usb_operation_failed"):
                worker.adb_environment(self.directory)
            for port in ("22", "65536", "127.0.0.1:5037", "5037;wrong"):
                with patch.dict(os.environ, {"QINGPING_MONITOR1_ADB_PORT": port}):
                    with self.assertRaisesRegex(Exception, "usb_operation_failed"):
                        worker.adb_environment(self.directory)

    def test_core_tool_must_be_private_regular_and_not_a_symlink(self):
        adb = self.tools()
        with patch.dict(os.environ, {"QINGPING_MONITOR1_CORE_ROOT": str(self.root)}, clear=True):
            adb.chmod(0o755)
            with self.assertRaisesRegex(Exception, "usb_operation_failed"):
                worker.adb_executable(self.directory)
            adb.unlink()
            adb.symlink_to(self.root / "nonexistent")
            with self.assertRaisesRegex(Exception, "usb_operation_failed"):
                worker.adb_executable(self.directory)

    def test_legacy_app_and_computer_keep_the_original_adb_context(self):
        with patch.dict(os.environ, {}, clear=True):
            result = worker.adb_environment(self.directory)
            self.assertEqual(worker.adb_executable(self.directory), Path("/usr/bin/adb"))
        self.assertEqual(result["HOME"], "/data/adb")
        self.assertEqual(result["ADB_SERVER_SOCKET"], "tcp:localhost:5037")
