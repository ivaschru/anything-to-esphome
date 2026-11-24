"""Compile the firmware heat model and cover top-ups, cooling and restart."""

from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


class LiteChargeHeatTests(unittest.TestCase):
    def test_charge_thermal_history(self):
        with tempfile.TemporaryDirectory() as directory:
            executable = Path(directory) / "lite_charge_heat"
            subprocess.run(
                ["c++", "-std=c++17", "-Wall", "-Wextra", "-Werror", "-I", str(ROOT),
                 str(ROOT / "tests/lite_charge_heat.cpp"), "-o", str(executable)],
                check=True,
            )
            subprocess.run([str(executable)], check=True)
