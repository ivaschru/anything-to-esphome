"""Actual HA SDK with synthetic cloud/LAN/worker peers; never flash hardware."""
import base64
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

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

    async def test_verified_conversion_survives_enrollment_failure(self):
        self.sonoff.records["job"] = {"state": "running"}
        self.sonoff.verify = AsyncMock()
        self.sonoff.enroll = AsyncMock(side_effect=RuntimeError("config flow failed"))
        await self.sonoff.watch("job", SimpleNamespace(wait=AsyncMock(return_value=0)))
        self.assertEqual(self.sonoff.records["job"]["state"], "verified")
        self.assertEqual(self.sonoff.records["job"]["enrollment"], "manual_flow_required")

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


if __name__ == "__main__": unittest.main()
