"""Build admission checks that need no SDK, monitor or vendor library.

The real ARM/Qt compile is separate evidence. These tests ensure wrong inputs
fail before dependency loading/download and build retries cannot overwrite
existing results or follow a symlink out of the ignored build directory.
"""
import importlib.util
from pathlib import Path
import sys
import tempfile
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "monitor1_pm_builder", ROOT / "ports/monitor1/build_pm_helper.py"
)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class Monitor1BuildTests(unittest.TestCase):
    def check_abi_paths(self, flags, accepted):
        """Exercise each admission path without needing pyelftools or Qt bytes.

        Only the ELF parser boundary is substituted. The real input hash,
        file metadata, SONAME/dependency and entry-point checks still run.
        These synthetic headers test build admission, never loader safety.
        """
        soname = SimpleNamespace(entry=SimpleNamespace(d_tag="DT_SONAME"),
                                 soname="libQt5Core.so.5")
        needed = SimpleNamespace(entry=SimpleNamespace(d_tag="DT_NEEDED"),
                                 needed="libQt5Core.so.5")
        dynamic = SimpleNamespace(iter_tags=lambda: iter((soname, needed)))
        parser = ModuleType("elftools.elf.elffile")
        modules = {"elftools": ModuleType("elftools"),
                   "elftools.elf": ModuleType("elftools.elf"),
                   "elftools.elf.elffile": parser}
        with tempfile.TemporaryDirectory() as temp, patch.dict(sys.modules, modules):
            path = Path(temp) / "synthetic-header"
            path.write_bytes(b"synthetic parser fixture, not an executable")
            pin = builder.digest(path)
            for entry, kind in (("qt", "ET_DYN"), ("shared", "ET_DYN"),
                                ("mock", "ET_EXEC"), ("mock-pie", "ET_DYN")):
                elf = SimpleNamespace(
                    elfclass=32, little_endian=True,
                    header=SimpleNamespace(e_machine="EM_ARM", e_type=kind, e_flags=flags),
                    get_section_by_name=lambda name: dynamic if name == ".dynamic" else None,
                )
                parser.ELFFile = lambda stream: elf
                with self.subTest(entry=entry, flags=hex(flags)):
                    if accepted:
                        result = (builder.checked_library(path, pin) if entry == "qt" else
                                  builder.validate_artifact(path, entry == "shared"))
                        if entry == "qt":
                            self.assertEqual(result[2], path.stat().st_size)
                        else:
                            self.assertEqual(result["sha256"], pin)
                    else:
                        with self.assertRaisesRegex(ValueError, "EABI5 hard-float"):
                            if entry == "qt":
                                builder.checked_library(path, pin)
                            else:
                                builder.validate_artifact(path, entry == "shared")

    def test_hard_float_abi_is_required_for_qt_shared_helper_and_mock(self):
        # Base PCS (including an unspecified float flag) cannot exchange the
        # same floating-point arguments with a gnueabihf QtCore build. Reject
        # conflicting float flags and unknown/other EABI versions as well.
        for flags in (0x05000000, 0x05000200, 0x05000600,
                      0x00000400, 0x04000400, 0x06000400):
            self.check_abi_paths(flags, accepted=False)

    def test_eabi5_hard_float_allows_unrelated_arm_flags(self):
        for flags in (0x05000400, 0x05000402):
            self.check_abi_paths(flags, accepted=True)

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
