"""Fixed read-only USB bridge for Full UI prerequisites; never enable/launch."""
import time

from full_ui_review import review, FullUiReviewError


async def inspect(adb, plan, profile, canonical, reader=review, initial_pm_reader=None):
    """Use only this creator's acknowledged loopback forward, then retire it.

The manifest and profile are supplied by the checked private job. Native USB,
physical identity/current boot and exact bridge bytes are re-read around the
authenticated API inspection. No generic service, path, host or command is
accepted, and the successful DTO never grants a future write.
"""
    expected = {name: plan["files"][name] for name in ("native-program", "guardian-program")}
    target = plan["target"]
    port, acknowledged, result = None, False, None
    cleanup = "not_created"
    try:
        adb.deadline = time.monotonic() + 140
        if adb.serial != target["usb_serial"] or adb.usb() != target["usb_transport"]:
            raise FullUiReviewError("usb_full_ui_unverified")
        boot = canonical.review.preflight.identity(adb, target["wlan_mac"], target["co2_type"])
        if boot == target["boot_id"]:
            raise FullUiReviewError("usb_full_ui_unverified")
        bridge_path = canonical.BASE + "/program"
        canonical.review.staging.verify_remote_file(adb, bridge_path, plan["files"]["bridge-program"])
        port = canonical.reserve_port()
        cleanup = "ambiguous_forward_preserved"
        canonical.install_forward(adb, port)
        acknowledged = True
        result = await reader(port, profile, expected, plan["files"]["bridge-program"]["sha256"], boot)
        if (canonical.review.preflight.identity(adb, target["wlan_mac"], target["co2_type"]) != boot or
                adb.usb() != target["usb_transport"]):
            raise FullUiReviewError("usb_full_ui_unverified")
        canonical.review.staging.verify_remote_file(adb, bridge_path, plan["files"]["bridge-program"])
    except Exception as error:
        state = "full_ui_close_unverified" if isinstance(error, FullUiReviewError) and str(error) == "usb_full_ui_close_unverified" else "full_ui_unverified"
        result = {"state": state, "read_only": True, "device_writes": 0,
                  "launch_authorized": False, "installation_ready": False, "installed": False,
                  "live_recheck_required": True}
    finally:
        adb.deadline = None
        if acknowledged:
            try:
                cleanup = canonical.remove_forward(adb, port)
            except Exception:
                cleanup = "cleanup_unverified_preserved"
    if cleanup not in ("removed", "absent", "not_created"):
        result["state"] = "full_ui_close_unverified"
    if result["state"] == "pm_extension_scope_required":
        result["state"] = "full_ui_unverified"
        # The API's wrapper mismatch is only a candidate. First retire its
        # client and exact forward, then require an independent positive
        # original disabled-stock/PM-opt-out scope on the SAME current boot.
        if cleanup in ("removed", "absent") and initial_pm_reader is not None:
            try:
                state = await initial_pm_reader(boot)
                if state in ("pm_extension_required", "full_ui_unverified", "full_ui_close_unverified"):
                    result["state"] = state
            except Exception:
                pass
    result["forward_cleanup"] = cleanup
    return result
