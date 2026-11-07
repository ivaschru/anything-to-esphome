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
from build_worker import private_hash, sync_directory
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
        adb = sequence.trial.TrialAdb(Path("/usr/bin/adb"), plan["target"]["usb_serial"])
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
    adb = observer.trial.TrialAdb(Path("/usr/bin/adb"), plan["target"]["usb_serial"])
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
    result = asyncio.run(observer.verify(observer.trial.TrialAdb(Path("/usr/bin/adb"), plan["target"]["usb_serial"]),
        directory / "install-plan", digest, directory / "profile.json"))
    observer.staging.store_receipt(output / "bridge-boot-observation.json", result, initial=True)


if __name__ == "__main__":
    if (len(sys.argv) not in (3, 5) or sys.argv[1] != "--job" or not USER.fullmatch(sys.argv[2]) or
            (len(sys.argv) == 5 and (sys.argv[3] != "--observe" or not USER.fullmatch(sys.argv[4])))):
        raise SystemExit(2)
    os.umask(0o077)
    if len(sys.argv) == 5:
        observe_job(Path("/data/jobs") / sys.argv[2], sys.argv[4])
    else:
        run_job(Path("/data/jobs") / sys.argv[2])
