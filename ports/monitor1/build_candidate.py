#!/usr/bin/env python3
"""Build a private matched CGS1 candidate, never install or contact hardware.

The snapshot is one exact public Git revision. A new private directory holds
the profile, generated source, logs and three linked programs. A successful
compile is explicitly NOT installation/hardware QA: the HACS admission stays
source_only, and the controller has no upload, launch or activation operation.
"""
import argparse
import base64
import fcntl
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tarfile

import build_pm_helper as pm

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OPENSSL_SHA = "603f5602e2eef00d77fbd429d34dcd5822bb301757a1bc9cdb24c670f1eb859a"
PROFILE_KEYS = {"model", "stock_version", "co2_type", "wlan_mac", "api_mac",
                "node_name", "friendly_name", "api_encryption_key", "qt_core_sha256"}


def read_profile(path):
    """Read secrets once from an owned private file, never argv or environment."""
    metadata = path.lstat()
    if (not stat.S_ISREG(metadata.st_mode) or metadata.st_nlink != 1 or
            metadata.st_uid != os.getuid() or metadata.st_mode & 0o777 != 0o600 or
            not 0 < metadata.st_size <= 16384):
        raise ValueError("Profile must be an owned private 0600 regular file")
    raw = path.read_bytes()
    profile = json.loads(raw)
    if not isinstance(profile, dict) or set(profile) != PROFILE_KEYS:
        raise ValueError("Profile must match the documented schema exactly")
    if (profile["model"] != "CGS1" or profile["stock_version"] != "4.1.8_0287" or
            type(profile["co2_type"]) is not int or profile["co2_type"] not in (2, 3)):
        raise ValueError("Only the separate tested CGS1 S8/SCD40 profiles are buildable")
    for key in ("wlan_mac", "api_mac"):
        value = profile[key]
        if (not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{2}(?::[0-9a-f]{2}){5}", value) or
                int(value[:2], 16) & 1 or value == "00:00:00:00:00:00"):
            raise ValueError("Profile requires explicit lowercase unicast identities")
    if not int(profile["api_mac"][:2], 16) & 2 or profile["api_mac"] == profile["wlan_mac"]:
        raise ValueError("API MAC must be a separate locally administered unicast identity")
    name = profile["node_name"]
    if not isinstance(name, str) or not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", name):
        raise ValueError("Profile requires one safe ESPHome node name")
    friendly = profile["friendly_name"]
    if (not isinstance(friendly, str) or not friendly or len(friendly.encode()) > 120 or
            not friendly.isprintable() or "/" in friendly):
        raise ValueError("Profile requires a bounded printable friendly name")
    try:
        key = base64.b64decode(profile["api_encryption_key"], validate=True)
    except (ValueError, TypeError):
        raise ValueError("Profile requires one base64 Noise key") from None
    if len(key) != 32 or not any(key):
        raise ValueError("Profile requires one nonzero 32-byte Noise key")
    if not isinstance(profile["qt_core_sha256"], str) or not re.fullmatch(r"[0-9a-f]{64}", profile["qt_core_sha256"]):
        raise ValueError("Profile requires the independently verified stock QtCore digest")
    return profile, hashlib.sha256(raw).hexdigest()


def snapshot(output, reference):
    """Materialize only committed public sources, never dirty deployments."""
    revision = subprocess.check_output(
        ["git", "rev-parse", "--verify", "--end-of-options", reference + "^{commit}"], cwd=ROOT,
        stderr=subprocess.DEVNULL, text=True,
    ).strip()
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise ValueError("Expected one exact source commit")
    archive = output / "source.tar"
    with archive.open("xb") as stream:
        subprocess.run(["git", "archive", "--format=tar", revision, "ports/monitor1"],
                       cwd=ROOT, stdout=stream, stderr=subprocess.DEVNULL, check=True)
    with tarfile.open(archive) as tar:
        tar.extractall(output, filter="data")
    source = output / "ports/monitor1"
    if any(path.is_symlink() for path in source.rglob("*")):
        raise ValueError("Public source snapshot must not contain symlinks")
    # The caller creates a fresh SDK here after recording the source closure.
    # No shared patched environment, private deployment or cached pin is copied.
    hashes = {str(path.relative_to(source)): pm.digest(path) for path in source.rglob("*")
              if path.is_file() and not path.is_symlink()}
    return source, revision, hashes


def header_closure(source, yaml_name, components):
    """Copy transitive root headers without adding unrelated global runtimes.

    ESPHome copies only explicitly listed includes. Custom component headers
    also use root helpers, so their quoted-include closure must be present in
    the generated source tree before C++ compilation starts. Existing include
    order is retained; appended dependencies are protected by their own guards.
    """
    source = source.resolve()
    yaml_seen, direct, pending = set(), set(), [source / yaml_name]
    while pending:
        path = pending.pop()
        if path in yaml_seen:
            continue
        yaml_seen.add(path)
        if not path.resolve().is_relative_to(source) or not path.is_file():
            raise ValueError("YAML include closure escaped or is incomplete")
        text = path.read_text()
        direct.update(re.findall(r"^\s*-\s+([A-Za-z0-9_.-]+\.h)\s*$", text, re.M))
        pending.extend(path.parent / name for name in re.findall(r"!include\s+([^\s]+\.yaml)", text))
    pending = [source / name for name in direct]
    for component in components:
        pending.extend(path for path in (source / "components" / component).rglob("*")
                       if path.suffix in (".h", ".cpp"))
    seen, root_headers = set(), set()
    while pending:
        path = pending.pop()
        if path in seen:
            continue
        seen.add(path)
        if not path.resolve().is_relative_to(source) or not path.is_file():
            raise ValueError("Quoted include closure escaped or is incomplete")
        if path.parent == source and path.suffix == ".h":
            root_headers.add(path.name)
        for name in re.findall(r'^\s*#\s*include\s+"([^\"]+)"', path.read_text(), re.M):
            candidate = path.parent / name
            if not candidate.is_file():
                candidate = source / name
            if candidate.is_file():
                pending.append(candidate)
    return sorted(root_headers - direct)


def program_spec(path):
    from elftools.elf.elffile import ELFFile

    if not path.is_file() or not 0 < path.stat().st_size <= 16 * 1024 * 1024:
        raise ValueError("Expected one bounded compiled program")
    with path.open("rb") as stream:
        elf = ELFFile(stream)
        if (elf.elfclass != 32 or not elf.little_endian or elf.header.e_machine != "EM_ARM" or
                elf.header.e_type not in ("ET_EXEC", "ET_DYN")):
            raise ValueError("Candidate must be ARM32 Linux ELF")
        dynamic = elf.get_section_by_name(".dynamic")
        if dynamic is not None and any(tag.entry.d_tag in ("DT_RPATH", "DT_RUNPATH", "DT_TEXTREL")
                                       for tag in dynamic.iter_tags()):
            raise ValueError("Candidate must not contain host paths or text relocations")
        versions = elf.get_section_by_name(".gnu.version_r")
        if versions is not None:
            for _, auxiliary in versions.iter_versions():
                for item in auxiliary:
                    if item.name.startswith("GLIBC_"):
                        version = item.name.removeprefix("GLIBC_")
                        if (not re.fullmatch(r"[0-9]+(?:\.[0-9]+)*", version) or
                                tuple(map(int, version.split("."))) > (2, 23)):
                            raise ValueError("Candidate requires a newer or private glibc ABI")
    return {"size": path.stat().st_size, "sha256": pm.digest(path)}


def release_line(source, profile):
    """Read the source-pinned version for this exact hardware's full bundle.

    Native UI and internal bridge must report the same package identity. This
    metadata neither enables a first installer nor qualifies an OTA backend.
    User profile/HTTP input cannot choose the release number or product line.
    """
    data = json.loads((source / "release-versions.json").read_text())
    if (data.get("format") != "qingping-monitor1-release-lines-v1"
            or set(data.get("profiles", {})) != {"monitor1-s8", "monitor1-scd40"}
            or type(profile["co2_type"]) is not int or profile["co2_type"] not in (2, 3)):
        raise ValueError("Unverified Monitor 1 release metadata")
    target = "monitor1-s8" if profile["co2_type"] == 2 else "monitor1-scd40"
    value = data["profiles"][target]
    version = value.get("public_version")
    if set(value) != {"public_version"} or type(version) is not int or not 1 <= version <= 2**53-1:
        raise ValueError("Unverified Monitor 1 release version")
    return target, version


def configuration(source, profile, base, build_name, components):
    """Write private YAML: only secrets.yaml carries the Noise key.

    The full/native configuration still requires its freshly generated exact
    guardian pin. The bridge still requires both actual artifact fingerprints.
    Neither manifest is replaced with a default or a synthetic release.
    """
    quote = json.dumps
    target, public_version = release_line(source, profile)
    packages = "  firmware: !include " + base + "\n"
    if base == "native-ui-full-durable.yaml" and profile["co2_type"] == 3:
        packages += "  hardware: !include profiles/co2-scd40.yaml\n"
    closure = header_closure(source, base, components)
    header = source / "device_profile_generated.h"
    text = ("packages:\n" + packages + "substitutions:\n" +
            "".join(f"  {key}: {quote(profile[field])}\n" for key, field in (
                ("cgs1_node_name", "node_name"), ("cgs1_friendly_name", "friendly_name"),
                ("cgs1_api_mac", "api_mac"))) +
            "esphome:\n  project:\n    name: " + quote("ivaschru.qingping_" + target.replace("-", "_")) +
            "\n    version: " + quote(str(public_version)) +
            "\n  compile_process_limit: 1\n  build_path: " + quote(str(source / "build" / build_name)) +
            "\n  build_flags:\n    - " + quote("-include" + str(header)) +
            "\n    - " + quote("-ffile-prefix-map=" + str(source) + "=cgs1-source") + "\n")
    if closure:
        text += "  includes:\n" + "".join("    - " + quote(name) + "\n" for name in closure)
    path = source / (build_name + ".yaml")
    path.write_text(text)
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", type=Path, required=True)
    parser.add_argument("--qt-core", type=Path, required=True)
    parser.add_argument("--qt-archive", type=Path)
    parser.add_argument("--openssl-archive", type=Path)
    parser.add_argument("--source-ref", default="HEAD", help="Exact public Git revision; default is HEAD")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if (Path(sys.prefix).resolve() != (HERE / ".venv").resolve() or
            importlib.metadata.version("esphome") != "2026.10.1" or
            importlib.metadata.version("ziglang") != "0.14.1"):
        raise ValueError("Use only the pinned isolated Monitor 1 environment")
    os.umask(0o077)
    profile, profile_sha = read_profile(args.profile)
    pm.checked_library(args.qt_core.absolute(), profile["qt_core_sha256"])
    if args.openssl_archive is not None and pm.digest(args.openssl_archive) != OPENSSL_SHA:
        raise ValueError("OpenSSL source archive digest mismatch")
    output = pm.private_output(args.output)
    lock_fd = os.open(HERE / "build/release-builder.lock", os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    report = {"complete_build": False, "installation_ready": False, "hardware_contacted": False,
              "installed": False, "profile_sha256": profile_sha, "stage": "snapshot", "artifacts": {}}
    with os.fdopen(lock_fd, "r+b"), (output / "build.log").open("xb") as log:
        try:
            source, revision, source_hashes = snapshot(output, args.source_ref)
            report.update(source_commit=revision, source_sha256=source_hashes)
            python = source / ".venv/bin/python"
            env = dict(os.environ, CC=str(source / "zig-cc"), CXX=str(source / "zig-cxx"),
                       AR=str(source / "zig-ar"), RANLIB=str(source / "zig-ranlib"),
                       ESPHOME_DEFAULT_COMPILE_PROCESS_LIMIT="1", CMAKE_BUILD_PARALLEL_LEVEL="1")

            def run(stage, command, timeout=1200):
                report["stage"] = stage
                (output / "result.json").write_text(json.dumps(report, indent=2) + "\n")
                log.write(("\nSTAGE " + stage + "\n").encode()); log.flush()
                subprocess.run(["nice", "-n", "10", *map(str, command)], cwd=source,
                               env=env, stdout=log, stderr=subprocess.STDOUT, check=True, timeout=timeout)

            run("isolated-sdk", [sys.executable, "-m", "venv", source / ".venv"], 120)
            run("pinned-requirements", [python, "-m", "pip", "install", "--no-input",
                                        "--disable-pip-version-check", "-q", "-r", source / "requirements.txt"])
            for name in ("prepare_host_transport_gate.py", "prepare_host_checked_preferences.py"):
                run(name, [python, source / name, "--apply"], 60)
            if args.openssl_archive is not None:
                (source / "downloads").mkdir(mode=0o700, exist_ok=True)
                shutil.copyfile(args.openssl_archive, source / "downloads/openssl-3.5.9.tar.gz")
            run("arm-crypto", [python, source / "build_crypto.py"])
            helper_command = [python, source / "build_pm_helper.py", "--qt-core", args.qt_core.absolute(),
                              "--qt-core-sha256", profile["qt_core_sha256"],
                              "--output", source / "build/pm-helper"]
            if args.qt_archive is not None:
                helper_command += ["--qt-archive", args.qt_archive.absolute()]
            run("pm-helper", helper_command)
            helper = json.loads((source / "build/pm-helper/result.json").read_text())
            if not helper["complete"]:
                raise ValueError("Stock PM dependency build did not complete")
            helper_sha = helper["artifacts"]["pm_qt_bridge.so"]["sha256"]
            (source / "device_profile_generated.h").write_text(
                "#pragma once\n" + "".join(f"#define {name} {json.dumps(value)}\n" for name, value in (
                    ("CGS1_EXPECTED_WLAN_MAC", profile["wlan_mac"]),
                    ("CGS1_ESPHOME_NODE_NAME", profile["node_name"]),
                    ("CGS1_EXPECTED_PM_HELPER_SHA", helper_sha))))
            (source / "secrets.yaml").write_text("api_encryption_key: " + json.dumps(profile["api_encryption_key"]) + "\n")
            # First-install USB trials use a separate bounded executable,
            # never the production retrying boot launcher or full-UI guardian.
            # It contains no profile/Noise secret and stays on the host until
            # the explicit trial adapter uploads it into a fresh private RAM job.
            run("initial-trial-guardian", [source / "zig-cxx", "-std=c++17", "-Os", "-Wall", "-Wextra", "-Werror",
                                          "-ffunction-sections", "-fdata-sections", "-Wl,--gc-sections",
                                          source / "initial_bridge_trial_main.cpp", "-lcrypto", "-o",
                                          output / "initial-trial-guardian-program"], 240)
            initial_guardian = program_spec(output / "initial-trial-guardian-program")
            (output / "initial-trial-guardian-program").chmod(0o600)
            run("guardian", [source / "zig-cxx", "-std=c++17", "-Os", "-Wall", "-Wextra", "-Werror",
                             "-ffunction-sections", "-fdata-sections", "-Wl,--gc-sections",
                             "-include" + str(source / "device_profile_generated.h"),
                             "-DCGS1_FULL_HARD_RUNTIME_MS=0", source / "supervisor_guardian_main.cpp",
                             "-lcrypto", "-o", output / "guardian-program"], 240)
            guardian = program_spec(output / "guardian-program")
            (source / "build/full-native-release.yaml").write_text(
                'substitutions:\n  guardian_sha256: "' + guardian["sha256"] + '"\n')
            native_config = configuration(source, profile, "native-ui-full-durable.yaml", "candidate-native",
                                          ("cgs1_panel", "cgs1_source"))
            run("native", [python, "-m", "esphome", "compile", native_config])
            native_path = source / "build/candidate-native/.pioenvs" / profile["node_name"] / "program"
            native = program_spec(native_path)
            shutil.copyfile(native_path, output / "native-program")
            manifest = {"native-program": native, "guardian-program": guardian}
            (source / "build/release-runtime-manifest.yaml").write_text(json.dumps(manifest, indent=2) + "\n")
            bridge_config = configuration(source, profile, "stock-bridge-release.yaml", "candidate-bridge",
                                          ("cgs1_full_runtime",))
            run("bridge", [python, "-m", "esphome", "compile", bridge_config])
            bridge_path = source / "build/candidate-bridge/.pioenvs" / profile["node_name"] / "program"
            bridge = program_spec(bridge_path)
            shutil.copyfile(bridge_path, output / "bridge-program")
            for name, expected in source_hashes.items():
                if pm.digest(source / name) != expected:
                    raise ValueError("Public snapshot changed during build")
            for name in ("native-program", "guardian-program", "bridge-program"):
                (output / name).chmod(0o600)
            report.update(complete_build=True, stage="built_not_installed", artifacts={**manifest, "bridge-program": bridge},
                          pm_helper=helper["artifacts"]["pm_qt_bridge.so"], initial_trial_guardian=initial_guardian)
        finally:
            (output / "result.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"complete_build": True, "installation_ready": False, "hardware_contacted": False}))


if __name__ == "__main__":
    main()
