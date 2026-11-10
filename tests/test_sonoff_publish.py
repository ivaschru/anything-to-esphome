"""Real atomic Git transport against disposable private bare repositories."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from test_sonoff import ROOT

sys.path.insert(0, str(ROOT / "tools"))
import publish_sonoff as publisher


class SonoffPublicationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / "work"
        self.remote = Path(self.temp.name) / "remote.git"
        self.command("git", "init", "--bare", str(self.remote))
        self.command("git", "init", str(self.root))
        self.git("config", "user.name", "Public fixture")
        self.git("config", "user.email", "fixture@example.invalid")
        self.git("remote", "add", "origin", str(self.remote))
        (self.root / "source").write_text("public source fixture")
        self.git("add", "source"); self.git("commit", "-m", "source")
        self.source = self.git("rev-parse", "HEAD").strip()
        self.original = {"firmware-catalog.json": b'{"fixture": true}\n', "native-lite.json": b'{"lite": 5}\n',
                         "native-lite-434.json": b'{"lite434": 4}\n', "native-future.json": b'{"future": true}\n'}
        self.head = publisher.gitpub.commit(self.root, self.original, self.source, "catalog fixture")
        self.git("push", "origin", self.head + ":" + publisher.gitpub.BRANCH)
        self.native = {"revision": 1, "public_version": 1, "sha256": "1" * 64}
        self.files = {"sonoff-s60tpf-template.bin": b"public-placeholder-app",
                      "sonoff-s60tpf-template.json": b'{"public": true}\n',
                      publisher.ENDPOINT: publisher.gitpub.encoded(self.native)}
        self.tag = "firmware-sonoff-s60tpf-v1"

    def tearDown(self): self.temp.cleanup()
    def command(self, *args): return subprocess.check_output(args, stderr=subprocess.DEVNULL, text=True)
    def git(self, *args): return self.command("git", "-C", str(self.root), *args)
    def publish(self, **kwargs):
        return publisher.publish(self.root, kwargs.get("files", self.files), kwargs.get("tag", self.tag),
                                 self.source, kwargs.get("head", self.head), self.root / "intent.json")

    def test_atomic_new_profile_preserves_all_qingping_and_future_endpoints(self):
        result = self.publish()
        self.assertEqual(result["state"], "published_experimental_native")
        for name, data in self.original.items():
            self.assertEqual(publisher.gitpub.read_object(self.root, result["catalog_head"], name), data)
        # The older Qingping publisher must preserve Sonoff/future endpoints
        # too, otherwise a later Lite release could silently withdraw them.
        retained = publisher.gitpub.native_catalog_files(self.root, result["catalog_head"])
        self.assertEqual(retained[publisher.ENDPOINT], self.files[publisher.ENDPOINT])
        self.assertEqual(retained["native-future.json"], self.original["native-future.json"])
        self.assertEqual(publisher.gitpub.remote_ref(self.root, "refs/tags/" + self.tag), result["tag_head"])
        replay = self.publish(head=result["catalog_head"])
        self.assertEqual(replay["state"], "already_published")
        self.assertEqual(json.loads((self.root / "intent.json").read_text())["state"], "consumed_before_atomic_push")

    def test_stale_cas_and_consumed_intent_never_push(self):
        with self.assertRaises(ValueError): self.publish(head="0" * 40)
        self.assertIsNone(publisher.gitpub.remote_ref(self.root, "refs/tags/" + self.tag))
        (self.root / "intent.json").write_text("already consumed")
        with self.assertRaises(FileExistsError): self.publish()
        self.assertIsNone(publisher.gitpub.remote_ref(self.root, "refs/tags/" + self.tag))
        self.assertEqual(publisher.gitpub.remote_ref(self.root, publisher.gitpub.BRANCH), self.head)

    def test_same_version_cannot_replace_original_app_or_native_manifest(self):
        result = self.publish()
        changed = {**self.files, "sonoff-s60tpf-template.bin": b"different app"}
        with self.assertRaises(ValueError): self.publish(files=changed, head=result["catalog_head"])
        self.assertEqual(publisher.gitpub.remote_ref(self.root, "refs/tags/" + self.tag), result["tag_head"])


if __name__ == "__main__": unittest.main()
