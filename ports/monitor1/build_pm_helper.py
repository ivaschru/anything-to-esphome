#!/usr/bin/env python3
"""Build CGS1's narrow stock PM helper; never connect to or alter a monitor.

Only Qt's pinned public headers are extracted. The owner supplies a private
copy of the stock ARM QtCore library AND its independently verified digest;
neither that library nor generated artifacts belong in a public release.
Every invocation gets a new private build directory and an evidence manifest.
This builds a dependency of the CGS1 installer, not an installer itself.
"""
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tarfile
import urllib.request

HERE = Path(__file__).resolve().parent
QT_TAG = "v5.9.4"
QT_ARCHIVE_SHA = "8c8bf00c33a68dbff255de2d315084c9edc36e55524aa2c563e0111ef3d373ea"
QT_URL = "https://codeload.github.com/qt/qtbase/tar.gz/refs/tags/v5.9.4"
SOURCE_NAMES = ("build_pm_helper.py", "pm_qt_bridge.cpp", "pm_qt_mock.cpp", "zig-cxx", "zig_driver.py")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def checked_library(path, expected):
    """Bind the link input before any download, extraction or output creation.

    A SONAME alone is not an ABI or provenance check. The expected hash must
    come from the matching stock backup/inventory, not from an unknown file
    selected merely because its name contains Qt. Do not print its pathname.
    """
    if not re.fullmatch(r"[0-9a-f]{64}", expected):
        raise ValueError("Expected a lowercase SHA-256 for the stock Qt library")
    metadata = path.lstat()
    if not stat.S_ISREG(metadata.st_mode) or not 0 < metadata.st_size <= 32 * 1024 * 1024:
        raise ValueError("Stock Qt input must be a bounded regular file, not a symlink")
    if digest(path) != expected:
        raise ValueError("Stock Qt library digest mismatch")
    from elftools.elf.elffile import ELFFile

    with path.open("rb") as stream:
        elf = ELFFile(stream)
        dynamic = elf.get_section_by_name(".dynamic")
        sonames = [] if dynamic is None else [
            item.soname for item in dynamic.iter_tags() if item.entry.d_tag == "DT_SONAME"
        ]
        if (elf.elfclass != 32 or not elf.little_endian or
                elf.header.e_machine != "EM_ARM" or elf.header.e_type != "ET_DYN" or
                sonames != ["libQt5Core.so.5"]):
            raise ValueError("Stock Qt library must be the matching ARM32 Qt5 shared object")
    return (metadata.st_dev, metadata.st_ino, metadata.st_size, metadata.st_mtime_ns)


def private_output(path):
    """Refuse reuse or a path escaping the ignored build tree.

    Existing results are immutable build evidence. Even a failed build uses
    a new name on retry; it cannot overwrite a working helper or manifest.
    """
    root = HERE / "build"
    absolute = path.absolute()
    if (absolute == root or not absolute.is_relative_to(root) or
            absolute.resolve() != absolute):
        raise ValueError("Output must be a fresh path inside ports/monitor1/build")
    root.mkdir(mode=0o700, exist_ok=True)
    absolute.mkdir(mode=0o700, parents=False, exist_ok=False)
    return absolute


def archive_bytes(path):
    """Use a checksum-pinned local archive or the one fixed official URL.

    There is no user-supplied URL, unverified fallback or shell downloader.
    A download failure retains its partial file; it never overwrites a cache.
    """
    if path is None:
        cache = HERE / "downloads"
        if cache.resolve() != cache.absolute():
            raise ValueError("Qt download cache must not traverse a symlink")
        cache.mkdir(mode=0o700, exist_ok=True)
        path = cache / "qtbase-v5.9.4-github.tar.gz"
        if not path.exists():
            partial = path.with_suffix(".partial")
            # Never follow a stale/symlinked partial from another invocation.
            fd = os.open(partial, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "wb") as target, urllib.request.urlopen(QT_URL, timeout=30) as response:
                total = 0
                while chunk := response.read(1024 * 1024):
                    total += len(chunk)
                    if total > 100 * 1024 * 1024:
                        raise ValueError("Qt archive exceeds the pinned download bound")
                    target.write(chunk)
            if digest(partial) != QT_ARCHIVE_SHA:
                raise ValueError("Qt source digest mismatch; partial retained")
            partial.rename(path)
    metadata = path.lstat()
    if (not stat.S_ISREG(metadata.st_mode) or metadata.st_size > 100 * 1024 * 1024 or
            digest(path) != QT_ARCHIVE_SHA):
        raise ValueError("Qt source archive is not the exact tested public source")
    return path


def validate_artifact(path, shared):
    """Reject the wrong CPU/ABI before a digest can become a release pin."""
    from elftools.elf.elffile import ELFFile

    with path.open("rb") as stream:
        elf = ELFFile(stream)
        if (elf.elfclass != 32 or not elf.little_endian or
                elf.header.e_machine != "EM_ARM" or
                elf.header.e_type not in (("ET_DYN",) if shared else ("ET_EXEC", "ET_DYN"))):
            raise ValueError("Helper build produced an unexpected ELF architecture/type")
        dynamic = elf.get_section_by_name(".dynamic")
        needed = []
        for item in dynamic.iter_tags() if dynamic is not None else ():
            if item.entry.d_tag in ("DT_RPATH", "DT_RUNPATH", "DT_TEXTREL"):
                raise ValueError("Helper must not carry a host search path or text relocation")
            if item.entry.d_tag == "DT_NEEDED":
                needed.append(item.needed)
        if "libQt5Core.so.5" not in needed:
            raise ValueError("Helper lost its stock QtCore dependency")
        versions = elf.get_section_by_name(".gnu.version_r")
        if versions is not None:
            for _, auxiliaries in versions.iter_versions():
                for item in auxiliaries:
                    name = item.name
                    if name.startswith("GLIBC_"):
                        version = name.removeprefix("GLIBC_")
                        if (not re.fullmatch(r"[0-9]+(?:\.[0-9]+)*", version) or
                                tuple(map(int, version.split("."))) > (2, 23)):
                            raise ValueError("Helper requires a newer or private glibc ABI")
    return {"bytes": path.stat().st_size, "sha256": digest(path), "needed": needed}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--qt-core", type=Path, required=True)
    parser.add_argument("--qt-core-sha256", required=True)
    parser.add_argument("--qt-archive", type=Path, help="Optional exact pinned archive for an offline build")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    # The cross-compiler wrappers always use this environment. Refuse a shared
    # HA/Lite interpreter instead of changing its packages or compiler state.
    if (Path(sys.prefix).resolve() != (HERE / ".venv").resolve() or
            importlib.metadata.version("ziglang") != "0.14.1"):
        raise ValueError("Use ports/monitor1/.venv with its pinned requirements")
    os.umask(0o077)
    library = args.qt_core.absolute()
    before = checked_library(library, args.qt_core_sha256)
    archive = archive_bytes(args.qt_archive)
    output = private_output(args.output)
    source_hashes = {name: digest(HERE / name) for name in SOURCE_NAMES}
    report = {"complete": False, "hardware_contacted": False, "installed": False,
              "qt_source_tag": QT_TAG, "qt_source_sha256": QT_ARCHIVE_SHA,
              "qt_target_library_sha256": args.qt_core_sha256,
              "build_environment": {"python": sys.version.split()[0], "ziglang": "0.14.1",
                                    "target": "arm-linux-gnueabihf.2.23", "cpu": "cortex_a7",
                                    "optimization": "Os"},
              "source_sha256": source_hashes, "artifacts": {}}
    try:
        # Always extract into this invocation's private directory. A modified
        # pre-existing Qt header tree cannot silently affect a later helper.
        with tarfile.open(archive) as tar:
            tar.extractall(output, filter="data")
        source = output / "qtbase-5.9.4"
        with (output / "compile.log").open("xb") as log:
            subprocess.run(["perl", "bin/syncqt.pl", "-version", "5.9.4"],
                           cwd=source, stdout=log, stderr=subprocess.STDOUT,
                           check=True, timeout=60)
            config = output / "qt-config/QtCore"
            config.mkdir(parents=True)
            # These public-header features match the stock QtCore-only use.
            # They do not rebuild or replace the monitor's Qt runtime.
            (config / "qconfig.h").write_text(
                "#pragma once\n#define QT_VERSION_MAJOR 5\n#define QT_VERSION_MINOR 9\n"
                "#define QT_VERSION_PATCH 4\n#define QT_FEATURE_shared 1\n#define QT_FEATURE_thread 1\n")
            (config / "qtcore-config.h").write_text(
                "#pragma once\n#define QT_FEATURE_library 1\n#define QT_FEATURE_properties 1\n"
                "#define QT_FEATURE_qobject 1\n#define QT_FEATURE_thread 1\n#define QT_FEATURE_std_atomic64 1\n")
            common = ["nice", "-n", "10", str(HERE / "zig-cxx"), "-std=c++17", "-Os",
                      # Qt's assertion strings may contain __FILE__. Normalize
                      # both public source roots so a different private output
                      # directory cannot change the helper or leak host paths.
                      f"-ffile-prefix-map={HERE}=cgs1-source",
                      f"-ffile-prefix-map={source}=qtbase-5.9.4",
                      "-fPIC", "-fno-exceptions", "-fno-sized-deallocation",
                      "-I", str(config.parent), "-I", str(source / "include"),
                      "-I", str(source / "include/QtCore")]
            for name, filename, flags in (
                ("pm_qt_bridge.so", "pm_qt_bridge.cpp", ["-shared"]),
                ("pm_qt_bridge_test.so", "pm_qt_bridge.cpp", ["-shared", "-DCGS1_PM_BRIDGE_TEST"]),
                ("pm_qt_mock", "pm_qt_mock.cpp", ["-Wl,--export-dynamic"]),
            ):
                subprocess.run([*common, *flags, str(HERE / filename), str(library),
                                "-pthread", "-ldl", "-o", str(output / name)],
                               cwd=HERE, stdout=log, stderr=subprocess.STDOUT,
                               check=True, timeout=240)
                (output / name).chmod(0o600)
                report["artifacts"][name] = validate_artifact(output / name, name.endswith(".so"))
        if (checked_library(library, args.qt_core_sha256) != before or
                any(digest(HERE / name) != expected for name, expected in source_hashes.items()) or
                digest(archive) != QT_ARCHIVE_SHA):
            raise ValueError("Build input changed during compilation")
        report["complete"] = True
    finally:
        (output / "result.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"complete": True, "hardware_contacted": False,
                      "helper_sha256": report["artifacts"]["pm_qt_bridge.so"]["sha256"]}))


if __name__ == "__main__":
    main()
