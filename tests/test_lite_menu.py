"""Exercise real menu drafts, remote refresh, bounds and independent confirmations."""
from pathlib import Path
import subprocess
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]
class LiteMenuTests(unittest.TestCase):
    def test_transactional_menu(self):
        with tempfile.TemporaryDirectory() as d:
            out=Path(d)/'menu'
            subprocess.run(['c++','-std=c++17','-Wall','-Wextra','-Werror','-fsanitize=address,undefined','-I',str(ROOT),str(ROOT/'tests/lite_menu.cpp'),'-o',str(out)],check=True)
            subprocess.run([str(out)],check=True)
