"""One owner-consumed Full UI trial through an exact native USB transport."""
import hashlib
import os
import stat
import time

from full_ui_trial import FullUiTrialError, run


def image_bytes(path, pin):
    """Read one fixed private image through one fd; no symlink/hash-read gap."""
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, "rb") as stream:
        info = os.fstat(stream.fileno())
        if (not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_uid != os.getuid() or
                stat.S_IMODE(info.st_mode) != 0o600 or not 0 < info.st_size <= 16 * 1024**2):
            raise FullUiTrialError("usb_full_ui_trial_unverified")
        body = stream.read(16 * 1024**2 + 1)
    if len(body) != info.st_size or {"size": len(body), "sha256": hashlib.sha256(body).hexdigest()} != pin:
        raise FullUiTrialError("usb_full_ui_trial_unverified")
    return body


async def run_usb(adb, plan, profile, canonical, nonce, images, trial=run):
    """Recheck this USB/boot/image scope and retire only our acknowledged forward.

    The caller persists its one-use intent before entering. This adapter cannot
    reset staging, select a network target, enable boot or retry a command. The
    guardians' fixed device deadline remains independent of USB/host lifetime.
    """
    target = plan["target"]
    expected = {kind: plan["files"][kind] for kind in ("native-program", "guardian-program")}
    port, acknowledged, cleanup = None, False, "not_created"
    result = {"state": "full_ui_trial_unverified", "native_observations": 0,
              "stock_return_observed": False, "launch_acknowledged": False, "job": nonce,
              "hard_runtime_ms": 60000, "installed": False, "installation_ready": False,
              "boot_enabled": False, "replay_allowed": False, "boot_id": None}
    try:
        adb.deadline = time.monotonic() + 600
        if adb.serial != target["usb_serial"] or adb.usb() != target["usb_transport"]:
            raise FullUiTrialError("usb_full_ui_trial_unverified")
        boot = canonical.review.preflight.identity(adb, target["wlan_mac"], target["co2_type"])
        if boot == target["boot_id"]:
            raise FullUiTrialError("usb_full_ui_trial_unverified")
        result["boot_id"] = boot
        bridge = plan["files"]["bridge-program"]
        canonical.review.staging.verify_remote_file(adb, canonical.BASE + "/program", bridge)
        port = canonical.reserve_port()
        cleanup = "ambiguous_forward_preserved"
        canonical.install_forward(adb, port)
        acknowledged = True
        result = await trial(port, profile, expected, bridge["sha256"], boot, nonce, images)
        if (canonical.review.preflight.identity(adb, target["wlan_mac"], target["co2_type"]) != boot or
                adb.usb() != target["usb_transport"]):
            raise FullUiTrialError("usb_full_ui_trial_unverified")
        canonical.review.staging.verify_remote_file(adb, canonical.BASE + "/program", bridge)
    except Exception as error:
        result["state"] = ("full_ui_trial_rebuild_required" if isinstance(error, FullUiTrialError) and
            str(error) == "usb_full_ui_trial_rebuild_required" else "full_ui_trial_unverified")
        if isinstance(error, FullUiTrialError) and str(error) == "usb_full_ui_trial_close_unverified":
            result["state"] = "full_ui_trial_close_unverified"
    finally:
        # A failed API disconnect or verification must not skip independent
        # cleanup. Never remove a mapping whose create ACK was not received.
        adb.deadline = None
        if acknowledged:
            try:
                cleanup = canonical.remove_forward(adb, port)
            except Exception:
                cleanup = "cleanup_unverified_preserved"
    if cleanup not in ("removed", "absent", "not_created"):
        result["state"] = "full_ui_trial_close_unverified"
    result["forward_cleanup"] = cleanup
    return result
