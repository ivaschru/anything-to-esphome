"""Native Lite source semantics, independent of any physical sensor or HA."""
from pathlib import Path
import subprocess
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]
class SourcesTests(unittest.TestCase):
    def test_measurement_units_expiry_rebinding_and_clear(self):
        with tempfile.TemporaryDirectory() as temp:
            target=Path(temp)/'sources'
            subprocess.run(['c++','-std=c++17','-Wall','-Wextra','-Werror','-fsanitize=address,undefined','-I',str(ROOT),str(ROOT/'tests/lite_ha_sources.cpp'),'-o',str(target)],check=True)
            subprocess.run([str(target)],check=True)
