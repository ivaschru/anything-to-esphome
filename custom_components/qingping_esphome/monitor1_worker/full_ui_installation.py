"""Durable owner/plan authority for the fixed first Full UI trial only.

No arbitrary executable, duration, host or path is accepted. A lost result is
historical/unverified; page reloads only read it and never resume the writer.
Permanent activation remains a separate explicit operation, not trial success.
"""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import stat
import time

from preparation import PreparationError, owned_intent, private_directory, read_private, unique_json, write_new
from build_worker import STOP_FREE, adb_environment, build_report, private_hash, run_owned, sync_directory
from install_plan import source_closure
from full_ui_trial import checked_proof

# This public immutable source contains the device-enforced V2 trial and the
# native physical-readiness response. Old jobs keep their original source and
# cannot be silently relabelled/upgraded into this capability.
TRIAL_SOURCE_COMMITS = frozenset(("53d97b9609e8e0fcdfc5d003101f620098dbc734",))
INTENT = "full-ui-trial-intent.json"
RESULT = "full-ui-trial-result.json"


def frame(job_id, state, available, proof=None):
    return {"job_id": job_id, "state": state, "trial_available": available, "hard_runtime_ms": 60000,
            "native_observations": proof["native_observations"] if proof else None,
            "stock_return_observed": proof["stock_return_observed"] if proof else None,
            "launch_acknowledged": proof["launch_acknowledged"] if proof else None,
            "installed": False, "installation_ready": False, "boot_enabled": False,
            "replay_allowed": False, "live_recheck_required": True}


def checked_intent(directory, owner, job_id):
    """Rejoin exact original build/install authority before any child import."""
    raw = read_private(directory / INTENT)
    value = unique_json(raw)
    plan = build_report(directory / "install-plan/plan.json")
    if (set(value) != {"job_id", "owner", "plan_sha256", "source_commit", "install_intent_sha256",
                       "nonce", "experimental_reviewed"} or
            value["job_id"] != job_id or value["owner"] != owner or value["experimental_reviewed"] is not True or
            value["plan_sha256"] != private_hash(directory / "install-plan/plan.json")["sha256"] or
            value["install_intent_sha256"] != private_hash(directory / "install-intent.json")["sha256"] or
            not isinstance(value["source_commit"], str) or value["source_commit"] not in TRIAL_SOURCE_COMMITS or
            value["source_commit"] != plan.get("basis", {}).get("source_commit") or
            not isinstance(value["nonce"], str) or not re.fullmatch(r"[a-f0-9]{16}", value["nonce"]) or
            value["nonce"] == "0" * 16):
        raise PreparationError("usb_full_ui_trial_unverified")
    return value, raw




class FullUiTrials:
    def __init__(self, installations):
        self.installations, self.parent = installations, installations.parent

    def status(self, owner, job_id):
        directory, _, _ = owned_intent(self.parent, job_id, owner)
        plan = build_report(directory / "install-plan/plan.json")
        source = plan.get("basis", {}).get("source_commit")
        available = isinstance(source, str) and source in TRIAL_SOURCE_COMMITS
        if INTENT not in os.listdir(directory):
            return frame(job_id, "not_started", available)
        intent, raw = checked_intent(directory, owner, job_id)
        if RESULT not in os.listdir(directory):
            return frame(job_id, "full_ui_trial_unverified", available)
        result = unique_json(read_private(directory / RESULT))
        if set(result) != {"intent_sha256", "proof"} or result["intent_sha256"] != hashlib.sha256(raw).hexdigest():
            raise PreparationError("usb_full_ui_trial_unverified")
        proof = checked_proof(result["proof"], intent["nonce"])
        if proof["state"] == "full_ui_trial_returned_observed" and proof["boot_id"] == plan["target"]["boot_id"]:
            raise PreparationError("usb_full_ui_trial_unverified")
        # The exact live Linux boot is retained privately for the later,
        # independently reviewed permanent step. Public status omits it.
        return frame(job_id, proof["state"], available, proof)

    def start(self, owner, job_id, expected_plan_sha256, experimental_reviewed, runner=run_owned):
        if (experimental_reviewed is not True or not isinstance(expected_plan_sha256, str) or
                not re.fullmatch(r"[a-f0-9]{64}", expected_plan_sha256)):
            raise PreparationError("usb_full_ui_trial_review_required")
        directory, _, _ = owned_intent(self.parent, job_id, owner)
        if INTENT in os.listdir(directory):
            raise PreparationError("usb_full_ui_trial_consumed")
        if self.installations.status(owner, job_id)["state"] != "bridge_observed":
            raise PreparationError("usb_full_ui_bridge_required")
        if private_hash(directory / "install-plan/plan.json")["sha256"] != expected_plan_sha256:
            raise PreparationError("usb_full_ui_trial_review_required")
        if not self.status(owner, job_id)["trial_available"]:
            raise PreparationError("usb_full_ui_trial_rebuild_required")
        source = source_closure(directory)
        if shutil.disk_usage(self.parent).free < STOP_FREE:
            raise PreparationError("usb_install_host_space")
        fd = os.open(Path(self.parent).parent / "native-install.lock", os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
        try:
            info = os.fstat(fd)
            if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_nlink != 1 or
                    stat.S_IMODE(info.st_mode) != 0o600):
                raise PreparationError("usb_full_ui_trial_unverified")
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise PreparationError("usb_busy") from None
            # Share the original writer's kernel lease AND durable fence.
            # Crash-released locks/absent receipts never permit another writer.
            for other in private_directory(Path(self.parent)).iterdir():
                private_directory(other)
                names = os.listdir(other)
                prior = unique_json(read_private(other / "intent.json"))
                if "install-intent.json" in names and self.installations.status(prior["owner"], other.name)["state"] not in (
                        "armed_waiting_reboot", "bridge_observed"):
                    raise PreparationError("usb_install_previous_unverified")
                if INTENT in names and self.status(prior["owner"], other.name)["state"] != "full_ui_trial_returned_observed":
                    raise PreparationError("usb_full_ui_trial_previous_unverified")
            env = adb_environment(directory)
            plan = build_report(directory / "install-plan/plan.json")
            record = {"job_id": job_id, "owner": owner, "plan_sha256": expected_plan_sha256,
                      "source_commit": plan["basis"]["source_commit"], "nonce": secrets.token_hex(8),
                      "install_intent_sha256": private_hash(directory / "install-intent.json")["sha256"],
                      "experimental_reviewed": True}
            write_new(directory / INTENT, (json.dumps(record) + "\n").encode())
            sync_directory(directory)  # Before spawn or any staging command.
            command = [str(source / ".venv/bin/python"), str(Path(__file__).with_name("usb_install_job.py")),
                       "--job", job_id, "--full-trial"]
            try:
                with (directory / "full-ui-trial.log").open("xb") as log:
                    runner(command, directory, env, log, time.monotonic() + 650)
            except Exception:
                pass  # Preserve partial history; only status reads follow.
            return self.status(owner, job_id)
        finally:
            os.close(fd)
