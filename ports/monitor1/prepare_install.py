#!/usr/bin/env python3
"""Assemble a private target-bound initial-install plan, with no device action.

Join the admitted USB source capture, exact bootstrap recipe and matched build
to one immutable local payload. This is the offline half of installation: an
apply adapter must still recheck the live target/boot/CAS/resources and consume
one fresh intent. This module cannot push, activate, retry, reboot or prune.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import uuid

import bootstrap_patches as bootstrap
import build_candidate as candidate
import build_pm_helper as pm
import preflight_adb as preflight


def private_directory(path):
    absolute = path.absolute()
    metadata = absolute.lstat()
    if (absolute.resolve() != absolute or not absolute.is_dir() or
            metadata.st_uid != os.getuid() or metadata.st_mode & 0o777 != 0o700):
        raise ValueError("Inputs must remain in owned private 0700 directories without symlinks")
    return absolute


def read_json(path):
    raw = bootstrap.read_regular(path, 512 * 1024)
    metadata = path.stat()
    if metadata.st_uid != os.getuid() or metadata.st_mode & 0o777 != 0o600:
        raise ValueError("Input manifest must remain private and owned")
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError("Expected a private object manifest")
    return value, bootstrap.sha(raw)


def child(root, name):
    """Manifest names are data, not permission to traverse outside a snapshot."""
    if not isinstance(name, str):
        raise ValueError("Input manifest contains a non-text relative path")
    relative = PurePosixPath(name)
    if (relative.is_absolute() or
            not relative.parts or any(part in (".", "..") for part in relative.parts) or
            "\\" in name or "\x00" in name):
        raise ValueError("Input manifest contains an unsafe relative path")
    path = root.joinpath(*relative.parts)
    if path.resolve() != path.absolute() or not path.is_relative_to(root):
        raise ValueError("Input closure contains a symlink or escapes its private root")
    return path


def candidate_files(build, profile_sha):
    """Audit a frozen build offline, independently of hardware capture.

    Keeping this step separate permits inspection of real cross-builds without
    manufacturing a USB capture or treating a compile fixture as a monitor.
    Its result is only a local byte set; it grants no install admission.
    """
    build = private_directory(build)
    built, build_sha = read_json(build / "result.json")
    if (built.get("complete_build") is not True or built.get("stage") != "built_not_installed" or
            built.get("profile_sha256") != profile_sha or built.get("hardware_contacted") is not False or
            built.get("installed") is not False or built.get("installation_ready") is not False or
            not re.fullmatch(r"[0-9a-f]{40}", built.get("source_commit", ""))):
        raise ValueError("Candidate is incomplete, already installed or bound to another profile")
    source = child(build, "ports/monitor1")
    closure = built.get("source_sha256")
    if not isinstance(closure, dict) or not 1 <= len(closure) <= 2048:
        raise ValueError("Candidate lacks its bounded public source closure")
    for name, expected in closure.items():
        if not isinstance(expected, str) or not re.fullmatch(r"[0-9a-f]{64}", expected):
            raise ValueError("Candidate source closure contains an invalid digest")
        if bootstrap.sha(bootstrap.read_regular(child(source, name), 8 * 1024 * 1024)) != expected:
            raise ValueError("Candidate source snapshot changed after compilation")
    artifacts = built.get("artifacts")
    if not isinstance(artifacts, dict) or set(artifacts) != {"bridge-program", "native-program", "guardian-program"}:
        raise ValueError("Candidate must contain exactly the matched three programs")
    payload = {}
    for name, spec in artifacts.items():
        path = child(build, name)
        data = bootstrap.read_regular(path, 16 * 1024 * 1024)
        if spec != {"size": len(data), "sha256": bootstrap.sha(data)} or candidate.program_spec(path) != spec:
            raise ValueError("Program bytes/ELF ABI differ from the frozen candidate manifest")
        payload[name] = data
    helper = child(source, "build/pm-helper/pm_qt_bridge.so")
    helper_data = bootstrap.read_regular(helper, 2 * 1024 * 1024)
    # The PM builder records bytes/needed as well as SHA; native/guardian use
    # a different size/SHA manifest. Compare each actual producer's schema,
    # never coerce a mismatched report into an apparently compatible pin.
    if built.get("pm_helper") != pm.validate_artifact(helper, shared=True):
        raise ValueError("Production PM helper differs from the matched candidate")
    helper_sha = bootstrap.sha(helper_data)
    if (artifacts["guardian-program"]["sha256"].encode() not in payload["native-program"] or
            any(artifacts[name]["sha256"].encode() not in payload["bridge-program"]
                for name in ("native-program", "guardian-program")) or
            helper_sha.encode() not in payload["bridge-program"]):
        raise ValueError("Compiled runtime/helper pins are not matched")
    payload["pm_qt_bridge.so"] = helper_data
    return payload, built, build_sha


def payload_files(capture, build, patches, profile_path):
    """Verify bytes, identity and matched pins before constructing a payload."""
    capture, build, patches = map(private_directory, (capture, build, patches))
    profile, profile_sha = candidate.read_profile(profile_path)
    observed, capture_sha = read_json(capture / "result.json")
    recipe, recipe_sha = read_json(patches / "result.json")
    if (observed.get("schema_version") != 1 or observed.get("stage") != "read_only_capture_complete" or
            observed.get("hardware_contacted") is not True or type(observed.get("device_writes")) is not int or
            observed["device_writes"] != 0 or observed.get("installed") is not False or
            observed.get("installation_ready") is not False or
            any(observed.get(key) != profile[key] for key in ("stock_version", "wlan_mac", "co2_type"))):
        raise ValueError("Read-only capture does not match this exact device/build profile")
    if (not re.fullmatch(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}", observed.get("boot_id", "")) or
            not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", observed.get("usb_serial", "")) or
            not re.fullmatch(r"usb:[A-Za-z0-9._:-]+", observed.get("usb_transport", ""))):
        raise ValueError("Capture lacks an exact USB/boot identity")
    expected_files = {name: {"sha256": sha, "size": size} for name, (sha, size) in preflight.FILES.items()}
    if observed.get("files") != expected_files or profile["qt_core_sha256"] != preflight.FILES["/usr/lib/libQt5Core.so.5.9.4"][0]:
        raise ValueError("Capture or Qt library differs from the reviewed stock closure")
    # Re-read all captured bytes. A successful historical JSON entry alone is
    # insufficient evidence that the recovery files still exist or are intact.
    originals = {}
    for name, spec in expected_files.items():
        data = bootstrap.read_regular(child(capture, name.lstrip("/")), 8 * 1024 * 1024)
        if len(data) != spec["size"] or bootstrap.sha(data) != spec["sha256"]:
            raise ValueError("Captured recovery material changed or is incomplete")
        if name in ("/data/etc/init.d/start.sh", "/data/bin/watchdog.sh"):
            originals[name] = data
    if (recipe.get("schema_version") != 1 or recipe.get("stage") != "patches_prepared_not_installed" or
            recipe.get("hardware_contacted") is not False or recipe.get("installation_ready") is not False or
            recipe.get("installed") is not False):
        raise ValueError("Bootstrap recipe is not an unapplied local preparation")
    hook = bootstrap.read_regular(child(patches, "startup-hook.sh"))
    start = originals["/data/etc/init.d/start.sh"]
    watchdog = originals["/data/bin/watchdog.sh"]
    new_start, new_watchdog = bootstrap.patch_bytes(start, watchdog, hook)
    payload = {"stock-start.sh.original": start, "stock-watchdog.sh.original": watchdog,
               "start.sh.candidate": new_start, "watchdog.sh.candidate": new_watchdog,
               **{name: bootstrap.read_regular(child(patches, name)) for name in bootstrap.ASSET_PINS}}
    for name, data in payload.items():
        spec = {"size": len(data), "sha256": bootstrap.sha(data)}
        if recipe.get("files", {}).get(name) != spec or bootstrap.read_regular(child(patches, name)) != data:
            raise ValueError("Prepared bootstrap files differ from the exact captured source recipe")
    if any(bootstrap.sha(payload[name]) != expected for name, expected in bootstrap.ASSET_PINS.items()):
        raise ValueError("Bootstrap launchers no longer match the runtime fingerprints")
    binaries, built, build_sha = candidate_files(build, profile_sha)
    payload.update(binaries)
    basis = {"capture_sha256": capture_sha, "candidate_sha256": build_sha,
             "patches_sha256": recipe_sha, "profile_sha256": profile_sha,
             "source_commit": built["source_commit"]}
    return payload, basis, observed, profile


def prepare(capture, build, patches, profile_path, output_path):
    payload, basis, observed, profile = payload_files(capture, build, patches, profile_path)
    output = pm.private_output(output_path)
    files = {}
    for name, data in payload.items():
        fd = os.open(output / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        files[name] = {"size": len(data), "sha256": bootstrap.sha(data)}
    # This is an offline upper-bound request, not a measured free-space/RAM
    # result. Reserve a second native/guardian pair for safe staging/retention
    # and 8 MiB data headroom. Live apply must evaluate the actual filesystem,
    # RAM/process/stock lifecycle again, not assume the request is affordable.
    pair_bytes = sum(files[name]["size"] for name in ("native-program", "guardian-program"))
    plan = {"schema_version": 1, "plan_id": uuid.uuid4().hex,
            "stage": "offline_plan_only", "installation_ready": False,
            "hardware_contacted": False, "device_writes": 0, "installed": False,
            "basis": basis, "target": {key: observed[key] for key in
                       ("wlan_mac", "co2_type", "stock_version", "usb_serial", "usb_transport", "boot_id")},
            "api_identity": {key: profile[key] for key in ("api_mac", "node_name")},
            "files": files, "requested_data_free_bytes": sum(s["size"] for s in files.values()) + pair_bytes + 8 * 1024 * 1024,
            "live_recheck_required": True, "consumed_install_intent": False,
            "writes_to_review": [
                {"path": "/data/.esphome-cgs1", "operation": "create private own tree only if absent"},
                {"path": "/data/etc/init.d/start.sh", "before": bootstrap.START_FACTORY, "after": bootstrap.START_INSTALLED},
                {"path": "/data/bin/watchdog.sh", "before": bootstrap.WATCHDOG_FACTORY, "after": bootstrap.WATCHDOG_INSTALLED}],
            "activation": "not implemented; no launch, preload, signal, boot or full-mode activation",
            "rollback": "exact original scripts retained; live apply must add guarded atomic restore and verify it before activation"}
    raw = (json.dumps(plan, indent=2) + "\n").encode()
    fd = os.open(output / "plan.json", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    return plan, bootstrap.sha(raw)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("capture", "candidate", "patches", "profile", "output"):
        parser.add_argument("--" + name, type=Path, required=True)
    args = parser.parse_args()
    plan, digest = prepare(args.capture, args.candidate, args.patches, args.profile, args.output)
    print(json.dumps({"stage": plan["stage"], "plan_sha256": digest,
                      "installation_ready": False, "hardware_contacted": False, "device_writes": 0}))


if __name__ == "__main__":
    main()
