#!/usr/bin/env python3
"""Stage an exact private initial-install payload over USB, disabled by default.

EXPERIMENTAL, not hardware qualified. This stage writes ONLY a new private own
directory; vendor startup/watchdog are NOT changed. It never launches code,
preloads SnowApp, signals a process, enables boot/full mode or reboots. A later
independent guarded commit/activation remains necessary. A consumed host intent
is durable before the first device write; an ambiguous stage is not retried.
"""
import argparse
import json
import os
from pathlib import Path
import re
import uuid

import bootstrap_patches as bootstrap
import prepare_install as offline
import preflight_adb as preflight

BASE = "/data/.esphome-cgs1"
# Native/guardian stay on the build host until the existing guarded FullRuntime
# materialization flow is available. Avoid writing unused duplicate ELF to the
# monitor's small data partition merely because they are in the offline bundle.
STAGED = {"bridge-program": "program", "pm_qt_bridge.so": "pm_qt_bridge.so",
          "launch.sh": "launch.sh", "SnowApp-with-PM": "SnowApp-with-PM",
          "startup-hook.sh": "startup-hook.sh", "stock-start.sh.original": "stock-start.sh.original",
          "stock-watchdog.sh.original": "stock-watchdog.sh.original",
          "start.sh.candidate": "start.sh.candidate", "watchdog.sh.candidate": "watchdog.sh.candidate"}


def load_plan(directory, expected_sha):
    directory = offline.private_directory(directory)
    plan, digest = offline.read_json(directory / "plan.json")
    if (not re.fullmatch(r"[0-9a-f]{64}", expected_sha) or digest != expected_sha or
            plan.get("schema_version") != 1 or plan.get("stage") != "offline_plan_only" or
            plan.get("installation_ready") is not False or plan.get("installed") is not False or
            plan.get("hardware_contacted") is not False or plan.get("device_writes") != 0 or
            plan.get("live_recheck_required") is not True or plan.get("consumed_install_intent") is not False or
            not re.fullmatch(r"[0-9a-f]{32}", plan.get("plan_id", ""))):
        raise ValueError("Expected one exact unapplied offline plan and its SHA-256")
    target = plan.get("target", {})
    preflight.expected_target(target.get("wlan_mac"), target.get("co2_type"))
    if (target.get("stock_version") != "4.1.8_0287" or
            not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", target.get("usb_serial", "")) or
            not re.fullmatch(r"usb:[A-Za-z0-9._:-]+", target.get("usb_transport", "")) or
            not re.fullmatch(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}", target.get("boot_id", ""))):
        raise ValueError("Offline plan lacks an exact admitted target")
    files = plan.get("files")
    if not isinstance(files, dict) or set(files) != set(STAGED) | {"native-program", "guardian-program"}:
        raise ValueError("Offline payload contains an unexpected file set")
    for name, spec in files.items():
        if (not isinstance(spec, dict) or set(spec) != {"size", "sha256"} or
                type(spec["size"]) is not int or not 0 < spec["size"] <= 16 * 1024 * 1024 or
                not isinstance(spec["sha256"], str) or not re.fullmatch(r"[0-9a-f]{64}", spec["sha256"])):
            raise ValueError("Offline payload contains an invalid file pin")
        path = offline.child(directory, name)
        if path.stat().st_mode & 0o777 != 0o600:
            raise ValueError("Offline payload must remain private")
        data = bootstrap.read_regular(path, 16 * 1024 * 1024)
        if len(data) != spec["size"] or bootstrap.sha(data) != spec["sha256"]:
            raise ValueError("Offline payload changed after plan preparation")
    pins = {**bootstrap.ASSET_PINS, "stock-start.sh.original": bootstrap.START_FACTORY,
            "stock-watchdog.sh.original": bootstrap.WATCHDOG_FACTORY,
            "start.sh.candidate": bootstrap.START_INSTALLED,
            "watchdog.sh.candidate": bootstrap.WATCHDOG_INSTALLED}
    if any(files[name]["sha256"] != value for name, value in pins.items()):
        raise ValueError("Bootstrap payload differs from the reviewed runtime source")
    requested = plan.get("requested_data_free_bytes")
    minimum = sum(spec["size"] for spec in files.values()) + 8 * 1024 * 1024
    if type(requested) is not int or not minimum <= requested <= 128 * 1024 * 1024:
        raise ValueError("Plan lacks a conservative bounded data headroom request")
    return directory, plan


def verify_remote_file(adb, path, spec):
    # path comes only from STAGED and BASE. It can never be a caller-selected
    # remote path, generated shell fragment or filename returned by the device.
    reply = adb.read("test ! -L " + path + "\ntest -f " + path +
                     "\nstat -c '%s %h' " + path + "\nsha256sum " + path).splitlines()
    if (len(reply) != 2 or reply[0] != f"{spec['size']} 1" or
            reply[1].split() != [spec["sha256"], path]):
        raise ValueError("Remote staged file does not match its frozen payload")


def completed_write(adb, command):
    marker = "__CGS1_STAGE_OK_" + uuid.uuid4().hex + "__"
    script = "set -eu\numask 077\n" + command + "\nprintf '\\n" + marker + "\\n'\n"
    result = adb.command(["shell", script])
    if preflight.completed_shell(result, marker):
        raise ValueError("Unexpected output from fixed staging operation")


def store_receipt(path, value, initial=False):
    """Persist the consumed intent before any device write, never overwrite it.

    Later progress replaces only this operation's receipt atomically. The
    initial O_EXCL is the retry fence: even a failure before receiving an ACK
    requires read-only reconciliation, not another stage attempt.
    """
    destination = path if initial else path.with_suffix(".next")
    fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "w") as stream:
        json.dump(value, stream, indent=2)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    if not initial:
        os.replace(destination, path)
    fd = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def stage(adb, directory, expected_sha):
    directory, plan = load_plan(directory, expected_sha)
    receipt_path = directory / "stage-receipt.json"
    if receipt_path.exists() or receipt_path.is_symlink():
        raise ValueError("Staging intent already consumed; reconcile read-only, never retry")
    target = plan["target"]
    if adb.serial != target["usb_serial"] or adb.usb() != target["usb_transport"]:
        raise ValueError("Selected USB transport differs from the offline plan")
    if preflight.identity(adb, target["wlan_mac"], target["co2_type"]) != target["boot_id"]:
        raise ValueError("Device boot changed; prepare a fresh capture/plan")
    preflight.inventory(adb)
    adb.read("test ! -e " + BASE + "\ntest ! -L " + BASE)
    # Data must be the expected Linux filesystem, not a removable/FAT mount.
    # This is a measured live free-space check, distinct from the offline
    # budget. No allocation probe or device file is created during admission.
    fields = adb.read("stat -f -c '%t %a %S' /data").split()
    if (len(fields) != 3 or fields[0] != "ef53" or
            not all(re.fullmatch(r"[0-9]+", value) for value in fields[1:]) or
            not 512 <= int(fields[2]) <= 65536 or
            int(fields[1]) * int(fields[2]) < plan["requested_data_free_bytes"]):
        raise ValueError("Private ext4 data capacity is insufficient or unverified")
    receipt = {"schema_version": 1, "plan_id": plan["plan_id"], "plan_sha256": expected_sha,
               "consumed_install_intent": True, "stage": "intent_consumed_before_write",
               "device_write_attempted": False, "vendor_files_changed": False,
               "activated": False, "installed": False, "uploaded": []}
    store_receipt(receipt_path, receipt, initial=True)
    try:
        receipt.update(stage="private_root_create_started", device_write_attempted=True)
        store_receipt(receipt_path, receipt)
        # Both independent opt-outs exist BEFORE any executable is copied.
        # No startup/watchdog hook is installed in this stage, so interrupted
        # staging is an inert private directory and the stock boot is intact.
        completed_write(adb, "mkdir " + BASE + "\nchmod 700 " + BASE +
                        "\n: > " + BASE + "/disabled\n: > " + BASE + "/pm-helper.disabled\n" +
                        "printf '%s\\n' '" + plan["plan_id"] + " " + expected_sha + "' > " + BASE + "/install.intent")
        for name, leaf in STAGED.items():
            source = offline.child(directory, name)
            # Check the frozen local source immediately before each push as
            # well as during plan admission. Do not upload a changed binary.
            spec = plan["files"][name]
            if bootstrap.sha(bootstrap.read_regular(source, 16 * 1024 * 1024)) != spec["sha256"]:
                raise ValueError("Payload changed before its single upload")
            remote = BASE + "/" + leaf
            receipt.update(stage="single_push_started", current_file=name)
            store_receipt(receipt_path, receipt)
            # Precreate under umask 077: adb must never transiently expose a
            # credential-bearing executable to other device users. -Z avoids
            # modern compression with the tested old ordinary SYNC daemon.
            completed_write(adb, "set -C\n: > " + remote)
            adb.command(["push", "-Z", str(source), remote], timeout=90)
            verify_remote_file(adb, remote, spec)
            mode = "700" if name in ("bridge-program", "launch.sh", "SnowApp-with-PM") else "600"
            completed_write(adb, "chmod " + mode + " " + remote)
            receipt["uploaded"].append(name)
            receipt["stage"] = "single_push_verified"
            store_receipt(receipt_path, receipt)
        # Device admission again, not a cached preflight. Verify that staging
        # has not changed any of the nine immutable vendor files or the boot.
        preflight.inventory(adb)
        if (preflight.identity(adb, target["wlan_mac"], target["co2_type"]) != target["boot_id"] or
                adb.usb() != target["usb_transport"]):
            raise ValueError("Target/boot changed while staging; reconcile without activation")
        state = adb.read("stat -c '%a %u' " + BASE + "\ntest -f " + BASE +
                         "/disabled\ntest -f " + BASE + "/pm-helper.disabled")
        if state != "700 0":
            raise ValueError("Private disabled staging state is not intact")
        receipt.update(stage="staged_disabled_not_installed", current_file=None,
                       deferred_host_files=["native-program", "guardian-program"])
        store_receipt(receipt_path, receipt)
    except Exception:
        # No retry, root removal, stock overwrite or activation in an error
        # handler. Preserve the exact ambiguous state and private payload.
        receipt["stage"] = "reconciliation_required_no_retry"
        store_receipt(receipt_path, receipt)
        raise
    return receipt


def reconcile(adb, directory, expected_sha):
    """Read only: establish what the single attempted stage left on-device.

    A changed boot is reported, never used to renew the old write intent.
    Missing/partial intent metadata is deliberately not treated as ownership
    proof. Nothing here retries a push, removes a root or changes a receipt.
    """
    directory, plan = load_plan(directory, expected_sha)
    receipt, _ = offline.read_json(directory / "stage-receipt.json")
    if (receipt.get("plan_id") != plan["plan_id"] or receipt.get("plan_sha256") != expected_sha or
            receipt.get("consumed_install_intent") is not True):
        raise ValueError("Receipt does not belong to the exact consumed staging intent")
    target = plan["target"]
    if adb.serial != target["usb_serial"] or adb.usb() != target["usb_transport"]:
        raise ValueError("Selected USB transport differs from the stage receipt")
    boot = preflight.identity(adb, target["wlan_mac"], target["co2_type"])
    preflight.inventory(adb)
    present = adb.read("if [ -e " + BASE + " ] || [ -L " + BASE + "]; then printf present; else printf absent; fi")
    result = {"stage": "read_only_reconciliation", "root": present,
              "same_boot": boot == target["boot_id"], "stock_files_match_factory": True,
              "matching_files": [], "retry_permitted": False, "activated": False}
    if present == "absent":
        return result
    if present != "present":
        raise ValueError("Unexpected staging root observation")
    marker = adb.read("test ! -L " + BASE + "\ntest -d " + BASE +
                      "\ntest ! -L " + BASE + "/install.intent\ncat " + BASE + "/install.intent")
    if marker != plan["plan_id"] + " " + expected_sha:
        raise ValueError("Partial or foreign staging root requires review; no ownership assumed")
    if adb.read("stat -c '%a %u' " + BASE + "\ntest -f " + BASE +
                "/disabled\ntest -f " + BASE + "/pm-helper.disabled") != "700 0":
        raise ValueError("Private disabled staging state changed")
    for name, leaf in STAGED.items():
        remote = BASE + "/" + leaf
        present = adb.read("if [ -e " + remote + " ] || [ -L " + remote + "]; then printf present; else printf absent; fi")
        if present == "present":
            verify_remote_file(adb, remote, plan["files"][name])
            result["matching_files"].append(name)
        elif present != "absent":
            raise ValueError("Unexpected staged file observation")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adb", type=Path, default=Path("adb"))
    parser.add_argument("--serial", required=True)
    parser.add_argument("--plan-directory", type=Path, required=True)
    parser.add_argument("--expected-plan-sha256", required=True)
    operation = parser.add_mutually_exclusive_group(required=True)
    operation.add_argument("--stage", action="store_true", help="One consumed USB stage into a new disabled private root")
    operation.add_argument("--status", action="store_true", help="Read-only reconciliation; never permits a retry")
    args = parser.parse_args()
    adb = preflight.Adb(args.adb, args.serial)
    if args.status:
        print(json.dumps(reconcile(adb, args.plan_directory, args.expected_plan_sha256)))
        return
    receipt = stage(adb, args.plan_directory, args.expected_plan_sha256)
    print(json.dumps({key: receipt[key] for key in ("stage", "vendor_files_changed", "activated", "installed")}))


if __name__ == "__main__":
    main()
