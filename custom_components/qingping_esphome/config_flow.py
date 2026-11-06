"""Normal setup needs no technical fields; manual settings are a fallback."""
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback

from .image import private_ipv4
from .network_setup import (
    DEFAULT_HTTP_PORT, DEFAULT_MQTT_PORT, NetworkDetectionError,
    async_detect_lan_host, automatic_settings,
)

DOMAIN = "qingping_esphome"


class ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return OptionsFlow()

    async def async_step_user(self, user_input=None):
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        try:
            host = await async_detect_lan_host(self.hass)
        except NetworkDetectionError:
            return await self.async_step_manual()
        # Selecting Add integration already starts the requested setup. There
        # is no reason for a second confirmation of values HA knows itself.
        return self.async_create_entry(title="Qingping ESPHome", data=automatic_settings(host))

    async def async_step_manual(self, user_input=None):
        errors = {}
        if user_input is not None:
            try:
                host = private_ipv4(user_input["lan_host"])
            except ValueError:
                errors["lan_host"] = "invalid_lan_host"
            else:
                data = automatic_settings(host)
                data["automatic_network"] = False
                return self.async_create_entry(title="Qingping ESPHome", data=data)
        return self.async_show_form(step_id="manual", errors=errors, data_schema=vol.Schema({
            vol.Required("lan_host"): str,
        }))


class OptionsFlow(config_entries.OptionsFlow):
    """Optional manual override, outside the ordinary installation path."""

    async def async_step_init(self, user_input=None):
        return self.async_show_menu(step_id="init", menu_options=["interface", "automatic", "manual"])

    async def async_step_interface(self, user_input=None):
        # OptionsFlow replaces the entire options mapping. Preserve all prior
        # network overrides when changing only navigation visibility.
        if user_input is not None:
            return self.async_create_entry(title="", data={**self.config_entry.options,
                                                           "show_sidebar": user_input["show_sidebar"]})
        current = {**self.config_entry.data, **self.config_entry.options}
        return self.async_show_form(step_id="interface", data_schema=vol.Schema({
            vol.Required("show_sidebar", default=current.get("show_sidebar", True)): bool,
        }))

    async def async_step_automatic(self, user_input=None):
        try:
            host = await async_detect_lan_host(self.hass)
        except NetworkDetectionError:
            return await self.async_step_manual(detection_failed=True)
        return self.async_create_entry(title="", data={**self.config_entry.options, **automatic_settings(host)})

    async def async_step_manual(self, user_input=None, *, detection_failed=False):
        current = {**self.config_entry.data, **self.config_entry.options}
        errors = {"base": "cannot_detect_address"} if detection_failed else {}
        if user_input is not None:
            try:
                private_ipv4(user_input["lan_host"])
            except ValueError:
                errors["lan_host"] = "invalid_lan_host"
            if user_input["http_port"] == user_input["mqtt_port"]:
                errors["base"] = "ports_must_differ"
            if not errors:
                return self.async_create_entry(title="", data={**self.config_entry.options, **user_input, "automatic_network": False})
        values = {**current, **(user_input or {})}
        port = vol.All(vol.Coerce(int), vol.Range(min=1024, max=65535))
        return self.async_show_form(step_id="manual", errors=errors, data_schema=vol.Schema({
            vol.Required("lan_host", default=values.get("lan_host", "")): str,
            vol.Required("http_port", default=values.get("http_port", DEFAULT_HTTP_PORT)): port,
            vol.Required("mqtt_port", default=values.get("mqtt_port", DEFAULT_MQTT_PORT)): port,
        }))
