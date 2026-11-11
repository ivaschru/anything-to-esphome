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

    def test_offline_trace_preserves_direction_and_rejects_damaged_lines(self):
        def frame(command, payload):
            packet = b"CG" + bytes([command]) + len(payload).to_bytes(2, "little") + payload
            return b"hex_string " + (packet + sum(packet).to_bytes(2, "little")).hex().encode() + b"\r"

        def export(path, runs):
            rows = ["Time [s],Value,Parity Error,Framing Error"]
            for start, data, damaged in runs:
                for index, byte in enumerate(data):
                    error = "Error" if damaged and index == 0 else ""
                    rows.append(f"{start + index / 10000:.6f},0x{byte:02X},,{error}")
            path.write_bytes("\r\n".join(rows).encode())  # Last row without a newline.

        with tempfile.TemporaryDirectory(prefix="qingping-mcu421-trace-") as directory:
            scratch = Path(directory)
            binary = scratch / "trace"
            esp, mcu = scratch / "esp.csv", scratch / "mcu.csv"
            subprocess.run(["c++", "-std=c++17", "-Wall", "-Wextra", "-Werror",
                            "-fsanitize=address,undefined", "-fno-omit-frame-pointer",
                            str(ROOT / "ports/lite-mcu421/uart_trace.cpp"), "-o", str(binary)], check=True)
            report = frame(0x32, b"\x08\x02\x00\x90\x01\xf0\x03\x00abc")
            mismatch = frame(0x32, b"\x08\x04\x00\x90\x01\x00\x00")
            export(esp, [(0.01, b"down none\r\n", False), (0.04, b"down private-config\n", False),
                         (0.06, report, False), (0.08, b"error\r", False)])
            export(mcu, [(0, b"get_down\r", False), (0.02, b"\r" + report, True), (0.03, report, False),
                         (0.07, mismatch, False), (0.09, b"hex_string 43473200000000\r", False),
                         (0.10, b"mcu_version 0425\r", False), (0.11, b"mcu_version 04x5\r", False),
                         (0.12, b"partial", False)])
            result = subprocess.run([binary, esp, mcu], check=True, capture_output=True, text=True)
            self.assertNotIn("private-config", result.stdout)
            rows = [line.split("\t") for line in result.stdout.splitlines()[1:]]
            self.assertEqual([row[2] for row in rows], ["get_down", "down_none", "lf_after_cr", "uart_error",
                             "frame", "down", "frame", "report_layout_mismatch", "error_reply", "invalid_line",
                             "mcu_version", "unknown_line", "unfinished_line"])
            self.assertEqual(rows[4][1:], ["mcu_to_esp", "frame", "CR", "0x32", "0x8:2,0xf0:3", "CO2=400", ""])
            self.assertEqual(rows[6][1:], ["esp_to_mcu", "frame", "CR", "0x32", "0x8:2,0xf0:3", "", ""])
            self.assertEqual(rows[7][-2:], ["", ""])
            self.assertEqual(rows[9][-2:], ["", ""])
            self.assertEqual(rows[10][-1], "0425")
            self.assertEqual(rows[11][-1], "")
            times = [float(row[0]) for row in rows]
            self.assertEqual(times, sorted(times))

            export(mcu, [(0.02, b"a", False), (0.01, b"b", False)])
            bad = subprocess.run([binary, esp, mcu], capture_output=True, text=True)
            self.assertEqual(bad.returncode, 1)
            self.assertIn("decreasing timestamp", bad.stderr)
