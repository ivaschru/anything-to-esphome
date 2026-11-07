"""Local CGDN1 UI bindings; all settings use the existing typed entities.

No credentials enter code generation here. Wi-Fi credentials are read/edited
inside the device and committed by the bounded on-device connection trial.
"""
import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import font, number, sensor, switch, wifi, select, datetime, button
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

# Order matches the pure Key enum. These are references to the existing typed
# entities, not a parallel preference schema or duplicated defaults/ranges.
_bindings = {
    "numbers": (number.Number, {0:"display_level",3:"idle_screen_delay",13:"tc_temp_offset",14:"tc_rh_offset",17:"hc_a6",18:"hc_a1",19:"hc_tau_d1",20:"hc_tau_d2",21:"hc_a_bt",22:"hc_tau_bt"}),
    "switches": (switch.Switch, {1:"display_switch",6:"night_switch",9:"pm_enabled",10:"led_switch",12:"ble_switch",16:"hc_bt_comp"}),
    "selects": (select.Select, {2:"idle_screen",4:"ui_design",5:"ui_motion",11:"led_pm_standard",15:"hc_model",23:"display_test_pattern"}),
    "times": (datetime.TimeEntity, {7:"night_start",8:"night_end"}),
}

_fonts = ["font_small", "font_title", "font_medium", "font_large", "font_number", "font_summary"]
CONFIG_SCHEMA = cv.Schema({
    cv.GenerateID(): cv.declare_id(Cgdn1Ui),
    **{cv.Required(group): cv.Schema({cv.Required(str(key)): cv.use_id(cls) for key in entries}) for group,(cls,entries) in _bindings.items()},
    cv.Required("font_status"): cv.use_id(font.Font),
    cv.Required("restart_button"): cv.use_id(button.Button),
    cv.Required("slot_button"): cv.use_id(button.Button),
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

    for group, (cls, entries) in _bindings.items():
        method = {"numbers":"bind_number", "switches":"bind_switch", "selects":"bind_select", "times":"bind_time"}[group]
        for key in entries:
            cg.add(getattr(var, method)(key, await cg.get_variable(config[group][str(key)])))
    cg.add(var.set_action_buttons(await cg.get_variable(config["restart_button"]), await cg.get_variable(config["slot_button"])))

    cg.add(var.set_status_font(await cg.get_variable(config["font_status"])))
