"""Factory 4.3.4 route isolation using actual HA/API SDK and synthetic peers.

No account, Bluetooth radio, stock firmware command or device is contacted.
The same create/selection/readback paths used by the wizard are exercised.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

import test_ha_contract as ha_contract
from test_protocol import fixture

AVAILABLE = importlib.util.find_spec("homeassistant") is not None


@unittest.skipUnless(AVAILABLE, "Requires supported HA SDK")
class Factory434Tests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = ha_contract.HAContractTests.asyncSetUp
    asyncTearDown = ha_contract.HAContractTests.asyncTearDown

    def templates(self):
        root = Path(self.temp.name) / "template"; root.mkdir(exist_ok=True)
        binary = fixture(b"independent-polling-profile")
        manifest = {"model": "CGDN1", "profile": "lite-434", "hardware": "0001",
                    "source_stock_version": "4.3.4", "pm_policy": "lite-434-polling-only-v1",
                    "format": "esp32-app-fixed-slots-v1", "size": len(binary),
                    "ui": "2026.11.10-ui25-434sources5", "public_version": 5,
                    "sha256": hashlib.sha256(binary).hexdigest()}
        (root / "lite-434-template.bin").write_bytes(binary)
        (root / "lite-434-template.json").write_text(json.dumps(manifest))
        data = {"profile": "lite-434", "model": "CGDN1", "stock_version": "4.3.4", "hardware": "0001",
                "mac": "00:11:22:33:44:55", "usb": True, "ssid": "fixture", "wifi_password": "fixture-password"}
        return root, manifest, data

    async def test_separate_template_and_consumed_profile_without_standard_fallback(self):
        from custom_components.qingping_esphome.errors import InstallerError
        root, manifest, data = self.templates()
        with patch("custom_components.qingping_esphome.manager.TEMPLATE_ROOT", root):
            # The 4.5.8 template is intentionally absent, proving the selected
            # path uses the independent image rather than silently sharing it.
            result = await self.manager.create("owner", data)
            session = self.manager.get(result["id"], "owner")
            self.assertEqual((session.profile, session.stock_version, session.public_version), ("lite-434", "4.3.4", 5))
            self.assertEqual(session.template_sha256, manifest["sha256"])
            await self.manager.consume_intent(session)
            record = self.manager.records[session.mac]
            self.assertEqual(record["profile"], "lite-434")
            self.assertEqual(record["personalization"]["source_stock_version"], "4.3.4")
            with self.assertRaises(InstallerError): await self.manager.create("owner", data)

    async def test_missing_or_cross_profile_pair_refuses_before_session_or_broker_setup(self):
        from custom_components.qingping_esphome.errors import InstallerError
        root, manifest, data = self.templates()
        with patch("custom_components.qingping_esphome.manager.TEMPLATE_ROOT", root):
            for changes in ({"profile": "lite"}, {"source_stock_version": "4.5.8"},
                            {"pm_policy": "quiet-scd4x-window-v1"}, {"hardware": "0002"}):
                (root / "lite-434-template.json").write_text(json.dumps({**manifest, **changes}))
                with self.assertRaises(InstallerError): await self.manager.create("owner", data)
                self.assertFalse(self.manager.relay.sessions)
            (root / "lite-434-template.json").unlink()
            (root / "lite-template.json").write_text(json.dumps(manifest))
            (root / "lite-template.bin").write_bytes(fixture())
            with self.assertRaises(InstallerError) as error: await self.manager.create("owner", data)
            self.assertEqual(error.exception.code, "template_missing")
            self.assertFalse(self.manager.relay.sessions)

    async def test_native_readback_requires_434_project_integer_and_physical_sensor_types(self):
        from aioesphomeapi import SensorInfo, SensorState
        root, manifest, data = self.templates()
        with patch("custom_components.qingping_esphome.manager.TEMPLATE_ROOT", root):
            result = await self.manager.create("owner", data)
        session = self.manager.get(result["id"], "owner"); session.peer = "192.168.50.3"
        await self.manager.consume_intent(session)
        self.manager.enroll = AsyncMock(return_value="created")
        info = SimpleNamespace(mac_address=session.mac, name=session.name, project_name="ivaschru.qingping_lite_434",
                               project_version="5", compilation_time="fixture")
        entities = [SensorInfo(key=index, name=name) for index, name in enumerate(("CO2", "Temperature", "Humidity"), 1)]
        def states(callback):
            for index, value in enumerate((800, 23, 45), 1): callback(SensorState(key=index, state=value))
        client = SimpleNamespace(connect=AsyncMock(), disconnect=AsyncMock(), device_info=AsyncMock(return_value=info),
                                 list_entities_services=AsyncMock(return_value=(entities, [])), subscribe_states=states)
        with patch("aioesphomeapi.APIClient", return_value=client):
            for project, version in (("ivaschru.qingping_lite_direct_i2c", "5"), (info.project_name, "6")):
                original_project, original_version = info.project_name, info.project_version
                info.project_name, info.project_version = project, version
                await self.manager.verify(session)
                self.assertEqual(session.state, "needs_review")
                self.manager.enroll.assert_not_awaited()
                info.project_name, info.project_version = original_project, original_version
            await self.manager.verify(session)
        self.assertEqual(session.state, "installed")
        self.assertEqual(self.manager.records[session.mac]["outcome"], "native_verified")
        self.manager.enroll.assert_awaited_once()
