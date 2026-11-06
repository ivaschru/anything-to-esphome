#!/usr/bin/env python3
"""Experimental CGS1 bridge autostart arming; no launch, PM preload or reboot.

After a successful bounded trial, clear only the bridge opt-out for the next
ordinary boot. Keep a private empty recovery flag and the PM opt-out. The
separate same-boot disarm restores the bridge opt-out without deleting history.
Nothing here proves a running/persistent installation or enables HACS.
"""
import argparse
from dataclasses import asdict
import hashlib
import json
import math
from pathlib import Path
import re
import shlex
import uuid

import commit_disabled_install as commit
import review_initial_trial as initial
import trial_initial_bridge_adb as trial

staging = commit.staging
BASE = staging.BASE
BACKUP = "disabled.before-next-boot"
ARM_RECEIPT = "arm-bridge-next-boot-receipt.json"
DISARM_RECEIPT = "disarm-bridge-next-boot-receipt.json"
ARM_DONE = "bridge-next-boot.complete"
DISARM_DONE = "bridge-disarm-before-boot.complete"


def exists(path):
    return path.exists() or path.is_symlink()


def unused_receipt(directory, name):
    if exists(directory / name) or exists((directory / name).with_suffix(".next")):
        raise ValueError("Operation intent already exists; reconcile read-only, never retry")


def trial_basis(directory, plan, digest):
    """Require the actual terminal trial report, not just a completed commit."""
    path = directory / trial.RECEIPT
    history = ("stage-receipt.json", "commit-disabled-receipt.json", "rollback-disabled-receipt.json", trial.RECEIPT)
    if (any(exists((directory / name).with_suffix(".next")) for name in history) or
            exists(directory / "rollback-disabled-receipt.json")):
        raise ValueError("Interrupted trial or later rollback requires review before arming")
    receipt, sha = staging.offline.read_json(path)
    result, api = receipt.get("result", {}), receipt.get("api", {})
    if not isinstance(result, dict) or not isinstance(api, dict):
        raise ValueError("Complete structured trial evidence is required")
    pairs = (receipt.get("guardian_process"), receipt.get("child"))
    if (receipt.get("plan_id") != plan["plan_id"] or receipt.get("plan_sha256") != digest or
            receipt.get("stage") != "bounded_trial_stopped_observed" or
            receipt.get("consumed_install_intent") is not True or receipt.get("launch_attempted") is not True or
            any(receipt.get(name) is not False for name in ("installed", "activated", "installation_ready")) or
            receipt.get("local_adb_cleanup") != "completed" or receipt.get("forward_cleanup") not in ("removed", "absent") or
            not all(isinstance(pair, list) and len(pair) == 2 and
                    type(pair[0]) is int and 1 < pair[0] <= 2**31 - 1 and
                    type(pair[1]) is int and 0 < pair[1] < 2**64 for pair in pairs) or pairs[0][0] == pairs[1][0] or
            result.get("guardian") != pairs[0] or result.get("child") != pairs[1] or
            any(result.get(name) is not True for name in ("reaped", "protection_ack", "term_sent")) or
            result.get("forced") is not False or type(result.get("elapsed_ms")) is not int or
            not 60000 <= result["elapsed_ms"] <= 71000 or type(result.get("wait_status")) is not int or
            result["wait_status"] not in (0, 15) or api.get("child") != pairs[1] or
            type(api.get("samples")) is not int or not 2 <= api["samples"] <= 1000):
        raise ValueError("Exact stopped/reaped trial with fresh authenticated samples is required")
    age = api.get("last_sample_age_at_reap_s")
    try:
        valid_age = type(age) in (int, float) and math.isfinite(age) and 0 <= age <= 20
    except OverflowError:
        valid_age = False
    if not valid_age:
        raise ValueError("Trial sample freshness at reap is unverified")
    return sha


def absence(leaf):
    # A successful complete parent listing proves absence; an IO error must
    # not be interpreted as a missing opt-out or missing recovery material.
    if leaf not in ("disabled", BACKUP, ARM_DONE, DISARM_DONE):
        raise ValueError("Only fixed bridge flags can be inspected")
    return ("entries=$(LC_ALL=C ls -A1 " + BASE + ")\n"
            "printf '%s\\n' \"$entries\" | while IFS= read -r entry; do\n"
            " case \"$entry\" in (" + leaf + ") exit 1;; esac\ndone\n")


def empty_flag(leaf):
    if leaf not in ("disabled", BACKUP):
        raise ValueError("Only fixed bridge flags can be inspected")
    path = BASE + "/" + leaf
    return commit.checked_file(path, commit.policy.EMPTY_SHA) + commit.equal(
        "stat -c '%s %a %u %h' " + path, "0 600 0 1")


def guard(plan, baseline, state):
    """Read the same fixed scope with one EXPLICIT expected flag transition.

    baseline describes the verified disabled state before arming. It is not
    presented as a current disabled Snapshot after its flag is removed. Only
    that exact flag block changes; all vendor/source/process/boot checks stay.
    """
    if state not in ("disabled", "backup_disabled", "armed"):
        raise ValueError("Unknown bridge flag transition")
    text = commit.inline_guard(plan, baseline, "commit_disabled", "0" * 32, include_lock=False)
    original = empty_flag("disabled")
    if text.count(original) != 1 or text.count(commit.review.PROCESS_SCAN) != 1:
        raise ValueError("Reviewed scope template changed; do not weaken the guard")
    if state == "disabled":
        flags = original + absence(BACKUP)
    else:
        flags = empty_flag(BACKUP) + (original if state == "backup_disabled" else absence("disabled"))
    text = text.replace(original, flags, 1).replace(commit.review.PROCESS_SCAN, initial.INITIAL_PROCESS_SCAN, 1)
    for leaf in ("program", "launch.sh", "SnowApp-with-PM"):
        text += commit.equal("stat -c '%a %u %h' " + BASE + "/" + leaf, "700 0 1")
    for path in (commit.policy.START, commit.policy.WATCHDOG):
        text += commit.equal("stat -c '%a %u %h' " + path, "755 0 1")
    text += "test -x /data/bin/SnowApp\n"
    # No full-mode/Wi-Fi/persistent prefs store or existing boot launcher may
    # be adopted. Only the original idle stock session is admitted here.
    return "# CGS1_BRIDGE_NEXT_BOOT_SCOPE " + state + "\n" + text + initial.ABSENT_STORES + "\n"


def read_guard(adb, command):
    if adb.read(command) != "":
        raise ValueError("Fixed bridge scope returned unexpected output")


def completion_record(plan, digest, nonce, operation):
    if (operation not in ("arm", "disarm") or not isinstance(nonce, str) or not commit.re_nonce(nonce) or
            not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest) or
            not re.fullmatch(r"[0-9a-f]{32}", plan.get("plan_id", ""))):
        raise ValueError("Exact operation/plan correlation is required")
    leaf = ARM_DONE if operation == "arm" else DISARM_DONE
    body = operation + " " + nonce + " " + plan["plan_id"] + " " + digest
    return leaf, body


def completion_guard(plan, digest, nonce, operation):
    leaf, body = completion_record(plan, digest, nonce, operation)
    path = BASE + "/" + leaf
    return ("# CGS1_BRIDGE_COMPLETION " + operation + "\n" +
            commit.checked_file(path, hashlib.sha256((body + "\n").encode()).hexdigest()) +
            commit.equal("stat -c '%s %a %u %h' " + path, str(len(body) + 1) + " 600 0 1") +
            commit.equal("cat " + path, body))


def completion_write(plan, digest, nonce, operation):
    leaf, body = completion_record(plan, digest, nonce, operation)
    # This is written AFTER the last flag effect. A matching complete record
    # proves the old command has no further flag writes, even if its final
    # sync or ADB output stalls. Mere flag readback cannot establish that.
    return (absence(leaf) + "set -C\nprintf '%s\\n' " + shlex.quote(body) +
            " > " + BASE + "/" + leaf + "\nsync\n")


def arming_command(plan, baseline, digest, nonce):
    return (guard(plan, baseline, "disabled") + absence(ARM_DONE) + absence(DISARM_DONE) +
            "set -C\n: > " + BASE + "/" + BACKUP + "\nsync\n" +
            guard(plan, baseline, "backup_disabled") + "rm " + BASE + "/disabled\nsync\n" +
            completion_write(plan, digest, nonce, "arm"))


def disarming_command(plan, baseline, digest, nonce):
    return (guard(plan, baseline, "armed") + "set -C\n: > " + BASE + "/disabled\nsync\n" +
            completion_write(plan, digest, nonce, "disarm"))


def patched_baseline(plan, digest, raw):
    # JSON receipts turn tuples into arrays. Restore only declared Snapshot
    # tuple fields, then run the existing complete disabled validation again.
    def tuples(value):
        return tuple(tuples(item) for item in value) if isinstance(value, (list, tuple)) else value
    names = ("target", "root_identity", "disabled_flags", "source_hashes", "vendor_hashes",
             "stock_process", "watchdog_process")
    values = dict(raw)
    for name in names:
        values[name] = tuples(values.get(name))
    baseline = commit.policy.Snapshot(**values)
    target = tuple(plan["target"][name] for name in
                   ("wlan_mac", "co2_type", "stock_version", "usb_serial", "usb_transport"))
    commit.policy.DisabledVendorTransaction(plan["plan_id"], digest, target,
                                           plan["target"]["boot_id"], "rollback_disabled", baseline)
    if any(dict(baseline.vendor_hashes)[path] != sha for path, sha in commit.policy.PATCHED.items()):
        raise ValueError("Both exact boot scripts must be committed before arming")
    return baseline


def target_boot(adb, plan):
    target = plan["target"]
    if adb.serial != target["usb_serial"] or adb.usb() != target["usb_transport"]:
        raise ValueError("Exact original USB transport is required")
    return commit.preflight.identity(adb, target["wlan_mac"], target["co2_type"])


def arm(adb, directory, digest):
    directory, plan = staging.load_plan(directory, digest)
    unused_receipt(directory, ARM_RECEIPT)
    unused_receipt(directory, DISARM_RECEIPT)
    basis_sha = trial_basis(directory, plan, digest)
    baseline = patched_baseline(plan, digest, commit.review.collect(adb, directory, digest)["snapshot"])
    initial.committed_marker(adb, plan, digest, directory)
    before, armed = (guard(plan, baseline, state) for state in ("disabled", "armed"))
    read_guard(adb, before)
    receipt = {"schema_version": 1, "plan_id": plan["plan_id"], "plan_sha256": digest,
               "trial_receipt_sha256": basis_sha, "baseline": asdict(baseline),
               "nonce": uuid.uuid4().hex,
               "consumed_install_intent": True, "stage": "arm_consumed_before_write",
               "installed": False, "activated": False, "installation_ready": False,
               "autostart_armed": None}
    path = directory / ARM_RECEIPT
    staging.store_receipt(path, receipt, initial=True)
    try:
        # The only deleted object is the verified empty bridge opt-out. A
        # separate O_EXCL empty recovery flag is durable BEFORE its removal.
        # A crash before unlink keeps the bridge disabled; after unlink only
        # the NEXT ordinary boot can start it. PM remains independently off.
        staging.completed_write(adb, arming_command(plan, baseline, digest, receipt["nonce"]))
        read_guard(adb, armed)
        read_guard(adb, completion_guard(plan, digest, receipt["nonce"], "arm"))
        receipt.update(stage="bridge_autostart_armed_next_boot_unverified", autostart_armed=True)
        staging.store_receipt(path, receipt)
        return summary(receipt)
    except BaseException as error:
        receipt.update(stage="reconciliation_required_no_retry", autostart_armed=None)
        staging.store_receipt(path, receipt)
        if not isinstance(error, Exception):
            raise
        raise RuntimeError("Bridge arming outcome requires read-only --status; never repeat --arm-next-boot") from None


def summary(receipt):
    return {name: receipt.get(name) for name in
            ("stage", "autostart_armed", "installed", "activated", "installation_ready")}


def status(adb, directory, digest):
    directory, plan = staging.load_plan(directory, digest)
    receipt, _ = staging.offline.read_json(directory / ARM_RECEIPT)
    if (receipt.get("plan_id") != plan["plan_id"] or receipt.get("plan_sha256") != digest or
            receipt.get("consumed_install_intent") is not True):
        raise ValueError("Arming receipt does not belong to the exact original plan")
    baseline = patched_baseline(plan, digest, receipt["baseline"])
    if target_boot(adb, plan) != baseline.boot_id:
        return {"stage": "new_boot_requires_authenticated_runtime_verification", "autostart_armed": None,
                "installed": False, "activated": False, "installation_ready": False}
    # Use one positive complete name inventory to choose a state; the guard
    # independently rechecks the selected current files and the whole scope.
    names = adb.read("LC_ALL=C ls -A1 " + BASE).splitlines()
    if len(names) != len(set(names)) or any(not re.fullmatch(r"[A-Za-z0-9_.-]+", name) for name in names):
        raise ValueError("Complete fixed root listing is unverified")
    if "disabled" in names:
        state = "backup_disabled" if BACKUP in names else "disabled"
    elif BACKUP in names:
        state = "armed"
    else:
        raise ValueError("Neither bridge opt-out nor its recovery flag is present")
    read_guard(adb, guard(plan, baseline, state))
    # A slow original command may still remove the opt-out after a read.
    # Refuse disarm/terminal claims until its matching AFTER-effects record
    # exists. Do not infer command termination from USB timeout or flags.
    try:
        read_guard(adb, completion_guard(plan, digest, receipt.get("nonce"), "arm"))
        if exists(directory / DISARM_RECEIPT):
            later, _ = staging.offline.read_json(directory / DISARM_RECEIPT)
            if (later.get("plan_id") != plan["plan_id"] or later.get("plan_sha256") != digest or
                    later.get("consumed_install_intent") is not True):
                raise ValueError("Disarm receipt belongs to another operation")
            read_guard(adb, completion_guard(plan, digest, later.get("nonce"), "disarm"))
    except ValueError:
        return {"stage": "device_completion_unverified_no_write_authority", "autostart_armed": None,
                "installed": False, "activated": False, "installation_ready": False}
    return {"stage": "read_only_" + state, "autostart_armed": state == "armed",
            "installed": False, "activated": False, "installation_ready": False}


def disarm(adb, directory, digest):
    directory, plan = staging.load_plan(directory, digest)
    unused_receipt(directory, DISARM_RECEIPT)
    current = status(adb, directory, digest)
    if current["stage"] in ("read_only_disabled", "read_only_backup_disabled"):
        return {**current, "stage": "already_disabled_no_write"}
    if current["stage"] == "device_completion_unverified_no_write_authority":
        raise ValueError("Original writer completion is unverified; do not race a possibly pending flag change")
    if current["stage"] != "read_only_armed":
        raise ValueError("Disarm is limited to the original idle boot; never stop/adopt a running bridge")
    original, _ = staging.offline.read_json(directory / ARM_RECEIPT)
    baseline = patched_baseline(plan, digest, original["baseline"])
    receipt = {"schema_version": 1, "plan_id": plan["plan_id"], "plan_sha256": digest,
               "nonce": uuid.uuid4().hex,
               "consumed_install_intent": True, "stage": "disarm_consumed_before_write",
               "autostart_armed": None, "installed": False, "activated": False, "installation_ready": False}
    path = directory / DISARM_RECEIPT
    staging.store_receipt(path, receipt, initial=True)
    try:
        # Recheck that the original arm cannot perform a late flag write in
        # the same shell that creates the opt-out. No device PID is adopted.
        command = (completion_guard(plan, digest, original["nonce"], "arm") +
                   disarming_command(plan, baseline, digest, receipt["nonce"]))
        staging.completed_write(adb, command)
        read_guard(adb, guard(plan, baseline, "backup_disabled"))
        read_guard(adb, completion_guard(plan, digest, receipt["nonce"], "disarm"))
        receipt.update(stage="bridge_disabled_before_boot", autostart_armed=False)
        staging.store_receipt(path, receipt)
        return summary(receipt)
    except BaseException as error:
        receipt.update(stage="reconciliation_required_no_retry", autostart_armed=None)
        staging.store_receipt(path, receipt)
        if not isinstance(error, Exception):
            raise
        raise RuntimeError("Bridge disarm outcome requires read-only --status; never repeat the write") from None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adb", type=Path, default=Path("adb"))
    parser.add_argument("--serial", required=True)
    parser.add_argument("--plan-directory", type=Path, required=True)
    parser.add_argument("--expected-plan-sha256", required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--arm-next-boot", action="store_true")
    mode.add_argument("--disarm-before-boot", action="store_true")
    mode.add_argument("--status", action="store_true")
    args = parser.parse_args()
    operation = status if args.status else disarm if args.disarm_before_boot else arm
    print(json.dumps(operation(commit.preflight.Adb(args.adb, args.serial),
                               args.plan_directory, args.expected_plan_sha256)))


if __name__ == "__main__":
    main()
