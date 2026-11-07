"""Offline installation payload in an already built owner job; no ADB/USB.

Native captures retain their actual get-devpath binding. Browser captures do
not have that authority and are refused here until their own writer adapter
exists; no fabricated native report is used to pass the canonical planner.
"""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import time

from preparation import PreparationError, owned_intent, private_directory, read_private, unique_json, write_new
from build_worker import (SOURCE_COMMIT, build_report, environment, private_hash,
                          run_owned, sync_directory)


def public_plan(job_id, state, required=None):
    return {"job_id": job_id, "state": state, "requested_data_free_bytes": required,
            "hardware_contacted": False, "device_writes": 0, "installed": False,
            "installation_ready": False, "live_recheck_required": True}


def source_closure(directory):
    candidate = private_directory(directory / "candidate")
    report = build_report(candidate / "result.json")
    closure = report.get("source_sha256")
    if report.get("source_commit") != SOURCE_COMMIT or not isinstance(closure, dict) or not 1 <= len(closure) <= 2048:
        raise PreparationError("usb_plan_unverified")
    source = candidate / "ports/monitor1"
    for name, expected in closure.items():
        if (not isinstance(name, str) or not name or "\\" in name or
                PurePosixPath(name).is_absolute() or any(part in (".", "..") for part in name.split("/")) or
                not isinstance(expected, str) or not re.fullmatch(r"[a-f0-9]{64}", expected)):
            raise PreparationError("usb_plan_unverified")
        path = source / name
        if path.resolve() != path.absolute():
            raise PreparationError("usb_plan_unverified")
        # These are public Git source files, usually 0644; they are not the
        # private profile/payload. The enclosing job remains owner-only 0700.
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        with os.fdopen(fd, "rb") as stream:
            import stat
            info = os.fstat(stream.fileno())
            if (not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_uid != os.getuid() or
                    not 0 <= info.st_size <= 8 * 1024**2):
                raise PreparationError("usb_plan_unverified")
            body = stream.read(8 * 1024**2 + 1)
            if len(body) != info.st_size or hashlib.sha256(body).hexdigest() != expected:
                raise PreparationError("usb_plan_unverified")
    for name in ("bootstrap_patches.py", "prepare_install.py", "build_candidate.py", "build_pm_helper.py", "preflight_adb.py"):
        if name not in closure:
            raise PreparationError("usb_plan_unverified")
    return source


def verify_plan(directory):
    plan_root = private_directory(directory / "install-plan")
    plan = build_report(plan_root / "plan.json")
    profile = unique_json(read_private(directory / "profile.json"))
    capture = unique_json(read_private(directory / "capture/result.json"))
    if (plan.get("stage") != "offline_plan_only" or plan.get("installed") is not False or
            not isinstance(plan.get("plan_id"), str) or not re.fullmatch(r"[a-f0-9]{32}", plan["plan_id"]) or
            plan.get("installation_ready") is not False or plan.get("hardware_contacted") is not False or
            type(plan.get("device_writes")) is not int or plan["device_writes"] != 0 or
            plan.get("live_recheck_required") is not True or plan.get("consumed_install_intent") is not False or
            plan.get("target") != {key: capture[key] for key in
                                   ("wlan_mac", "co2_type", "stock_version", "usb_serial", "usb_transport", "boot_id")} or
            plan.get("api_identity") != {key: profile[key] for key in ("api_mac", "node_name")} or
            plan.get("basis", {}).get("profile_sha256") != private_hash(directory / "profile.json")["sha256"] or
            plan["basis"].get("source_commit") != SOURCE_COMMIT or
            type(plan.get("requested_data_free_bytes")) is not int or not 0 < plan["requested_data_free_bytes"] <= 256 * 1024**2):
        raise PreparationError("usb_plan_unverified")
    files = plan.get("files")
    if (not isinstance(files, dict) or not 1 <= len(files) <= 24 or
            set(os.listdir(plan_root)) != set(files) | {"plan.json"}):
        raise PreparationError("usb_plan_unverified")
    for name, pin in files.items():
        if not re.fullmatch(r"[a-zA-Z0-9_.-]{1,80}", name) or name in (".", ".."):
            raise PreparationError("usb_plan_unverified")
        if private_hash(plan_root / name) != pin:
            raise PreparationError("usb_plan_unverified")
    return plan


class Plans:
    def __init__(self, builds):
        self.builds = builds

    def prepare(self, owner, job_id, runner=run_owned):
        directory, intent, _ = owned_intent(self.builds.parent, job_id, owner)
        if intent["transport"] != "ha_usb":
            raise PreparationError("usb_plan_browser_pending")
        if self.builds.status(owner, job_id)["state"] != "built_not_installed":
            raise PreparationError("usb_plan_build_required")
        if "plan-intent.json" in os.listdir(directory):
            raise PreparationError("usb_plan_consumed")
        source = source_closure(directory)
        record = {"job_id": job_id, "owner": owner,
                  "build_sha256": private_hash(directory / "build-complete.json")["sha256"]}
        raw = (json.dumps(record) + "\n").encode()
        write_new(directory / "plan-intent.json", raw)
        sync_directory(directory)
        success = False
        try:
            # The actual canonical scripts run with their isolated SDK. No
            # arbitrary executable, command, target path or plan comes from HTTP.
            python = source / ".venv/bin/python"
            env, deadline = environment(directory / "build-home"), time.monotonic() + 600
            with (directory / "plan.log").open("xb") as log:
                runner([str(python), str(source / "bootstrap_patches.py"), "--stock-start",
                        str(directory / "capture/data/etc/init.d/start.sh"), "--stock-watchdog",
                        str(directory / "capture/data/bin/watchdog.sh"), "--output", str(directory / "bootstrap")],
                       directory, env, log, deadline)
                runner([str(python), str(source / "prepare_install.py"), "--capture", str(directory / "capture"),
                        "--candidate", str(directory / "candidate"), "--patches", str(directory / "bootstrap"),
                        "--profile", str(directory / "profile.json"), "--output", str(directory / "install-plan")],
                       directory, env, log, deadline)
            verify_plan(directory)
            for path in (directory / "install-plan").iterdir():
                fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
                try:
                    os.fsync(fd)
                finally:
                    os.close(fd)
            sync_directory(directory / "install-plan")
            success = True
        finally:
            record = {"intent_sha256": hashlib.sha256(raw).hexdigest(), "complete": success,
                      "plan_sha256": private_hash(directory / "install-plan/plan.json")["sha256"] if success else None}
            write_new(directory / "plan-complete.json", (json.dumps(record) + "\n").encode())
            sync_directory(directory)
        return self.status(owner, job_id)

    def status(self, owner, job_id):
        directory, intent, _ = owned_intent(self.builds.parent, job_id, owner)
        if intent["transport"] != "ha_usb":
            return public_plan(job_id, "browser_adapter_pending")
        if self.builds.status(owner, job_id)["state"] != "built_not_installed":
            return public_plan(job_id, "build_required")
        names = os.listdir(directory)
        if "plan-intent.json" not in names:
            return public_plan(job_id, "not_prepared")
        start_raw = read_private(directory / "plan-intent.json")
        start = unique_json(start_raw)
        if start != {"job_id": job_id, "owner": owner,
                     "build_sha256": private_hash(directory / "build-complete.json")["sha256"]}:
            raise PreparationError("usb_plan_unverified")
        if "plan-complete.json" not in names:
            return public_plan(job_id, "plan_unverified")
        done = unique_json(read_private(directory / "plan-complete.json"))
        if set(done) != {"intent_sha256", "complete", "plan_sha256"} or done["intent_sha256"] != hashlib.sha256(start_raw).hexdigest():
            raise PreparationError("usb_plan_unverified")
        if done["complete"] is False and done["plan_sha256"] is None:
            return public_plan(job_id, "plan_failed")
        if done["complete"] is not True or done["plan_sha256"] != private_hash(directory / "install-plan/plan.json")["sha256"]:
            raise PreparationError("usb_plan_unverified")
        plan = verify_plan(directory)
        return public_plan(job_id, "plan_prepared", plan["requested_data_free_bytes"])
