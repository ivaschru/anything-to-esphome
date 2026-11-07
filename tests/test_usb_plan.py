"""Offline GUI planning with synthetic payloads, never vendor code or USB."""
import hashlib
import json
import os
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import test_usb_build as builds

plans = sys.modules["install_plan"]
worker = builds.worker


class PlanTests(unittest.TestCase):
    def setUp(self):
        self.fixture = builds.BuildTests(methodName="runTest")
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.fixture.intent()
        self.fixture.synthetic_build()
        self.directory = self.fixture.directory
        self.owner = self.fixture.fixture.owner
        self.id = self.fixture.job_id
        self.manager = plans.Plans(self.fixture.manager)
        self.source = self.directory / "candidate/ports/monitor1"
        self.source.mkdir(mode=0o700, parents=True)
        report_path = self.directory / "candidate/result.json"
        report = json.loads(report_path.read_text())
        closure = {}
        for name in ("bootstrap_patches.py", "prepare_install.py", "build_candidate.py", "build_pm_helper.py", "preflight_adb.py"):
            body = b"# synthetic source; never executed\n"
            worker.write_new(self.source / name, body)
            closure[name] = hashlib.sha256(body).hexdigest()
        report["source_sha256"] = closure
        report_path.write_text(json.dumps(report))

    def runner(self, command, cwd, env, log, deadline):
        self.assertTrue((self.directory / "plan-intent.json").is_file())
        self.assertEqual(cwd, self.directory)
        self.assertNotIn("api_encryption_key", json.dumps([command, env]))
        if any(str(value).endswith("prepare_install.py") for value in command):
            root = self.directory / "install-plan"
            root.mkdir(mode=0o700)
            body = b"synthetic payload, not firmware"
            worker.write_new(root / "bridge-program", body)
            capture = json.loads((self.directory / "capture/result.json").read_text())
            profile = json.loads((self.directory / "profile.json").read_text())
            report = {"stage": "offline_plan_only", "installed": False, "installation_ready": False,
                      "hardware_contacted": False, "device_writes": 0, "live_recheck_required": True,
                      "consumed_install_intent": False, "basis": {"source_commit": worker.SOURCE_COMMIT,
                          "profile_sha256": worker.private_hash(self.directory / "profile.json")["sha256"]},
                      "target": {key: capture[key] for key in ("wlan_mac", "co2_type", "stock_version", "usb_serial", "usb_transport", "boot_id")},
                      "api_identity": {key: profile[key] for key in ("api_mac", "node_name")},
                      "requested_data_free_bytes": 16000000,
                      "files": {"bridge-program": {"size": len(body), "sha256": hashlib.sha256(body).hexdigest()}}}
            worker.write_new(root / "plan.json", json.dumps(report).encode())

    def prepare(self):
        previous = os.umask(0o077)
        try:
            return self.manager.prepare(self.owner, self.id, self.runner)
        finally:
            os.umask(previous)

    def test_native_plan_uses_canonical_commands_once_and_remains_offline(self):
        result = self.prepare()
        self.assertEqual(result["state"], "plan_prepared")
        self.assertEqual(result["requested_data_free_bytes"], 16000000)
        self.assertTrue(result["live_recheck_required"])
        self.assertFalse(result["installed"] or result["installation_ready"] or result["hardware_contacted"])
        self.assertEqual(self.manager.status(self.owner, self.id), result)
        with self.assertRaisesRegex(Exception, "usb_plan_consumed"):
            self.prepare()
        (self.directory / "install-plan/bridge-program").write_bytes(b"tampered")
        with self.assertRaisesRegex(Exception, "usb_plan_unverified"):
            self.manager.status(self.owner, self.id)

    def test_source_drift_refuses_before_consuming_plan_or_running_code(self):
        (self.source / "prepare_install.py").write_text("# changed\n")
        with self.assertRaisesRegex(Exception, "usb_plan_unverified"), patch.object(worker, "run_owned") as run:
            self.manager.prepare(self.owner, self.id, run)
        run.assert_not_called()
        self.assertFalse((self.directory / "plan-intent.json").exists())

    def test_partial_failure_retains_terminal_history_without_retry(self):
        with self.assertRaises(RuntimeError):
            previous = os.umask(0o077)
            try:
                self.manager.prepare(self.owner, self.id, lambda *args: (_ for _ in ()).throw(RuntimeError("synthetic")))
            finally:
                os.umask(previous)
        self.assertEqual(self.manager.status(self.owner, self.id)["state"], "plan_failed")
        self.assertTrue((self.directory / "profile.json").is_file())
        self.assertTrue((self.directory / "build-complete.json").is_file())

    def test_browser_capture_is_not_relabelled_as_native_and_other_owner_is_refused(self):
        with self.assertRaises(Exception):
            self.manager.prepare("b" * 32, self.id, self.runner)
        with patch.object(plans, "owned_intent", return_value=(self.directory, {"transport": "browser_usb"}, b"")):
            with self.assertRaisesRegex(Exception, "usb_plan_browser_pending"):
                self.manager.prepare(self.owner, self.id, self.runner)
            self.assertEqual(self.manager.status(self.owner, self.id)["state"], "browser_adapter_pending")
        self.assertFalse((self.directory / "plan-intent.json").exists())


if __name__ == "__main__":
    unittest.main()
