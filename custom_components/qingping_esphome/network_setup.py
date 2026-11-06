"""Use HA's own network selection instead of asking people for an IP.

No sensor discovery, cloud lookup or network scan is needed. The preferred
source address follows the interfaces enabled in HA's network settings. Only
if it is unusable do we consider a single unambiguous enabled LAN address.
"""
from homeassistant.components import network
from homeassistant.exceptions import HomeAssistantError

from .image import private_ipv4

DEFAULT_HTTP_PORT = 1887
DEFAULT_MQTT_PORT = 1886


class NetworkDetectionError(ValueError):
    """No unambiguous local IPv4 was available for the stock monitor."""


async def async_detect_lan_host(hass):
    try:
        return private_ipv4(await network.async_get_source_ip(hass))
    except (HomeAssistantError, OSError, ValueError):
        pass
    try:
        adapters = await network.async_get_adapters(hass)
    except (HomeAssistantError, OSError) as error:
        raise NetworkDetectionError("Не удалось определить локальный адрес HA") from error
    candidates = set()
    for adapter in adapters:
        if not adapter["enabled"]:
            continue
        for address in adapter["ipv4"]:
            try:
                candidates.add(private_ipv4(address["address"]))
            except ValueError:
                pass
    if len(candidates) == 1:
        return candidates.pop()
    # Do not pick a random Docker/VPN/secondary interface when HA itself did
    # not choose a usable source. The fallback asks only for the missing IP.
    raise NetworkDetectionError("Не удалось однозначно определить локальный адрес HA")


def automatic_settings(host):
    return {"lan_host": host, "http_port": DEFAULT_HTTP_PORT,
            "mqtt_port": DEFAULT_MQTT_PORT, "automatic_network": True}
