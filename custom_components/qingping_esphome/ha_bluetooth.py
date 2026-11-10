"""Stock Lite provisioning through Home Assistant's shared Bluetooth backend.

HA resolves the BLEDevice, so local adapters and connectable remote proxies use
the same code. Never start a private scanner or reconnect/replay after a write.
Selection reads identity only and releases the connection slot immediately;
installation reconnects and checks that identity before changing any settings.
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager, suppress
from dataclasses import dataclass, field
import secrets
import time

import bleak
from bleak_retry_connector import establish_connection
from homeassistant.components import bluetooth

from .catalog import factory_lite_profile
from .errors import InstallerError
from .image import mac_normalize

PREFIXES = ("Qingping", "CGDN1", "Air Monitor")
VENDOR = "22210000-554a-4546-5542-46534450464d"
INFO = "0000180a-0000-1000-8000-00805f9b34fb"
SELECTION_SECONDS = 300
MAX_SELECTIONS = 16


def characteristic(number):
    return f"{number:08x}-0000-1000-8000-00805f9b34fb"


class StockClient:
    """One connected GATT client; ACKs and private notifications stay in RAM."""

    def __init__(self, client):
        self.client = client
        self.acks = asyncio.Queue(maxsize=16)
        self.mac_reply = None
        self.chars = {}

    async def initialize(self):
        service = self.client.services.get_service(VENDOR)
        info = self.client.services.get_service(INFO)
        if service is None or info is None:
            raise InstallerError("identity_unsupported")
        for number in (1, 2, 0x0d, 0x0e, 0x17, 0x18):
            item = service.get_characteristic(characteristic(number))
            if item is None:
                raise InstallerError("identity_unsupported")
            self.chars[number] = item
        # Do not log/forward arbitrary stock notifications: some echo settings.
        await self.client.start_notify(self.chars[2], self._ack)
        await self.client.start_notify(self.chars[0x0e], lambda _sender, _data: None)
        await self.client.start_notify(self.chars[0x18], self._mac)
        identity = {}
        for key, number in (("model", 0x2a24), ("stock_version", 0x2a26), ("hardware", 0x2a27)):
            item = info.get_characteristic(characteristic(number))
            if item is None:
                raise InstallerError("identity_unsupported")
            value = await self.client.read_gatt_char(item)
            identity[key] = bytes(value).decode("utf-8", errors="strict").rstrip("\0").strip()
        identity["mac"] = await self.read_mac()
        return identity

    def _ack(self, _sender, data):
        if len(data) == 5 and data[:2] == b"\x04\xff" and not self.acks.full():
            self.acks.put_nowait(tuple(data[2:]))

    def _mac(self, _sender, data):
        if len(data) == 8 and data[:2] == b"\x07\x0b" and self.mac_reply and not self.mac_reply.done():
            self.mac_reply.set_result(bytes(data[2:]).hex().upper())

    async def read_mac(self):
        self.mac_reply = asyncio.get_running_loop().create_future()
        try:
            await self.send(0x17, 0x0b, b"")
            return await asyncio.wait_for(self.mac_reply, 7)
        finally:
            self.mac_reply = None

    async def send(self, number, command, payload):
        if len(payload) > 254:
            raise InstallerError("ble_packet_length")
        data = bytes((len(payload) + 1, command)) + payload
        # Match the hardware-tested browser framing, including pacing. GATT
        # response confirms each fragment, not acceptance of the whole command.
        for offset in range(0, len(data), 20):
            await self.client.write_gatt_char(self.chars[number], data[offset:offset + 20], response=True)
            await asyncio.sleep(.05)

    async def acknowledged(self, command, payload):
        while not self.acks.empty():
            self.acks.get_nowait()
        await self.send(1, command, payload)
        try:
            reply = await asyncio.wait_for(self.acks.get(), 7)
        except TimeoutError as error:
            raise InstallerError("ble_ack_timeout") from error
        if reply != (command, 0, 0):
            raise InstallerError("ble_rejected")
        await asyncio.sleep(.5)

    async def provision(self, identity, ssid, password, broker, progress):
        if await self.read_mac() != identity["mac"]:
            raise InstallerError("selected_changed")
        # Only connection establishment may retry. After the first setup write,
        # an error has an uncertain outcome and must never replay this sequence.
        token = secrets.token_bytes(16)
        for command in (1, 2):
            await self.acknowledged(command, token)
        progress("provisioning")
        await self.send(0x0d, 1, f'"{ssid}","{password}"'.encode())
        await asyncio.sleep(.5)
        await self.acknowledged(0x17, f'{broker["host"]} {broker["port"]} {broker["username"]} {broker["password"]}'.encode())
        await self.acknowledged(0x18, f'{broker["client_id"]} {broker["down"]} {broker["up"]}'.encode())
        progress("waiting_for_broker")
        # Stock starts Wi-Fi asynchronously; immediate BLE teardown caused a
        # real browser setup failure. Keep the same settling period on HA.
        await asyncio.sleep(30)


@dataclass
class Selection:
    owner: str
    address: str
    identity: dict
    created: float = field(default_factory=time.monotonic)


class HABluetooth:
    """Bounded, owner-scoped read selections; no persistent credentials/cache."""

    def __init__(self, hass):
        self.hass = hass
        self.selections = {}
        self.in_use = set()
        self.scan_lock = asyncio.Lock()
        self.operations = set()

    async def stop(self):
        # Read selections/scans belong to WebSocket calls too. Unloading must
        # release their connection slots, not leave them alive for the timeout.
        tasks = [task for task in self.operations if task is not asyncio.current_task() and not task.done()]
        for task in tasks:
            if not task.cancelling(): task.cancel()
        if tasks: await asyncio.gather(*tasks, return_exceptions=True)
        self.selections.clear()

    def available(self):
        # A browser-only installation remains usable without a radio. The
        # bluetooth_adapters dependency loads HA's manager, not a hardware need.
        return bluetooth.async_scanner_count(self.hass, connectable=True) > 0

    def devices(self):
        return {info.address: info for info in bluetooth.async_discovered_service_info(self.hass, connectable=True)
                if info.name and info.name.startswith(PREFIXES)}

    async def scan(self):
        if not self.available():
            raise InstallerError("ha_bluetooth_unavailable")
        if self.scan_lock.locked():
            raise InstallerError("ha_bluetooth_busy")
        async with self.scan_lock:
            # Ask HA for one bounded active discovery window. This uses its
            # shared scanners (including proxies), never BleakScanner.discover.
            task = asyncio.current_task()
            self.operations.add(task)
            try:
                await bluetooth.async_process_advertisements(self.hass, lambda _info: False,
                    {"connectable": True}, bluetooth.BluetoothScanningMode.ACTIVE, 5)
            except TimeoutError:
                pass  # The entire window is intentional; return all matches.
            finally:
                self.operations.discard(task)
        return {"devices": [{"address": address, "name": info.name, "rssi": info.rssi}
                            for address, info in sorted(self.devices().items())][:32]}

    @asynccontextmanager
    async def connection(self, address):
        if address in self.in_use:
            raise InstallerError("ha_bluetooth_busy")
        if address not in self.devices():
            raise InstallerError("ha_bluetooth_not_found")
        device = bluetooth.async_ble_device_from_address(self.hass, address, connectable=True)
        if device is None:
            raise InstallerError("ha_bluetooth_not_found")
        self.in_use.add(address)
        task = asyncio.current_task()
        self.operations.add(task)
        client = None
        try:
            # Resolve through HA on every connection; it chooses a local or
            # remote connectable adapter. Retry only before any settings write.
            # Look up the client at call time: HA installs its proxy-aware
            # wrapper during Bluetooth setup, possibly after module import.
            client = await establish_connection(bleak.BleakClient, device, "Qingping installer", max_attempts=2,
                ble_device_callback=lambda: bluetooth.async_ble_device_from_address(self.hass, address, connectable=True))
            yield StockClient(client)
        except InstallerError:
            raise
        except Exception as error:
            # Adapter/library exceptions may contain private packet values.
            raise InstallerError("ha_bluetooth_failed") from error
        finally:
            if client is not None:
                with suppress(Exception):
                    await asyncio.wait_for(client.disconnect(), 5)
            self.in_use.discard(address)
            self.operations.discard(task)

    def expire(self):
        now = time.monotonic()
        self.selections = {key: value for key, value in self.selections.items()
                           if now - value.created <= SELECTION_SECONDS}

    async def select(self, owner, address):
        self.expire()
        if len(self.selections) >= MAX_SELECTIONS:
            raise InstallerError("ha_bluetooth_busy")
        async with asyncio.timeout(40):
            async with self.connection(address) as stock:
                identity = await stock.initialize()
        if identity["hardware"] != "0001":
            raise InstallerError("hardware_unverified")
        factory_lite_profile(identity["model"], identity["stock_version"], identity["hardware"])
        # The factory GATT MAC, not the transport address (which may be a
        # backend-specific identifier), binds the later MQTT/native checks.
        identity["mac"] = mac_normalize(identity["mac"])
        token = secrets.token_hex(16)
        self.selections[token] = Selection(owner, address, identity)
        return {"selection": token, "identity": identity}

    def selected(self, owner, token, identity):
        self.expire()
        value = self.selections.get(token)
        if value is None or value.owner != owner:
            raise InstallerError("ha_bluetooth_selection_expired")
        if any(identity.get(key) != item for key, item in value.identity.items()):
            raise InstallerError("selected_changed")
        return value
