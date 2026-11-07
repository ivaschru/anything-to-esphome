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


def prefix_tools(root, environment, report):
    """CI experiment: fetch/verify/extract signed packages, never apk add.

    The official image stays read-only and the process is unprivileged. APK's
    extract command does not install package scripts or modify its database.
    This verifies relocation, not a distributable tool archive: licenses,
    immutable package pins and a production extractor still need their own
    packaging before these programs can ship inside the HACS runtime.
    """
    apk = shutil.which("apk", path="/sbin:/usr/sbin:/usr/bin:/usr/local/bin")
    report["apk_discoverable"] = apk is not None
    if apk is None:
        raise FileNotFoundError("fixed package tool unavailable")
    downloaded, prefix = root / "packages", root / "tools"
    downloaded.mkdir(mode=0o700)
    prefix.mkdir(mode=0o700)
    report["tool_prefix_stage"] = "fetch"
    # APK v3 defaults to its configured package filename specification. Pin
    # the flat filenames consumed below instead of assuming a distro default.
    run([apk, "--no-cache", "fetch", "--recursive", "--pkgname-spec", "${name}-${version}.apk",
         "--output", str(downloaded), "android-tools", "perl", "make"],
        environment, capture=True, timeout=300)
    packages = sorted(downloaded.glob("*.apk"))
    report["tool_prefix_package_count"] = len(packages)
    report["tool_prefix_download_bytes"] = sum(p.stat().st_size for p in packages)
    report["tool_prefix_download_entries"] = [p.name for p in sorted(downloaded.iterdir())][:64]
    if not 3 <= len(packages) <= 64 or sum(p.stat().st_size for p in packages) > 256 * 1024**2:
        raise ValueError("unexpected fixed tool dependency set")
    report["tool_prefix_packages"] = [
        {"name": p.name, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
        for p in packages]
    report["tool_prefix_stage"] = "verify"
    for package in packages:
        run([apk, "--no-network", "verify", str(package)], environment, capture=True)
    report["tool_prefix_stage"] = "extract"
    for package in packages:
        run([apk, "--no-network", "extract", "--no-chown", "--destination", str(prefix),
             str(package)], environment, capture=True)
    # These paths belong only to child tool invocations. The HA/Python
    # process never inherits a replacement library path or Perl environment.
    tool_environment = {**environment,
        "LD_LIBRARY_PATH": os.pathsep.join(str(prefix / p) for p in ("lib", "usr/lib")),
        "PERL5LIB": os.pathsep.join(str(prefix / p) for p in (
            "usr/lib/perl5/core_perl", "usr/share/perl5/core_perl",
            "usr/lib/perl5/vendor_perl", "usr/share/perl5/vendor_perl"))}
    report["tool_prefix_stage"] = "check"
    run([str(prefix / "usr/bin/adb"), "version"], tool_environment, capture=True)
    report["tool_prefix_checks"]["adb_version"] = True
    assert run([str(prefix / "usr/bin/perl"), "-MCwd", "-MFile::Spec", "-MDigest::SHA",
                "-e", 'print "ok"'], tool_environment, capture=True) == b"ok"
    report["tool_prefix_checks"]["perl_modules"] = True
    makefile = root / "not-firmware.mk"
    makefile.write_text("all:\n\t@printf ok\n", encoding="utf-8")
    assert run([str(prefix / "usr/bin/make"), "--no-print-directory", "-f", str(makefile)],
               tool_environment, capture=True) == b"ok"
    report["tool_prefix_checks"]["make_recipe"] = True
    report["tool_prefix_stage"] = "complete"


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
        "os_release": {k: platform.freedesktop_os_release().get(k) for k in ("ID", "VERSION_ID")},
        "requirements_sha256": hashlib.sha256(raw).hexdigest(),
        "native_tools": {name: shutil.which(name) is not None for name in TOOLS},
        "libusb_discoverable": ctypes.util.find_library("usb-1.0") is not None,
        "sdk_imported": False,
        "synthetic_arm32_compiled": False,
        "tool_prefix_checks": {k: False for k in ("adb_version", "perl_modules", "make_recipe")},
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
            stage = "tool_prefix"
            prefix_tools(root, environment, report)
    except Exception as error:
        # Only the stage is public. No environment, raw subprocess output,
        # traceback, arbitrary filesystem metadata or device data is emitted.
        report["failure_stage"] = stage
        if stage == "tool_prefix":
            report["tool_prefix_failure"] = {"type": type(error).__name__,
                "errno": getattr(error, "errno", None), "exit": getattr(error, "returncode", None)}
            if isinstance(error, subprocess.CalledProcessError):
                output = (error.stdout or b"")[-65536:].decode("utf-8", errors="replace").lower()
                report["tool_prefix_failure"]["categories"] = [code for marker, code in (
                    ("permission denied", "permission_denied"), ("read-only file system", "read_only_filesystem"),
                    ("unrecognized option", "unsupported_option"), ("not a valid apk command", "unsupported_command"),
                    ("unable to select", "package_selection"), ("no such package", "package_unavailable"),
                    ("bad signature", "signature_refused"), ("temporary error", "network_error"),
                    ("certificate verify failed", "tls_refused")) if marker in output]
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
    return 0 if report["synthetic_arm32_compiled"] and all(report["tool_prefix_checks"].values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
