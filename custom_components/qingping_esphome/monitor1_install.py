"""Install an owner-prepared CGS1 bundle on an existing installation."""
from __future__ import annotations

import asyncio
import base64
from contextlib import asynccontextmanager
from dataclasses import dataclass
import hashlib
import os
from pathlib import Path
import re
import secrets
import stat
import time

from homeassistant.helpers.storage import Store

from .firmware_catalog import FirmwareError, MONITOR1_CO2_TYPES
from .image import mac_normalize, private_ipv4
from .monitor1_worker.preparation import PreparationError, unique_json
from .monitor1_worker.full_ui_trial import (
    KINDS, SAVE_SERVICE, UPLOAD_SERVICES, exact_artifacts, native_sample,
    rpc, save_update_pair, services_named,
)
from .native_ota import check_monitor1_image, encryption_available, upload_monitor1_bridge

FILES = (*KINDS, "bridge-program")
SHA = re.compile(r"[0-9a-f]{64}")
BOOT = re.compile(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}")
NONCE = re.compile(r"[0-9a-f]{16}")
VERSION = re.compile(r"[1-9][0-9]{0,15}")
STATE = "full_runtime_status"
INSPECT = "full_runtime_inspect_start"
AUDIT = "storage_audit"
RESET = "full_runtime_new_session"
NATIVE = "full_native_status"
RETURN = "full_native_return_to_stock"
ENABLE = "full_runtime_set_core_boot_mode"
REBOOT = "full_runtime_reboot_core_device"
SERVICES = {*UPLOAD_SERVICES, SAVE_SERVICE, AUDIT, RESET, NATIVE, RETURN, ENABLE, REBOOT}


def require(condition, code="monitor1_update_unverified"):
    if not condition:
        raise FirmwareError(code)


def private_read(directory, name, limit):
    # All components beneath HA's private storage root are fixed local names.
    # Reject links before opening even when the operator provided the bundle.
    path = directory / name
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, "rb") as stream:
        before = os.fstat(stream.fileno())
        require(stat.S_ISREG(before.st_mode) and before.st_uid == os.getuid()
                and before.st_nlink == 1 and stat.S_IMODE(before.st_mode) == 0o600
                and 0 < before.st_size <= limit, "monitor1_update_private_bundle_required")
        data = stream.read(limit + 1)
        after = os.fstat(stream.fileno())
        named = path.lstat()
        require(len(data) == before.st_size and
                (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns) ==
                (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns) ==
                (named.st_dev, named.st_ino, named.st_size, named.st_mtime_ns, named.st_ctime_ns))
        return data


def private_directory(path):
    info = path.lstat()
    require(path.resolve() == path and stat.S_ISDIR(info.st_mode)
            and info.st_uid == os.getuid() and stat.S_IMODE(info.st_mode) == 0o700,
            "monitor1_update_private_bundle_required")
    return path


@dataclass(frozen=True)
class Bundle:
    version: str
    pins: dict
    bodies: dict
    pm: dict

    @property
    def pair(self):
        return {kind: self.pins[kind] for kind in KINDS}

    @property
    def bridge(self):
        return self.pins["bridge-program"]


def read_bundle(root, version, profile_sha, line, commit=None):
    directory = private_directory(root / version)
    report = unique_json(private_read(directory, "result.json", 512 * 1024))
    require(report.get("complete_build") is True and report.get("stage") == "built_not_installed"
            and report.get("hardware_contacted") is False and report.get("installed") is False
            and report.get("profile_sha256") == profile_sha
            and (commit is None or report.get("source_commit") == commit),
            "monitor1_update_candidate_mismatch")
    release = report.get("runtime_release")
    require((commit is None and release is None) or (isinstance(release, dict)
            and set(release) == {"profile", "public_version"} and release["profile"] == line
            and type(release["public_version"]) is int and str(release["public_version"]) == version),
            "monitor1_update_candidate_mismatch")
    pins = report.get("artifacts")
    require(isinstance(pins, dict) and set(pins) == set(FILES))
    bodies = {}
    for kind in FILES:
        body = private_read(directory, kind, 16 * 1024**2)
        pin = pins[kind]
        check_monitor1_image(body, pin)
        bodies[kind] = body
    pm = report.get("pm_helper")
    require(isinstance(pm, dict) and isinstance(pm.get("sha256"), str) and SHA.fullmatch(pm["sha256"])
            and type(pm.get("bytes")) is int and 0 < pm["bytes"] <= 16 * 1024**2)
    return Bundle(version, pins, bodies, {"size": pm["bytes"], "sha256": pm["sha256"]})


def load_plan(root, mac, monitor, release, node, key):
    """Read local private builds only. Neither the catalog nor HA input supplies ELF bytes."""
    old, new = monitor.version, str(release.public_version)
    require(VERSION.fullmatch(old) and VERSION.fullmatch(new) and int(new) > int(old))
    try:
        root = private_directory(private_directory(root) / mac.lower())
        profile_raw = private_read(root, "profile.json", 16384)
        profile = unique_json(profile_raw)
        require(profile.get("model") == "CGS1" and profile.get("stock_version") == "4.1.8_0287"
                and type(profile.get("co2_type")) is int and profile["co2_type"] == MONITOR1_CO2_TYPES[monitor.profile]
                and mac_normalize(profile.get("api_mac")) == mac and profile.get("node_name") == node
                and secrets.compare_digest(profile.get("api_encryption_key", ""), key),
                "monitor1_update_candidate_mismatch")
        profile_sha = hashlib.sha256(profile_raw).hexdigest()
        previous = read_bundle(root, old, profile_sha, monitor.profile)
        target = read_bundle(root, new, profile_sha, monitor.profile, release.source_commit)
        # This route replaces the runtime only. A new stock PM extension would
        # require a separate vendor-side transaction, so refuse it up front.
        require(previous.pm == target.pm, "monitor1_update_pm_helper_changed")
        require(all(previous.pins[k]["sha256"] != target.pins[k]["sha256"]
                    for k in ("bridge-program", "native-program")), "monitor1_update_candidate_mismatch")
        return previous, target
    except FirmwareError:
        raise
    except (OSError, ValueError, TypeError, AttributeError, KeyError, PreparationError):
        raise FirmwareError("monitor1_update_private_bundle_required") from None


def known_boot(value):
    return isinstance(value, str) and BOOT.fullmatch(value) is not None


def verify_audit(body, current, *, bridge=None, reserve=None):
    """Join the running ELF and durable pair to the exact private build."""
    def matches(row, pin):
        return (isinstance(row, dict) and row.get("regular_owned_image") is True
                and row.get("hash_verified") is True and type(row.get("bytes")) is int
                and row["bytes"] == pin["size"] and row.get("sha256") == pin["sha256"])

    require(body.get("ok") is True and body.get("read_only") is True and body.get("truncated") is False
            and matches(body.get("bridge"), bridge or current.bridge) and isinstance(body.get("releases"), list))
    pair_id = "-".join(current.pins[k]["sha256"] for k in KINDS)
    rows = [row for row in body["releases"] if isinstance(row, dict) and row.get("release") == pair_id]
    require(len(rows) == 1 and all(matches(rows[0].get(role), current.pins[role + "-program"])
                                    for role in ("native", "guardian")))
    if reserve is not None:
        block, available, inodes = (body.get(key) for key in ("block_bytes", "blocks_available", "inodes_free"))
        require(type(block) is int and 512 <= block <= 65536 and block & (block - 1) == 0
                and type(available) is int and 0 <= available <= 2**40 and type(inodes) is int and inodes >= 16
                and block * available >= sum(pin["size"] for pin in reserve.pins.values()) + 8 * 1024**2,
                "monitor1_update_storage_space")


class DeviceUpgrade:
    """One authenticated replacement and one Linux reboot. All retries are reads."""

    def __init__(self, host, port, mac, node, key, project, *, factory=None,
                 upload=upload_monitor1_bridge, clock=time.monotonic, sleep=asyncio.sleep):
        if factory is None:
            from aioesphomeapi import APIClient
            factory = APIClient
        self.host, self.port, self.mac, self.node, self.key, self.project = host, port, mac, node, key, project
        self.factory, self.upload, self.clock, self.sleep = factory, upload, clock, sleep
        self.original_boot = None
        self.original_full = False

    @asynccontextmanager
    async def connect(self):
        client = self.factory(self.host, self.port, password=None, noise_psk=self.key,
                              client_info="Anything to ESPHome Monitor 1 update")
        try:
            await asyncio.wait_for(client.connect(login=True, log_errors=False), 10)
            info = await asyncio.wait_for(client.device_info(), 10)
            require(mac_normalize(info.mac_address) == self.mac and info.name == self.node
                    and info.project_name == self.project, "monitor1_update_identity_changed")
            _, listed = await asyncio.wait_for(client.list_entities_services(), 10)
            yield client, info, listed, services_named(listed, SERVICES)
        finally:
            try:
                await asyncio.wait_for(client.disconnect(), 5)
            except Exception:
                raise FirmwareError("monitor1_update_disconnect_unverified") from None

    async def observe(self, check, duration):
        """Reconnect only to observe. A contradictory identity stops the job."""
        deadline = self.clock() + duration
        while self.clock() < deadline:
            try:
                async with self.connect() as connected:
                    value = await check(*connected)
                    if value is not None:
                        return value
            except FirmwareError:
                raise
            except (OSError, TimeoutError):
                pass
            except Exception as error:
                # The actual SDK wraps connection failures in APIConnectionError.
                from aioesphomeapi import APIConnectionError
                if not isinstance(error, APIConnectionError):
                    raise
            await self.sleep(2)
        raise FirmwareError("monitor1_update_reconnect_unverified")

    async def request_return(self, previous, consume):
        async with self.connect() as (client, info, _, services):
            require(info.project_version == previous.version)
            if NATIVE not in services:
                require({STATE, INSPECT, AUDIT} <= set(services))
                return None, None
            require(RETURN in services)
            body = await rpc(client, services, NATIVE, {})
            boot, job = body.get("boot_id"), body.get("nonce")
            require(known_boot(boot) and isinstance(job, str) and NONCE.fullmatch(job) and job != "0" * 16
                    and native_sample(body, previous.pair, boot, job), "monitor1_update_original_not_ready")
            self.original_boot, self.original_full = boot, True
            await consume("return_to_stock")
            # This status-only API may close its connection while yielding the
            # display. The following reads must prove the exact guardian return.
            try:
                await asyncio.wait_for(client.execute_service(services[RETURN], {}, return_response=True, timeout=12), 14)
            except Exception:
                pass
            return boot, job

    async def original_bridge(self, previous, target, consume):
        boot, job = await self.request_return(previous, consume)

        async def returned(client, info, _, services):
            if info.project_version != previous.version or NATIVE in services:
                return None
            require({STATE, INSPECT, AUDIT} <= set(services))
            status = await rpc(client, services, STATE, {})
            exact_artifacts(status, previous.pair)
            phase = status.get("phase")
            if job is not None:
                if type(phase) is not int or phase != 7 or status.get("core_return_mode_saved") is not True:
                    return None
                require(status.get("job") == job and status.get("native_acquired") is True
                        and status.get("hardware_trial_active") is False and RESET in services)
            else:
                require(type(phase) is int and phase == 0 and status.get("job") == "")
            require(status.get("core_boot_enabled") is False)
            verify_audit(await rpc(client, services, AUDIT, {}), previous, reserve=target)
            return True

        await self.observe(returned, 150)
        async with self.connect() as (client, info, _, services):
            require(info.project_version == previous.version and {STATE, INSPECT, AUDIT} <= set(services))
            status = await rpc(client, services, STATE, {})
            exact_artifacts(status, previous.pair)
            require(status.get("core_boot_enabled") is False)
            if job is not None:
                require(status.get("job") == job and type(status.get("phase")) is int and status["phase"] == 7
                        and status.get("core_return_mode_saved") is True and RESET in services)
                await consume("retire_original_session")
                response = await rpc(client, services, RESET, {"previous_job": job})
                require(response.get("ok") is True and response.get("previous_job") == job
                        and response.get("programs_and_evidence_preserved") is True)
            capture = await rpc(client, services, INSPECT, {})
            current_boot = capture.get("boot_id")
            require(capture.get("ok") is True and capture.get("read_only") is True
                    and capture.get("bridge_sha256") == previous.bridge["sha256"] and known_boot(current_boot)
                    and (boot is None or current_boot == boot))
            verify_audit(await rpc(client, services, AUDIT, {}), previous, reserve=target)
            self.original_boot, self.original_full = current_boot, job is not None
            return current_boot

    async def replace(self, bundle, progress):
        try:
            await self.upload(self.host, bundle.bodies["bridge-program"], bundle.bridge, self.key, progress)
        except FirmwareError:
            # The sender cannot distinguish a committed ELF from a lost final
            # frame. Only an exact read of the resulting bridge may advance it.
            pass

    async def activate(self, client, services, bundle, boot, consume, *, recovery=False):
        await consume("restore_enable" if recovery else "enable_pair")
        enabled = await rpc(client, services, ENABLE, {"enabled": True})
        require(enabled.get("ok") is True and enabled.get("enabled") is True)
        status = await rpc(client, services, STATE, {})
        exact_artifacts(status, bundle.pair)
        require(status.get("core_boot_enabled") is True and status.get("job") == "")
        await consume("restore_reboot" if recovery else "reboot")
        try:
            await rpc(client, services, REBOOT, {"expected_boot_id": boot})
        except Exception:
            pass  # Linux can restart before the final response arrives.

    async def run(self, previous, target, consume, progress):
        old_boot = await self.original_bridge(previous, target, consume)
        await consume("replace_bridge")
        await self.replace(target, progress)

        async def new_bridge(client, info, _, services):
            if info.project_version == previous.version:
                return None
            require(info.project_version == target.version and {INSPECT, SAVE_SERVICE, AUDIT, ENABLE, REBOOT} <= set(services)
                    and NATIVE not in services)
            capture = await rpc(client, services, INSPECT, {})
            require(capture.get("ok") is True and capture.get("read_only") is True
                    and capture.get("boot_id") == old_boot and capture.get("bridge_sha256") == target.bridge["sha256"])
            return True

        await self.observe(new_bridge, 90)
        async with self.connect() as connected:
            require(await new_bridge(*connected))
            client, _, listed, services = connected
            await consume("save_pair")
            await save_update_pair(client, listed, target.pair, target.bridge["sha256"], old_boot,
                                   secrets.token_hex(8), {kind: target.bodies[kind] for kind in KINDS})
            verify_audit(await rpc(client, services, AUDIT, {}), target)
            await self.activate(client, services, target, old_boot, consume)
        await self.verify_native(target, old_boot)

    async def verify_native(self, target, old_boot):
        await self.verify_native_pair(target.version, target.pair, old_boot)

    async def verify_native_pair(self, version, pair, old_boot, *, duration=300):
        prior = None

        async def healthy(client, info, _, services):
            nonlocal prior
            require(info.project_version == version)
            if NATIVE not in services:
                return None
            body = await rpc(client, services, NATIVE, {})
            boot, job = body.get("boot_id"), body.get("nonce")
            require(known_boot(boot) and boot != old_boot and isinstance(job, str) and NONCE.fullmatch(job)
                    and job != "0" * 16 and body.get("native_sha256") == pair[KINDS[0]]["sha256"]
                    and body.get("guardian_sha256") == pair[KINDS[1]]["sha256"])
            if not native_sample(body, pair, boot, job):
                return None  # Sensors may still be warming after startup.
            generations = tuple(body["guardian_generations"])
            if prior is None:
                prior = (boot, job, generations)
                return None
            require(prior[:2] == (boot, job))
            return True if all(value > old for value, old in zip(generations, prior[2])) else None

        await self.observe(healthy, duration)

    async def restore(self, previous, target, consume):
        """Recover once, only through an exactly identified idle stock bridge.

        A missing responder or an active native session is not permission to
        transmit. The previous private bundle remains available for USB.
        """
        async with self.connect() as (client, info, _, services):
            version = info.project_version
            require(version in (previous.version, target.version) and NATIVE not in services
                    and {STATE, INSPECT, AUDIT} <= set(services))
            current = previous if version == previous.version else target
            body = await rpc(client, services, INSPECT, {})
            boot = body.get("boot_id")
            require(body.get("ok") is True and body.get("read_only") is True and known_boot(boot)
                    and body.get("bridge_sha256") == current.bridge["sha256"])
            verify_audit(await rpc(client, services, AUDIT, {}), previous, bridge=current.bridge,
                         reserve=previous if current is target else None)
        if current is target:
            await consume("restore_bridge")
            await self.replace(previous, lambda _: None)

        async def old_again(client, info, _, services):
            if info.project_version != previous.version:
                return None
            require(NATIVE not in services and {STATE, INSPECT, AUDIT} <= set(services))
            body = await rpc(client, services, INSPECT, {})
            require(body.get("ok") is True and body.get("read_only") is True and body.get("boot_id") == boot
                    and body.get("bridge_sha256") == previous.bridge["sha256"])
            verify_audit(await rpc(client, services, AUDIT, {}), previous)
            return True

        await self.observe(old_again, 90)
        if self.original_full:
            async with self.connect() as connected:
                require(await old_again(*connected))
                client, _, _, services = connected
                require({ENABLE, REBOOT} <= set(services))
                await self.activate(client, services, previous, boot, consume, recovery=True)
            await self.verify_native(previous, boot)


class Monitor1Installer:
    def __init__(self, hass):
        self.hass = hass
        self.root = Path(hass.config.path(".storage", "qingping_esphome_monitor1_updates"))
        self.store = Store(hass, 1, "qingping_esphome.monitor1_updates", private=True, atomic_writes=True)
        self.lock = asyncio.Lock()

    def candidate_present(self, mac, monitor, release):
        # This is a bounded availability hint. Every byte is rehashed before
        # install. No routine inventory reads credentials or contacts a device.
        path = self.root / mac.lower()
        return (path / "profile.json").is_file() and all(
            (path / version / name).is_file() for version in (monitor.version, str(release.public_version))
            for name in (*FILES, "result.json"))

    async def status(self, mac, monitor, release):
        ledger = await self.store.async_load() or {}
        row = ledger.get(mac, {})
        pending = row.get("phase") not in (None, "verified", "restored")
        ready = bool(not pending and encryption_available() and monitor and release
                     and int(monitor.version) < release.public_version
                     and not (row.get("phase") == "restored" and row.get("target_version") == str(release.public_version))
                     and await self.hass.async_add_executor_job(self.candidate_present, mac, monitor, release))
        return ready, row.get("old_version") if pending else None

    def device(self, mac, monitor, esphome):
        runtime = esphome.runtime_data
        node = runtime.device_info.name
        key = esphome.data.get("noise_psk")
        host = private_ipv4(runtime.client.connected_address)
        port = esphome.data.get("port", 6053)
        require(type(port) is int and 0 < port <= 65535 and isinstance(key, str) and len(key) == 44)
        decoded = base64.b64decode(key, validate=True)
        require(len(decoded) == 32 and any(decoded))
        return DeviceUpgrade(host, port, mac, node, key, "ivaschru.qingping_" + monitor.profile.replace("-", "_"))

    async def reconcile(self, mac, monitor, esphome):
        """Resolve a lost host receipt from the live pair, with no device write."""
        if self.lock.locked():
            return False
        async with self.lock:
            ledger = await self.store.async_load() or {}
            row = ledger.get(mac, {})
            phase = row.get("phase")
            if phase in (None, "verified", "restored"):
                return False
            if phase == "reboot" and row.get("target_version") == monitor.version:
                old_boot, pair, result = row.get("old_boot"), row.get("target_pair"), "verified"
                require(known_boot(old_boot))
            elif row.get("old_version") == monitor.version:
                # The exact original native runtime can be healthy on the
                # same boot if the first mutation was never received.
                old_boot, pair, result = None, row.get("old_pair"), "restored"
            else:
                return False
            require(isinstance(pair, dict) and set(pair) == set(KINDS)
                    and all(isinstance(pin, dict) and isinstance(pin.get("sha256"), str) and SHA.fullmatch(pin["sha256"])
                            for pin in pair.values()))
            await self.device(mac, monitor, esphome).verify_native_pair(monitor.version, pair, old_boot, duration=15)
            await self.store.async_save({**ledger, mac: {**row, "phase": result}})
            return True

    async def install(self, mac, monitor, release, esphome, progress):
        require(not self.lock.locked(), "monitor1_update_busy")
        require(encryption_available(), "ota_encryption_required")
        async with self.lock:
            ledger = await self.store.async_load()
            if ledger is None:
                ledger = {}
            require(isinstance(ledger, dict) and all(isinstance(v, dict) for v in ledger.values()))
            prior = ledger.get(mac, {})
            require(not prior or prior.get("phase") == "verified" or
                    (prior.get("phase") == "restored" and prior.get("target_version") != str(release.public_version)),
                    "monitor1_update_pending_review")
            device = self.device(mac, monitor, esphome)
            previous, target = await self.hass.async_add_executor_job(
                load_plan, self.root, mac, monitor, release, device.node, device.key)

            async def consume(phase):
                # Persist the exact phase before each irreversible request.
                # HA reload/cancellation cannot turn an ambiguous ACK into a replay.
                ledger[mac] = {"old_version": previous.version, "target_version": target.version,
                               "old_bridge": previous.bridge["sha256"], "target_bridge": target.bridge["sha256"],
                               "old_boot": device.original_boot, "old_pair": previous.pair, "target_pair": target.pair,
                               "phase": phase}
                await self.store.async_save(ledger)

            try:
                await device.run(previous, target, consume, progress)
            except Exception as error:
                if ledger.get(mac, {}).get("phase") in {"replace_bridge", "save_pair", "enable_pair", "reboot"}:
                    try:
                        await device.restore(previous, target, consume)
                    except Exception:
                        raise FirmwareError("monitor1_update_recovery_required") from None
                    await consume("restored")
                    raise FirmwareError("monitor1_update_previous_restored") from None
                if isinstance(error, FirmwareError):
                    raise
                raise FirmwareError("monitor1_update_unverified") from None
            await consume("verified")
