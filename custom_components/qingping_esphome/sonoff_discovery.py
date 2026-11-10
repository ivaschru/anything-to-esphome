"""Bounded HA-owned discovery and an ephemeral eWeLink account client.

The SonoffLAN adapter borrows detached device/session snapshots. It neither
reads .storage files nor disconnects/reloads the existing integration. Its
unsupported/local-only configurations fall back to explicit account sign-in.
The eWeLink API protocol is also used by Sonoff-OTA get_device_key.py and
SonoffLAN; the public application identity below is not a user's credential.
"""
from __future__ import annotations

import asyncio
import base64
import copy
import hashlib
import hmac
import json
import re

from homeassistant.components import zeroconf
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from zeroconf import IPVersion, ServiceStateChange
from zeroconf.asyncio import AsyncServiceBrowser, AsyncServiceInfo

from .sonoff_policy import OwnedDevice, SonoffError, lan_address

SERVICE = "_ewelink._tcp.local."
API = {"eu": "https://eu-apia.coolkit.cc", "us": "https://us-apia.coolkit.cc",
       "as": "https://as-apia.coolkit.cc", "cn": "https://cn-apia.coolkit.cn"}
APP_ID = "R8Oq3y0eSZSYdKccHlrQzT1ACCOUT9Gv"
# This public protocol client identifier is published by SonoffLAN/Sonoff-OTA.
# It is never substituted with a user's password or an arbitrary caller host.
APP_SIGNING_ID = "1ve5Qk9GXfUhKAn1svnKwpAlxXkMarru"


class Account:
    def __init__(self, hass):
        self.hass = hass

    async def request(self, region, path, *, body=None, token=None):
        if region not in API or path not in {"/v2/user/login", "/v2/device/thing?num=0"}:
            raise SonoffError("sonoff_invalid_request")
        headers = {"Content-Type": "application/json", "X-CK-Appid": APP_ID}
        encoded = json.dumps(body, separators=(",", ":")).encode() if body is not None else None
        if token:
            headers["Authorization"] = "Bearer " + token
        elif encoded:
            signature = hmac.new(APP_SIGNING_ID.encode(), encoded, hashlib.sha256).digest()
            headers["Authorization"] = "Sign " + base64.b64encode(signature).decode()
        try:
            async with asyncio.timeout(20):
                async with async_get_clientsession(self.hass).request(
                        "POST" if body is not None else "GET", API[region] + path,
                        data=encoded, headers=headers, allow_redirects=False) as response:
                    if response.status != 200:
                        raise SonoffError("sonoff_auth_failed")
                    # StreamReader.read(n) may return just the first TCP
                    # fragment. Accumulate through EOF while bounding the
                    # complete response, including chunked provider replies.
                    raw = bytearray()
                    async for part in response.content.iter_chunked(16384):
                        raw.extend(part)
                        if len(raw) > 1048576:
                            raise SonoffError("sonoff_auth_failed")
                    result = json.loads(raw)
                    if not isinstance(result, dict):
                        raise SonoffError("sonoff_auth_failed")
                    return result
        except SonoffError:
            raise
        except Exception:
            # Provider error strings can contain tokens, account identifiers,
            # URLs and response fragments. Only the fixed code leaves here.
            raise SonoffError("sonoff_auth_failed") from None

    async def login(self, username, password, region="eu", country_code="+7"):
        if (not isinstance(username, str) or not 1 <= len(username) <= 254
                or not isinstance(password, str) or not 1 <= len(password) <= 256
                or not isinstance(country_code, str) or not re.fullmatch(r"\+[1-9][0-9]{0,3}", country_code)):
            raise SonoffError("sonoff_invalid_request")
        body = {"password": password, "countryCode": country_code}
        body["email" if "@" in username else "phoneNumber"] = username
        result = await self.request(region, "/v2/user/login", body=body)
        if result.get("error") == 10004:
            # One service-selected region correction, never an arbitrary URL
            # redirect or a loop that repeatedly submits an account password.
            region = (result.get("data") or {}).get("region")
            result = await self.request(region, "/v2/user/login", body=body)
        auth = result.get("data")
        if result.get("error") != 0 or not isinstance(auth, dict) or not auth.get("at"):
            raise SonoffError("sonoff_auth_failed")
        auth["appid"] = APP_ID
        return region, auth

    async def devices(self, region, auth):
        result = await self.request(region, "/v2/device/thing?num=0", token=auth.get("at"))
        values = (result.get("data") or {}).get("thingList")
        if result.get("error") != 0 or not isinstance(values, list) or len(values) > 1000:
            raise SonoffError("sonoff_auth_failed")
        devices = []
        for item in values:
            if not isinstance(item, dict):
                continue
            try:
                devices.append(OwnedDevice.parse(item.get("itemData"), source="ewelink",
                                                 auth=auth, region=region))
            except SonoffError:
                continue  # A different owned model never becomes an S60TPF.
        return devices


def sonoff_inventory(hass):
    """Adapter for the published SonoffLAN XRegistry.devices/cloud contract."""
    registries = hass.data.get("sonoff", {})
    if not isinstance(registries, dict):
        return []
    devices, seen = [], set()
    for registry in list(registries.values())[:32]:
        values = getattr(registry, "devices", None)
        if not isinstance(values, dict):
            continue
        cloud = getattr(registry, "cloud", None)
        auth = getattr(cloud, "auth", None)
        region = getattr(cloud, "region", "eu")
        if not isinstance(auth, dict) or auth.get("appid", APP_ID) != APP_ID:
            auth = None
        for value in list(values.values())[:1000]:
            try:
                device = OwnedDevice.parse(value, source="sonoff", auth=auth, region=region)
            except SonoffError:
                continue
            if device.device_id not in seen:
                seen.add(device.device_id)
                devices.append(device)
    return devices


async def discover(hass, *, timeout=8):
    """Use HA's shared mDNS socket; retire only this browser and its own reads."""
    instance = await zeroconf.async_get_async_instance(hass)
    found, pending = {}, set()

    async def resolve(name):
        info = AsyncServiceInfo(SERVICE, name)
        if not await info.async_request(instance.zeroconf, 2000):
            return
        addresses = info.parsed_addresses(IPVersion.V4Only)
        properties = info.properties
        try:
            fields = {key.decode("ascii"): value.decode("ascii")
                      for key, value in properties.items()
                      if isinstance(key, bytes) and isinstance(value, bytes)
                      and len(key) <= 32 and len(value) <= 4096}
            device_id = fields.get("id", "")
            if len(device_id) != 10 or info.port != 8081:
                return
            for address in addresses:
                try:
                    found[device_id] = {"host": lan_address(address), "fields": fields}
                    break
                except SonoffError:
                    continue
        except (UnicodeError, ValueError, TypeError):
            return

    def changed(zeroconf, service_type, name, state_change):
        if state_change is ServiceStateChange.Removed or len(pending) >= 64:
            return
        task = hass.async_create_task(resolve(name))
        pending.add(task)
        task.add_done_callback(pending.discard)

    browser = AsyncServiceBrowser(instance.zeroconf, SERVICE, handlers=[changed])
    try:
        await asyncio.sleep(min(10, max(1, timeout)))
    finally:
        await browser.async_cancel()
        for task in tuple(pending):
            task.cancel()
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)
    return found


def decrypt_advert(fields, key):
    """Read-only eWeLink AES-CBC protocol; no LAN command is sent here."""
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.primitives.padding import PKCS7
    try:
        if fields.get("encrypt") != "true":
            raise ValueError
        data = base64.b64decode("".join(fields.get(f"data{i}", "") for i in range(1, 5)), validate=True)
        iv = base64.b64decode(fields["iv"], validate=True)
        if len(iv) != 16 or not 16 <= len(data) <= 16384 or len(data) % 16:
            raise ValueError
        decryptor = Cipher(algorithms.AES(hashlib.md5(key.encode()).digest()), modes.CBC(iv)).decryptor()
        padded = decryptor.update(data) + decryptor.finalize()
        unpad = PKCS7(128).unpadder()
        state = json.loads(unpad.update(padded) + unpad.finalize())
        if not isinstance(state, dict) or state.get("switch") not in {"on", "off"}:
            raise ValueError
        return state
    except Exception:
        raise SonoffError("sonoff_identity_changed") from None
