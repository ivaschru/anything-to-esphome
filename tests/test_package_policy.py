"""A self-consistent checksum alone must not admit an obsolete PM template."""
from pathlib import Path
import hashlib
import json
import runpy
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]


class PackagePolicyTests(unittest.TestCase):
    def package(self, policy, source_hash_matches=True, corrupt_core=False, include434=True):
        # Run the actual packager in a disposable miniature source tree. The
        # binary deliberately has a correct digest in every refusal scenario.
        with tempfile.TemporaryDirectory(prefix="qingping-package-policy-") as d:
            root = Path(d)
            (root / "tools").mkdir()
            shutil.copyfile(ROOT / "tools/package_release.py", root / "tools/package_release.py")
            shutil.copyfile(ROOT / "tools/pm_policy.py", root / "tools/pm_policy.py")
            # The actual HACS package now requires its shared Core worker/UI.
            # Carry the real fixed public source set into this fixture instead
            # of bypassing that guard or substituting a fake successful check.
            definition = runpy.run_path(str(ROOT / "tools/monitor1-usb/package_core.py"))
            generator = root / "tools/monitor1-usb/package_core.py"
            generator.parent.mkdir(parents=True)
            shutil.copyfile(ROOT / "tools/monitor1-usb/package_core.py", generator)
            for name in (*definition["FILES"], *("static/"+n for n in definition["ASSETS"])):
                target = root / "apps/monitor1_usb/rootfs" / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / "apps/monitor1_usb/rootfs" / name, target)
            definition["package"](root)
            if corrupt_core:
                (root / "custom_components/qingping_esphome/monitor1_worker/core_actor.py").write_text("changed worker fixture")
            firmware = root / "custom_components/qingping_esphome/firmware"
            firmware.mkdir(parents=True)
            from tools.pm_policy import PATHS, digest
            for name in PATHS:
                path=root/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text("isolated source fixture")
            binary = b"isolated binary fixture"
            manifest = {
                "sha256": hashlib.sha256(binary).hexdigest(),
                "pm_source_sha256": digest(root)
                if source_hash_matches else "0" * 64,
            }
            if policy is not None:
                manifest["pm_policy"] = policy
            (firmware / "lite-template.bin").write_bytes(binary)
            (firmware / "lite-template.json").write_text(json.dumps(manifest))
            from tools import lite434_source
            for name in lite434_source.RECIPE_PATHS:
                target = root / name; target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / name, target)
            shutil.copytree(ROOT / "ports/lite-434", root / "ports/lite-434")
            if include434:
                binary434 = b"independent polling-only template fixture"
                (firmware / "lite-434-template.bin").write_bytes(binary434)
                (firmware / "lite-434-template.json").write_text(json.dumps({
                    "profile": "lite-434", "source_stock_version": "4.3.4", "hardware": "0001",
                    "pm_policy": lite434_source.POLICY, "size": len(binary434),
                    "sha256": hashlib.sha256(binary434).hexdigest(),
                    "release_source_sha256": lite434_source.source_digest(root),
                }))
            # The multi-brand ZIP must carry an independently verified C3
            # template too. Synthetic public app only; never a household image.
            from test_sonoff import fixture, image
            for name in ("tools/build_sonoff.py", "firmware/sonoff-release.json",
                         "custom_components/qingping_esphome/sonoff_image.py"):
                target = root / name; target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / name, target)
            shutil.copytree(ROOT / "ports/sonoff_s60", root / "ports/sonoff_s60")
            sonoff = runpy.run_path(str(root / "tools/build_sonoff.py"))
            c3 = fixture()
            (firmware / "sonoff-s60tpf-template.bin").write_bytes(c3)
            (firmware / "sonoff-s60tpf-template.json").write_text(json.dumps({
                "profile": "sonoff-s60tpf", "source_sha256": sonoff["source_digest"](),
                "size": len(c3), "sha256": hashlib.sha256(c3).hexdigest(),
                "native_update": {"format": "anything-native-update-v1", "patches": image.patch_table(c3)},
            }))
            result = subprocess.run([sys.executable, str(root / "tools/package_release.py")],
                                    capture_output=True, text=True)
            archive = root / ".build/qingping_esphome.zip"
            if result.returncode == 0:
                with zipfile.ZipFile(archive) as z:
                    self.assertEqual(z.read("firmware/lite-template.bin"), binary)
                    self.assertEqual(z.read("firmware/lite-434-template.bin"), binary434)
            else:
                self.assertFalse(archive.exists(), "A refusal must not emit a release ZIP")
            return result

    def test_old_manifest_refused_despite_valid_binary_digest(self):
        result = self.package(None)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Rebuild the public Lite template", result.stderr)

    def test_changed_pm_source_requires_template_rebuild(self):
        result = self.package("quiet-scd4x-window-v1", source_hash_matches=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Template PM source does not match", result.stderr)

    def test_matching_policy_source_and_binary_produce_hacs_layout(self):
        result = self.package("quiet-scd4x-window-v1")
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_stale_embedded_worker_refuses_the_entire_hacs_archive(self):
        result = self.package("quiet-scd4x-window-v1", corrupt_core=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Stale generated Core package", result.stderr)

    def test_selectable_factory434_without_its_pair_cannot_ship(self):
        result = self.package("quiet-scd4x-window-v1", include434=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("lite-434-template.bin", result.stderr)
