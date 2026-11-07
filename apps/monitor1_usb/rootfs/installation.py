"""Owner-reviewed experimental native installation, not a generic ADB API."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import secrets
import stat
import time

from preparation import PreparationError, owned_intent, private_directory, read_private, unique_json, write_new
from build_worker import STOP_FREE, adb_environment, build_report, environment, private_hash, run_owned, sync_directory
from install_plan import source_closure, verify_plan


def install_frame(job_id, state):
    # These are historical outcomes, never a current runtime/HA health claim.
    # In an ambiguous case no zero-write/unchanged-device assertion is made.
    return {"job_id": job_id, "state": state, "autostart_armed": True if state in ("armed_waiting_reboot", "bridge_observed") else None,
            "installed": False, "installation_ready": False, "replay_allowed": False,
            "live_recheck_required": True}


class Installations:
    def __init__(self, plans):
        self.plans = plans
        self.parent = plans.builds.parent

    def review(self, owner, job_id):
        directory, intent, _ = owned_intent(self.parent, job_id, owner)
        if intent["transport"] != "ha_usb":
            raise PreparationError("usb_plan_browser_pending")
        if "install-intent.json" in os.listdir(directory):
            # Historical review remains readable after canonical operation
            # receipts have been added to the payload directory. The consumed
            # intent binds the original plan SHA; this grants no new start.
            self.status(owner, job_id)
            plan = build_report(directory / "install-plan/plan.json")
        else:
            if self.plans.status(owner, job_id)["state"] != "plan_prepared":
                raise PreparationError("usb_install_plan_required")
            plan = verify_plan(directory)
        return {"job_id": job_id, "plan_sha256": private_hash(directory / "install-plan/plan.json")["sha256"],
                "model": "CGS1", "co2_type": intent["co2_type"], "friendly_name": intent["friendly_name"],
                "wlan_mac": plan["target"]["wlan_mac"], "stock_version": plan["target"]["stock_version"],
                "requested_data_free_bytes": plan["requested_data_free_bytes"], "experimental": True,
                "installation_ready": False}

    def status(self, owner, job_id):
        directory, _, _ = owned_intent(self.parent, job_id, owner)
        names = os.listdir(directory)
        if "install-intent.json" not in names:
            return install_frame(job_id, "not_started")
        raw = read_private(directory / "install-intent.json")
        intent = unique_json(raw)
        if (set(intent) != {"job_id", "owner", "plan_sha256", "experimental_reviewed"} or
                intent["job_id"] != job_id or intent["owner"] != owner or intent["experimental_reviewed"] is not True or
                intent["plan_sha256"] != private_hash(directory / "install-plan/plan.json")["sha256"]):
            raise PreparationError("usb_install_unverified")
        if "install-reconciled.json" in names:
            evidence = unique_json(read_private(directory / "install-reconciled.json"))
            if (set(evidence) != {"intent_sha256", "observation_id", "proof_sha256"} or
                    evidence["intent_sha256"] != hashlib.sha256(raw).hexdigest() or
                    not isinstance(evidence["observation_id"], str) or not re.fullmatch(r"[a-f0-9]{32}", evidence["observation_id"])):
                raise PreparationError("usb_install_unverified")
            proof_path = private_directory(private_directory(directory / "observations") / evidence["observation_id"]) / "bridge-boot-observation.json"
            if private_hash(proof_path)["sha256"] != evidence["proof_sha256"] or not self.observed(directory, build_report(proof_path)):
                raise PreparationError("usb_install_unverified")
            # The existing canonical reader verified a different boot plus
            # the original arming basis. This resolves a lost local ACK without
            # repeating an old writer, adopting a PID or asserting live health.
            return install_frame(job_id, "bridge_observed")
        if "install-arm-reconciled.json" in names:
            evidence = unique_json(read_private(directory / "install-arm-reconciled.json"))
            if (set(evidence) != {"intent_sha256", "observation_id", "proof_sha256"} or
                    evidence["intent_sha256"] != hashlib.sha256(raw).hexdigest() or
                    not isinstance(evidence["observation_id"], str) or not re.fullmatch(r"[a-f0-9]{32}", evidence["observation_id"])):
                raise PreparationError("usb_install_unverified")
            proof_path = private_directory(private_directory(directory / "observations") / evidence["observation_id"]) / "bridge-boot-observation.json"
            if private_hash(proof_path)["sha256"] != evidence["proof_sha256"] or not self.armed_observed(directory, build_report(proof_path)):
                raise PreparationError("usb_install_unverified")
            return install_frame(job_id, "armed_waiting_reboot")
        if "install-result.json" not in names:
            return install_frame(job_id, "install_unverified")
        result = unique_json(read_private(directory / "install-result.json"))
        if (set(result) != {"intent_sha256", "state"} or
                result["intent_sha256"] != hashlib.sha256(raw).hexdigest() or
                result["state"] not in ("armed_waiting_reboot", "install_unverified")):
            raise PreparationError("usb_install_unverified")
        return install_frame(job_id, result["state"])

    def start(self, owner, job_id, expected_plan_sha256, experimental_reviewed, runner=run_owned):
        if experimental_reviewed is not True or not isinstance(expected_plan_sha256, str) or not re.fullmatch(r"[a-f0-9]{64}", expected_plan_sha256):
            raise PreparationError("usb_install_review_required")
        directory, _, _ = owned_intent(self.parent, job_id, owner)
        if "install-intent.json" in os.listdir(directory):
            raise PreparationError("usb_install_consumed")
        review = self.review(owner, job_id)
        if review["plan_sha256"] != expected_plan_sha256:
            raise PreparationError("usb_install_review_required")
        source = source_closure(directory)
        if shutil.disk_usage(self.parent).free < STOP_FREE:
            raise PreparationError("usb_install_host_space")
        fd = os.open(Path(self.parent).parent / "native-install.lock", os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
        try:
            info = os.fstat(fd)
            if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_nlink != 1 or
                    stat.S_IMODE(info.st_mode) != 0o600):
                raise PreparationError("usb_install_unverified")
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise PreparationError("usb_busy") from None
            # A server crash can release its lease while an old operation is
            # still finishing. Durable ambiguous history also blocks new jobs;
            # no PID/timeout/absent result is accepted as permission to repeat.
            for other in private_directory(Path(self.parent)).iterdir():
                private_directory(other)
                if "install-intent.json" not in os.listdir(other):
                    continue
                prior = unique_json(read_private(other / "intent.json"))
                if self.status(prior["owner"], other.name)["state"] not in ("armed_waiting_reboot", "bridge_observed"):
                    raise PreparationError("usb_install_previous_unverified")
            env = adb_environment(directory)
            record = {"job_id": job_id, "owner": owner, "plan_sha256": expected_plan_sha256,
                      "experimental_reviewed": True}
            write_new(directory / "install-intent.json", (json.dumps(record) + "\n").encode())
            sync_directory(directory)  # Consume before creating any controller.
            command = [str(source / ".venv/bin/python"), str(Path(__file__).with_name("usb_install_job.py")), "--job", job_id]
            try:
                with (directory / "install-run.log").open("xb") as log:
                    runner(command, directory, env, log, time.monotonic() + 600)
            except Exception:
                # The host result can be lost after remote effects. Preserve
                # every canonical intent/receipt and reconcile by GET only.
                pass
            return self.status(owner, job_id)
        finally:
            os.close(fd)

    @staticmethod
    def armed_observed(directory, proof):
        plan = build_report(directory / "install-plan/plan.json")
        current = proof.get("current", {})
        return (proof.get("stage") == "same_boot_arm_observed" and proof.get("runtime_observed") is False and
            proof.get("plan_id") == plan.get("plan_id") and isinstance(proof.get("plan_id"), str) and
            proof.get("plan_sha256") == private_hash(directory / "install-plan/plan.json")["sha256"] and
            type(proof.get("device_writes")) is int and proof["device_writes"] == 0 and
            all(proof.get(key) is False for key in ("installed", "activated", "installation_ready")) and
            current.get("stage") == "read_only_armed" and current.get("autostart_armed") is True and
            current.get("receipt_update_incomplete") is False and
            all(current.get(key) is False for key in ("installed", "activated", "installation_ready", "retry_authorized")))

    @staticmethod
    def observed(directory, proof):
        plan = build_report(directory / "install-plan/plan.json")
        return (proof.get("stage") == "post_boot_bridge_observed" and proof.get("runtime_observed") is True and
            proof.get("plan_id") == plan.get("plan_id") and isinstance(proof.get("plan_id"), str) and
            proof.get("plan_sha256") == private_hash(directory / "install-plan/plan.json")["sha256"] and
            proof.get("installed") is False and proof.get("activated") is False and proof.get("installation_ready") is False and
            type(proof.get("device_writes")) is int and proof["device_writes"] == 0 and
            proof.get("api_disconnect") == "completed" and proof.get("forward_cleanup") in ("removed", "absent"))

    def observe(self, owner, job_id, runner=run_owned):
        directory, _, _ = owned_intent(self.parent, job_id, owner)
        current = self.status(owner, job_id)
        if current["state"] == "not_started":
            raise PreparationError("usb_install_plan_required")
        source = source_closure(directory)
        observations = directory / "observations"
        observations.mkdir(mode=0o700, exist_ok=True)
        private_directory(observations)
        if len(os.listdir(observations)) >= 64:
            raise PreparationError("usb_observation_limit")
        observation_id = secrets.token_hex(16)
        output = observations / observation_id
        output.mkdir(mode=0o700)
        sync_directory(observations)
        env = adb_environment(directory)
        command = [str(source / ".venv/bin/python"), str(Path(__file__).with_name("usb_install_job.py")),
                   "--job", job_id, "--observe", observation_id]
        observed, armed = False, False
        try:
            with (output / "read.log").open("xb") as log:
                runner(command, directory, env, log, time.monotonic() + 160)
            proof = build_report(output / "bridge-boot-observation.json")
            observed = self.observed(directory, proof)
            armed = self.armed_observed(directory, proof)
            marker = "install-reconciled.json" if observed else "install-arm-reconciled.json"
            if (observed or armed) and marker not in os.listdir(directory):
                evidence = {"intent_sha256": hashlib.sha256(read_private(directory / "install-intent.json")).hexdigest(),
                            "observation_id": observation_id,
                            "proof_sha256": private_hash(output / "bridge-boot-observation.json")["sha256"]}
                write_new(directory / marker, (json.dumps(evidence) + "\n").encode())
                sync_directory(directory)
        except Exception:
            pass  # Failed read is not absence or permission to install again.
        return {"job_id": job_id, "state": "bridge_observed" if observed else ("awaiting_reboot" if armed else "boot_unverified"),
                "runtime_observed": observed, "device_writes": 0, "installed": False, "installation_ready": False}

    def full_review(self, owner, job_id, runner=run_owned):
        directory, _, _ = owned_intent(self.parent, job_id, owner)
        if self.status(owner, job_id)["state"] != "bridge_observed":
            raise PreparationError("usb_full_ui_bridge_required")
        source = source_closure(directory)
        observations = directory / "observations"
        observations.mkdir(mode=0o700, exist_ok=True)
        private_directory(observations)
        if len(os.listdir(observations)) >= 64:
            raise PreparationError("usb_observation_limit")
        observation_id = secrets.token_hex(16)
        output = observations / observation_id
        output.mkdir(mode=0o700)
        sync_directory(observations)
        env = adb_environment(directory)
        command = [str(source / ".venv/bin/python"), str(Path(__file__).with_name("usb_install_job.py")),
                   "--job", job_id, "--full-review", observation_id]
        state = "full_ui_unverified"
        try:
            with (output / "read.log").open("xb") as log:
                runner(command, directory, env, log, time.monotonic() + 180)
            proof = build_report(output / "full-ui-review.json")
            expected = {"state", "read_only", "device_writes", "launch_authorized", "installation_ready",
                        "installed", "live_recheck_required", "forward_cleanup", "plan_sha256"}
            if (set(proof) == expected and proof["read_only"] is True and proof["live_recheck_required"] is True and
                    type(proof["device_writes"]) is int and proof["device_writes"] == 0 and
                    all(proof[key] is False for key in ("launch_authorized", "installation_ready", "installed")) and
                    proof["plan_sha256"] == private_hash(directory / "install-plan/plan.json")["sha256"] and
                    proof["state"] in ("full_ui_preflight_observed", "pm_extension_required", "full_ui_unverified", "full_ui_close_unverified")):
                state = proof["state"] if (proof["forward_cleanup"] in ("removed", "absent") or
                    (proof["forward_cleanup"] == "not_created" and proof["state"] == "full_ui_unverified")) else "full_ui_close_unverified"
        except Exception:
            pass  # Unknown/denied reads cannot enable Full UI or a loader.
        return {"job_id": job_id, "state": state, "read_only": True, "device_writes": 0,
                "launch_authorized": False, "installation_ready": False, "installed": False,
                "live_recheck_required": True}
