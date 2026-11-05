"""Native CGS1 720x720 DRM panel, initially restricted to guarded RAM trials.

This is a local external ESPHome display platform, not an ESP32 pin mapping
or an SDL desktop window. The runtime independently checks panel topology
and the guardian's private RAM directory before claiming DRM ownership.
"""
import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import display, font, sensor
from esphome.const import CONF_ID, PLATFORM_HOST
from esphome.core import CORE
from . import NATIVE_COMPILE_FLAGS

ns=cg.esphome_ns.namespace("cgs1_panel")
Panel=ns.class_("Panel",display.DisplayBuffer,cg.PollingComponent)
FONTS=tuple("font_"+name for name in ("small","label","body","title","value","big","detail","saver","temperature"))
SENSORS=("co2_sensor","temperature_sensor","humidity_sensor","pm25_sensor","voc_sensor")
CONFIG_SCHEMA=cv.All(display.FULL_DISPLAY_SCHEMA.extend({
    cv.GenerateID():cv.declare_id(Panel),
    **{cv.Required(key):cv.use_id(font.Font) for key in FONTS},
    **{cv.Required(key):cv.use_id(sensor.Sensor) for key in SENSORS},
    cv.Optional("raw_temperature",default=True):cv.boolean,
    cv.Optional("headless",default=False):cv.boolean,
    cv.Optional("ha_sources",default=False):cv.boolean,
}).extend(cv.polling_component_schema("500ms")),cv.only_on(PLATFORM_HOST))

async def to_code(config):
    # Without -O2 this ARMv7 software framebuffer took 467–530 ms per frame.
    # Core build flags enter ninja's compile commands, forcing a proper full
    # rebuild rather than silently mixing objects after a wrapper-only edit.
    for flag in NATIVE_COMPILE_FLAGS:
        cg.add_build_flag(flag)
    if config["ha_sources"]:
        if "api" not in CORE.config:
            raise cv.Invalid("ha_sources requires the native API")
        cg.add_define("USE_API_HOMEASSISTANT_STATES")
    # DRM map offsets are 64-bit even on this 32-bit ARM userspace.
    cg.add_build_flag("-D_FILE_OFFSET_BITS=64")
    var=cg.new_Pvariable(config[CONF_ID])
    await display.register_display(var,config)
    for key in FONTS:
        cg.add(getattr(var,"set_"+key)(await cg.get_variable(config[key])))
    for key in SENSORS:
        cg.add(getattr(var,"set_"+key)(await cg.get_variable(config[key])))
    cg.add(var.set_raw_temperature(config["raw_temperature"]))
    cg.add(var.set_headless(config["headless"]))
