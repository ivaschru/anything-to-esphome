"""Exercise CGS2 inventory framing on the host with synthetic USB replies."""
import importlib.util
from pathlib import Path
import re
import sys
import unittest


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("cgs2_snapshot", ROOT / "ports/monitor2/usb_snapshot.py")
snapshot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(snapshot)


class SnapshotTests(unittest.TestCase):
    def test_inventory_reports_abi_and_bindings_without_exporting_device_identity(self):
        def reply(arguments):
            self.assertEqual(arguments[:3], ["adb", "-s", "fixture-usb"])
            if arguments[3:] == ["get-state"]:
                return b"device\n"
            if arguments[3:] == ["get-devpath"]:
                return b"usb:1-3\n"
            self.assertEqual(arguments[3:5], ["shell", "-T"])
            marker = re.search(r"CGS2_SNAPSHOT_DONE_[0-9a-f]{32}", arguments[5]).group()
            boot = "00000000-0000-0000-0000-000000000001"
            elf = b"\x7fELF\x01\x01\x01" + bytes(11) + b"\x28\x00"
            rows = [boot, "rockchip,px30-evb-ddr3-v11-linux rockchip,px30", "4.19.232", "aarch64", elf.hex(),
                    "4.5.6_0156", "a" * 64]
            rows += ["co2_scd40", "co2_scd40"] + ["-"] * 12 + [boot, marker]
            return ("\r\n".join(rows) + "\r\n").encode()

        result = snapshot.inventory("fixture-usb", run=reply)
        self.assertEqual((result["kernel_machine"], result["stock_app_elf"]), ("aarch64", "arm32"))
        self.assertEqual(result["stock_release"], "4.5.6_0156")
        self.assertEqual(result["stock_app_sha256"], "a" * 64)
        self.assertEqual(result["i2c"]["co2"], {"address": "1-0062", "device": "co2_scd40", "driver": "co2_scd40"})
        self.assertIsNone(result["i2c"]["pm"]["driver"])
        self.assertNotIn("fixture-usb", str(result))
        self.assertNotIn("00000000-0000-0000-0000-000000000001", str(result))

    def test_optional_metadata_uses_fixed_formats_and_does_not_leak_peer_text(self):
        boot = "00000000-0000-0000-0000-000000000001"
        elf = b"\x7fELF\x02\x01\x01" + bytes(11) + b"\xb7\x00"
        rows = [boot, "rockchip,px30", "4.19.232", "aarch64", elf.hex(), "-", "-"]
        rows += ["-"] * 14 + [boot, "done"]

        def parse():
            return snapshot.parse_reply("\n".join(rows).encode(), "done")

        self.assertIsNone(parse()["stock_release"])
        self.assertIsNone(parse()["stock_app_sha256"])
        rows[5] = "unexpected assignment"
        with self.assertRaisesRegex(snapshot.SnapshotError, "Unexpected stock version format"):
            parse()
        rows[5:7] = ["4.5.6_0156", "b" * 63]
        with self.assertRaisesRegex(snapshot.SnapshotError, "Unexpected stock application fingerprint"):
            parse()

    def test_unfinished_and_non_usb_reads_are_refused(self):
        with self.assertRaisesRegex(snapshot.SnapshotError, "did not finish"):
            snapshot.parse_reply(b"partial\n", "done")
        with self.assertRaisesRegex(snapshot.SnapshotError, "not USB"):
            snapshot.inventory("fixture-usb", run=lambda arguments:
                               b"device\n" if arguments[-1] == "get-state" else b"unknown\n")

    def test_opt_in_exact_stock_samples_drop_the_pm_serial_and_unknown_text(self):
        boot = "00000000-0000-0000-0000-000000000001"
        elf = b"\x7fELF\x02\x01\x01" + bytes(11) + b"\xb7\x00"
        rows = [boot, "rockchip,px30", "4.19.232", "aarch64", elf.hex(),
                snapshot.SAMPLE_RELEASE, snapshot.SAMPLE_APP]
        rows += ["-"] * 14 + ["co2_ppm=0,temperature=-12.5,humidity=45",
                              "temperature=-31,humidity=450", "pm1=3,pm25=5,pm10=7,sn=private-serial",
                              boot, "done"]
        result = snapshot.parse_reply("\n".join(rows).encode(), "done", samples=True)
        self.assertEqual(result["stock_samples"]["co2"]["raw"]["co2_ppm"], 0)
        self.assertEqual(result["stock_samples"]["temperature_humidity"]["raw"], {"temperature": -31, "humidity": 450})
        self.assertEqual(result["stock_samples"]["pm"], {"state": "observed", "raw": {"pm1": 3, "pm25": 5, "pm10": 7}})
        self.assertNotIn("private-serial", str(result))
        self.assertEqual(snapshot.stock_sample("pm", "pm1=3,pm25=5,pm25=7,pm10=9"), {"state": "unrecognized"})
        self.assertEqual(snapshot.stock_sample("pm", "-"), {"state": "unavailable"})
        self.assertEqual(snapshot.stock_sample("pm", "pm1=3,pm25=5,pm10=7,sn=" + "x" * 256), {"state": "unrecognized"})
        rows[6] = "b" * 64
        with self.assertRaisesRegex(snapshot.SnapshotError, "exact analyzed stock"):
            snapshot.parse_reply("\n".join(rows).encode(), "done", samples=True)

    def test_default_inventory_never_reads_measurement_attributes(self):
        default, enabled = snapshot.shell_probe("done"), snapshot.shell_probe("done", samples=True)
        for path in snapshot.SAMPLE_PATHS.values():
            self.assertNotIn(path, default)
            self.assertEqual(enabled.count("head -c 257 /sys/bus/i2c/devices/" + path), 1)
        self.assertLess(enabled.index('test "$fingerprint" = ' + snapshot.SAMPLE_APP), enabled.index("co2_scd40_read"))

    def test_local_client_reply_is_bounded(self):
        with self.assertRaisesRegex(snapshot.SnapshotError, "size limit"):
            snapshot.adb_read([sys.executable, "-c", "print('x' * 9000)"])
