"""Lite recovery against HA storage and synthetic ESPHome API peers."""
import time
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

import test_ha_contract as ha_contract

VERIFY = "custom_components.qingping_esphome.lite_verification"
MAC = "020000000001"
NAME = "qingping-020000000001-000000001"


@unittest.skipUnless(ha_contract.AVAILABLE, "Requires Home Assistant SDK")
class LiteRecoveryTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = ha_contract.HAContractTests.asyncSetUp
    asyncTearDown = ha_contract.HAContractTests.asyncTearDown

    def record(self):
        preview = self.manager.preview_ap("owner", MAC)
        record = {
            "owner": "owner", "command_consumed": True, "profile": "lite", "name": NAME,
            "peer": "192.168.50.3", "noise_key": "fixture-key", "public_version": 4,
            "install_version": 4, "at": "2026-11-12T00:00:00+00:00",
            "source_stock_version": "4.5.8", "remember_wifi": True,
            "personalization": {"ssid": "fixture-network", "wifi_password": "fixture-home-pass",
                                "ap_ssid": preview["ssid"], "ap_password": preview["password"]},
            "outcome": "sent_requires_verification",
        }
        self.manager.records[MAC] = record
        return record, preview

    async def test_timeout_restart_readback_history_and_owner_scoped_passwords(self):
        from aioesphomeapi import SensorInfo, SensorState
        from custom_components.qingping_esphome.errors import InstallerError
        from custom_components.qingping_esphome.manager import Manager

        record, preview = self.record()
        self.assertEqual(self.manager._ap_password("owner", MAC, preview["token"]), preview["password"])
        with self.assertRaises(InstallerError):
            self.manager._ap_password("other", MAC, preview["token"])

        unreachable = SimpleNamespace(connect=AsyncMock(side_effect=OSError), disconnect=AsyncMock())
        with (patch(VERIFY + ".VERIFY_SECONDS", 0.09), patch(VERIFY + ".RETRY_SECONDS", 0.002),
              patch(VERIFY + ".addresses", AsyncMock(return_value=[record["peer"]])),
              patch("aioesphomeapi.APIClient", return_value=unreachable)):
            self.assertTrue(self.manager.retry_lite("owner", MAC)["running"])
            task = self.manager.checks[MAC]
            self.assertTrue(self.manager.retry_lite("owner", MAC)["running"])
            self.assertIs(self.manager.checks[MAC], task)
            await task
        self.assertGreater(unreachable.connect.await_count, 1)
        self.assertEqual(self.manager.saved_wifi("owner"), {"ssid": None})

        restarted = Manager(self.hass, self.entry)
        self.addAsyncCleanup(restarted.stop)
        restarted.records = await restarted.store.async_load()
        restarted.enroll = AsyncMock(return_value="created")
        restarted.relay.publish = AsyncMock()
        before = restarted.lite_installations("owner")["devices"][0]
        self.assertEqual(before["history"][0]["error"], "lite_api_timeout")
        self.assertEqual(restarted.lite_installations("other"), {"devices": []})
        self.assertEqual(restarted.reveal_ap("owner", MAC)["password"], preview["password"])
        with self.assertRaises(InstallerError):
            restarted.reveal_ap("other", MAC)
        with self.assertRaises(InstallerError):
            restarted.retry_lite("other", MAC)

        info = SimpleNamespace(mac_address=MAC, name=NAME, project_name="ivaschru.qingping_lite_direct_i2c",
                               project_version="4", compilation_time="fixture")
        entities = [SensorInfo(key=i, name=name) for i, name in enumerate(("CO2", "Temperature", "Humidity"))]

        def readings(callback):
            for i, value in enumerate((800, 23, 45)):
                callback(SensorState(key=i, state=value))

        connected = SimpleNamespace(connect=AsyncMock(), disconnect=AsyncMock(),
                                    device_info=AsyncMock(return_value=info), subscribe_states=readings,
                                    list_entities_services=AsyncMock(return_value=(entities, [])))
        current_host = "192.168.50.8"
        with (patch(VERIFY + ".addresses", AsyncMock(return_value=[current_host])),
              patch("aioesphomeapi.APIClient", return_value=connected) as factory):
            restarted.retry_lite("owner", MAC)
            await restarted.checks[MAC]
        self.assertEqual(factory.call_args.args[0], current_host)
        self.assertEqual(factory.call_args.kwargs["noise_psk"], record["noise_key"])
        self.assertEqual(restarted.enroll.call_args.args[0].peer, current_host)
        restarted.relay.publish.assert_not_called()
        self.assertFalse(restarted.relay.sessions)
        after = restarted.lite_installations("owner")["devices"][0]
        self.assertEqual(after["verification"]["stage"], "lite_check_added")
        self.assertEqual(after["history"][0]["state"], "verified")
        self.assertNotIn("fixture-home-pass", repr(after))
        self.assertNotIn(preview["password"], repr(after))
        self.assertEqual(restarted.saved_wifi("owner")["ssid"], "fixture-network")
        self.assertNotIn("password", restarted.saved_wifi("owner"))
        self.assertEqual(restarted.saved_wifi("other"), {"ssid": None})
        self.assertEqual((await restarted.wifi_store.async_load())["owner"]["password"], "fixture-home-pass")
        await restarted.forget_wifi("owner")
        self.assertEqual(await restarted.wifi_store.async_load(), {})

    async def test_forget_revokes_a_pending_install_opt_in(self):
        record, _ = self.record()
        await self.manager.forget_wifi("owner")
        await self.manager._remember_verified_wifi(record)
        self.assertNotIn("remember_wifi", record)
        self.assertEqual(self.manager.saved_wifi("owner"), {"ssid": None})

    async def test_only_confirmed_transfer_starts_automatic_readback_once(self):
        from custom_components.qingping_esphome.errors import InstallerError
        from custom_components.qingping_esphome.relay import Session

        record, _ = self.record()
        session = Session("fixture", "owner", MAC, "4.5.8", NAME, b"firmware", "fixture-key", "fixture-pass",
                          peer=record["peer"], sent=True, sent_at=time.monotonic(), state="sending")
        record["session_id"] = session.id
        self.manager.relay.add(session)
        request = SimpleNamespace(match_info={"session_id": session.id},
                                  transport=SimpleNamespace(get_extra_info=lambda _: (session.peer, 1024)))
        final = {"type": "24", "percent": 100, "error_code": 0}
        with patch.object(self.manager, "_verify_installation", AsyncMock()) as verify:
            await self.manager.relay.report(session, final)
            self.assertFalse(self.manager.checks, "A report before the request cannot confirm this transfer")
            await self.manager.download(request)
            await self.manager.relay.report(session, {"type": "24", "percent": 99})
            self.assertFalse(self.manager.checks, "A download request or partial progress cannot start the clock")
            with self.assertRaisesRegex(InstallerError, "Wait for the firmware transfer"):
                self.manager.retry_lite("owner", MAC)
            self.assertTrue(self.manager.lite_installations("owner")["devices"][0]["transferring"])

            # The transfer can outlast its own watchdog. A late confirmation
            # still gives ESPHome the complete independent verification window.
            session.sent_at -= 181
            self.assertEqual((await self.manager.status(session.id, "owner"))["error_code"], "ota_timeout")
            await self.manager.relay.report(session, final)
            await self.manager.checks[MAC]
            await self.manager.relay.report(session, final)
            verify.assert_awaited_once_with(MAC, record, session)
            self.assertTrue(record["transfer_confirmed"])

    async def test_device_link_uses_the_matching_esphome_entry_and_mac(self):
        from homeassistant.config_entries import ConfigEntry
        from homeassistant.helpers import device_registry as dr
        from types import MappingProxyType

        record, _ = self.record()
        record.update(outcome="native_verified", ha_enrollment="created")
        registry = dr.DeviceRegistry(self.hass)
        self.hass.data[dr.DATA_REGISTRY] = registry
        await registry.async_load()
        entries = {}
        for domain in ("qingping", "esphome"):
            entry = ConfigEntry(domain=domain, title=domain, unique_id=dr.format_mac(MAC),
                                version=1, minor_version=1, data={"host": "192.168.50.8"}, options={},
                                source="user", discovery_keys=MappingProxyType({}), subentries_data=[])
            with patch.object(self.hass.config_entries, "async_setup", AsyncMock(return_value=True)):
                await self.hass.config_entries.async_add(entry)
            entries[domain] = entry
        connection = (dr.CONNECTION_NETWORK_MAC, dr.format_mac(MAC))
        registry.async_get_or_create(config_entry_id=entries["qingping"].entry_id, connections={connection})
        self.assertNotIn("device_id", self.manager.lite_installations("owner")["devices"][0])
        device = registry.async_get_or_create(config_entry_id=entries["esphome"].entry_id,
                                              connections={connection}, name="Fixture monitor")
        result = self.manager.lite_installations("owner")["devices"][0]
        self.assertEqual((result["device_id"], result["label"]), (device.id, "Fixture monitor"))
        self.assertEqual(await self.manager.enroll(SimpleNamespace(mac=MAC, peer="192.168.50.3")), "created")
