"""Standard HA firmware entities, linked to the existing physical ESPHome device."""
from datetime import timedelta

from homeassistant.components.update import UpdateDeviceClass, UpdateEntity, UpdateEntityFeature
from homeassistant.core import callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .firmware_catalog import FirmwareError, device_release_profile
from .firmware_update import fetch_catalog, pending, private_values
from .native_ota import encryption_available

DOMAIN = "qingping_esphome"
PARALLEL_UPDATES = 0  # The updater owns its explicit fleet-wide install lock.


class CatalogCoordinator(DataUpdateCoordinator):
    def __init__(self, hass):
        import logging
        super().__init__(hass, logging.getLogger(__name__), name="Qingping firmware releases",
                         update_interval=timedelta(hours=6))

    async def _async_update_data(self):
        try:
            return await fetch_catalog(self.hass)
        except FirmwareError:
            raise UpdateFailed("Could not check Qingping firmware releases") from None


async def async_setup_entry(hass, entry, async_add_entities):
    manager = hass.data[DOMAIN]
    coordinator = CatalogCoordinator(hass)
    manager.firmware_catalog = coordinator
    # An absent first public index or network outage must not unload the local
    # installer. Entities keep installed versions; latest remains unknown.
    await coordinator.async_refresh()
    added = set()

    @callback
    def add_verified():
        entities = []
        for mac, record in manager.records.items():
            if mac not in added and record.get("outcome") in {"native_verified", "auto_adopted"}:
                # Historical Store v1 was produced only by the Lite installer.
                # Missing private/profile fields never gain INSTALL support.
                if device_release_profile(record) not in {"lite", "lite-434"}: continue
                added.add(mac)
                entities.append(QingpingFirmwareUpdate(manager, coordinator, mac))
        if entities: async_add_entities(entities)

    entry.async_on_unload(manager.add_record_listener(add_verified))
    add_verified()


class QingpingFirmwareUpdate(UpdateEntity):
    _attr_has_entity_name = True
    _attr_device_class = UpdateDeviceClass.FIRMWARE
    _attr_translation_key = "firmware"
    _attr_title = "Qingping ESPHome"
    _attr_should_poll = False

    def __init__(self, manager, coordinator, mac):
        self.manager, self.coordinator, self.mac = manager, coordinator, mac
        self._attr_unique_id = f"{DOMAIN}_{mac.lower()}_firmware"
        self._attr_device_info = DeviceInfo(
            connections={(dr.CONNECTION_NETWORK_MAC, dr.format_mac(mac))},
            identifiers={(DOMAIN, mac)}, manufacturer="Qingping", model="Air Monitor Lite",
            name="Qingping Air Monitor Lite")
        self._phase = "idle"
        self._refresh()

    @property
    def record(self): return self.manager.records[self.mac]

    @property
    def release(self):
        return (self.coordinator.data or {}).get(device_release_profile(self.record))

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        self.async_on_remove(self.coordinator.async_add_listener(self._changed))
        self.async_on_remove(self.manager.add_record_listener(self._changed))

    async def async_update(self):
        # homeassistant.update_entity is an explicit catalog check, not an
        # install command or a reason to contact the physical monitor.
        await self.coordinator.async_request_refresh()

    @callback
    def _changed(self):
        self._refresh()
        self.async_write_ha_state()

    def _refresh(self):
        record, release = self.record, self.release
        self._attr_installed_version = (str(record["public_version"]) if record.get("public_version") is not None
                                        else record.get("firmware_version") or record.get("build"))
        self._attr_latest_version = release.display_version if release else None
        self._attr_release_url = release.release_url if release else None
        self._attr_release_summary = release.summary if release else None
        self._attr_supported_features = UpdateEntityFeature.RELEASE_NOTES
        ready = False
        try:
            private_values(record)
            ready = bool(release and release.supports_install(self.manager.updates.integration_version)
                         and encryption_available())
        except FirmwareError:
            pass
        if ready:
            self._attr_supported_features |= UpdateEntityFeature.INSTALL | UpdateEntityFeature.PROGRESS
        self._attr_extra_state_attributes = {
            "hardware_profile": device_release_profile(record),
            "firmware_build_id": record.get("firmware_version"),
            "update_readiness": "needs_review" if pending(record) else "ready" if ready else "profile_or_backend_required",
            "update_phase": self._phase,
        }

    def version_is_newer(self, latest_version, installed_version):
        # Revisions are profile-local. UI version equality prevents the first
        # catalog from advertising the same firmware bundled with an installer.
        release = self.release
        return bool(release and release.version != self.record.get("firmware_version")
                    and latest_version != installed_version
                    and release.revision > self.record.get("firmware_revision", 0))

    async def async_release_notes(self):
        release = self.release
        return f"{release.summary}\n\n[Release notes]({release.release_url})" if release else ""

    async def async_install(self, version, backup, **kwargs):
        # Keep the installer's administrator-only boundary even when a user
        # calls update.install directly instead of using HA's Settings page.
        context = self._context
        user = await self.hass.auth.async_get_user(context.user_id) if context and context.user_id else None
        if not user or not user.is_admin:
            raise HomeAssistantError(translation_domain=DOMAIN, translation_key="firmware_admin_required")
        release = self.release
        if backup or not release or version not in (None, release.display_version):
            raise HomeAssistantError("This firmware update or backup request is not supported")
        self._attr_in_progress = True
        self._attr_update_percentage = None
        @callback
        def phase(value):
            self._phase = value
            self._attr_update_percentage = None
            self._changed()
        @callback
        def progress(value):
            self._attr_update_percentage = value * 100
            self.async_write_ha_state()
        try:
            await self.manager.updates.install(self.mac, release, progress, phase)
            self._phase = "verified"
        except FirmwareError as error:
            self._phase = "needs_review" if pending(self.record) else "refused"
            raise HomeAssistantError(translation_domain=DOMAIN, translation_key=str(error)) from None
        except Exception:
            self._phase = "needs_review" if pending(self.record) else "refused"
            raise HomeAssistantError(translation_domain=DOMAIN, translation_key="firmware_update_failed") from None
        finally:
            self._attr_in_progress = False
            self._attr_update_percentage = None
            self._changed()
