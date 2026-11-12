"""An administrator-only HACS panel and local first-install transport."""
from pathlib import Path
import json

import voluptuous as vol
from homeassistant.components import frontend, panel_custom, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.exceptions import ConfigEntryNotReady
from homeassistant.helpers import device_registry as dr
from homeassistant.const import Platform

from .catalog import CATALOG
from .manager import DOMAIN, Manager
from .network_setup import NetworkDetectionError
from .monitor1 import Monitor1, Monitor1View
from .errors import InstallerError, MESSAGES
from .sonoff import Sonoff
from .sonoff_policy import SonoffError

NETWORK_KEYS = ("automatic_network", "lan_host", "http_port", "mqtt_port")
# The public panel path is independent of HA's integration identity. Keep
# DOMAIN for config entries, persistent data, static assets and the WS API.
PANEL_PATH = "anything-to-esphome"


def register_installer_device(hass, entry):
    """One service card provides an origin-independent link to the panel."""
    return dr.async_get(hass).async_get_or_create(config_entry_id=entry.entry_id,
        identifiers={(DOMAIN, "installer")}, entry_type=dr.DeviceEntryType.SERVICE,
        name="Anything to ESPHome", model="Firmware installer",
        configuration_url=f"homeassistant://{PANEL_PATH}")


def apply_sidebar(hass, show_sidebar):
    """Update navigation in place; never stop the broker or an active session."""
    panel = hass.data[frontend.DATA_PANELS][PANEL_PATH]
    frontend.async_register_built_in_panel(hass, component_name=panel.component_name,
        frontend_url_path=PANEL_PATH, sidebar_title="Anything to ESPHome" if show_sidebar else None,
        sidebar_icon="mdi:chip", config=panel.config, require_admin=True,
        show_in_sidebar=show_sidebar, update=True)


async def async_setup(hass, config):
    return True


async def async_setup_entry(hass, entry):
    manager = Manager(hass, entry)
    manager.monitor1 = Monitor1(hass)
    manager.sonoff = Sonoff(manager)
    try:
        await manager.start()
        await manager.sonoff.start()
    except NetworkDetectionError as error:
        await manager.sonoff.stop()
        await manager.stop()
        raise ConfigEntryNotReady("Could not detect the LAN address; integration network options are available") from error
    except OSError as error:
        await manager.sonoff.stop()
        await manager.stop()
        raise ConfigEntryNotReady("Could not open local ports; integration network options are available") from error
    except BaseException:
        # A private Sonoff journal read may fail after the shared listeners
        # started. Retire those owned resources before HA retries setup.
        await manager.sonoff.stop()
        await manager.stop()
        raise
    hass.data[DOMAIN] = manager
    try:
        return await _async_setup_loaded_entry(hass, entry, manager)
    except BaseException:
        # A platform/translation/setup failure must not leave stock listeners
        # or an owned update task alive when HA retries this config entry.
        hass.data.pop(DOMAIN, None)
        await manager.monitor1.stop()
        await manager.sonoff.stop()
        await manager.stop()
        raise


async def _async_setup_loaded_entry(hass, entry, manager):
    marker = DOMAIN + "_registered"
    if not hass.data.get(marker):
        await hass.http.async_register_static_paths([
            StaticPathConfig(f"/api/{DOMAIN}/static", str(Path(__file__).parent / "frontend"), cache_headers=False)
        ])
        register_ws(hass)
        from .sonoff_view import SonoffBackupView, SonoffDiagnosticsView
        hass.http.register_view(SonoffBackupView())
        hass.http.register_view(SonoffDiagnosticsView())
        hass.http.register_view(Monitor1View())
        hass.data[marker] = True
    await panel_custom.async_register_panel(hass, frontend_url_path=PANEL_PATH,
        webcomponent_name="qingping-installer-panel", sidebar_title="Anything to ESPHome",
        sidebar_icon="mdi:chip", module_url=f"/api/{DOMAIN}/static/panel.js", require_admin=True)
    try:
        apply_sidebar(hass, manager.settings.get("show_sidebar", True))
        # HA resolves the service device's homeassistant:// link against the
        # current frontend origin, including behind a reverse proxy.
        register_installer_device(hass, entry)
        from .firmware_update import FirmwareUpdates
        version = await hass.async_add_executor_job(
            lambda: json.loads((Path(__file__).parent / "manifest.json").read_text())["version"])
        manager.updates = FirmwareUpdates(manager, version)
        await hass.config_entries.async_forward_entry_setups(entry, [Platform.UPDATE])
        from .auto_adoption import AutoAdoption
        manager.adoption = AutoAdoption(manager)
        manager.adoption.start()
        entry.async_on_unload(entry.add_update_listener(async_reload_entry))
    except BaseException:
        # Clean up only after we registered the panel. If the route was
        # already taken, registration raises without touching its owner.
        frontend.async_remove_panel(hass, PANEL_PATH)
        raise
    return True


async def async_reload_entry(hass, entry):
    current = {**entry.data, **entry.options}
    manager = hass.data.get(DOMAIN)
    if manager is None or any(current.get(key) != manager.settings.get(key) for key in NETWORK_KEYS):
        await hass.config_entries.async_reload(entry.entry_id)
        return
    apply_sidebar(hass, current.get("show_sidebar", True))
    manager.settings = current


async def async_unload_entry(hass, entry):
    if not await hass.config_entries.async_unload_platforms(entry, [Platform.UPDATE]):
        return False
    manager = hass.data.pop(DOMAIN)
    await manager.monitor1.stop()
    await manager.sonoff.stop()
    await manager.stop()
    frontend.async_remove_panel(hass, PANEL_PATH)
    return True


def register_ws(hass):
    async def dispatch(hass, connection, message):
        if not connection.user or not connection.user.is_admin:
            connection.send_error(message["id"], "qingping_unauthorized", MESSAGES["unauthorized"])
            return
        manager = hass.data.get(DOMAIN)
        if manager is None:
            connection.send_error(message["id"], "qingping_not_loaded", MESSAGES["not_loaded"])
            return
        try:
            operation = message["operation"]
            if operation.startswith("sonoff_"):
                result = await manager.sonoff.call(connection.user.id, operation, message.get("data", {}))
            elif operation == "catalog": result = {"models": CATALOG, "brands": ["qingping", "sonoff"]}
            elif operation == "ble_scan": result = await manager.bluetooth.scan()
            elif operation == "ble_select": result = await manager.bluetooth.select(connection.user.id, message["address"])
            elif operation == "ble_provision": result = await manager.provision(message["session"], connection.user.id)
            elif operation == "create": result = await manager.create(connection.user.id, message["data"])
            elif operation == "status": result = await manager.status(message["session"], connection.user.id)
            elif operation == "cancel":
                result = manager.cancel(message["session"], connection.user.id)
            elif operation == "arm":
                result = await manager.arm(message["session"], connection.user.id)
            else: raise InstallerError("invalid_request")
            connection.send_result(message["id"], result)
        except (InstallerError, SonoffError) as error:
            connection.send_error(message["id"], "qingping_" + error.code, str(error))
        except ValueError:
            connection.send_error(message["id"], "qingping_invalid_request", MESSAGES["invalid_request"])
        except Exception:
            # Never attach request data/exception text containing private fields.
            connection.send_error(message["id"], "qingping_operation_failed", MESSAGES["operation_failed"])
    handler = websocket_api.websocket_command({
        vol.Required("type"): DOMAIN + "/command",
        vol.Required("operation"): vol.In(["catalog", "create", "status", "arm", "cancel", "ble_scan", "ble_select", "ble_provision",
                                           "sonoff_scan", "sonoff_login", "sonoff_select", "sonoff_install", "sonoff_status", "sonoff_jobs", "sonoff_recover"]),
        vol.Optional("data"): dict,
        vol.Optional("session"): str,
        vol.Optional("address"): str,
    })(websocket_api.async_response(dispatch))
    websocket_api.async_register_command(hass, handler)
