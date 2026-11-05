"""Fixed two-image full-runtime release over the existing encrypted API.

The approved manifest is compiled locally; an API caller supplies only its
nonce, artifact kind and streamed bytes. This never accepts a command/path.
"""
import re
import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.const import CONF_ID, PLATFORM_HOST
from esphome.components.api import APIServer
from esphome.components.esphome.ota import ESPHomeOTAComponent

DEPENDENCIES = ["api", "ota"]
AUTO_LOAD = ["json", "sha256"]
ns = cg.esphome_ns.namespace("cgs1_full_runtime")
FullRuntime = ns.class_("FullRuntime", cg.Component)


def sha256(value):
    value = cv.string_strict(value)
    if not re.fullmatch(r"[0-9a-f]{64}", value):
        raise cv.Invalid("Expected a lowercase SHA-256 digest")
    return value


ARTIFACT = cv.Schema({cv.Required("size"): cv.int_range(min=1, max=16*1024*1024),
                      cv.Required("sha256"): sha256})
CONFIG_SCHEMA = cv.All(cv.Schema({
    cv.GenerateID(): cv.declare_id(FullRuntime),
    cv.Required("api_id"): cv.use_id(APIServer),
    cv.Required("ota_id"): cv.use_id(ESPHomeOTAComponent),
    # An explicit build-time opt-in. No remote API toggles this behavior and
    # existing full/rollback profiles retain observation-only semantics.
    cv.Optional("recover_original_network_after_return", default=False): cv.boolean,
    # Only the ordinary core profile opts in. Older diagnostic builds cannot
    # install a persistent pair or activate it merely by sharing API actions.
    cv.Optional("core_release_autostart", default=False): cv.boolean,
    cv.Required("artifacts"): cv.Schema({cv.Required(name): ARTIFACT
                                         for name in ("native-program", "guardian-program")}),
}).extend(cv.COMPONENT_SCHEMA), cv.only_on(PLATFORM_HOST))


async def to_code(config):
    cg.add_define("USE_CGS1_TRANSPORT_GATE")
    var = cg.new_Pvariable(config[CONF_ID])
    await cg.register_component(var, config)
    cg.add(var.set_api(await cg.get_variable(config["api_id"])))
    cg.add(var.set_ota(await cg.get_variable(config["ota_id"])))
    cg.add(var.set_recover_original_network_after_return(config["recover_original_network_after_return"]))
    cg.add(var.set_core_release_autostart(config["core_release_autostart"]))
    for index, name in enumerate(("native-program", "guardian-program")):
        spec = config["artifacts"][name]
        cg.add(var.set_artifact(index, spec["size"], spec["sha256"]))
