#!/usr/bin/env python3
"""Build pinned ARM crypto locally; never contact or modify the monitor.

Run with this directory's isolated .venv/bin/python. OpenSSL's source checksum
is pinned from the official release; a failed download/checksum stops before
extraction. Explicit cwd, AR and RANLIB avoid corrupt macOS-native archives.
"""
from pathlib import Path
import hashlib
import os
import subprocess
import tarfile
import urllib.request

base = Path(__file__).resolve().parent
release = "openssl-3.5.9"
digest = "603f5602e2eef00d77fbd429d34dcd5822bb301757a1bc9cdb24c670f1eb859a"
downloads, build = base / "downloads", base / "build"
downloads.mkdir(exist_ok=True)
build.mkdir(exist_ok=True)
archive = downloads / f"{release}.tar.gz"
if not archive.exists():
    temporary = archive.with_suffix(".partial")
    urllib.request.urlretrieve(
        f"https://github.com/openssl/openssl/releases/download/{release}/{release}.tar.gz",
        temporary,
    )
    if hashlib.sha256(temporary.read_bytes()).hexdigest() != digest:
        raise SystemExit("Official source checksum mismatch; partial retained")
    temporary.rename(archive)
if hashlib.sha256(archive.read_bytes()).hexdigest() != digest:
    raise SystemExit("Existing source checksum mismatch; no extraction/build")
source = build / release
if not source.exists():
    with tarfile.open(archive) as tar:
        tar.extractall(build, filter="data")
target = build / "openssl-arm"
target.mkdir(exist_ok=True)
env = dict(os.environ, CC=str(base / "zig-cc"), AR=str(base / "zig-ar"),
           RANLIB=str(base / "zig-ranlib"))
subprocess.run([
    "perl", str(source / "Configure"), "linux-armv4", "no-shared", "no-tests",
    "no-apps", "no-docs", "no-asm", "no-dso", "no-engine",
    f"--prefix={build / 'openssl-target'}",
], cwd=target, env=env, check=True)
subprocess.run(["nice", "-n", "10", "make", "-j1", "build_libs", f"RANLIB={base / 'zig-ranlib'}"],
               cwd=target, env=env, check=True)
for name in ("libcrypto.a", "libssl.a"):
    library = target / name
    # Native Apple ranlib can silently reduce a GNU ARM archive to 96 bytes.
    # Checking exit status alone missed that failure in the first experiment.
    if library.stat().st_size < 100_000:
        raise SystemExit(f"Invalid or empty target archive: {name}")
    members = subprocess.check_output([str(base / "zig-ar"), "t", str(library)])
    if b".o" not in members:
        raise SystemExit(f"No object members in {name}")
print("ARM OpenSSL source checksum and nonempty archives verified")
