"""Synthetic keys only: sealed profile, replay rejection and two-HA adoption."""
import asyncio
import base64
import copy
import hashlib
import hmac
import importlib
import importlib.util
import json
from pathlib import Path
import secrets
import sys
import types
import unittest

ROOT = Path(__file__).resolve().parents[1]
package = types.ModuleType("qingping_profile_test")
package.__path__ = [str(ROOT / "custom_components/qingping_esphome")]
sys.modules[package.__name__] = package
profile = importlib.import_module(package.__name__ + ".device_profile")
try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
except ImportError:
    AESGCM = None

MAC = "001122334455"
NAME = "qingping-001122334455-000000000"
KEY = base64.b64encode(b"K" * 32).decode()
VALUES = {"ssid": "test-network", "wifi_password": "test-wifi-password", "ap_ssid": "test-ap",
          "ap_password": "test-ap-password", "ota_password": "test-ota-password"}


def sealed(challenge, *, changes=None, key=KEY, mac=MAC):
    data = {"format": profile.PROFILE, "challenge": challenge, "mac": MAC, "name": NAME,
            "profile": "lite", "hardware": "0001", "source_stock_version": "4.5.8",
            "version": "2026.11.07-ui25-profile1", "revision": 2, "public_version": 1, "personalization": dict(VALUES)}
    data.update(changes or {})
    nonce = secrets.token_bytes(12)
    aes_key = hmac.digest(base64.b64decode(key), profile.KEY_DOMAIN, hashlib.sha256)
    ct = AESGCM(aes_key).encrypt(nonce, json.dumps(data).encode(), profile.associated_data(mac, challenge))
    return json.dumps({"format": profile.ENVELOPE, "nonce": nonce.hex(), "ciphertext": ct.hex()}).encode()


@unittest.skipIf(AESGCM is None, "cryptography required")
class ProfileTests(unittest.TestCase):
    def test_native_capability_is_authenticated_and_boolean(self):
        challenge=secrets.token_hex(16)
        self.assertFalse(profile.decode_profile(sealed(challenge),KEY,MAC,NAME,challenge).native_update)
        self.assertTrue(profile.decode_profile(sealed(challenge,changes={"native_update":True}),KEY,MAC,NAME,challenge).native_update)
        for value in (1,"true",{},None):
            with self.assertRaises(profile.ProfileError):
                profile.decode_profile(sealed(challenge,changes={"native_update":value}),KEY,MAC,NAME,challenge)
    def test_roundtrip_is_private_and_preserves_exact_values(self):
        challenge = secrets.token_hex(16)
        response = sealed(challenge)
        value = profile.decode_profile(response, KEY, MAC, NAME, challenge)
        self.assertEqual(value.values, {**VALUES, "name": NAME})
        self.assertEqual(value.public_version,1)
        for secret in VALUES.values():
            self.assertNotIn(secret.encode(), response)
            self.assertNotIn(secret, repr(value))

    def test_original_generation_and_display_feed_are_not_guessed(self):
        token=secrets.token_hex(16)
        wire=sealed(token,changes={"version":"2026.11.07-ui25-quiet2","revision":3,"public_version":2,
             "source_stock_version":"4.3.4","personalization":{**VALUES,"display_feed_entity":"sensor.room_display_feed"}})
        decoded=profile.decode_profile(wire,KEY,MAC,NAME,token)
        self.assertEqual(decoded.source_stock_version,"4.3.4")
        self.assertEqual(decoded.values["display_feed_entity"],"sensor.room_display_feed")
        for stock in ("4.2.1","4.2.6","unknown"):
            with self.assertRaises(profile.ProfileError):
                profile.decode_profile(sealed(token,changes={"source_stock_version":stock}),KEY,MAC,NAME,token)

    def test_wrong_key_mac_name_challenge_and_auth_tag_refuse(self):
        challenge = secrets.token_hex(16); response = sealed(challenge)
        for key,mac,name,token,wire in [
            (base64.b64encode(b"X"*32).decode(),MAC,NAME,challenge,response),
            (KEY,"001122334466",NAME,challenge,response),
            (KEY,MAC,"different-name",challenge,response),
            (KEY,MAC,NAME,"a"*32,response),
            (KEY,MAC,NAME,challenge,response.replace(b'"ciphertext": "',b'"ciphertext": "00')),
        ]:
            with self.subTest(mac=mac,name=name), self.assertRaisesRegex(profile.ProfileError,"^device_profile_unavailable$"):
                profile.decode_profile(wire,key,mac,name,token)

    def test_no_defaults_for_hardware_private_firmware_or_incomplete_secrets(self):
        c=secrets.token_hex(16)
        for changes in [{"hardware":"9999"},{"profile":"monitor1-s8"},{"revision":True},
                        {"version":"private-experiment"},{"public_version":True},{"public_version":0},{"personalization":{}},
                        {"personalization":{**VALUES,"wifi_password":"x"*500}}]:
            with self.subTest(changes=list(changes)), self.assertRaises(profile.ProfileError):
                profile.decode_profile(sealed(c,changes=changes),KEY,MAC,NAME,c)
        with self.assertRaises(profile.ProfileError):
            profile.decode_profile(b"x"*9000,KEY,MAC,NAME,c)

    def test_future_public_release_needs_validated_catalog_identity(self):
        c=secrets.token_hex(16)
        response=sealed(c,changes={"version":"2026.12.01-public3","revision":3})
        with self.assertRaises(profile.ProfileError):
            profile.decode_profile(response,KEY,MAC,NAME,c)
        decoded=profile.decode_profile(response,KEY,MAC,NAME,c,
                                       public_versions={"2026.12.01-public3":3})
        self.assertEqual(decoded.revision,3)
        with self.assertRaises(profile.ProfileError):
            profile.decode_profile(response,KEY,MAC,NAME,c,
                                   public_versions={"2026.12.01-public3":4})


@unittest.skipIf(AESGCM is None or importlib.util.find_spec("homeassistant") is None, "HA SDK required")
class AdoptionTests(unittest.IsolatedAsyncioTestCase):
    def manager(self):
        from aioesphomeapi import UserService,UserServiceArg,UserServiceArgType,SupportsResponseType
        module=importlib.import_module(package.__name__+".auto_adoption")
        info=types.SimpleNamespace(mac_address=MAC,name=NAME,compilation_time="test-build")
        self.values=dict(VALUES)
        class Client:
            connected_address="192.168.10.5"
            calls=0
            async def device_info(client):return info
            async def execute_service(client,action,data,**kwargs):
                client.calls+=1
                return types.SimpleNamespace(success=True,response_data=sealed(data["challenge"],changes={"personalization":dict(self.values)}))
            async def disconnect(client):raise AssertionError("Never disconnect HA's client")
        action=UserService(name=profile.ACTION,key=123,args=[UserServiceArg(name="challenge",type=UserServiceArgType.STRING)],supports_response=SupportsResponseType.ONLY)
        runtime=types.SimpleNamespace(available=True,device_info=info,client=Client(),services={123:action})
        entry=types.SimpleNamespace(entry_id="fixture",unique_id=MAC,data={"noise_psk":KEY,"port":6053},runtime_data=runtime)
        entries=types.SimpleNamespace(async_entries=lambda domain:[entry],async_get_entry=lambda key:entry)
        manager=types.SimpleNamespace(hass=types.SimpleNamespace(config_entries=entries),records={},updates=types.SimpleNamespace(lock=asyncio.Lock(),integration_version="0.1.9"))
        async def save():manager.persisted=copy.deepcopy(manager.records)
        manager.save_records=save
        adoption=module.AutoAdoption(manager)
        return manager,adoption,entry

    async def test_two_independent_ha_servers_import_without_a_transfer_file(self):
        first,a,e=self.manager();await a.scan()
        second,b,f=self.manager();await b.scan()
        self.assertEqual(first.records[MAC]["personalization"],second.records[MAC]["personalization"])
        self.assertEqual(second.records[MAC]["outcome"],"auto_adopted")
        self.assertEqual(second.records[MAC]["noise_key"],KEY)
        self.assertEqual(second.records[MAC]["firmware_revision"],2)
        self.assertEqual(second.records,second.persisted)
        self.assertEqual(f.runtime_data.client.calls,1)
        await b.scan();self.assertEqual(f.runtime_data.client.calls,1,"No repeated request during cache period")

    async def test_refresh_keeps_current_device_network_not_the_old_ha_copy(self):
        manager,a,e=self.manager();await a.scan()
        self.values["ssid"]="changed-on-device"
        async with manager.updates.lock:
            self.assertTrue(await a.refresh(MAC))
        self.assertEqual(manager.records[MAC]["personalization"]["ssid"],"changed-on-device")

    async def test_pending_intent_and_unverified_install_are_preserved(self):
        for record in [{"outcome":"native_verified","update_attempt":{"state":"sent"}},
                       {"outcome":"sent_requires_verification","command_consumed":True}]:
            manager,a,e=self.manager();manager.records[MAC]=copy.deepcopy(record)
            await a.scan()
            self.assertEqual(manager.records[MAC],record);self.assertEqual(e.runtime_data.client.calls,0)

    async def test_no_plaintext_unsupported_action_or_public_peer(self):
        for change in [lambda e:e.data.pop("noise_psk"),
                       lambda e:setattr(e.runtime_data.client,"connected_address","8.8.8.8"),
                       lambda e:e.runtime_data.services.clear()]:
            manager,a,e=self.manager();change(e);await a.scan()
            self.assertEqual(manager.records,{});self.assertEqual(e.runtime_data.client.calls,0)

    async def test_store_failure_never_leaves_memory_ready(self):
        manager,a,e=self.manager()
        async def fail():raise OSError("private exception text")
        manager.save_records=fail;await a.scan()
        self.assertEqual(manager.records,{})

    async def test_rekey_during_response_refuses_stale_profile(self):
        manager,a,e=self.manager();original=e.runtime_data.client.execute_service
        async def rekey(*args,**kwargs):
            result=await original(*args,**kwargs);e.data["noise_psk"]=base64.b64encode(b"Z"*32).decode();return result
        e.runtime_data.client.execute_service=rekey;await a.scan()
        self.assertEqual(manager.records,{})

    async def test_external_upgrade_retires_old_hash_without_losing_consumed_history(self):
        manager,a,e=self.manager()
        attempt={"state":"verified","id":"consumed-on-old-ha"}
        manager.records[MAC]={"outcome":"native_verified","firmware_version":"old-ui",
                             "firmware_revision":1,"image_sha256":"old-image",
                             "template_sha256":"old-template","update_attempt":attempt}
        await a.scan()
        row=manager.records[MAC]
        self.assertEqual(row["outcome"],"auto_adopted")
        self.assertEqual(row["update_attempt"],attempt)
        self.assertNotIn("image_sha256",row)
        self.assertEqual(row["prior_firmware_evidence"][0]["image_sha256"],"old-image")
        await a.refresh(MAC)
        self.assertEqual(len(manager.records[MAC]["prior_firmware_evidence"]),1)

    async def test_recompiled_same_version_retires_only_old_image_evidence(self):
        # A diagnostic version string can be reused by a separate compile.
        # It must not turn the previous image hash into proof of current bytes.
        manager, adoption, entry = self.manager()
        manager.records[MAC] = {
            "outcome": "native_verified", "firmware_version": "2026.11.07-ui25-profile1",
            "firmware_revision": 2, "public_version": 1, "build": "previous-build",
            "image_sha256": "previous-image", "template_sha256": "previous-template",
        }
        await adoption.scan()
        row = manager.records[MAC]
        self.assertEqual(row["outcome"], "auto_adopted")
        self.assertEqual(row["build"], "test-build")
        self.assertEqual(row["public_version"], 1)
        self.assertNotIn("image_sha256", row)
        self.assertNotIn("template_sha256", row)
        self.assertEqual(row["prior_firmware_evidence"][0]["build"], "previous-build")
        await adoption.refresh(MAC)
        self.assertEqual(len(manager.records[MAC]["prior_firmware_evidence"]), 1)

    async def test_unchanged_verified_build_keeps_its_image_evidence(self):
        # Refreshing settings on the exact verified build is not an upgrade.
        manager, adoption, entry = self.manager()
        manager.records[MAC] = {
            "outcome": "native_verified", "firmware_version": "2026.11.07-ui25-profile1",
            "firmware_revision": 2, "public_version": 1, "build": "test-build",
            "image_sha256": "current-image", "template_sha256": "current-template",
        }
        await adoption.scan()
        row = manager.records[MAC]
        self.assertEqual(row["outcome"], "native_verified")
        self.assertEqual(row["image_sha256"], "current-image")
        self.assertEqual(row["template_sha256"], "current-template")
        self.assertNotIn("prior_firmware_evidence", row)

    async def test_unload_cancels_only_owned_read_and_no_late_import(self):
        manager,a,e=self.manager();started=asyncio.Event();cancelled=asyncio.Event()
        async def slow(*args,**kwargs):
            started.set()
            try: await asyncio.Event().wait()
            finally: cancelled.set()
        e.runtime_data.client.execute_service=slow
        a._schedule(None);await asyncio.wait_for(started.wait(),2)
        await a.stop()
        self.assertTrue(cancelled.is_set());self.assertEqual(manager.records,{})
        a._schedule(None);self.assertIsNone(a.task)

    async def test_late_esphome_entry_is_adopted_without_reloading_installer(self):
        manager,a,e=self.manager()
        entries=manager.hass.config_entries
        entries.async_entries=lambda domain:[]
        await a.scan();self.assertEqual(manager.records,{})
        entries.async_entries=lambda domain:[e]
        await a.scan();self.assertIn(MAC,manager.records)

    async def test_periodic_job_is_dispatched_on_the_ha_event_loop(self):
        from homeassistant.core import HassJob, HassJobType
        manager,a,e=self.manager()
        self.assertEqual(HassJob(a._schedule).job_type,HassJobType.Callback)

    async def test_duplicate_mac_and_entry_removal_are_not_new_identity_authority(self):
        manager,a,e=self.manager()
        duplicate=types.SimpleNamespace(**vars(e));duplicate.entry_id="duplicate"
        manager.hass.config_entries.async_entries=lambda domain:[e,duplicate]
        await a.scan();self.assertEqual(manager.records,{})
        manager.hass.config_entries.async_entries=lambda domain:[e]
        original=e.runtime_data.client.execute_service
        async def removed(*args,**kwargs):
            result=await original(*args,**kwargs)
            manager.hass.config_entries.async_get_entry=lambda key:None
            return result
        e.runtime_data.client.execute_service=removed
        await a.scan();self.assertEqual(manager.records,{})
