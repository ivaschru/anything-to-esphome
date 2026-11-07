"""Explicit private downloads from synthetic jobs, never real owner secrets."""
import io
import json
import sys
import tarfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch
import test_usb_preparation as preparations

backups = sys.modules["backup_export"]


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.fixture = preparations.PreparationTests(methodName="runTest")
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.row = self.fixture.prepare()
        self.directory = self.fixture.parent / self.row["job_id"]

    def test_secret_profile_is_only_in_the_explicit_owned_download_not_metadata(self):
        raw = backups.profile_export(self.fixture.parent, self.fixture.owner, self.row["job_id"])
        self.assertEqual(raw, (self.directory / "profile.json").read_bytes())
        key = json.loads(raw)["api_encryption_key"]
        self.assertNotIn(key, json.dumps(preparations.jobs.job_status(self.fixture.parent, self.row["job_id"], self.fixture.owner)))
        with self.assertRaises(Exception):
            backups.profile_export(self.fixture.parent, "b" * 32, self.row["job_id"])

    def test_saved_originals_reexport_without_usb_and_corruption_has_no_partial_result(self):
        data = backups.capture_export(self.fixture.parent, self.fixture.owner, self.row["job_id"], self.fixture.contract)
        with tarfile.open(fileobj=io.BytesIO(data)) as archive:
            members = archive.getmembers()
            self.assertEqual(len(members), 10)
            self.assertTrue(all(member.isfile() and member.mode == 0o600 for member in members))
            self.assertEqual(archive.extractfile("qingping-cgs1-capture/result.json").read(),
                             (self.directory / "capture/result.json").read_bytes())
        (self.directory / "capture/usr/lib/libQt5Core.so.5.9.4").write_bytes(b"changed")
        with self.assertRaisesRegex(Exception, "usb_private_export_unverified"):
            backups.capture_export(self.fixture.parent, self.fixture.owner, self.row["job_id"], self.fixture.contract)

    def test_http_profile_is_an_owned_no_store_attachment_and_never_calls_usb(self):
        server = preparations.captures.server
        app = server.Companion(self.fixture.capture.usb, self.fixture.parent)
        nonce = app.page(self.fixture.owner)
        def request(owner):
            handler = object.__new__(server.Handler)
            raw = json.dumps({"job_id": self.row["job_id"]}).encode()
            handler.headers = {"X-Remote-User-Id": owner, "X-Qingping-Nonce": nonce,
                               "Content-Type": "application/json", "Content-Length": str(len(raw))}
            handler.client_address, handler.path = ("172.30.32.2", 1234), "/export-profile"
            handler.server = SimpleNamespace(companion=app)
            handler.rfile, handler.wfile = io.BytesIO(raw), io.BytesIO()
            statuses, headers = [], {}
            handler.send_response = statuses.append
            handler.send_header = lambda name, value: headers.update({name: value})
            handler.end_headers = lambda: None
            handler.do_POST()
            return statuses[0], headers, handler.wfile.getvalue()
        with patch.object(app.usb, "capture", side_effect=AssertionError("No USB download")), \
                patch.object(app.usb, "inspect", side_effect=AssertionError("No USB inspection")):
            status, headers, body = request(self.fixture.owner)
            self.assertEqual(status, 200)
            self.assertEqual(body, (self.directory / "profile.json").read_bytes())
            self.assertEqual(headers["Content-Type"], "application/vnd.qingping.private-profile+json")
            self.assertEqual(headers["Cache-Control"], "no-store")
            self.assertIn("attachment;", headers["Content-Disposition"])
            status, _, body = request("b" * 32)
            self.assertEqual(status, 403)
            self.assertEqual(json.loads(body), {"error_code": "usb_unauthorized"})


if __name__ == "__main__":
    unittest.main()
