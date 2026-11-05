"""Persistent display-only HA entity binding, validated on the device.

ESPHome template text's pattern is frontend metadata, not backend validation.
This platform rejects malformed identifiers before publishing or persisting.
"""
import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import text
from esphome.const import CONF_ID, PLATFORM_HOST

ns = cg.esphome_ns.namespace("cgs1_source")
SourceText = ns.class_("SourceText", text.Text, cg.Component)
CONFIG_SCHEMA = cv.All(
    text.text_schema(SourceText, mode="TEXT").extend(cv.COMPONENT_SCHEMA),
    cv.only_on(PLATFORM_HOST),
)

async def to_code(config):
    var = await text.new_text(config, min_length=0, max_length=255,
                              pattern=r"^(sensor\.[a-z0-9_]+)?$")
    await cg.register_component(var, config)
