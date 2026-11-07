"""Offline receipt recovery cannot import engines, contact USB or replay writes."""
from contextlib import redirect_stderr, redirect_stdout
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

import test_usb_computer as computer

desktop = computer.desktop


class LocalStatusTests(unittest.TestCase):
    def setUp(self):
        self.fixture = computer.ComputerExportTests(methodName="runTest")
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        previous = os.umask(0o077)
        try:
            with tarfile.open(fileobj=io.BytesIO(self.fixture.export())) as archive:
                archive.extractall(temporary.name, filter="data")
        finally:
            os.umask(previous)
        self.root = Path(temporary.name).resolve() / computer.package.PREFIX
        self.manifest = desktop.load_bundle(self.root)[2]
        self.state = self.root / "computer-state"

    def recorded_plan(self):
        self.fixture.fixture.prepare()  # Synthetic runner, never a device.
        self.state.mkdir(mode=0o700)
        shutil.copytree(self.fixture.root / "install-plan", self.state / "install-plan")
        self.digest = hashlib.sha256((self.state / "install-plan/plan.json").read_bytes()).hexdigest()
        desktop.write_new(self.state / "prepared.json", {"plan_sha256": self.digest,
            "profile_sha256": self.manifest["profile_sha256"]})

    def fingerprint(self):
        # Hash comparisons can detect a regenerated key or overwritten receipt
        # without exposing the private (synthetic) profile in test output.
        return {str(p.relative_to(self.root)): hashlib.sha256(p.read_bytes()).hexdigest()
                for p in self.root.rglob("*") if p.is_file()}

    def read(self):
        before = self.fingerprint()
        result = desktop.local_status(self.root, self.manifest)
        self.assertEqual(self.fingerprint(), before)
        self.assertTrue(result["local_receipt_only"] and result["read_only"])
        for key in ("hardware_contacted", "runtime_observed", "installed", "installation_ready", "retry_authorized"):
            self.assertIs(result[key], False)
        self.assertNotIn("device_writes", result)  # Unknown hardware outcome.
        profile = json.loads((self.root / "profile.json").read_text())
        self.assertNotIn(profile["api_encryption_key"], json.dumps(result))
        return result

    def test_absent_partial_and_complete_preparation_are_distinct(self):
        self.assertEqual(self.read()["state"], "not_prepared")
        self.recorded_plan()
        result = self.read()
        self.assertEqual(result["state"], "plan_recorded")
        self.assertEqual(result["plan_sha256"], self.digest)
        self.assertFalse(result["install_history_present"])

    def test_partial_preparation_preserves_files_without_inventing_plan_digest(self):
        self.state.mkdir(mode=0o700)
        desktop.write_new(self.state / "prepared.json", {"partial": "private fixture marker"})
        result = self.read()
        self.assertEqual(result["state"], "preparation_unverified")
        self.assertNotIn("plan_sha256", result)
        self.assertNotIn("private fixture marker", json.dumps(result))

    def test_consumed_attempt_without_result_never_becomes_retry_permission(self):
        self.recorded_plan()
        desktop.write_new(self.state / "install-intent.json", {"plan_sha256": self.digest,
            "experimental_reviewed": True})
        result = self.read()
        self.assertTrue(result["install_history_present"])
        self.assertEqual(result["state"], "install_unverified")
        self.assertNotIn("receipt_state", result)

    def test_historical_arming_receipt_is_not_live_boot_or_health(self):
        self.recorded_plan()
        desktop.write_new(self.state / "install-intent.json", {"plan_sha256": self.digest,
            "experimental_reviewed": True})
        desktop.write_new(self.state / "install-result.json", {"plan_sha256": self.digest,
            "state": "armed_waiting_reboot"})
        result = self.read()
        self.assertEqual(result["state"], "install_recorded")
        self.assertEqual(result["receipt_state"], "armed_waiting_reboot")
        self.assertTrue(result["install_history_present"])

    def test_observation_history_without_intent_is_not_an_unattempted_plan(self):
        self.recorded_plan()
        (self.state / "observations").mkdir(mode=0o700)
        result = self.read()
        self.assertTrue(result["install_history_present"])
        self.assertEqual(result["state"], "install_unverified")

    def test_changed_plan_source_or_malformed_basis_is_unverified(self):
        self.recorded_plan()
        path = self.state / "install-plan/plan.json"
        original = json.loads(path.read_text())
        for basis in ({**original["basis"], "source_commit": "f" * 40}, []):
            with self.subTest(basis_type=type(basis).__name__):
                path.write_text(json.dumps({**original, "basis": basis}))
                prepared = {"plan_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                    "profile_sha256": self.manifest["profile_sha256"]}
                (self.state / "prepared.json").write_text(json.dumps(prepared))
                result = self.read()
                self.assertEqual(result["state"], "preparation_unverified")
                self.assertNotIn("plan_sha256", result)

    def test_cli_local_status_needs_no_serial_adb_engines_or_server_environment(self):
        self.recorded_plan()
        previous = os.umask(0o077)
        try:
            with patch.object(desktop, "__file__", str(self.root / "computer_install.py")), \
                    patch.object(sys, "argv", ["computer_install.py", "local-status"]), \
                    patch.object(desktop, "engines") as engines, patch.object(desktop.shutil, "which") as which, \
                    patch.dict(os.environ, {"ADB_SERVER_SOCKET": "synthetic-do-not-change"}), redirect_stdout(io.StringIO()) as output:
                desktop.main()
                engines.assert_not_called()
                which.assert_not_called()
                self.assertEqual(os.environ["ADB_SERVER_SOCKET"], "synthetic-do-not-change")
                self.assertEqual(json.loads(output.getvalue())["plan_sha256"], self.digest)
        finally:
            os.umask(previous)

    def test_existing_usb_commands_still_require_explicit_serial_before_engines(self):
        with patch.object(sys, "argv", ["computer_install.py", "status"]), \
                patch.object(desktop, "load_bundle") as load, patch.object(desktop, "engines") as engines, \
                redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as error:
            desktop.main()
        self.assertEqual(error.exception.code, 2)
        load.assert_not_called()
        engines.assert_not_called()


if __name__ == "__main__":
    unittest.main()
