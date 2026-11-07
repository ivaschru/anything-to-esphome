"""Release reuse guards: synthetic ZIP fixtures, no network/compiler/device."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import subprocess
import unittest
from unittest.mock import patch
import zipfile
from test_protocol import fixture, image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("release_template", ROOT / "tools/prepare_release_template.py")
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ReleaseTemplateTests(unittest.TestCase):
    def current_fixture(self):
        root=Path(self.enterContext(tempfile.TemporaryDirectory())).resolve()
        version="2026.11.07-ui25-profile1"
        for name in ("custom_components/qingping_esphome/image.py","custom_components/qingping_esphome/firmware_catalog.py","tools/firmware_source.py","tools/pm_policy.py"):
            path=root/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes((ROOT/name).read_bytes())
        path=root/"ports/lite/source.h";path.parent.mkdir(parents=True);path.write_text("// public synthetic source\n")
        (root/"tools/build_lite.py").write_text("# synthetic compiler recipe\n")
        info={"version":version,"revision":2,"backend":"esp32-noise-app-v1","minimum_integration":"0.1.9","summary":"Public test release"}
        path=root/"firmware/releases.json";path.parent.mkdir();path.write_text(json.dumps({"lite":info}))
        binary=fixture(version.encode())
        manifest=json.dumps({"model":"CGDN1","format":"esp32-app-fixed-slots-v1","ui":version,"size":len(binary),"sha256":hashlib.sha256(binary).hexdigest(),"slots":{k:binary.count(v) for k,v in image.SLOTS.items()},"release_source_sha256":release.source_digest(root)}).encode()
        prefix="https://github.com/ivaschru/qingping-esphome/releases/download/v0.1.9/"
        def asset(n,data):return {"url":prefix+n,"size":len(data),"sha256":hashlib.sha256(data).hexdigest()}
        index={"format":"qingping-esphome-firmware-catalog-v1","releases":{"lite":{**info,"image":asset("lite-template.bin",binary),"manifest":asset("lite-template.json",manifest),"release_url":"https://github.com/ivaschru/qingping-esphome/releases/tag/v0.1.9"}}}
        mapping={"https://raw.githubusercontent.com/ivaschru/qingping-esphome/firmware-catalog/firmware-catalog.json":json.dumps(index).encode(),prefix+"lite-template.bin":binary,prefix+"lite-template.json":manifest}
        calls=[]
        def opener(url,maximum):calls.append(url);return mapping[url]
        return root,binary,manifest,opener,calls,mapping

    def test_current_firmware_reuses_exact_published_pair_without_rebuild(self):
        root,binary,manifest,opener,calls,_=self.current_fixture()
        with patch.object(release,"git_read",return_value=""):
            self.assertTrue(release.reuse_current(root,opener))
        output=root/"custom_components/qingping_esphome/firmware"
        self.assertEqual((output/"lite-template.bin").read_bytes(),binary)
        self.assertEqual((output/"lite-template.json").read_bytes(),manifest)
        self.assertEqual(len(calls),3)

    def test_only_absent_new_channel_uses_legacy_build_bootstrap(self):
        root,binary,manifest,opener,calls,mapping=self.current_fixture()
        primary=next(iter(mapping));legacy="https://github.com/ivaschru/qingping-esphome/releases/latest/download/firmware-catalog.json"
        mapping[legacy]=mapping[primary];mapping[primary]=None
        with patch.object(release,"git_read",return_value=""):
            self.assertTrue(release.reuse_current(root,opener))
        self.assertEqual(calls[:2],[primary,legacy])

    def test_same_version_with_changed_source_refuses_before_any_image_write(self):
        root,_,_,opener,_,_=self.current_fixture()
        (root/"ports/lite/source.h").write_text("// different committed source\n")
        with patch.object(release,"git_read",return_value=""),self.assertRaises(RuntimeError):
            release.reuse_current(root,opener)
        self.assertFalse((root/"custom_components/qingping_esphome/firmware").exists())

    def test_existing_current_output_never_downloads_or_overwrites(self):
        root,_,_,opener,calls,_=self.current_fixture()
        out=root/"custom_components/qingping_esphome/firmware";out.mkdir()
        (out/"lite-template.bin").write_bytes(b"preserve")
        with self.assertRaises(RuntimeError):release.reuse_current(root,opener)
        self.assertEqual(calls,[])
        self.assertEqual((out/"lite-template.bin").read_bytes(),b"preserve")

    def test_current_asset_digest_failure_is_not_permission_to_compile(self):
        root,_,_,opener,_,mapping=self.current_fixture()
        url=next(k for k in mapping if k.endswith("lite-template.bin"));mapping[url]+=b"tamper"
        with patch.object(release,"git_read",return_value=""),self.assertRaises(RuntimeError):
            release.reuse_current(root,opener)
        self.assertFalse((root/"custom_components/qingping_esphome/firmware").exists())

    def fixture(self):
        binary = b"explicit synthetic test image, never firmware"
        digest = hashlib.sha256(binary).hexdigest()
        data = io.BytesIO()
        with zipfile.ZipFile(data, "w") as archive:
            archive.writestr("firmware/lite-template.bin", binary)
            archive.writestr("firmware/lite-template.json", json.dumps({"sha256": digest}).encode())
            archive.writestr("../../do-not-extract", b"not an output")
            archive.writestr("manifest.json", b"not an output")
        raw = data.getvalue()
        self.enterContext(patch.multiple(release, ARCHIVE_SHA=hashlib.sha256(raw).hexdigest(),
                                         IMAGE_SHA=digest, IMAGE_SIZE=len(binary)))
        return raw

    def test_only_the_fixed_matched_pair_is_written_and_unknown_members_are_not_extracted(self):
        raw = self.fixture()
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve();parent = root / "custom_components/qingping_esphome";parent.mkdir(parents=True)
            opener = lambda url, timeout: io.BytesIO(raw)
            release.reuse(root, opener=opener)
            output = parent / "firmware"
            self.assertEqual(sorted(path.name for path in output.iterdir()), ["lite-template.bin","lite-template.json"])
            self.assertFalse((root / "do-not-extract").exists())
            self.assertTrue(all(path.stat().st_mode & 0o777 == 0o600 for path in output.iterdir()))

    def test_tampered_archive_or_mismatched_manifest_never_produces_a_pair(self):
        raw = self.fixture()
        with self.assertRaises(RuntimeError):
            release.verified_files(raw + b"tampered")
        with patch.object(release, "IMAGE_SHA", "f"*64):
            with self.assertRaises(RuntimeError):
                release.verified_files(raw)

    def test_existing_outputs_are_preserved_before_any_download(self):
        self.fixture()
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve();output = root / "custom_components/qingping_esphome/firmware";output.mkdir(parents=True)
            file = output / "lite-template.bin";file.write_bytes(b"another build must be preserved")
            with patch.object(release.urllib.request, "urlopen") as opener:
                with self.assertRaises(RuntimeError):
                    release.reuse(root, opener=opener)
                opener.assert_not_called()
            self.assertEqual(file.read_bytes(), b"another build must be preserved")

    def test_unavailable_or_dirty_source_never_becomes_permission_to_rebuild(self):
        for evidence in (RuntimeError("Git unavailable"), " M ports/lite/cgdn1.yaml"):
            with self.subTest(evidence=type(evidence).__name__):
                kwargs = {"side_effect":evidence} if isinstance(evidence, Exception) else {"return_value":evidence}
                with patch.object(release, "git_read", **kwargs), patch.object(release, "reuse") as reused, \
                        patch.object(release.subprocess, "run") as compiled:
                    with self.assertRaises(RuntimeError):
                        release.main()
                    reused.assert_not_called();compiled.assert_not_called()

    def test_real_committed_source_matches_but_dirty_or_changed_firmware_cannot_reuse(self):
        # Exercise actual Git evidence, not a fabricated tree string. This is
        # a new local fixture repository with no remote, credentials or image.
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            contents = {"ports/lite/example.yaml": b"explicit compile fixture\n",
                        "tools/build_lite.py": b"# synthetic recipe\n",
                        "custom_components/qingping_esphome/image.py": b"# synthetic personalizer\n"}
            for name, data in contents.items():
                path = root / name; path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(data)
            def git(*args):
                return subprocess.check_output(["git", "-c", "user.name=Release fixture",
                    "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", *args],
                    cwd=root, stderr=subprocess.DEVNULL).decode().strip()
            git("init", "-q"); git("add", "--", *contents); git("commit", "-qm", "synthetic source")
            hashes = {name: hashlib.sha256(contents[name]).hexdigest() for name in release.SOURCE_SHAS}
            with patch.object(release, "LITE_TREE", git("rev-parse", "HEAD:ports/lite")), \
                    patch.object(release, "SOURCE_SHAS", hashes):
                self.assertTrue(release.compatible(root))
                changed = root / "ports/lite/example.yaml"; changed.write_bytes(b"new compile fixture\n")
                with self.assertRaises(RuntimeError):
                    release.compatible(root)
                git("add", "--", "ports/lite/example.yaml"); git("commit", "-qm", "new synthetic source")
                self.assertFalse(release.compatible(root))
