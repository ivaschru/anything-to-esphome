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
from unittest.mock import patch

AVAILABLE = importlib.util.find_spec("homeassistant") is not None


@unittest.skipUnless(AVAILABLE, "Optional Home Assistant SDK not installed")
class HAContractTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        from homeassistant.core import HomeAssistant
        from custom_components.qingping_esphome.manager import Manager
        self.temp = tempfile.TemporaryDirectory()
        self.hass = HomeAssistant(self.temp.name)
        self.entry = SimpleNamespace(data={"lan_host": "192.168.50.2", "http_port": 1887, "mqtt_port": 1886})
        self.manager = Manager(self.hass, self.entry)

    async def asyncTearDown(self):
        await self.manager.stop()
        await self.hass.async_stop(force=True)
        self.temp.cleanup()

    async def test_personalization_private_journal_and_restart_fence(self):
        from custom_components.qingping_esphome.manager import Manager
        from test_protocol import fixture
        root = Path(self.temp.name) / "template"
        root.mkdir()
        template = fixture()
        (root / "lite-template.bin").write_bytes(template)
        (root / "lite-template.json").write_text(json.dumps({"sha256": hashlib.sha256(template).hexdigest()}))
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
        self.assertNotIn("fixture-wifi-password", str(fresh.records))
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


if __name__ == "__main__": unittest.main()
