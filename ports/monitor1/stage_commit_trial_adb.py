#!/usr/bin/env python3
"""Experimental prepared-plan USB sequence; never permanent activation.

Compose the existing disabled stage, disabled vendor commit and bounded RAM
trial. Their exact checks, private receipts and device-owned stop timer stay
authoritative. This entry adds no generic command, new retry or install flag.
Use only a fresh stock target and an already prepared matched private plan.
"""
import argparse
import asyncio
import json
from pathlib import Path

import commit_disabled_install as commit
import stage_install_adb as staging
import trial_initial_bridge_adb as trial


RECEIPTS = ("stage-receipt.json", "commit-disabled-receipt.json",
            "rollback-disabled-receipt.json", trial.RECEIPT)


def prior_receipts(directory):
    """Include partial atomic writes and links; they are history, not absence."""
    return [name for name in RECEIPTS
            if any((directory / leaf).exists() or (directory / leaf).is_symlink()
                   for leaf in (name, str(Path(name).with_suffix(".next"))))]


def require_terminal(result, expected):
    # These reports come from the actual existing operation, not a supplied
    # checkpoint. A missing/changed result never permits the following writer.
    if (not isinstance(result, dict) or result.get("stage") != expected or
            result.get("consumed_install_intent") is not True or
            result.get("installed") is not False or result.get("activated") is not False):
        raise ValueError("Previous step did not return its exact disabled/trial outcome")


async def run(adb, directory, digest, build, profile_path):
    directory, plan = staging.load_plan(directory, digest)
    # Reject a repeated sequence before contacting USB, including a partial
    # receipt or interrupted receipt replacement. Do not invent a new intent
    # or quietly resume at a later writer after a stopped host process.
    if prior_receipts(directory):
        raise ValueError("Prior operation history exists; use read-only --status, never repeat this sequence")
    if adb.serial != plan["target"]["usb_serial"]:
        raise ValueError("Selected USB serial differs from the prepared plan")
    # Check everything needed by the final trial BEFORE the first stage
    # write. In particular, an old candidate without its separate guardian
    # must not discover that missing prerequisite after vendor script commit.
    trial.guardian_artifact(plan, build)
    _, profile_sha = trial.candidate.read_profile(profile_path)
    if profile_sha != plan["basis"]["profile_sha256"]:
        raise ValueError("Use the exact private profile belonging to this plan")
    phase = "disabled_stage"
    try:
        require_terminal(staging.stage(adb, directory, digest), "staged_disabled_not_installed")
        phase = "disabled_commit"
        require_terminal(commit.execute(adb, directory, digest, "commit_disabled"), "committed_disabled")
        phase = "bounded_trial"
        result = await trial.trial(adb, directory, digest, build, profile_path)
        require_terminal(result, "bounded_trial_stopped_observed")
    except BaseException as error:
        if isinstance(error, (asyncio.CancelledError, KeyboardInterrupt, SystemExit)):
            raise
        # Existing step receipts retain the consumed/ambiguous state. Do not
        # store raw library exceptions, auto-rollback, restart or retry here.
        raise RuntimeError("USB sequence stopped at " + phase +
                           "; inspect read-only --status and preserve all receipts; no automatic retry") from None
    return {"stage": "disabled_sequence_trial_observed", "installed": False,
            "activated": False, "installation_ready": False, "retry_authorized": False,
            "local_adb_cleanup": result.get("local_adb_cleanup"),
            "forward_cleanup": result.get("forward_cleanup")}


def status(adb, directory, digest):
    """Read current scope through the appropriate EXISTING read-only tool.

    Receipt presence selects a collector, never a writer or a fresh intent.
    Failed collection is a concrete unverified state, not an absent program.
    Do not call the factory-only staging collector after a vendor commit.
    """
    directory, plan = staging.load_plan(directory, digest)
    found = prior_receipts(directory)
    if not found:
        raise ValueError("No sequence receipt exists; use the initial read-only preflight")
    # Verify every historical receipt's binding even when a later collector
    # will check its own one again. Partial .next data must be preserved and
    # reviewed rather than used to manufacture a completed transition.
    for name in found:
        path = directory / name
        if not path.exists() or path.is_symlink():
            raise ValueError("Partial receipt requires review; no operation may be resumed")
        receipt, _ = staging.offline.read_json(path)
        if (receipt.get("plan_id") != plan["plan_id"] or receipt.get("plan_sha256") != digest or
                receipt.get("consumed_install_intent") is not True):
            raise ValueError("Operation receipt belongs to another plan or has incomplete ownership")
    if trial.RECEIPT in found:
        result = trial.status(adb, directory, digest)
    elif "commit-disabled-receipt.json" in found or "rollback-disabled-receipt.json" in found:
        # This collector verifies the current script pair and full idle
        # scope, and does not imply commit, rollback or activation authority.
        commit.review.collect(adb, directory, digest)
        result = {"stage": "read_only_disabled_scope_observed"}
    else:
        result = staging.reconcile(adb, directory, digest)
    return {"stage": result["stage"], "installed": False, "activated": False,
            "installation_ready": False, "retry_authorized": False,
            "receipt_update_incomplete": any((directory / Path(name).with_suffix(".next")).exists()
                                             or (directory / Path(name).with_suffix(".next")).is_symlink()
                                             for name in found),
            "local_adb_cleanup": result.get("local_adb_cleanup"),
            "forward_cleanup": result.get("forward_cleanup")}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adb", type=Path, default=Path("adb"))
    parser.add_argument("--serial", required=True)
    parser.add_argument("--plan-directory", type=Path, required=True)
    parser.add_argument("--expected-plan-sha256", required=True)
    parser.add_argument("--candidate", type=Path)
    parser.add_argument("--profile", type=Path)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--stage-commit-trial", action="store_true")
    mode.add_argument("--status", action="store_true")
    args = parser.parse_args()
    adb = trial.TrialAdb(args.adb, args.serial)
    if args.status:
        result = status(adb, args.plan_directory, args.expected_plan_sha256)
    else:
        if args.candidate is None or args.profile is None:
            parser.error("--stage-commit-trial requires the exact --candidate and private --profile")
        result = asyncio.run(run(adb, args.plan_directory, args.expected_plan_sha256,
                                 args.candidate, args.profile))
    # Only the fixed summary is printed. Profile bodies, keys, device INI and
    # detailed physical sample receipts stay private in their original files.
    print(json.dumps(result))


if __name__ == "__main__":
    main()
