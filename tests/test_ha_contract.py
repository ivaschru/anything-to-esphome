"""Optional checks against a real HA SDK, without running HA or any device.

Install homeassistant==2026.10.2 to enable these tests. The normal pure checks
remain usable with stdlib only. Private test state lives in a temporary folder.
"""
import importlib.util
import hashlib
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, PropertyMock, patch

AVAILABLE = importlib.util.find_spec("homeassistant") is not None


@unittest.skipUnless(AVAILABLE, "Optional Home Assistant SDK not installed")
class HAContractTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        from homeassistant.core import HomeAssistant
        from custom_components.qingping_esphome.manager import Manager
        self.temp = tempfile.TemporaryDirectory()
        self.hass = HomeAssistant(self.temp.name)
        from homeassistant.config_entries import ConfigEntries
        self.hass.config_entries = ConfigEntries(self.hass, {})
        self.entry = SimpleNamespace(data={"lan_host": "192.168.50.2", "http_port": 1887, "mqtt_port": 1886})
        self.manager = Manager(self.hass, self.entry)

    async def asyncTearDown(self):
        await self.manager.stop()
        await self.hass.async_stop(force=True)
        self.temp.cleanup()

    async def test_catalog_reads_each_lite_version_from_its_own_bundled_metadata(self):
        root = Path(self.temp.name)
        for stem, profile, stock, policy, version in (
            ("lite-template", "lite", "4.5.8", "quiet-scd4x-window-v1", 17),
            ("lite-434-template", "lite-434", "4.3.4", "lite-434-polling-only-v1", 42),
        ):
            (root / f"{stem}.json").write_text(json.dumps({
                "profile": profile, "model": "CGDN1", "source_stock_version": stock,
                "hardware": "0001", "pm_policy": policy, "format": "esp32-app-fixed-slots-v1",
                "ui": "fixture", "public_version": version,
            }))
            (root / f"{stem}.bin").touch()

        with patch("custom_components.qingping_esphome.manager.TEMPLATE_ROOT", root):
            models = {profile["id"]: profile for profile in (await self.manager.catalog())["models"]}
            self.assertEqual(models["lite"]["public_version"], 17)
            self.assertEqual(models["lite-434"]["public_version"], 42)
            self.assertNotIn("public_version", models["lite-mcu421"])
            (root / "lite-434-template.bin").unlink()
            models = {profile["id"]: profile for profile in (await self.manager.catalog())["models"]}
            self.assertEqual(models["lite"]["public_version"], 17)
            self.assertEqual(models["lite-434"]["template_error"], "template_missing")
            self.assertNotIn("public_version", models["lite-434"])

    async def test_personalization_private_journal_and_restart_fence(self):
        from custom_components.qingping_esphome.manager import Manager
        from test_protocol import fixture
        root = Path(self.temp.name) / "template"
        root.mkdir()
        template = fixture()
        (root / "lite-template.bin").write_bytes(template)
        (root / "lite-template.json").write_text(json.dumps({"sha256": hashlib.sha256(template).hexdigest(),
            "model": "CGDN1", "profile": "lite", "source_stock_version": "4.5.8", "hardware": "0001",
            "pm_policy": "quiet-scd4x-window-v1", "format": "esp32-app-fixed-slots-v1", "size": len(template), "ui": "fixture", "public_version": 1}))
        data = {"profile": "lite", "model": "CGDN1", "stock_version": "4.5.8", "hardware": "0001",
                "mac": "00:11:22:33:44:55", "usb": True,
                "ssid": "test-network", "wifi_password": "fixture-wifi-password"}
        with patch("custom_components.qingping_esphome.manager.TEMPLATE_ROOT", root):
            result = await self.manager.create("test-owner", data)
        session = self.manager.get(result["id"], "test-owner")
        self.assertEqual(len(session.name), 31)
        self.assertNotIn("noise_key", session.public())
        with self.assertRaises(ValueError): self.manager.get(session.id, "another-owner")
        await self.manager.consume_intent(session)
        # A fresh Manager gets the persisted fence, not the in-memory session.
        fresh = Manager(self.hass, self.entry)
        fresh.records = await fresh.store.async_load()
        self.assertTrue(fresh.records[session.mac]["command_consumed"])
        # Firmware updates need the original private Wi-Fi/AP slots. They now
        # live only in the private atomic HA Store, never a public session.
        self.assertEqual(fresh.records[session.mac]["personalization"]["wifi_password"], "fixture-wifi-password")
        self.assertNotIn("fixture-wifi-password", str(session.public()))
        self.assertNotIn("fixture-wifi-password", repr(session))
        journal = Path(self.temp.name) / ".storage/qingping_esphome.installations"
        self.assertEqual(journal.stat().st_mode & 0o777, 0o600)
        with self.assertRaises(ValueError): await fresh.create("test-owner", data)

    async def test_download_checks_actual_tcp_peer_and_sent_intent(self):
        from aiohttp import web
        from custom_components.qingping_esphome.relay import Session
        session = Session("fixture", "owner", "001122334455", "4.5.8", "name", b"private-image", "key", "password")
        session.peer = "192.168.50.3"
        self.manager.relay.add(session)
        request = SimpleNamespace(match_info={"session_id": "fixture"},
                                  transport=SimpleNamespace(get_extra_info=lambda _: ("192.168.50.3", 40000)))
        with self.assertRaises(web.HTTPNotFound): await self.manager.download(request)
        session.sent = True
        wrong_peer = SimpleNamespace(match_info=request.match_info,
                                     transport=SimpleNamespace(get_extra_info=lambda _: ("192.168.50.4", 40000)))
        with self.assertRaises(web.HTTPNotFound): await self.manager.download(wrong_peer)
        response = await self.manager.download(request)
        self.assertEqual(response.body, b"private-image")
        self.assertEqual(response.headers["Cache-Control"], "no-store")

    async def test_normal_setup_creates_entry_without_technical_questions(self):
        from custom_components.qingping_esphome.config_flow import ConfigFlow
        flow = ConfigFlow()
        flow.hass = self.hass
        with patch.object(flow, "async_set_unique_id", AsyncMock()), \
             patch.object(flow, "_abort_if_unique_id_configured"), \
             patch("custom_components.qingping_esphome.network_setup.network.async_get_source_ip", AsyncMock(return_value="192.168.50.2")):
            result = await flow.async_step_user()
        self.assertEqual(result["type"], "create_entry")
        self.assertEqual(result["data"], {"lan_host": "192.168.50.2", "http_port": 1887,
                                          "mqtt_port": 1886, "automatic_network": True})

    async def test_ambiguous_network_falls_back_to_only_one_required_field(self):
        from custom_components.qingping_esphome.config_flow import ConfigFlow
        flow = ConfigFlow()
        flow.hass = self.hass
        adapters = [{"enabled": True, "ipv4": [{"address": "192.168.50.2"}, {"address": "10.20.0.2"}]}]
        with patch.object(flow, "async_set_unique_id", AsyncMock()), \
             patch.object(flow, "_abort_if_unique_id_configured"), \
             patch("custom_components.qingping_esphome.network_setup.network.async_get_source_ip", AsyncMock(return_value="::1")), \
             patch("custom_components.qingping_esphome.network_setup.network.async_get_adapters", AsyncMock(return_value=adapters)):
            result = await flow.async_step_user()
        self.assertEqual(result["type"], "form")
        self.assertEqual(result["step_id"], "manual")
        self.assertEqual(list(result["data_schema"].schema), ["lan_host"])
        invalid = await flow.async_step_manual({"lan_host": "8.8.8.8"})
        self.assertEqual(invalid["errors"], {"lan_host": "invalid_lan_host"})
        valid = await flow.async_step_manual({"lan_host": "192.168.50.2"})
        self.assertFalse(valid["data"]["automatic_network"])

    async def test_single_enabled_lan_address_fallback(self):
        from custom_components.qingping_esphome.network_setup import async_detect_lan_host
        adapters = [{"enabled": False, "ipv4": [{"address": "10.20.0.1"}]},
                    {"enabled": True, "ipv4": [{"address": "192.168.50.2"}, {"address": "127.0.0.1"}]}]
        with patch("custom_components.qingping_esphome.network_setup.network.async_get_source_ip", AsyncMock(return_value="::1")), \
             patch("custom_components.qingping_esphome.network_setup.network.async_get_adapters", AsyncMock(return_value=adapters)):
            self.assertEqual(await async_detect_lan_host(self.hass), "192.168.50.2")

    async def test_interface_options_preserve_network_and_survive_network_changes(self):
        from custom_components.qingping_esphome.config_flow import OptionsFlow
        flow = OptionsFlow(); flow.hass = self.hass
        entry = SimpleNamespace(data=self.entry.data, options={"http_port": 1901, "mqtt_port": 1902})
        with patch.object(OptionsFlow, "config_entry", PropertyMock(return_value=entry)):
            result = await flow.async_step_interface({"show_sidebar": False})
            self.assertEqual(result["data"], {**entry.options, "show_sidebar": False})
            entry.options = result["data"]
            with patch("custom_components.qingping_esphome.config_flow.async_detect_lan_host", AsyncMock(return_value="192.168.50.2")):
                automatic = await flow.async_step_automatic()
            self.assertFalse(automatic["data"]["show_sidebar"])
            manual = await flow.async_step_manual({"lan_host": "192.168.50.2", "http_port": 1911, "mqtt_port": 1912})
            self.assertFalse(manual["data"]["show_sidebar"])

    async def test_sidebar_update_preserves_registered_route_admin_gate_and_manager(self):
        from aiohttp.test_utils import make_mocked_request
        from homeassistant.components import frontend
        from custom_components.qingping_esphome import _async_setup_loaded_entry, async_reload_entry, async_unload_entry
        from custom_components.qingping_esphome.manager import DOMAIN
        route = "anything-to-esphome"
        self.hass.http = SimpleNamespace(async_register_static_paths=AsyncMock(), register_view=lambda _view: None)
        self.hass.data[DOMAIN] = self.manager
        self.manager.monitor1 = SimpleNamespace(stop=AsyncMock())
        self.manager.sonoff = SimpleNamespace(stop=AsyncMock())
        entry = SimpleNamespace(entry_id="fixture", data=self.entry.data, options={},
                                async_on_unload=lambda _callback: None, add_update_listener=lambda _callback: None)
        with patch("custom_components.qingping_esphome.register_installer_device"), \
             patch("custom_components.qingping_esphome.register_ws"), \
             patch("custom_components.qingping_esphome.firmware_update.FirmwareUpdates", autospec=True), \
             patch("custom_components.qingping_esphome.auto_adoption.AutoAdoption", autospec=True), \
             patch.object(self.hass.config_entries, "async_forward_entry_setups", AsyncMock()):
            await _async_setup_loaded_entry(self.hass, entry, self.manager)
        panels = self.hass.data[frontend.DATA_PANELS]
        original = panels[route].config
        self.assertEqual(set(panels), {route})
        self.assertTrue(panels[route].show_in_sidebar)
        manifest_path = Path(__file__).resolve().parents[1] / "custom_components" / DOMAIN / "manifest.json"
        version = json.loads(manifest_path.read_text())["version"]
        legacy_static = f"/api/{DOMAIN}/static"
        panel_static = f"{legacy_static}-{version}"
        self.assertEqual(original["_panel_custom"]["module_url"], f"{panel_static}/panel.js")
        self.hass.http.async_register_static_paths.assert_awaited_once()
        static_paths = self.hass.http.async_register_static_paths.await_args.args[0]
        self.assertEqual({path.url_path for path in static_paths}, {legacy_static, panel_static})
        self.assertTrue(all(Path(path.path, "panel.js").is_file() for path in static_paths))
        entry.options = {"show_sidebar": False}
        with patch.object(self.hass.config_entries, "async_reload", AsyncMock()) as reload:
            await async_reload_entry(self.hass, entry)
            reload.assert_not_called()
            panel = panels[route]
            self.assertFalse(panel.show_in_sidebar)
            self.assertIsNone(panel.sidebar_title)
            self.assertTrue(panel.require_admin)
            self.assertIs(panel.config, original)
            self.assertIs(self.hass.data[DOMAIN], self.manager)
            index = frontend.IndexView(None, self.hass)
            match, _ = await index.resolve(make_mocked_request("GET", f"/{route}"))
            self.assertIsNotNone(match)
            match, _ = await index.resolve(make_mocked_request("GET", "/qingping_esphome"))
            self.assertIsNone(match)
            entry.options = {"show_sidebar": True}
            await async_reload_entry(self.hass, entry)
            self.assertTrue(panels[route].show_in_sidebar)
            entry.options = {"http_port": 1991}
            await async_reload_entry(self.hass, entry)
            reload.assert_awaited_once_with("fixture")
        with patch.object(self.hass.config_entries, "async_unload_platforms", AsyncMock(return_value=True)):
            self.assertTrue(await async_unload_entry(self.hass, entry))
        self.assertEqual(panels, {})

        # A partial setup removes our route. A collision leaves the existing
        # panel under that URL in place.
        with patch("custom_components.qingping_esphome.register_installer_device", side_effect=RuntimeError):
            with self.assertRaises(RuntimeError):
                await _async_setup_loaded_entry(self.hass, entry, self.manager)
        self.assertEqual(panels, {})
        frontend.async_register_built_in_panel(self.hass, "other", frontend_url_path=route)
        with self.assertRaises(ValueError):
            await _async_setup_loaded_entry(self.hass, entry, self.manager)
        self.assertEqual(panels[route].component_name, "other")

    async def test_service_device_internal_link_and_idempotency(self):
        from types import MappingProxyType
        from homeassistant.config_entries import ConfigEntry
        from homeassistant.helpers import device_registry as dr
        from custom_components.qingping_esphome import register_installer_device
        entry = ConfigEntry(version=1, minor_version=1, domain="qingping_esphome",
            title="Qingping ESPHome", data=self.entry.data, options={}, source="user",
            unique_id="qingping_esphome", discovery_keys=MappingProxyType({}), subentries_data=[])
        with patch.object(self.hass.config_entries, "async_setup", AsyncMock(return_value=True)):
            await self.hass.config_entries.async_add(entry)
        registry = dr.DeviceRegistry(self.hass)
        self.hass.data[dr.DATA_REGISTRY] = registry
        await registry.async_load()
        legacy = registry.async_get_or_create(config_entry_id=entry.entry_id,
            identifiers={("qingping_esphome", "installer")}, entry_type=dr.DeviceEntryType.SERVICE,
            configuration_url="homeassistant://qingping_esphome")
        first = register_installer_device(self.hass, entry)
        again = register_installer_device(self.hass, entry)
        self.assertEqual(first.id, legacy.id)
        self.assertEqual(first.id, again.id)
        self.assertEqual(first.entry_type, dr.DeviceEntryType.SERVICE)
        self.assertEqual(first.configuration_url, "homeassistant://anything-to-esphome")
        self.assertEqual(first.identifiers, {("qingping_esphome", "installer")})
        self.assertEqual(first.connections, set())

    async def test_manual_options_preserve_old_values_and_reject_port_collision(self):
        from custom_components.qingping_esphome.config_flow import OptionsFlow
        flow = OptionsFlow()
        flow.hass = self.hass
        entry = SimpleNamespace(data={"lan_host": "192.168.50.2", "http_port": 1901, "mqtt_port": 1902}, options={})
        with patch.object(OptionsFlow, "config_entry", PropertyMock(return_value=entry)):
            form = await flow.async_step_manual()
            self.assertEqual(form["data_schema"]({}), entry.data)
            invalid = await flow.async_step_manual({"lan_host": "192.168.50.2", "http_port": 1901, "mqtt_port": 1901})
            self.assertEqual(invalid["errors"]["base"], "ports_must_differ")
            valid = await flow.async_step_manual(entry.data)
            self.assertEqual(valid["data"], {**entry.data, "automatic_network": False})


if __name__ == "__main__": unittest.main()
