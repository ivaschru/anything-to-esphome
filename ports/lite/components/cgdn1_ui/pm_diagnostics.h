#pragma once
#include <cstddef>
#include <cstdint>

namespace esphome::cgdn1_ui {
// A fresh I2C read must contain an entire Plantower frame and a valid checksum.
// A responding, checksum-valid module while OFF disproves a complete supply
// cut even though the ordinary exported measurements are intentionally NAN.
// It does not, by itself, measure whether the fan is rotating.
inline bool valid_pm_diagnostic_frame(const uint8_t *data, size_t length) {
  if (length != 32 || data[0] != 0x42 || data[1] != 0x4D || data[2] != 0 || data[3] != 28)
    return false;
  uint16_t sum = 0;
  for (size_t i = 0; i < 30; i++) sum += data[i];
  return sum == uint16_t(uint16_t(data[30]) << 8 | data[31]);
}
}  // namespace esphome::cgdn1_ui

#ifdef USE_ESP32
#include "esphome/components/cgdn1_pm/cgdn1_pm.h"
#include "esphome/components/pmsa003i/pmsa003i.h"
#include "esphome/core/hal.h"
#include "esphome/core/log.h"
#include "soc/gpio_reg.h"
#include "soc/io_mux_reg.h"
#include "soc/rtc_io_reg.h"
#include "soc/rtc_cntl_reg.h"
#include "soc/gpio_periph.h"
#include "soc/soc.h"
#include "driver/gpio.h"
#include "esp_ota_ops.h"
#include "esp_chip_info.h"
#include "esp_rom_efuse.h"
#include <cstdio>

namespace esphome::cgdn1_ui {
inline bool diagnose_gpio_inventory(unsigned item) {
  // Read-only inventory: no probing of memory pins, no GPIO reconfiguration,
  // no flash/NVS dump and no caller-chosen address. The flash GPIO config word
  // describes wiring; it is not a security key or a unique device identifier.
  if (item == 0) {
    esp_chip_info_t chip{}; esp_chip_info(&chip);
    ESP_LOGI("gpio_map", "chip=%u cores=%u revision=%u features=0x%08x flash_gpio_info=0x%08x",
             unsigned(chip.model), unsigned(chip.cores), unsigned(chip.revision),
             unsigned(chip.features), unsigned(esp_rom_efuse_get_flash_gpio_info()));
    return true;
  }
  struct Pin { unsigned number; uint32_t mux; };
  const Pin pins[] = {
      {0, IO_MUX_GPIO0_REG}, {1, IO_MUX_GPIO1_REG}, {2, IO_MUX_GPIO2_REG},
      {3, IO_MUX_GPIO3_REG}, {4, IO_MUX_GPIO4_REG}, {5, IO_MUX_GPIO5_REG},
      {12, IO_MUX_GPIO12_REG}, {13, IO_MUX_GPIO13_REG}, {14, IO_MUX_GPIO14_REG},
      {15, IO_MUX_GPIO15_REG}, {16, IO_MUX_GPIO16_REG}, {17, IO_MUX_GPIO17_REG},
      {18, IO_MUX_GPIO18_REG}, {19, IO_MUX_GPIO19_REG}, {21, IO_MUX_GPIO21_REG},
      {22, IO_MUX_GPIO22_REG}, {23, IO_MUX_GPIO23_REG}, {25, IO_MUX_GPIO25_REG},
      {26, IO_MUX_GPIO26_REG}, {27, IO_MUX_GPIO27_REG}, {32, IO_MUX_GPIO32_REG},
      {33, IO_MUX_GPIO33_REG}};
  constexpr unsigned count = sizeof(pins) / sizeof(pins[0]);
  if (item <= count) {
    const auto &pin = pins[item - 1];
    const unsigned shift = pin.number < 32 ? pin.number : pin.number - 32;
    const uint32_t out = REG_READ(pin.number < 32 ? GPIO_OUT_REG : GPIO_OUT1_REG);
    const uint32_t enable = REG_READ(pin.number < 32 ? GPIO_ENABLE_REG : GPIO_ENABLE1_REG);
    const uint32_t in = REG_READ(pin.number < 32 ? GPIO_IN_REG : GPIO_IN1_REG);
    const bool ie = (REG_READ(pin.mux) & FUN_IE) != 0;
    ESP_LOGI("gpio_map", "pin=%u out=%u en=%u mux=%u sel=%u ie=%u in=%u",
             pin.number, unsigned((out >> shift) & 1), unsigned((enable >> shift) & 1),
             unsigned(REG_GET_FIELD(pin.mux, MCU_SEL)),
             unsigned(REG_READ(GPIO_FUNC0_OUT_SEL_CFG_REG + 4 * pin.number) & 0x1FF),
             unsigned(ie), unsigned((in >> shift) & 1));
    return true;
  }
  // Only the three existing LED outputs get a brief physical pad sample.
  // FUN_IE=0 cannot be interpreted as LOW. Restore each input buffer even
  // when a neighbouring sample fails; no direction/mux/output is touched.
  const Pin leds[] = {{19, IO_MUX_GPIO19_REG}, {21, IO_MUX_GPIO21_REG}, {25, IO_MUX_GPIO25_REG}};
  if (item <= count + 3) {
    const auto &pin = leds[item - count - 1];
    if (!(REG_READ(GPIO_ENABLE_REG) & (1U << pin.number))) return true;
    const bool ie = (REG_READ(pin.mux) & FUN_IE) != 0;
    const auto error = ie ? ESP_OK : gpio_input_enable(gpio_num_t(pin.number));
    delayMicroseconds(5);
    const int level = gpio_get_level(gpio_num_t(pin.number));
    if (!ie && error == ESP_OK) PIN_INPUT_DISABLE(pin.mux);
    const bool restored = ((REG_READ(pin.mux) & FUN_IE) != 0) == ie;
    ESP_LOGI("gpio_map", "led_pad pin=%u valid=%d level=%d input_restored=%d",
             pin.number, error == ESP_OK, level, restored);
    return true;
  }
  ESP_LOGI("gpio_map", "END");
  return false;
}

inline void diagnose_pm(cgdn1_pm::Cgdn1Pm *power, pmsa003i::PMSA003IComponent *reader) {
  // Fixed board-only, authenticated action: no arguments, no output writes,
  // no pin-mux changes, no bus scan and no publication to aggregate sensors.
  // For pad readback only, temporarily enable the two known input buffers and
  // restore them synchronously. There is no persistent configuration change.
  // Read the OUTPUT latch and output-enable register: gpio_get_level alone
  // can report zero for a pin whose input buffer is disabled, hiding a HIGH.
  static bool sampled = false;
  static uint32_t last_sample = 0;
  const uint32_t now = millis();
  if (sampled && uint32_t(now - last_sample) < 2000) return;
  sampled = true; last_sample = now;
  const uint32_t out = REG_READ(GPIO_OUT_REG);
  const uint32_t enable = REG_READ(GPIO_ENABLE_REG);
  const uint32_t input = REG_READ(GPIO_IN_REG);
  ESP_LOGI("pm_diag", "requested=%d ready=%d g13_out=%u g13_en=%u g13_in=%u g18_out=%u g18_en=%u g23_out=%u g23_en=%u",
           power->enabled(), power->ready(), unsigned((out >> 13) & 1), unsigned((enable >> 13) & 1),
           unsigned((input >> 13) & 1), unsigned((out >> 18) & 1), unsigned((enable >> 18) & 1),
           unsigned((out >> 23) & 1), unsigned((enable >> 23) & 1));
  ESP_LOGI("pm_diag", "g13_sel=%u g13_mux=%u g18_sel=%u g18_mux=%u g18_in=%u",
           unsigned(REG_READ(GPIO_FUNC13_OUT_SEL_CFG_REG) & 0x1FF),
           unsigned(REG_GET_FIELD(IO_MUX_GPIO13_REG, MCU_SEL)),
           unsigned(REG_READ(GPIO_FUNC18_OUT_SEL_CFG_REG) & 0x1FF),
           unsigned(REG_GET_FIELD(IO_MUX_GPIO18_REG, MCU_SEL)), unsigned((input >> 18) & 1));
  // A pad HOLD can preserve its physical state even while GPIO_OUT changes.
  // GPIO13 is RTCIO/TOUCH4; GPIO18 is a digital pad with a SoC-specific mask.
  // Reading HOLD must never release it or switch RTC mux. The separate pad
  // measurement below temporarily enables only the known input buffers;
  // no output or GPIO23 power-latch write is allowed in this diagnostic.
  ESP_LOGI("pm_diag", "g13_rtc_hold=%u g13_force_hold=%u g13_rtc_mux=%u g18_hold=%u g13_ie=%u g18_ie=%u",
           unsigned(REG_GET_FIELD(RTC_IO_TOUCH_PAD4_REG, RTC_IO_TOUCH_PAD4_HOLD)),
           unsigned(REG_GET_FIELD(RTC_CNTL_HOLD_FORCE_REG, RTC_CNTL_TOUCH_PAD4_HOLD_FORCE)),
           unsigned(REG_GET_FIELD(RTC_IO_TOUCH_PAD4_REG, RTC_IO_TOUCH_PAD4_MUX_SEL)),
           unsigned((REG_READ(RTC_IO_DIG_PAD_HOLD_REG) & GPIO_HOLD_MASK[18]) != 0),
           unsigned((REG_READ(IO_MUX_GPIO13_REG) & FUN_IE) != 0),
           unsigned((REG_READ(IO_MUX_GPIO18_REG) & FUN_IE) != 0));
  // GPIO_IN is meaningless with FUN_IE=0. Sample the electrical digital pad
  // levels rather than confusing that disabled-buffer zero with a voltage.
  // Admit only the already-reviewed ordinary output configuration while the
  // power latch is asserted. No output level, direction, drive strength,
  // pull resistor, RTC mux or GPIO23 state is changed by this operation.
  const bool ordinary_outputs = (enable & (1U << 13)) && (enable & (1U << 18)) &&
      (out & (1U << 23)) &&
      (REG_READ(GPIO_FUNC13_OUT_SEL_CFG_REG) & 0x1FF) == 256 &&
      (REG_READ(GPIO_FUNC18_OUT_SEL_CFG_REG) & 0x1FF) == 256 &&
      REG_GET_FIELD(IO_MUX_GPIO13_REG, MCU_SEL) == 2 &&
      REG_GET_FIELD(IO_MUX_GPIO18_REG, MCU_SEL) == 2 &&
      REG_GET_FIELD(RTC_IO_TOUCH_PAD4_REG, RTC_IO_TOUCH_PAD4_MUX_SEL) == 0;
  if (ordinary_outputs) {
    const bool ie13 = (REG_READ(IO_MUX_GPIO13_REG) & FUN_IE) != 0;
    const bool ie18 = (REG_READ(IO_MUX_GPIO18_REG) & FUN_IE) != 0;
    const auto err13 = ie13 ? ESP_OK : gpio_input_enable(GPIO_NUM_13);
    const auto err18 = ie18 ? ESP_OK : gpio_input_enable(GPIO_NUM_18);
    delayMicroseconds(5);
    const int physical13 = gpio_get_level(GPIO_NUM_13);
    const int physical18 = gpio_get_level(GPIO_NUM_18);
    // Always restore each successfully enabled buffer, including partial
    // failure. Keep the critical section finite: no deferred callback, bus
    // operation, sleep or network reply can leave either input enabled.
    // IDF exposes gpio_input_enable but keeps its disable counterpart private.
    // The SoC macro clears only FUN_IE; it cannot rewrite the output latch.
    if (!ie13 && err13 == ESP_OK) PIN_INPUT_DISABLE(IO_MUX_GPIO13_REG);
    if (!ie18 && err18 == ESP_OK) PIN_INPUT_DISABLE(IO_MUX_GPIO18_REG);
    const int restore13 = ((REG_READ(IO_MUX_GPIO13_REG) & FUN_IE) != 0) == ie13 ? ESP_OK : ESP_FAIL;
    const int restore18 = ((REG_READ(IO_MUX_GPIO18_REG) & FUN_IE) != 0) == ie18 ? ESP_OK : ESP_FAIL;
    ESP_LOGI("pm_diag", "pad_valid=%d g13_pad=%d g18_pad=%d enable13=%d enable18=%d restore13=%d restore18=%d",
             err13 == ESP_OK && err18 == ESP_OK, physical13, physical18,
             int(err13), int(err18), int(restore13), int(restore18));
  } else {
    ESP_LOGW("pm_diag", "pad_sample_refused=nonordinary_gpio_configuration");
  }
  // Inventory the one exposed GPIO absent from the reviewed board map.
  // This is discovery only, never permission to drive it: an unassigned pin
  // may be connected to unmodelled hardware. No input enable or pull change.
  ESP_LOGI("pm_diag", "unassigned_g33_out=%u en=%u in=%u ie=%u sel=%u mux=%u rtc_mux=%u rtc_hold=%u force_hold=%u pullup=%u pulldown=%u",
           unsigned((REG_READ(GPIO_OUT1_REG) >> 1) & 1),
           unsigned((REG_READ(GPIO_ENABLE1_REG) >> 1) & 1),
           unsigned((REG_READ(GPIO_IN1_REG) >> 1) & 1),
           unsigned((REG_READ(IO_MUX_GPIO33_REG) & FUN_IE) != 0),
           unsigned(REG_READ(GPIO_FUNC33_OUT_SEL_CFG_REG) & 0x1FF),
           unsigned(REG_GET_FIELD(IO_MUX_GPIO33_REG, MCU_SEL)),
           unsigned(REG_GET_FIELD(RTC_IO_XTAL_32K_PAD_REG, RTC_IO_X32N_MUX_SEL)),
           unsigned(REG_GET_FIELD(RTC_IO_XTAL_32K_PAD_REG, RTC_IO_X32N_HOLD)),
           unsigned(REG_GET_FIELD(RTC_CNTL_HOLD_FORCE_REG, RTC_CNTL_X32N_HOLD_FORCE)),
           unsigned((REG_READ(IO_MUX_GPIO33_REG) & FUN_PU) != 0),
           unsigned((REG_READ(IO_MUX_GPIO33_REG) & FUN_PD) != 0));
  uint8_t data[32]{};
  // One ordinary address-0x12 read, exactly the installed driver's operation.
  // Do not wake the module, apply SET commands, retry or change the poller.
  const auto error = reader->read(data, sizeof(data));
  const bool valid = error == i2c::ERROR_OK && valid_pm_diagnostic_frame(data, sizeof(data));
  // Keep one response line to preserve the existing bounded API log burst.
  // Report the public wire bytes only after full frame validation. These two
  // tail bytes can distinguish sensor protocol/firmware variants, but are not
  // a board revision or a fan tachometer. Keep their neutral wire positions:
  // a compatible-looking frame alone does not establish the exact PM model.
  // This reads no additional registers, sends no command, changes no poller
  // and cannot publish a diagnostic sample to the ordinary sensor entities.
  if (valid) {
    ESP_LOGI("pm_diag", "i2c_error=0 valid_frame=1 frame_tail28=%u frame_tail29=%u cf_pm1=%u cf_pm25=%u cf_pm10=%u atm_pm1=%u atm_pm25=%u atm_pm10=%u count03=%u",
             unsigned(data[28]), unsigned(data[29]),
             unsigned(uint16_t(data[4]) << 8 | data[5]),
             unsigned(uint16_t(data[6]) << 8 | data[7]),
             unsigned(uint16_t(data[8]) << 8 | data[9]),
             unsigned(uint16_t(data[10]) << 8 | data[11]),
             unsigned(uint16_t(data[12]) << 8 | data[13]),
             unsigned(uint16_t(data[14]) << 8 | data[15]),
             unsigned(uint16_t(data[16]) << 8 | data[17]));
  } else {
    ESP_LOGI("pm_diag", "i2c_error=%d valid_frame=0", int(error));
  }
  // Read only the public app descriptor from the other slot, never flash/NVS
  // contents. This verifies that a temporary experiment is not retained as
  // the user's manual fallback after returning to an ordinary app.
  const auto *running = esp_ota_get_running_partition();
  const auto *other = esp_ota_get_next_update_partition(nullptr);
  esp_app_desc_t description{};
  const esp_err_t desc_error = other ? esp_ota_get_partition_description(other, &description) : ESP_ERR_NOT_FOUND;
  char elf_sha[65]{};
  if (desc_error == ESP_OK)
    for (size_t i = 0; i < 32; i++) std::snprintf(elf_sha + i * 2, 3, "%02x", description.app_elf_sha256[i]);
  ESP_LOGI("pm_diag", "running_slot=%s other_slot=%s descriptor_error=%d other_elf_sha=%s",
           running ? running->label : "?", other ? other->label : "?", int(desc_error), elf_sha);
}
}  // namespace esphome::cgdn1_ui
#endif
