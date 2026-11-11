"""Monitor 1 release notices and installation of prepared private bundles."""
from dataclasses import dataclass
from datetime import timedelta
import asyncio
import re

from homeassistant.components.update import UpdateDeviceClass, UpdateEntity, UpdateEntityFeature
from homeassistant.core import callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.event import async_track_time_interval

from .firmware_catalog import FirmwareError, MONITOR1_CO2_TYPES, Monitor1Release
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


def track_monitor1_updates(hass, entry, coordinator, async_add_entities, installer=None):
    entities = {}

    @callback
    def reconcile(_now=None):
        current = connected_monitors(hass)
        for mac, entity in entities.items():
            entity.observe(current.get(mac))
        new = []
        for mac, monitor in current.items():
            if mac not in entities:
                entities[mac] = Monitor1FirmwareUpdate(coordinator, mac, monitor, installer)
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
    _attr_supported_features = UpdateEntityFeature.RELEASE_NOTES

    def __init__(self, coordinator, mac, monitor, installer=None):
        self.coordinator = coordinator
        self.mac, self.installer = mac, installer
        self._attr_unique_id = f"qingping_esphome_{mac.lower()}_monitor1_firmware"
        self._attr_device_info = DeviceInfo(connections={(dr.CONNECTION_NETWORK_MAC, dr.format_mac(mac))})
        self._monitor = monitor
        self._listening = False
        self._prepared = None
        self._pending_version = None
        self._active_version = None
        self._active_release = None
        self._install_task = None
        self._check = None
        self._refresh()

    @property
    def release(self):
        if self._active_release is not None:
            return self._active_release
        if self._monitor is None:
            return None
        release = (self.coordinator.data or {}).get(self._monitor.profile)
        return release if isinstance(release, Monitor1Release) else None

    def _refresh(self):
        self._attr_available = self._monitor is not None or self._active_version is not None
        if self._active_version or self._pending_version:
            self._attr_installed_version = self._active_version or self._pending_version
        elif self._monitor is not None:
            self._attr_installed_version = self._monitor.version
        release = self.release
        self._attr_latest_version = str(release.public_version) if release else None
        self._attr_release_url = release.release_url if release else None
        prepared = self._prepared == (self._monitor, release) and release is not None
        self._attr_supported_features = UpdateEntityFeature.RELEASE_NOTES
        if prepared and not self._pending_version:
            self._attr_supported_features |= UpdateEntityFeature.INSTALL | UpdateEntityFeature.PROGRESS
        self._attr_release_summary = (
            "A previous installation needs review." if self._pending_version else
            "Private firmware is prepared for installation." if prepared else
            "A private build is required for this Monitor 1 source release." if release else None)

    @callback
    def observe(self, monitor):
        if monitor != self._monitor:
            self._monitor = monitor
            self._changed()
        self._schedule_check()

    @callback
    def _changed(self):
        self._refresh()
        if self._listening:
            self.async_write_ha_state()
            self._schedule_check()

    @callback
    def _schedule_check(self):
        if self.installer and self._listening and not self._active_version and (self._check is None or self._check.done()):
            self._check = self.hass.async_create_task(self._check_candidate())

    async def _check_candidate(self):
        observed = self._monitor, self.release
        try:
            ready, pending = await self.installer.status(self.mac, *observed)
        except Exception:
            ready, pending = False, self._pending_version
        if self._listening and not self._active_version and observed == (self._monitor, self.release):
            self._prepared = observed if ready else None
            self._pending_version = pending
            self._refresh()
            self.async_write_ha_state()

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        self.async_on_remove(self.coordinator.async_add_listener(self._changed))
        self._listening = True
        self._refresh()
        self._schedule_check()

    async def async_will_remove_from_hass(self):
        # The inventory can still observe this device if the entity alone was
        # disabled. Stop publishing state when HA removes the entity.
        self._listening = False
        if self._check is not None:
            self._check.cancel()
        if self._install_task is not None and self._install_task is not asyncio.current_task():
            self._install_task.cancel()
        await super().async_will_remove_from_hass()

    async def async_update(self):
        await self.coordinator.async_request_refresh()
        if self.installer and self._pending_version and self._monitor and not self._active_version:
            esphome = self._esphome_entry(self._monitor)
            try:
                if await self.installer.reconcile(self.mac, self._monitor, esphome):
                    self._pending_version = None
                    self._changed()
            except Exception:
                raise HomeAssistantError("The installed Monitor 1 version could not be confirmed") from None

    def version_is_newer(self, latest_version, installed_version):
        return int(latest_version) > int(installed_version)

    def _esphome_entry(self, monitor):
        candidates = []
        for entry in self.hass.config_entries.async_entries("esphome"):
            try:
                if mac_normalize(entry.unique_id) == self.mac:
                    candidates.append(entry)
            except ValueError:
                continue
        if len(candidates) != 1 or connected_monitors(self.hass).get(self.mac) != monitor:
            raise HomeAssistantError("The connected Monitor 1 identity changed")
        return candidates[0]

    async def async_install(self, version, backup, **kwargs):
        user_id = self._context.user_id if self._context else None
        user = await self.hass.auth.async_get_user(user_id) if user_id else None
        if user is None or not user.is_admin:
            raise HomeAssistantError(translation_domain="qingping_esphome", translation_key="firmware_admin_required")
        monitor, release = self._monitor, self.release
        if (backup or release is None or not self.installer or self._prepared != (monitor, release)
                or version not in (None, str(release.public_version)) or self._active_version):
            raise HomeAssistantError(translation_domain="qingping_esphome", translation_key="monitor1_update_private_bundle_required")
        esphome = self._esphome_entry(monitor)
        self._active_version = monitor.version
        self._active_release = release
        self._install_task = asyncio.current_task()
        self._attr_in_progress = True
        self._attr_update_percentage = None
        self._changed()

        @callback
        def progress(fraction):
            self._attr_update_percentage = min(80, int(80 * fraction))
            if self._listening:
                self.async_write_ha_state()

        try:
            await self.installer.install(self.mac, monitor, release, esphome, progress)
            self._monitor = ConnectedMonitor(monitor.profile, str(release.public_version))
        except FirmwareError as error:
            raise HomeAssistantError(translation_domain="qingping_esphome", translation_key=str(error)) from None
        except Exception:
            raise HomeAssistantError(translation_domain="qingping_esphome", translation_key="monitor1_update_unverified") from None
        finally:
            self._active_version = None
            self._active_release = None
            self._install_task = None
            self._prepared = None
            self._attr_in_progress = False
            self._attr_update_percentage = None
            self._changed()

    async def async_release_notes(self):
        release = self.release
        if release is None:
            return ""
        return ("Build the exact source revision with the monitor's private profile and stock Qt files.\n\n"
                f"[Monitor 1 source kit]({release.release_url})")
