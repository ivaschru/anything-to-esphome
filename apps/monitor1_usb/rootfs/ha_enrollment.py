"""Private, one-use handoff from the verified USB job to HA's native flow.

Only Core's parent receives the key-bearing MIME over its private pipe. HTTP
cannot request these internal operations. The durable intent is consumed
before the fixed read-only SDK child; lost replies can reconcile entries but
can never start another config flow or replay a device writer.
"""
import fcntl
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import stat
import time

from preparation import PreparationError, owned_intent, private_directory, read_private, unique_json, write_new
from build_worker import adb_environment, build_report, private_hash, run_owned, sync_directory
from install_plan import source_closure
from full_ui_activation_installation import checked_intent as activation_intent, RESULT as ACTIVATION_RESULT, FullUiActivations

INTENT = "ha-enrollment-intent.json"
PROOF = "ha-enrollment-proof.json"
RESULT = "ha-enrollment-result.json"
MIME = "application/vnd.qingping.internal-ha-enrollment+json"
STATES = ("created", "already_configured", "conflict", "manual_flow_required", "unverified")


def frame(job_id, state, available=False, entry_id=None):
    return {"job_id": job_id, "state": state, "enrollment_available": available,
            "entry_id": entry_id, "replay_allowed": False, "installation_ready": False}


def basis(directory, owner, job_id):
    prior, raw = activation_intent(directory, owner, job_id)
    return {"job_id": job_id, "owner": owner, "plan_sha256": prior["plan_sha256"],
            "source_commit": prior["source_commit"], "activation_intent_sha256": hashlib.sha256(raw).hexdigest(),
            "activation_result_sha256": private_hash(directory / ACTIVATION_RESULT)["sha256"], "reviewed": True}


def checked_intent(directory, owner, job_id):
    raw = read_private(directory / INTENT)
    value = unique_json(raw)
    if value != basis(directory, owner, job_id) or value.get("reviewed") is not True:
        raise PreparationError("usb_enrollment_unverified")
    return raw


def checked_proof(value, digest):
    if (not isinstance(value, dict) or set(value) != {"intent_sha256", "host", "boot_id", "native_job"} or
            value["intent_sha256"] != digest or not isinstance(value["host"], str) or
            not isinstance(value["boot_id"], str) or not re.fullmatch(r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}", value["boot_id"]) or
            not isinstance(value["native_job"], str) or not re.fullmatch(r"[a-f0-9]{16}", value["native_job"]) or value["native_job"] == "0" * 16):
        raise PreparationError("usb_enrollment_unverified")
    try:
        address = ipaddress.IPv4Address(value["host"])
        if not address.is_private or address.is_loopback or address.is_link_local or address.is_unspecified or address.is_multicast:
            raise ValueError
    except ValueError:
        raise PreparationError("usb_enrollment_unverified") from None
    return value


class HaEnrollments:
    def __init__(self, installations):
        self.installations, self.parent = installations, installations.parent

    def status(self, owner, job_id):
        directory, _, _ = owned_intent(self.parent, job_id, owner)
        if INTENT not in os.listdir(directory):
            available = FullUiActivations(self.installations).status(owner, job_id)["state"] == "full_ui_active_observed"
            return frame(job_id, "not_started", available)
        raw = checked_intent(directory, owner, job_id)
        if RESULT not in os.listdir(directory):
            return frame(job_id, "unverified")
        result = unique_json(read_private(directory / RESULT))
        if (not isinstance(result, dict) or set(result) != {"intent_sha256", "state", "entry_id"} or
                result["intent_sha256"] != hashlib.sha256(raw).hexdigest() or result["state"] not in STATES or
                (result["entry_id"] is not None and (not isinstance(result["entry_id"], str) or
                 not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", result["entry_id"]))) or
                ((result["state"] in ("created", "already_configured")) != (result["entry_id"] is not None))):
            raise PreparationError("usb_enrollment_unverified")
        return frame(job_id, result["state"], entry_id=result["entry_id"])

    def package(self, owner, job_id):
        """Internal read for reconciliation: no ADB, child, flow or key in status."""
        directory, _, _ = owned_intent(self.parent, job_id, owner)
        raw = checked_intent(directory, owner, job_id)
        proof = checked_proof(unique_json(read_private(directory / PROOF)), hashlib.sha256(raw).hexdigest())
        plan = build_report(directory / "install-plan/plan.json")
        profile_raw = read_private(directory / "profile.json")
        profile = unique_json(profile_raw)
        if (hashlib.sha256(profile_raw).hexdigest() != plan["basis"]["profile_sha256"] or
                plan["api_identity"] != {k: profile[k] for k in ("node_name", "api_mac")}):
            raise PreparationError("usb_enrollment_unverified")
        return json.dumps({"job_id": job_id, "intent_sha256": hashlib.sha256(raw).hexdigest(),
            "host": proof["host"], "boot_id": proof["boot_id"], "native_job": proof["native_job"],
            "node_name": profile["node_name"], "api_mac": profile["api_mac"], "noise_psk": profile["api_encryption_key"],
            "native_sha256": plan["files"]["native-program"]["sha256"],
            "guardian_sha256": plan["files"]["guardian-program"]["sha256"]}, separators=(",", ":")).encode()

    def prepare(self, owner, job_id, expected_plan_sha256, reviewed, runner=run_owned):
        if reviewed is not True or not isinstance(expected_plan_sha256, str) or not re.fullmatch(r"[a-f0-9]{64}", expected_plan_sha256):
            raise PreparationError("usb_enrollment_review_required")
        directory, _, _ = owned_intent(self.parent, job_id, owner)
        if INTENT in os.listdir(directory):
            raise PreparationError("usb_enrollment_consumed")
        if not self.status(owner, job_id)["enrollment_available"]:
            raise PreparationError("usb_enrollment_activation_required")
        record = basis(directory, owner, job_id)
        if record["plan_sha256"] != expected_plan_sha256:
            raise PreparationError("usb_enrollment_review_required")
        source = source_closure(directory)
        fd = os.open(Path(self.parent).parent / "native-install.lock", os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
        try:
            info = os.fstat(fd)
            if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_nlink != 1 or stat.S_IMODE(info.st_mode) != 0o600:
                raise PreparationError("usb_enrollment_unverified")
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise PreparationError("usb_busy") from None
            # Reads cannot launch a monitor, but must not collide with a live
            # or uncertain older USB operation. Preserve all existing fences.
            for other in private_directory(Path(self.parent)).iterdir():
                private_directory(other)
                actor = unique_json(read_private(other / "intent.json"))["owner"]
                from full_ui_installation import FullUiTrials, INTENT as TRIAL_INTENT
                from pm_extension_installation import PmExtensions
                FullUiActivations(self.installations).fence(other, actor)
                PmExtensions(self.installations).fence(other, actor)
                if "install-intent.json" in os.listdir(other) and self.installations.status(actor, other.name)["state"] not in ("armed_waiting_reboot", "bridge_observed"):
                    raise PreparationError("usb_install_previous_unverified")
                if TRIAL_INTENT in os.listdir(other) and FullUiTrials(self.installations).status(actor, other.name)["state"] != "full_ui_trial_returned_observed":
                    raise PreparationError("usb_full_ui_trial_previous_unverified")
            write_new(directory / INTENT, (json.dumps(record) + "\n").encode())
            sync_directory(directory)
            command = [str(source / ".venv/bin/python"), str(Path(__file__).with_name("usb_install_job.py")), "--job", job_id, "--enrollment"]
            try:
                with (directory / "ha-enrollment.log").open("xb") as log:
                    runner(command, directory, adb_environment(directory), log, time.monotonic() + 160)
            except Exception:
                pass  # Intent stays consumed, including a failed read/cleanup.
            return self.package(owner, job_id)
        finally:
            os.close(fd)

    def record(self, owner, job_id, intent_sha256, state, entry_id):
        directory, _, _ = owned_intent(self.parent, job_id, owner)
        raw = checked_intent(directory, owner, job_id)
        if (intent_sha256 != hashlib.sha256(raw).hexdigest() or state not in STATES or
                ((state in ("created", "already_configured")) != (entry_id is not None)) or
                (entry_id is not None and (not isinstance(entry_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", entry_id)))):
            raise PreparationError("usb_enrollment_unverified")
        # O_EXCL forbids replacing a prior result, even after restart. No key
        # or native-flow body is stored in this public historical receipt.
        write_new(directory / RESULT, (json.dumps({"intent_sha256": intent_sha256, "state": state, "entry_id": entry_id}) + "\n").encode())
        sync_directory(directory)
        return self.status(owner, job_id)
