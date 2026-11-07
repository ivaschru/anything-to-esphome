#!/usr/bin/env python3
"""Publish immutable, source-built Monitor 1 runtime releases, without HACS.

CGS1 is a Linux matched native/guardian/bridge bundle. Unlike Lite, it cannot
use the ESP32 BIN personalizer. This publisher releases the exact build recipe
and public sources, never a personalized ELF, vendor library or pretend OTA
image. Old HA readers ignore runtime_releases and keep their Lite-only backend.
"""
from __future__ import annotations
import argparse
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tarfile

import publish_firmware as channel

ROOT = Path(__file__).resolve().parents[1]
PROFILES = {"monitor1-s8": 2, "monitor1-scd40": 3}
FORMAT = "qingping-monitor1-runtime-source-v1"
SOURCE_PATHS = ("ports/monitor1", "LICENSE", "NOTICE.md")
LIMITATIONS = [
    "Initial USB/HACS installation is experimental and is not enabled by this release.",
    "Automatic HA firmware installation is not implemented for this Linux package.",
    "Personalized ARM programs and the matching vendor Qt library stay private.",
    "Cold power cycling, absent-AP recovery and battery transitions are not hardware-qualified for this release.",
    "Bluetooth proxy is not implemented.",
]


def encoded(value):
    return (json.dumps(value, indent=2, sort_keys=True) + "\n").encode()


def exact_source(root, revision):
    """Require one committed source object; dirty/untracked files are irrelevant."""
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise ValueError("One exact source commit is required")
    actual = channel.git(root, "rev-parse", "--verify", revision + "^{commit}").decode().strip()
    if actual != revision:
        raise ValueError("Source object differs")
    return revision


def public_source(root, revision):
    """Archive only committed, allowlisted source paths with reproducible gzip.

    The controller subsequently clones/archives this same commit. The downloadable
    source tar is for inspection, not an alternate private-profile compiler input.
    Reject generated payloads even if accidentally tracked; archive extraction is
    never used by this publisher and no path supplied by a device is admitted.
    """
    exact_source(root, revision)
    # An isolated source archive may sit inside another checkout's ignored
    # .build directory. Git archive pathspecs inherit that cwd prefix unless
    # reset at the actual repository root; show <commit>:path does not.
    repository = channel.git(root, "rev-parse", "--show-toplevel").decode().strip()
    raw = channel.git(root, "-C", repository, "archive", "--format=tar", revision, *SOURCE_PATHS)
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:") as archive:
        members = archive.getmembers()
        if not members or len(raw) > 32 * 1024 * 1024:
            raise ValueError("Invalid public source archive")
        for member in members:
            path = Path(member.name)
            if (path.is_absolute() or ".." in path.parts or not (member.isfile() or member.isdir())
                    or any(part in {"build", ".venv", ".esphome", "downloads", "__pycache__"} for part in path.parts)
                    or path.suffix.lower() in {".bin", ".elf", ".so", ".pyc", ".a", ".o", ".zip", ".gz", ".tar"}
                    or path.name in {"secrets.yaml", "device_profile_generated.h"}):
                raise ValueError("Non-public input in source archive")
    stream = io.BytesIO()
    with gzip.GzipFile(fileobj=stream, mode="wb", filename="", mtime=0) as compressed:
        compressed.write(raw)
    return stream.getvalue()


def manifest(root, revision, profile, package):
    if profile not in PROFILES:
        raise ValueError("Unqualified Monitor 1 profile")
    lines = json.loads(channel.read_object(root, revision, "ports/monitor1/release-versions.json"))
    if lines.get("format") != "qingping-monitor1-release-lines-v1" or set(lines.get("profiles", {})) != set(PROFILES):
        raise ValueError("Invalid Monitor 1 release lines")
    item = lines["profiles"][profile]
    version = item.get("public_version")
    if set(item) != {"public_version"} or type(version) is not int or not 1 <= version <= 2**53-1:
        raise ValueError("Invalid Monitor 1 public version")
    tag = channel.catalog.firmware_tag(profile, version)
    return {
        "format": FORMAT, "profile": profile, "public_version": version,
        "package_family": "cgs1-linux-armv7-full-runtime",
        "delivery": "source-build-private-profile", "source_commit": revision,
        "source_url": f"https://github.com/{channel.catalog.REPOSITORY}/tree/{revision}",
        "release_url": f"https://github.com/{channel.catalog.REPOSITORY}/tree/{tag}",
        "source": {"url": f"https://raw.githubusercontent.com/{channel.catalog.REPOSITORY}/{tag}/monitor1-runtime-source.tar.gz",
                   "sha256": hashlib.sha256(package).hexdigest(), "size": len(package)},
        "hardware": {"model": "CGS1", "soc": "RK3128", "architecture": "armv7l",
                     "stock_version": "4.1.8_0287", "co2_type": PROFILES[profile]},
        "build": {"entry": "ports/monitor1/build_candidate.py", "esphome": "2026.10.1", "ziglang": "0.14.1",
                  "private_profile_required": True, "private_stock_qt_required": True,
                  "source_ref": revision},
        # Preserve three different claims: existing ports have real runtime
        # evidence; the published source is buildable; this is not an automatic
        # installer qualification or a hardware test of newly compiled bytes.
        "qualification": {"existing_private_runtime_tested": True,
                          "exact_release_build_hardware_tested": False,
                          "initial_installation_ready": False,
                          "automatic_update_ready": False},
        "features": ["Full ESPHome interface", "CO2, temperature, humidity and tVOC",
                     "PM control", "Persistent settings", "English/Russian UI", "Guarded factory return"],
        "limitations": LIMITATIONS,
    }


def release_files(value, package):
    profile = value["profile"]
    version = value["public_version"]
    revision = value["source_commit"]
    readme = f'''# {profile} – firmware runtime {version}

This is the **source-built full ESPHome runtime** for CGS1 / CO2 type {PROFILES[profile]}.
It is not an ESP32 BIN and cannot be uploaded through the Lite updater.

Source commit: `{revision}`. The source archive and release.json are immutable.
Do not boot public placeholders or publish locally compiled personalized programs.

## Build for an existing installation

Clone https://github.com/{channel.catalog.REPOSITORY}. Check out exactly
`{revision}`, then follow `ports/monitor1/BUILD_CANDIDATE.md` from that commit.
Use a private 0600 profile, the matching original private QtCore and the pinned SDK.
The builder generates the actual native/guardian/bridge hashes in dependency order.
Keep the existing API key, node name and API MAC. Its result stays private.

The downloadable source archive is an inspection copy of ports/monitor1 and its
license, not a standalone Git checkout or substitute for the exact source commit.
Neither downloading nor compiling performs an installation or contacts hardware.
Use the existing deployment/recovery procedure for an already installed runtime.
Initial USB installation and automatic HA updates are separate unfinished routes.

Existing S8 and SCD40 private runtimes passed real sensor/UI/settings and software
reboot tests. That does not establish hardware QA for newly built release bytes.
See release.json for the exact compatibility, delivery and qualification boundary.
'''
    return {"monitor1-runtime-source.tar.gz": package, "release.json": encoded(value), "README.md": readme.encode()}


def next_index(previous, values):
    """Leave installable Lite entries intact; no fake image/backend is invented."""
    channel.catalog.parse_catalog(previous)
    result = json.loads(json.dumps(previous))
    existing = result.setdefault("runtime_releases", {})
    if not isinstance(existing, dict) or any(key not in PROFILES for key in existing):
        raise ValueError("Invalid runtime release catalog")
    for value in values:
        old = existing.get(value["profile"])
        if old:
            if old == value:
                continue
            if type(old.get("public_version")) is not int or value["public_version"] <= old["public_version"]:
                raise ValueError("Published Monitor 1 version is immutable; increment the profile version")
        existing[value["profile"]] = value
    if len(encoded(result)) > channel.catalog.MAX_INDEX_BYTES:
        raise ValueError("Oversized catalog")
    channel.catalog.parse_catalog(result)
    return result


def publish(root, values, package, previous_head, previous, source, intent):
    """Publish the selected profile tags and index as one create-only/CAS push.

    A partial/lost result is read back, never automatically resent. Refuse an
    altered existing tag and a stale catalog before consuming the durable intent.
    No GitHub Release/HACS version, HA mutation or device operation is involved.
    """
    index = next_index(previous, values)
    if channel.remote_ref(root, channel.BRANCH) != previous_head:
        raise RuntimeError("Catalog changed; prepare a new publication")
    refs, targets = [], {}
    for value in values:
        tag = channel.catalog.firmware_tag(value["profile"], value["public_version"])
        ref = "refs/tags/" + tag
        files = release_files(value, package)
        old = channel.remote_ref(root, ref)
        if old:
            channel.fetch_object(root, old)
            if any(channel.read_object(root, old, name) != body for name, body in files.items()):
                raise ValueError("Immutable Monitor 1 tag differs")
            head = old
        else:
            head = channel.commit(root, files, source, "Publish " + tag + " runtime source")
        targets[ref] = head
        refs.append(f"{head}:{ref}")
    if index == previous:
        if any(channel.remote_ref(root, ref) != head for ref, head in targets.items()):
            raise RuntimeError("Catalog points to a missing runtime release")
        return {"state": "already_published", "catalog_head": previous_head, "refs": targets}
    head = channel.commit(root, {"firmware-catalog.json": encoded(index)}, previous_head,
                          "Index Monitor 1 runtime releases")
    receipt = {"state": "consumed_before_atomic_push", "source_commit": source,
               "expected_catalog_head": previous_head, "catalog_head": head, "refs": targets}
    channel.save_intent(intent, receipt)
    channel.git(root, "push", "--atomic", f"--force-with-lease={channel.BRANCH}:{previous_head or ''}",
                "origin", *refs, f"{head}:{channel.BRANCH}")
    if (channel.remote_ref(root, channel.BRANCH) != head or
            any(channel.remote_ref(root, ref) != target for ref, target in targets.items())):
        raise RuntimeError("Publication requires read-only reconciliation")
    return {**receipt, "state": "published"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", choices=(*PROFILES, "both"), required=True)
    parser.add_argument("--source-commit", required=True)
    parser.add_argument("--publish", action="store_true")
    args = parser.parse_args()
    source = exact_source(ROOT, args.source_commit)
    # Check this recipe too: an edited local publisher must not claim to be the
    # signed-off source revision. All archived inputs come from Git objects.
    for name in ("tools/publish_monitor1.py", "tools/publish_firmware.py",
                 "tools/build_firmware_catalog.py", "custom_components/qingping_esphome/firmware_catalog.py"):
        if channel.read_object(ROOT, source, name) != (ROOT / name).read_bytes():
            raise ValueError("Uncommitted runtime publication recipe")
    package = public_source(ROOT, source)
    profiles = tuple(PROFILES) if args.profile == "both" else (args.profile,)
    values = [manifest(ROOT, source, profile, package) for profile in profiles]
    head, previous = channel.previous_catalog(ROOT)
    index = next_index(previous, values)
    if args.publish:
        result = publish(ROOT, values, package, head, previous, source,
                         ROOT / ".build/monitor1-publication" / args.profile / "intent.json")
    else:
        result = {"state": "dry_run", "source_commit": source, "expected_catalog_head": head,
                  "runtime_releases": index["runtime_releases"]}
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Git credentials/network bodies and private profile paths never reach
        # public logs. Only our fixed policy messages are safe to render.
        reason = str(error) if type(error) in (ValueError, RuntimeError) else type(error).__name__
        print("Monitor 1 publication refused: " + reason, file=sys.stderr)
        raise SystemExit(1) from None
