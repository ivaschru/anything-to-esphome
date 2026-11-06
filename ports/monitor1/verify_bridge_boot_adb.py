#!/usr/bin/env python3
"""Read-only USB observation after bridge-only arming and an ordinary boot.

This never boots, starts, stops or repairs a monitor. A new kernel session is
read afresh; PID files are hints, not signal/launch authority. The only host
transport change is a bounded loopback ADB forward to the existing Noise API.
Successful observations do not qualify hardware or enable the HACS installer.
"""
import argparse
import asyncio
import json
import math
from pathlib import Path
import re
import shlex
import time

import arm_bridge_next_boot_adb as arm

trial = arm.trial
review = arm.commit.review
staging = arm.staging
BASE = arm.BASE
LOCK = "/tmp/qingping-cgs1-esphome.lock"
FIELDS = (*trial.FIELDS, "stock_response_age")


def basis(directory, digest, profile_path):
    """Bind existing terminal evidence without issuing another device intent."""
    directory, plan = staging.load_plan(directory, digest)
    arm.unused_receipt(directory, arm.DISARM_RECEIPT)
    receipt, _ = staging.offline.read_json(directory / arm.ARM_RECEIPT)
    if (arm.exists((directory / arm.ARM_RECEIPT).with_suffix(".next")) or
            receipt.get("plan_id") != plan["plan_id"] or receipt.get("plan_sha256") != digest or
            receipt.get("consumed_install_intent") is not True or
            receipt.get("trial_receipt_sha256") != arm.trial_basis(directory, plan, digest)):
        raise ValueError("Exact complete arm/trial history is required; no resume or repair")
    # Validate the nonce even before any USB read. Only its matching on-device
    # AFTER-effects record can establish that the old flag writer completed.
    arm.completion_record(plan, digest, receipt.get("nonce"), "arm")
    baseline = arm.patched_baseline(plan, digest, receipt["baseline"])
    profile, profile_sha = trial.candidate.read_profile(profile_path)
    if profile_sha != plan["basis"]["profile_sha256"]:
        raise ValueError("Use the exact private API profile bound to this plan")
    return directory, plan, baseline, receipt, profile


def lock_command():
    # Compare contents on-device except the two numeric hints. No arbitrary
    # /proc path comes from a returned filename or a caller-provided PID.
    text = ("# CGS1_BOOT_LOCK\ntest ! -L /tmp\n" +
            arm.commit.equal("stat -c '%a %u' /tmp", "1777 0") +
            "test ! -L " + LOCK + "\ntest -d " + LOCK + "\n" +
            arm.commit.equal("stat -c '%a %u' " + LOCK, "700 0") +
            arm.commit.equal("stat -f -c '%t' " + LOCK, "1021994") +
            "entries=$(LC_ALL=C ls -A1 " + LOCK + ")\n" +
            '[ "$entries" = "$(printf \'child.pid\\nsupervisor.pid\')" ]\n')
    for leaf in ("supervisor.pid", "child.pid"):
        path = LOCK + "/" + leaf
        text += ("test ! -L " + path + "\ntest -f " + path + "\n" +
                 arm.commit.equal("stat -c '%a %u %h' " + path, "600 0 1") +
                 "value=$(cat " + path + ")\ncase \"$value\" in (''|*[!0-9]*) exit 1;; esac\n" +
                 '[ "${#value}" -le 10 ]\nprintf \'%s\\n\' "$value"\n')
    return text


def lock_pids(adb):
    values = adb.read(lock_command()).splitlines()
    if (len(values) != 2 or any(not re.fullmatch(r"[1-9][0-9]{0,9}", value) for value in values) or
            any(not 1 < int(value) <= 2**31 - 1 for value in values) or values[0] == values[1]):
        raise ValueError("Unique live bridge/supervisor hints are unverified")
    return tuple(map(int, values))


def same_named_image(adb, pid, named):
    """Compare only fixed stock/BusyBox names with their actual kernel image."""
    if named not in ("/bin/busybox", "/data/bin/SnowApp") or type(pid) is not int or not 1 < pid <= 2**31 - 1:
        raise ValueError("Fixed stock image and bounded PID required")
    magic = "/proc/" + str(pid) + "/exe"
    lines = adb.read("test ! -L " + named + "\ntest -f " + named +
                     "\nstat -L -c '%d %i %s %u %h' " + magic +
                     "\nstat -c '%d %i %s %u %h' " + named).splitlines()
    if (len(lines) != 2 or lines[0] != lines[1] or
            not re.fullmatch(r"[1-9][0-9]* [1-9][0-9]* [1-9][0-9]* 0 1", lines[0])):
        raise ValueError("Stock kernel image differs from its fixed named file")


def scope(adb, directory, plan, digest, baseline, receipt):
    """Read one current boot/session frame; never reuse pre-boot process IDs."""
    boot = arm.target_boot(adb, plan)
    if boot == baseline.boot_id:
        raise ValueError("A distinct ordinary boot must be observed first; this tool never reboots")
    marker = plan["plan_id"] + " " + digest
    if review.root(adb, marker) != baseline.root_identity:
        raise ValueError("Original named installation root changed")
    arm.initial.committed_marker(adb, plan, digest, directory)
    arm.read_guard(adb, arm.completion_guard(plan, digest, receipt["nonce"], "arm"))
    arm.read_guard(adb, arm.absence("disabled") + arm.absence(arm.DISARM_DONE) + arm.empty_flag(arm.BACKUP))
    review.flag(adb, "pm-helper.disabled")
    # The ordinary launcher creates these two private locations. They are
    # expected here, unlike the pre-start trial's absent prefs/boot-lock gate.
    # Full/native and offline Wi-Fi stores remain outside bridge-only scope.
    arm.read_guard(adb, "entries=$(LC_ALL=C ls -A1 " + BASE + ")\n" +
                   'printf \'%s\\n\' "$entries" | while IFS= read -r entry; do\n' +
                   ' case "$entry" in (full-releases|wifi|full-state) exit 1;; esac\ndone\n' +
                   "test ! -L " + BASE + "/prefs\ntest -d " + BASE + "/prefs\n" +
                   arm.commit.equal("stat -c '%a %u' " + BASE + "/prefs", "700 0"))
    for name, leaf in staging.STAGED.items():
        staging.verify_remote_file(adb, BASE + "/" + leaf, plan["files"][name])
    if dict(review.vendors(adb)) != dict(baseline.vendor_hashes):
        raise ValueError("Previously committed vendor bytes changed")
    supervisor_pid, child_pid = lock_pids(adb)
    child = review.process(adb, child_pid, BASE + "/program")
    supervisor = review.process(adb, supervisor_pid, "/bin/busybox")
    if child[1] != supervisor_pid:
        raise ValueError("Actual bridge child is not owned by the current supervisor")
    trial.process_image(adb, (child_pid, child[2]), BASE + "/program", plan["files"]["bridge-program"], supervisor_pid)
    same_named_image(adb, supervisor_pid, "/bin/busybox")
    proc = "/proc/" + str(supervisor_pid)
    arm.read_guard(adb, "arguments=$(tr '\\000' '\\n' < " + proc + "/cmdline)\n" +
                   '[ "$arguments" = "$(printf \'/bin/sh\\n' + BASE + '/launch.sh\\nsupervise\')" ]\n')
    original = "(/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*) exit 1;;"
    scan = arm.initial.INITIAL_PROCESS_SCAN
    if scan.count(original) != 1:
        raise ValueError("Reviewed complete process scan contract changed")
    allowed = (original.removesuffix(" exit 1;;") + '\ncase "$pid:$executable" in\n(' +
               shlex.quote(str(child_pid) + ":" + BASE + "/program") + ") :;;\n(*) exit 1;;\nesac;;")
    ids = adb.read(scan.replace(original, allowed)).splitlines()
    if len(ids) != 1 or not re.fullmatch(r"[1-9][0-9]*", ids[0]):
        raise ValueError("Current stock process or absence of extra own code is unverified")
    stock = review.process(adb, int(ids[0]), "/data/bin/SnowApp")
    watchdog = review.process(adb, stock[1], "/bin/busybox")
    if len({stock[0], watchdog[0], supervisor_pid, child_pid}) != 4:
        raise ValueError("Stock/watchdog and bridge/supervisor identities overlap")
    same_named_image(adb, stock[0], "/data/bin/SnowApp")
    same_named_image(adb, watchdog[0], "/bin/busybox")
    arm.read_guard(adb, "arguments=$(tr '\\000' '\\n' < /proc/" + str(watchdog[0]) + "/cmdline)\n" +
                   '[ "$arguments" = "$(printf \'/bin/sh\\n/data/bin/watchdog.sh\')" ]\n')
    maps = "/proc/" + str(stock[0]) + "/maps"
    for prefix in (BASE + "/", "/tmp/qingping-full-", "/tmp/qingping-initial-"):
        arm.read_guard(adb, "test -r " + maps + "\nif grep -F -q " + shlex.quote(prefix) + " " + maps +
                       '; then exit 1; else result=$?; [ "$result" -eq 1 ]; fi')
    trial.endpoint(adb, (child_pid, child[2]))
    trial.running_memory(adb)
    # Re-read all selected process births plus lock/boot/root at the end. A
    # launcher's automatic restart during collection is an unverified frame,
    # never permission to adopt its next PID or keep old API observations.
    for record, named in ((child, BASE + "/program"), (supervisor, "/bin/busybox"),
                          (stock, "/data/bin/SnowApp"), (watchdog, "/bin/busybox")):
        if review.process(adb, record[0], named) != record:
            raise ValueError("Current process session changed during observation")
    if (lock_pids(adb) != (supervisor_pid, child_pid) or arm.target_boot(adb, plan) != boot or
            review.root(adb, marker) != baseline.root_identity):
        raise ValueError("Current boot/root/lock changed during observation")
    return {"boot_id": boot, "child": (child_pid, child[2]), "supervisor": (supervisor_pid, supervisor[2]),
            "stock": (stock[0], stock[2]), "watchdog": (watchdog[0], watchdog[2])}


class SampleWindow:
    """Two distinct fresh wire generations, rather than two cached reads."""
    def __init__(self):
        self.states = {}
        self.generations = {name: 0 for name in FIELDS}
        self.previous = None
        self.last = None
        self.samples = 0

    def receive(self, name, value):
        if name in self.generations:
            self.states[name] = value
            self.generations[name] += 1

    def accept(self, now):
        values = [self.states.get(name) for name in FIELDS]
        def finite(value):
            try:
                return type(value) in (int, float) and math.isfinite(value) and value != 99999
            except OverflowError:
                return False
        counts = tuple(self.generations.values())
        if (not all(finite(value) for value in values) or values[0] <= 0 or not 0 <= values[2] <= 100 or
                values[3] < 0 or not 0 <= values[4] < 30 or any(count == 0 for count in counts) or
                (self.previous is not None and (now - self.last < 10 or
                    any(a <= b for a, b in zip(counts, self.previous))))):
            return False
        self.previous, self.last = counts, now
        self.samples += 1
        return True


async def observe_api(client, profile, read_scope, expected):
    await asyncio.wait_for(client.connect(login=True, log_errors=False), 5)
    info = await asyncio.wait_for(client.device_info(), 5)
    if info.mac_address.lower() != profile["api_mac"] or info.name != profile["node_name"]:
        raise ValueError("Authenticated post-boot API identity differs from the exact profile")
    entities, _ = await asyncio.wait_for(client.list_entities_services(), 5)
    pairs = [(item.key, item.object_id) for item in entities if type(item).__name__ == "SensorInfo"]
    if (len(pairs) != len({key for key, _ in pairs}) or
            any(sum(value == name for _, value in pairs) != 1 for name in FIELDS)):
        raise ValueError("Unambiguous physical wire sensor metadata required")
    names, samples = dict(pairs), SampleWindow()
    def received(state):
        if type(state).__name__ == "SensorState":
            samples.receive(names.get(state.key), state.state)
    client.subscribe_states(received)
    started = time.monotonic()
    while time.monotonic() - started < 40:
        if await read_scope() != expected:
            raise ValueError("Current process/boot scope changed; old API samples cannot be reused")
        now = time.monotonic()
        if samples.accept(now) and samples.samples >= 2:
            return {"samples": samples.samples, "_last_sample_at": samples.last}
        await asyncio.sleep(2)
    raise ValueError("Two independent authenticated physical wire updates were not observed")


async def verify(adb, directory, digest, profile_path):
    directory, plan, baseline, receipt, profile = basis(directory, digest, profile_path)
    pending, client, port, forward_ack = set(), None, None, False
    result = {"schema_version": 1, "stage": "post_boot_observation_unverified", "runtime_observed": False,
              "installed": False, "activated": False, "installation_ready": False, "device_writes": 0,
              "plan_id": plan["plan_id"], "plan_sha256": digest}
    phase = "initial_current_scope"
    async def read_scope():
        task = asyncio.create_task(asyncio.to_thread(scope, adb, directory, plan, digest, baseline, receipt))
        pending.add(task)
        try:
            return await asyncio.shield(task)
        finally:
            if task.done():
                pending.discard(task)
    adb.deadline = time.monotonic() + 120
    try:
        first = await read_scope()
        phase = "loopback_forward"
        port = trial.reserve_port()
        trial.install_forward(adb, port)
        forward_ack = True
        from aioesphomeapi import APIClient
        client = APIClient("127.0.0.1", port, password=None, noise_psk=profile["api_encryption_key"])
        phase = "authenticated_wire_observation"
        api = await observe_api(client, profile, read_scope, first)
        phase = "final_current_scope"
        if await read_scope() != first:
            raise ValueError("Current post-boot frame changed after authenticated samples")
        # Hash/proc reads can take time. Freshness is measured AFTER that
        # final frame, rather than reporting zero from the acceptance loop.
        age = time.monotonic() - api.pop("_last_sample_at")
        if not 0 <= age <= 20:
            raise ValueError("Authenticated sample freshness expired during final scope reads")
        api["last_sample_age_at_final_scope_s"] = age
        result.update(stage="post_boot_bridge_observed", runtime_observed=True, scope=first, api=api)
    except BaseException as error:
        if not isinstance(error, Exception):
            raise
        # Save only the fixed phase, not exception text from transport/API
        # libraries. A failed read can be repeated as a new observation; it
        # never creates/reopens a device-write intent or resumes installation.
        result["failed_phase"] = phase
    finally:
        adb.stop_reads = True
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)
        adb.stop_reads, adb.deadline = False, None
        result["api_disconnect"] = "not_connected" if client is None else "unverified"
        try:
            if client is not None:
                await asyncio.wait_for(client.disconnect(), 3)
                result["api_disconnect"] = "completed"
        except Exception:
            pass
        finally:
            # Only an acknowledged exact owned forward may be removed. An
            # ambiguous creation is preserved, never guessed/replaced/retried.
            cleanup = "not_created" if port is None else "ambiguous_forward_preserved"
            if forward_ack:
                try:
                    cleanup = trial.remove_forward(adb, port)
                except Exception:
                    cleanup = "cleanup_unverified_preserved"
            result["forward_cleanup"] = cleanup
            if result["api_disconnect"] == "unverified" or cleanup not in ("removed", "absent", "not_created"):
                result.update(stage="post_boot_observation_cleanup_unverified", runtime_observed=False)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adb", type=Path, default=Path("adb"))
    parser.add_argument("--serial", required=True)
    parser.add_argument("--plan-directory", type=Path, required=True)
    parser.add_argument("--expected-plan-sha256", required=True)
    parser.add_argument("--profile", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    try:
        parent = staging.offline.private_directory(args.report.parent)
        if args.report.name != "bridge-boot-observation.json" or arm.exists(args.report):
            raise ValueError("Use a fresh fixed-name report in an existing private directory")
        result = asyncio.run(verify(trial.TrialAdb(args.adb, args.serial), args.plan_directory,
                                    args.expected_plan_sha256, args.profile))
        # This is a local read observation, never an arm/launch receipt or a
        # consumed device intent. Do not overwrite earlier observation files.
        staging.store_receipt(parent / args.report.name, result, initial=True)
        print(json.dumps({key: result[key] for key in ("stage", "runtime_observed", "installed",
                          "activated", "installation_ready", "device_writes", "forward_cleanup", "api_disconnect")}))
        if not result["runtime_observed"]:
            raise SystemExit(1)
    except Exception:
        # ADB/API exceptions may contain addresses, keys or private paths.
        # CLI output has a fixed code; no raw exception/traceback is printed.
        print(json.dumps({"stage": "post_boot_observation_failed", "device_writes": 0,
                          "installed": False, "activated": False, "installation_ready": False}))
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
