#!/usr/bin/env python3
"""Experimental disabled vendor-script commit/rollback; never activate firmware.

NOT hardware qualified. Requires the exact successful private stage and fresh
read-only process/root/source proof. Each direction consumes a separate durable
intent before any device write, including its permanent own lock. A timeout is
reconciliation only, never a resend or automatic rollback. Both opt-outs remain
set; no program launch, preload, signal, reboot or full-mode activation exists.
"""
import argparse
import json
from pathlib import Path
import shlex
import uuid

import disabled_commit_policy as policy
import review_disabled_install as review
import stage_install_adb as staging
import preflight_adb as preflight

PHASES = {"commit_disabled": "commit-disabled", "rollback_disabled": "rollback-disabled"}


def equal(command, value):
    # Assignment preserves the substitution's exit status under set -e.
    # A comparison like [ "$(scan)" = PID ] would incorrectly accept a scan
    # that printed PID and THEN failed while inspecting another live task.
    return 'observed_value=$(' + command + ')\n[ "$observed_value" = ' + shlex.quote(str(value)) + ' ]\n'


def checked_file(path, sha):
    return ("test ! -L " + path + "\ntest -f " + path + "\n" +
            equal("stat -c '%h %u' " + path, "1 0") +
            equal("sha256sum " + path + " | awk '{print $1}'", sha))


def inline_guard(plan, observed, direction, nonce, include_lock=True):
    """Recheck fixed scope in the SAME shell immediately before replacement.

    All inserted values are validated plan hashes, numeric IDs and public fixed
    paths. No Noise/Wi-Fi key, arbitrary remote filename or generic command
    enters this script. The earlier collector alone is never a write grant.
    """
    base = staging.BASE
    if direction not in PHASES or not isinstance(nonce, str) or not re_nonce(nonce):
        raise ValueError("One exact transaction direction/token is required")
    phase = PHASES[direction]
    root_id = f"{observed.root_identity[0]} {observed.root_identity[1]} 700 0"
    text = "test ! -L " + base + "\ntest -d " + base + "\n"
    text += equal("stat -c '%d %i %a %u' " + base, root_id)
    text += "test ! -L /data/bin\ntest ! -L /data/etc\ntest ! -L /data/etc/init.d\n"
    for parent in ("/data/bin", "/data/etc/init.d"):
        text += equal("stat -c '%d' " + parent, observed.root_identity[0])
    text += "test ! -L " + base + "/install.intent\ntest -f " + base + "/install.intent\n"
    text += equal("stat -c '%s %a %u %h' " + base + "/install.intent", "98 600 0 1")
    text += equal("cat " + base + "/install.intent", observed.install_marker)
    for leaf in ("disabled", "pm-helper.disabled"):
        path = base + "/" + leaf
        text += checked_file(path, policy.EMPTY_SHA)
        text += equal("stat -c '%s %a %u %h' " + path, "0 600 0 1")
    text += equal("cat /sys/class/net/wlan0/address", observed.target[0])
    text += equal("cat /data/etc/os-release", "CLEARGRASS_VERSION=4.1.8_0287")
    text += equal("cat /proc/sys/kernel/random/boot_id", observed.boot_id)
    text += equal(preflight.CO2_READ, observed.target[1])
    text += equal(review.PROCESS_SCAN, observed.stock_process[0])
    for pid, start, executable in ((observed.stock_process[0], observed.stock_process[1], "/data/bin/SnowApp"),
                                   (observed.watchdog_process[0], observed.watchdog_process[1], "/bin/busybox")):
        proc = "/proc/" + str(pid)
        text += equal("readlink " + proc + "/exe", executable)
        text += equal("stat -c '%u' " + proc, 0)
        text += equal("sed 's/.*) //' " + proc + "/stat | awk '{print $20}'", start)
        text += ("process_state=$(sed 's/.*) //' " + proc + "/stat | awk '{print $1}')\n" +
                 'case "$process_state" in R|S|D|I) :;; *) exit 1;; esac\n')
    stock = "/proc/" + str(observed.stock_process[0])
    watchdog = "/proc/" + str(observed.watchdog_process[0])
    text += equal("sed 's/.*) //' " + stock + "/stat | awk '{print $2}'", observed.watchdog_process[0])
    text += "arguments=$(tr '\\000' '\\n' < " + watchdog + "/cmdline)\n"
    text += '[ "$arguments" = "$(printf \'/bin/sh\\n/data/bin/watchdog.sh\')" ]\n'
    text += ("test -r " + stock + "/maps\nif grep -F -q '" + base + "/pm_qt_bridge.so' " + stock +
             "/maps; then exit 1; else result=$?; [ \"$result\" -eq 1 ]; fi\n")
    for name, leaf in staging.STAGED.items():
        text += checked_file(base + "/" + leaf, plan["files"][name]["sha256"])
    for path, sha in observed.vendor_hashes:
        text += checked_file(path, sha)
    if include_lock:
        lock = base + "/." + phase + ".lock"
        text += "test ! -L " + lock + "\ntest -d " + lock + "\n"
        text += equal("stat -c '%a %u' " + lock, "700 0")
        owner = lock + "/owner"
        text += "test ! -L " + owner + "\ntest -f " + owner + "\n"
        text += equal("stat -c '%a %u %h' " + owner, "600 0 1")
        text += equal("cat " + owner, phase + " " + nonce + " " + plan["plan_id"])
    return text


def replacement_command(plan, observed, direction, nonce, operation):
    """Only the two reviewed scripts can be replaced, from fixed own sources.

    Preserve the original/candidate source. Copy to a private same-filesystem
    temporary, parse syntax only, verify its bytes and sync BEFORE rename.
    Recheck the entire live scope after preparing the temporary. Power loss
    between the two independent renames leaves a known disabled combination.
    It never requires automatically completing an interrupted transaction.
    """
    permitted_sources = {policy.START: {"commit_disabled": "start.sh.candidate", "rollback_disabled": "stock-start.sh.original"},
                         policy.WATCHDOG: {"commit_disabled": "watchdog.sh.candidate", "rollback_disabled": "stock-watchdog.sh.original"}}
    if (not isinstance(operation, policy.Operation) or direction not in PHASES or
            operation.target not in permitted_sources or operation.source != permitted_sources[operation.target][direction] or
            operation.expected_before != (policy.FACTORY if direction == "commit_disabled" else policy.PATCHED)[operation.target] or
            operation.expected_after != (policy.PATCHED if direction == "commit_disabled" else policy.FACTORY)[operation.target]):
        raise ValueError("Operation is outside the exact disabled script transition set")
    base, phase = staging.BASE, PHASES[direction]
    temporary = base + "/." + phase + ".next"
    source = base + "/" + operation.source
    guard = inline_guard(plan, observed, direction, nonce)
    return (guard + "test ! -e " + temporary + "\ntest ! -L " + temporary + "\n" +
            "cp " + source + " " + temporary + "\nchmod 755 " + temporary + "\n" +
            "/bin/sh -n " + temporary + "\n" + checked_file(temporary, operation.expected_after) +
            "sync\n" + guard + checked_file(operation.target, operation.expected_before) +
            "mv " + temporary + " " + operation.target + "\nsync")


def fresh_snapshot(adb, directory, digest):
    report = review.collect(adb, directory, digest)
    return policy.Snapshot(**report["snapshot"])


def execute(adb, directory, digest, direction):
    if direction not in PHASES:
        raise ValueError("Choose one explicit disabled commit or rollback")
    directory, plan = staging.load_plan(directory, digest)
    phase = PHASES[direction]
    path = directory / (phase + "-receipt.json")
    if path.exists() or path.is_symlink():
        raise ValueError("This transaction intent is already consumed; never retry")
    prior = None
    if direction == "rollback_disabled":
        prior, _ = staging.offline.read_json(directory / "commit-disabled-receipt.json")
        if (prior.get("plan_id") != plan["plan_id"] or prior.get("plan_sha256") != digest or
                prior.get("consumed_install_intent") is not True or prior.get("direction") != "commit_disabled" or
                not isinstance(prior.get("nonce"), str) or not re_nonce(prior["nonce"])):
            raise ValueError("Exact prior own commit receipt is required for rollback")
    observed = fresh_snapshot(adb, directory, digest)
    expected_target = tuple(plan["target"][name] for name in
                            ("wlan_mac", "co2_type", "stock_version", "usb_serial", "usb_transport"))
    transaction = policy.DisabledVendorTransaction(plan["plan_id"], digest, expected_target,
                                                 plan["target"]["boot_id"], direction, observed)
    if prior is not None:
        # An exact matching remote owner marker proves that the prior own
        # transaction reached its claim, not just a copied host JSON flag.
        lock = staging.BASE + "/.commit-disabled.lock"
        marker = lock + "/owner"
        expected = "commit-disabled " + prior["nonce"] + " " + plan["plan_id"]
        check = ("test ! -L " + lock + "\ntest -d " + lock + "\n" +
                 equal("stat -c '%a %u' " + lock, "700 0") +
                 "test ! -L " + marker + "\ntest -f " + marker + "\n" +
                 equal("stat -c '%a %u %h' " + marker, "600 0 1") + "cat " + marker)
        if adb.read(check) != expected:
            raise ValueError("Prior own remote commit marker is unavailable; review without rollback")
    nonce = uuid.uuid4().hex  # Operational correlation token, never a credential.
    receipt = {"schema_version": 1, "plan_id": plan["plan_id"], "plan_sha256": digest,
               "direction": direction, "nonce": nonce, "consumed_install_intent": True,
               "stage": "intent_consumed_before_write", "vendor_files_changed": False,
               "activated": False, "installed": False, "issued": [], "verified": []}
    staging.store_receipt(path, receipt, initial=True)
    try:
        receipt["stage"] = "own_claim_started"
        staging.store_receipt(path, receipt)
        lock = staging.BASE + "/." + phase + ".lock"
        claim = (inline_guard(plan, observed, direction, nonce, include_lock=False) +
                 "mkdir " + lock + "\nchmod 700 " + lock + "\nprintf '%s\\n' " +
                 shlex.quote(phase + " " + nonce + " " + plan["plan_id"]) + " > " + lock + "/owner\nsync")
        staging.completed_write(adb, claim)
        for _ in transaction.operations:
            observed = fresh_snapshot(adb, directory, digest)
            operation = transaction.issue(observed)
            if operation is None:
                raise ValueError("Live transaction refused; reconcile without another issue")
            receipt["stage"] = "single_replacement_issued"
            receipt["issued"].append(operation.target)
            staging.store_receipt(path, receipt)
            staging.completed_write(adb, replacement_command(plan, observed, direction, nonce, operation))
            # Only an independent whole-scope observation acknowledges the
            # replacement. A command exit/marker cannot advance the policy.
            observed = fresh_snapshot(adb, directory, digest)
            state = transaction.acknowledge(observed)
            if state is None:
                raise ValueError("Independent readback did not prove the exact transition")
            receipt["verified"].append(operation.target)
            receipt.update(stage=state, vendor_files_changed=True)
            staging.store_receipt(path, receipt)
        return receipt
    except Exception:
        transaction.ambiguous_result()
        receipt["stage"] = "reconciliation_required_no_retry"
        # A missing ACK may have followed a successful rename. Do not claim
        # that vendor bytes stayed unchanged solely because readback failed.
        if receipt["issued"]:
            receipt["vendor_files_changed"] = "unknown_requires_readback"
        staging.store_receipt(path, receipt)
        raise


def re_nonce(value):
    return len(value) == 32 and all(c in "0123456789abcdef" for c in value)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adb", type=Path, default=Path("adb"))
    parser.add_argument("--serial", required=True)
    parser.add_argument("--plan-directory", type=Path, required=True)
    parser.add_argument("--expected-plan-sha256", required=True)
    operations = parser.add_mutually_exclusive_group(required=True)
    operations.add_argument("--commit-disabled", action="store_true")
    operations.add_argument("--rollback-disabled", action="store_true")
    args = parser.parse_args()
    direction = "commit_disabled" if args.commit_disabled else "rollback_disabled"
    receipt = execute(preflight.Adb(args.adb, args.serial), args.plan_directory, args.expected_plan_sha256, direction)
    print(json.dumps({key: receipt[key] for key in ("stage", "vendor_files_changed", "activated", "installed")}))


if __name__ == "__main__":
    main()
