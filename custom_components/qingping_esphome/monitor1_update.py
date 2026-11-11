"""Read-only source release notices for the already connected CGS1 profiles."""
from dataclasses import dataclass
from datetime import timedelta
import re

from homeassistant.components.update import UpdateDeviceClass, UpdateEntity, UpdateEntityFeature
from homeassistant.core import callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.event import async_track_time_interval

from .firmware_catalog import MONITOR1_CO2_TYPES, Monitor1Release
from .image import mac_normalize

PROJECTS = {f"ivaschru.qingping_{profile.replace('-', '_')}": profile for profile in MONITOR1_CO2_TYPES}


@dataclass(frozen=True)
class ConnectedMonitor:
    profile: str
    version: str


def connected_monitors(hass):
    """Use ESPHome's cached identity and project metadata on its existing connection."""
    seen, ambiguous = set(), set()
    monitors = {}
    for entry in hass.config_entries.async_entries("esphome"):
        runtime = getattr(entry, "runtime_data", None)
        if runtime is None or not runtime.available or runtime.device_info is None:
            continue
        info = runtime.device_info
        try:
            mac = mac_normalize(info.mac_address)
            if mac != mac_normalize(entry.unique_id):
                continue
        except (AttributeError, TypeError, ValueError):
            continue
        if mac in seen:
            ambiguous.add(mac)
        seen.add(mac)
        profile = PROJECTS.get(info.project_name)
        version = info.project_version
        if (profile and entry.data.get("noise_psk") and isinstance(version, str)
                and re.fullmatch(r"[1-9][0-9]{0,15}", version) and int(version) < 2**53):
            monitors[mac] = ConnectedMonitor(profile, version)
    return {mac: monitor for mac, monitor in monitors.items() if mac not in ambiguous}


def track_monitor1_updates(hass, entry, coordinator, async_add_entities):
    entities = {}

    @callback
    def reconcile(_now=None):
        current = connected_monitors(hass)
        for mac, entity in entities.items():
            entity.observe(current.get(mac))
        new = []
        for mac, monitor in current.items():
            if mac not in entities:
                entities[mac] = Monitor1FirmwareUpdate(coordinator, mac, monitor)
                new.append(entities[mac])
        if new:
            async_add_entities(new)

    # ESPHome can load or reconnect after the installer. This inventory only
    # reads HA's cache and adds no API requests or connections to a monitor.
    entry.async_on_unload(async_track_time_interval(hass, reconcile, timedelta(minutes=1)))
    reconcile()


class Monitor1FirmwareUpdate(UpdateEntity):
    _attr_has_entity_name = True
    _attr_device_class = UpdateDeviceClass.FIRMWARE
    _attr_translation_key = "firmware"
    _attr_title = "Qingping Air Monitor 1"
    _attr_should_poll = False
    # A source kit needs the private matching Qt files and a coordinated
    # bridge/native/guardian deployment. Expose the release without INSTALL.
    _attr_supported_features = UpdateEntityFeature.RELEASE_NOTES

    def __init__(self, coordinator, mac, monitor):
        self.coordinator = coordinator
        self._attr_unique_id = f"qingping_esphome_{mac.lower()}_monitor1_firmware"
        self._attr_device_info = DeviceInfo(connections={(dr.CONNECTION_NETWORK_MAC, dr.format_mac(mac))})
        self._monitor = monitor
        self._listening = False
        self._refresh()

    @property
    def release(self):
        if self._monitor is None:
            return None
        release = (self.coordinator.data or {}).get(self._monitor.profile)
        return release if isinstance(release, Monitor1Release) else None

    def _refresh(self):
        self._attr_available = self._monitor is not None
        if self._monitor is not None:
            self._attr_installed_version = self._monitor.version
        release = self.release
        self._attr_latest_version = str(release.public_version) if release else None
        self._attr_release_url = release.release_url if release else None
        self._attr_release_summary = "A private build is required for this Monitor 1 source release." if release else None

    @callback
    def observe(self, monitor):
        if monitor != self._monitor:
            self._monitor = monitor
            self._changed()

    @callback
    def _changed(self):
        self._refresh()
        if self._listening:
            self.async_write_ha_state()

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        self.async_on_remove(self.coordinator.async_add_listener(self._changed))
        self._listening = True
        self._refresh()

    async def async_will_remove_from_hass(self):
        # The inventory can still observe this device if the entity alone was
        # disabled. Stop publishing state when HA removes the entity.
        self._listening = False
        await super().async_will_remove_from_hass()

    async def async_update(self):
        await self.coordinator.async_request_refresh()

    def version_is_newer(self, latest_version, installed_version):
        return int(latest_version) > int(installed_version)

    async def async_release_notes(self):
        release = self.release
        if release is None:
            return ""
        return ("Build the exact source revision with the monitor's private profile and stock Qt files.\n\n"
                f"[Monitor 1 source kit]({release.release_url})")
