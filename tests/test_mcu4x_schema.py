"""Validate the actual receiver's UART constraints with the pinned SDK."""
import importlib.util
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(importlib.util.find_spec("esphome"), "Requires pinned ESPHome 2026.9.1")
class McuSchemaTests(unittest.TestCase):
    def test_actual_uart_final_validation(self):
        with tempfile.TemporaryDirectory(prefix="mcu-schema-") as directory:
            work = Path(directory) / "receiver"
            shutil.copytree(ROOT / "ports/lite-mcu4x", work,
                            ignore=shutil.ignore_patterns(".esphome", "secrets.yaml", "__pycache__"))
            passive = (work / "receiver-check.yaml").read_text()
            probe = passive.replace("  id: mcu_receiver", "  id: mcu_receiver\n  transmit_mode: poll_probe")
            tx = "  rx_pin: GPIO19\n  tx_pin: GPIO18"
            cases = [
                ("passive", passive, True),
                ("passive_tx", passive.replace("  rx_pin: GPIO19", tx), False),
                ("wrong_rx", passive.replace("rx_pin: GPIO19", "rx_pin: GPIO17"), False),
                ("small_ring", passive.replace("rx_buffer_size: 4096", "rx_buffer_size: 256"), False),
                ("wrong_baud", passive.replace("baud_rate: 115200", "baud_rate: 9600"), False),
                ("short_expiry", passive.replace("  id: mcu_receiver", "  id: mcu_receiver\n  stale_after: 1ms"), False),
                ("probe_without_tx", probe, False),
                ("probe", probe.replace("  rx_pin: GPIO19", tx), True),
                ("probe_wrong_tx", probe.replace("  rx_pin: GPIO19", tx.replace("GPIO18", "GPIO17")), False),
                ("series", probe.replace("poll_probe", "poll_series").replace("  rx_pin: GPIO19", tx), True),
                ("long", probe.replace("poll_probe", "poll_long").replace("  rx_pin: GPIO19", tx), True),
            ]
            for name, source, valid in cases:
                with self.subTest(name=name):
                    (work / "receiver-check.yaml").write_text(source)
                    result = subprocess.run([sys.executable, "-m", "esphome", "config",
                                             str(work / "receiver-check.yaml")], capture_output=True, text=True)
                    self.assertEqual(result.returncode == 0, valid, result.stdout + result.stderr)
