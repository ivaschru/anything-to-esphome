"""Separate permanent step after a successful, human-reviewed Full UI trial.

The fixed caller must first persist its owner/plan/trial-bound intent. No image,
path, boot selector, time limit or generic action comes from HTTP. Device-side
Store, board/PM/DRM and once-per-boot guardians remain authoritative. This
coordinator never replays an uncertain mutation or reboots the appliance.
"""
import asyncio
import re
import time

from full_ui_trial import FullUiTrialError, exact_artifacts, native_sample, rpc, services_named

SERVICES = ("full_runtime_status", "storage_audit", "full_runtime_install_core_release",
            "full_runtime_set_core_boot_mode", "full_runtime_new_session", "full_runtime_start_installed_core")


class FullUiActivationError(Exception):
    """Finite public code, never a device/SDK error or private input."""


def require(value):
    if not value:
        raise FullUiActivationError("usb_full_ui_activation_unverified")


def checked_proof(proof, trial_job, boot):
    """Validate the private causal receipt; public status omits its boot/nonce."""
    fields = {"state", "trial_job", "boot_id", "native_job", "native_observations", "store_installed", "boot_enabled",
              "start_requested", "start_acknowledged", "installed", "installation_ready", "replay_allowed", "forward_cleanup"}
    require(isinstance(proof, dict) and set(proof) == fields and proof["trial_job"] == trial_job and proof["boot_id"] == boot and
            proof["state"] in ("full_ui_activation_unverified", "full_ui_activation_close_unverified", "full_ui_activation_space", "full_ui_active_observed") and
            type(proof["native_observations"]) is int and 0 <= proof["native_observations"] <= 2 and
            all(proof[k] is None or type(proof[k]) is bool for k in ("store_installed", "boot_enabled")) and
            all(type(proof[k]) is bool for k in ("start_requested", "start_acknowledged")) and
            not (proof["start_acknowledged"] and not proof["start_requested"]) and
            all(proof[k] is False for k in ("installed", "installation_ready", "replay_allowed")) and
            proof["forward_cleanup"] in ("removed", "absent", "not_created", "ambiguous_forward_preserved", "cleanup_unverified_preserved"))
    nonce = proof["native_job"]
    require(nonce is None or (isinstance(nonce, str) and re.fullmatch(r"[a-f0-9]{16}", nonce) and
                             nonce not in (trial_job, "0" * 16)))
    if proof["state"] == "full_ui_active_observed":
        require(proof["store_installed"] is True and proof["boot_enabled"] is True and proof["start_requested"] is True and
                proof["native_observations"] == 2 and nonce is not None and proof["forward_cleanup"] in ("removed", "absent"))
    if proof["state"] == "full_ui_activation_space":
        require(proof["native_observations"] == 0 and proof["store_installed"] is None and proof["boot_enabled"] is False and
                proof["start_requested"] is False and proof["start_acknowledged"] is False and nonce is None and
                proof["forward_cleanup"] in ("removed", "absent"))
    return proof


def returned_pair(body, expected, trial_job):
    """Only this exact completed RAM trial, never a historical public flag."""
    exact_artifacts(body, expected)
    require(body.get("job") == trial_job and type(body.get("phase")) is int and body["phase"] == 7 and
            body.get("native_acquired") is True and body.get("hardware_trial_active") is False and
            body.get("core_boot_enabled") is False and body.get("core_boot_job") == "" and
            body.get("core_release_autostart_supported") is True and body.get("materialized") is True and
            body.get("upload_duplicates_released") is True and body.get("coordinator_error") == "" and
            type(body.get("hard_runtime_ms")) is int and body["hard_runtime_ms"] == 60000)
    for row in body["artifacts"]:
        require(type(row.get("offset")) is int and row["offset"] == row["size"] and row.get("verified") is True)


def capacity(body, expected, bridge):
    """Read actual private-ext4 capacity, reserving another pair and 8 MiB.

    The first installation has no full-releases directory yet. The existing
    read-only audit reports capacity and the exact bridge BEFORE that precise
    inventory failure. Accept no other failure as a capacity measurement. The
    independent device Store still rejects a foreign/partial directory.
    """
    require(body.get("read_only") is True and (body.get("ok") is True or
        (body.get("ok") is False and body.get("error") == "private_release_store_required")))
    image = body.get("bridge", {})
    require(isinstance(image, dict) and image.get("regular_owned_image") is True and image.get("hash_verified") is True and
            type(image.get("bytes")) is int and image["bytes"] == bridge["size"] and image.get("sha256") == bridge["sha256"])
    block, available, inodes = (body.get(key) for key in ("block_bytes", "blocks_available", "inodes_free"))
    require(type(block) is int and 512 <= block <= 65536 and not block & (block - 1) and
            type(available) is int and 0 <= available <= 2**40 and type(inodes) is int and 0 <= inodes <= 2**40)
    if block * available < sum(pin["size"] for pin in expected.values()) + 8 * 1024**2 or inodes < 16:
        raise FullUiActivationError("usb_full_ui_activation_space")


async def run(port, profile, expected, bridge, boot, trial_job, *, factory=None,
              clock=time.monotonic, sleep=asyncio.sleep):
    """Four one-shot mutations; only read observations follow a lost start ACK."""
    require(type(port) is int and 1024 <= port <= 65535 and isinstance(boot, str) and
            re.fullmatch(r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}", boot) and
            isinstance(trial_job, str) and re.fullmatch(r"[a-f0-9]{16}", trial_job) and trial_job != "0" * 16 and
            isinstance(bridge, dict) and set(bridge) == {"size", "sha256"} and type(bridge["size"]) is int and
            0 < bridge["size"] <= 16 * 1024**2 and isinstance(bridge["sha256"], str) and re.fullmatch(r"[a-f0-9]{64}", bridge["sha256"]))
    if factory is None:
        from aioesphomeapi import APIClient
        factory = APIClient
    store, enabled, started, acknowledged = None, None, False, False
    samples, prior, boot_job, invalid, cleanup_failed = 0, None, None, False, False
    state = "full_ui_activation_unverified"

    def result():
        return {"state": "full_ui_activation_close_unverified" if cleanup_failed else state,
                "trial_job": trial_job, "boot_id": boot, "native_job": boot_job, "native_observations": samples,
                "store_installed": store, "boot_enabled": enabled, "start_requested": started,
                "start_acknowledged": acknowledged, "installed": False, "installation_ready": False,
                "replay_allowed": False}

    async def close(client):
        nonlocal cleanup_failed
        try:
            await asyncio.wait_for(client.disconnect(), 10)
        except Exception:
            cleanup_failed = True

    async def connect():
        client = factory("127.0.0.1", port, password=None, noise_psk=profile["api_encryption_key"],
                         client_info="Qingping separate permanent Full UI")
        try:
            await asyncio.wait_for(client.connect(login=True, log_errors=False), 12)
            info = await asyncio.wait_for(client.device_info(), 10)
            require(info.name == profile["node_name"] and info.mac_address.lower() == profile["api_mac"])
            _, services = await asyncio.wait_for(client.list_entities_services(), 10)
            return client, services
        except BaseException:
            await close(client)
            raise

    client, setup_failed = None, False
    try:
        client, listed = await connect()
        services = services_named(listed, SERVICES)
        require(set(services) == set(SERVICES))
        returned_pair(await rpc(client, services, "full_runtime_status", {}), expected, trial_job)
        enabled = False
        capacity(await rpc(client, services, "storage_audit", {}), expected, bridge)
        # Capacity is a fresh observation, not a reservation. Recheck the
        # lifecycle before the device independently captures board/Store again.
        returned_pair(await rpc(client, services, "full_runtime_status", {}), expected, trial_job)
        body = await rpc(client, services, "full_runtime_install_core_release", {"job": trial_job})
        require(body.get("ok") is True and body.get("vendor_boot_files_changed") is False and
                body.get("enabled") is False and body.get("error") == "")
        store = True
        enabled = None  # A lost enable ACK must not be reported as still off.
        body = await rpc(client, services, "full_runtime_set_core_boot_mode", {"enabled": True})
        require(body.get("ok") is True and body.get("enabled") is True and body.get("error") == "")
        enabled = True
        body = await rpc(client, services, "full_runtime_new_session", {"previous_job": trial_job})
        require(body.get("ok") is True and body.get("previous_job") == trial_job and body.get("already_reset") is False and
                body.get("programs_and_evidence_preserved") is True and body.get("hardware_or_network_mutations") is False)
        body = await rpc(client, services, "full_runtime_status", {})
        exact_artifacts(body, expected)
        require(body.get("job") == "" and type(body.get("phase")) is int and body["phase"] == 0 and
                body.get("hardware_trial_active") is False and body.get("native_acquired") is False and
                body.get("materialized") is False and body.get("upload_duplicates_released") is False and
                body.get("core_boot_enabled") is True and body.get("core_boot_job") == "" and
                body.get("last_session_reset_job") == trial_job and type(body.get("hard_runtime_ms")) is int and
                body["hard_runtime_ms"] == 0 and all(type(row.get("offset")) is int and row["offset"] == 0 and
                    row.get("verified") is False for row in body["artifacts"]))
        started = True  # Consumed before an ambiguous request/response.
        try:
            body = await rpc(client, services, "full_runtime_start_installed_core", {})
            acknowledged = body.get("ok") is True
        except Exception:
            pass  # Never resend; only observe the resulting boot job.
    except FullUiActivationError as error:
        if str(error) == "usb_full_ui_activation_space":
            state = "full_ui_activation_space"
        setup_failed = True
    except Exception:
        setup_failed = True
    finally:
        if client is not None:
            await close(client)

    if setup_failed or cleanup_failed:
        return result()

    until = clock() + 360
    while started and not cleanup_failed and clock() < until:
        client = None
        try:
            client, listed = await connect()
            services = services_named(listed, ("full_runtime_status", "full_native_status"))
            if "full_runtime_status" in services:
                body = await rpc(client, services, "full_runtime_status", {})
                exact_artifacts(body, expected)
                if body.get("core_boot_enabled") is not True:
                    # A real guardian fallback durably opts out. Do not keep
                    # reporting the earlier enable ACK as the latest fact.
                    enabled = False if body.get("core_boot_enabled") is False else None
                    break
                nonce = body.get("core_boot_job")
                if nonce:
                    require(isinstance(nonce, str) and re.fullmatch(r"[a-f0-9]{16}", nonce) and nonce != trial_job and
                            nonce != "0" * 16 and (boot_job is None or boot_job == nonce))
                    boot_job = nonce
            elif "full_native_status" in services and boot_job is not None:
                body = await rpc(client, services, "full_native_status", {})
                if native_sample(body, expected, boot, boot_job):
                    generations = tuple(body["guardian_generations"])
                    if prior is None or all(n > old for n, old in zip(generations, prior)):
                        prior, samples = generations, min(samples + 1, 2)
                        if samples == 2 and not invalid:
                            state = "full_ui_active_observed"
                            break
                else:
                    invalid |= (body.get("nonce") != boot_job or body.get("boot_id") != boot or
                        body.get("native_sha256") != expected["native-program"]["sha256"] or
                        body.get("guardian_sha256") != expected["guardian-program"]["sha256"])
        except (FullUiActivationError, FullUiTrialError):
            invalid = True
        except Exception:
            pass  # Read-only reconnects across handoff cannot repeat a writer.
        finally:
            if client is not None:
                await close(client)
        await sleep(.5)
    return result()
