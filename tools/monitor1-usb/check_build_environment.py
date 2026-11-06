"""Disposable Linux container SDK check; public inputs only, no USB/HA/firmware."""
import importlib.metadata
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

for name in ("git", "perl", "make", "nice"):
    assert shutil.which(name), name
os.umask(0o077)
os.sched_setaffinity(0, {min(os.sched_getaffinity(0))})
with tempfile.TemporaryDirectory(prefix="cgs1-sdk-") as directory:
    root = Path(directory)
    subprocess.run([sys.executable, "-m", "venv", str(root / "sdk")], check=True, timeout=60)
    python = root / "sdk/bin/python"
    subprocess.run([str(python), "-m", "pip", "install", "--no-input", "--disable-pip-version-check",
                    "-q", "-r", "/public-requirements.txt"], check=True, timeout=1200)
    subprocess.run([str(python), "-c", "import esphome, importlib.metadata; "
                    "assert importlib.metadata.version('esphome') == '2026.10.1'; "
                    "assert importlib.metadata.version('ziglang') == '0.14.1'"], check=True, timeout=30)
    source = root / "not-firmware.c"
    source.write_text("int main(void) { return 0; }\n")
    output = root / "not-firmware"
    subprocess.run([str(python), "-m", "ziglang", "cc", "-target", "arm-linux-gnueabihf.2.23",
                    "-mcpu=cortex_a7", "-Os", str(source), "-o", str(output)], check=True, timeout=300)
    header = output.read_bytes()[:20]
    assert header[:6] == b"\x7fELF\x01\x01" and int.from_bytes(header[18:20], "little") == 40
print("Pinned SDK imported and synthetic ARM32/glibc-target program compiled; no firmware or hardware QA")
