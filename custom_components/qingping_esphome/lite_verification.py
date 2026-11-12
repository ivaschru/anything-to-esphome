"""Bounded ESPHome readback for an already consumed Lite installation."""
import asyncio
from contextlib import suppress
import math
import re

import aioesphomeapi
from aioesphomeapi import SensorInfo, SensorState
from homeassistant.components import zeroconf
from zeroconf import IPVersion
from zeroconf.asyncio import AsyncServiceInfo

from .errors import InstallerError
from .image import mac_normalize, private_ipv4

VERIFY_SECONDS = 120
RETRY_SECONDS = 2
SERVICE = "_esphomelib._tcp.local."
PROJECTS = {
    "lite": "ivaschru.qingping_lite_direct_i2c",
    "lite-434": "ivaschru.qingping_lite_434",
}
SENSORS = ("CO2", "Temperature", "Humidity")


async def addresses(hass, mac, name, peer):
    """Resolve only the generated name. mDNS supplies candidates, never proof."""
    candidates = []
    if re.fullmatch(rf"qingping-{mac.lower()}-[0-9a-f]{{9}}", name):
        try:
            async with asyncio.timeout(2):
                instance = await zeroconf.async_get_async_instance(hass)
                info = AsyncServiceInfo(SERVICE, f"{name}.{SERVICE}")
                if await info.async_request(instance.zeroconf, 1400) and info.port == 6053:
                    candidates.extend(info.parsed_addresses(IPVersion.V4Only)[:3])
        except Exception:
            # A deployment with no mDNS can still verify on the stock address.
            pass
    candidates.append(peer)
    result = []
    for host in candidates:
        if not isinstance(host, str):
            continue
        with suppress(ValueError):
            host = private_ipv4(host)
            if host not in result:
                result.append(host)
    return result


async def verify_native(hass, mac, record, report):
    """Retry the authenticated identity and physical readings for two minutes."""
    loop = asyncio.get_running_loop()
    deadline = loop.time() + VERIFY_SECONDS
    error = "lite_api_timeout"
    report("lite_check_connecting")
    try:
        async with asyncio.timeout_at(deadline):
            while True:
                for host in await addresses(hass, mac, record["name"], record.get("peer")):
                    client = None
                    try:
                        client = aioesphomeapi.APIClient(host, 6053, "", noise_psk=record["noise_key"],
                                           client_info="Anything to ESPHome Lite verification")
                        disconnected = asyncio.Event()
                        changed = asyncio.Event()

                        async def stopped(_expected):
                            disconnected.set()
                            changed.set()

                        async with asyncio.timeout(8):
                            await client.connect(on_stop=stopped, login=True, log_errors=False)
                            info = await client.device_info()
                            try:
                                actual_mac = mac_normalize(info.mac_address)
                            except (TypeError, ValueError):
                                raise InstallerError("lite_identity_mismatch") from None
                            if actual_mac != mac or info.name != record["name"]:
                                raise InstallerError("lite_identity_mismatch")
                            if (info.project_name != PROJECTS[record["profile"]]
                                    or info.project_version != str(record["public_version"])):
                                raise InstallerError("lite_version_mismatch")
                            report("lite_check_readings", SENSORS)
                            error = "lite_readings_timeout"
                            entities, _ = await client.list_entities_services()

                        keys = {e.key: e.name for e in entities
                                if isinstance(e, SensorInfo) and e.name in SENSORS}
                        if set(keys.values()) != set(SENSORS):
                            report("lite_check_readings", tuple(s for s in SENSORS if s not in keys.values()))
                            raise InstallerError("lite_sensors_missing")
                        seen = set()

                        def on_state(state):
                            if isinstance(state, SensorState) and state.key in keys:
                                if type(state.state) in (int, float) and math.isfinite(state.state):
                                    seen.add(keys[state.key])
                                else:
                                    seen.discard(keys[state.key])
                                changed.set()

                        client.subscribe_states(on_state)
                        # Keep a live API connection long enough for new readings.
                        # If it drops, repeat discovery and start a fresh sample set.
                        while not disconnected.is_set():
                            missing = tuple(sensor for sensor in SENSORS if sensor not in seen)
                            report("lite_check_readings", missing)
                            if not missing:
                                return host, info
                            changed.clear()
                            await changed.wait()
                    except InstallerError:
                        raise
                    except Exception:
                        # Never retain a private transport error or packet text.
                        pass
                    finally:
                        if client is not None:
                            with suppress(Exception):
                                await asyncio.wait_for(client.disconnect(), 2)
                await asyncio.sleep(RETRY_SECONDS)
    except TimeoutError:
        raise InstallerError(error) from None


def history_entry(attempt):
    """Only safe, stable history fields. No settings snapshots or keys."""
    return {key: attempt[key] for key in ("at", "from_version", "public_version", "state", "error")
            if key in attempt}
