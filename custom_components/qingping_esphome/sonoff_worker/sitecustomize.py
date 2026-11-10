# SPDX-License-Identifier: GPL-3.0-only
"""Narrow account-session adapter for the separately pinned Sonoff-OTA engine.

The source validators/backup/transport programs are unchanged. All its Python
children receive the same owned authenticated session through the same private
job file. No account password or token is placed in their environment/argv.
This adapter is never on HA's own Python path.
"""
from pathlib import Path
import importlib.util
import json
import os
import stat
import subprocess


def install():
    path = Path.cwd().parent / "request.json"
    metadata = path.lstat()
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_mode & 0o077 or metadata.st_size > 65536:
        raise SystemExit("Invalid private Sonoff job")
    request = json.loads(path.read_text())
    if request.get("format") not in {"anything-sonoff-job-v1", "anything-sonoff-job-v2"}:
        raise SystemExit("Invalid Sonoff job contract")
    if request["format"] == "anything-sonoff-job-v2":
        spec = importlib.util.spec_from_file_location("sonoff_child_journal", Path(__file__).parents[1] / "sonoff_journal.py")
        journal = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(journal)
        lease = journal.inherited(path.parent, request.get("lease_fd"))
        original_popen = subprocess.Popen

        class InheritedProcess(original_popen):
            def __init__(self, *args, **kwargs):
                # Python helpers may create their own process groups. The
                # original kernel lock must survive that lifetime as well;
                # no PID/session adoption or secret environment is involved.
                kwargs["pass_fds"] = tuple(set(kwargs.get("pass_fds", ())) | {lease})
                super().__init__(*args, **kwargs)

        subprocess.Popen = InheritedProcess
    from tools import get_device_key as account
    original_devices = account.get_devices

    def session(email, password, country_code, region):
        return request["region"], request["auth"]

    def login(email, password, country_code, region):
        region, auth = session(email, password, country_code, region)
        return region, auth["at"]

    def devices(region, token):
        values = original_devices(region, token)
        selected = [value for value in values if value.get("deviceid") == request["device_id"]]
        if len(selected) != 1:
            raise account.EwelinkError("Selected owned device unavailable")
        mac = str((selected[0].get("params") or {}).get("staMac", "")).replace(":", "").upper()
        if mac != request["mac"].replace(":", "").upper():
            raise account.EwelinkError("Selected owned identity changed")
        return selected

    account.login_session, account.login, account.get_devices = session, login, devices
    os.umask(0o077)


try:
    install()
except BaseException:
    # Python normally logs and ignores ordinary sitecustomize exceptions.
    # A missing original lease/session must stop the helper before its main
    # module can contact a plug, with no raw private traceback or retry.
    raise SystemExit("Invalid private Sonoff child capability") from None
