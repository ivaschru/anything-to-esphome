"""One fixed Full UI RAM trial over an already owned USB forward.

The job owner/consumed-intent and native USB scope belong to the caller. This
adapter accepts only the two pinned image bodies and a fixed local port. It
never selects an address, enables boot mode, activates a loader, retries a
write, resets a session or signals a process. The device guardians own return
to stock even when this host disappears. Software fixtures are not device QA.
"""
import asyncio
import hashlib
import re
import time

try:  # Same pure engine in Core's package and the standalone SDK child.
    from .full_ui_review import artifact_status, unique_json
except ImportError:
    from full_ui_review import artifact_status, unique_json

TRIAL_MS = 60000
KINDS = ("native-program", "guardian-program")
SERVICES = ("full_runtime_status", "full_runtime_inspect_start", "full_runtime_begin",
            "full_runtime_chunk", "full_runtime_seal", "full_runtime_prepare", "full_runtime_launch_trial")


class FullUiTrialError(Exception):
    """Finite public category only; never return SDK errors or private data."""


def checked_proof(proof, nonce):
    fields = {"state", "native_observations", "stock_return_observed", "launch_acknowledged", "job",
              "hard_runtime_ms", "installed", "installation_ready", "boot_enabled", "replay_allowed", "forward_cleanup", "boot_id"}
    if (not isinstance(proof, dict) or set(proof) != fields or proof["job"] != nonce or
            type(proof["hard_runtime_ms"]) is not int or proof["hard_runtime_ms"] != 60000 or
            type(proof["native_observations"]) is not int or not 0 <= proof["native_observations"] <= 2 or
            type(proof["stock_return_observed"]) is not bool or type(proof["launch_acknowledged"]) is not bool or
            any(proof[key] is not False for key in ("installed", "installation_ready", "boot_enabled", "replay_allowed")) or
            proof["state"] not in ("full_ui_trial_returned_observed", "full_ui_trial_unverified",
                                   "full_ui_trial_close_unverified", "full_ui_trial_rebuild_required") or
            proof["forward_cleanup"] not in ("removed", "absent", "not_created", "ambiguous_forward_preserved", "cleanup_unverified_preserved")):
        raise FullUiTrialError("usb_full_ui_trial_unverified")
    boot = proof["boot_id"]
    if boot is not None and (not isinstance(boot, str) or not re.fullmatch(r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}", boot)):
        raise FullUiTrialError("usb_full_ui_trial_unverified")
    if proof["state"] == "full_ui_trial_returned_observed" and (proof["native_observations"] != 2 or
            proof["stock_return_observed"] is not True or boot is None or proof["forward_cleanup"] not in ("removed", "absent")):
        raise FullUiTrialError("usb_full_ui_trial_unverified")
    return proof


def services_named(services, names):
    result = {}
    for service in services:
        if service.name in names:
            if service.name in result:
                raise FullUiTrialError("usb_full_ui_trial_unverified")
            result[service.name] = service
    return result


async def rpc(client, services, name, data, *, pending_prepare=False):
    result = await asyncio.wait_for(client.execute_service(services[name], data,
        return_response=True, timeout=15), 16)
    if result is None:
        raise FullUiTrialError("usb_full_ui_trial_unverified")
    body = unique_json(result.response_data)
    if result.success is not True and not (pending_prepare and result.success is False and
            body.get("ok") is False and body.get("error") == "core_display_repair_pending"):
        raise FullUiTrialError("usb_full_ui_trial_unverified")
    return body


def exact_artifacts(status, expected):
    try:
        artifact_status(status, expected)
    except Exception:
        raise FullUiTrialError("usb_full_ui_trial_unverified") from None


def native_sample(body, expected, boot, job):
    """Require this actual live native session and its physical core readiness.

    Guardian generations prove two live observations, not two new CO2 polls.
    The ready bit is the existing direct-physical CO2/T/RH/tVOC freshness
    predicate, independent of optional Home Assistant display feeds.
    """
    peers = body.get("guardian_generations")
    return (body.get("nonce") == job and body.get("boot_id") == boot and
            body.get("native_sha256") == expected["native-program"]["sha256"] and
            body.get("guardian_sha256") == expected["guardian-program"]["sha256"] and
            body.get("connected_guardians") is True and body.get("panel_ready") is True and
            body.get("core_sensors_ready") is True and type(body.get("native_state")) is int and
            body["native_state"] == 1 and isinstance(peers, list) and len(peers) == 2 and
            all(type(value) is int and value > 0 for value in peers))


async def run(port, profile, expected, bridge_sha, boot, job, images, *, factory=None,
              clock=time.monotonic, sleep=asyncio.sleep):
    """Consume no host intent here: the fixed caller must already own it.

    Upload/launch RPCs are sent once. A prepare continuation follows only its
    explicit pending response and a checked idle status. The device's existing
    admission step polls its one consumed repair; a status read cannot advance it.
    A lost launch response permits read-only observation, never another launch.
    """
    if (type(port) is not int or not 1024 <= port <= 65535 or
            not isinstance(job, str) or not re.fullmatch(r"[a-f0-9]{16}", job) or job == "0" * 16 or
            not isinstance(boot, str) or not re.fullmatch(r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}", boot) or
            not isinstance(bridge_sha, str) or not re.fullmatch(r"[a-f0-9]{64}", bridge_sha) or
            not isinstance(expected, dict) or not isinstance(images, dict) or
            set(expected) != set(KINDS) or set(images) != set(KINDS)):
        raise FullUiTrialError("usb_full_ui_trial_unverified")
    # Rehash actual bytes before opening a connection. The device repeats its
    # compiled manifest checks; this is never caller-selected executable data.
    for kind in KINDS:
        pin, body = expected[kind], images[kind]
        if (not isinstance(pin, dict) or set(pin) != {"size", "sha256"} or
                type(pin["size"]) is not int or not 0 < pin["size"] <= 16 * 1024**2 or
                not isinstance(body, bytes) or len(body) != pin["size"] or
                hashlib.sha256(body).hexdigest() != pin["sha256"]):
            raise FullUiTrialError("usb_full_ui_trial_unverified")
    if factory is None:
        from aioesphomeapi import APIClient
        factory = APIClient

    async def connect():
        client = factory("127.0.0.1", port, password=None, noise_psk=profile["api_encryption_key"],
                         client_info="Qingping fixed Full UI trial")
        try:
            await asyncio.wait_for(client.connect(login=True, log_errors=False), 12)
            info = await asyncio.wait_for(client.device_info(), 10)
            if info.name != profile["node_name"] or info.mac_address.lower() != profile["api_mac"]:
                raise FullUiTrialError("usb_full_ui_trial_unverified")
            _, services = await asyncio.wait_for(client.list_entities_services(), 10)
            return client, services
        except BaseException:
            await close(client)
            raise

    async def close(client):
        try:
            await asyncio.wait_for(client.disconnect(), 10)
        except Exception:
            raise FullUiTrialError("usb_full_ui_trial_close_unverified") from None

    client = None
    launch_issued = launch_ack = False
    try:
        client, listed = await connect()
        services = services_named(listed, SERVICES)
        if set(services) != set(SERVICES):
            raise FullUiTrialError("usb_full_ui_trial_rebuild_required")
        status = await rpc(client, services, "full_runtime_status", {})
        exact_artifacts(status, expected)
        if (status.get("job") != "" or type(status.get("phase")) is not int or status["phase"] != 0 or
                status.get("hardware_trial_active") is not False or status.get("core_boot_enabled") is not False or
                type(status.get("hard_runtime_ms")) is not int or status["hard_runtime_ms"] != 0 or
                status.get("core_release_autostart_supported") is not True or
                any(type(row.get("offset")) is not int or row["offset"] != 0 or row.get("verified") is not False
                    for row in status["artifacts"])):
            raise FullUiTrialError("usb_full_ui_trial_unverified")
        capture = await rpc(client, services, "full_runtime_inspect_start", {})
        if (capture.get("ok") is not True or capture.get("read_only") is not True or
                capture.get("process_signals_exposed") is not False or capture.get("network_mutations_exposed") is not False or
                capture.get("boot_id") != boot or capture.get("bridge_sha256") != bridge_sha):
            raise FullUiTrialError("usb_full_ui_trial_unverified")

        offsets = {kind: 0 for kind in KINDS}
        verified = {kind: False for kind in KINDS}

        def checked(body, *, prepared=False, launching=False, pending=False):
            exact_artifacts(body, expected)
            known_pending = pending and body.get("ok") is False and body.get("error") == "core_display_repair_pending"
            if (body.get("job") != job or (body.get("ok") is not True and not known_pending) or
                    body.get("core_boot_enabled") is not False):
                raise FullUiTrialError("usb_full_ui_trial_unverified")
            # Before launch every response must still describe our exact idle
            # staging session. Progress from another role/session is not an ACK
            # for this chunk. Do not continue writing after an unknown state.
            if not launching and (type(body.get("phase")) is not int or body["phase"] != 0 or
                    body.get("hardware_trial_active") is not False or
                    type(body.get("hard_runtime_ms")) is not int or body["hard_runtime_ms"] != 0):
                raise FullUiTrialError("usb_full_ui_trial_unverified")
            for row in body["artifacts"]:
                kind = row["kind"]
                if (type(row.get("offset")) is not int or row["offset"] != offsets[kind] or
                        row.get("verified") is not verified[kind]):
                    raise FullUiTrialError("usb_full_ui_trial_unverified")
            if prepared and (body.get("materialized") is not True or body.get("upload_duplicates_released") is not True):
                raise FullUiTrialError("usb_full_ui_trial_unverified")
            return {row["kind"]: row for row in body["artifacts"]}

        async with asyncio.timeout(360):
            for kind in KINDS:
                body = await rpc(client, services, "full_runtime_begin", {"job": job, "kind": kind})
                row = checked(body)[kind]
                if type(row.get("offset")) is not int or row["offset"] != 0 or row.get("verified") is not False:
                    raise FullUiTrialError("usb_full_ui_trial_unverified")
                for offset in range(0, len(images[kind]), 1024):
                    chunk = images[kind][offset:offset + 1024]
                    body = await rpc(client, services, "full_runtime_chunk",
                        {"job": job, "kind": kind, "offset": offset, "hex_data": chunk.hex()})
                    offsets[kind] = offset + len(chunk)
                    row = checked(body)[kind]
                    if type(row.get("offset")) is not int or row["offset"] != offset + len(chunk):
                        raise FullUiTrialError("usb_full_ui_trial_unverified")
                body = await rpc(client, services, "full_runtime_seal", {"job": job, "kind": kind})
                verified[kind] = True
                if checked(body)[kind].get("verified") is not True:
                    raise FullUiTrialError("usb_full_ui_trial_unverified")
            body = await rpc(client, services, "full_runtime_prepare", {"job": job}, pending_prepare=True)
            until = clock() + 20
            while body.get("ok") is False:
                checked(body, pending=True)
                if clock() >= until:
                    raise FullUiTrialError("usb_full_ui_trial_unverified")
                checked(await rpc(client, services, "full_runtime_status", {}), pending=True)
                await sleep(.5)
                # The precise WAITING response is permission to advance the
                # SAME device admission state, not to repeat a lost RPC or
                # create another repair. Any transport/other refusal stops.
                body = await rpc(client, services, "full_runtime_prepare", {"job": job}, pending_prepare=True)
            checked(body, prepared=True)
            launch_issued = True  # Before an RPC whose response can be lost.
            try:
                body = await rpc(client, services, "full_runtime_launch_trial", {"job": job})
                checked(body, prepared=True, launching=True)
                launch_ack = type(body.get("hard_runtime_ms")) is int and body["hard_runtime_ms"] == TRIAL_MS
            except Exception:
                pass  # Only observe the same nonce; never reissue launch.
    except FullUiTrialError:
        raise
    except Exception:
        raise FullUiTrialError("usb_full_ui_trial_unverified") from None
    finally:
        if client is not None:
            await close(client)

    samples, prior, returned, invalid_native = 0, None, False, False
    until = clock() + TRIAL_MS / 1000 + 100
    while launch_issued and clock() < until:
        client = None
        try:
            client, listed = await connect()
            services = services_named(listed, ("full_native_status", "full_runtime_status"))
            if "full_native_status" in services:
                body = await rpc(client, services, "full_native_status", {})
                if not native_sample(body, expected, boot, job):
                    # Sensors may be warming while the native API is already
                    # available. Preserve a hard identity mismatch as failure,
                    # but keep observing the device's eventual stock return.
                    invalid_native |= (body.get("nonce") != job or body.get("boot_id") != boot or
                        body.get("native_sha256") != expected["native-program"]["sha256"] or
                        body.get("guardian_sha256") != expected["guardian-program"]["sha256"])
                else:
                    generations = tuple(body["guardian_generations"])
                    if prior is None or all(value > old for value, old in zip(generations, prior)):
                        samples = min(samples + 1, 2)
                        prior = generations
            elif "full_runtime_status" in services:
                body = await rpc(client, services, "full_runtime_status", {})
                exact_artifacts(body, expected)
                if (body.get("job") == job and type(body.get("phase")) is int and body["phase"] == 7 and
                        body.get("native_acquired") is True and body.get("hardware_trial_active") is False and
                        body.get("core_boot_enabled") is False and body.get("coordinator_error") == "" and
                        type(body.get("hard_runtime_ms")) is int and body["hard_runtime_ms"] == TRIAL_MS):
                    returned = True
                    break
        except FullUiTrialError as error:
            if str(error) == "usb_full_ui_trial_close_unverified":
                raise
            invalid_native = True
        except Exception:
            pass  # Reconnecting to observe a handoff never repeats a mutation.
        finally:
            if client is not None:
                await close(client)
        await sleep(.5)
    return {"state": "full_ui_trial_returned_observed" if returned and samples >= 2 and not invalid_native else "full_ui_trial_unverified",
            "native_observations": samples, "stock_return_observed": returned, "launch_acknowledged": launch_ack,
            "job": job, "hard_runtime_ms": TRIAL_MS, "installed": False, "installation_ready": False,
            "boot_enabled": False, "replay_allowed": False, "boot_id": boot}
