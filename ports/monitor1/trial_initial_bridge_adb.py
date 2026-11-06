#!/usr/bin/env python3
"""Experimental USB first-bridge trial; no permanent activation or HA changes.

Consume one durable host receipt before RAM writes. Never repeat a push or
launch after an ambiguous result. The device owns its kernel child and fixed
60/5/5-second timer independently of this computer and its read-only API work.
"""
import argparse
import asyncio
import hashlib
import json
import math
from pathlib import Path
import re
import shlex
import socket
import time
import uuid

import build_candidate as candidate
import review_initial_trial as initial
import review_disabled_install as review

BASE = review.staging.BASE
RECEIPT = "first-bridge-trial-receipt.json"
FIELDS = ("co2", "temperature", "humidity", "tvoc_stock_estimate")


class ChildNotRunning(ValueError):
    """A complete kernel scan positively found no live guardian child."""


class TrialAdb(review.preflight.Adb):
    deadline = None
    stop_reads = False

    def command(self, arguments, timeout=30):
        if self.stop_reads:
            raise ValueError("USB read collector retired")
        if self.deadline is not None:
            timeout = min(timeout, self.deadline - time.monotonic())
            if timeout <= 0:
                raise ValueError("USB observation deadline elapsed")
        return super().command(arguments, timeout=timeout)


def guardian_artifact(plan, build):
    build = review.staging.offline.private_directory(build)
    result, digest = review.staging.offline.read_json(build / "result.json")
    if (digest != plan["basis"]["candidate_sha256"] or result.get("complete_build") is not True or
            result.get("source_commit") != plan["basis"]["source_commit"]):
        raise ValueError("Use the exact complete candidate captured by this plan")
    path = build / "initial-trial-guardian-program"
    spec = candidate.program_spec(path)
    if result.get("initial_trial_guardian") != spec or path.stat().st_mode & 0o777 != 0o600:
        raise ValueError("Rebuild the matched candidate with its bounded initial guardian")
    return path, spec


def ram_identity(adb, path, *, empty=False):
    if not re.fullmatch(r"/tmp/qingping-initial-(?:trial|guardian)-[0-9a-f]{32}", path):
        raise ValueError("Fixed own RAM job path required")
    lines = adb.read("test ! -L /tmp\ntest ! -L " + path + "\ntest -d " + path +
                     "\nstat -c '%d %i %a %u' " + path + "\nstat -f -c '%t' " + path).splitlines()
    if len(lines) != 2 or not re.fullmatch(r"[1-9][0-9]* [1-9][0-9]* 700 0", lines[0]) or lines[1] != "1021994":
        raise ValueError("Exact private tmpfs directory is unverified")
    if empty:
        adb.read("entries=$(LC_ALL=C ls -A1 " + path + ")\n[ -z \"$entries\" ]")
    return tuple(map(int, lines[0].split()[:2]))


def reserve_port():
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        return reservation.getsockname()[1]


def install_forward(adb, port):
    # AOSP socket_spec.cpp explicitly binds hostname=localhost to loopback,
    # even when the shared adb server uses -a. Host-qualified port 0 is not
    # supported. An OS ephemeral reservation + --no-rebind refuses a race;
    # it never replaces another mapping or falls back to all interfaces.
    if type(port) is not int or not 1024 <= port <= 65535:
        raise ValueError("Expected one unprivileged local TCP port")
    adb.command(["forward", "--no-rebind", f"tcp:localhost:{port}", "tcp:6053"])


def remove_forward(adb, port):
    names = {f"tcp:{port}", f"tcp:localhost:{port}"}
    raw = adb.command(["forward", "--list"])
    if len(raw) > 65536:
        raise ValueError("Complete bounded forward inventory is required")
    rows = [line.split() for line in raw.decode("ascii").splitlines()]
    if any(len(row) != 3 for row in rows):
        raise ValueError("Incomplete forward inventory must be preserved")
    matches = [row for row in rows if row[1] in names]
    if not matches:
        return "absent"
    if len(matches) != 1 or matches[0][0] != adb.serial or matches[0][2] != "tcp:6053":
        return "changed_preserved"
    adb.command(["forward", "--remove", matches[0][1]])
    return "removed"


def frame(plan, digest, snapshot, commit_nonce, receipt, guard_root, ram_root, spec):
    target = plan["target"]
    values = ["--bounded-first-bridge-v1", plan["plan_id"], digest, commit_nonce, target["boot_id"],
              target["wlan_mac"], target["co2_type"], *snapshot["root_identity"],
              *snapshot["stock_process"][:2], *snapshot["watchdog_process"][:2],
              receipt["ram_job_id"], *ram_root, receipt["guardian_job_id"], *guard_root,
              spec["size"], spec["sha256"], receipt["nonce"]]
    for name in review.staging.STAGED:
        values += [plan["files"][name]["size"], plan["files"][name]["sha256"]]
    values = list(map(str, values))
    if len(values) != 40 or any(not re.fullmatch(r"[a-zA-Z0-9:_-]{1,128}", value) for value in values):
        raise ValueError("Complete fixed trial frame required")
    return values


def start_record(line, nonce):
    fields = line.replace(b"\r\n", b"\n").decode("ascii").strip().split()
    if (len(fields) != 4 or fields[:2] != ["CGS1_TRIAL_START_V1", nonce] or
            any(not re.fullmatch(r"[1-9][0-9]*", field) for field in fields[2:])):
        raise ValueError("Exact trial guardian identity reply missing")
    pid, birth = map(int, fields[2:])
    if not 1 < pid <= 2**31 - 1 or not 0 < birth < 2**64:
        raise ValueError("Guardian identity out of bounds")
    return pid, birth


def end_record(text, nonce, guardian):
    fields = text.replace(b"\r\n", b"\n").decode("ascii").strip().split()
    if (len(fields) != 12 or fields[:2] != ["CGS1_TRIAL_END_V1", nonce] or
            any(not re.fullmatch(r"[0-9]+", field) for field in fields[2:])):
        raise ValueError("Complete exact-child reap reply missing")
    values = list(map(int, fields[2:]))
    if tuple(values[:2]) != guardian or not 1 < values[2] <= 2**31 - 1 or not 0 < values[3] < 2**64:
        raise ValueError("Guardian/child identity changed")
    if not 60000 <= values[4] <= 71000 or values[5:9] != [1, 1, 1, 0] or values[9] not in (0, 15):
        raise ValueError("Trial did not stop normally and reap its exact child")
    return {"guardian": list(guardian), "child": values[2:4], "elapsed_ms": values[4],
            "reaped": True, "protection_ack": True, "term_sent": True,
            "forced": False, "wait_status": values[9]}


def child_of(adb, guardian):
    pid, _ = guardian
    script = """count=0
for file in /proc/[0-9]*/stat; do
 count=$((count+1)); [ "$count" -le 4096 ] || exit 1
 task=${file%/stat}; child=${task#/proc/}
 row=$(sed 's/.*) //' "$file" 2>/dev/null | awk '{print $1, $2, $20}')
 set -- $row
 if [ "$#" -ne 3 ]; then [ ! -d "$task" ] && continue; exit 1; fi
 case "$2:$3" in (*[!0-9:]*|:*|*:) exit 1;; esac
 if [ "$2" = '""" + str(pid) + """' ]; then printf '%s %s %s\\n' "$child" "$3" "$1"; fi
done"""
    lines = adb.read(script).splitlines()
    if not lines:
        raise ChildNotRunning("No live guardian child")
    if len(lines) != 1 or not re.fullmatch(r"[1-9][0-9]* [1-9][0-9]* [RSDIZXx]", lines[0]):
        raise ValueError("Kernel child observation incomplete or ambiguous")
    child, start, state = lines[0].split()
    if state in ("Z", "X", "x"):
        raise ChildNotRunning("Guardian child has exited")
    child, start = int(child), int(start)
    if not 1 < child <= 2**31 - 1 or child == pid or not 0 < start < 2**64:
        raise ValueError("Kernel child identity invalid")
    return child, start


def process_image(adb, identity, named, spec, parent=None):
    pid, birth = identity
    observed = review.process(adb, pid, named)
    if observed[2] != birth or (parent is not None and observed[1] != parent):
        raise ValueError("Live process birth/parent changed")
    review.staging.verify_remote_file(adb, named, spec)
    magic = "/proc/" + str(pid) + "/exe"
    # Follow only this already selected kernel magic link. Ordinary staged
    # file admission remains no-symlink; names alone are never image identity.
    lines = adb.read("stat -L -c '%d %i %s %a %u %h' " + magic +
                     "\nstat -c '%d %i %s %a %u %h' " + named + "\nsha256sum " + magic).splitlines()
    if (len(lines) != 3 or lines[0] != lines[1] or
            not re.fullmatch(r"[1-9][0-9]* [1-9][0-9]* " + str(spec["size"]) + r" 700 0 1", lines[0]) or
            lines[2].split() != [spec["sha256"], magic] or review.process(adb, pid, named) != observed):
        raise ValueError("Actual kernel executable differs from the named admitted image")


def endpoint(adb, child):
    pid, _ = child
    script = r"""sockets=' '
count=0
for file in /proc/""" + str(pid) + r"""/fd/*; do
 count=$((count+1)); [ "$count" -le 4096 ] || exit 1
 link=$(readlink "$file")
 case "$link" in (socket:\[*\]) inode=${link#socket:}; inode=${inode#\[}; inode=${inode%\]}; case "$inode" in (''|*[!0-9]*) exit 1;; esac; sockets="$sockets$inode ";; esac
done
for table in /proc/net/tcp /proc/net/tcp6; do
 test -r "$table"
 awk -v owned="$sockets" '
 NR==1 { if ($2!="local_address") bad=1; next }
 { count=split($2, local, ":"); port=toupper(local[2]); address=toupper(local[1]); state=toupper($4);
   if ($1 !~ /^[0-9]+:$/ || NF<10 || count!=2 || (length(address)!=8 && length(address)!=32) ||
       address ~ /[^0-9A-F]/ || length(port)!=4 || port ~ /[^0-9A-F]/ ||
       length(state)!=2 || state ~ /[^0-9A-F]/ || $10 !~ /^[0-9]+$/) bad=1;
   if (port=="17A5" || port=="0CA0") {
     if ($10 !~ /^[1-9][0-9]*$/ || index(owned, " " $10 " ")==0) bad=1;
     if (state=="0A") print FILENAME, port;
   }
 }
 END { if (!NR || bad) exit 1 }
 ' "$table"
done"""
    rows = [line.split() for line in adb.read(script).splitlines()]
    if (not 2 <= len(rows) <= 4 or any(len(row) != 2 or row[0] not in ("/proc/net/tcp", "/proc/net/tcp6") or
            row[1] not in ("17A5", "0CA0") for row in rows) or
            len({tuple(row) for row in rows}) != len(rows) or {row[1] for row in rows} != {"17A5", "0CA0"}):
        raise ValueError("Actual child API/OTA listener ownership incomplete")



def running_memory(adb):
    values = {}
    for line in adb.read(initial.MEMORY_READ).splitlines():
        match = re.fullmatch(r"(MemTotal|MemFree):[ \t]+([0-9]+)[ \t]+kB", line)
        if not match or match[1] in values:
            raise ValueError("Incomplete running kernel memory evidence")
        values[match[1]] = int(match[2]) * 1024
    if (set(values) != {"MemTotal", "MemFree"} or
            not 8 * 1024 * 1024 <= values["MemFree"] <= values["MemTotal"] <= 2**40):
        raise ValueError("Conservative running free-RAM floor not met")


def intent_and_ram(adb, directory, plan, digest, receipt, guardian, ram_root, node_name):
    expected = ("CGS1_INITIAL_TRIAL_V1\n" + plan["plan_id"] + "\n" + digest + "\n" +
                plan["target"]["boot_id"] + "\n" + plan["files"]["bridge-program"]["sha256"] + "\n" +
                receipt["guardian"]["sha256"] + "\n" + receipt["nonce"] + "\n" +
                f"{ram_root[0]} {ram_root[1]}\n{guardian[0]} {guardian[1]}\n")
    review.staging.verify_remote_file(adb, BASE + "/initial-trial.intent",
                                      {"size": len(expected), "sha256": hashlib.sha256(expected.encode()).hexdigest()})
    adb.read(initial.commit.equal("stat -c '%a %u' " + BASE + "/initial-trial.intent", "600 0"))
    names = adb.read("LC_ALL=C ls -A1 " + BASE).splitlines()
    allowed = set(review.staging.STAGED.values()) | {
        "install.intent", "disabled", "pm-helper.disabled", ".commit-disabled.lock", "initial-trial.intent"}
    if len(names) != len(allowed) or set(names) != allowed:
        raise ValueError("Unknown initial installation history was preserved")
    initial.committed_marker(adb, plan, digest, directory)
    path = "/tmp/qingping-initial-trial-" + receipt["ram_job_id"]
    if ram_identity(adb, path) != tuple(ram_root):
        raise ValueError("Named RAM job changed")
    names = adb.read("LC_ALL=C ls -A1 " + path).splitlines()
    if not names:
        return
    if names != ["prefs"] or not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", node_name):
        raise ValueError("Unexpected RAM job contents")
    prefs = path + "/prefs"
    adb.read("test ! -L " + prefs + "\ntest -d " + prefs + "\n" +
             initial.commit.equal("stat -c '%a %u %d' " + prefs, "700 0 " + str(ram_root[0])))
    files = adb.read("LC_ALL=C ls -A1 " + prefs).splitlines()
    if files not in ([], [node_name + ".prefs"]):
        raise ValueError("Unexpected RAM preference history")
    if files:
        file = prefs + "/" + node_name + ".prefs"
        fields = adb.read("test ! -L " + file + "\ntest -f " + file +
                          "\nstat -c '%s %a %u %h %d' " + file).split()
        if (len(fields) != 5 or not fields[0].isdigit() or int(fields[0]) > 65536 or
                fields[1:] != ["600", "0", "1", str(ram_root[0])]):
            raise ValueError("RAM preference metadata/budget unverified")


def live_scope(adb, directory, plan, digest, baseline, receipt, guardian, guard_path, ram_root, node, child):
    if child_of(adb, guardian) != child:
        raise ValueError("Kernel child changed")
    stock_pid, watchdog_pid = baseline["stock_process"][0], baseline["watchdog_process"][0]
    if len({stock_pid, watchdog_pid, guardian[0], child[0]}) != 4:
        raise ValueError("Trial and stock process identities overlap")
    process_image(adb, guardian, guard_path, receipt["guardian"])
    process_image(adb, child, BASE + "/program", plan["files"]["bridge-program"], guardian[0])
    endpoint(adb, child)
    original = "(/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*) exit 1;;"
    if initial.INITIAL_PROCESS_SCAN.count(original) != 1:
        raise ValueError("Reviewed own-program scan contract changed")
    allowed = (original.removesuffix(" exit 1;;") + '\n' +
               'case "$pid:$executable" in\n' +
               "(" + shlex.quote(str(guardian[0]) + ":" + guard_path) + "|" +
               shlex.quote(str(child[0]) + ":" + BASE + "/program") + ") :;;\n" +
               "(*) exit 1;;\nesac;;")
    if adb.read(initial.INITIAL_PROCESS_SCAN.replace(original, allowed)).splitlines() != [str(stock_pid)]:
        raise ValueError("Extra stock or unknown own process present")
    stock = review.process(adb, stock_pid, "/data/bin/SnowApp")
    watchdog = review.process(adb, watchdog_pid, "/bin/busybox")
    if stock[1:] != (watchdog_pid, baseline["stock_process"][1]) or watchdog[2] != baseline["watchdog_process"][1]:
        raise ValueError("Stock/watchdog session changed")
    watchdog_root = "/proc/" + str(watchdog_pid)
    adb.read("arguments=$(tr '\\000' '\\n' < " + watchdog_root + "/cmdline)\n" +
             "[ \"$arguments\" = \"$(printf '/bin/sh\\n/data/bin/watchdog.sh')\" ]")
    for prefix in ("/data/.esphome-cgs1/", "/tmp/qingping-full-", "/tmp/qingping-initial-"):
        maps = "/proc/" + str(stock_pid) + "/maps"
        adb.read("test -r " + maps + "\nif grep -F -q " + shlex.quote(prefix) + " " + maps +
                 "; then exit 1; else result=$?; [ \"$result\" -eq 1 ]; fi")
    if dict(review.vendors(adb)) != dict(baseline["vendor_hashes"]):
        raise ValueError("Vendor bytes changed during trial")
    for name, leaf in review.staging.STAGED.items():
        review.staging.verify_remote_file(adb, BASE + "/" + leaf, plan["files"][name])
    if list(review.root(adb, plan["plan_id"] + " " + digest)) != list(baseline["root_identity"]):
        raise ValueError("Named installation root changed")
    for leaf in ("disabled", "pm-helper.disabled"):
        review.flag(adb, leaf)
    adb.read(initial.ABSENT_STORES)
    running_memory(adb)
    intent_and_ram(adb, directory, plan, digest, receipt, guardian, ram_root, node)
    target = plan["target"]
    if (review.preflight.identity(adb, target["wlan_mac"], target["co2_type"]) != target["boot_id"] or
            adb.usb() != target["usb_transport"] or child_of(adb, guardian) != child):
        raise ValueError("Device/boot/USB/kernel child changed")
    return child



async def observe(adb, directory, port, profile, plan, digest, baseline, receipt,
                  guardian, guard_path, ram_root, child, started_at, process, pending_reads):
    from aioesphomeapi import APIClient
    client = None
    while time.monotonic() - started_at < 30 and process.returncode is None:
        try:
            client = APIClient("127.0.0.1", port, password=None,
                               noise_psk=profile["api_encryption_key"])
            await asyncio.wait_for(client.connect(login=True, log_errors=False), 2)
            break
        except Exception:
            if client is not None:
                try:
                    await asyncio.wait_for(client.disconnect(), 3)
                except Exception:
                    pass
            client = None
            await asyncio.sleep(1)
    if client is None:
        raise ValueError("Authenticated USB-forwarded trial API did not become available")
    try:
        info = await asyncio.wait_for(client.device_info(), 5)
        if info.mac_address.lower() != profile["api_mac"] or info.name != profile["node_name"]:
            raise ValueError("Authenticated trial API identity differs from its plan")
        entities, _ = await asyncio.wait_for(client.list_entities_services(), 5)
        names = {item.key: item.object_id for item in entities if type(item).__name__ == "SensorInfo"}
        if any(list(names.values()).count(name) != 1 for name in (*FIELDS, "stock_response_age")):
            raise ValueError("Trial physical sensor metadata incomplete or ambiguous")
        states, generations = {}, {name: 0 for name in FIELDS}

        def received(state):
            name = names.get(state.key)
            if name in (*FIELDS, "stock_response_age") and type(state).__name__ == "SensorState":
                states[name] = state.state
                if name in generations:
                    generations[name] += 1

        client.subscribe_states(received)
        accepted, previous, last = 0, None, 0.0
        while process.returncode is None and time.monotonic() - started_at < 50:
            # Keep blocking USB/hash work off the API event loop. Hold the
            # read task during cancellation too; teardown waits for it rather
            # than leaving background reads or erasing its deadline.
            read = asyncio.create_task(asyncio.to_thread(
                live_scope, adb, directory, plan, digest, baseline, receipt, guardian,
                guard_path, ram_root, profile["node_name"], child))
            pending_reads.add(read)
            try:
                await asyncio.shield(read)
            except ChildNotRunning:
                # Only the terminal device-owned reap record can establish a
                # normal deadline stop. An early exit still fails end_record.
                break
            finally:
                if read.done():
                    pending_reads.discard(read)
            now = time.monotonic()
            values = [states.get(name) for name in FIELDS]
            age = states.get("stock_response_age")
            counts = tuple(generations[name] for name in FIELDS)
            finite = lambda v: type(v) in (int, float) and math.isfinite(v) and v != 99999
            if (all(finite(v) for v in values) and finite(age) and 0 <= age < 30 and
                    values[0] > 0 and 0 <= values[2] <= 100 and values[3] >= 0 and
                    all(value > 0 for value in counts) and
                    (previous is None or (now - last >= 10 and all(a > b for a, b in zip(counts, previous))))):
                accepted += 1
                previous, last = counts, now
            await asyncio.sleep(2)
        if accepted < 2:
            raise ValueError("Independent authenticated physical wire updates incomplete")
        return {"samples": accepted, "child": list(child), "_last_sample_at": last}
    finally:
        await asyncio.wait_for(client.disconnect(), 3)


def same_scope(left, right):
    cls = initial.trial.FirstBridgeTrial
    return cls._scope(review.policy.Snapshot(**left)) == cls._scope(review.policy.Snapshot(**right))


async def retire_local_adb(process):
    """Bound cleanup of our Popen handle, never signal a reported device PID.

    A stalled local transport cannot make teardown wait forever. This is not
    device recovery: the independently timed guardian owns stopping its child.
    """
    if process is None or process.returncode is not None:
        return
    try:
        process.terminate()
    except ProcessLookupError:
        return
    try:
        await asyncio.wait_for(process.wait(), 2)
    except asyncio.TimeoutError:
        try:
            process.kill()
        except ProcessLookupError:
            return
        await asyncio.wait_for(process.wait(), 5)


async def trial(adb, directory, digest, build, profile_path):
    directory, plan = review.staging.load_plan(directory, digest)
    guardian_file, spec = guardian_artifact(plan, build)
    profile, profile_sha = candidate.read_profile(profile_path)
    if profile_sha != plan["basis"]["profile_sha256"]:
        raise ValueError("Use the exact private candidate profile")
    if adb.serial != plan["target"]["usb_serial"]:
        raise ValueError("Selected USB serial differs from the plan")
    baseline = review.collect(adb, directory, digest)["snapshot"]
    initial.committed_marker(adb, plan, digest, directory)
    commit_receipt, _ = review.staging.offline.read_json(directory / "commit-disabled-receipt.json")
    receipt_path = directory / RECEIPT
    receipt = {"schema_version": 1, "plan_id": plan["plan_id"], "plan_sha256": digest,
               "nonce": uuid.uuid4().hex, "ram_job_id": uuid.uuid4().hex,
               "guardian_job_id": uuid.uuid4().hex, "consumed_install_intent": True,
               "stage": "consumed_before_ram_write", "launch_attempted": False,
               "installed": False, "activated": False, "installation_ready": False,
               "guardian": spec}
    # O_EXCL + file/directory fsync precede the FIRST RAM write, not just exec.
    # The fixed receipt name fences a failed preparation as well as a launch.
    review.staging.store_receipt(receipt_path, receipt, initial=True)
    ram_path = "/tmp/qingping-initial-trial-" + receipt["ram_job_id"]
    guard_root_path = "/tmp/qingping-initial-guardian-" + receipt["guardian_job_id"]
    guard_path = guard_root_path + "/program"
    port, forward_ack = None, False
    pending_reads = set()
    observing = None
    process = None
    try:
        review.staging.completed_write(adb, "test ! -L /tmp\n" +
            "test ! -e " + ram_path + "\ntest ! -L " + ram_path +
            "\ntest ! -e " + guard_root_path + "\ntest ! -L " + guard_root_path +
            "\nmkdir -m 700 " + ram_path + "\nmkdir -m 700 " + guard_root_path)
        ram_root = ram_identity(adb, ram_path, empty=True)
        guard_root = ram_identity(adb, guard_root_path, empty=True)
        receipt.update(stage="ram_guardian_push_consumed", ram_identity=list(ram_root),
                       guardian_root=list(guard_root))
        review.staging.store_receipt(receipt_path, receipt)
        adb.command(["push", str(guardian_file), guard_path], timeout=90)
        review.staging.verify_remote_file(adb, guard_path, spec)
        review.staging.completed_write(adb, "chmod 700 " + guard_path)
        report = initial.collect(adb, directory, digest, receipt["ram_job_id"])
        if not same_scope(report["conditions"]["disabled"], baseline):
            raise ValueError("Pre-launch disabled scope changed")
        values = frame(plan, digest, baseline, commit_receipt["nonce"], receipt,
                       guard_root, ram_root, spec)
        port = reserve_port()
        receipt.update(stage="usb_forward_issue_once", forward_port=port)
        review.staging.store_receipt(receipt_path, receipt)
        install_forward(adb, port)
        forward_ack = True
        receipt.update(stage="guardian_launch_consumed", launch_attempted=True)
        review.staging.store_receipt(receipt_path, receipt)
        command = "umask 077\nexec " + shlex.join([guard_path, *values])
        adb.deadline = time.monotonic() + 110
        process = await asyncio.create_subprocess_exec(
            *adb.base, "shell", command, stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL, limit=4096)
        guardian = start_record(await asyncio.wait_for(process.stdout.readline(), 30), receipt["nonce"])
        child_line = await asyncio.wait_for(process.stdout.readline(), 30)
        # Same bounded numeric grammar; the marker itself must be exact.
        if not child_line.startswith(b"CGS1_TRIAL_CHILD_V1 "):
            raise ValueError("Exact kernel-child identity line missing")
        child = start_record(child_line.replace(b"CGS1_TRIAL_CHILD_V1", b"CGS1_TRIAL_START_V1", 1), receipt["nonce"])
        started_at = time.monotonic()
        receipt.update(stage="bounded_trial_observing", guardian_process=list(guardian), child=list(child))
        review.staging.store_receipt(receipt_path, receipt)
        observing = asyncio.create_task(observe(
            adb, directory, port, profile, plan, digest, baseline, receipt, guardian,
            guard_path, ram_root, child, started_at, process, pending_reads))
        terminal, _ = await asyncio.wait_for(process.communicate(), 80)
        result = end_record(terminal, receipt["nonce"], guardian)
        evidence = await observing
        last = evidence.pop("_last_sample_at")
        age = time.monotonic() - last
        if process.returncode != 0 or evidence["child"] != result["child"] or not 0 <= age <= 20:
            raise ValueError("Terminal reap and recent authenticated child proof do not agree")
        evidence["last_sample_age_at_reap_s"] = age
        adb.deadline = None
        after = review.collect(adb, directory, digest)["snapshot"]
        if not same_scope(after, baseline):
            raise ValueError("Stock/vendor/flag scope changed after the bounded trial")
        intent_and_ram(adb, directory, plan, digest, receipt, guardian, ram_root, profile["node_name"])
        receipt.update(stage="bounded_trial_stopped_observed", result=result, api=evidence,
                       note="Experimental observation only; no permanent activation or vendor-kernel qualification")
        review.staging.store_receipt(receipt_path, receipt)
        return receipt
    except BaseException as error:
        # Never persist raw exceptions from ADB/API libraries: they can contain
        # peer data or credentials. The saved phase identifies the operation.
        receipt.update(failed_phase=receipt["stage"], stage="reconciliation_required_no_retry")
        review.staging.store_receipt(receipt_path, receipt)
        if isinstance(error, (asyncio.CancelledError, KeyboardInterrupt, SystemExit)):
            raise
        raise RuntimeError("USB trial incomplete or ambiguous; use --status, never repeat --trial") from None
    finally:
        if observing is not None and not observing.done():
            observing.cancel()
        if observing is not None:
            await asyncio.gather(observing, return_exceptions=True)
        # A running read subprocess gets its existing finite timeout; any
        # following call from that worker refuses immediately. No background
        # collector survives into post-review or forward cleanup.
        adb.stop_reads = True
        if pending_reads:
            await asyncio.gather(*pending_reads, return_exceptions=True)
        adb.stop_reads = False
        adb.deadline = None
        await retire_local_adb(process)
        if port is not None:
            cleanup = "ambiguous_forward_preserved"
            if forward_ack:
                try:
                    cleanup = remove_forward(adb, port)
                except Exception:
                    cleanup = "cleanup_unverified_preserved"
            receipt["forward_cleanup"] = cleanup
            review.staging.store_receipt(receipt_path, receipt)


def status(adb, directory, digest):
    directory, plan = review.staging.load_plan(directory, digest)
    receipt, _ = review.staging.offline.read_json(directory / RECEIPT)
    if receipt.get("plan_id") != plan["plan_id"] or receipt.get("plan_sha256") != digest:
        raise ValueError("Trial receipt belongs to another plan")
    target = plan["target"]
    if (adb.serial != target["usb_serial"] or adb.usb() != target["usb_transport"] or
            review.preflight.identity(adb, target["wlan_mac"], target["co2_type"]) != target["boot_id"]):
        raise ValueError("Status requires the exact original USB/device/boot scope")
    review.root(adb, plan["plan_id"] + " " + digest)
    for leaf in ("disabled", "pm-helper.disabled"):
        review.flag(adb, leaf)
    # This is receipt/scope reconciliation, not a claim that a process is
    # absent. It deliberately grants neither a launch retry nor activation.
    return {"stage": receipt["stage"], "launch_attempted": receipt.get("launch_attempted"),
            "installed": False, "activated": False, "installation_ready": False,
            "retry_authorized": False, "forward_cleanup": receipt.get("forward_cleanup")}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adb", type=Path, default=Path("adb"))
    parser.add_argument("--serial", required=True)
    parser.add_argument("--plan-directory", type=Path, required=True)
    parser.add_argument("--expected-plan-sha256", required=True)
    parser.add_argument("--candidate", type=Path)
    parser.add_argument("--profile", type=Path)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--trial", action="store_true")
    mode.add_argument("--status", action="store_true")
    args = parser.parse_args()
    adb = TrialAdb(args.adb, args.serial)
    if args.status:
        result = status(adb, args.plan_directory, args.expected_plan_sha256)
    else:
        if args.candidate is None or args.profile is None:
            parser.error("--trial requires its exact --candidate and private --profile")
        result = asyncio.run(trial(adb, args.plan_directory, args.expected_plan_sha256, args.candidate, args.profile))
    print(json.dumps({key: result[key] for key in ("stage", "installed", "activated", "installation_ready")}))


if __name__ == "__main__":
    main()
