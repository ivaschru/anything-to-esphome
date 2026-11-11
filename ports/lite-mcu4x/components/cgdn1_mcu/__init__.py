"""External-MCU receiver with a separate, explicitly bounded research probe.

Default passive mode accepts only RX. The opt-in poll probe requires the exact
TX18/RX19 pair and can send only two fixed transport messages under a one-boot
budget, never settings, calibration or MCU updates. Optional 4.2.1 scaled
inputs stay diagnostic alongside the raw fields.
"""
import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import sensor, uart
from esphome.const import CONF_ID, UNIT_CELSIUS, UNIT_PERCENT
import esphome.final_validate as fv

DEPENDENCIES = ["esp32", "uart"]
AUTO_LOAD = ["sensor", "json"]
CONF_STALE_AFTER = "stale_after"
CONF_TRANSMIT_MODE = "transmit_mode"
FIELDS = ("raw_temperature", "raw_humidity", "raw_battery", "raw_voltage",
          "raw_charge", "raw_co2", "raw_pm25", "raw_pm10")
STOCK_421_INPUTS = (("stock_421_temperature_input", UNIT_CELSIUS),
                    ("stock_421_humidity_input", UNIT_PERCENT))
ns = cg.esphome_ns.namespace("cgdn1_mcu")
Cgdn1Mcu = ns.class_("Cgdn1Mcu", cg.Component, uart.UARTDevice)

CONFIG_SCHEMA = cv.Schema({
    cv.GenerateID(): cv.declare_id(Cgdn1Mcu),
    cv.Optional(CONF_TRANSMIT_MODE, default="passive"): cv.one_of("passive", "poll_probe", "poll_series", "poll_long"),
    cv.Optional(CONF_STALE_AFTER, default="30s"): cv.All(
        cv.positive_time_period_milliseconds,
        cv.Range(min=cv.TimePeriod(milliseconds=1000), max=cv.TimePeriod(milliseconds=3600000)),
    ),
    **{cv.Optional(key): sensor.sensor_schema(accuracy_decimals=0,
        entity_category="diagnostic") for key in FIELDS},
    **{cv.Optional(key): sensor.sensor_schema(accuracy_decimals=2, unit_of_measurement=unit,
        entity_category="diagnostic") for key, unit in STOCK_421_INPUTS},
}).extend(cv.COMPONENT_SCHEMA).extend(uart.UART_DEVICE_SCHEMA)


def _validate(config):
    # The UART validator checks the selected bus, not just some other UART in
    # the file. Refuse shared loggers/TX and an undersized RX ring: an entire
    # maximum CG hex line is about 2 KiB before the adapter gets CPU time.
    probe = config[CONF_TRANSMIT_MODE] in ("poll_probe", "poll_series", "poll_long")
    uart.final_validate_device_schema("cgdn1_mcu", baud_rate=115200,
        data_bits=8, parity="NONE", stop_bits=1, require_rx=True, require_tx=probe)(config)
    full = fv.full_config.get()
    path = full.get_path_for_id(config["uart_id"])[:-1]
    bus = full.get_config_for_path(path)
    if "tx_pin" in bus and not probe:
        raise cv.Invalid("cgdn1_mcu is passive: remove tx_pin from its UART")
    if bus["rx_pin"]["number"] != 19:
        raise cv.Invalid("MCU receiver requires the statically verified RX19 pin")
    if probe and (bus["tx_pin"]["number"] != 18 or bus["rx_pin"]["number"] != 19):
        raise cv.Invalid("MCU poll probe requires the statically verified TX18/RX19 pair")
    if bus.get("rx_buffer_size", 256) < 4096:
        raise cv.Invalid("cgdn1_mcu requires rx_buffer_size: 4096 or larger")
    return config


FINAL_VALIDATE_SCHEMA = _validate


async def to_code(config):
    var = cg.new_Pvariable(config[CONF_ID])
    await cg.register_component(var, config)
    await uart.register_uart_device(var, config)
    cg.add(var.set_stale_after(config[CONF_STALE_AFTER].total_milliseconds))
    cg.add(var.set_poll_probe(config[CONF_TRANSMIT_MODE] == "poll_probe"))
    cg.add(var.set_poll_series(config[CONF_TRANSMIT_MODE] == "poll_series"))
    cg.add(var.set_poll_long(config[CONF_TRANSMIT_MODE] == "poll_long"))
    for index, key in enumerate(FIELDS):
        if key in config:
            cg.add(var.set_sensor(index, await sensor.new_sensor(config[key])))
    for index, (key, _) in enumerate(STOCK_421_INPUTS):
        if key in config:
            cg.add(var.set_stock_421_input(index, await sensor.new_sensor(config[key])))
