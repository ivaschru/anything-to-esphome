"""Read-only Full UI prerequisite review over the job's authenticated API.

This is not staging, PM-extension activation, an installer or launch authority.
The caller owns the exact native USB forward and must retire it independently.
No address/key/command comes from HTTP. A positive report is a current runtime
preflight observation only; ordinary first-install qualification stays false.
"""
import asyncio
import json
import re


class FullUiReviewError(Exception):
    """Allowlisted public code only; never a library error or device payload."""


def unique_json(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise FullUiReviewError("usb_full_ui_unverified")
            result[key] = value
        return result
    if not isinstance(raw, str) or not 0 < len(raw.encode()) <= 32768:
        raise FullUiReviewError("usb_full_ui_unverified")
    value = json.loads(raw, object_pairs_hook=pairs)
    if not isinstance(value, dict):
        raise FullUiReviewError("usb_full_ui_unverified")
    return value


def artifact_status(status, expected):
    if (not isinstance(expected, dict) or set(expected) != {"native-program", "guardian-program"} or
            not isinstance(status.get("artifacts"), list) or len(status["artifacts"]) != 2):
        raise FullUiReviewError("usb_full_ui_unverified")
    seen = set()
    for row in status["artifacts"]:
        if not isinstance(row, dict) or row.get("kind") not in expected or row["kind"] in seen:
            raise FullUiReviewError("usb_full_ui_unverified")
        seen.add(row["kind"])
        pin = expected[row["kind"]]
        if (not isinstance(pin, dict) or set(pin) != {"size", "sha256"} or
                type(pin["size"]) is not int or not 0 < pin["size"] <= 16 * 1024**2 or
                not isinstance(pin["sha256"], str) or not re.fullmatch(r"[a-f0-9]{64}", pin["sha256"]) or
                type(row.get("size")) is not int or row["size"] != pin["size"] or row.get("sha256") != pin["sha256"]):
            raise FullUiReviewError("usb_full_ui_unverified")


async def review(port, profile, expected, bridge_sha, boot_id, factory=None):
    """Observe only status/inspect_start, then positively close this client.

The USB caller supplies its already checked current boot and candidate pins.
The device repeats its original board capture; no saved status/file flag or
successful TLS/Noise handshake can be promoted into a launch authorization.
"""
    if (type(port) is not int or not 1024 <= port <= 65535 or
            not isinstance(bridge_sha, str) or not re.fullmatch(r"[a-f0-9]{64}", bridge_sha) or
            not isinstance(boot_id, str) or not re.fullmatch(r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}", boot_id)):
        raise FullUiReviewError("usb_full_ui_unverified")
    if factory is None:
        from aioesphomeapi import APIClient
        factory = APIClient
    try:
        client = factory("127.0.0.1", port, password=None,
                         noise_psk=profile["api_encryption_key"], client_info="Qingping read-only Full UI review")
    except Exception:
        raise FullUiReviewError("usb_full_ui_unverified") from None
    report = None
    try:
        await asyncio.wait_for(client.connect(login=True, log_errors=False), 12)
        info = await asyncio.wait_for(client.device_info(), 10)
        if info.name != profile["node_name"] or info.mac_address.lower() != profile["api_mac"]:
            raise FullUiReviewError("usb_full_ui_unverified")
        _, services = await asyncio.wait_for(client.list_entities_services(), 10)
        names = ("full_runtime_status", "full_runtime_inspect_start")
        selected = {}
        for service in services:
            if service.name in names:
                if service.name in selected:
                    raise FullUiReviewError("usb_full_ui_unverified")
                selected[service.name] = service
        if set(selected) != set(names):
            raise FullUiReviewError("usb_full_ui_unverified")

        async def read(name):
            result = await asyncio.wait_for(client.execute_service(selected[name], {}, return_response=True, timeout=15), 16)
            if result is None or result.success is not True:
                raise FullUiReviewError("usb_full_ui_unverified")
            return unique_json(result.response_data)

        status = await read("full_runtime_status")
        artifact_status(status, expected)
        # Refuse an existing RAM/persistent full session. This read grants no
        # session reset, retirement, duplicate removal or adoption of its job.
        if (status.get("job") != "" or type(status.get("phase")) is not int or status["phase"] != 0 or
                status.get("hardware_trial_active") is not False or status.get("core_boot_enabled") is not False or
                status.get("core_release_autostart_supported") is not True):
            raise FullUiReviewError("usb_full_ui_unverified")
        capture = await read("full_runtime_inspect_start")
        if (capture.get("read_only") is not True or capture.get("process_signals_exposed") is not False or
                capture.get("network_mutations_exposed") is not False or type(capture.get("ok")) is not bool):
            raise FullUiReviewError("usb_full_ui_unverified")
        if capture["ok"]:
            if capture.get("boot_id") != boot_id or capture.get("bridge_sha256") != bridge_sha:
                raise FullUiReviewError("usb_full_ui_unverified")
            state = "full_ui_preflight_observed"
        else:
            # A single precise known prerequisite may be explained. Do not
            # surface raw strings from an SDK/device as public error details.
            state = "pm_extension_required" if capture.get("stock_error") == "pm_helper_not_in_verified_state" else "full_ui_unverified"
        report = {"state": state, "read_only": True, "device_writes": 0, "launch_authorized": False,
                  "installation_ready": False, "installed": False, "live_recheck_required": True}
    except Exception:
        raise FullUiReviewError("usb_full_ui_unverified") from None
    finally:
        try:
            await asyncio.wait_for(client.disconnect(), 10)
        except Exception:
            # An otherwise positive snapshot is not a completed operation if
            # this exact API connection's retirement is unknown. The caller
            # must still reconcile its own acknowledged USB forward separately.
            raise FullUiReviewError("usb_full_ui_close_unverified") from None
    return report
