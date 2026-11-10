import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import http_request, update
from . import ns

NativeUpdate = ns.class_("NativeUpdate", update.UpdateEntity, cg.PollingComponent)
CONFIG_SCHEMA = update.update_schema(NativeUpdate, device_class="firmware").extend({
    cv.GenerateID("http_request_id"): cv.use_id(http_request.HttpRequestComponent),
    cv.Required("profile"): cv.one_of("sonoff-s60tpf"),
    cv.Required("revision"): cv.int_range(min=1, max=1000000),
    cv.Required("public_version"): cv.int_range(min=1, max=1000000),
}).extend(cv.polling_component_schema("6h"))

async def to_code(config):
    var = await update.new_update(config)
    await cg.register_component(var, config)
    cg.add(var.set_request_parent(await cg.get_variable(config["http_request_id"])))
    cg.add(var.set_identity(config["profile"], config["revision"], config["public_version"]))
