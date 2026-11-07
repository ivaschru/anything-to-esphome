"""Publisher tests: independent model revisions and immutable public assets."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

from test_protocol import fixture, image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("firmware_publisher", ROOT / "tools/build_firmware_catalog.py")
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


class FirmwarePublisherTests(unittest.TestCase):
    def pair(self, version, public_version=None):
        binary = fixture(version.encode() + b"\0")
        manifest = json.dumps({"model": "CGDN1", "format": "esp32-app-fixed-slots-v1",
            "ui": version, **({"public_version": public_version} if public_version is not None else {}), "size": len(binary), "sha256": hashlib.sha256(binary).hexdigest(),
            "slots": {key: binary.count(marker) for key, marker in image.SLOTS.items()}}).encode()
        return binary, manifest

    def metadata(self, version="test-ui-1", revision=1):
        return {"lite": {"version": version, "revision": revision, "backend": "esp32-noise-app-v1",
                         "minimum_integration": "0.1.5", "summary": "Public Lite firmware"}}

    def test_installer_release_retains_exact_previous_firmware_entry(self):
        binary, manifest = self.pair("test-ui-1")
        old = publisher.build("v0.1.5", self.metadata(), binary, manifest)
        new = publisher.build("v0.1.6", self.metadata(), binary, manifest, old)
        self.assertEqual(new, old)
        self.assertIn("/v0.1.5/", new["releases"]["lite"]["image"]["url"])

    def test_changed_image_needs_new_native_version_and_profile_revision(self):
        binary, manifest = self.pair("test-ui-1")
        old = publisher.build("v0.1.5", self.metadata(), binary, manifest)
        changed, changed_manifest = self.pair("test-ui-2")
        with self.assertRaises(ValueError):
            publisher.build("v0.1.6", self.metadata("test-ui-2", 1), changed, changed_manifest, old)
        new = publisher.build("v0.1.6", self.metadata("test-ui-2", 2), changed, changed_manifest, old)
        self.assertEqual(new["releases"]["lite"]["revision"], 2)
        self.assertEqual(old["releases"]["lite"]["revision"], 1)
        self.assertIn("/v0.1.6/", new["releases"]["lite"]["image"]["url"])
        # Editing metadata alone cannot manufacture an update for identical bytes.
        with self.assertRaises(ValueError):
            publisher.build("v0.1.6", self.metadata("test-ui-1", 2), binary, manifest, old)

    def test_old_public_profile_generations_survive_several_new_releases(self):
        index=None
        for revision in (2,3,4):
            version=f"public-ui-{revision}"
            binary,manifest=self.pair(version)
            index=publisher.build(f"v0.1.{revision+7}",self.metadata(version,revision),binary,manifest,index)
        item=publisher.catalog.parse_catalog(index)["lite"]
        self.assertEqual(dict(item.adoption_versions),{"public-ui-2":2,"public-ui-3":3})
        # HACS-only release retains the full history and immutable image URL.
        same=publisher.build("v0.1.12",self.metadata("public-ui-4",4),binary,manifest,index)
        self.assertEqual(same,index)

    def test_next_public_version_is_required_for_a_changed_numbered_firmware(self):
        binary,manifest=self.pair("build-one",1)
        first=self.metadata("build-one",2);first["lite"]["public_version"]=1
        previous=publisher.build("v0.2.0",first,binary,manifest)
        binary,manifest=self.pair("build-two",1)
        second=self.metadata("build-two",3);second["lite"]["public_version"]=1
        with self.assertRaises(ValueError):publisher.build("v0.2.1",second,binary,manifest,previous)
        second["lite"]["public_version"]=2
        binary,manifest=self.pair("build-two",2)
        current=publisher.build("v0.2.1",second,binary,manifest,previous)
        self.assertEqual(publisher.catalog.parse_catalog(current)["lite"].display_version,"2")

    def test_mismatched_pair_prerelease_or_unqualified_model_refused(self):
        binary, manifest = self.pair("test-ui-1")
        for tag in ("main", "v0.1.5-beta", "v0.1.5/other"):
            with self.assertRaises(ValueError): publisher.build(tag, self.metadata(), binary, manifest)
        data = json.loads(manifest); data["sha256"] = "0" * 64
        with self.assertRaises(ValueError): publisher.build("v0.1.5", self.metadata(), binary, json.dumps(data).encode())
        data = copy.deepcopy(self.metadata()); data["monitor1-s8"] = data.pop("lite")
        with self.assertRaises(ValueError): publisher.build("v0.1.5", data, binary, manifest)


if __name__ == "__main__": unittest.main()
