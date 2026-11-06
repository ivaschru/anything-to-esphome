"""Nine fixed synthetic files only; no actual ADB, USB or vendor payload."""
import hashlib
import io
import json
import os
from pathlib import Path
import tarfile
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import test_usb_companion as fixtures

server = fixtures.companion


class CaptureAdb(fixtures.FixtureAdb):
    def __init__(self, contents):
        super().__init__()
        self.contents, self.pulls = contents, []
        self.corrupt = False
        self.change_source = False

    def run(self, args, **options):
        if len(args) > 3 and args[3] == "pull":
            self.calls.append(args)
            self.assert_pull(args, options)
            source, destination = args[4:]
            target = Path(destination)
            assert target.is_file() and target.stat().st_mode & 0o777 == 0o600
            target.write_bytes(self.contents[source] + (b"corruption" if self.corrupt else b""))
            self.pulls.append(source)
            if self.change_source:
                self.replies[server.CONTRACT["files"][0]["command"]] = "changed during capture"
            return SimpleNamespace(returncode=0, stdout=b"fixed pull complete")
        return super().run(args, **options)

    def assert_pull(self, args, options):
        assert args[:4] == ["adb", "-s", "fixture", "pull"]
        assert args[4] in self.contents and len(args) == 6
        assert 0 < options["timeout"] <= 30


class UsbCaptureTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.root.chmod(0o700)
        self.contents = {file["path"]: ("synthetic-source-" + str(i)).encode()
                         for i, file in enumerate(server.CONTRACT["files"])}
        contract = {**server.CONTRACT, "files": [{**file, "size": len(self.contents[file["path"]]),
            "sha256": hashlib.sha256(self.contents[file["path"]]).hexdigest(),
            "expected": f"{len(self.contents[file['path']])} 1\n" +
                        hashlib.sha256(self.contents[file["path"]]).hexdigest() + " " + file["path"]}
            for file in server.CONTRACT["files"]]}
        self.enterContext(patch.object(server, "CONTRACT", contract))
        self.fake = CaptureAdb(self.contents)
        self.usb = server.UsbReads(run=self.fake.run, capture_root=self.root)

    def test_archive_has_exact_verified_files_private_modes_and_native_capture_report(self):
        data = self.usb.capture("fixture")
        with tarfile.open(fileobj=io.BytesIO(data)) as archive:
            files = [item for item in archive.getmembers() if item.isfile()]
            expected = {"qingping-cgs1-capture/" + name.lstrip("/") for name in self.contents}
            self.assertEqual({item.name for item in files}, expected | {"qingping-cgs1-capture/result.json"})
            for item in archive.getmembers():
                self.assertFalse(item.issym() or item.islnk())
                self.assertEqual(item.mode, 0o700 if item.isdir() else 0o600)
                self.assertEqual((item.uid, item.gid), (0, 0))
            for name, body in self.contents.items():
                self.assertEqual(archive.extractfile("qingping-cgs1-capture/" + name.lstrip("/")).read(), body)
            report = json.load(archive.extractfile("qingping-cgs1-capture/result.json"))
            self.assertEqual(report["stage"], "read_only_capture_complete")
            self.assertEqual(report["usb_transport"], "usb:1-1.2")
            self.assertEqual(report["device_writes"], 0)
            self.assertFalse(report["installed"] or report["installation_ready"])
        self.assertEqual(self.fake.pulls, list(self.contents))
        self.assertEqual(list(self.root.iterdir()), [], "Only the response retains archive bytes")
        self.assertTrue(all("push" not in call and "reboot" not in call for call in self.fake.calls))

    def test_corrupt_copy_and_source_changed_after_pull_never_return_partial_archive(self):
        for attribute in ("corrupt", "change_source"):
            fake = CaptureAdb(self.contents)
            setattr(fake, attribute, True)
            usb = server.UsbReads(run=fake.run, capture_root=self.root)
            with self.subTest(attribute=attribute), self.assertRaises(server.Refusal):
                usb.capture("fixture")
            self.assertEqual(list(self.root.iterdir()), [])

    def test_private_directory_and_explicit_usb_are_required_before_copy(self):
        self.root.chmod(0o755)
        with self.assertRaises(server.Refusal):
            self.usb.capture("fixture")
        self.assertFalse(self.fake.pulls)
        self.fake.calls.clear()
        with self.assertRaises(server.Refusal):
            self.usb.capture("127.0.0.1:5555")
        self.assertFalse(self.fake.calls)

    def test_owner_nonce_and_global_lease_remain_required_through_delivery(self):
        usb = SimpleNamespace(capture=lambda serial: b"synthetic tar", inspect=lambda serial: {}, devices=lambda: ["fixture"])
        app = server.Companion(usb)
        user, other = "a" * 32, "b" * 32
        nonce = app.page(user)
        with self.assertRaises(server.Refusal):
            app.capture(other, nonce, "fixture", lambda archive: archive)
        app.inspect(user, nonce, "fixture")  # Separate explicit read operation.
        def deliver(archive):
            self.assertEqual(archive, b"synthetic tar")
            with self.assertRaisesRegex(server.Refusal, "usb_busy"):
                app.discover(user, app.page(user))
            return "downloaded"
        self.assertEqual(app.capture(user, nonce, "fixture", deliver), "downloaded")
        with self.assertRaisesRegex(server.Refusal, "usb_selection_consumed"):
            app.capture(user, nonce, "fixture", deliver)
        self.assertFalse(app.device_lock.locked())
        nonce = app.page(user)
        with self.assertRaises(BrokenPipeError):
            app.capture(user, nonce, "fixture", lambda _: (_ for _ in ()).throw(BrokenPipeError()))
        self.assertFalse(app.device_lock.locked())

    def test_http_capture_delivers_only_to_the_current_ingress_owner(self):
        handler = object.__new__(server.Handler)
        handler.headers = {"X-Remote-User-Id": "a" * 32, "Content-Type": "application/json", "Content-Length": "20"}
        body = json.dumps({"serial": "fixture"}).encode()
        handler.headers["Content-Length"] = str(len(body))
        handler.client_address, handler.path = ("172.30.32.2", 1234), "/capture"
        app = server.Companion(self.usb)
        handler.headers["X-Qingping-Nonce"] = app.page("a" * 32)
        handler.server = SimpleNamespace(companion=app)
        handler.rfile, handler.wfile = io.BytesIO(body), io.BytesIO()
        statuses, headers = [], {}
        handler.send_response = statuses.append
        handler.send_header = lambda name, value: headers.update({name: value})
        handler.end_headers = lambda: None
        handler.do_POST()
        self.assertEqual(statuses, [200])
        self.assertEqual(headers["Content-Type"], "application/x-tar")
        self.assertIn("qingping-cgs1-capture.tar", headers["Content-Disposition"])
        self.assertEqual(int(headers["Content-Length"]), len(handler.wfile.getvalue()))
        self.assertIn("no-store", headers["Cache-Control"])
        with tarfile.open(fileobj=io.BytesIO(handler.wfile.getvalue())) as archive:
            self.assertEqual(len([item for item in archive if item.isfile()]), 10)


if __name__ == "__main__":
    unittest.main()
