#!/usr/bin/env python3
"""Read-only review of one exact disabled initial stage; never apply changes.

Collect the observations required by disabled_commit_policy from fixed files
and the actual stock/watchdog processes. Only selected IDs/stat fields leave
the device; cmdline comparison and PM-map filtering happen on-device. No
environment, INI body, generic argv, UART, GPIO, DRM or controller is exposed.
"""
import argparse
from dataclasses import asdict
import json
import os
from pathlib import Path
import re

import bootstrap_patches as bootstrap
import build_pm_helper as pm
import disabled_commit_policy as policy
import preflight_adb as preflight
import stage_install_adb as staging

PROCESS_SCAN = r"""count=0
for link in /proc/[0-9]*/exe; do
    count=$((count+1))
    [ "$count" -le 4096 ]
    pid=${link#/proc/}; pid=${pid%/exe}
    case "$pid" in ''|*[!0-9]*) exit 1;; esac
    if executable=$(readlink "$link" 2>/dev/null); then
        :
    else
        # Kernel threads and exited tasks legitimately have no executable.
        # An unreadable live userspace exe is NOT evidence of its absence.
        [ -d "/proc/$pid" ] || continue
        metadata=$(sed 's/.*) //' "/proc/$pid/stat" 2>/dev/null | awk '{print $1, $7}')
        set -- $metadata
        if [ "$#" -ne 2 ]; then
            [ ! -d "/proc/$pid" ] && continue
            exit 1
        fi
        case "$2" in ''|*[!0-9]*) exit 1;; esac
        case "$1" in Z|X|x) continue;; esac
        [ "$(($2 & 2097152))" -ne 0 ] || exit 1
        continue
    fi
    case "$executable" in
        /data/.esphome-cgs1/*) exit 1;;
        /data/bin/SnowApp) printf '%s\n' "$pid";;
    esac
done"""
# Linux v3.10 PF_KTHREAD=0x00200000, exported as stat field 9 (the seventh
# token after comm). Sources: https://github.com/torvalds/linux/blob/v3.10/include/linux/sched.h
# and https://github.com/torvalds/linux/blob/v3.10/fs/proc/array.c . This only
# classifies a missing exe link; it neither loads a module nor changes a task.


def parse_process(text, expected_pid, expected_executable):
    """Parse Linux stat by the last closing parenthesis, not comm whitespace."""
    lines = text.splitlines()
    if len(lines) != 3 or lines[1] != "0" or lines[2] != expected_executable:
        raise ValueError("Expected one root-owned fixed executable process")
    stat = lines[0]
    left, right = stat.find("("), stat.rfind(") ")
    if left < 1 or right <= left or stat[:left].strip() != str(expected_pid):
        raise ValueError("Malformed stock process identity")
    fields = stat[right + 2:].split()
    if (len(fields) < 20 or fields[0] not in ("R", "S", "D", "I") or
            not all(re.fullmatch(r"[0-9]+", fields[i]) for i in (1, 19))):
        raise ValueError("Stock process is not live or stat is incomplete")
    parent, start = int(fields[1]), int(fields[19])
    if parent < 1 or start < 1:
        raise ValueError("Stock process parent/start identity is unavailable")
    return expected_pid, parent, start


def process(adb, pid, executable):
    if type(pid) is not int or not 1 < pid <= 2**31 - 1:
        raise ValueError("Expected a bounded numeric process identity")
    base = "/proc/" + str(pid)
    return parse_process(adb.read("cat " + base + "/stat\nstat -c '%u' " + base +
                                  "\nreadlink " + base + "/exe"), pid, executable)


def stock_session(adb):
    ids = adb.read(PROCESS_SCAN).splitlines()
    if len(ids) != 1 or not re.fullmatch(r"[0-9]+", ids[0]):
        raise ValueError("Unique stock process and absence of running own code are unverified")
    stock = process(adb, int(ids[0]), "/data/bin/SnowApp")
    watchdog = process(adb, stock[1], "/bin/busybox")
    base = "/proc/" + str(watchdog[0])
    # Only this already identified parent is examined. Its arguments never
    # enter the client/model/report; an unexpected extra argument refuses.
    adb.read("arguments=$(tr '\\000' '\\n' < " + base + "/cmdline)\n" +
             "[ \"$arguments\" = \"$(printf '/bin/sh\\n/data/bin/watchdog.sh')\" ]")
    maps = "/proc/" + str(stock[0]) + "/maps"
    # Distinguish grep's genuine no-match (1) from permission/IO errors (2).
    # A missing/failed maps read cannot be reported as an unloaded extension.
    adb.read("test -r " + maps + "\nif grep -F -q '/data/.esphome-cgs1/pm_qt_bridge.so' " + maps +
             "; then exit 1; else result=$?; [ \"$result\" -eq 1 ]; fi")
    return stock, watchdog


def vendors(adb):
    """Read only the exact factory/patched script combinations already known."""
    result = {}
    for path, (factory_hash, factory_size) in preflight.FILES.items():
        allowed = {factory_hash: factory_size}
        if path == policy.START:
            allowed[bootstrap.START_INSTALLED] = factory_size + 298
        elif path == policy.WATCHDOG:
            allowed[bootstrap.WATCHDOG_INSTALLED] = factory_size + len(bootstrap.WATCHDOG_NEW) - len(bootstrap.WATCHDOG_OLD)
        lines = adb.read("test ! -L " + path + "\ntest -f " + path +
                         "\nstat -c '%s %h' " + path + "\nsha256sum " + path).splitlines()
        if len(lines) != 2:
            raise ValueError("Incomplete vendor file observation")
        digest = lines[1].split()
        if (len(digest) != 2 or digest[1] != path or digest[0] not in allowed or
                lines[0] != f"{allowed[digest[0]]} 1"):
            raise ValueError("Unknown vendor bytes/type; no transition can be reviewed")
        result[path] = digest[0]
    return tuple(sorted(result.items()))


def root(adb, marker):
    base = staging.BASE
    lines = adb.read("test ! -L " + base + "\ntest -d " + base +
                     "\nstat -c '%d %i %a %u' " + base +
                     "\ntest ! -L " + base + "/install.intent\ntest -f " + base + "/install.intent\n" +
                     "[ \"$(stat -c '%s %a %u %h' " + base + "/install.intent)\" = '98 600 0 1' ]\n" +
                     "cat " + base + "/install.intent").splitlines()
    if (len(lines) != 2 or lines[1] != marker or
            not re.fullmatch(r"[0-9]+ [0-9]+ 700 0", lines[0])):
        raise ValueError("Exact private staged root and plan marker are unverified")
    device, inode, _, _ = lines[0].split()
    # Reject parent symlinks and cross-filesystem rename rather than assuming
    # /data layout from filenames. These are metadata reads, no test writes.
    same = adb.read("test ! -L /data/bin\ntest ! -L /data/etc\ntest ! -L /data/etc/init.d\n" +
                    "stat -c '%d' /data/bin /data/etc/init.d").splitlines()
    if same != [device, device]:
        raise ValueError("Same-filesystem vendor rename is unverified")
    return int(device), int(inode)


def flag(adb, leaf):
    path = staging.BASE + "/" + leaf
    lines = adb.read("test ! -L " + path + "\ntest -f " + path +
                     "\nstat -c '%s %a %u %h' " + path + "\nsha256sum " + path).splitlines()
    if (len(lines) != 2 or lines[0] != "0 600 0 1" or
            lines[1].split() != [policy.EMPTY_SHA, path]):
        raise ValueError("Private empty regular disable flag is unverified")
    return policy.EMPTY_SHA, 0, 0o600, 0, 1, False


def collect(adb, directory, expected_sha):
    directory, plan = staging.load_plan(directory, expected_sha)
    # A proposed payload alone is not a staged installation. Require the exact
    # successful host stage receipt; partial/ambiguous transfers first use the
    # existing read-only staging reconciliation, never this commit review.
    receipt, _ = staging.offline.read_json(directory / "stage-receipt.json")
    if (receipt.get("plan_sha256") != expected_sha or receipt.get("plan_id") != plan["plan_id"] or
            receipt.get("stage") != "staged_disabled_not_installed" or
            receipt.get("consumed_install_intent") is not True or receipt.get("activated") is not False):
        raise ValueError("Exact complete disabled stage receipt is required")
    target = plan["target"]
    identity = tuple(target[name] for name in ("wlan_mac", "co2_type", "stock_version", "usb_serial", "usb_transport"))
    if adb.serial != identity[3] or adb.usb() != identity[4]:
        raise ValueError("Exact selected USB staging transport is required")
    boot = preflight.identity(adb, identity[0], identity[1])
    if boot != target["boot_id"]:
        raise ValueError("Boot changed; old stage does not authorize a new transaction")
    marker = plan["plan_id"] + " " + expected_sha
    root_id = root(adb, marker)
    flags = (flag(adb, "disabled"), flag(adb, "pm-helper.disabled"))
    first_vendors, first_session = vendors(adb), stock_session(adb)
    for name, leaf in staging.STAGED.items():
        staging.verify_remote_file(adb, staging.BASE + "/" + leaf, plan["files"][name])
    values = adb.read("stat -f -c '%t %a %S' /data").split()
    if (len(values) != 3 or values[0] != "ef53" or
            not all(re.fullmatch(r"[0-9]+", value) for value in values[1:]) or
            not 512 <= int(values[2]) <= 65536):
        raise ValueError("Live ext4 data capacity is unverified")
    available = int(values[1]) * int(values[2])
    # Close the observation window with independent root/flag/process/vendor/
    # identity reads. Any replacement or live transition blocks the review.
    if (root(adb, marker) != root_id or
            (flag(adb, "disabled"), flag(adb, "pm-helper.disabled")) != flags or
            stock_session(adb) != first_session or vendors(adb) != first_vendors or
            preflight.identity(adb, identity[0], identity[1]) != boot or adb.usb() != identity[4]):
        raise ValueError("Live scope changed during read-only review")
    for name, leaf in staging.STAGED.items():
        staging.verify_remote_file(adb, staging.BASE + "/" + leaf, plan["files"][name])
    stock, watchdog = first_session
    observed = policy.Snapshot(
        target=identity, boot_id=boot, root_identity=root_id, install_marker=marker,
        root_mode=0o700, root_uid=0, disabled_flags=flags,
        source_hashes=tuple(sorted((name, plan["files"][name]["sha256"]) for name in policy.SOURCES)),
        vendor_hashes=first_vendors,
        stock_process=(stock[0], stock[2], dict(first_vendors)["/data/bin/SnowApp"], 0),
        watchdog_process=(watchdog[0], watchdog[2], 0), own_code_running=False,
        pm_helper_loaded=False, data_available_bytes=available, same_filesystem=True)
    # Constructor validates every scalar again. No observation field is an
    # external authority to execute an operation: this adapter only reviews.
    options = {}
    for direction in ("commit_disabled", "rollback_disabled"):
        try:
            transaction = policy.DisabledVendorTransaction(plan["plan_id"], expected_sha, identity, boot, direction, observed)
            options[direction] = {"admissible_for_review": True, "operations": [asdict(op) for op in transaction.operations]}
        except ValueError as error:
            options[direction] = {"admissible_for_review": False, "reason": str(error)}
    if not any(value["admissible_for_review"] for value in options.values()):
        raise ValueError("Disabled scope is not admissible for either known transaction")
    return {"schema_version": 1, "stage": "read_only_disabled_review", "hardware_contacted": True,
            "device_writes": 0, "installed": False, "installation_ready": False,
            "executable_writer_available": False, "plan_sha256": expected_sha,
            "snapshot": asdict(observed), "options": options}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adb", type=Path, default=Path("adb"))
    parser.add_argument("--serial", required=True)
    parser.add_argument("--plan-directory", type=Path, required=True)
    parser.add_argument("--expected-plan-sha256", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = collect(preflight.Adb(args.adb, args.serial), args.plan_directory, args.expected_plan_sha256)
    output = pm.private_output(args.output)
    fd = os.open(output / "review.json", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as stream:
        json.dump(report, stream, indent=2)
        stream.write("\n")
    print(json.dumps({key: report[key] for key in ("stage", "device_writes", "installation_ready", "executable_writer_available")}))


if __name__ == "__main__":
    main()
