"""Night wake, inactivity deadline and persistent manual intent, including wrap."""
from pathlib import Path
import subprocess, tempfile, unittest
ROOT=Path(__file__).resolve().parents[1]
class DisplayWakeTests(unittest.TestCase):
 def test_night_interaction(self):
  with tempfile.TemporaryDirectory() as directory:
   out=Path(directory)/'wake'
   subprocess.run(['c++','-std=c++17','-Wall','-Wextra','-Werror','-fsanitize=address,undefined','-I',str(ROOT),str(ROOT/'tests/lite_display_wake.cpp'),'-o',str(out)],check=True)
   subprocess.run([str(out)],check=True)
