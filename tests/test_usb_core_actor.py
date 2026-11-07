"""Actual finite pipe frames and owner/intent boundaries, without USB or SDK."""
import importlib.util
import io
import json
from pathlib import Path
from types import SimpleNamespace
import sys
import unittest
from unittest.mock import patch, Mock

import test_usb_preparation as prepared

ROOT = Path(__file__).resolve().parents[1]
with patch.object(sys, "path", [str(ROOT / "apps/monitor1_usb/rootfs"), *sys.path]):
    import core_actor
    import core_tools


class CoreActorTests(unittest.TestCase):
    def setUp(self):
        fixture = prepared.PreparationTests(methodName="runTest")
        fixture.setUp()
        self.addCleanup(fixture.doCleanups)
        self.fixture = fixture
        self.owner = fixture.owner
        self.usb_ready = Mock()
        self.companion = core_actor.Companion(usb=fixture.capture.usb, job_root=fixture.parent)
        self.actor = core_actor.Actor(self.companion, usb_ready=self.usb_ready)
        result, _ = self.actor.dispatch(self.request("page", None, None))
        self.nonce = result["nonce"]

    def request(self, operation, data=None, nonce="current"):
        return {"user": self.owner, "nonce": self.nonce if nonce == "current" else nonce,
                "operation": operation, "data": data}

    def test_page_and_status_do_not_start_usb_or_repeat_preparation(self):
        calls_before=list(self.fixture.capture.usb.run.__self__.calls)
        value, mime = self.actor.dispatch(self.request("jobs"))
        self.assertEqual(value, {"jobs": []})
        self.assertEqual(mime, "application/json")
        self.usb_ready.assert_not_called()
        self.assertEqual(self.fixture.capture.usb.run.__self__.calls, calls_before)

    def test_full_trial_fixed_route_and_status_keep_different_usb_authority(self):
        job = self.fixture.prepare()
        identity = job["job_id"]
        trials = self.companion.full_trials = SimpleNamespace(status=Mock(return_value={"synthetic": "status"}),
            start=Mock(return_value={"synthetic": "trial"}))
        self.assertEqual(self.actor.dispatch(self.request("jobs/" + identity + "/full-trial"))[0], {"synthetic": "status"})
        trials.status.assert_called_once_with(self.owner, identity)
        self.usb_ready.assert_not_called()
        body = {"job_id": identity, "expected_plan_sha256": "d" * 64, "experimental_reviewed": True}
        self.assertEqual(self.actor.dispatch(self.request("full-trial", body))[0], {"synthetic": "trial"})
        self.usb_ready.assert_called_once()
        trials.start.assert_called_once_with(self.owner, identity, "d" * 64, True)
        with self.assertRaises(core_actor.Refusal):
            self.actor.dispatch(self.request("full-trial", {**body, "duration": 0}))
        trials.start.assert_called_once()
        self.usb_ready.assert_called_once()

    def test_permanent_route_requires_separate_review_and_status_is_local(self):
        identity = self.fixture.prepare()["job_id"]
        operations = self.companion.full_activations = SimpleNamespace(status=Mock(return_value={"synthetic": "status"}),
            start=Mock(return_value={"synthetic": "active"}))
        self.assertEqual(self.actor.dispatch(self.request("jobs/" + identity + "/full-activate"))[0], {"synthetic": "status"})
        self.usb_ready.assert_not_called()
        body = {"job_id": identity, "expected_plan_sha256": "d" * 64, "experimental_reviewed": True}
        with self.assertRaises(core_actor.Refusal):
            self.actor.dispatch(self.request("full-activate", body))
        self.usb_ready.assert_not_called(); operations.start.assert_not_called()
        self.assertEqual(self.actor.dispatch(self.request("full-activate", {**body, "screen_reviewed": True}))[0], {"synthetic": "active"})
        operations.start.assert_called_once_with(self.owner, identity, "d" * 64, True, True)
        self.usb_ready.assert_called_once()

    def test_pm_route_has_exact_review_fields_and_status_never_opens_usb(self):
        identity = self.fixture.prepare()["job_id"]
        operations = self.companion.pm_extensions = SimpleNamespace(status=Mock(return_value={"synthetic": "status"}),
            start=Mock(return_value={"synthetic": "prepared"}))
        self.assertEqual(self.actor.dispatch(self.request("jobs/" + identity + "/pm-enable"))[0], {"synthetic": "status"})
        self.usb_ready.assert_not_called()
        body = {"job_id": identity, "expected_plan_sha256": "d" * 64, "experimental_reviewed": True}
        with self.assertRaises(core_actor.Refusal):self.actor.dispatch(self.request("pm-enable", {**body, "reboot": True}))
        self.usb_ready.assert_not_called(); operations.start.assert_not_called()
        self.assertEqual(self.actor.dispatch(self.request("pm-enable", body))[0], {"synthetic": "prepared"})
        operations.start.assert_called_once_with(self.owner, identity, "d" * 64, True)
        self.usb_ready.assert_called_once()

    def test_wrong_owner_nonce_and_unknown_operations_precede_hardware(self):
        for change in ({"user": "b" * 32}, {"nonce": "0" * 64},
                       {"operation": "shell"}, {"operation": "../../devices"}):
            request = {**self.request("devices"), **change}
            with self.assertRaises(core_actor.Refusal):
                self.actor.dispatch(request)
        self.usb_ready.assert_not_called()

    def test_actual_owner_profile_export_is_opaque_and_does_not_rekey(self):
        job = self.fixture.prepare()
        data, mime = self.actor.dispatch(self.request("export-profile", {"job_id": job["job_id"]}))
        self.assertEqual(mime, core_actor.PROFILE_MIME)
        status, _ = self.actor.dispatch(self.request("jobs/" + job["job_id"]))
        key = json.loads(data)["api_encryption_key"]
        self.assertNotIn(key, json.dumps(status))
        self.assertFalse(status["installed"])
        self.usb_ready.assert_not_called()

    def test_two_exact_frames_and_binary_length_preserve_stream_boundaries(self):
        requests = [self.request("jobs"), self.request("unknown")]
        wire = b"".join(str(len(raw)).encode() + b"\n" + raw for raw in
                        (json.dumps(value).encode() for value in requests))
        output = io.BytesIO()
        core_actor.serve(self.actor, io.BytesIO(wire), output)
        stream = io.BytesIO(output.getvalue())
        first = json.loads(stream.readline())
        self.assertTrue(first["ok"])
        self.assertEqual(json.loads(stream.read(first["length"])), {"jobs": []})
        second = json.loads(stream.readline())
        self.assertFalse(second["ok"])
        self.assertEqual(json.loads(stream.read(second["length"])), {"error_code": "usb_request_invalid"})
        self.assertEqual(stream.read(), b"")

    def test_partial_oversized_or_duplicate_request_never_runs_an_operation(self):
        for wire in (b"999999999\n", b"8\n{}", b"bad\n", b'18\n{"user":1,"user":2}'):
            actor = Mock()
            core_actor.serve(actor, io.BytesIO(wire), io.BytesIO())
            actor.dispatch.assert_not_called()


class CoreToolTests(unittest.TestCase):
    def test_manifest_has_exact_native_architecture_closures(self):
        manifest = json.loads(core_tools.MANIFEST)
        self.assertEqual(set(manifest["architectures"]), {"x86_64", "aarch64"})
        for pins in manifest["architectures"].values():
            self.assertEqual(len(pins["requested"]), 3)
            self.assertTrue(pins["requested"][0].startswith("android-tools-adb="))
            self.assertTrue(3 <= len(pins["packages"]) <= 128)
            for entry in pins["packages"]:
                self.assertRegex(entry["name"], r"^[a-zA-Z0-9_.+-]+\.apk$")
                self.assertRegex(entry["sha256"], r"^[a-f0-9]{64}$")

    def test_wrapper_quotes_paths_and_limits_library_environment_to_children(self):
        env = {"LD_LIBRARY_PATH": "/private/path with spaces/lib", "PERL5LIB": "/private/perl"}
        wrapper = core_tools.tool_wrapper(Path("/private/a'b/bin/adb"), env).decode()
        self.assertIn('"$@"', wrapper)
        self.assertIn("export LD_LIBRARY_PATH='/private/path with spaces/lib'", wrapper)
        self.assertNotIn("SUPERVISOR_TOKEN", wrapper)

    def test_merely_constructing_usb_reader_does_not_spawn_a_server(self):
        import tempfile
        with tempfile.TemporaryDirectory() as directory, patch.object(core_tools.subprocess, "Popen") as spawn:
            tools = core_tools.CoreTools(Path(directory).resolve())
            reader = tools.usb()
            self.assertEqual(reader.environment, {})
            tools.close()
            spawn.assert_not_called()

    def test_unsupported_platform_does_not_download_or_modify_packages(self):
        import tempfile
        with tempfile.TemporaryDirectory() as directory, patch.object(core_tools.platform, "system", return_value="Darwin"), patch.object(core_tools, "invoke") as run:
            tools = core_tools.CoreTools(Path(directory).resolve())
            with self.assertRaisesRegex(core_tools.Refusal, "usb_core_unsupported"):
                tools.prepare()
            run.assert_not_called()
