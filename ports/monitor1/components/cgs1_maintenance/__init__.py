"""Narrow RAM-only artifact staging over the existing authenticated API.

The public build manifest approves exact bytes; the remote caller can neither
choose destination paths nor supply an arbitrary executable to run.
"""
import re
import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.const import CONF_ID, PLATFORM_HOST

AUTO_LOAD = ["sha256", "json"]
DEPENDENCIES = ["api"]
ns = cg.esphome_ns.namespace("cgs1_maintenance")
Maintenance = ns.class_("Maintenance", cg.Component)
def sha256(value):
    value = cv.string_strict(value)
    if not re.fullmatch(r"[0-9a-f]{64}", value):
        raise cv.Invalid("Expected a lowercase SHA-256 digest")
    return value

ARTIFACT = cv.Schema({
    cv.Required("size"): cv.int_range(min=1, max=16*1024*1024),
    cv.Required("sha256"): sha256,
})
CONFIG_SCHEMA = cv.All(cv.Schema({
    cv.GenerateID(): cv.declare_id(Maintenance),
    cv.Required("artifacts"): cv.Schema({cv.Required(name): ARTIFACT for name in ("program", "thermal-observer", "guard.sh", "pm-pinmux", "wifi-rollback")}),
    cv.Optional("fixture_mode",default=False): cv.boolean,
    cv.Optional("allow_network_trial",default=False): cv.boolean,
}).extend(cv.COMPONENT_SCHEMA),cv.only_on(PLATFORM_HOST))

async def to_code(config):
    var=cg.new_Pvariable(config[CONF_ID])
    await cg.register_component(var,config)
    cg.add(var.set_fixture_mode(config["fixture_mode"]))
    cg.add(var.set_allow_network_trial(config["allow_network_trial"]))
    for index,name in enumerate(("program","thermal-observer","guard.sh","pm-pinmux","wifi-rollback")):
        spec=config["artifacts"][name]
        cg.add(var.set_artifact(index,spec["size"],spec["sha256"]))
