# SPDX-License-Identifier: GPL-3.0-only
"""One fixed conversion; no restart/resume, arbitrary CLI or caller script.

The upstream engine still owns its original stage gates, calibration, complete
backup, relay test and readbacks. Only its *final app producer* is replaced by
a hash-checked private personalization of this project's C3 public template.
The engine independently validates that app before using its original writer.
"""
from pathlib import Path
import base64
import importlib.util
import json
import os
import subprocess
import sys
import threading
import time

COMPONENT = Path(__file__).parents[1]


def children_settled(children, original_threads=()):
    """Observe original child handles and drain threads without killing them.

    Some upstream failures terminate a helper without waiting, and HTTP calls
    can retain background threads. An engine return code alone cannot retire
    those writers. Keep uncertain history unless all original children/threads
    have actually ended within this finite grace period; never adopt a PID.
    """
    deadline = time.monotonic() + 5
    for process in children:
        try:
            process.wait(timeout=max(0, deadline - time.monotonic()))
        except subprocess.TimeoutExpired:
            return False
    for thread in threading.enumerate():
        if thread is not threading.current_thread() and thread not in original_threads:
            thread.join(max(0, deadline - time.monotonic()))
            if thread.is_alive():
                return False
    return True


def main():
    os.umask(0o077)
    job = Path.cwd().parent
    request = json.loads((job / "request.json").read_text())
    # Load only the installed sibling module. Importing the HA package here
    # would initialize unrelated integrations in this isolated GPL process.
    spec = importlib.util.spec_from_file_location("sonoff_journal", COMPONENT / "sonoff_journal.py")
    journal = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(journal)
    lease = journal.acquire(job)
    result = None
    children = []
    original_threads = frozenset(threading.enumerate())
    original_popen = subprocess.Popen

    class OwnedProcess(original_popen):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            children.append(self)

    try:
        # Track actual handles inside this isolated process without changing
        # the pinned engine's argv, transport, group or confirmation semantics.
        subprocess.Popen = OwnedProcess
        result = run(job, request)
        return result
    finally:
        # Account authorization stays available to original engine children
        # only for this process lifetime, including a pre-write refusal.
        try:
            (job / "answers.env").unlink(missing_ok=True)
            (job / "request.json").unlink(missing_ok=True)
            if type(result) is int and children_settled(children, original_threads):
                journal.finish(job, request, result)
        finally:
            subprocess.Popen = original_popen
            os.close(lease)


def run(job, request):
    from tools import autoflash_cli as engine
    from tools.autoflash import credentials, esphome, output
    from tools.get_device_key import get_devices
    # A second fresh cloud read happens in the actual child immediately before
    # the engine starts. Cached HA/selector JSON never grants this write.
    device = get_devices(request["region"], request["auth"]["at"])[0]
    if (device.get("productModel") != "S60TPF" or device.get("online") is not True
            or (device.get("params") or {}).get("fwVersion") != "1.2.0"
            or (device.get("extra") or {}).get("model") != "SN-ESP32C3-S60-01"):
        return 2
    image_path = COMPONENT / "sonoff_image.py"
    spec = importlib.util.spec_from_file_location("private_s60_image", image_path)
    image = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(image)
    template = (COMPONENT / "firmware/sonoff-s60tpf-template.bin").read_bytes()
    manifest = json.loads((COMPONENT / "firmware/sonoff-s60tpf-template.json").read_text())
    values = dict(request["values"])
    values["noise_psk"] = base64.b64decode(values["noise_psk"], validate=True)
    for value in values.values():
        output.private(value, "private-profile")

    def final_image(ssid, password, own=None):
        if own is not None:
            raise ValueError("Caller-selected final image refused")
        local = {**values, "ssid": ssid, "wifi_password": password}
        binary = image.personalize(template, local, manifest["sha256"])
        esphome.check_app(binary, "S60TPF public profile")
        # Retain the complete exact profile privately for recovery, never in a
        # public engine status or ordinary entity. The account password is absent.
        profile = {**local, "noise_psk": base64.b64encode(local["noise_psk"]).decode()}
        target = job / "profile.json"
        encoded = json.dumps(profile, sort_keys=True)
        # Upstream can ask its pure image producer again while preparing the
        # same final app. That must yield identical bytes, never replace a
        # recovery profile with a different Wi-Fi/key set or launch a writer.
        if target.exists():
            if target.read_text() != encoded:
                raise ValueError("Recovery profile changed")
            return binary
        with target.open("x") as stream:
            stream.write(encoded)
            stream.flush()
            os.fsync(stream.fileno())
        return binary

    esphome.image_for = final_image
    # Existing credential-aware verification remains active for the *new*
    # encrypted app. Dummy account answers merely satisfy upstream's prompts;
    # sitecustomize provides the previously authorized eWeLink session instead.
    answers = {"EWELINK_EMAIL": "authorized-session@example.invalid",
               "EWELINK_PASSWORD": "private-session-adapter",
               "AUTOFLASH_ESPHOME_API_KEY": base64.b64encode(values["noise_psk"]).decode(),
               "AUTOFLASH_ESPHOME_WEB_USER": "admin",
               "AUTOFLASH_ESPHOME_WEB_PASSWORD": values["ota_password"],
               "AUTOFLASH_ESPHOME_OTA_PASSWORD": values["ota_password"]}
    private_env = job / "answers.env"
    with private_env.open("x") as stream:
        for key, value in answers.items():
            if "\n" in value or "\r" in value:
                return 2
            stream.write(key + "=" + value + "\n")
    sys.argv = ["autoflash_cli.py", "run", "--new", "--unattended", "--firmware", "esphome",
                "--plug-ip", request["host"], "--listen-ip", request["lan_host"],
                "--env-file", str(private_env)]
    try:
        return engine.main()
    finally:
        # Preserve stock/eFuse/captures and consumed history, remove ephemeral
        # session/key copies. Recovery profile remains private for the owner.
        private_env.unlink(missing_ok=True)
        (job / "request.json").unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception:
        # Raw exceptions can include provider/request material. The private log
        # retains the engine's own scrubbed stage output, not this traceback.
        raise SystemExit(2) from None
