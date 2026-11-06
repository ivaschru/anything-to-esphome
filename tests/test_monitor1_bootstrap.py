"""Keep neutral launchers coupled to the actual runtime fingerprint gate."""
import hashlib
from pathlib import Path
import re
import shutil
import subprocess
import unittest

PORT = Path(__file__).resolve().parents[1] / "ports/monitor1"


class BootstrapSourcesTests(unittest.TestCase):
    def test_sources_match_compiled_fingerprints_and_parse_without_execution(self):
        pins = set(re.findall(r'"([0-9a-f]{64})"', (PORT / "network_preflight.h").read_text()))
        shell = shutil.which("sh")
        self.assertIsNotNone(shell, "A POSIX shell is needed for syntax-only validation")
        for name in ("launch.sh", "SnowApp-with-PM"):
            with self.subTest(script=name):
                path = PORT / "bootstrap" / name
                self.assertIn(hashlib.sha256(path.read_bytes()).hexdigest(), pins)
                # -n parses only. Never run a production-path launcher on a
                # developer host or CI runner, even as an apparent smoke test.
                result = subprocess.run([shell, "-n", str(path)], capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
