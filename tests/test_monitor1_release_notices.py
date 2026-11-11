"""Monitor 1 release discovery through the standard HA update entity."""
import importlib.util
import json
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, Mock, patch

from test_firmware_updates import catalog, release


def source_release(profile, version, co2_type):
    repo = "ivaschru/qingping-esphome"
    tag = f"firmware-{profile}-v{version}"
    commit = "1" * 40
    return {
        "format": "qingping-monitor1-runtime-source-v1",
        "profile": profile,
        "package_family": "cgs1-linux-armv7-full-runtime",
        "delivery": "source-build-private-profile",
        "public_version": version,
        "source_commit": commit,
        "source_url": f"https://github.com/{repo}/tree/{commit}",
        "release_url": f"https://github.com/{repo}/tree/{tag}",
        "source": {
            "url": f"https://raw.githubusercontent.com/{repo}/{tag}/monitor1-runtime-source.tar.gz",
            "size": 1024,
            "sha256": "2" * 64,
        },
        "hardware": {"model": "CGS1", "soc": "RK3128", "architecture": "armv7l",
                     "stock_version": "4.1.8_0287", "co2_type": co2_type},
    }


def index():
    return {**release(), "runtime_releases": {
        "monitor1-s8": source_release("monitor1-s8", 2, 2),
        "monitor1-scd40": source_release("monitor1-scd40", 8, 3),
    }}


class Monitor1CatalogTests(unittest.TestCase):
    def test_cross_profile_url_and_unqualified_hardware_do_not_affect_lite(self):
        value = index()
        self.assertEqual(set(catalog.parse_monitor1_releases(value)), {"monitor1-s8", "monitor1-scd40"})
        s8 = value["runtime_releases"]["monitor1-s8"]
        s8["source"] = value["runtime_releases"]["monitor1-scd40"]["source"]
        self.assertEqual(set(catalog.parse_monitor1_releases(value)), {"monitor1-scd40"})
        value["runtime_releases"]["monitor1-scd40"]["hardware"]["co2_type"] = 2
        self.assertEqual(catalog.parse_monitor1_releases(value), {})
        self.assertEqual(set(catalog.parse_catalog(value)), {"lite"})


@unittest.skipUnless(importlib.util.find_spec("homeassistant"), "Optional HA SDK required")
class Monitor1UpdateTests(unittest.IsolatedAsyncioTestCase):
    async def test_late_esphome_connection_uses_its_own_source_line_without_install(self):
        from aioesphomeapi import DeviceInfo
        from homeassistant.components.update import UpdateEntityFeature
        from custom_components.qingping_esphome.firmware_update import fetch_catalog
        from custom_components.qingping_esphome.monitor1_update import track_monitor1_updates

        raw = json.dumps(index()).encode()
        hass = SimpleNamespace(config_entries=SimpleNamespace(async_entries=Mock(return_value=[])))
        with patch("custom_components.qingping_esphome.firmware_update.download_public",
                   AsyncMock(return_value=raw)) as download:
            releases = await fetch_catalog(hass, include_monitor1=True)
            download.assert_awaited_once()
        coordinator = SimpleNamespace(data=releases, async_request_refresh=AsyncMock())
        entry = SimpleNamespace(async_on_unload=Mock())
        add = Mock()
        with patch("custom_components.qingping_esphome.monitor1_update.async_track_time_interval") as interval:
            track_monitor1_updates(hass, entry, coordinator, add)
        add.assert_not_called()
        entry.async_on_unload.assert_called_once_with(interval.return_value)
        reconcile = interval.call_args.args[1]

        mac = "02:11:22:33:44:55"
        runtime = SimpleNamespace(available=True, device_info=DeviceInfo(
            mac_address=mac, project_name="ivaschru.qingping_monitor1_s8", project_version="1"))
        esphome = SimpleNamespace(unique_id=mac, runtime_data=runtime, data={"noise_psk": "fixture-only"})
        hass.config_entries.async_entries.return_value = [esphome]
        reconcile()
        update = add.call_args.args[0][0]
        self.assertEqual((update.installed_version, update.latest_version, update.state), ("1", "2", "on"))
        self.assertFalse(update.supported_features & UpdateEntityFeature.INSTALL)
        self.assertIn("firmware-monitor1-s8-v2", await update.async_release_notes())
        await update.async_update()
        coordinator.async_request_refresh.assert_awaited_once()

        # Reconnecting with the installed kit updates the existing entity.
        runtime.device_info = DeviceInfo(mac_address=mac, project_name="ivaschru.qingping_monitor1_s8", project_version="2")
        reconcile()
        self.assertEqual((update.installed_version, update.state), ("2", "off"))
        add.assert_called_once()

        # An ambiguous identity or a changed project cannot leave an offer active.
        hass.config_entries.async_entries.return_value.append(esphome)
        reconcile()
        self.assertFalse(update.available)
        self.assertIsNone(update.latest_version)
        hass.config_entries.async_entries.return_value = [esphome]
        runtime.device_info = DeviceInfo(mac_address=mac, project_name="other.monitor1", project_version="1")
        reconcile()
        self.assertFalse(update.available)
        add.assert_called_once()
