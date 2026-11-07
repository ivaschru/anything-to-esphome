"""Synthetic build orchestration; never compiles/runs firmware or contacts USB."""
import hashlib
import io
import json
import sys
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import test_usb_preparation as preparations

worker = sys.modules["build_worker"]


class BuildTests(unittest.TestCase):
    def setUp(self):
        self.fixture = preparations.PreparationTests(methodName="runTest")
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.summary = self.fixture.prepare()
        self.job_id = self.summary["job_id"]
        self.directory = self.fixture.parent / self.job_id
        self.manager = worker.Builds(self.fixture.parent, self.fixture.contract)

    def intent(self):
        job = json.loads((self.directory / "job.json").read_text())
        body = {"schema_version": 1, "job_id": self.job_id, "owner": self.fixture.owner,
                "source_commit": worker.SOURCE_COMMIT, "profile_sha256": job["profile_sha256"]}
        worker.write_new(self.directory / "build-intent.json", json.dumps(body).encode())

    def test_owner_and_space_checks_precede_intent_and_spawn(self):
        with patch.object(worker.subprocess, "Popen") as spawn:
            with self.assertRaises(Exception):
                self.manager.start("b" * 32, self.job_id)
            with patch.object(worker.shutil, "disk_usage", return_value=SimpleNamespace(free=worker.MIN_FREE - 1)):
                with self.assertRaisesRegex(Exception, "usb_build_space"):
                    self.manager.start(self.fixture.owner, self.job_id)
            spawn.assert_not_called()
        self.assertFalse((self.directory / "build-intent.json").exists())

    def test_durable_start_never_replays_and_restart_never_adopts_a_pid(self):
        key = json.loads((self.directory / "profile.json").read_text())["api_encryption_key"]
        calls = []
        def spawn(command, **options):
            calls.append(command)
            self.assertTrue((self.directory / "build-intent.json").is_file())
            self.assertNotIn(key, json.dumps([command, options]))
            self.assertEqual(command[-4:-2], ["--job", self.job_id])
            self.assertTrue(options["start_new_session"])
            self.assertEqual(options["cwd"], str(self.directory))
            self.assertEqual(set(options["env"]), {"PATH", "HOME", "PYTHONUNBUFFERED"})
            return SimpleNamespace(poll=lambda: None)
        with patch.object(worker.shutil, "disk_usage", return_value=SimpleNamespace(free=worker.MIN_FREE)), \
                patch.object(worker.subprocess, "Popen", side_effect=spawn):
            result = self.manager.start(self.fixture.owner, self.job_id)
            self.assertEqual(result["state"], "building")
            self.assertFalse(result["installed"] or result["installation_ready"] or result["hardware_contacted"])
            with self.assertRaisesRegex(Exception, "usb_build_consumed"):
                self.manager.start(self.fixture.owner, self.job_id)
        self.assertEqual(len(calls), 1)
        self.assertEqual(self.manager.status(self.fixture.owner, self.job_id)["state"], "building")
        restarted = worker.Builds(self.fixture.parent, self.fixture.contract)
        self.assertEqual(restarted.status(self.fixture.owner, self.job_id)["state"], "build_unverified")

    def test_spawn_failure_is_consumed_and_status_never_starts_a_process(self):
        with patch.object(worker.shutil, "disk_usage", return_value=SimpleNamespace(free=worker.MIN_FREE)), \
                patch.object(worker.subprocess, "Popen", side_effect=OSError("synthetic")) as spawn:
            with self.assertRaises(OSError):
                self.manager.start(self.fixture.owner, self.job_id)
            self.assertEqual(self.manager.status(self.fixture.owner, self.job_id)["state"], "build_unverified")
            with self.assertRaisesRegex(Exception, "usb_build_consumed"):
                self.manager.start(self.fixture.owner, self.job_id)
            self.assertEqual(spawn.call_count, 1)

    def test_incomplete_old_build_blocks_a_new_job_after_restart(self):
        self.intent()
        next_job = self.fixture.prepare()
        restarted = worker.Builds(self.fixture.parent, self.fixture.contract)
        with patch.object(worker.subprocess, "Popen") as spawn:
            with self.assertRaisesRegex(Exception, "usb_build_busy"):
                restarted.start(self.fixture.owner, next_job["job_id"])
            spawn.assert_not_called()
        self.assertFalse((self.fixture.parent / next_job["job_id"] / "build-intent.json").exists())

    def synthetic_build(self, corrupt=False):
        calls = []
        def runner(command, cwd, env, log, deadline):
            calls.append(command)
            self.assertNotIn("api_encryption_key", json.dumps([command, env]))
            self.assertGreater(deadline, time.monotonic())
            if command[:3] == ["git", "-C", str(self.directory / "source")] and "checkout" in command:
                (self.directory / "source/ports/monitor1").mkdir(mode=0o700, parents=True)
            if any(str(value).endswith("build_candidate.py") for value in command):
                candidate = self.directory / "candidate"
                candidate.mkdir(mode=0o700)
                artifacts = {}
                for name in ("native-program", "guardian-program", "bridge-program", "initial-trial-guardian-program"):
                    # Not an ELF: this fixture checks byte joins, not ABI QA.
                    body = ("synthetic-not-firmware-" + name).encode()
                    worker.write_new(candidate / name, body)
                    artifacts[name] = {"size": len(body), "sha256": hashlib.sha256(body).hexdigest()}
                report = {"complete_build": True, "installation_ready": False, "installed": False,
                          "hardware_contacted": False, "source_commit": worker.SOURCE_COMMIT,
                          "profile_sha256": worker.private_hash(self.directory / "profile.json")["sha256"],
                          "initial_trial_guardian": artifacts.pop("initial-trial-guardian-program"), "artifacts": artifacts,
                          "source_sha256": {"padding": "x" * 20000}}
                if corrupt:
                    report["artifacts"]["native-program"]["sha256"] = "0" * 64
                worker.write_new(candidate / "result.json", json.dumps(report).encode())
        # Production sets umask before any file creation. Keep the fixture's
        # process-wide umask change brief and restore it for the other tests.
        import os
        previous = os.umask(0o077)
        try:
            worker.build(self.directory, self.fixture.contract, runner)
        finally:
            os.umask(previous)
        return calls

    def test_fixed_build_pins_complete_without_install_or_hardware_claim(self):
        self.intent()
        calls = self.synthetic_build()
        self.assertIn(["git", "-C", str(self.directory / "source"), "fetch", "--quiet", "--depth=1",
                       worker.SOURCE_URL, worker.SOURCE_COMMIT], calls)
        status = self.manager.status(self.fixture.owner, self.job_id)
        self.assertEqual(status["state"], "built_not_installed")
        self.assertFalse(status["installed"] or status["installation_ready"] or status["hardware_contacted"])
        self.assertEqual(len(calls), 6)
        (self.directory / "candidate/native-program").write_bytes(b"changed")
        with self.assertRaisesRegex(Exception, "usb_build_unverified"):
            self.manager.status(self.fixture.owner, self.job_id)

    def test_bad_pin_is_terminal_failure_and_recovery_inputs_remain(self):
        self.intent()
        self.synthetic_build(corrupt=True)
        self.assertEqual(self.manager.status(self.fixture.owner, self.job_id)["state"], "build_failed")
        self.assertTrue((self.directory / "profile.json").is_file())
        self.assertTrue((self.directory / "capture/usr/lib/libQt5Core.so.5.9.4").is_file())

    def test_changed_capture_never_reaches_source_fetch(self):
        self.intent()
        (self.directory / "capture/usr/lib/libQt5Core.so.5.9.4").write_bytes(b"changed")
        with self.assertRaisesRegex(Exception, "usb_build_unverified"), patch.object(worker, "run_owned") as run:
            worker.build(self.directory, self.fixture.contract, run)
        run.assert_not_called()

    def test_http_build_requires_the_page_owner_and_returns_only_typed_status(self):
        server = preparations.captures.server
        app = server.Companion(self.fixture.capture.usb, self.fixture.parent)
        nonce = app.page(self.fixture.owner)
        def request(path, body=None, owner=None):
            handler = object.__new__(server.Handler)
            handler.headers = {"X-Remote-User-Id": owner or self.fixture.owner,
                               "X-Qingping-Nonce": nonce, "Content-Type": "application/json"}
            handler.client_address, handler.path = ("172.30.32.2", 1234), path
            handler.server = SimpleNamespace(companion=app)
            raw = b"" if body is None else json.dumps(body).encode()
            handler.headers["Content-Length"] = str(len(raw))
            handler.rfile, handler.wfile = io.BytesIO(raw), io.BytesIO()
            statuses = []
            handler.send_response = statuses.append
            handler.send_header = lambda *_: None
            handler.end_headers = lambda: None
            (handler.do_GET if body is None else handler.do_POST)()
            return statuses[0], json.loads(handler.wfile.getvalue())
        with patch.object(worker.shutil, "disk_usage", return_value=SimpleNamespace(free=worker.MIN_FREE)), \
                patch.object(worker.subprocess, "Popen", return_value=SimpleNamespace(poll=lambda: None)) as spawn:
            self.assertEqual(request("/build", {"job_id": self.job_id}, "b" * 32)[0], 403)
            spawn.assert_not_called()
            code, result = request("/build", {"job_id": self.job_id})
            self.assertEqual((code, result["state"]), (200, "building"))
            self.assertEqual(request("/jobs/" + self.job_id + "/build"), (200, result))
            self.assertEqual(request("/build", {"job_id": self.job_id}), (403, {"error_code": "usb_build_consumed"}))
            self.assertEqual(spawn.call_count, 1)
            self.assertNotIn("profile_sha256", result)

    def test_authenticated_poll_renews_nonce_but_idle_or_other_owner_does_not(self):
        server = preparations.captures.server
        app = server.Companion(self.fixture.capture.usb, self.fixture.parent)
        with patch.object(server.time, "monotonic", return_value=0):
            nonce = app.page(self.fixture.owner)
        for moment in (1700, 3400):
            with patch.object(server.time, "monotonic", return_value=moment):
                app.session(self.fixture.owner, nonce)
        with patch.object(server.time, "monotonic", return_value=5000):
            with self.assertRaisesRegex(Exception, "usb_unauthorized"):
                app.session("b" * 32, nonce)
        with patch.object(server.time, "monotonic", return_value=5201):
            with self.assertRaisesRegex(Exception, "usb_unauthorized"):
                app.session(self.fixture.owner, nonce)

    @unittest.skipUnless(sys.platform == "linux", "WNOWAIT group retirement needs Linux")
    def test_real_owned_child_is_bounded_and_reaped_without_pid_files(self):
        with (self.directory / "owned-process.log").open("xb") as log:
            worker.run_owned([sys.executable, "-c", "pass"], self.directory, worker.environment(self.directory),
                             log, time.monotonic() + 5)
            with self.assertRaisesRegex(Exception, "usb_build_unverified"):
                worker.run_owned([sys.executable, "-c", "import time; time.sleep(10)"], self.directory,
                                 worker.environment(self.directory), log, time.monotonic() + 0.1)


if __name__ == "__main__":
    unittest.main()
