"""CI-only Core toolchain probe: no running HA, USB, ADB server or firmware.

The workflow overrides the official image's entrypoint and supplies only an
empty scratch directory plus public source files. Missing native tools are
measured independently of the Python SDK: a working Zig compiler alone does
not establish a complete Monitor 1 builder or an installation backend.
"""
import ctypes.util
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys
import tempfile


EXPECTED_HA = "2026.11.0"
REQUIREMENTS = Path("/public-requirements.txt")
OUTPUT = Path("/probe-result/environment.json")
TOOLS = ("adb", "git", "perl", "make", "nice")


def run(command, environment, *, capture=False, timeout=120):
    """Run only fixed probe commands, without inheriting credentials or stdin."""
    result = subprocess.run(command, env=environment, stdin=subprocess.DEVNULL,
                            stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
                            stderr=subprocess.STDOUT if capture else subprocess.DEVNULL,
                            timeout=timeout, check=True)
    if capture and len(result.stdout) > 65536:
        raise ValueError("oversized fixed probe result")
    return result.stdout


def main():
    # Refuse accidental use as a host diagnostic. The fixed mounts and exact
    # image version make this an explicit disposable CI experiment, not a
    # discovery route on the owner's HA or computer.
    if (platform.system() != "Linux" or not Path("/probe-work").is_dir() or
            not OUTPUT.parent.is_dir() or OUTPUT.exists()):
        raise SystemExit("Run only through the disposable Core probe workflow")
    if importlib.metadata.version("homeassistant") != EXPECTED_HA:
        raise SystemExit("Unexpected Home Assistant image")
    os.umask(0o077)
    available = os.sched_getaffinity(0)
    os.sched_setaffinity(0, {min(available)})
    os.nice(10)
    raw = REQUIREMENTS.read_bytes()
    report = {
        "schema_version": 1,
        "homeassistant": EXPECTED_HA,
        "python": platform.python_version(),
        "machine": platform.machine(),
        "requirements_sha256": hashlib.sha256(raw).hexdigest(),
        "native_tools": {name: shutil.which(name) is not None for name in TOOLS},
        "libusb_discoverable": ctypes.util.find_library("usb-1.0") is not None,
        "sdk_imported": False,
        "synthetic_arm32_compiled": False,
        "hardware_contacted": False,
        "backend_ready": False,
        "failure_stage": None,
    }
    stage = "venv"
    try:
        with tempfile.TemporaryDirectory(prefix="core-sdk-", dir="/probe-work") as directory:
            root = Path(directory)
            cache = root / "cache"
            cache.mkdir(mode=0o700)
            # Do not pass the Core/Supervisor environment into downloaded
            # build tools. All writable caches belong to this disposable job.
            environment = {
                "PATH": "/usr/local/bin:/usr/bin:/bin",
                "PYTHONNOUSERSITE": "1",
                "PIP_NO_INPUT": "1",
                "PIP_DISABLE_PIP_VERSION_CHECK": "1",
                "PIP_CACHE_DIR": str(cache / "pip"),
                "XDG_CACHE_HOME": str(cache),
                "ZIG_GLOBAL_CACHE_DIR": str(cache / "zig-global"),
                "ZIG_LOCAL_CACHE_DIR": str(cache / "zig-local"),
                "TMPDIR": str(root),
            }
            sdk = root / "sdk"
            run([sys.executable, "-m", "venv", str(sdk)], environment)
            python = str(sdk / "bin/python")
            stage = "sdk_install"
            # Match the real builder's pinned requirements installation.
            # Requiring wheels for pure-Python sdists changes that contract
            # and cannot establish a Core incompatibility. This remains a
            # disposable, credential-free child environment, never HA's pip.
            run([python, "-m", "pip", "install",
                 "--no-input", "--disable-pip-version-check", "-q", "-r",
                 str(REQUIREMENTS)], environment, capture=True, timeout=1200)
            stage = "sdk_import"
            versions = json.loads(run([python, "-c",
                "import esphome, importlib.metadata, json; "
                "print(json.dumps({k: importlib.metadata.version(k) for k in "
                "('esphome', 'ziglang', 'aioesphomeapi', 'pycryptodomex', 'pyelftools')}))"],
                environment, capture=True))
            report["sdk_versions"] = versions
            report["sdk_imported"] = True
            stage = "synthetic_compile"
            source, binary = root / "not-firmware.c", root / "not-firmware"
            source.write_text("int main(void) { return 0; }\n", encoding="utf-8")
            run([python, "-m", "ziglang", "cc", "-target", "arm-linux-gnueabihf.2.23",
                 "-mcpu=cortex_a7", "-Os", str(source), "-o", str(binary)],
                environment, timeout=300)
            header = binary.read_bytes()[:20]
            if header[:6] != b"\x7fELF\x01\x01" or int.from_bytes(header[18:20], "little") != 40:
                raise ValueError("not an ARM32 little-endian ELF")
            # This file is never executed, uploaded or mistaken for firmware.
            report["synthetic_arm32_compiled"] = True
    except Exception as error:
        # Only the stage is public. No environment, raw subprocess output,
        # traceback, arbitrary filesystem metadata or device data is emitted.
        report["failure_stage"] = stage
        if stage == "sdk_install" and isinstance(error, subprocess.CalledProcessError):
            # Extract at most a package requirement, never raw pip output,
            # repository URLs, environment or traceback. All inputs here are
            # public; the production worker still retains its logs privately.
            output = (error.stdout or b"")[-65536:].decode("utf-8", errors="replace")
            match = re.search(r"No matching distribution found for ([A-Za-z0-9_.\[\]<>=!~+,-]{1,160})", output)
            report["sdk_failure_category"] = "missing_distribution" if match else (
                "wheel_build_failed" if "Failed to build" in output or "Failed building wheel" in output
                else "installation_failed")
            if match:
                report["sdk_failure_requirement"] = match.group(1)
    with OUTPUT.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2)
        stream.write("\n")
    print(json.dumps(report, sort_keys=True))
    return 0 if report["synthetic_arm32_compiled"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
