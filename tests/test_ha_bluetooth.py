"""HA SDK tests with synthetic GATT only: no radio, pairing or firmware writes.

Exercise the actual stock framing and the installation boundary. The fake HA
resolver supplies either a local or a proxy BLEDevice; protocol behavior must
not depend on its source. This is not a hardware qualification of either path.
"""
import asyncio
from contextlib import asynccontextmanager
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
from types import MappingProxyType, SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

AVAILABLE = importlib.util.find_spec("homeassistant") is not None
IDENTITY = {"model": "CGDN1", "stock_version": "4.5.8", "hardware": "0001", "mac": "001122334455"}
ADDRESS = "00:11:22:33:44:55"
MODULE = "custom_components.qingping_esphome.ha_bluetooth"


class FakeGatt:
    def __init__(self, *, fail_setup=False, reject_ack=False, macs=None, stock_version="4.5.8"):
        self.services = self
        self.notifications = {}
        self.fragments = {}
        self.commands = []
        self.fail_setup, self.reject_ack = fail_setup, reject_ack
        self.macs = list([IDENTITY["mac"]] * 3 if macs is None else macs)
        self.stock_version = stock_version
        self.disconnect = AsyncMock()

    def get_service(self, _uuid): return self
    def get_characteristic(self, uuid): return uuid

    async def start_notify(self, uuid, callback): self.notifications[uuid] = callback

    async def read_gatt_char(self, uuid):
        return {"00002a24": b"CGDN1", "00002a26": self.stock_version.encode(), "00002a27": b"0001"}[uuid[:8]]

    async def write_gatt_char(self, uuid, data, *, response):
        assert response is True
        buffer = self.fragments.setdefault(uuid, bytearray())
        buffer.extend(data)
        if len(buffer) < buffer[0] + 1: return
        number, command = int(uuid[:8], 16), buffer[1]
        self.commands.append((number, command, bytes(buffer[2:])))
        buffer.clear()
        if number == 0x17:
            mac_uuid = "00000018-0000-1000-8000-00805f9b34fb"
            if self.macs:
                self.notifications[mac_uuid](None, b"\x07\x0b" + bytes.fromhex(self.macs.pop(0)))
        elif number == 1:
            if self.fail_setup: raise RuntimeError("private-packet-contents")
            ack_uuid = "00000002-0000-1000-8000-00805f9b34fb"
            self.notifications[ack_uuid](None, bytes((4, 255, command, int(self.reject_ack), 0)))


@unittest.skipUnless(AVAILABLE, "Optional Home Assistant SDK not installed")
class HABluetoothTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        from homeassistant.core import HomeAssistant
        from homeassistant.config_entries import ConfigEntries
        from custom_components.qingping_esphome.manager import Manager
        self.temp = tempfile.TemporaryDirectory()
        self.hass = HomeAssistant(self.temp.name)
        self.hass.config_entries = ConfigEntries(self.hass, {})
        entry = SimpleNamespace(data={"lan_host": "192.168.50.2", "http_port": 1887, "mqtt_port": 1886})
        self.manager = Manager(self.hass, entry)
        self.radio = self.manager.bluetooth

    async def asyncTearDown(self):
        await self.manager.stop()
        await self.hass.async_stop(force=True)
        self.temp.cleanup()

    def radio_patches(self, client, *, source="local"):
        from contextlib import ExitStack
        stack = ExitStack()
        device = SimpleNamespace(address=ADDRESS, details={"source": source})
        info = SimpleNamespace(address=ADDRESS, name="Qingping Lite", rssi=-50, source=source)
        stack.enter_context(patch(MODULE + ".bluetooth.async_discovered_service_info", return_value=[info]))
        resolver = stack.enter_context(patch(MODULE + ".bluetooth.async_ble_device_from_address", return_value=device))
        connector = stack.enter_context(patch(MODULE + ".establish_connection", AsyncMock(return_value=client)))
        stack.enter_context(patch(MODULE + ".asyncio.sleep", AsyncMock()))
        return stack, resolver, connector, device

    async def create(self, token="selection"):
        from custom_components.qingping_esphome.ha_bluetooth import Selection
        from test_protocol import fixture
        self.radio.selections[token] = Selection("owner", ADDRESS, dict(IDENTITY))
        root = Path(self.temp.name) / "template"
        root.mkdir(exist_ok=True)
        template = fixture()
        (root / "lite-template.bin").write_bytes(template)
        (root / "lite-template.json").write_text(json.dumps({"sha256": hashlib.sha256(template).hexdigest(),
            "model": "CGDN1", "profile": "lite", "source_stock_version": "4.5.8", "hardware": "0001",
            "pm_policy": "quiet-scd4x-window-v1", "format": "esp32-app-fixed-slots-v1", "size": len(template), "ui": "fixture", "public_version": 1}))
        data = {**IDENTITY, "profile": "lite", "usb": True, "transport": "ha", "selection": token,
                "ssid": "fixture-network", "wifi_password": "fixture-password"}
        with patch("custom_components.qingping_esphome.manager.TEMPLATE_ROOT", root):
            result = await self.manager.create("owner", data)
        return self.manager.get(result["id"], "owner")

    async def test_shared_ha_resolution_for_local_adapter_and_active_proxy(self):
        for source in ("local", "esphome-proxy"):
            client = FakeGatt()
            stack, resolver, connector, device = self.radio_patches(client, source=source)
            with stack:
                result = await self.radio.select("owner", ADDRESS)
                self.assertEqual(result["identity"], IDENTITY)
                self.assertIs(connector.call_args.args[1], device)
                resolver.assert_called_with(self.hass, ADDRESS, connectable=True)
                self.assertIs(connector.call_args.kwargs["ble_device_callback"](), device)
                self.assertEqual([n for n, _, _ in client.commands], [0x17])
                client.disconnect.assert_awaited_once()
                self.assertFalse(self.radio.in_use)

    async def test_434_selection_uses_same_read_only_gatt_and_separate_factory_profile(self):
        client = FakeGatt(stock_version="4.3.4")
        stack, *_ = self.radio_patches(client, source="local")
        with stack:
            result = await self.radio.select("owner", ADDRESS)
        self.assertEqual(result["identity"]["stock_version"], "4.3.4")
        self.assertEqual([number for number, _, _ in client.commands], [0x17])
        self.assertEqual(self.radio.selected("owner", result["selection"], result["identity"]).identity,
                         result["identity"])

    async def test_scan_resolves_registry_labels_and_requires_connectable_scanner(self):
        from homeassistant.config_entries import ConfigEntry
        from homeassistant.helpers import area_registry as ar, device_registry as dr
        from custom_components.qingping_esphome.errors import InstallerError
        labels = ("Qingping Lite", "CGDN1 Test", "Air Monitor Test", "Qingping conflict",
                  "Qingping two areas", "Unrelated", None)
        addresses = [f"00:11:22:33:44:{n:02X}" for n in (0x50, 0x52, 0x54, 0x56, 0x57, 0x58, 0x5A)]
        infos = [SimpleNamespace(address=address, name=name, rssi=-50) for address, name in zip(addresses, labels)]
        registry = dr.DeviceRegistry(self.hass)
        self.hass.data[dr.DATA_REGISTRY] = registry
        await registry.async_load()
        await ar.async_load(self.hass)
        areas = ar.async_get(self.hass)
        room_a = areas.async_create("Room A")
        room_b = areas.async_create("Room B")
        entries = [ConfigEntry(version=1, minor_version=1, domain=domain, title=domain,
                               data={}, options={}, source="user", unique_id=domain,
                               discovery_keys=MappingProxyType({}), subentries_data=[])
                   for domain in ("qingping", "mqtt")]
        with patch.object(self.hass.config_entries, "async_setup", AsyncMock(return_value=True)):
            for entry in entries:
                await self.hass.config_entries.async_add(entry)
        first = registry.async_get_or_create(config_entry_id=entries[0].entry_id, name="Default name",
                                             connections={(dr.CONNECTION_BLUETOOTH, addresses[0].lower())})
        registry.async_update_device(first.id, name_by_user="Кабинет", area_id=room_a.id)
        network_duplicate = registry.async_get_or_create(config_entry_id=entries[1].entry_id,
            name="Network entry", connections={(dr.CONNECTION_NETWORK_MAC, addresses[0])})
        registry.async_update_device(network_duplicate.id, area_id=room_b.id)
        network_only = registry.async_get_or_create(config_entry_id=entries[1].entry_id,
            name="Гостиная", connections={(dr.CONNECTION_NETWORK_MAC, addresses[1].replace(":", ""))})
        registry.async_update_device(network_only.id, area_id=room_b.id)
        registry.async_get_or_create(config_entry_id=entries[1].entry_id, name="Adjacent device",
                                     connections={(dr.CONNECTION_NETWORK_MAC, "00:11:22:33:44:55")})
        for entry in entries:
            registry.async_get_or_create(config_entry_id=entry.entry_id, name=entry.domain,
                                         connections={(dr.CONNECTION_BLUETOOTH, addresses[3])})
        for entry, room in zip(entries, (room_a, room_b)):
            duplicate = registry.async_get_or_create(config_entry_id=entry.entry_id, name="Shared name",
                connections={(dr.CONNECTION_BLUETOOTH, addresses[4])})
            registry.async_update_device(duplicate.id, area_id=room.id)
        with patch(MODULE + ".bluetooth.async_scanner_count", return_value=0):
            with self.assertRaises(InstallerError) as error: await self.radio.scan()
        self.assertEqual(error.exception.code, "ha_bluetooth_unavailable")
        with patch(MODULE + ".bluetooth.async_scanner_count", return_value=1), \
             patch(MODULE + ".bluetooth.async_discovered_service_info", return_value=infos) as discovered, \
             patch(MODULE + ".bluetooth.async_process_advertisements", AsyncMock(side_effect=TimeoutError)) as active:
            result = await self.radio.scan()
        self.assertEqual([d["address"] for d in result["devices"]], addresses[:5])
        self.assertEqual([d["name"] for d in result["devices"]], list(labels[:5]))
        self.assertEqual([d.get("ha_name") for d in result["devices"]],
                         ["Кабинет", "Гостиная", None, None, "Shared name"])
        self.assertEqual([d.get("ha_area") for d in result["devices"]],
                         ["Room A", "Room B", None, None, None])
        discovered.assert_called_once_with(self.hass, connectable=True)
        self.assertEqual(active.call_args.args[2], {"connectable": True})

    async def test_unseen_address_never_connects(self):
        with patch(MODULE + ".bluetooth.async_discovered_service_info", return_value=[]), \
             patch(MODULE + ".establish_connection", AsyncMock()) as connector:
            with self.assertRaises(ValueError): await self.radio.select("owner", "arbitrary-address")
        connector.assert_not_awaited()

    async def test_client_wrapper_is_resolved_after_ha_bluetooth_setup(self):
        client = FakeGatt()
        stack, _, connector, _ = self.radio_patches(client, source="esphome-proxy")
        wrapper = object()
        with stack, patch(MODULE + ".bleak.BleakClient", wrapper):
            await self.radio.select("owner", ADDRESS)
        self.assertIs(connector.call_args.args[0], wrapper)

    async def test_missing_mac_reply_returns_browser_hint_and_releases_connection(self):
        from custom_components.qingping_esphome.errors import InstallerError

        client = FakeGatt(macs=[])
        stack, _, _, _ = self.radio_patches(client)
        with stack, patch(MODULE + ".MAC_REPLY_SECONDS", 0):
            with self.assertRaises(InstallerError) as caught:
                await self.radio.select("owner", ADDRESS)

        self.assertEqual(caught.exception.code, "mac_timeout")
        self.assertEqual(client.commands, [(0x17, 0x0b, b"")])
        client.disconnect.assert_awaited_once()
        self.assertFalse(self.radio.selections or self.radio.in_use or self.radio.operations)

    async def test_unload_cancels_pending_identity_read_and_disconnects(self):
        client = FakeGatt()
        started = asyncio.Event()

        async def pending_read(_uuid):
            started.set()
            await asyncio.Event().wait()

        client.read_gatt_char = pending_read
        stack, _, _, _ = self.radio_patches(client)
        with stack:
            selection = asyncio.create_task(self.radio.select("owner", ADDRESS))
            await started.wait()
            await self.manager.stop()
            with self.assertRaises(asyncio.CancelledError): await selection
        client.disconnect.assert_awaited_once()
        self.assertFalse(self.radio.in_use or self.radio.operations)

    async def test_selection_owner_expiry_and_identity_binding(self):
        from custom_components.qingping_esphome.ha_bluetooth import Selection, SELECTION_SECONDS
        self.radio.selections["token"] = Selection("owner", ADDRESS, dict(IDENTITY))
        for owner, identity in (("other", IDENTITY), ("owner", {**IDENTITY, "mac": "AABBCCDDEEFF"})):
            with self.assertRaises(ValueError): self.radio.selected(owner, "token", identity)
        self.radio.selections["token"].created -= SELECTION_SECONDS + 1
        with self.assertRaises(ValueError): self.radio.selected("owner", "token", IDENTITY)

    async def test_full_framing_is_single_use_and_cannot_arm_before_provisioning(self):
        session = await self.create()
        self.assertNotIn("selection", self.radio.selections)
        with self.assertRaises(ValueError): await self.manager.arm(session.id, "owner")
        client = FakeGatt()
        stack, _, _, _ = self.radio_patches(client)
        with stack:
            result = await self.manager.provision(session.id, "owner")
            with self.assertRaises(ValueError): await self.manager.provision(session.id, "owner")
        self.assertTrue(result["provisioned"])
        self.assertFalse(session.armed)
        self.assertFalse(session.sent)
        self.assertEqual(self.manager.records, {})
        self.assertEqual([(n, c) for n, c, _ in client.commands], [(0x17, 0x0b), (0x17, 0x0b), (1, 1), (1, 2), (0x0d, 1), (1, 0x17), (1, 0x18)])
        self.assertEqual(client.commands[4][2], b'"fixture-network","fixture-password"')
        self.assertNotIn("fixture-password", str(result))
        self.assertNotIn(session.id, self.manager.ble_settings)
        client.disconnect.assert_awaited_once()

    async def test_reconnected_identity_change_refuses_all_settings_writes(self):
        session = await self.create()
        client = FakeGatt(macs=["AABBCCDDEEFF"])
        stack, _, _, _ = self.radio_patches(client)
        with stack: result = await self.manager.provision(session.id, "owner")
        self.assertEqual(result["error_code"], "selected_changed")
        self.assertEqual([n for n, _, _ in client.commands], [0x17])
        self.assertFalse(session.provisioned or session.armed or session.sent)

    async def test_mac_changes_immediately_before_write_refuses_setup(self):
        session = await self.create()
        client = FakeGatt(macs=[IDENTITY["mac"], "AABBCCDDEEFF"])
        stack, _, _, _ = self.radio_patches(client)
        with stack: result = await self.manager.provision(session.id, "owner")
        self.assertEqual(result["error_code"], "selected_changed")
        self.assertTrue(all(n == 0x17 for n, _, _ in client.commands))

    async def test_failed_write_never_retries_or_exposes_exception(self):
        session = await self.create()
        client = FakeGatt(fail_setup=True)
        stack, _, connector, _ = self.radio_patches(client)
        with stack:
            result = await self.manager.provision(session.id, "owner")
            with self.assertRaises(ValueError): await self.manager.provision(session.id, "owner")
            with self.assertRaises(ValueError): await self.manager.arm(session.id, "owner")
        connector.assert_awaited_once()
        self.assertEqual([(n, c) for n, c, _ in client.commands if n == 1], [(1, 1)])
        self.assertEqual(result["error_code"], "ha_bluetooth_failed")
        self.assertNotIn("private-packet", str(result))
        self.assertFalse(session.sent)
        client.disconnect.assert_awaited_once()

    async def test_rejected_ack_stops_before_wifi_settings(self):
        session = await self.create()
        client = FakeGatt(reject_ack=True)
        stack, _, _, _ = self.radio_patches(client)
        with stack: result = await self.manager.provision(session.id, "owner")
        self.assertEqual(result["error_code"], "ble_rejected")
        self.assertEqual([(n, c) for n, c, _ in client.commands if n == 1], [(1, 1)])

    async def test_concurrent_calls_and_cancel_cannot_replay_running_setup(self):
        session = await self.create()
        started, release = asyncio.Event(), asyncio.Event()

        async def hold(*_args):
            started.set()
            await release.wait()

        @asynccontextmanager
        async def connection(_address):
            yield SimpleNamespace(initialize=AsyncMock(return_value=dict(IDENTITY)), provision=hold)

        with patch.object(self.radio, "connection", connection):
            task = asyncio.create_task(self.manager.provision(session.id, "owner"))
            await started.wait()
            with self.assertRaises(ValueError): await self.manager.provision(session.id, "owner")
            with self.assertRaises(ValueError): self.manager.cancel(session.id, "owner")
            with self.assertRaises(ValueError): await self.manager.provision(session.id, "other-owner")
            release.set()
            await task
        self.assertTrue(session.provisioned)

    async def test_closed_websocket_does_not_cancel_or_arm_backend_task(self):
        session = await self.create()
        started, release = asyncio.Event(), asyncio.Event()

        async def hold(*_args):
            started.set()
            await release.wait()

        @asynccontextmanager
        async def connection(_address):
            yield SimpleNamespace(initialize=AsyncMock(return_value=dict(IDENTITY)), provision=hold)

        with patch.object(self.radio, "connection", connection):
            caller = asyncio.create_task(self.manager.provision(session.id, "owner"))
            await started.wait()
            caller.cancel()
            with self.assertRaises(asyncio.CancelledError): await caller
            worker = self.manager.ble_tasks[session.id]
            self.assertFalse(worker.cancelled())
            release.set()
            await worker
        self.assertTrue(session.provisioned)
        self.assertFalse(session.armed or session.sent)

    async def test_cancel_removes_unstarted_private_settings(self):
        session = await self.create()
        with self.assertRaises(ValueError): self.manager.cancel(session.id, "other-owner")
        self.manager.cancel(session.id, "owner")
        self.assertNotIn(session.id, self.manager.ble_settings)
        with self.assertRaises(ValueError): await self.manager.provision(session.id, "owner")
