#!/usr/bin/env python3
"""Experimental local USB entry for an exported private matched build.

No compilation, VM, LAN ADB or generic shell interface. Preparation performs a
NEW real native USB capture for the selected profile; a browser report is never
relabelled get-devpath evidence. Explicit installation uses the original guarded
engines once. Do not run as root, reset a working monitor, or repeat a consumed
attempt. Fresh-device hardware qualification remains outstanding.
"""
import argparse
import asyncio
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import sys
import uuid

# Deliberately self-contained: importing a source-policy file from this bundle
# before checking all its body pins would execute unverified bundled Python.
# A contract test keeps this fixed set equal to the companion's reviewed set.
# Membership admits a producer; the manifest/report must still bind ONE source.
REVIEWED_SOURCE_COMMITS = frozenset(("53d97b9609e8e0fcdfc5d003101f620098dbc734",
                                     "0de9c99e57192742b82616cf82c0fdad71c562c5",
                                     "e09440f9fa36da2aaad16212734879bb6304f6d2"))
TRIAL_SOURCE_COMMITS = frozenset(("53d97b9609e8e0fcdfc5d003101f620098dbc734",))
MAX_PACKAGE = 64 * 1024**2


def private_root(path):
    path = Path(path).absolute()
    info = path.lstat()
    if path.resolve() != path or not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
        raise ValueError("Private owned 0700 bundle directory required")
    return path


def private_file(path, maximum):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, "rb") as stream:
        info = os.fstat(stream.fileno())
        if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_nlink != 1 or
                stat.S_IMODE(info.st_mode) != 0o600 or not 0 < info.st_size <= maximum):
            raise ValueError("Private owned 0600 regular file required")
        raw = stream.read(maximum + 1)
    if len(raw) != info.st_size:
        raise ValueError("Private bundle changed while reading")
    return raw


def unique_json(raw):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("Duplicate bundle metadata key")
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=unique)


def write_new(path, value):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "wb") as stream:
        stream.write((json.dumps(value, indent=2) + "\n").encode())
        stream.flush()
        os.fsync(stream.fileno())
    fd = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def load_bundle(directory):
    root = private_root(directory)
    manifest = unique_json(private_file(root / "bundle.json", 512 * 1024))
    if (set(manifest) != {"schema_version", "stage", "source_commit", "job_id", "profile_sha256", "installed", "installation_ready", "device_writes", "files"} or
            type(manifest["schema_version"]) is not int or manifest["schema_version"] != 1 or
            manifest["stage"] != "private_computer_bundle" or
            not isinstance(manifest["source_commit"], str) or manifest["source_commit"] not in REVIEWED_SOURCE_COMMITS or
            manifest["installed"] is not False or manifest["installation_ready"] is not False or
            type(manifest["device_writes"]) is not int or manifest["device_writes"] != 0 or
            not isinstance(manifest["job_id"], str) or not re.fullmatch(r"[a-f0-9]{32}", manifest["job_id"]) or
            not isinstance(manifest["files"], dict) or not 10 <= len(manifest["files"]) <= 2100):
        raise ValueError("Exact unattempted private computer bundle required")
    total = 0
    for name, pin in manifest["files"].items():
        relative = PurePosixPath(name)
        if (relative.is_absolute() or "\\" in name or any(part in ("", ".", "..") for part in name.split("/")) or
                not isinstance(pin, dict) or set(pin) != {"size", "sha256"} or type(pin["size"]) is not int or
                not 0 < pin["size"] <= 16 * 1024**2 or not isinstance(pin["sha256"], str) or not re.fullmatch(r"[a-f0-9]{64}", pin["sha256"])):
            raise ValueError("Invalid private bundle file pin")
        total += pin["size"]
        if total > MAX_PACKAGE:
            raise ValueError("Private bundle exceeds its budget")
        path = root.joinpath(*relative.parts)
        if path.resolve() != path or not path.is_relative_to(root):
            raise ValueError("Private bundle contains a symlink or escape")
        raw = private_file(path, 16 * 1024**2)
        if len(raw) != pin["size"] or hashlib.sha256(raw).hexdigest() != pin["sha256"]:
            raise ValueError("Private bundle file changed")
    required = {"profile.json", "computer_install.py", "runtime-requirements.txt", "candidate/result.json"}
    if not required <= set(manifest["files"]) or manifest["files"]["profile.json"]["sha256"] != manifest["profile_sha256"]:
        raise ValueError("Private bundle lacks its bound profile")
    source = root / "candidate/ports/monitor1"
    result = unique_json(private_file(root / "candidate/result.json", 512 * 1024))
    closure = result.get("source_sha256")
    if (result.get("source_commit") != manifest["source_commit"] or result.get("profile_sha256") != manifest["profile_sha256"] or
            not isinstance(closure, dict) or not 1 <= len(closure) <= 2048):
        raise ValueError("Candidate lacks its matching public source closure")
    for name, expected in closure.items():
        pin = manifest["files"].get("candidate/ports/monitor1/" + name)
        if not pin or pin["sha256"] != expected:
            raise ValueError("Candidate source closure changed")
    # Source code is loaded only after every bundled body passed its private
    # metadata/hash check. The actual ELF/helper audit still belongs to the
    # original canonical candidate/planner before any USB write.
    return root, source, manifest


def engines(source):
    sys.path.insert(0, str(source))
    import preflight_adb, bootstrap_patches, prepare_install, stage_commit_trial_adb, arm_bridge_next_boot_adb, verify_bridge_boot_adb
    return preflight_adb, bootstrap_patches, prepare_install, stage_commit_trial_adb, arm_bridge_next_boot_adb, verify_bridge_boot_adb


def local_status(root, manifest):
    """Read fixed local receipts without importing engines or finding ADB.

    This recovers a lost plan digest while disconnected. A historical arming
    receipt is never live device health or permission to repeat an operation;
    the existing USB status/observe commands remain separate. Unknown or
    partial files are preserved and reported unverified, never repaired.
    """
    result = {"stage": "local_receipt_status", "state": "not_prepared",
              "local_receipt_only": True, "read_only": True,
              "hardware_contacted": False, "runtime_observed": False,
              "installed": False, "installation_ready": False,
              "retry_authorized": False, "install_history_present": False}
    if "computer-state" not in os.listdir(root):
        return result
    result.update(state="preparation_unverified", install_history_present=None)
    try:
        state = private_root(root / "computer-state")
        names = os.listdir(state)
        # Observation folders are created only after an installation intent.
        # Preserve that evidence even if a local marker is now missing.
        history = bool({"install-intent.json", "install-result.json", "observations"} & set(names))
        result.update(state="install_unverified" if history else "preparation_unverified",
                      install_history_present=history)
        prepared = unique_json(private_file(state / "prepared.json", 16384))
        if (not isinstance(prepared, dict) or set(prepared) != {"plan_sha256", "profile_sha256"} or
                prepared["profile_sha256"] != manifest["profile_sha256"] or
                not isinstance(prepared["plan_sha256"], str) or
                not re.fullmatch(r"[a-f0-9]{64}", prepared["plan_sha256"])):
            return result
        plan_root = private_root(state / "install-plan")
        raw = private_file(plan_root / "plan.json", 512 * 1024)
        plan = unique_json(raw)
        if not isinstance(plan, dict) or not isinstance(plan.get("basis"), dict):
            return result
        if (hashlib.sha256(raw).hexdigest() != prepared["plan_sha256"] or
                plan.get("stage") != "offline_plan_only" or
                plan.get("basis", {}).get("profile_sha256") != manifest["profile_sha256"] or
                plan["basis"].get("source_commit") != manifest["source_commit"] or
                plan.get("installed") is not False or plan.get("installation_ready") is not False or
                plan.get("hardware_contacted") is not False or plan.get("live_recheck_required") is not True or
                plan.get("consumed_install_intent") is not False or
                type(plan.get("device_writes")) is not int or plan["device_writes"] != 0):
            return result
        result["plan_sha256"] = prepared["plan_sha256"]
        if not history:
            result["state"] = "plan_recorded"
            return result
        intent = unique_json(private_file(state / "install-intent.json", 16384))
        if (set(intent) != {"plan_sha256", "experimental_reviewed"} or
                intent["plan_sha256"] != prepared["plan_sha256"] or intent["experimental_reviewed"] is not True):
            return result
        receipt = unique_json(private_file(state / "install-result.json", 16384))
        if (set(receipt) != {"state", "plan_sha256"} or receipt["plan_sha256"] != prepared["plan_sha256"] or
                receipt["state"] not in ("armed_waiting_reboot", "install_unverified")):
            return result
        result["receipt_state"] = receipt["state"]
        if receipt["state"] == "armed_waiting_reboot":
            result["state"] = "install_recorded"
    except (OSError, ValueError, TypeError, KeyError):
        # Do not infer zero device writes from a missing/corrupt local result,
        # print filesystem/JSON bodies, or delete history to permit a retry.
        pass
    return result


def prepare(root, modules, adb):
    preflight, bootstrap, planner, _, _, _ = modules
    state = root / "computer-state"
    profile, profile_sha = planner.candidate.read_profile(root / "profile.json")
    planner.candidate_files(root / "candidate", profile_sha)
    state.mkdir(mode=0o700)  # Existing/partial preparation is never overwritten.
    preflight.capture(adb, profile["wlan_mac"], profile["co2_type"], state / "capture")
    bootstrap.prepare(state / "capture/data/etc/init.d/start.sh", state / "capture/data/bin/watchdog.sh", state / "bootstrap")
    plan, digest = planner.prepare(state / "capture", root / "candidate", state / "bootstrap", root / "profile.json", state / "install-plan")
    write_new(state / "prepared.json", {"plan_sha256": digest, "profile_sha256": profile_sha})
    return {"stage": "computer_plan_prepared", "plan_sha256": digest, "friendly_name": profile["friendly_name"],
            "wlan_mac": profile["wlan_mac"], "co2_type": profile["co2_type"],
            "requested_data_free_bytes": plan["requested_data_free_bytes"], "device_writes": 0,
            "experimental": True, "installed": False, "installation_ready": False}


async def install(root, modules, adb, digest, reviewed):
    if reviewed is not True or not isinstance(digest, str) or not re.fullmatch(r"[a-f0-9]{64}", digest):
        raise ValueError("Explicit experimental review and exact plan SHA required")
    _, _, planner, sequence, arm, _ = modules
    state = private_root(root / "computer-state")
    prepared = unique_json(private_file(state / "prepared.json", 16384))
    _, profile_sha = planner.candidate.read_profile(root / "profile.json")
    if prepared != {"plan_sha256": digest, "profile_sha256": profile_sha}:
        raise ValueError("Prepared plan or private profile changed")
    # Durable wrapper fence precedes the canonical writer. The canonical
    # stage/commit/trial/arm keep their own exact receipts and live checks.
    write_new(state / "install-intent.json", {"plan_sha256": digest, "experimental_reviewed": True})
    outcome = "install_unverified"
    try:
        result = await sequence.run(adb, state / "install-plan", digest, root / "candidate", root / "profile.json")
        if (result.get("stage") != "disabled_sequence_trial_observed" or result.get("local_adb_cleanup") != "completed" or
                result.get("forward_cleanup") not in ("removed", "absent") or
                any(result.get(key) is not False for key in ("installed", "activated", "installation_ready", "retry_authorized"))):
            raise ValueError("Trial or owned transport cleanup unverified")
        result = arm.arm(adb, state / "install-plan", digest)
        if (result.get("stage") != "bridge_autostart_armed_next_boot_unverified" or result.get("autostart_armed") is not True or
                any(result.get(key) is not False for key in ("installed", "activated", "installation_ready"))):
            raise ValueError("Next-boot arming unverified")
        outcome = "armed_waiting_reboot"
    finally:
        write_new(state / "install-result.json", {"state": outcome, "plan_sha256": digest})
    return {"state": outcome, "replay_allowed": False, "installed": False, "installation_ready": False}


async def observe(root, modules, adb):
    _, _, _, sequence, _, observer = modules
    state = private_root(root / "computer-state")
    prepared = unique_json(private_file(state / "prepared.json", 16384))
    intent = unique_json(private_file(state / "install-intent.json", 16384))
    digest = prepared["plan_sha256"]
    if intent != {"plan_sha256": digest, "experimental_reviewed": True}:
        raise ValueError("Exact consumed computer intent required")
    raw_plan = private_file(state / "install-plan/plan.json", 512 * 1024)
    plan = unique_json(raw_plan)
    if hashlib.sha256(raw_plan).hexdigest() != digest:
        raise ValueError("Frozen computer plan changed")
    observations = state / "observations"
    observations.mkdir(mode=0o700, exist_ok=True)
    private_root(observations)
    if len(os.listdir(observations)) >= 64:
        raise ValueError("Observation budget exhausted; preserve history")
    output = observations / uuid.uuid4().hex
    output.mkdir(mode=0o700)
    try:
        current = sequence.status(adb, state / "install-plan", digest)
        if (current.get("stage") == "read_only_armed" and current.get("autostart_armed") is True and
                current.get("receipt_update_incomplete") is False and
                all(current.get(key) is False for key in ("installed", "activated", "installation_ready", "retry_authorized"))):
            result = {"state": "awaiting_reboot", "runtime_observed": False, "device_writes": 0,
                      "installed": False, "installation_ready": False}
            write_new(output / "same-boot.json", {"plan_sha256": digest, "current": current})
            return result
    except Exception:
        pass  # No new launch, reboot or writer follows an unverified read.
    result = await observer.verify(adb, state / "install-plan", digest, root / "profile.json")
    write_new(output / "bridge-boot-observation.json", result)
    if (result.get("stage") != "post_boot_bridge_observed" or result.get("runtime_observed") is not True or
            result.get("plan_id") != plan.get("plan_id") or result.get("plan_sha256") != digest or
            result.get("api_disconnect") != "completed" or result.get("forward_cleanup") not in ("removed", "absent") or
            any(result.get(key) is not False for key in ("installed", "activated", "installation_ready")) or
            type(result.get("device_writes")) is not int or result["device_writes"] != 0):
        raise ValueError("Post-boot observation incomplete; no retry authority")
    return {"state": "bridge_observed", "runtime_observed": True, "device_writes": 0,
            "installed": False, "installation_ready": False}


async def full_review(root, modules, adb):
    from full_ui_usb import inspect
    state = private_root(root / "computer-state")
    prepared = unique_json(private_file(state / "prepared.json", 16384))
    intent = unique_json(private_file(state / "install-intent.json", 16384))
    digest = prepared["plan_sha256"]
    if intent != {"plan_sha256": digest, "experimental_reviewed": True}:
        raise ValueError("Exact consumed computer intent required")
    canonical = modules[3].trial
    _, plan = canonical.review.staging.load_plan(state / "install-plan", digest)
    profile, profile_sha = canonical.candidate.read_profile(root / "profile.json")
    if profile_sha != plan["basis"]["profile_sha256"]:
        raise ValueError("Exact private profile required")
    observations = state / "observations"
    observations.mkdir(mode=0o700, exist_ok=True)
    private_root(observations)
    if len(os.listdir(observations)) >= 64:
        raise ValueError("Observation budget exhausted; preserve history")
    output = observations / uuid.uuid4().hex
    output.mkdir(mode=0o700)
    result = await inspect(adb, plan, profile, canonical)
    write_new(output / "full-ui-review.json", {**result, "plan_sha256": digest})
    return result


def full_trial_status(root, manifest):
    """Fixed local read, no engine import, ADB discovery or write replay."""
    result = {"state": "not_started", "local_receipt_only": True, "read_only": True,
              "hardware_contacted": False, "installed": False, "installation_ready": False,
              "boot_enabled": False, "replay_allowed": False}
    state = private_root(root / "computer-state")
    if "full-ui-trial-intent.json" not in os.listdir(state):
        return result
    result["state"] = "full_ui_trial_unverified"
    raw = private_file(state / "full-ui-trial-intent.json", 16384)
    intent = unique_json(raw)
    prepared = unique_json(private_file(state / "prepared.json", 16384))
    if (set(intent) != {"plan_sha256", "source_commit", "install_intent_sha256", "nonce", "experimental_reviewed"} or
            intent["plan_sha256"] != prepared.get("plan_sha256") or
            intent["source_commit"] != manifest["source_commit"] or intent["source_commit"] not in TRIAL_SOURCE_COMMITS or
            intent["install_intent_sha256"] != hashlib.sha256(private_file(state / "install-intent.json", 16384)).hexdigest() or
            intent["experimental_reviewed"] is not True or not isinstance(intent["nonce"], str) or
            not re.fullmatch(r"[a-f0-9]{16}", intent["nonce"]) or intent["nonce"] == "0" * 16 or
            prepared.get("profile_sha256") != manifest["profile_sha256"] or
            hashlib.sha256(private_file(state / "install-plan/plan.json", 512 * 1024)).hexdigest() != intent["plan_sha256"]):
        raise ValueError("Exact consumed screen-trial basis required")
    if "full-ui-trial-result.json" in os.listdir(state):
        # The helper was independently verified by load_bundle before import.
        if not {"full_ui_trial.py", "full_ui_review.py"} <= set(manifest["files"]):
            raise ValueError("Verified screen-trial helper required")
        from full_ui_trial import checked_proof
        receipt = unique_json(private_file(state / "full-ui-trial-result.json", 16384))
        if set(receipt) != {"intent_sha256", "proof"} or receipt["intent_sha256"] != hashlib.sha256(raw).hexdigest():
            raise ValueError("Exact screen-trial result required")
        proof = checked_proof(receipt["proof"], intent["nonce"])
        plan = unique_json(private_file(state / "install-plan/plan.json", 512 * 1024))
        if proof["state"] == "full_ui_trial_returned_observed" and proof["boot_id"] == plan.get("target", {}).get("boot_id"):
            raise ValueError("Post-install Linux boot required")
        result.update(state=proof["state"], native_observations=proof["native_observations"],
            stock_return_observed=proof["stock_return_observed"], launch_acknowledged=proof["launch_acknowledged"])
    return result


async def full_trial(root, modules, adb, manifest, digest, reviewed):
    """One explicit computer trial; same API/USB engine as the HA route."""
    if (reviewed is not True or not isinstance(digest, str) or not re.fullmatch(r"[a-f0-9]{64}", digest) or
            manifest["source_commit"] not in TRIAL_SOURCE_COMMITS or
            not {"full_ui_trial.py", "full_ui_trial_usb.py", "full_ui_review.py"} <= set(manifest["files"])):
        raise ValueError("Reviewed matched source and explicit screen trial required")
    state = private_root(root / "computer-state")
    if "full-ui-trial-intent.json" in os.listdir(state):
        raise ValueError("Screen trial already consumed; read full-trial-status")
    prepared = unique_json(private_file(state / "prepared.json", 16384))
    intent_raw = private_file(state / "install-intent.json", 16384)
    if (prepared != {"plan_sha256": digest, "profile_sha256": manifest["profile_sha256"]} or
            unique_json(intent_raw) != {"plan_sha256": digest, "experimental_reviewed": True}):
        raise ValueError("Exact prepared installation required")
    canonical = modules[3].trial
    _, plan = canonical.review.staging.load_plan(state / "install-plan", digest)
    profile, profile_sha = canonical.candidate.read_profile(root / "profile.json")
    if (profile_sha != manifest["profile_sha256"] or profile_sha != plan["basis"]["profile_sha256"] or
            plan["basis"]["source_commit"] != manifest["source_commit"]):
        raise ValueError("Exact private profile/source required")
    # Observe the actual post-install boot before consuming this distinct
    # intent. This read cannot arm/reset/reboot or promote old receipt flags.
    observed = await observe(root, modules, adb)
    if observed["state"] != "bridge_observed":
        raise ValueError("Observed new bridge boot required")
    from full_ui_trial import checked_proof
    from full_ui_trial_usb import image_bytes, run_usb
    images = {kind: image_bytes(state / "install-plan" / kind, plan["files"][kind])
              for kind in ("native-program", "guardian-program")}
    lock = os.open(state / "full-ui-trial.lock", os.O_WRONLY | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        info = os.fstat(lock)
        if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_nlink != 1 or
                stat.S_IMODE(info.st_mode) != 0o600):
            raise ValueError("Owned private screen-trial lease required")
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        record = {"plan_sha256": digest, "source_commit": manifest["source_commit"],
                  "install_intent_sha256": hashlib.sha256(intent_raw).hexdigest(),
                  "nonce": uuid.uuid4().hex[:16], "experimental_reviewed": True}
        write_new(state / "full-ui-trial-intent.json", record)
        raw = private_file(state / "full-ui-trial-intent.json", 16384)
        proof = await run_usb(adb, plan, profile, canonical, record["nonce"], images)
        checked_proof(proof, record["nonce"])
        write_new(state / "full-ui-trial-result.json", {"intent_sha256": hashlib.sha256(raw).hexdigest(), "proof": proof})
    finally:
        os.close(lock)
    return full_trial_status(root, manifest)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("prepare", "install", "status", "observe", "full-review", "full-trial", "full-trial-status", "local-status"))
    parser.add_argument("--serial")
    parser.add_argument("--adb", default="adb")
    parser.add_argument("--plan-sha256")
    parser.add_argument("--experimental-reviewed", action="store_true")
    args = parser.parse_args()
    if args.action not in ("local-status", "full-trial-status") and not args.serial:
        parser.error("--serial is required for USB operations")
    os.umask(0o077)
    root, source, manifest = load_bundle(Path(__file__).resolve().parent)
    if args.action == "local-status":
        print(json.dumps(local_status(root, manifest), ensure_ascii=False, indent=2))
        return
    if args.action == "full-trial-status":
        print(json.dumps(full_trial_status(root, manifest), ensure_ascii=False, indent=2))
        return
    modules = engines(source)
    executable = shutil.which(args.adb)
    if not executable:
        raise ValueError("Install Android platform-tools and select its local adb")
    # Never use a caller's remote ADB server. Native USB stays on this computer.
    os.environ["ADB_SERVER_SOCKET"] = "tcp:localhost:5037"
    adb = modules[3].trial.TrialAdb(Path(executable), args.serial)
    if args.action == "prepare":
        result = prepare(root, modules, adb)
    elif args.action == "install":
        result = asyncio.run(install(root, modules, adb, args.plan_sha256, args.experimental_reviewed))
    elif args.action == "observe":
        result = asyncio.run(observe(root, modules, adb))
    elif args.action == "full-review":
        result = asyncio.run(full_review(root, modules, adb))
    elif args.action == "full-trial":
        result = asyncio.run(full_trial(root, modules, adb, manifest, args.plan_sha256, args.experimental_reviewed))
    else:
        state = private_root(root / "computer-state")
        prepared = unique_json(private_file(state / "prepared.json", 16384))
        # Original read-only status includes AFTER-effects reconciliation. It
        # never reissues install/launch/reboot or claims current runtime health.
        result = modules[3].status(adb, state / "install-plan", prepared["plan_sha256"])
        result = {key: result[key] for key in ("stage", "autostart_armed", "installed", "activated", "installation_ready", "retry_authorized") if key in result}
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # ADB/API library errors may include credentials or remote output. The
        # private original receipts carry the phase; never print raw errors.
        print("Operation unverified. Preserve this bundle and computer-state; do not repeat installation.", file=sys.stderr)
        raise SystemExit(1) from None
