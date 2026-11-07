"""Explicit owner-only export for installation with the computer's real ADB.

Only a completed, still-unattempted private build can be exported. No SDK,
cache, device history, generic paths or browser/native identity conversion is
included. The desktop entry performs a new native read-only capture instead.
"""
import hashlib
import io
import json
import os
from pathlib import Path
import tarfile

from preparation import PreparationError, owned_intent, read_private
from build_worker import private_hash, verified_candidate_report
from install_plan import source_closure

MAX_PACKAGE = 64 * 1024**2
PREFIX = "qingping-cgs1-computer"
RUNTIME_REQUIREMENTS = b"aioesphomeapi==46.12.0\npycryptodomex==3.24.1\npyelftools==0.33\n"


def package_export(builds, owner, job_id):
    directory, _, _ = owned_intent(builds.parent, job_id, owner)
    # Never export another controller for a consumed installation. Reads and
    # private recovery downloads remain available through their existing paths.
    if "install-intent.json" in os.listdir(directory):
        raise PreparationError("usb_computer_after_install")
    if builds.status(owner, job_id)["state"] != "built_not_installed":
        raise PreparationError("usb_plan_build_required")
    source = source_closure(directory)
    report = verified_candidate_report(directory)
    if not isinstance(report.get("artifacts"), dict) or set(report["artifacts"]) != {"bridge-program", "native-program", "guardian-program"}:
        raise PreparationError("usb_build_unverified")
    contents = {"profile.json": read_private(directory / "profile.json"),
                "candidate/result.json": (directory / "candidate/result.json").read_bytes(),
                "computer_install.py": Path(__file__).with_name("computer_install.py").read_bytes(),
                "full_ui_review.py": Path(__file__).with_name("full_ui_review.py").read_bytes(),
                "full_ui_usb.py": Path(__file__).with_name("full_ui_usb.py").read_bytes(),
                "full_ui_trial.py": Path(__file__).with_name("full_ui_trial.py").read_bytes(),
                "full_ui_trial_usb.py": Path(__file__).with_name("full_ui_trial_usb.py").read_bytes(),
                "full_ui_activation.py": Path(__file__).with_name("full_ui_activation.py").read_bytes(),
                "full_ui_activation_usb.py": Path(__file__).with_name("full_ui_activation_usb.py").read_bytes(),
                "README.txt": Path(__file__).with_name("computer-instructions.txt").read_bytes(),
                "runtime-requirements.txt": RUNTIME_REQUIREMENTS}
    for name, expected in report["source_sha256"].items():
        # source_closure already verified the exact private, no-symlink source
        # snapshot. Recheck the copied body too; no compiler output or .venv is
        # allowed to enter by directory traversal or recursive archiving.
        body = (source / name).read_bytes()
        if hashlib.sha256(body).hexdigest() != expected:
            raise PreparationError("usb_plan_unverified")
        contents["candidate/ports/monitor1/" + name] = body
    artifacts = {**report["artifacts"], "initial-trial-guardian-program": report["initial_trial_guardian"]}
    for name, pin in artifacts.items():
        if private_hash(directory / "candidate" / name) != pin:
            raise PreparationError("usb_build_unverified")
        contents["candidate/" + name] = (directory / "candidate" / name).read_bytes()
    helper = source / "build/pm-helper/pm_qt_bridge.so"
    pin = private_hash(helper, 2 * 1024**2)
    if pin != {"sha256": report["pm_helper"]["sha256"], "size": report["pm_helper"]["bytes"]}:
        raise PreparationError("usb_build_unverified")
    body = helper.read_bytes()
    if len(body) != pin["size"] or hashlib.sha256(body).hexdigest() != pin["sha256"]:
        raise PreparationError("usb_build_unverified")
    contents["candidate/ports/monitor1/build/pm-helper/pm_qt_bridge.so"] = body
    if len(contents) > 2100 or sum(len(body) for body in contents.values()) > MAX_PACKAGE - 2 * 1024**2:
        raise PreparationError("usb_computer_package_limit")
    # Export the job's verified producer, never the current build default.
    # A download must not relabel old program bytes as a newly reviewed build.
    manifest = {"schema_version": 1, "stage": "private_computer_bundle", "source_commit": report["source_commit"],
                "job_id": job_id, "profile_sha256": hashlib.sha256(contents["profile.json"]).hexdigest(),
                "installed": False, "installation_ready": False, "device_writes": 0,
                "files": {name: {"size": len(body), "sha256": hashlib.sha256(body).hexdigest()}
                          for name, body in contents.items()}}
    contents["bundle.json"] = (json.dumps(manifest, indent=2) + "\n").encode()
    output = io.BytesIO()
    directories = {PREFIX}
    for name in contents:
        directories.update(str(parent) for parent in Path(PREFIX + "/" + name).parents if str(parent) != ".")
    with tarfile.open(fileobj=output, mode="w", format=tarfile.USTAR_FORMAT) as archive:
        for name in sorted(directories, key=lambda value: (value.count("/"), value)):
            member = tarfile.TarInfo(name)
            member.type, member.mode = tarfile.DIRTYPE, 0o700
            archive.addfile(member)
        for name, body in contents.items():
            member = tarfile.TarInfo(PREFIX + "/" + name)
            member.mode, member.size = 0o600, len(body)
            archive.addfile(member, io.BytesIO(body))
    data = output.getvalue()
    if len(data) > MAX_PACKAGE:
        raise PreparationError("usb_computer_package_limit")
    return data
