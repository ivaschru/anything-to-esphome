"""Actual HA SDK with synthetic cloud/LAN/worker peers; never flash hardware."""
import base64
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, Mock, patch

from test_sonoff import device, fixture

HAS_HA = importlib.util.find_spec("homeassistant") is not None


@unittest.skipUnless(HAS_HA, "Optional Home Assistant SDK not installed")
class SonoffHATests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        import homeassistant
        from homeassistant.core import HomeAssistant
        from custom_components.qingping_esphome.sonoff import Sonoff
        self.temp = tempfile.TemporaryDirectory()
        self.hass = HomeAssistant(self.temp.name)
        self.manager = SimpleNamespace(hass=self.hass, host="192.168.1.2")
        self.sonoff = Sonoff(self.manager)
        self.sonoff.store = SimpleNamespace(async_load=AsyncMock(return_value={}), async_save=AsyncMock())

    async def asyncTearDown(self):
        await self.sonoff.stop()
        await self.hass.async_stop(force=True)
        self.temp.cleanup()

    def choice(self):
        from custom_components.qingping_esphome.sonoff_policy import OwnedDevice
        owned = OwnedDevice.parse(device(), source="sonoff", auth={"at": "fixture-token"})
        token = self.sonoff.add_devices("owner", [owned])[0]["selection"]
        return token, owned

    async def test_actual_sdk_imports_timezone_wire_and_dst_rules(self):
        from custom_components.qingping_esphome.sonoff import timezone_rule
        from custom_components.qingping_esphome.sonoff_view import SonoffBackupView
        import struct
        self.assertTrue(SonoffBackupView.requires_auth)
        self.assertEqual(timezone_rule("UTC"), "0" * 64)
        wire = bytes.fromhex(timezone_rule("Europe/Moscow"))
        self.assertEqual(len(wire), 32)
        self.assertEqual(struct.unpack_from("<i", wire)[0], -10800)
        wire = bytes.fromhex(timezone_rule("Europe/Berlin"))
        self.assertEqual((wire[14], wire[15], wire[26], wire[27]), (1, 3, 1, 10))
        with self.assertRaises(Exception): timezone_rule("../private")

    async def test_sonofflan_snapshots_do_not_modify_existing_session(self):
        from custom_components.qingping_esphome.sonoff_discovery import sonoff_inventory, APP_ID
        raw, auth = device(), {"at": "fixture-token", "appid": APP_ID}
        registry = SimpleNamespace(devices={raw["deviceid"]: raw}, cloud=SimpleNamespace(auth=auth, region="eu"))
        self.hass.data["sonoff"] = {"configured": registry}
        found = sonoff_inventory(self.hass)
        self.assertEqual(len(found), 1)
        found[0].raw["name"] = "detached"; found[0].auth["at"] = "detached"
        self.assertEqual(raw["name"], "Fixture plug"); self.assertEqual(auth["at"], "fixture-token")
        registry.cloud.auth = {"at": "fixture-token", "appid": "different-protocol-app"}
        self.assertIsNone(sonoff_inventory(self.hass)[0].auth)

    async def test_encrypted_discovery_and_wrong_key(self):
        from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
        from cryptography.hazmat.primitives.padding import PKCS7
        from custom_components.qingping_esphome.sonoff_discovery import decrypt_advert
        key, iv = "fixture-device-key", b"i" * 16
        padding = PKCS7(128).padder()
        raw = json.dumps({"switch": "on", "rssi": -45}).encode()
        padded = padding.update(raw) + padding.finalize()
        encryptor = Cipher(algorithms.AES(hashlib.md5(key.encode()).digest()), modes.CBC(iv)).encryptor()
        fields = {"encrypt": "true", "iv": base64.b64encode(iv).decode(),
                  "data1": base64.b64encode(encryptor.update(padded) + encryptor.finalize()).decode()}
        self.assertEqual(decrypt_advert(fields, key)["switch"], "on")
        for bad, candidate in ((fields, "wrong-key"), ({**fields, "encrypt": "false"}, key), ({**fields, "iv": "bad"}, key)):
            with self.assertRaises(ValueError): decrypt_advert(bad, candidate)

    async def test_account_collects_fragmented_json_and_never_follows_redirects(self):
        from custom_components.qingping_esphome.sonoff_discovery import Account
        class Content:
            def __init__(self, value): self.value = value
            async def iter_chunked(self, size):
                for index in range(0, len(self.value), 3): yield self.value[index:index + 3]
        class Reply:
            status = 200
            content = Content(b'{"error":0,"data":{"at":"fixture-token"}}')
            async def __aenter__(self): return self
            async def __aexit__(self, *args): pass
        session = SimpleNamespace(request=unittest.mock.Mock(return_value=Reply()))
        with patch("custom_components.qingping_esphome.sonoff_discovery.async_get_clientsession", return_value=session):
            region, auth = await Account(self.hass).login("fixture@example.invalid", "private-password", country_code="+358")
        self.assertEqual((region, auth["at"]), ("eu", "fixture-token"))
        self.assertIs(session.request.call_args.kwargs["allow_redirects"], False)
        self.assertEqual(session.request.call_args.args[1], "https://eu-apia.coolkit.cc/v2/user/login")
        self.assertNotIn("private-password", str(session.request.call_args.kwargs["headers"]))

    async def test_durable_consumption_precedes_single_spawn_and_status_cannot_replay(self):
        from custom_components.qingping_esphome.sonoff_policy import SonoffError
        token, owned = self.choice()
        root = Path(self.temp.name) / "component/firmware"; root.mkdir(parents=True)
        binary = fixture(); (root / "sonoff-s60tpf-template.bin").write_bytes(binary)
        (root / "sonoff-s60tpf-template.json").write_text(json.dumps({"profile": "sonoff-s60tpf", "size": len(binary), "sha256": hashlib.sha256(binary).hexdigest()}))
        self.sonoff.preflight = AsyncMock(return_value=(owned, {}))
        self.sonoff.runtime.prepare = AsyncMock(return_value=Path(self.temp.name) / "job")
        async def launch(job, request):
            self.assertEqual(self.sonoff.store.async_save.await_count, 1)
            self.assertEqual(request["auth"]["at"], "fixture-token")
            self.assertEqual(len(request["values"]["name"]), 31)
            raise OSError("private-token-must-not-escape")
        self.sonoff.runtime.launch = AsyncMock(side_effect=launch)
        data = {"selection": token, "load_ack": True, "power_loss_ack": True}
        with patch("custom_components.qingping_esphome.sonoff.ROOT", root.parent):
            with self.assertRaises(SonoffError) as raised: await self.sonoff.install("owner", data)
            self.assertEqual(raised.exception.code, "sonoff_outcome_unknown")
            with self.assertRaises(SonoffError): await self.sonoff.install("owner", data)
        self.sonoff.runtime.launch.assert_awaited_once()
        result = await self.sonoff.call("owner", "sonoff_jobs", {})
        self.assertEqual(result["jobs"][0]["state"], "outcome_unknown")
        self.assertNotIn("fixture-token", json.dumps(result))
        self.assertEqual((await self.sonoff.call("other", "sonoff_jobs", {}))["jobs"], [])
        with self.assertRaises(SonoffError): self.sonoff.public_job(result["jobs"][0]["job"], "other")

    async def test_restart_and_load_ack_do_not_authorize_conversion(self):
        from custom_components.qingping_esphome.sonoff_policy import SonoffError
        self.sonoff.store.async_load.return_value = {"old": {"state": "running", "owner": "owner"}}
        self.sonoff.runtime.launch = AsyncMock()
        await self.sonoff.start()
        self.assertEqual(self.sonoff.records["old"]["state"], "outcome_unknown")
        token, _ = self.choice()
        with self.assertRaises(SonoffError): await self.sonoff.install("owner", {"selection": token})
        self.sonoff.runtime.launch.assert_not_awaited()

    async def test_unload_after_private_file_io_cannot_spawn_a_new_writer(self):
        from custom_components.qingping_esphome.sonoff_runtime import Runtime, private_write
        job = Path(self.temp.name) / "unloaded-job"; job.mkdir()
        active = True
        async def execute(function, *args):
            nonlocal active
            result = function(*args)
            if function is private_write:
                active = False  # HA unload while request-file executor IO completes.
            return result
        runtime = Runtime(SimpleNamespace(async_add_executor_job=execute), job.parent, active=lambda: active)
        with patch("custom_components.qingping_esphome.sonoff_runtime.asyncio.create_subprocess_exec", new=AsyncMock()) as spawn:
            with self.assertRaises(Exception): await runtime.launch(job, {"format": "anything-sonoff-job-v2"})
            spawn.assert_not_awaited()
        self.assertTrue((job / "worker.lock").exists(), "Consumed history remains even without a spawned child")

    async def test_verified_conversion_survives_enrollment_failure(self):
        job, record = self.recovery_job(settled=True)
        record["state"] = "running"
        self.sonoff.verify = AsyncMock()
        self.sonoff.enroll = AsyncMock(side_effect=RuntimeError("config flow failed"))
        await self.sonoff.watch(job, SimpleNamespace(wait=AsyncMock(return_value=0)))
        self.assertEqual(record["state"], "verified")
        self.assertEqual(record["enrollment"], "manual_flow_required")
        self.assertIs(record["writer_settled"], True)

    def recovery_job(self, *, settled=False):
        job = "a" * 32
        record = {"owner": "owner", "state": "outcome_unknown", "name": "Private plug",
                  "mac": "AA:BB:CC:11:22:33", "host": "192.168.1.33", "consumed": True,
                  "bluetooth_proxy": True, "receipt_nonce": "b" * 32,
                  "values": {"noise_psk": "fixture-private-key"}, "created_at": 1}
        self.sonoff.records[job] = record
        if settled:
            from custom_components.qingping_esphome.sonoff_journal import acquire, finish
            root = self.sonoff.root / job
            root.mkdir(parents=True, mode=0o700)
            lease = acquire(root)
            finish(root, {"format": "anything-sonoff-job-v2", "receipt_nonce": record["receipt_nonce"],
                          "mac": record["mac"]}, 2)
            os.close(lease)
        return job, record

    async def test_verified_label_never_bypasses_live_or_missing_terminal_proof(self):
        from custom_components.qingping_esphome.sonoff_journal import acquire, finish
        from custom_components.qingping_esphome.sonoff_policy import SonoffError
        job, record = self.recovery_job()
        record["state"] = "verified"  # A historical app result, not a lease receipt.
        nonce = record.pop("receipt_nonce")  # v0.3.0 had no bound terminal receipt.
        token, owned = self.choice()
        owned.mac = "AA:BB:CC:44:55:66"  # A different plug must pass the fleet guard.
        self.assertNotEqual(record["mac"], owned.mac)
        self.sonoff.preflight = AsyncMock(side_effect=SonoffError("sonoff_unavailable"))
        self.sonoff.runtime.launch = AsyncMock()
        data = {"selection": token, "load_ack": True, "power_loss_ack": True}
        self.assertFalse(self.sonoff.public_job(job, "owner")["writer_settled"])
        with self.assertRaises(SonoffError) as refused:
            await self.sonoff.install("owner", data)
        self.assertEqual(refused.exception.code, "sonoff_busy")
        self.sonoff.preflight.assert_not_awaited()

        record["receipt_nonce"] = nonce
        root = self.sonoff.root / job; root.mkdir(parents=True, mode=0o700)
        lease = acquire(root)
        try:
            finish(root, {"format": "anything-sonoff-job-v2", "receipt_nonce": record["receipt_nonce"],
                          "mac": record["mac"]}, 0)
            # A valid receipt still cannot release a living original worker.
            self.assertFalse(await self.sonoff.writer_settled(job, record))
            with self.assertRaises(SonoffError) as refused:
                await self.sonoff.install("owner", data)
            self.assertEqual(refused.exception.code, "sonoff_busy")
            self.sonoff.preflight.assert_not_awaited()
        finally:
            os.close(lease)
        self.assertTrue(await self.sonoff.writer_settled(job, record))
        with self.assertRaises(SonoffError) as allowed_preflight:
            await self.sonoff.install("owner", data)
        self.assertEqual(allowed_preflight.exception.code, "sonoff_unavailable")
        self.sonoff.preflight.assert_awaited_once()
        self.sonoff.runtime.launch.assert_not_awaited()

    async def test_recovery_uses_typed_fresh_api_without_switches_enrollment_or_reflash(self):
        from aioesphomeapi import SwitchInfo, SensorInfo, TextSensorInfo, UpdateInfo
        job, record = self.recovery_job(settled=True)
        entities = [SwitchInfo(name="Relay", key=1), SensorInfo(name="Voltage", key=2),
                    SensorInfo(name="Power", key=3), TextSensorInfo(name="Calibration", key=4),
                    UpdateInfo(name="Firmware", key=5), SwitchInfo(name="Bluetooth Proxy", key=6)]
        client = SimpleNamespace(connect=AsyncMock(), disconnect=AsyncMock(),
            device_info=AsyncMock(return_value=SimpleNamespace(mac_address=record["mac"], project_name="ivaschru.sonoff_s60tpf")),
            list_entities_services=AsyncMock(return_value=(entities, [])), switch_command=Mock())
        def states(callback):
            for key, state in ((1, False), (2, 229.5), (3, 0), (4, "stock NVS, factor 1.0")):
                callback(SimpleNamespace(key=key, state=state))
            callback(SimpleNamespace(key=5, current_version="2"))  # Native OTA is forward-compatible.
        client.subscribe_states = states
        self.sonoff.runtime.launch = AsyncMock(); self.sonoff.enroll = AsyncMock()
        with patch("custom_components.qingping_esphome.sonoff.APIClient", return_value=client) as factory, \
                patch("custom_components.qingping_esphome.sonoff.asyncio.sleep", new=AsyncMock()):
            result = await self.sonoff.recover("owner", {"job": job, "host": "192.168.1.34"})
        self.assertEqual(result["state"], "verified")
        self.assertEqual(result["recovery"], "app_verified")
        self.assertTrue(result["writer_settled"])
        self.assertEqual(record["host"], "192.168.1.34")
        self.assertIs(record["consumed"], True)
        self.assertEqual(factory.call_args.args[0], "192.168.1.34")
        client.switch_command.assert_not_called()
        client.disconnect.assert_awaited_once_with(force=True)
        self.sonoff.runtime.launch.assert_not_awaited(); self.sonoff.enroll.assert_not_awaited()

    async def test_recovery_keeps_legacy_uncertainty_and_refuses_wrong_owner_or_live_worker(self):
        from custom_components.qingping_esphome.sonoff_journal import acquire
        from custom_components.qingping_esphome.sonoff_policy import SonoffError
        job, record = self.recovery_job()
        async def observe(candidate, *, apply_options):
            self.assertFalse(apply_options)
            candidate["observed"] = {"relay": False, "voltage": 230, "power": 0}
        self.sonoff.verify = AsyncMock(side_effect=observe)
        with self.assertRaises(SonoffError): await self.sonoff.recover("other", {"job": job})
        result = await self.sonoff.recover("owner", {"job": job})
        self.assertEqual((result["state"], result["recovery"]), ("outcome_unknown", "writer_unconfirmed"))
        root = self.sonoff.root / job; root.mkdir(parents=True)
        lease = acquire(root)
        self.sonoff.verify.reset_mock()
        try:
            with self.assertRaises(SonoffError): await self.sonoff.recover("owner", {"job": job})
            self.sonoff.verify.assert_not_awaited()
        finally:
            os.close(lease)

    async def test_failed_recovery_retains_profile_and_unknown_and_only_frees_settled_writer(self):
        job, record = self.recovery_job(settled=True)
        values = copy.deepcopy(record["values"])
        self.sonoff.verify = AsyncMock(side_effect=ConnectionError("private-key-must-not-escape"))
        result = await self.sonoff.recover("owner", {"job": job})
        self.assertEqual((result["state"], result["recovery"]), ("outcome_unknown", "app_unavailable"))
        self.assertTrue(result["writer_settled"])
        self.assertEqual(values, record["values"])
        self.assertNotIn("private-key", json.dumps(result))
        self.assertTrue(await self.sonoff.writer_settled(job, record))

    async def test_history_paginates_newest_first_without_cross_owner_or_key_disclosure(self):
        for number in range(55):
            self.sonoff.records[str(number)] = {"owner": "owner", "state": "verified", "name": str(number),
                                               "values": {"noise_psk": "fixture-private-key"}}
        self.sonoff.records["other"] = {"owner": "other", "state": "verified", "name": "other-private-name"}
        first = await self.sonoff.call("owner", "sonoff_jobs", {})
        second = await self.sonoff.call("owner", "sonoff_jobs", {"offset": first["next_offset"]})
        self.assertEqual((len(first["jobs"]), len(second["jobs"])), (50, 5))
        self.assertEqual(first["jobs"][0]["name"], "54")
        self.assertEqual(second["jobs"][-1]["name"], "0")
        self.assertIsNone(second["next_offset"])
        self.assertNotIn("fixture-private-key", json.dumps(first))
        self.assertNotIn("other-private-name", json.dumps(first))

    async def test_diagnostics_are_allowlisted_and_require_same_admin_owner(self):
        from aiohttp import web
        from homeassistant.components.http.const import KEY_HASS, KEY_HASS_USER
        from custom_components.qingping_esphome.sonoff_view import SonoffDiagnosticsView
        job, record = self.recovery_job()
        record["observed"] = {"voltage": 230, "noise_psk": "fixture-private-key"}
        self.hass.data["qingping_esphome"] = self.manager
        self.manager.sonoff = self.sonoff
        class Request(dict):
            app = {KEY_HASS: self.hass}
        request = Request({KEY_HASS_USER: SimpleNamespace(id="owner", is_admin=True)})
        response = await SonoffDiagnosticsView().get(request, job)
        value = json.loads(response.body)
        self.assertEqual(value["observed"], {"voltage": 230})
        for private in ("fixture-private-key", record["mac"], record["host"], record["name"]):
            self.assertNotIn(private, response.body.decode())
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        request[KEY_HASS_USER] = SimpleNamespace(id="other", is_admin=True)
        with self.assertRaises(web.HTTPNotFound): await SonoffDiagnosticsView().get(request, job)
        request[KEY_HASS_USER] = SimpleNamespace(id="owner", is_admin=False)
        with self.assertRaises(web.HTTPForbidden): await SonoffDiagnosticsView().get(request, job)

    async def test_private_complete_backup_only_not_logs_or_credentials(self):
        from custom_components.qingping_esphome.sonoff_view import backup_archive
        import io, tarfile
        root = Path(self.temp.name) / "job"
        backup = root / "upstream/captures/plugs/fixture/sonoff-backup"
        backup.mkdir(parents=True)
        (backup / "flash.bin").write_bytes(b"f" * (4 * 1024 * 1024))
        with self.assertRaises(FileNotFoundError): backup_archive(root)
        (backup / "efuse.bin").write_bytes(b"e" * 128)
        (backup / "private-session.json").write_text("fixture-secret")
        with tarfile.open(fileobj=io.BytesIO(backup_archive(root))) as archive:
            self.assertEqual(len(archive.getmembers()), 2)
            self.assertTrue(all(member.mode == 0o600 for member in archive.getmembers()))
        (backup / "efuse.bin").unlink()
        (backup / "efuse.bin").symlink_to(backup / "flash.bin")
        with self.assertRaises(FileNotFoundError): backup_archive(root)

    async def test_pinned_upstream_rename_keeps_exact_root_and_path_guards(self):
        from custom_components.qingping_esphome import sonoff_runtime as runtime
        import io, tarfile
        def archive(root, member="tools/example.py"):
            output = io.BytesIO()
            with tarfile.open(fileobj=output, mode="w:gz") as tar:
                info = tarfile.TarInfo(root + "/" + member)
                info.size = 4
                tar.addfile(info, io.BytesIO(b"pass"))
            return output.getvalue()
        for index, prefix in enumerate(("firmware-liberator-", "Sonoff-OTA-")):
            value = archive(prefix + runtime.COMMIT)
            with patch.object(runtime, "ARCHIVE_SHA256", hashlib.sha256(value).hexdigest()):
                root = Path(self.temp.name) / str(index)
                runtime.extract_archive(value, root)
                self.assertEqual((root / "tools/example.py").read_text(), "pass")
        for root, member in (("unrelated-" + runtime.COMMIT, "safe"),
                             ("firmware-liberator-" + runtime.COMMIT, "../escape")):
            value = archive(root, member)
            with patch.object(runtime, "ARCHIVE_SHA256", hashlib.sha256(value).hexdigest()):
                with self.assertRaises(Exception): runtime.extract_archive(value, Path(self.temp.name) / "refused")


if __name__ == "__main__": unittest.main()
