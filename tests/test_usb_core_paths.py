"""Actual private-directory admission, without a worker, USB or HA process."""
from pathlib import Path
import tempfile
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
