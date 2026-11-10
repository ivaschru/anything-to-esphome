"""Actual shared MCU receiver under sanitizers, with synthetic wire bytes."""
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class McuReceiverTests(unittest.TestCase):
    def test_portable_receiver(self):
        with tempfile.TemporaryDirectory(prefix="qingping-mcu4x-") as directory:
            for name in ("test_mcu421", "test_mcu_serial", "test_mcu_telemetry", "test_mcu_poll_probe"):
                with self.subTest(name=name):
                    binary = Path(directory) / name
                    subprocess.run(["c++", "-std=c++17", "-Wall", "-Wextra", "-Werror",
                                    "-fsanitize=address,undefined", "-fno-omit-frame-pointer",
                                    str(ROOT / f"tests/{name}.cpp"), "-o", str(binary)], check=True)
                    subprocess.run([str(binary)], check=True)
