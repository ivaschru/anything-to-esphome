"""One permanent Full UI transition bound to the successful original trial.

The proof remains private. A restored page reads history only: absence of a
result, a lost ACK or a different Linux boot never authorizes a second writer.
"""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import time

from preparation import PreparationError, owned_intent, private_directory, read_private, unique_json, write_new
from build_worker import STOP_FREE, adb_environment, build_report, private_hash, run_owned, sync_directory
from install_plan import source_closure
import full_ui_installation as trials
from full_ui_activation import checked_proof

INTENT = "full-ui-activation-intent.json"
RESULT = "full-ui-activation-result.json"


def trial_basis(directory, owner, job_id):
    """Rejoin the exact consumed trial and positive private receipt, not its UI."""
    intent, raw = trials.checked_intent(directory, owner, job_id)
    result_raw = read_private(directory / trials.RESULT)
    result = unique_json(result_raw)
    if set(result) != {"intent_sha256", "proof"} or result["intent_sha256"] != hashlib.sha256(raw).hexdigest():
        raise PreparationError("usb_full_ui_activation_unverified")
    proof = trials.checked_proof(result["proof"], intent["nonce"])
    plan = build_report(directory / "install-plan/plan.json")
    if proof["state"] != "full_ui_trial_returned_observed" or proof["boot_id"] == plan["target"]["boot_id"]:
        raise PreparationError("usb_full_ui_activation_trial_required")
    return intent, raw, result_raw, proof


def checked_intent(directory, owner, job_id):
    prior, trial_raw, result_raw, proof = trial_basis(directory, owner, job_id)
    raw = read_private(directory / INTENT)
    value = unique_json(raw)
    expected = {"job_id": job_id, "owner": owner, "plan_sha256": prior["plan_sha256"],
                "source_commit": prior["source_commit"], "trial_intent_sha256": hashlib.sha256(trial_raw).hexdigest(),
                "trial_result_sha256": hashlib.sha256(result_raw).hexdigest(), "trial_job": prior["nonce"],
                "boot_id": proof["boot_id"], "screen_reviewed": True, "experimental_reviewed": True}
    if (not isinstance(value, dict) or value != expected or set(value) != set(expected) or
            value["screen_reviewed"] is not True or value["experimental_reviewed"] is not True):
        raise PreparationError("usb_full_ui_activation_unverified")
    return value, raw


def frame(job_id, state, available, proof=None):
    # This is a historical receipt. No key, Linux boot, trial/boot nonce, live
    # health or generic firmware/readiness claim crosses the HTTP boundary.
    return {"job_id": job_id, "state": state, "activation_available": available,
            "native_observations": proof["native_observations"] if proof else None,
            "store_installed": proof["store_installed"] if proof else None,
            "boot_enabled": proof["boot_enabled"] if proof else None,
            "start_acknowledged": proof["start_acknowledged"] if proof else None,
            "installed": False, "installation_ready": False, "replay_allowed": False,
            "live_recheck_required": True}


class FullUiActivations:
    def __init__(self, installations):
        self.installations, self.parent = installations, installations.parent

    def status(self, owner, job_id):
        directory, _, _ = owned_intent(self.parent, job_id, owner)
        available = trials.FullUiTrials(self.installations).status(owner, job_id)["state"] == "full_ui_trial_returned_observed"
        if INTENT not in os.listdir(directory):
            return frame(job_id, "not_started", available)
        intent, raw = checked_intent(directory, owner, job_id)
        if RESULT not in os.listdir(directory):
            return frame(job_id, "full_ui_activation_unverified", False)
        result = unique_json(read_private(directory / RESULT))
        if set(result) != {"intent_sha256", "proof"} or result["intent_sha256"] != hashlib.sha256(raw).hexdigest():
            raise PreparationError("usb_full_ui_activation_unverified")
        proof = checked_proof(result["proof"], intent["trial_job"], intent["boot_id"])
        return frame(job_id, proof["state"], False, proof)

    def fence(self, directory, owner):
        """Kernel lock release alone cannot prove an older child has finished."""
        if INTENT not in os.listdir(directory):
            return
        current = self.status(owner, directory.name)
        if current["state"] not in ("full_ui_active_observed", "full_ui_activation_space"):
            raise PreparationError("usb_full_ui_activation_previous_unverified")

    def start(self, owner, job_id, expected_plan_sha256, experimental_reviewed, screen_reviewed, runner=run_owned):
        if (experimental_reviewed is not True or screen_reviewed is not True or
                not isinstance(expected_plan_sha256, str) or not re.fullmatch(r"[a-f0-9]{64}", expected_plan_sha256)):
            raise PreparationError("usb_full_ui_activation_review_required")
        directory, _, _ = owned_intent(self.parent, job_id, owner)
        if INTENT in os.listdir(directory):
            raise PreparationError("usb_full_ui_activation_consumed")
        prior, trial_raw, result_raw, proof = trial_basis(directory, owner, job_id)
        if prior["plan_sha256"] != expected_plan_sha256:
            raise PreparationError("usb_full_ui_activation_review_required")
        source = source_closure(directory)
        if shutil.disk_usage(self.parent).free < STOP_FREE:
            raise PreparationError("usb_install_host_space")
        fd = os.open(Path(self.parent).parent / "native-install.lock", os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
        try:
            info = os.fstat(fd)
            if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_nlink != 1 or
                    stat.S_IMODE(info.st_mode) != 0o600):
                raise PreparationError("usb_full_ui_activation_unverified")
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise PreparationError("usb_busy") from None
            for other in private_directory(Path(self.parent)).iterdir():
                private_directory(other)
                names = os.listdir(other)
                actor = unique_json(read_private(other / "intent.json"))["owner"]
                self.fence(other, actor)
                from pm_extension_installation import PmExtensions
                PmExtensions(self.installations).fence(other, actor)
                if "install-intent.json" in names and self.installations.status(actor, other.name)["state"] not in ("armed_waiting_reboot", "bridge_observed"):
                    raise PreparationError("usb_install_previous_unverified")
                if trials.INTENT in names and trials.FullUiTrials(self.installations).status(actor, other.name)["state"] != "full_ui_trial_returned_observed":
                    raise PreparationError("usb_full_ui_trial_previous_unverified")
            env = adb_environment(directory)
            record = {"job_id": job_id, "owner": owner, "plan_sha256": expected_plan_sha256,
                      "source_commit": prior["source_commit"], "trial_intent_sha256": hashlib.sha256(trial_raw).hexdigest(),
                      "trial_result_sha256": hashlib.sha256(result_raw).hexdigest(), "trial_job": prior["nonce"],
                      "boot_id": proof["boot_id"], "screen_reviewed": True, "experimental_reviewed": True}
            write_new(directory / INTENT, (json.dumps(record) + "\n").encode())
            sync_directory(directory)  # Consume before creating the fixed SDK child.
            command = [str(source / ".venv/bin/python"), str(Path(__file__).with_name("usb_install_job.py")),
                       "--job", job_id, "--full-activate"]
            try:
                with (directory / "full-ui-activation.log").open("xb") as log:
                    runner(command, directory, env, log, time.monotonic() + 750)
            except Exception:
                pass  # Preserve uncertain effects; no replay/rollback/reboot.
            return self.status(owner, job_id)
        finally:
            os.close(fd)
