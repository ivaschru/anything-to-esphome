"""Standard native UpdateEntity; no HA custom integration is required."""
import esphome.codegen as cg
import esphome.config_validation as cv

AUTO_LOAD = ["sha256", "json", "md5"]
DEPENDENCIES = ["esp32", "wifi", "api", "http_request", "ota"]
MULTI_CONF = False
ns = cg.esphome_ns.namespace("qf_native_update")
