#!/usr/bin/env python3
"""Read-only USB review before a first bounded bridge trial; never execute it.

Join the completed disabled commit, live scope, absent autostart stores, a
pre-existing empty RAM job, conservative memory and free TCP endpoints.
Device-side image-fd admission stays FALSE: this host report cannot issue a
start through the pure trial policy. No guardian is fabricated or launched.
"""
import argparse
from dataclasses import asdict
import json
import os
from pathlib import Path
import re

import commit_disabled_install as commit
import initial_bridge_trial_policy as trial
import review_disabled_install as review

BASE = review.staging.BASE
if review.PROCESS_SCAN.count("(/data/.esphome-cgs1/*)") != 1:
    raise ValueError("Initial RAM process scan requires the exact reviewed base scanner contract")
INITIAL_PROCESS_SCAN = review.PROCESS_SCAN.replace(
    "(/data/.esphome-cgs1/*)",
    "(/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*)")
ABSENT_STORES = """# CGS1_INITIAL_ABSENT_STORES
entries=$(LC_ALL=C ls -A1 /data/.esphome-cgs1)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (full-releases|wifi|prefs|full-state) exit 1;; esac
done
entries=$(LC_ALL=C ls -A1 /tmp)
printf '%s\\n' "$entries" | while IFS= read -r entry; do
    case "$entry" in (qingping-cgs1-esphome.lock) exit 1;; esac
done"""
# Positive successful listings matter: ! -e alone can also succeed on IO
# failure. A partial listing with a failed exit status is never absence.
MEMORY_READ = """# CGS1_INITIAL_MEMORY
awk '$1 == "MemTotal:" || $1 == "MemFree:" { print }' /proc/meminfo"""


def tcp_read(ipv6):
    path = "/proc/net/tcp6" if ipv6 else "/proc/net/tcp"
    address_length = 32 if ipv6 else 8
    # Reject every binding/state for these local ports, including transient
    # connections. Never export peer addresses or raw kernel socket tables.
    return ("# CGS1_INITIAL_TCP\ntest -r " + path + "\nawk '\n"
            "NR == 1 { if ($2 != \"local_address\") bad=1; next }\n"
            "{ count=split($2, local, \":\"); port=toupper(local[2]);\n"
            "  address=toupper(local[1]); state=toupper($4);\n"
            "  if ($1 !~ /^[0-9]+:$/ || count != 2 || length(address) != " + str(address_length) + " ||\n"
            "      address ~ /[^0-9A-F]/ || length(state) != 2 || state ~ /[^0-9A-F]/ ||\n"
            "      length(port) != 4 || port ~ /[^0-9A-F]/ ||\n"
            "      port == \"17A5\" || port == \"0CA0\") bad=1 }\n"
            "END { if (!NR || bad) exit 1 }\n' " + path)


def memory(adb):
    values = {}
    for line in adb.read(MEMORY_READ).splitlines():
        match = re.fullmatch(r"(MemTotal|MemFree):[ \t]+([0-9]+)[ \t]+kB", line)
        if not match or match[1] in values:
            raise ValueError("Unique kernel memory fields with KiB units are required")
        values[match[1]] = int(match[2]) * 1024
    if (set(values) != {"MemTotal", "MemFree"} or
            not trial.MIN_START_RAM <= values["MemFree"] <= values["MemTotal"] <= 2**40):
        raise ValueError("Conservative free RAM floor is not met or memory is unverified")
    # Upstream 3.10 predates MemAvailable. Count only genuinely free pages;
    # do not approximate reclaimable memory by adding buffers/cache/swap.
    return values["MemFree"]


def ram(adb, job_id):
    if not isinstance(job_id, str) or not re.fullmatch(r"[0-9a-f]{32}", job_id):
        raise ValueError("Expected one exact pre-existing RAM job identifier")
    path = "/tmp/qingping-initial-trial-" + job_id
    script = ("# CGS1_INITIAL_RAM\ntest ! -L /tmp\ntest ! -L " + path + "\ntest -d " + path + "\n" +
              commit.equal("readlink -f " + path, path) +
              "entries=$(LC_ALL=C ls -A1 " + path + ")\n[ -z \"$entries\" ]\n" +
              "stat -c '%d %i %a %u' " + path + "\nstat -f -c '%t %a %S' " + path)
    lines = adb.read(script).splitlines()
    if (len(lines) != 2 or not re.fullmatch(r"[1-9][0-9]* [1-9][0-9]* 700 0", lines[0])):
        raise ValueError("Private empty RAM directory identity is unverified")
    filesystem = lines[1].split()
    if (len(filesystem) != 3 or filesystem[0] != "1021994" or
            any(not re.fullmatch(r"[0-9]+", value) for value in filesystem[1:]) or
            not 512 <= int(filesystem[2]) <= 65536 or
            int(filesystem[1]) * int(filesystem[2]) < 8 * 1024 * 1024):
        raise ValueError("Actual tmpfs filesystem and its separate storage budget are required")
    return tuple(map(int, lines[0].split()[:2]))


def committed_marker(adb, plan, digest, directory):
    receipt, _ = review.staging.offline.read_json(directory / "commit-disabled-receipt.json")
    if (receipt.get("plan_id") != plan["plan_id"] or receipt.get("plan_sha256") != digest or
            receipt.get("direction") != "commit_disabled" or receipt.get("stage") != "committed_disabled" or
            receipt.get("consumed_install_intent") is not True or receipt.get("activated") is not False or
            receipt.get("installed") is not False or
            receipt.get("verified") != [review.policy.WATCHDOG, review.policy.START] or
            receipt.get("issued") != [review.policy.WATCHDOG, review.policy.START] or
            not isinstance(receipt.get("nonce"), str) or not commit.re_nonce(receipt["nonce"])):
        raise ValueError("Exact terminal own disabled-commit receipt is required; never complete or retry it")
    lock = BASE + "/.commit-disabled.lock"
    owner = lock + "/owner"
    expected = "commit-disabled " + receipt["nonce"] + " " + plan["plan_id"]
    script = ("# CGS1_INITIAL_COMMIT_MARKER\ntest ! -L " + lock + "\ntest -d " + lock + "\n" +
              commit.equal("stat -c '%a %u' " + lock, "700 0") +
              "test ! -L " + owner + "\ntest -f " + owner + "\n" +
              commit.equal("stat -c '%s %a %u %h' " + owner, str(len(expected) + 1) + " 600 0 1") +
              "cat " + owner)
    if adb.read(script) != expected:
        raise ValueError("Matching private remote commit owner marker is unavailable")


def collect(adb, directory, digest, job_id):
    if not isinstance(job_id, str) or not re.fullmatch(r"[0-9a-f]{32}", job_id):
        raise ValueError("Expected one exact pre-existing RAM job identifier")
    directory, plan = review.staging.load_plan(directory, digest)
    first = review.collect(adb, directory, digest)
    initial = review.policy.Snapshot(**first["snapshot"])
    if any(dict(initial.vendor_hashes)[path] != sha for path, sha in review.policy.PATCHED.items()):
        raise ValueError("Both scripts must be committed and still disabled")
    committed_marker(adb, plan, digest, directory)
    first_ram, first_memory = None, None
    for index in range(2):
        if index:
            last = review.policy.Snapshot(**review.collect(adb, directory, digest)["snapshot"])
        adb.read(ABSENT_STORES)
        if adb.read(INITIAL_PROCESS_SCAN).splitlines() != [str(initial.stock_process[0])]:
            raise ValueError("Unique stock and absence of own NAND/RAM programs are unverified")
        for ipv6 in (False, True):
            adb.read(tcp_read(ipv6))
        current_ram, current_memory = ram(adb, job_id), memory(adb)
        if not index:
            first_ram, first_memory = current_ram, current_memory
        elif current_ram != first_ram:
            raise ValueError("RAM job identity changed during observation")
    # Capacity may fluctuate; both full reviews enforce their data floor.
    # Every target/root/flag/vendor/source/process field must remain fixed.
    if trial.FirstBridgeTrial._scope(initial) != trial.FirstBridgeTrial._scope(last):
        raise ValueError("Initial scope changed across the joined observation")
    committed_marker(adb, plan, digest, directory)
    conditions = trial.Conditions(last, plan["files"]["bridge-program"]["sha256"],
                                  True, True, True, True, True, True, True,
                                  min(first_memory, current_memory), False, 0, first_ram, False)
    return {"schema_version": 1, "stage": "read_only_initial_trial_review", "device_writes": 0,
            "hardware_contacted": True, "installed": False, "installation_ready": False,
            "execution_authority": False, "device_fd_admission_completed": False,
            "plan_sha256": digest, "ram_job_id": job_id, "memory_basis": "MemFree_lower_bound",
            "conditions": asdict(conditions)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adb", type=Path, default=Path("adb"))
    parser.add_argument("--serial", required=True)
    parser.add_argument("--plan-directory", type=Path, required=True)
    parser.add_argument("--expected-plan-sha256", required=True)
    parser.add_argument("--ram-job-id", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = collect(review.preflight.Adb(args.adb, args.serial), args.plan_directory,
                     args.expected_plan_sha256, args.ram_job_id)
    output = review.pm.private_output(args.output)
    fd = os.open(output / "review.json", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as stream:
        json.dump(report, stream, indent=2)
        stream.write("\n")
    print(json.dumps({key: report[key] for key in ("stage", "device_writes", "installation_ready", "execution_authority")}))


if __name__ == "__main__":
    main()
