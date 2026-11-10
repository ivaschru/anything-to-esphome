"""HA SDK contracts and private update transaction guards, without hardware."""
import asyncio
import base64
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, Mock, PropertyMock, patch

HAS_HA = importlib.util.find_spec("homeassistant") is not None


@unittest.skipUnless(HAS_HA, "Optional Home Assistant SDK not installed")
class FirmwareHAContracts(unittest.IsolatedAsyncioTestCase):
    async def test_native_updater_handoff_retires_only_the_duplicate_offer(self):
        from custom_components.qingping_esphome.update import QingpingFirmwareUpdate
        from homeassistant.components.update import UpdateEntityFeature
        self.record['native_update']=True
        entity=QingpingFirmwareUpdate(self.manager,SimpleNamespace(data={'lite':self.release}),self.mac)
        self.assertEqual(entity.latest_version,entity.installed_version)
        self.assertFalse(entity.version_is_newer('3','2'))
        self.assertNotIn(UpdateEntityFeature.INSTALL,entity.supported_features)
        self.assertIs(self.manager.records[self.mac],self.record)
    async def asyncSetUp(self):
        from homeassistant.core import HomeAssistant
        from homeassistant.config_entries import ConfigEntries
        from custom_components.qingping_esphome.manager import Manager
        from custom_components.qingping_esphome.firmware_update import FirmwareUpdates, SETTINGS, SOURCES
        from custom_components.qingping_esphome.firmware_catalog import parse_catalog
        from test_firmware_updates import release
        from test_protocol import fixture
        self.temp = tempfile.TemporaryDirectory()
        self.hass = HomeAssistant(self.temp.name)
        self.hass.config_entries = ConfigEntries(self.hass, {})
        self.manager = Manager(self.hass, SimpleNamespace(data={"lan_host": "192.168.50.2", "http_port": 1887, "mqtt_port": 1886}))
        self.engine = self.manager.updates = FirmwareUpdates(self.manager, "0.1.5")
        self.mac = "001122334455"
        self.record = {
            "name": "qingping-001122334455-abcdef012", "peer": "192.168.50.9",
            "profile": "lite", "schema_version": 2, "hardware": "0001", "source_stock_version": "4.5.8", "command_consumed": True,
            "noise_key": base64.b64encode(b"x" * 32).decode(), "ota_password": "fixture-ota-password",
            "outcome": "native_verified", "firmware_version": "old-ui", "firmware_revision": 0,
            "personalization": {"ssid": "fixture-network", "wifi_password": "fixture-wifi-password",
                "name": "qingping-001122334455-abcdef012", "ap_ssid": "fixture-AP",
                "ap_password": "fixture-ap-password", "ota_password": "fixture-ota-password"},
        }
        self.manager.records[self.mac] = self.record
        self.template = fixture(b"2026.11.06-ui25-polling1\0")
        self.manifest_bytes = json.dumps({"model": "CGDN1", "format": "esp32-app-fixed-slots-v1",
            "ui": "2026.11.06-ui25-polling1", "size": len(self.template),
            "sha256": hashlib.sha256(self.template).hexdigest(),
            "slots": {k: self.template.count(v) for k, v in __import__(
                "custom_components.qingping_esphome.image", fromlist=["SLOTS"]).SLOTS.items()}}).encode()
        data = release(); row = data["releases"]["lite"]
        row["image"].update(size=len(self.template), sha256=hashlib.sha256(self.template).hexdigest())
        row["manifest"].update(size=len(self.manifest_bytes), sha256=hashlib.sha256(self.manifest_bytes).hexdigest())
        self.release = parse_catalog(data)["lite"]
        self.settings = {name: False for name in SETTINGS}
        self.settings.update({"Display brightness": 3, "Idle screen": "CO2 + temperature",
            "Idle screen delay": 30, "Heat model": "Measured", "Temperature offset": 0, "Humidity offset": 0})
        self.state = {**self.settings, "Charging": True, "Local UI version": "old-ui",
                      **{name: 400.0 if name == "CO2" else 22.0 for name in SOURCES}}
        self.client = SimpleNamespace(connected_address="192.168.50.9", disconnect=AsyncMock())
        self.info = SimpleNamespace(compilation_time="fixture-old-build")
        self.engine.connect = AsyncMock(return_value=(self.client, self.info))
        self.engine.snapshot = AsyncMock(return_value=self.state)

    async def asyncTearDown(self):
        await self.manager.stop()
        await self.hass.async_stop(force=True)
        self.temp.cleanup()

    def downloads(self):
        async def asset(hass, item):
            return self.template if item == self.release.image else self.manifest_bytes
        return patch.multiple("custom_components.qingping_esphome.firmware_update",
            fetch_catalog=AsyncMock(return_value={"lite": self.release}), fetch_asset=AsyncMock(side_effect=asset))

    async def test_private_image_keys_preserved_and_intent_durable_before_send(self):
        from custom_components.qingping_esphome.image import layout, SLOTS
        from custom_components.qingping_esphome.firmware_update import private_values
        async def upload(host, image, noise, password, progress):
            saved = await self.manager.store.async_load()
            self.assertEqual(saved[self.mac]["update_attempt"]["state"], "consumed")
            self.assertEqual((host, noise, password), (self.record["peer"], self.record["noise_key"], self.record["ota_password"]))
            layout(image)
            for marker in SLOTS.values(): self.assertNotIn(marker, image)
            for value in private_values(self.record).values():
                self.assertIn(value.encode() if isinstance(value, str) else value, image)
        verify = AsyncMock()
        with self.downloads(), patch("custom_components.qingping_esphome.firmware_update.upload_app", AsyncMock(side_effect=upload)) as send, patch.object(self.engine, "verify", verify):
            await self.engine.install(self.mac, self.release, Mock(), Mock())
        send.assert_awaited_once()
        verify.assert_awaited_once()
        self.assertEqual(self.record["update_attempt"]["state"], "acknowledged")

    async def test_missing_profile_wrong_family_usb_or_unmanaged_ui_send_nothing(self):
        from custom_components.qingping_esphome.firmware_catalog import FirmwareError
        cases = ("missing_profile", "wrong_family", "battery", "unmanaged")
        for case in cases:
            old_profile = self.record.get("personalization")
            self.record["profile"] = "lite"; self.state["Charging"] = True; self.state["Local UI version"] = "old-ui"
            if case == "missing_profile": self.record.pop("personalization")
            if case == "wrong_family": self.record["profile"] = "lite-mcu421"
            if case == "battery": self.state["Charging"] = False
            if case == "unmanaged": self.state["Local UI version"] = "private-experiment"
            with self.subTest(case=case), self.downloads(), patch("custom_components.qingping_esphome.firmware_update.upload_app", AsyncMock()) as send:
                with self.assertRaises(FirmwareError): await self.engine.install(self.mac, self.release, Mock(), Mock())
                send.assert_not_awaited()
                self.assertNotIn("update_attempt", self.record)
            self.record["personalization"] = old_profile

    async def test_journal_failure_never_opens_ota(self):
        with self.downloads(), patch.object(self.manager, "save_records", AsyncMock(side_effect=OSError("fixture disk"))), patch("custom_components.qingping_esphome.firmware_update.upload_app", AsyncMock()) as send:
            with self.assertRaises(OSError): await self.engine.install(self.mac, self.release, Mock(), Mock())
            send.assert_not_awaited()

    async def test_auto_adoption_requires_live_profile_and_uses_current_wifi_before_ota(self):
        from custom_components.qingping_esphome.firmware_catalog import FirmwareError
        self.record.update(outcome="auto_adopted",origin="device_profile_v1")
        self.manager.adoption=SimpleNamespace(refresh=AsyncMock(return_value=False),stop=AsyncMock())
        with self.downloads(), patch("custom_components.qingping_esphome.firmware_update.upload_app",AsyncMock()) as send:
            with self.assertRaisesRegex(FirmwareError,"update_device_unavailable"):
                await self.engine.install(self.mac,self.release,Mock(),Mock())
            send.assert_not_awaited();self.assertNotIn("update_attempt",self.record)
        async def refresh(mac):
            self.assertEqual(mac,self.mac)
            self.assertTrue(self.engine.lock.locked())
            # Replace the old Store row just as the profile importer does.
            fresh={**self.record,"personalization":{**self.record["personalization"],"ssid":"current-device-network"}}
            self.manager.records[mac]=fresh
            return True
        self.manager.adoption.refresh=AsyncMock(side_effect=refresh)
        async def upload(host,image,*args):
            self.assertIn(b"current-device-network",image)
            self.assertNotIn(b"fixture-network",image)
        with self.downloads(), patch("custom_components.qingping_esphome.firmware_update.upload_app",AsyncMock(side_effect=upload)) as send, patch.object(self.engine,"verify",AsyncMock()):
            await self.engine.install(self.mac,self.release,Mock(),Mock())
            send.assert_awaited_once()

    async def test_profile_refresh_detects_update_already_installed_elsewhere(self):
        from custom_components.qingping_esphome.firmware_catalog import FirmwareError
        self.record.update(outcome="auto_adopted",origin="device_profile_v1")
        async def refresh(mac):
            self.manager.records[mac]={**self.record,"firmware_version":self.release.version,
                                       "firmware_revision":self.release.revision}
            return True
        self.manager.adoption=SimpleNamespace(refresh=AsyncMock(side_effect=refresh),stop=AsyncMock())
        with self.downloads(), patch("custom_components.qingping_esphome.firmware_update.upload_app",AsyncMock()) as send:
            with self.assertRaisesRegex(FirmwareError,"update_not_applicable"):
                await self.engine.install(self.mac,self.release,Mock(),Mock())
            send.assert_not_awaited()

    async def test_ambiguous_send_restart_and_second_action_only_reconcile(self):
        from custom_components.qingping_esphome.firmware_catalog import FirmwareError
        from custom_components.qingping_esphome.firmware_update import FirmwareUpdates
        with self.downloads(), patch("custom_components.qingping_esphome.firmware_update.upload_app", AsyncMock(side_effect=FirmwareError("ota_transfer_uncertain"))) as send:
            with self.assertRaises(FirmwareError): await self.engine.install(self.mac, self.release, Mock(), Mock())
            self.assertEqual(self.record["update_attempt"]["state"], "needs_review")
            # Restart reads the same private journal and cannot manufacture a
            # fresh intent, even when update.install is invoked again.
            self.manager.records = await self.manager.store.async_load()
            fresh = FirmwareUpdates(self.manager, "0.1.5")
            fresh.verify = AsyncMock()
            await fresh.install(self.mac, self.release, Mock(), Mock())
            fresh.verify.assert_awaited_once()
            send.assert_awaited_once()

    async def test_legacy_profile_is_explicit_retains_keys_and_changes_no_device(self):
        from custom_components.qingping_esphome.firmware_catalog import FirmwareError
        from custom_components.qingping_esphome.firmware_update import private_values
        for key in ("personalization", "schema_version", "profile", "firmware_version"):
            self.record.pop(key)
        fields = {"ssid": "new-private-network", "wifi_password": "private-new-wifi",
                  "ap_ssid": "Chosen AP", "ap_password": "private-new-ap", "confirm_profile": False}
        self.state["Local UI version"] = "2026.11.06-ui25-polling1"
        with self.assertRaises(FirmwareError): await self.engine.prepare_legacy(self.mac, fields)
        self.engine.connect.assert_not_awaited()
        fields["confirm_profile"] = True
        with patch("custom_components.qingping_esphome.firmware_update.upload_app", AsyncMock()) as send:
            await self.engine.prepare_legacy(self.mac, fields)
            send.assert_not_awaited()
        upgraded = self.manager.records[self.mac]
        self.assertEqual(upgraded["noise_key"], self.record["noise_key"])
        self.assertEqual(upgraded["ota_password"], self.record["ota_password"])
        self.assertEqual(private_values(upgraded)["ap_password"], fields["ap_password"])

    async def test_entity_uses_physical_mac_and_exposes_no_private_profile(self):
        from custom_components.qingping_esphome.update import QingpingFirmwareUpdate
        from homeassistant.components.update import UpdateDeviceClass, UpdateEntityFeature
        from homeassistant.helpers.device_registry import CONNECTION_NETWORK_MAC
        coordinator = SimpleNamespace(data={"lite": self.release})
        entity = QingpingFirmwareUpdate(self.manager, coordinator, self.mac)
        self.assertEqual(entity.device_class, UpdateDeviceClass.FIRMWARE)
        self.assertIn((CONNECTION_NETWORK_MAC, "00:11:22:33:44:55"), entity.device_info["connections"])
        self.assertTrue(entity.supported_features & UpdateEntityFeature.INSTALL)
        self.assertTrue(entity.version_is_newer(self.release.version, "old-ui"))
        self.assertFalse(entity.version_is_newer(self.release.version, self.release.version))
        for secret in self.record["personalization"].values():
            self.assertNotIn(secret, str(entity.extra_state_attributes))
        self.record.pop("personalization"); entity._refresh()
        self.assertFalse(entity.supported_features & UpdateEntityFeature.INSTALL)
        self.assertEqual(entity.extra_state_attributes["update_readiness"], "profile_or_backend_required")

    async def test_short_versions_preserve_build_identity_and_ota_sequence(self):
        from dataclasses import replace
        from custom_components.qingping_esphome.update import QingpingFirmwareUpdate
        release=replace(self.release,public_version=2)
        self.record["public_version"]=1
        entity=QingpingFirmwareUpdate(self.manager,SimpleNamespace(data={"lite":release}),self.mac)
        self.assertEqual(entity.installed_version,"1")
        self.assertEqual(entity.latest_version,"2")
        self.assertTrue(entity.version_is_newer("2","1"))
        self.record["firmware_version"]=release.version
        self.assertFalse(entity.version_is_newer("2","1"),"A label must not manufacture an OTA")
        self.record["firmware_version"]="older-build"
        self.record["firmware_revision"]=release.revision+1
        self.assertFalse(entity.version_is_newer("2","1"),"Public numbering cannot reset revision ordering")

    async def test_readback_rejects_changed_settings_and_requires_repeated_physical_sources(self):
        from aioesphomeapi import SensorState
        from custom_components.qingping_esphome.firmware_catalog import FirmwareError
        clock = [0.0]
        self.engine._now = lambda: clock[0]
        self.state["Local UI version"] = self.release.version
        callback = [None]
        self.client.list_entities_services = AsyncMock(return_value=([
            SimpleNamespace(key=index, name=name) for index, name in enumerate(sorted({"CO2", "Temperature (raw)", "Humidity (raw)"}))], []))
        self.client.subscribe_states = lambda fn: callback.__setitem__(0, fn)
        async def tick(seconds):
            clock[0] += seconds
            if callback[0] and int(clock[0]) % 60 == 0:
                for index in range(3): callback[0](SensorState(key=index, state=420.0 + index))
        self.engine._sleep = tick
        attempt = {"version": self.release.version, "revision": 1, "template_sha256": "a" * 64,
                   "image_sha256": "b" * 64, "settings_before": dict(self.settings), "state": "acknowledged"}
        self.state["Display brightness"] = 6
        with self.assertRaisesRegex(FirmwareError, "update_settings_changed"):
            await self.engine.verify(self.mac, self.record, attempt)
        self.state["Display brightness"] = 3
        await self.engine.verify(self.mac, self.record, attempt)
        self.assertGreaterEqual(clock[0], 180)
        self.assertEqual(attempt["state"], "verified")
        self.assertEqual(self.record["firmware_revision"], 1)

    async def test_native_ha_entity_state_and_real_install_service_context(self):
        # A device imported from another HA receives the same native entity
        # and administrator-only service boundary as an installer-owned one.
        self.record["outcome"] = "auto_adopted"
        from dataclasses import replace
        self.release = replace(self.release,public_version=1)
        """Exercise HA's own entity/service pipeline, not a direct method call."""
        import logging
        from datetime import timedelta
        from types import MappingProxyType
        from homeassistant.config_entries import ConfigEntry
        from homeassistant.auth import auth_manager_from_config
        from homeassistant.components.update.const import DATA_COMPONENT
        from homeassistant.components.update.services import async_setup_services
        from homeassistant.core import Context
        from homeassistant.exceptions import HomeAssistantError
        from homeassistant.helpers.entity_component import EntityComponent
        from homeassistant.helpers.entity_platform import EntityPlatform
        from homeassistant.helpers import device_registry as dr, entity_registry as er
        from custom_components.qingping_esphome.update import QingpingFirmwareUpdate
        from custom_components.qingping_esphome import update as update_module
        self.hass.data[dr.DATA_REGISTRY] = dr.DeviceRegistry(self.hass)
        self.hass.data[er.DATA_REGISTRY] = er.EntityRegistry(self.hass)
        await self.hass.config_entries.async_initialize()
        await asyncio.wait_for(self.hass.data[dr.DATA_REGISTRY].async_load(), 5)
        await asyncio.wait_for(self.hass.data[er.DATA_REGISTRY].async_load(), 5)
        self.hass.auth = await asyncio.wait_for(auth_manager_from_config(self.hass, [], []), 5)
        admin = await asyncio.wait_for(self.hass.auth.async_create_user("Fixture administrator", group_ids=["system-admin"]), 5)
        regular = await asyncio.wait_for(self.hass.auth.async_create_user("Fixture non-admin", group_ids=["system-users"]), 5)
        component = EntityComponent(logging.getLogger(__name__), "update", self.hass)
        self.hass.data[DATA_COMPONENT] = component
        async_setup_services(self.hass)
        coordinator = SimpleNamespace(data={"lite": self.release}, async_add_listener=lambda _: lambda: None)
        entity = QingpingFirmwareUpdate(self.manager, coordinator, self.mac)
        entry = ConfigEntry(version=1, minor_version=1, domain="qingping_esphome",
            title="Fixture installer", data={}, options={}, source="user",
            unique_id="qingping_esphome", discovery_keys=MappingProxyType({}), subentries_data=[])
        with patch.object(self.hass.config_entries, "async_setup", AsyncMock(return_value=True)):
            await self.hass.config_entries.async_add(entry)
        # Use the common EntityPlatform constructor directly. The component's
        # private factory changed both its arguments and registration behavior
        # between HA 2026.10 and 2026.11; that is fixture setup, not updater code.
        platform = EntityPlatform(hass=self.hass, logger=logging.getLogger(__name__),
            domain="update", platform_name="qingping_esphome", platform=update_module,
            scan_interval=timedelta(minutes=15), entity_namespace=None)
        platform.config_entry = entry
        platform.async_prepare()
        component._platforms[entry.entry_id] = platform
        # Translations are a separate contract below. This fixture exercises
        # HA's real entity/device registry, state and admin service pipeline.
        entity._attr_name = "Fixture firmware"
        await asyncio.wait_for(platform.async_add_entities([entity]), 5)
        state = self.hass.states.get(entity.entity_id)
        self.assertEqual(state.state, "on")
        self.assertEqual(state.attributes["device_class"], "firmware")
        self.assertEqual(state.attributes["latest_version"], self.release.display_version)
        self.engine.install = AsyncMock()
        for context in (Context(user_id=regular.id), Context()):
            with self.assertRaises(HomeAssistantError):
                await asyncio.wait_for(self.hass.services.async_call("update", "install", {"entity_id": entity.entity_id},
                                                    blocking=True, context=context), 5)
        self.engine.install.assert_not_awaited()
        await asyncio.wait_for(self.hass.services.async_call("update", "install", {"entity_id": entity.entity_id},
                                            blocking=True, context=Context(user_id=admin.id)), 5)
        self.engine.install.assert_awaited_once()
        self.assertFalse(self.hass.states.get(entity.entity_id).attributes["in_progress"])
        await component._async_reset()

    async def test_legacy_options_keep_credentials_out_of_config_entry_and_use_password_fields(self):
        from custom_components.qingping_esphome.config_flow import OptionsFlow
        for key in ("personalization", "schema_version", "profile", "firmware_version"):
            self.record.pop(key)
        self.state["Local UI version"] = "2026.11.06-ui25-polling1"
        self.hass.data["qingping_esphome"] = self.manager
        flow = OptionsFlow(); flow.hass = self.hass
        options = {"show_sidebar": False, "http_port": 1901}
        fields = {"ssid": "fixture-network", "wifi_password": "fixture-private-wifi",
                  "ap_ssid": "fixture-AP", "ap_password": "fixture-private-ap", "confirm_profile": True}
        with patch.object(OptionsFlow, "config_entry", PropertyMock(return_value=SimpleNamespace(options=options))):
            form = await flow.async_step_firmware_updates({"device": self.mac})
            self.assertEqual(form["step_id"], "firmware_profile")
            selectors = {key.schema: validator for key, validator in form["data_schema"].schema.items()}
            self.assertEqual(selectors["wifi_password"].config["type"], "password")
            result = await flow.async_step_firmware_profile(fields)
            self.assertEqual(result["data"], options)
            self.assertNotIn(fields["wifi_password"], str(result))

    async def test_bad_manifest_or_changed_catalog_never_creates_an_attempt(self):
        from custom_components.qingping_esphome.firmware_catalog import FirmwareError
        with self.downloads(), patch("custom_components.qingping_esphome.firmware_update.upload_app", AsyncMock()) as send:
            old = self.manifest_bytes
            self.manifest_bytes = old.replace(b"CGDN1", b"OTHER")
            with self.assertRaisesRegex(FirmwareError, "firmware_asset_mismatch"):
                await self.engine.install(self.mac, self.release, Mock(), Mock())
            self.manifest_bytes = old
            with patch("custom_components.qingping_esphome.firmware_update.fetch_catalog", AsyncMock(return_value={})):
                with self.assertRaisesRegex(FirmwareError, "update_catalog_changed"):
                    await self.engine.install(self.mac, self.release, Mock(), Mock())
            self.assertNotIn("update_attempt", self.record)
            send.assert_not_awaited()

    async def test_concurrent_operation_refuses_and_unload_cancels_owned_update(self):
        from custom_components.qingping_esphome.firmware_catalog import FirmwareError
        entered = asyncio.Event()
        async def blocked(*args):
            entered.set()
            await asyncio.Future()
        with self.downloads(), patch("custom_components.qingping_esphome.firmware_update.upload_app", blocked):
            running = asyncio.create_task(self.engine.install(self.mac, self.release, Mock(), Mock()))
            await entered.wait()
            with self.assertRaisesRegex(FirmwareError, "firmware_update_busy"):
                await self.engine.install(self.mac, self.release, Mock(), Mock())
            await self.engine.stop()
            with self.assertRaises(asyncio.CancelledError): await running
        saved = await self.manager.store.async_load()
        self.assertEqual(saved[self.mac]["update_attempt"]["state"], "needs_review")

    async def test_platform_keeps_installer_available_without_catalog_and_adds_new_records_once(self):
        from custom_components.qingping_esphome.update import async_setup_entry
        self.hass.data["qingping_esphome"] = self.manager
        coordinator = SimpleNamespace(data=None, async_refresh=AsyncMock())
        unload = []
        entry = SimpleNamespace(async_on_unload=unload.append)
        add = Mock()
        with patch("custom_components.qingping_esphome.update.CatalogCoordinator", return_value=coordinator):
            await async_setup_entry(self.hass, entry, add)
        self.assertEqual(add.call_count, 1)
        entity = add.call_args.args[0][0]
        self.assertEqual(entity.installed_version, "old-ui")
        self.assertIsNone(entity.latest_version)
        self.assertFalse(entity.supported_features & 1)  # INSTALL
        await self.manager.save_records()
        self.assertEqual(add.call_count, 1)
        self.manager.records["001122334466"] = {**self.record,"outcome":"auto_adopted"}
        await self.manager.save_records()
        self.assertEqual(add.call_count, 2)
        self.assertEqual(len(add.call_args.args[0]), 1)
        unload[0]()
        self.assertFalse(self.manager.record_listeners)

    async def test_setup_platform_failure_closes_owned_manager(self):
        from custom_components.qingping_esphome import async_setup_entry
        fake = SimpleNamespace(hass=self.hass, start=AsyncMock(), stop=AsyncMock())
        with patch("custom_components.qingping_esphome.Manager", return_value=fake), patch(
                "custom_components.qingping_esphome._async_setup_loaded_entry",
                AsyncMock(side_effect=RuntimeError("fixture platform failure"))):
            with self.assertRaisesRegex(RuntimeError, "fixture platform failure"):
                await async_setup_entry(self.hass, SimpleNamespace())
        fake.stop.assert_awaited_once()
        self.assertFalse(fake.sonoff.active)
        self.assertNotIn("qingping_esphome", self.hass.data)


if __name__ == "__main__": unittest.main()

@unittest.skipUnless(HAS_HA, "Optional Home Assistant SDK not installed")
class SnapshotGenerations(unittest.IsolatedAsyncioTestCase):
    async def test_old_controls_and_real_time_state_are_preserved(self):
        from aioesphomeapi import SwitchState,NumberState,SelectState,SensorState,TextSensorState,TimeState
        from custom_components.qingping_esphome.firmware_update import FirmwareUpdates,SETTINGS,SOURCES
        names=sorted((SETTINGS-{'Display design','Screen transitions'})|SOURCES|{'Charging','Local UI version'})
        entities=[SimpleNamespace(key=i,name=name) for i,name in enumerate(names)]
        states=[]
        for entity in entities:
            key,name=entity.key,entity.name
            if name in ('Night mode start','Night mode end'):state=TimeState(key=key,hour=22,minute=35,second=0)
            elif name=='Local UI version':state=TextSensorState(key=key,state='old-public-v1')
            elif name in SOURCES:state=SensorState(key=key,state=425.0)
            else:state=NumberState(key=key,state=1.0)
            states.append(state)
        client=SimpleNamespace(list_entities_services=AsyncMock(return_value=(entities,[])),subscribe_states=lambda cb:[cb(s) for s in states])
        engine=FirmwareUpdates(SimpleNamespace(hass=None), '0.2.2')
        value=await engine.snapshot(client)
        self.assertEqual(value['Night mode start'],[22,35,0])
        self.assertNotIn('Display design',value)
        self.assertIn('PM sensor',value)
        # A partial inventory must not masquerade as an old supported build.
        client.list_entities_services=AsyncMock(return_value=(entities[:2],[]))
        from custom_components.qingping_esphome.firmware_catalog import FirmwareError
        with self.assertRaises(FirmwareError):await engine.snapshot(client)

    async def test_same_plugin_exposes_next_firmware_in_standard_ha_entity(self):
        from custom_components.qingping_esphome.firmware_catalog import parse_catalog
        from custom_components.qingping_esphome.firmware_update import FirmwareUpdates
        from custom_components.qingping_esphome.update import QingpingFirmwareUpdate,CatalogCoordinator
        from homeassistant.components.update import UpdateEntityFeature
        from test_firmware_updates import release
        data=release();row=data['releases']['lite']
        row.update(public_version=3,revision=4,version='quiet-three',minimum_integration='0.2.2',
                   release_url='https://github.com/ivaschru/qingping-esphome/tree/firmware-lite-v3')
        for key,ext in (('image','bin'),('manifest','json')):
            row[key]['url']='https://raw.githubusercontent.com/ivaschru/qingping-esphome/firmware-lite-v3/lite-template.'+ext
        next_release=parse_catalog(data)['lite']
        with tempfile.TemporaryDirectory() as folder:
            from homeassistant.core import HomeAssistant
            from homeassistant.config_entries import ConfigEntries
            from custom_components.qingping_esphome.manager import Manager
            hass=HomeAssistant(folder);hass.config_entries=ConfigEntries(hass,{})
            manager=Manager(hass,SimpleNamespace(data={'lan_host':'192.168.50.2','http_port':1887,'mqtt_port':1886}))
            manager.updates=FirmwareUpdates(manager,'0.2.2')
            key='001122334455'
            manager.records[key]={'profile':'lite','hardware':'0001','source_stock_version':'4.5.8','public_version':2,'firmware_version':'quiet-two','firmware_revision':3,'name':'fixture-only','ota_password':'fixture-only',
                'noise_key':base64.b64encode(b'x'*32).decode(),'personalization':{k:'fixture-only' for k in ('ssid','wifi_password','name','ap_ssid','ap_password','ota_password')}}
            try:
                coordinator=SimpleNamespace(data=None)
                with patch('custom_components.qingping_esphome.update.fetch_catalog',AsyncMock(return_value={'lite':next_release})),patch('custom_components.qingping_esphome.firmware_update.APIClient') as native:
                    coordinator.data=await CatalogCoordinator._async_update_data(SimpleNamespace(hass=hass))
                    entity=QingpingFirmwareUpdate(manager,coordinator,key)
                    self.assertEqual(entity.installed_version,'2');self.assertEqual(entity.latest_version,'3')
                    self.assertTrue(entity.version_is_newer('3','2'))
                    self.assertTrue(entity.supported_features & UpdateEntityFeature.INSTALL)
                    self.assertEqual(manager.updates.integration_version,'0.2.2')
                    native.assert_not_called()
            finally:
                await manager.stop();await hass.async_stop(force=True)


@unittest.skipUnless(HAS_HA, 'HA SDK required')
class Firmware434Routing(unittest.IsolatedAsyncioTestCase):
    async def test_standard_update_selects_434_one_without_relabelling_old_two(self):
        from homeassistant.core import HomeAssistant
        from homeassistant.components.update import UpdateEntityFeature
        from custom_components.qingping_esphome.update import QingpingFirmwareUpdate
        from custom_components.qingping_esphome.firmware_update import FirmwareUpdates,private_values,validate_template
        from custom_components.qingping_esphome.firmware_catalog import parse_catalog
        import test_firmware434 as own
        old=own.channel.next_catalog('lite',*own.channel_tests.pair())
        meta,binary,manifest=own.pair()
        index=own.channel.next_catalog('lite-434',meta,binary,manifest,old)
        releases=parse_catalog(index)
        with tempfile.TemporaryDirectory() as directory:
            hass=HomeAssistant(directory)
            mac='001122334455'
            record={'profile':'lite','hardware':'0001','source_stock_version':'4.3.4',
                    'firmware_version':'quiet-two','firmware_revision':3,'public_version':2,
                    'name':'fixture-only','ota_password':'fixture-only',
                    'noise_key':base64.b64encode(b'K'*32).decode(),
                    'personalization':{k:'fixture-only' for k in ('ssid','wifi_password','name','ap_ssid','ap_password','ota_password')}}
            manager=SimpleNamespace(hass=hass,records={mac:record})
            manager.updates=FirmwareUpdates(manager,'0.2.9')
            try:
                entity=QingpingFirmwareUpdate(manager,SimpleNamespace(data=releases),mac)
                self.assertEqual(entity.installed_version,'2')
                self.assertEqual(entity.latest_version,'1')
                self.assertTrue(entity.version_is_newer('1','2'))
                self.assertEqual(entity.release.profile,'lite-434')
                self.assertTrue(entity.supported_features & UpdateEntityFeature.INSTALL)
                self.assertEqual(private_values(record)['source_stock_version'],'4.3.4')
                validate_template(binary,manifest,entity.release)
                record['source_stock_version']='4.5.8'
                self.assertEqual(entity.release.profile,'lite')
                record['profile']='lite-434'
                with self.assertRaises(ValueError):private_values(record)
            finally:
                await manager.updates.stop();await hass.async_stop(force=True)
