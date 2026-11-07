"""Fixed native USB scope for the separately confirmed permanent UI step."""
import time

from full_ui_activation import FullUiActivationError, run


async def run_usb(adb, plan, profile, canonical, trial_job, boot, activate=run):
    target = plan["target"]
    expected = {kind: plan["files"][kind] for kind in ("native-program", "guardian-program")}
    port, acknowledged, cleanup = None, False, "not_created"
    result = {"state": "full_ui_activation_unverified", "trial_job": trial_job, "boot_id": boot,
              "native_job": None, "native_observations": 0, "store_installed": None, "boot_enabled": None,
              "start_requested": False, "start_acknowledged": False, "installed": False,
              "installation_ready": False, "replay_allowed": False}
    try:
        adb.deadline = time.monotonic() + 700
        if (adb.serial != target["usb_serial"] or adb.usb() != target["usb_transport"] or boot == target["boot_id"] or
                canonical.review.preflight.identity(adb, target["wlan_mac"], target["co2_type"]) != boot):
            raise FullUiActivationError("usb_full_ui_activation_unverified")
        bridge = plan["files"]["bridge-program"]
        canonical.review.staging.verify_remote_file(adb, canonical.BASE + "/program", bridge)
        port = canonical.reserve_port()
        cleanup = "ambiguous_forward_preserved"
        canonical.install_forward(adb, port)
        acknowledged = True
        result = await activate(port, profile, expected, bridge, boot, trial_job)
        if (canonical.review.preflight.identity(adb, target["wlan_mac"], target["co2_type"]) != boot or
                adb.usb() != target["usb_transport"]):
            raise FullUiActivationError("usb_full_ui_activation_unverified")
        canonical.review.staging.verify_remote_file(adb, canonical.BASE + "/program", bridge)
    except Exception:
        result["state"] = "full_ui_activation_unverified"
    finally:
        # Retire only the exact forward whose create ACK this process saw.
        # API/identity failures never skip this independent cleanup or adopt a
        # device PID, select another USB device, reset staging or reboot.
        adb.deadline = None
        if acknowledged:
            try:
                cleanup = canonical.remove_forward(adb, port)
            except Exception:
                cleanup = "cleanup_unverified_preserved"
    if cleanup not in ("removed", "absent", "not_created"):
        result["state"] = "full_ui_activation_close_unverified"
    result["forward_cleanup"] = cleanup
    return result
