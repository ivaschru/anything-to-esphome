"""An administrator-only HACS panel and local first-install transport."""
from pathlib import Path

import voluptuous as vol
from homeassistant.components import frontend, panel_custom, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.exceptions import ConfigEntryNotReady

from .catalog import CATALOG
from .manager import DOMAIN, Manager
from .network_setup import NetworkDetectionError


async def async_setup(hass, config):
    return True


async def async_setup_entry(hass, entry):
    manager = Manager(hass, entry)
    try: await manager.start()
    except NetworkDetectionError as error:
        raise ConfigEntryNotReady("Не удалось определить локальную сеть; доступны дополнительные настройки интеграции") from error
    except OSError as error:
        raise ConfigEntryNotReady("Не удалось открыть локальные порты; доступны дополнительные настройки интеграции") from error
    hass.data[DOMAIN] = manager
    marker = DOMAIN + "_registered"
    if not hass.data.get(marker):
        await hass.http.async_register_static_paths([
            StaticPathConfig(f"/api/{DOMAIN}/static", str(Path(__file__).parent / "frontend"), cache_headers=False)
        ])
        register_ws(hass)
        hass.data[marker] = True
    await panel_custom.async_register_panel(hass, frontend_url_path=DOMAIN,
        webcomponent_name="qingping-installer-panel", sidebar_title="Qingping ESPHome",
        sidebar_icon="mdi:chip", module_url=f"/api/{DOMAIN}/static/panel.js", require_admin=True)
    entry.async_on_unload(entry.add_update_listener(async_reload_entry))
    return True


async def async_reload_entry(hass, entry):
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass, entry):
    manager = hass.data.pop(DOMAIN)
    await manager.stop()
    frontend.async_remove_panel(hass, DOMAIN)
    return True


def register_ws(hass):
    async def dispatch(hass, connection, message):
        if not connection.user or not connection.user.is_admin:
            connection.send_error(message["id"], "unauthorized", "Нужны права администратора HA")
            return
        manager = hass.data.get(DOMAIN)
        if manager is None:
            connection.send_error(message["id"], "not_loaded", "Интеграция не запущена")
            return
        try:
            operation = message["operation"]
            if operation == "catalog": result = {"models": CATALOG}
            elif operation == "create": result = await manager.create(connection.user.id, message["data"])
            elif operation == "status": result = await manager.status(message["session"], connection.user.id)
            elif operation == "cancel":
                session = manager.get(message["session"], connection.user.id)
                if session.sent: raise ValueError("Команда уже отправлялась; требуется проверка результата")
                if session.writer: session.writer.close()
                session.image = b""
                manager.relay.sessions.pop(session.id)
                result = {"cancelled": True}
            elif operation == "arm":
                session = manager.get(message["session"], connection.user.id)
                session.armed = True
                await manager.relay.maybe_flash(session)
                result = session.public()
            else: raise ValueError("Неизвестная операция")
            connection.send_result(message["id"], result)
        except ValueError as error:
            connection.send_error(message["id"], "invalid_request", str(error))
        except Exception:
            # Never attach request data/exception text containing private fields.
            connection.send_error(message["id"], "operation_failed", "Операция не завершена. Проверьте сессию перед повтором")
    handler = websocket_api.websocket_command({
        vol.Required("type"): DOMAIN + "/command",
        vol.Required("operation"): vol.In(["catalog", "create", "status", "arm", "cancel"]),
        vol.Optional("data"): dict,
        vol.Optional("session"): str,
    })(websocket_api.async_response(dispatch))
    websocket_api.async_register_command(hass, handler)
