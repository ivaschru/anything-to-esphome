"""Build admission checks that need no SDK, monitor or vendor library.

The real ARM/Qt compile is separate evidence. These tests ensure wrong inputs
fail before dependency loading/download and build retries cannot overwrite
existing results or follow a symlink out of the ignored build directory.
"""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "monitor1_pm_builder", ROOT / "ports/monitor1/build_pm_helper.py"
)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class Monitor1BuildTests(unittest.TestCase):
    def test_wrong_library_pin_fails_before_elf_sdk_load(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "private-library"
            path.write_bytes(b"not a stock Qt library")
            for pin in ("unverified", "0" * 64):
                with self.subTest(pin=pin), self.assertRaises(ValueError):
                    builder.checked_library(path, pin)

    def test_symlink_library_is_never_a_link_input(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            original = root / "original"
            original.write_bytes(b"placeholder")
            link = root / "link"
            link.symlink_to(original)
            with self.assertRaises(ValueError):
                builder.checked_library(link, builder.digest(original))

    def test_build_output_is_private_exclusive_and_local(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(builder, "HERE", Path(temp).resolve()):
            root = builder.HERE
            with self.assertRaises(ValueError):
                builder.private_output(root / "elsewhere")
            output = builder.private_output(root / "build/first")
            self.assertEqual(output.stat().st_mode & 0o777, 0o700)
            (output / "result.json").write_text("retained")
            with self.assertRaises(FileExistsError):
                builder.private_output(output)
            self.assertEqual((output / "result.json").read_text(), "retained")
            (root / "build/redirect").symlink_to(output, target_is_directory=True)
            with self.assertRaises(ValueError):
                builder.private_output(root / "build/redirect/escape")
            self.assertFalse((output / "escape").exists())

    def test_wrong_offline_archive_never_downloads(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(builder.urllib.request, "urlopen") as download:
            archive = Path(temp) / "archive.tar.gz"
            archive.write_bytes(b"wrong archive")
            with self.assertRaises(ValueError):
                builder.archive_bytes(archive)
            download.assert_not_called()

    def test_symlink_download_cache_cannot_write_elsewhere(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(builder, "HERE", Path(temp).resolve()):
            elsewhere = builder.HERE / "elsewhere"
            elsewhere.mkdir()
            (builder.HERE / "downloads").symlink_to(elsewhere, target_is_directory=True)
            with self.assertRaises(ValueError):
                builder.archive_bytes(None)
            self.assertEqual(list(elsewhere.iterdir()), [])
