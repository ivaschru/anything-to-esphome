"""Local CGDN1 UI bindings; all settings use the existing typed entities.

No credentials enter code generation here. Wi-Fi credentials are read/edited
inside the device and committed by the bounded on-device connection trial.
"""
import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import font, number, sensor, switch, wifi
from esphome.components.cgdn1_display.display import Cgdn1Display
from esphome.components.cgdn1_pm import Cgdn1Pm
from esphome.const import CONF_ID

DEPENDENCIES = ["esp32", "wifi", "display", "api"]
ns = cg.esphome_ns.namespace("cgdn1_ui")
Cgdn1Ui = ns.class_("Cgdn1Ui", cg.Component)
_refs = {
    "display_id": Cgdn1Display, "brightness_id": number.Number,
    "pm_switch_id": switch.Switch, "ble_switch_id": switch.Switch, "night_switch_id": switch.Switch,
    "pm_power_id": Cgdn1Pm, "battery_id": sensor.Sensor, "pm25_id": sensor.Sensor,
}
_fonts = ["font_small", "font_title", "font_medium", "font_large", "font_number", "font_summary"]
CONFIG_SCHEMA = cv.Schema({
    cv.GenerateID(): cv.declare_id(Cgdn1Ui),
    # Temporary child-only build. False omits every GPIO23 trial entry point.
    cv.Optional("gpio23_probe", default=False): cv.boolean,
    cv.Optional("weak17_probe", default=False): cv.boolean,
    **{cv.Required(key): cv.use_id(cls) for key, cls in _refs.items()},
    **{cv.Required(key): cv.use_id(font.Font) for key in _fonts},
}).extend(cv.COMPONENT_SCHEMA)


async def to_code(config):
    if config["gpio23_probe"] and config["weak17_probe"]:
        raise cv.Invalid("Only one temporary physical experiment may be compiled")
    if config["gpio23_probe"]:
        cg.add_define("CGDN1_GPIO23_PROBE")
    if config["weak17_probe"]:
        cg.add_define("CGDN1_WEAK17_PROBE")
    wifi.request_wifi_scan_results()
    wifi.request_wifi_scan_results_listener()
    var = cg.new_Pvariable(config[CONF_ID])
    await cg.register_component(var, config)
    for key in _refs:
        cg.add(getattr(var, "set_" + key.removesuffix("_id"))(await cg.get_variable(config[key])))
    cg.add(var.set_fonts(*[await cg.get_variable(config[key]) for key in _fonts]))
