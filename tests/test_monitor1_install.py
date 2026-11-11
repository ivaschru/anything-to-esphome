"""Software fixtures for the complete CGS1 update and its guarded recovery."""
import asyncio
import base64
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace as Obj
import unittest
from unittest.mock import AsyncMock, patch

HA = importlib.util.find_spec("homeassistant")
if HA:
    from custom_components.qingping_esphome import monitor1_install as m

MAC, NODE, PROJECT = "021122334455", "fixture", "ivaschru.qingping_monitor1_scd40"
KEY = base64.b64encode(bytes(range(32))).decode()
OLD_BOOT, NEW_BOOT = "1" * 8 + "-1111-1111-1111-" + "1" * 12, "2" * 8 + "-2222-2222-2222-" + "2" * 12
JOB, NEXT_JOB = "a" * 16, "b" * 16


def arm(marker):
    body = bytearray(53)
    body[:7] = b"\x7fELF\x01\x01\x01"
    body[16:24] = b"\x02\0\x28\0\x01\0\0\0"
    body[36:40] = (0x05000400).to_bytes(4, "little")
    body[40] = 52
    body[-1] = marker
    return bytes(body)


def bundle(version, offset):
    bodies = {kind: arm(offset + index) for index, kind in enumerate(m.FILES)}
    pins = {kind: {"size": len(value), "sha256": hashlib.sha256(value).hexdigest()}
            for kind, value in bodies.items()}
    return m.Bundle(version, pins, bodies, {"size": 3, "sha256": "e" * 64})


class Peer:
    def __init__(self):
        self.old, self.new = bundle("1", 1), bundle("2", 4)
        self.current, self.boot, self.mode = self.old, OLD_BOOT, "native"
        self.rows, self.receipt = {}, None
        self.gen, self.now = 0, 0
        self.enabled = True
        self.calls = []
        self.saved = {"1"}
        self.lost_ota, self.lost_save, self.fail_new = False, False, False
        self.foreign = False

    def factory(self, host, port, **kw):
        assert (host, port, kw["noise_psk"]) == ("192.168.1.20", 6053, KEY)
        return Obj(connect=AsyncMock(), disconnect=AsyncMock(), device_info=AsyncMock(return_value=Obj(
            name=NODE, mac_address="00:00:00:00:00:00" if self.foreign else MAC,
            project_name=PROJECT, project_version=self.current.version)),
            list_entities_services=AsyncMock(return_value=([], [Obj(name=name) for name in
                ([m.NATIVE, m.RETURN] if self.mode == "native" else m.SERVICES - {m.NATIVE, m.RETURN})])),
            execute_service=self.execute)

    def status(self):
        return {"ok": True, "phase": 7 if self.mode == "returned" else 0,
                "core_boot_enabled": self.enabled, "native_acquired": self.mode == "returned",
                "core_return_mode_saved": self.mode == "returned",
                "core_release_autostart_supported": True, "hardware_trial_active": False,
                "hard_runtime_ms": 0, "job": JOB if self.mode == "returned" else
                next(iter(self.rows.values()))[0] if self.rows else "",
                "artifacts": [{"kind": name, **pin, "offset": self.rows.get(name, ("", 0, False))[1],
                               "verified": self.rows.get(name, ("", 0, False))[2]}
                              for name, pin in self.current.pair.items()],
                "staged_release_save": self.receipt}

    def audit(self):
        def row(pin):
            return {"regular_owned_image": True, "hash_verified": True, "bytes": pin["size"], "sha256": pin["sha256"]}
        return {"ok": True, "read_only": True, "truncated": False, "bridge": row(self.current.bridge),
                "block_bytes": 4096, "blocks_available": 100000, "inodes_free": 1000,
                "releases": [{"release": "-".join(bundle.pair[name]["sha256"] for name in m.KINDS),
                              **{role: row(bundle.pair[role + "-program"]) for role in ("native", "guardian")}}
                             for bundle in (self.old, self.new) if bundle.version in self.saved]}

    async def execute(self, service, data, **kwargs):
        name = service.name
        self.calls.append((name, self.current.version))
        if name == m.NATIVE:
            self.gen += 1
            body = {"boot_id": self.boot, "nonce": JOB if self.boot == OLD_BOOT else NEXT_JOB,
                    "native_sha256": self.current.pair[m.KINDS[0]]["sha256"],
                    "guardian_sha256": self.current.pair[m.KINDS[1]]["sha256"],
                    "guardian_generations": [self.gen, self.gen], "connected_guardians": True,
                    "panel_ready": True, "core_sensors_ready": True, "native_state": 1}
        elif name == m.RETURN:
            self.mode, self.enabled = "returned", False
            raise TimeoutError("fixture return acknowledgment lost")
        elif name == m.RESET:
            assert data["previous_job"] == JOB
            self.mode = "bridge"
            body = {"ok": True, "previous_job": JOB, "programs_and_evidence_preserved": True}
        elif name == m.INSPECT:
            body = {"ok": self.mode == "bridge", "read_only": True, "boot_id": self.boot,
                    "bridge_sha256": self.current.bridge["sha256"], "process_signals_exposed": False,
                    "network_mutations_exposed": False}
        elif name == m.AUDIT:
            body = self.audit()
        elif name == m.ENABLE:
            self.enabled = True
            body = {"ok": True, "enabled": True}
        elif name == m.REBOOT:
            assert self.enabled and data["expected_boot_id"] == self.boot
            if not self.fail_new or self.current is self.old:
                self.boot, self.mode = NEW_BOOT, "native"
            raise TimeoutError("fixture reboot acknowledgment lost")
        elif name == "full_runtime_begin":
            self.rows[data["kind"]] = (data["job"], 0, False)
            body = self.status()
        elif name == "full_runtime_chunk":
            kind = data["kind"]
            actual = bytes.fromhex(data["hex_data"])
            assert actual == self.current.bodies[kind]
            self.rows[kind] = (data["job"], len(actual), False)
            body = self.status()
        elif name == "full_runtime_seal":
            job, offset, _ = self.rows[data["kind"]]
            self.rows[data["kind"]] = (job, offset, True)
            body = self.status()
        elif name == m.SAVE_SERVICE:
            assert data["expected_boot"] == self.boot and data["expected_bridge"] == self.current.bridge["sha256"]
            assert all(row[0] == data["job"] and row[2] for row in self.rows.values()) and len(self.rows) == 2
            self.saved.add(self.current.version)
            self.rows.clear()
            self.receipt = {"job": data["job"], "pair_saved": True, "uploads_released": True}
            if self.lost_save:
                raise TimeoutError("fixture save acknowledgment lost")
            body = {"ok": True}
        elif name == m.STATE:
            body = self.status()
        else:
            raise AssertionError(name)
        return Obj(success=True, response_data=json.dumps(body))

    async def ota(self, host, image, pin, key, progress):
        assert self.mode == "bridge" and key == KEY
        self.current = self.new if pin == self.new.bridge else self.old
        assert image == self.current.bodies["bridge-program"]
        self.calls.append(("ota", self.current.version))
        self.receipt = None
        self.enabled = False
        progress(1.0)
        if self.lost_ota:
            raise m.FirmwareError("ota_transfer_uncertain")

    async def sleep(self, seconds):
        self.now += seconds

    def device(self):
        return m.DeviceUpgrade("192.168.1.20", 6053, MAC, NODE, KEY, PROJECT,
            factory=self.factory, upload=self.ota, clock=lambda: self.now, sleep=self.sleep)


@unittest.skipUnless(HA, "Real HA SDK")
class Monitor1InstallTests(unittest.IsolatedAsyncioTestCase):
    async def test_upgrade_consumes_mutations_once_and_checks_two_new_boot_samples(self):
        peer = Peer()
        peer.lost_save = peer.lost_ota = True
        phases = []
        async def consume(value):
            phases.append(value)
        await peer.device().run(peer.old, peer.new, consume, lambda _: None)
        self.assertEqual(phases, ["return_to_stock", "retire_original_session", "replace_bridge", "save_pair", "enable_pair", "reboot"])
        self.assertEqual(peer.calls.count(("ota", "2")), 1)
        self.assertEqual(peer.calls.count((m.SAVE_SERVICE, "2")), 1)
        self.assertEqual(peer.calls.count((m.REBOOT, "2")), 1)
        self.assertEqual(peer.calls.count((m.NATIVE, "2")), 2)
        self.assertEqual(peer.saved, {"1", "2"})

    async def test_rollback_after_failed_boot_uses_one_verified_old_bridge_transfer(self):
        peer = Peer()
        peer.fail_new = True
        device = peer.device()
        consume = AsyncMock()
        with self.assertRaises(m.FirmwareError):
            await device.run(peer.old, peer.new, consume, lambda _: None)
        await device.restore(peer.old, peer.new, consume)
        self.assertEqual([row for row in peer.calls if row[0] == "ota"], [("ota", "2"), ("ota", "1")])
        self.assertEqual(peer.mode, "native")
        self.assertEqual(peer.current, peer.old)
        self.assertEqual(peer.calls.count((m.REBOOT, "1")), 1)

    async def test_wrong_api_identity_consumes_no_attempt_or_writer(self):
        peer = Peer()
        peer.foreign = True
        consume = AsyncMock()
        with self.assertRaisesRegex(m.FirmwareError, "identity_changed"):
            await peer.device().run(peer.old, peer.new, consume, lambda _: None)
        consume.assert_not_awaited()
        self.assertEqual(peer.calls, [])

    def test_private_candidate_exact_source_profile_and_binary(self):
        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch).resolve() / "updates"
            path = root / MAC.lower()
            root.mkdir(mode=0o700)
            path.mkdir(mode=0o700)
            profile = json.dumps({"model": "CGS1", "stock_version": "4.1.8_0287", "co2_type": 3,
                "api_mac": MAC, "node_name": NODE, "api_encryption_key": KEY}).encode()
            def write(file, data):
                file.write_bytes(data)
                file.chmod(0o600)
            write(path / "profile.json", profile)
            for version, offset, commit in (("1", 1, "1" * 40), ("2", 4, "2" * 40)):
                value = bundle(version, offset)
                directory = path / version
                directory.mkdir(mode=0o700)
                for kind, image in value.bodies.items():
                    write(directory / kind, image)
                write(directory / "result.json", json.dumps({"complete_build": True, "stage": "built_not_installed",
                    "hardware_contacted": False, "installed": False, "profile_sha256": hashlib.sha256(profile).hexdigest(),
                    "source_commit": commit, "artifacts": value.pins,
                    "runtime_release": {"profile": "monitor1-scd40", "public_version": int(version)},
                    "pm_helper": {"sha256": value.pm["sha256"], "bytes": value.pm["size"]}}).encode())
            monitor = Obj(version="1", profile="monitor1-scd40")
            release = Obj(public_version=2, source_commit="2" * 40)
            self.assertEqual(m.load_plan(root, MAC, monitor, release, NODE, KEY)[1].version, "2")
            release.source_commit = "3" * 40
            with self.assertRaisesRegex(m.FirmwareError, "candidate_mismatch"):
                m.load_plan(root, MAC, monitor, release, NODE, KEY)
