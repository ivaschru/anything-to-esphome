"""Experimental native USB job using the original guarded engines exactly once.

No generic command/transport or reboot operation exists here. This is run by
the companion with the prepared job's SDK, after explicit owner review. The
device's bounded guardian remains independent of this HTTP/host process.
"""
import asyncio
import hashlib
import json
import os
from pathlib import Path
import sys

from preparation import USER, PreparationError, owned_intent, private_directory, read_private, unique_json, write_new
from build_worker import adb_executable, build_report, child_job_directory, private_hash, sync_directory
from install_plan import source_closure, verify_plan


async def install_and_arm(sequence, arm, adb, plan_root, digest, candidate, profile):
    """Join actual producer results, never a caller-supplied progress claim."""
    result = await sequence.run(adb, plan_root, digest, candidate, profile)
    if (result.get("stage") != "disabled_sequence_trial_observed" or
            any(result.get(key) is not False for key in ("installed", "activated", "installation_ready", "retry_authorized")) or
            result.get("local_adb_cleanup") != "completed" or result.get("forward_cleanup") not in ("removed", "absent")):
        raise PreparationError("usb_install_unverified")
    # This original engine performs its own fresh scope/trial/receipt checks
    # and requires the matching device AFTER-effects completion record. No
    # flag readback, host exit status or old trial JSON substitutes for that.
    armed = arm.arm(adb, plan_root, digest)
    if (armed.get("stage") != "bridge_autostart_armed_next_boot_unverified" or armed.get("autostart_armed") is not True or
            any(armed.get(key) is not False for key in ("installed", "activated", "installation_ready"))):
        raise PreparationError("usb_install_unverified")
    return "armed_waiting_reboot"


def run_job(directory):
    directory = private_directory(Path(directory))
    intent_raw = read_private(directory / "install-intent.json")
    intent = unique_json(intent_raw)
    owned_intent(directory.parent, directory.name, intent.get("owner"))
    if intent.get("job_id") != directory.name or intent.get("experimental_reviewed") is not True:
        raise PreparationError("usb_install_unverified")
    if private_hash(directory / "install-plan/plan.json")["sha256"] != intent.get("plan_sha256"):
        raise PreparationError("usb_install_unverified")
    plan = verify_plan(directory)
    source = source_closure(directory)
    # Fresh child process only: no server-wide sys.path/module cache mutation.
    # Every original source file was checked before loading the canonical
    # sequence, its native Adb, bounded trial and separate next-boot armer.
    sys.path.insert(0, str(source))
    import stage_commit_trial_adb as sequence
    import arm_bridge_next_boot_adb as arm
    result = {"intent_sha256": hashlib.sha256(intent_raw).hexdigest(), "state": "install_unverified"}
    try:
        adb = sequence.trial.TrialAdb(adb_executable(directory), plan["target"]["usb_serial"])
        result["state"] = asyncio.run(install_and_arm(sequence, arm, adb, directory / "install-plan",
            intent["plan_sha256"], directory / "candidate", directory / "profile.json"))
    except Exception:
        # All detailed canonical receipts remain private and authoritative.
        # Never auto-rollback/retry, print library exceptions or claim no write.
        pass
    finally:
        write_new(directory / "install-result.json", (json.dumps(result) + "\n").encode())
        sync_directory(directory)


def observe_job(directory, observation_id):
    directory = private_directory(Path(directory))
    output = private_directory(private_directory(directory / "observations") / observation_id)
    intent = unique_json(read_private(directory / "install-intent.json"))
    owned_intent(directory.parent, directory.name, intent.get("owner"))
    digest = private_hash(directory / "install-plan/plan.json")["sha256"]
    if intent.get("job_id") != directory.name or intent.get("plan_sha256") != digest:
        raise PreparationError("usb_install_unverified")
    source = source_closure(directory)
    sys.path.insert(0, str(source))
    import verify_bridge_boot_adb as observer
    import stage_commit_trial_adb as sequence
    # Original basis/scope enforces a DIFFERENT boot, actual running images,
    # current kernel parents/births and two authenticated fresh wire samples.
    # It cannot start a monitor process, arm, reboot or adopt a saved PID.
    plan = observer.staging.offline.read_json(directory / "install-plan/plan.json")[0]
    adb = observer.trial.TrialAdb(adb_executable(directory), plan["target"]["usb_serial"])
    try:
        current = sequence.status(adb, directory / "install-plan", digest)
        if (current.get("stage") == "read_only_armed" and current.get("autostart_armed") is True and
                current.get("receipt_update_incomplete") is False and
                all(current.get(key) is False for key in ("installed", "activated", "installation_ready", "retry_authorized"))):
            result = {"stage": "same_boot_arm_observed", "runtime_observed": False, "device_writes": 0,
                      "installed": False, "activated": False, "installation_ready": False,
                      "plan_id": plan["plan_id"], "plan_sha256": digest, "current": current}
            observer.staging.store_receipt(output / "bridge-boot-observation.json", result, initial=True)
            return
    except Exception:
        pass  # An unverified same-boot read cannot authorize a reboot/writer.
    result = asyncio.run(observer.verify(observer.trial.TrialAdb(adb_executable(directory), plan["target"]["usb_serial"]),
        directory / "install-plan", digest, directory / "profile.json"))
    observer.staging.store_receipt(output / "bridge-boot-observation.json", result, initial=True)


def full_review_job(directory, observation_id):
    directory = private_directory(Path(directory))
    output = private_directory(private_directory(directory / "observations") / observation_id)
    intent = unique_json(read_private(directory / "install-intent.json"))
    owned_intent(directory.parent, directory.name, intent.get("owner"))
    digest = private_hash(directory / "install-plan/plan.json")["sha256"]
    if intent.get("job_id") != directory.name or intent.get("plan_sha256") != digest:
        raise PreparationError("usb_full_ui_unverified")
    source = source_closure(directory)
    sys.path.insert(0, str(source))
    import trial_initial_bridge_adb as canonical
    from full_ui_usb import inspect
    plan = canonical.review.staging.offline.read_json(directory / "install-plan/plan.json")[0]
    profile, profile_sha = canonical.candidate.read_profile(directory / "profile.json")
    if profile_sha != plan["basis"]["profile_sha256"]:
        raise PreparationError("usb_full_ui_unverified")
    adb = canonical.TrialAdb(adb_executable(directory), plan["target"]["usb_serial"])
    from pm_extension_usb import initial_review
    import verify_bridge_boot_adb as observer
    async def initial_pm(boot):
        return await initial_review(adb, directory / "install-plan", digest, directory / "profile.json", observer, boot)
    result = asyncio.run(inspect(adb, plan, profile, canonical, initial_pm_reader=initial_pm))
    result["plan_sha256"] = digest
    write_new(output / "full-ui-review.json", (json.dumps(result) + "\n").encode())
    sync_directory(output)


def full_trial_job(directory):
    """Execute one durable parent intent, never a caller-supplied service list."""
    from full_ui_installation import INTENT, RESULT, checked_intent, checked_proof
    from full_ui_trial_usb import image_bytes, run_usb
    directory = private_directory(Path(directory))
    initial = unique_json(read_private(directory / INTENT))
    owned_intent(directory.parent, directory.name, initial.get("owner"))
    intent, raw = checked_intent(directory, initial.get("owner"), directory.name)
    if RESULT in os.listdir(directory):
        raise PreparationError("usb_full_ui_trial_consumed")
    source = source_closure(directory)
    # The original plan has acquired engine receipts since install. Rehash
    # every immutable payload named by that exact consumed plan, preserving
    # (and never deleting/ignoring as new write authority) its later history.
    plan = build_report(directory / "install-plan/plan.json")
    for name, pin in plan["files"].items():
        import re
        if not re.fullmatch(r"[a-zA-Z0-9_.-]{1,80}", name) or name in (".", "..") or private_hash(directory / "install-plan" / name) != pin:
            raise PreparationError("usb_full_ui_trial_unverified")
    sys.path.insert(0, str(source))
    import trial_initial_bridge_adb as canonical
    profile, profile_sha = canonical.candidate.read_profile(directory / "profile.json")
    if (profile_sha != plan["basis"]["profile_sha256"] or
            plan["api_identity"] != {key: profile[key] for key in ("node_name", "api_mac")}):
        raise PreparationError("usb_full_ui_trial_unverified")
    # Bytes never enter the parent/HTTP status. Fixed plan roles only, each
    # rehashed above and again by the API coordinator/device compiled manifest.
    images = {kind: image_bytes(directory / "install-plan" / kind, plan["files"][kind])
              for kind in ("native-program", "guardian-program")}
    adb = canonical.TrialAdb(adb_executable(directory), plan["target"]["usb_serial"])
    proof = asyncio.run(run_usb(adb, plan, profile, canonical, intent["nonce"], images))
    checked_proof(proof, intent["nonce"])
    write_new(directory / RESULT, (json.dumps({"intent_sha256": hashlib.sha256(raw).hexdigest(), "proof": proof}) + "\n").encode())
    sync_directory(directory)


def full_activation_job(directory):
    """Use the prior trial's immutable boot/pair; never restage or reboot."""
    from full_ui_activation_installation import INTENT, RESULT, checked_intent, checked_proof
    from full_ui_activation_usb import run_usb
    directory = private_directory(Path(directory))
    initial = unique_json(read_private(directory / INTENT))
    owned_intent(directory.parent, directory.name, initial.get("owner"))
    intent, raw = checked_intent(directory, initial.get("owner"), directory.name)
    if RESULT in os.listdir(directory):
        raise PreparationError("usb_full_ui_activation_consumed")
    source = source_closure(directory)
    plan = build_report(directory / "install-plan/plan.json")
    # Engine receipts legitimately extend this directory after installation.
    # Rehash all immutable roles from the consumed original plan, without
    # deleting history or using a stale serialized success as live authority.
    import re
    for name, pin in plan["files"].items():
        if not re.fullmatch(r"[a-zA-Z0-9_.-]{1,80}", name) or name in (".", "..") or private_hash(directory / "install-plan" / name) != pin:
            raise PreparationError("usb_full_ui_activation_unverified")
    sys.path.insert(0, str(source))
    import trial_initial_bridge_adb as canonical
    profile, profile_sha = canonical.candidate.read_profile(directory / "profile.json")
    if (profile_sha != plan["basis"]["profile_sha256"] or
            plan["api_identity"] != {key: profile[key] for key in ("node_name", "api_mac")}):
        raise PreparationError("usb_full_ui_activation_unverified")
    adb = canonical.TrialAdb(adb_executable(directory), plan["target"]["usb_serial"])
    proof = asyncio.run(run_usb(adb, plan, profile, canonical, intent["trial_job"], intent["boot_id"]))
    checked_proof(proof, intent["trial_job"], intent["boot_id"])
    write_new(directory / RESULT, (json.dumps({"intent_sha256": hashlib.sha256(raw).hexdigest(), "proof": proof}) + "\n").encode())
    sync_directory(directory)


def pm_enable_job(directory):
    """Consume no new remote selector: use only this parent's fixed intent."""
    from pm_extension_installation import INTENT, RESULT, checked_intent, checked_proof
    from pm_extension_usb import arm_next_boot
    directory = private_directory(Path(directory))
    initial = unique_json(read_private(directory / INTENT))
    owned_intent(directory.parent, directory.name, initial.get("owner"))
    intent, raw = checked_intent(directory, initial.get("owner"), directory.name)
    if RESULT in os.listdir(directory):
        raise PreparationError("usb_pm_extension_consumed")
    source = source_closure(directory)
    plan = build_report(directory / "install-plan/plan.json")
    import re
    for name, pin in plan["files"].items():
        if not re.fullmatch(r"[a-zA-Z0-9_.-]{1,80}", name) or name in (".", "..") or private_hash(directory / "install-plan" / name) != pin:
            raise PreparationError("usb_pm_extension_unverified")
    sys.path.insert(0, str(source))
    import verify_bridge_boot_adb as observer
    profile, profile_sha = observer.trial.candidate.read_profile(directory / "profile.json")
    if (profile_sha != plan["basis"]["profile_sha256"] or
            plan["api_identity"] != {key: profile[key] for key in ("node_name", "api_mac")}):
        raise PreparationError("usb_pm_extension_unverified")
    adb = observer.trial.TrialAdb(adb_executable(directory), plan["target"]["usb_serial"])
    proof = asyncio.run(arm_next_boot(adb, directory / "install-plan", intent["plan_sha256"], directory / "profile.json", observer, intent["nonce"]))
    checked_proof(proof, intent["nonce"], proof.get("boot_id"))
    write_new(directory / RESULT, (json.dumps({"intent_sha256": hashlib.sha256(raw).hexdigest(), "proof": proof}) + "\n").encode())
    sync_directory(directory)


def enrollment_job(directory):
    """Fixed read-only child; key material remains in the original profile."""
    from ha_enrollment import INTENT, PROOF, checked_intent
    from ha_enrollment_usb import inspect
    directory = private_directory(Path(directory))
    start = unique_json(read_private(directory / INTENT))
    owned_intent(directory.parent, directory.name, start.get("owner"))
    raw = checked_intent(directory, start.get("owner"), directory.name)
    if PROOF in os.listdir(directory):
        raise PreparationError("usb_enrollment_consumed")
    source = source_closure(directory)
    plan = build_report(directory / "install-plan/plan.json")
    import re
    for name, pin in plan["files"].items():
        if not re.fullmatch(r"[a-zA-Z0-9_.-]{1,80}", name) or name in (".", "..") or private_hash(directory / "install-plan" / name) != pin:
            raise PreparationError("usb_enrollment_unverified")
    sys.path.insert(0, str(source))
    import trial_initial_bridge_adb as canonical
    profile, profile_sha = canonical.candidate.read_profile(directory / "profile.json")
    if profile_sha != plan["basis"]["profile_sha256"] or plan["api_identity"] != {k: profile[k] for k in ("node_name", "api_mac")}:
        raise PreparationError("usb_enrollment_unverified")
    adb = canonical.TrialAdb(adb_executable(directory), plan["target"]["usb_serial"])
    proof = asyncio.run(inspect(adb, plan, profile, canonical, hashlib.sha256(raw).hexdigest()))
    write_new(directory / PROOF, (json.dumps(proof) + "\n").encode())
    sync_directory(directory)


if __name__ == "__main__":
    if (len(sys.argv) not in (3, 4, 5) or sys.argv[1] != "--job" or not USER.fullmatch(sys.argv[2]) or
            (len(sys.argv) == 4 and sys.argv[3] not in ("--full-trial", "--full-activate", "--pm-enable", "--enrollment")) or
            (len(sys.argv) == 5 and (sys.argv[3] not in ("--observe", "--full-review") or not USER.fullmatch(sys.argv[4])))):
        raise SystemExit(2)
    os.umask(0o077)
    # run_owned already supplies the exact private job as cwd. Preserve every
    # engine/receipt check below while allowing the Core backend's storage;
    # no caller-controlled host path or search fallback is added to the CLI.
    directory = child_job_directory(sys.argv[2])
    if len(sys.argv) == 4:
        {"--full-trial": full_trial_job, "--full-activate": full_activation_job, "--pm-enable": pm_enable_job, "--enrollment": enrollment_job}[sys.argv[3]](directory)
    elif len(sys.argv) == 5:
        action = full_review_job if sys.argv[3] == "--full-review" else observe_job
        action(directory, sys.argv[4])
    else:
        run_job(directory)
