"""Actual C3 C++ streaming updater versus the independent Python personalizer.

Synthetic apps and the public SDK build only. ASan/UBSan, no network/flash IO.
"""
import hashlib
from pathlib import Path
import shlex
import struct
import subprocess
import tempfile
import unittest

from test_native_update_stream import CPP
from test_sonoff import ROOT, fixture, image, values


class SonoffNativeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.folder = Path(cls.temp.name)
        source = cls.folder / "stream.cpp"
        source.write_text(CPP.replace("esphome::qf_native_update", "esphome::s60_native_update"))
        flags = shlex.split(subprocess.check_output(["pkg-config", "--cflags", "--libs", "openssl"], text=True))
        cls.executable = cls.folder / "stream"
        subprocess.run(["c++", "-std=c++17", "-Wall", "-Wextra", "-Werror", "-fsanitize=address,undefined",
                        "-fno-omit-frame-pointer", "-I" + str(ROOT / "ports/sonoff_s60/components/s60_native_update"),
                        str(source), *flags, "-o", str(cls.executable)], check=True, capture_output=True)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def stream(self, original, *, chunk=37, patches=None, digest=None):
        source, table, config, target = [self.folder / name for name in ("app.bin", "patches", "private", "out.bin")]
        source.write_bytes(original)
        patches = image.patch_table(original) if patches is None else patches
        table.write_text("\n".join(f"{at} {slot}" for at, slot in patches))
        config.write_bytes(b"".join(struct.pack("<I", len(value)) + value for value in values().values()))
        result = subprocess.run([str(self.executable), str(source), str(table), str(config), str(chunk), str(target),
                                 digest or hashlib.sha256(original).hexdigest()], capture_output=True)
        self.assertNotIn(b"Sanitizer", result.stderr)
        return result.returncode, target.read_bytes() if result.returncode == 0 else None

    def test_real_stream_handles_every_boundary_and_preserves_private_slots(self):
        original = fixture()
        expected = image.personalize(original, values(), hashlib.sha256(original).hexdigest())
        for chunk in (1, 2, 7, 23, 24, 31, 32, 33, 63, 64, 65, 97, 1024, 2048):
            with self.subTest(chunk=chunk):
                code, actual = self.stream(original, chunk=chunk)
                self.assertEqual(code, 0)
                self.assertEqual(actual, expected)
                image.layout(actual)

    def test_corrupt_digest_chip_layout_markers_and_patch_table_never_verify(self):
        original = fixture(); table = image.patch_table(original)
        for at in (0, 1, 12, 23, 28, table[0][0]):
            bad = bytearray(original); bad[at] ^= 255
            with self.subTest(offset=at): self.assertNotEqual(self.stream(bad, patches=table)[0], 0)
        self.assertNotEqual(self.stream(original, digest="0" * 64)[0], 0)
        bad = bytearray(original); bad[-1] ^= 1
        self.assertNotEqual(self.stream(bad, patches=table, digest=hashlib.sha256(original).hexdigest())[0], 0)
        for patches in (table[:-1], table[::-1], [table[0], *table], [[24, table[0][1]], *table[1:]]):
            self.assertNotEqual(self.stream(original, patches=patches)[0], 0)
        self.assertNotEqual(self.stream(original + b"crc!", patches=table)[0], 0)

    def test_actual_public_sdk_app_if_present(self):
        path = ROOT / "custom_components/qingping_esphome/firmware/sonoff-s60tpf-template.bin"
        if not path.is_file(): self.skipTest("Pinned public C3 SDK build not present")
        original = path.read_bytes()
        code, actual = self.stream(original, chunk=2048)
        self.assertEqual(code, 0)
        self.assertEqual(actual, image.personalize(original, values(), hashlib.sha256(original).hexdigest()))


if __name__ == "__main__": unittest.main()
