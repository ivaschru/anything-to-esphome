"""Private profile jobs from synthetic fixed-file captures; no device/build."""
import copy
import base64
import importlib.util
import io
import json
from pathlib import Path
import sys
import tarfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import test_usb_capture as captures

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("usb_job_preparation", ROOT / "apps/monitor1_usb/rootfs/preparation.py")
jobs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(jobs)


class PreparationTests(unittest.TestCase):
    def setUp(self):
        self.capture = captures.UsbCaptureTests(methodName="runTest")
        self.capture.setUp()
        self.addCleanup(self.capture.doCleanups)
        self.data = self.capture.usb.capture("fixture")
        self.contract = captures.server.CONTRACT
        self.parent = self.capture.root / "jobs"
        self.parent.mkdir(mode=0o700)
        self.owner = "a" * 32

    def prepare(self, data=None):
        return jobs.prepare_job(self.data if data is None else data, self.parent, self.owner, "Qingping fixture", self.contract)

    def rewrite(self, alter):
        with tarfile.open(fileobj=io.BytesIO(self.data)) as archive:
            entries = [(copy.copy(item), archive.extractfile(item).read() if item.isfile() else b"") for item in archive]
        entries = alter(entries)
        output = io.BytesIO()
        with tarfile.open(fileobj=output, mode="w", format=tarfile.USTAR_FORMAT) as archive:
            for item, body in entries:
                item.size = len(body)
                archive.addfile(item, io.BytesIO(body) if body else None)
        return output.getvalue()

    def test_profile_is_private_compatible_and_status_never_exposes_its_noise_key(self):
        summary = self.prepare()
        directory = self.parent / summary["job_id"]
        with patch.object(sys, "path", [str(ROOT / "ports/monitor1"), *sys.path]):
            import build_candidate
            profile, _ = build_candidate.read_profile(directory / "profile.json")
        self.assertEqual(profile["wlan_mac"], "02:00:00:00:00:01")
        self.assertNotEqual(profile["api_mac"], profile["wlan_mac"])
        self.assertTrue(int(profile["api_mac"][:2], 16) & 2)
        self.assertEqual(summary["node_name"], profile["node_name"])
        self.assertEqual(summary["stage"], "profile_prepared")
        self.assertFalse(summary["installed"] or summary["installation_ready"])
        self.assertTrue(summary["live_recheck_required"])
        status = jobs.job_status(self.parent, summary["job_id"], self.owner)
        self.assertEqual(status, summary)
        self.assertNotIn(profile["api_encryption_key"], json.dumps(status))
        self.assertNotIn("profile_sha256", status)
        for path in directory.rglob("*"):
            self.assertEqual(path.stat().st_mode & 0o777, 0o700 if path.is_dir() else 0o600)
        second = self.prepare()
        another = json.loads((self.parent / second["job_id"] / "profile.json").read_text())
        self.assertEqual(another["api_mac"], profile["api_mac"])
        self.assertNotEqual(another["api_encryption_key"], profile["api_encryption_key"])

    def test_browser_claim_is_preserved_as_browser_and_does_not_become_native_transport(self):
        def browser(entries):
            for item, body in entries:
                if item.name.endswith("/result.json"):
                    report = json.loads(body)
                    report.pop("usb_transport")
                    report.update(stage="read_only_browser_capture_complete", transport="browser_usb")
                    body = json.dumps(report).encode()
                yield item, body
        summary = self.prepare(self.rewrite(lambda entries: list(browser(entries))))
        self.assertEqual(summary["transport"], "browser_usb")
        report = json.loads((self.parent / summary["job_id"] / "capture/result.json").read_text())
        self.assertNotIn("usb_transport", report)
        self.assertTrue(summary["live_recheck_required"])

    def test_duplicate_links_traversal_corruption_and_trailing_payload_refuse_before_writes(self):
        attacks = []
        attacks.append(self.rewrite(lambda entries: [*entries, entries[-1]]))
        def linked(entries):
            entries[-1][0].type, entries[-1][0].linkname = tarfile.SYMTYPE, "../../other"
            return entries
        attacks.append(self.rewrite(linked))
        def traversal(entries):
            entries[-1][0].name = "../escape"
            return entries
        attacks.append(self.rewrite(traversal))
        def corrupted(entries):
            for i, (item, body) in enumerate(entries):
                if item.isfile() and not item.name.endswith("/result.json"):
                    entries[i] = item, bytes([body[0] ^ 1]) + body[1:]
                    break
            return entries
        attacks.append(self.rewrite(corrupted))
        attacks.append(self.data + b"unexpected tail")
        for data in attacks:
            with self.subTest(size=len(data)), self.assertRaises(jobs.PreparationError):
                self.prepare(data)
            self.assertEqual(list(self.parent.iterdir()), [])

    def test_bad_metadata_and_profile_name_refuse_without_jobs(self):
        def extra(entries):
            for i, (item, body) in enumerate(entries):
                if item.name.endswith("/result.json"):
                    report = json.loads(body)
                    report["installed"] = True
                    entries[i] = item, json.dumps(report).encode()
            return entries
        with self.assertRaises(jobs.PreparationError):
            self.prepare(self.rewrite(extra))
        for name in ("", "line\nbreak", "bad/name", "x" * 121):
            with self.assertRaises(jobs.PreparationError):
                jobs.prepare_job(self.data, self.parent, self.owner, name, self.contract)
        self.assertEqual(list(self.parent.iterdir()), [])

    def test_wrong_owner_tampered_profile_and_symlink_are_indistinguishable_unavailable(self):
        summary = self.prepare()
        for owner in ("b" * 32, "invalid"):
            with self.assertRaisesRegex(jobs.PreparationError, "^usb_job_unavailable$"):
                jobs.job_status(self.parent, summary["job_id"], owner)
        directory = self.parent / summary["job_id"]
        (directory / "profile.json").write_bytes(b"tampered")
        with self.assertRaisesRegex(jobs.PreparationError, "^usb_job_unavailable$"):
            jobs.job_status(self.parent, summary["job_id"], self.owner)
        (directory / "job.json").unlink()
        (directory / "job.json").symlink_to(directory / "profile.json")
        with self.assertRaisesRegex(jobs.PreparationError, "^usb_job_unavailable$"):
            jobs.job_status(self.parent, summary["job_id"], self.owner)

    def test_retained_jobs_are_bounded_and_never_implicitly_pruned(self):
        for i in range(8):
            (self.parent / str(i)).mkdir(mode=0o700)
        with self.assertRaisesRegex(jobs.PreparationError, "usb_job_limit"):
            self.prepare()
        self.assertEqual(len(list(self.parent.iterdir())), 8)

    def test_explicit_request_is_consumed_before_secret_generation_and_reconciles_only_by_read(self):
        request_id = "c" * 32
        first = jobs.prepare_job(self.data, self.parent, self.owner, "fixture", self.contract, request_id)
        before = (self.parent / request_id / "profile.json").read_bytes()
        with patch.object(jobs.secrets, "token_bytes", side_effect=AssertionError("Do not regenerate a key")):
            with self.assertRaisesRegex(jobs.PreparationError, "usb_preparation_unverified"):
                jobs.prepare_job(self.data, self.parent, self.owner, "fixture", self.contract, request_id)
        self.assertEqual(jobs.job_status(self.parent, request_id, self.owner), first)
        self.assertEqual((self.parent / request_id / "profile.json").read_bytes(), before)
        self.assertEqual(len(list(self.parent.iterdir())), 1)

    def test_companion_prepare_is_owned_bounded_and_keeps_keys_out_of_http_results(self):
        server = captures.server
        app = server.Companion(self.capture.usb, self.parent)
        nonce = app.page(self.owner)
        count = [0]
        def read():
            count[0] += 1
            return {"request_id": "d" * 32, "friendly_name": "fixture", "capture": base64.b64encode(self.data).decode()}
        with self.assertRaisesRegex(server.Refusal, "usb_unauthorized"):
            app.prepare("b" * 32, nonce, read, lambda value: value)
        self.assertEqual(count[0], 0)
        def deliver(value):
            self.assertTrue(app.device_lock.locked())
            return value
        result = app.prepare(self.owner, nonce, read, deliver)
        self.assertEqual(app.status(self.owner, nonce, "d" * 32), result)
        self.assertNotIn("api_encryption_key", json.dumps(result))
        with self.assertRaisesRegex(server.PreparationError, "usb_preparation_unverified"):
            app.prepare(self.owner, nonce, read, deliver)
        self.assertFalse(app.device_lock.locked())
        with self.assertRaisesRegex(server.PreparationError, "usb_job_unavailable"):
            app.status("b" * 32, app.page("b" * 32), "d" * 32)

    def test_native_prepare_uses_the_existing_fixed_capture_and_never_a_supplied_path(self):
        server = captures.server
        app = server.Companion(self.capture.usb, self.parent)
        nonce = app.page(self.owner)
        result = app.prepare(self.owner, nonce, lambda: {"request_id": "e" * 32,
            "friendly_name": "fixture", "serial": "fixture"}, lambda value: value)
        self.assertEqual(result["transport"], "ha_usb")
        self.assertEqual(len(self.capture.fake.pulls), 18)  # Original fixture + this explicit read capture.
        with self.assertRaises(server.Refusal):
            app.prepare(self.owner, nonce, lambda: {"request_id": "f" * 32,
                "friendly_name": "fixture", "path": "/other/private"}, lambda value: value)

    def test_http_prepare_and_get_status_hide_secrets_and_never_resume_a_request(self):
        server = captures.server
        app = server.Companion(self.capture.usb, self.parent)
        nonce = app.page(self.owner)
        def request(path, body=None, owner=None):
            handler = object.__new__(server.Handler)
            handler.headers = {"X-Remote-User-Id": self.owner if owner is None else owner,
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
        body = {"request_id": "f" * 32, "friendly_name": "fixture", "serial": "fixture"}
        status, result = request("/prepare", body)
        self.assertEqual(status, 200)
        self.assertEqual(result["stage"], "profile_prepared")
        self.assertNotIn("api_encryption_key", result)
        self.assertEqual(request("/jobs/" + "f" * 32), (200, result))
        self.assertEqual(request("/jobs"), (200, {"jobs": [result]}))
        self.assertEqual(request("/prepare", body), (403, {"error_code": "usb_preparation_unverified"}))
        self.assertEqual(request("/jobs/" + "f" * 32, owner="b" * 32)[0], 403)

    def test_owner_list_recovers_completed_and_interrupted_jobs_without_regenerating_secrets(self):
        complete = self.prepare()
        request_id = "c" * 32
        with patch.object(jobs.secrets, "token_bytes", side_effect=RuntimeError("Synthetic entropy failure")):
            with self.assertRaises(RuntimeError):
                jobs.prepare_job(self.data, self.parent, self.owner, "incomplete fixture", self.contract, request_id)
        rows = jobs.available_jobs(self.parent, self.owner)["jobs"]
        self.assertEqual({row["job_id"] for row in rows}, {complete["job_id"], request_id})
        partial = next(row for row in rows if row["job_id"] == request_id)
        self.assertEqual(partial["stage"], "preparation_unverified")
        self.assertFalse((self.parent / request_id / "profile.json").exists())
        self.assertEqual(jobs.available_jobs(self.parent, "b" * 32), {"jobs": []})
        with patch.object(jobs.secrets, "token_bytes", side_effect=AssertionError("Never regenerate")):
            self.assertEqual(jobs.job_status(self.parent, request_id, self.owner), partial)
            with self.assertRaises(jobs.PreparationError):
                jobs.prepare_job(self.data, self.parent, self.owner, "incomplete fixture", self.contract, request_id)


if __name__ == "__main__":
    unittest.main()
