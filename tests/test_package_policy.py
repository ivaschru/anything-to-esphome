"""A self-consistent checksum alone must not admit an obsolete PM template."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]


class PackagePolicyTests(unittest.TestCase):
    def package(self, policy, source_hash_matches=True):
        # Run the actual packager in a disposable miniature source tree. The
        # binary deliberately has a correct digest in every refusal scenario.
        with tempfile.TemporaryDirectory(prefix="qingping-package-policy-") as d:
            root = Path(d)
            (root / "tools").mkdir()
            shutil.copyfile(ROOT / "tools/package_release.py", root / "tools/package_release.py")
            firmware = root / "custom_components/qingping_esphome/firmware"
            firmware.mkdir(parents=True)
            header = root / "ports/lite/components/cgdn1_pm/cgdn1_pm.h"
            header.parent.mkdir(parents=True)
            header.write_text("isolated source fixture")
            binary = b"isolated binary fixture"
            manifest = {
                "sha256": hashlib.sha256(binary).hexdigest(),
                "pm_source_sha256": hashlib.sha256(header.read_bytes()).hexdigest()
                if source_hash_matches else "0" * 64,
            }
            if policy is not None:
                manifest["pm_policy"] = policy
            (firmware / "lite-template.bin").write_bytes(binary)
            (firmware / "lite-template.json").write_text(json.dumps(manifest))
            result = subprocess.run([sys.executable, str(root / "tools/package_release.py")],
                                    capture_output=True, text=True)
            archive = root / ".build/qingping_esphome.zip"
            if result.returncode == 0:
                with zipfile.ZipFile(archive) as z:
                    self.assertEqual(z.read("firmware/lite-template.bin"), binary)
            else:
                self.assertFalse(archive.exists(), "A refusal must not emit a release ZIP")
            return result

    def test_old_manifest_refused_despite_valid_binary_digest(self):
        result = self.package(None)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Rebuild the public Lite template", result.stderr)

    def test_changed_pm_source_requires_template_rebuild(self):
        result = self.package("polling-only-gpio13-high-v1", source_hash_matches=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Template PM source does not match", result.stderr)

    def test_matching_policy_source_and_binary_produce_hacs_layout(self):
        result = self.package("polling-only-gpio13-high-v1")
        self.assertEqual(result.returncode, 0, result.stderr)
