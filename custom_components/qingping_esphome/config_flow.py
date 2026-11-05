"""Configure the local installer once; device credentials are not config fields."""
import voluptuous as vol
from homeassistant import config_entries
from .image import private_ipv4

DOMAIN = "qingping_esphome"


class ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        errors = {}
        if user_input is not None:
            try:
                private_ipv4(user_input["lan_host"])
            except ValueError:
                errors["lan_host"] = "invalid_lan_host"
            else:
                return self.async_create_entry(title="Qingping ESPHome", data=user_input)
        return self.async_show_form(step_id="user", errors=errors, data_schema=vol.Schema({
            vol.Required("lan_host"): str,
            vol.Optional("http_port", default=1887): vol.All(vol.Coerce(int), vol.Range(min=1024, max=65535)),
            vol.Optional("mqtt_port", default=1886): vol.All(vol.Coerce(int), vol.Range(min=1024, max=65535)),
        }))
