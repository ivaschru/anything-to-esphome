#pragma once
#include "esphome/core/defines.h"
#include "ui_model.h"
#include "ui_painter.h"
#include "wifi_settings.h"
#include "pm_diagnostics.h"
#ifdef CGDN1_GPIO23_PROBE
#include "gpio23_trial.h"
#endif
#ifdef CGDN1_WEAK17_PROBE
#include "weak17_trial.h"
#include "esp_attr.h"
#if CONFIG_SPIRAM || CONFIG_SPIRAM_SUPPORT
#error "GPIO17 weak trial cannot be built with PSRAM support"
#endif
#endif
#include "esphome/components/api/api_server.h"
#include "esphome/components/api/api_connection.h"
#include "esphome/components/cgdn1_display/cgdn1_display.h"
#include "esphome/components/cgdn1_pm/cgdn1_pm.h"
#include "esphome/components/cgdn1_led/led.h"
#include "esphome/components/number/number.h"
#include "esphome/components/sensor/sensor.h"
#include "esphome/components/switch/switch.h"
#include "esphome/core/application.h"
#include "esphome/core/component.h"
#include "esphome/core/log.h"
#include "esphome/core/version.h"
#include <cmath>
#include <cstdio>
#include <memory>
#include <new>

namespace esphome::cgdn1_ui {
#ifdef CGDN1_WEAK17_PROBE
// No initializer: the pending snapshot survives watchdog/software resets.
// It is consulted only on this explicit diagnostic image and only under the
// same child/input/unowned/CS-HIGH guards as the planned weak-pull operation.
RTC_NOINIT_ATTR inline volatile Weak17RecoveryRecord weak17_recovery_record;
static constexpr const char *UI_VERSION = "2026.11.04-ui27-weak17";
static constexpr unsigned PUBLIC_VERSION = 0;
#elif defined(CGDN1_GPIO23_PROBE)
static constexpr const char *UI_VERSION = "2026.11.04-ui26-gpio23";
static constexpr unsigned PUBLIC_VERSION = 0;
#else
static constexpr const char *UI_VERSION = "2026.11.07-ui25-profile1";
// Product version is independent from the exact diagnostic UI/build identity.
static constexpr unsigned PUBLIC_VERSION = 1;
#endif
struct Readings {
  float co2{NAN}, temperature{NAN}, humidity{NAN}, pm1{NAN}, pm25{NAN}, pm10{NAN};
  cgdn1_display::DisplayValues summary;
  bool summary_enabled{true}, usb{false}, powering_off{false};
  uint32_t activity{0}, idle_delay{10000};
};

class Cgdn1Ui : public Component {
 public:
  void set_display(cgdn1_display::Cgdn1Display *v) { display_ = v; }
  void set_brightness(number::Number *v) { brightness_ = v; }
  void set_pm_switch(switch_::Switch *v) { switches_[0] = v; }
  void set_ble_switch(switch_::Switch *v) { switches_[1] = v; }
  void set_night_switch(switch_::Switch *v) { switches_[2] = v; }
  void set_pm_power(cgdn1_pm::Cgdn1Pm *v) { pm_ = v; }
  void set_battery(sensor::Sensor *v) { battery_ = v; }
  void set_pm25(sensor::Sensor *v) { pm25_sensor_ = v; }
  void set_fonts(font::Font *small, font::Font *title, font::Font *medium,
                 font::Font *large, font::Font *number, font::Font *summary) {
    small_ = small; title_ = title; medium_ = medium; large_ = large; number_ = number; summary_ = summary;
  }
  float get_setup_priority() const override { return setup_priority::WIFI - 1; }
  void setup() override {
#ifdef CGDN1_WEAK17_PROBE
    weak17_recover_boot_();
#endif
    wifi_.setup(); model_.activity = millis();
    pm25_sensor_->add_on_state_callback([this](float value) {
      pm_seen_ = std::isfinite(value);
      if (pm_seen_) pm_ms_ = millis();
    });
  }
  void dump_config() override { ESP_LOGCONFIG("cgdn1_ui", "Local UI: %s; transactional Wi-Fi; no credential logging", UI_VERSION); }
  bool active() const {
#ifdef CGDN1_WEAK17_PROBE
    if (weak17_.active()) return true;
#endif
#ifdef CGDN1_GPIO23_PROBE
    // Reuse the normal menu's night-idle guard so the six-second instruction
    // remains visible. This never changes the saved night/display settings.
    if (gpio23_.active()) return true;
#endif
    return model_.active();
  }
  void request_pin_inventory() {
    if (inventory_next_ == UINT32_MAX) {
      inventory_next_ = 0; inventory_tick_ = millis() - 80;
      ESP_LOGI("gpio_map", "BEGIN");
    }
  }
  void on_shutdown() override {
#ifdef CGDN1_WEAK17_PROBE
    restore_weak17_();
#endif
#ifdef CGDN1_GPIO23_PROBE
    restore_gpio23_();
#endif
    inventory_next_ = UINT32_MAX;
  }
#ifdef CGDN1_WEAK17_PROBE
  void weak17_status() {
    const uint32_t mux = REG_READ(IO_MUX_GPIO17_REG);
    ESP_LOGI("pm17", "status active=%u consumed=%u admitted=%u p16=%u p17=%u pu=%u pd=%u remaining_ms=%u",
             weak17_.active(), weak17_.consumed(), weak17_admitted_(),
             unsigned((REG_READ(GPIO_IN_REG) >> 16) & 1), unsigned((REG_READ(GPIO_IN_REG) >> 17) & 1),
             unsigned((mux & FUN_PU) != 0), unsigned((mux & FUN_PD) != 0), unsigned(weak17_.remaining(millis())));
  }
  void start_weak17_probe() {
    // Installation and status do not enter this function. Admission is
    // repeated at the actual start, after a new informed human approval/ready.
    if (!weak17_admitted_()) { ESP_LOGW("pm17", "refused before pull change"); return; }
    weak17_pull_before_ = REG_READ(IO_MUX_GPIO17_REG) & (FUN_PU | FUN_PD);
    weak17_other_mux_ = REG_READ(IO_MUX_GPIO17_REG) & ~(FUN_PU | FUN_PD);
    weak17_recovery_arm(weak17_recovery_record, (weak17_pull_before_ & FUN_PD) != 0);
    weak17_was_on_ = display_->is_on(); display_->turn_on();
    weak17_.begin(millis(), true, [this](bool up) { return weak17_apply_(up); });
    display_->update(); weak17_status();
  }
#endif
#ifdef CGDN1_GPIO23_PROBE
  void gpio23_status() {
    ESP_LOGI("pm23", "status active=%u consumed=%u remaining_ms=%u latch=%u",
             gpio23_.active(), gpio23_.consumed(), unsigned(gpio23_.remaining(millis())),
             unsigned((REG_READ(GPIO_OUT_REG) >> 23) & 1));
  }
  void start_gpio23_probe() {
    uint8_t mac[6]; get_mac_address_raw(mac);
    static constexpr uint8_t CHILD[6] = {0x7C, 0xC2, 0x94, 0xC9, 0x4B, 0x04};
    const uint32_t out = REG_READ(GPIO_OUT_REG), oe = REG_READ(GPIO_ENABLE_REG);
    const bool same_child = std::memcmp(mac, CHILD, sizeof(CHILD)) == 0;
    // Do not repair a surprising pad configuration as part of admission. The
    // experiment changes the existing latch only, never mux/enable/HOLD/pulls.
    const bool ordinary_latch = (out & (1U << 23)) && (oe & (1U << 23)) &&
        (REG_READ(GPIO_FUNC23_OUT_SEL_CFG_REG) & 0x1FF) == 256 &&
        REG_GET_FIELD(IO_MUX_GPIO23_REG, MCU_SEL) == 2 &&
        (REG_READ(RTC_IO_DIG_PAD_HOLD_REG) & GPIO_HOLD_MASK[23]) == 0;
    const bool admitted = same_child && gpio23_safe_() && !model_.active() &&
        ordinary_latch && !(out & (1U << 13));
    if (!admitted || gpio23_.consumed()) {
      ESP_LOGW("pm23", "refused child=%u safe=%u latch=%u consumed=%u",
               same_child, gpio23_safe_(), ordinary_latch, gpio23_.consumed()); return;
    }
    gpio23_was_on_ = display_->is_on();
    display_->turn_on();
    gpio23_.start(millis(), true, [](bool high) {
      ESP_LOGI("pm23", "%s low_ms=6000", high ? "RESTORE_HIGH" : "START_LOW");
      return gpio_set_level(GPIO_NUM_23, high ? 1 : 0) == ESP_OK;
    });
    display_->update();
  }
#endif
  bool updating() const { return ota_; }
  bool pages_ready() const { return pages_ready_; }
  cgdn1_led::Sensor led_sensor() const { return shown_sensor_; }
  float led_value() const { return shown_value_; }
  void show_page(int page, int detail) {
    if (ota_ || wifi_.trial_active() || page < 0 || page > 4 || detail < 0 || detail > 2) return;
    model_.close(); model_.page = page; model_.info = detail;
    model_.activity = millis(); touched_ = true; idle_shown_ = false;
    display_->turn_on(); display_->update();
  }
  void select_network(const std::string &ssid) {
    // Diagnostic selection uses the exact SSID rather than a moving scan-list
    // index. It only opens the same network-actions page as a physical tap.
    if (ota_ || wifi_.trial_active()) return;
    const auto &networks = wifi_.networks();
    for (size_t i = 0; i < networks.size(); i++) {
      if (networks[i].ssid != ssid) continue;
      model_.clear_password(); model_.network = i; model_.choice = 0;
      model_.screen = Screen::NETWORK_ACTIONS; model_.activity = millis();
      display_->update(); return;
    }
  }
  const char *status() const {
    static const char *const screens[] = {"reading", "menu", "setting", "networks", "network_actions", "password", "connecting", "wifi_error", "wifi_ok"};
    return screens[int(model_.screen)];
  }
  void loop() override {
    const uint32_t now = millis();
#ifdef CGDN1_WEAK17_PROBE
    const bool weak_was_active = weak17_.active();
    if (weak_was_active) weak17_.tick(now, weak17_environment_() && weak17_inputs_() &&
                 (REG_READ(IO_MUX_GPIO17_REG) & ~(FUN_PU | FUN_PD)) == weak17_other_mux_,
                 [this](bool up) { return weak17_apply_(up); });
    if (weak_was_active && !weak17_.active()) {
      if (!weak17_was_on_) display_->turn_off();
      display_->update(); weak17_status();
    }
#endif
#ifdef CGDN1_GPIO23_PROBE
    const bool was_active = gpio23_.active();
    gpio23_.tick(now, gpio23_safe_(), [](bool high) {
      ESP_LOGI("pm23", "RESTORE_HIGH elapsed timer or guard");
      return gpio_set_level(GPIO_NUM_23, high ? 1 : 0) == ESP_OK;
    });
    if (was_active && !gpio23_.active()) {
      if (!gpio23_was_on_) display_->turn_off();
      display_->update(); gpio23_status();
    }
#endif
    // Pace the fixed inventory just like framebuffer packets. A burst of
    // dozens of logs can overflow the API queue and lose the very evidence
    // needed to identify a phase. Sampling never blocks a restoration timer.
    if (inventory_next_ != UINT32_MAX && uint32_t(now - inventory_tick_) >= 80) {
      inventory_tick_ = now;
      if (!diagnose_gpio_inventory(inventory_next_++)) inventory_next_ = UINT32_MAX;
    }
    capture_tick_(now);
    const bool connected = wifi::global_wifi_component->is_connected();
    if (was_connected_ && !connected && !wifi_.trial_active()) { offline_since_ = now; offline_notice_ = true; }
    was_connected_ = connected;
    model_.network_count = wifi_.networks().size();
    if (model_.screen == Screen::NETWORKS)
      model_.network = std::clamp(model_.network, 0, model_.network_count + 1);
    if (model_.expire(now) && display_->is_on()) display_->update();
    const auto outcome = wifi_.tick(now, ota_);
    if (outcome != TrialAction::NONE) {
      model_.clear_password(); model_.choice = 0; model_.activity = now;
      model_.screen = outcome == TrialAction::COMMIT ? Screen::WIFI_OK : Screen::WIFI_ERROR;
      ESP_LOGI("cgdn1_ui", "Wi-Fi trial %s", outcome == TrialAction::COMMIT ? "committed" : "rolled back");
      if (display_->is_on()) display_->update();
    }
  }
  void gesture(const std::string &gesture) {
#ifdef CGDN1_WEAK17_PROBE
    if (weak17_.active()) { restore_weak17_(); display_->update(); return; }
#endif
#ifdef CGDN1_GPIO23_PROBE
    if (gpio23_.active()) { restore_gpio23_(); display_->update(); return; }
#endif
    if (ota_) return;
    Gesture g = gesture == "tap_left" ? Gesture::LEFT : gesture == "tap_right" ? Gesture::RIGHT :
                gesture == "tap_centre" ? Gesture::CENTRE : gesture == "swipe_left" ? Gesture::SWIPE_LEFT :
                gesture == "swipe_right" ? Gesture::SWIPE_RIGHT : Gesture::OTHER;
    if (g == Gesture::OTHER) return;
    if (idle_shown_) { model_.page = model_.info = 0; idle_shown_ = false; }
    const Action action = model_.gesture(g, millis());
    if (action == Action::OPEN_SETTING) {
      model_.draft_value = model_.menu == 0 ? int(std::lround(brightness_->state)) : switches_[model_.menu - 1]->state;
    } else if (action == Action::APPLY_SETTING) {
      if (model_.menu == 0) { auto call = brightness_->make_call(); call.set_value(model_.draft_value); call.perform(); }
      else if (model_.draft_value) switches_[model_.menu - 1]->turn_on();
      else switches_[model_.menu - 1]->turn_off();
    } else if (action == Action::SCAN) wifi_.scan(millis());
    else if (action == Action::CANCEL_CONNECT) wifi_.cancel();
    else if (action == Action::CONNECT || action == Action::EDIT_PASSWORD || action == Action::TRY_PASSWORD) {
      const auto &networks = wifi_.networks();
      if (model_.network < 0 || size_t(model_.network) >= networks.size()) return;
      const Network target = networks[model_.network];
      if (action == Action::EDIT_PASSWORD) model_.begin_password(target.secured);
      else {
        const bool started = action == Action::TRY_PASSWORD ? wifi_.start(target, model_.password.data(), millis()) :
                                                              wifi_.start_saved(target, millis());
        if (started) { model_.clear_password(); model_.screen = Screen::CONNECTING; }
        else if (action == Action::CONNECT) model_.begin_password(target.secured);
      }
    }
    display_->update();
  }
  void ota_begin() {
#ifdef CGDN1_WEAK17_PROBE
    restore_weak17_();
#endif
#ifdef CGDN1_GPIO23_PROBE
    restore_gpio23_();
#endif
    inventory_next_ = UINT32_MAX; capture_.reset(); ota_ = true; ota_was_on_ = display_->is_on(); ota_percent_ = 0; display_->turn_on(); display_->update();
  }
  void ota_progress(float progress) {
    const int percent = std::clamp(int(progress), 0, 100);
    if (percent != ota_percent_) { ota_percent_ = percent; display_->update(); }
  }
  void ota_end() { ota_percent_ = 100; display_->update(); }
  void ota_error() { ota_ = false; if (!ota_was_on_) display_->turn_off(); display_->update(); }

  // The capture is opt-in over the authenticated native API and refuses any
  // credential editor/connection trial. It captures framebuffer pixels, not a
  // photograph of the panel; the saved result must retain that distinction.
  void capture() {
    if (ota_ || model_.screen == Screen::PASSWORD || wifi_.trial_active()) {
      ESP_LOGI("ui_frame", "capture refused during credential entry/trial"); return;
    }
    if (capture_) return;
    display_->update();
    const auto *bytes = display_->ui_framebuffer();
    if (!bytes) return;
    // API log packets are best-effort and may be dropped when a whole frame
    // is emitted in one tight burst. Freeze one frame, then send one bounded
    // packet per 40 ms loop step. Allocate only during an explicit capture;
    // failure leaves the working sensor/UI untouched and never restarts it.
    capture_.reset(new (std::nothrow) uint8_t[2560]);
    if (!capture_) { ESP_LOGW("ui_frame", "capture unavailable: memory"); return; }
    std::memcpy(capture_.get(), bytes, 2560);
    capture_offset_ = 0; capture_tick_ms_ = millis() - 40;
  }

  void render(display::Display &display, const Readings &in) {
    const uint32_t now = millis();
    shown_sensor_ = cgdn1_led::SENSOR_NONE;
    shown_value_ = NAN;
    Painter p(display);
    auto text = [&](int x, int y, const std::string &s, int align = -1, font::Font *f = nullptr) {
      p.text(x, y, f ? f : small_, s, align);
    };
#ifdef CGDN1_WEAK17_PROBE
    if (weak17_.active()) {
      text(10, 15, "Подтяжка GPIO17"); text(10, 47, "Вверх", -1, medium_);
      text(10, 80, "Осталось " + std::to_string((weak17_.remaining(now) + 999) / 1000) + " с");
      text(10, 108, "Касание: отмена"); return;
    }
#endif
#ifdef CGDN1_GPIO23_PROBE
    if (gpio23_.active()) {
      text(10, 15, "Проба вентилятора"); text(10, 45, "GPIO23: LOW", -1, title_);
      text(10, 78, "Возврат через " + std::to_string((gpio23_.remaining(now) + 999) / 1000) + " с");
      text(10, 108, "Касание: отмена"); return;
    }
#endif
    if (ota_) {
      text(10, 11, "Обновление"); text(10, 40, std::to_string(ota_percent_), -1, large_);
      text(112, 65, "%", -1, title_); p.bar(91, ota_percent_); text(10, 109, "Не отключайте питание"); return;
    }
    if (in.powering_off) { text(10, 24, "Выключение", -1, medium_); text(10, 75, "До следующего"); text(10, 95, "включения"); return; }
    if (model_.active()) { render_menu_(p); return; }
    const bool connected = wifi::global_wifi_component->is_connected();
    if (connected && !net_since_) net_since_ = now ? now : 1;
    if (!connected) net_since_ = 0;
    // Never trap the user behind an endless network splash. Touch may open
    // local settings even when there is no network or HA connection at all.
    if (now < 30000 && !touched_ && (!net_since_ || uint32_t(now - net_since_) < 5000)) {
      text(10, 12, "Qingping", -1, medium_); text(10, 43, "Air Monitor Lite");
      text(10, 82, connected ? "Готов к работе" : "Подключение к Wi-Fi");
      text(10, 109, connected ? "Первые данные скоро" : "Центр: настройки"); return;
    }
    pages_ready_ = true;
    if (!connected && offline_notice_ && uint32_t(now - offline_since_) < 5000) {
      text(10, 12, "Wi-Fi недоступен", -1, title_);
      text(10, 48, std::isfinite(in.co2) || std::isfinite(in.temperature) ? "Показания локально" : "Нет свежих данных");
      text(10, 77, "Подключаемся…"); text(10, 111, "Центр: настройки"); return;
    }
    if (in.summary_enabled && uint32_t(now - in.activity) >= in.idle_delay) {
      idle_shown_ = true;
      shown_sensor_ = cgdn1_led::SENSOR_CO2;
      shown_value_ = in.co2;  // preserve the LED's physical-CO2 basis on HA idle
      text(10, 9, in.summary.co2_source == cgdn1_display::DisplaySource::LOCAL ? "CO2 · ЛОК" : "CO2");
      text(150, 10, "ppm", 1);
      draw_number_(p, 10, 29, number(in.summary.co2, 0), -1, summary_);
      p.rule(86);
      draw_number_(p, 10, 95, number(in.summary.temperature, 1), -1, medium_, 99);
      text(150, 102, "°C", 1, title_);
      if (in.summary.temperature_source == cgdn1_display::DisplaySource::LOCAL) text(111, 91, "ЛОК");
      return;
    }
    idle_shown_ = false;
    if (uint32_t(now - in.activity) < 3000) p.dots(model_.page);
    if (model_.page < 3) {
      shown_sensor_ = model_.page == 0 ? cgdn1_led::SENSOR_CO2 : model_.page == 1 ? cgdn1_led::SENSOR_TEMP : cgdn1_led::SENSOR_HUMI;
      static const char *const names[] = {"CO2", "Температура", "Влажность"};
      static const char *const units[] = {"ppm", "°C", "% RH"};
      const float value = model_.page == 0 ? in.co2 : model_.page == 1 ? in.temperature : in.humidity;
      shown_value_ = value;
      text(80, 23, names[model_.page], 0);
      draw_number_(p, 80, 46, number(value, model_.page == 1 ? 1 : 0), 0, large_);
      text(80, 96, units[model_.page], 0);
      text(80, 112, std::isfinite(value) ? "Локально" : now < 300000 ? "Первые данные" : "Нет свежих данных", 0);
    } else if (model_.page == 3) {
      text(10, 24, "Сенсор PM2.5");
      // The live board keeps its fan/module alive despite GPIO13 LOW. The
      // switch definitely suspends polling; physical power removal is not
      // verified. State that fact instead of claiming "sensor powered off".
      if (!pm_->ready()) {
        const uint32_t seconds = (pm_->warmup_remaining_ms() + 999) / 1000;
        text(80, 51, !pm_->enabled() ? "Опрос" : seconds ? "Прогрев" : "Нет данных", 0, medium_);
        text(80, 94, pm_->enabled() ? seconds ? "Ещё " + std::to_string(seconds) + " с" : "Сенсор недоступен" : "Выключен", 0);
        text(80, 111, pm_->enabled() && seconds ? "Данных пока нет" : "Центр: настройки", 0);
      } else {
        shown_sensor_ = cgdn1_led::SENSOR_PM25;
        const bool fresh = pm_seen_ && uint32_t(now - pm_ms_) <= cgdn1_display::DisplaySources::MAX_AGE_MS;
        shown_value_ = fresh ? in.pm25 : NAN;
        draw_number_(p, 10, 44, number(fresh ? in.pm25 : NAN, 0), -1, large_, 99);
        text(150, 74, "мкг/м³", 1); p.rule(90);
        // Separate secondary rows keep the complete dynamic values readable,
        // including a five-digit hardware reading, without shrinking the font.
        text(10, 96, "PM1"); text(150, 96, number(fresh ? in.pm1 : NAN, 0), 1);
        text(10, 112, "PM10"); text(150, 112, number(fresh ? in.pm10 : NAN, 0), 1);
      }
    } else render_info_(p, in);
  }
  void mark_touched() { touched_ = true; }

 private:
#ifdef CGDN1_WEAK17_PROBE
  Weak17Trial weak17_;
  uint32_t weak17_pull_before_{0}, weak17_other_mux_{0};
  bool weak17_was_on_{true};
  bool weak17_recovery_blocked_{false};
  bool weak17_platform_() const {
    uint8_t mac[6]; get_mac_address_raw(mac);
    static constexpr uint8_t CHILD[6] = {0x7C, 0xC2, 0x94, 0xC9, 0x4B, 0x04};
    esp_chip_info_t chip{}; esp_chip_info(&chip);
    return std::memcmp(mac, CHILD, sizeof(CHILD)) == 0 && chip.model == CHIP_ESP32 &&
        chip.revision == 100 && !(chip.features & (CHIP_FEATURE_EMB_FLASH | CHIP_FEATURE_EMB_PSRAM)) &&
        esp_rom_efuse_get_flash_gpio_info() == 0;
  }
  bool weak17_environment_() const {
    return weak17_platform_() && millis() >= 5000 &&
        gpio_get_level(GPIO_NUM_34) == 0 && gpio_get_level(GPIO_NUM_36) != 0 &&
        pm_ && !pm_->enabled() && switches_[0] && !switches_[0]->state && !ota_ && !wifi_.trial_active();
  }
  bool weak17_inputs_() const {
    const uint32_t mask = (1U << 16) | (1U << 17);
    // Never de-select/reconfigure a memory controller ourselves. Require both
    // pins already input-only/unrouted. GPIO16 is READ ONLY and must stay HIGH:
    // the documented WROVER PSRAM CS is then inactive while CLK may be biased.
    return !(REG_READ(GPIO_ENABLE_REG) & mask) &&
        REG_GET_FIELD(IO_MUX_GPIO16_REG, MCU_SEL) == 0 && REG_GET_FIELD(IO_MUX_GPIO17_REG, MCU_SEL) == 0 &&
        (REG_READ(GPIO_FUNC16_OUT_SEL_CFG_REG) & 0x1FF) == 256 &&
        (REG_READ(GPIO_FUNC17_OUT_SEL_CFG_REG) & 0x1FF) == 256 &&
        (REG_READ(IO_MUX_GPIO16_REG) & FUN_IE) && (REG_READ(IO_MUX_GPIO17_REG) & FUN_IE) &&
        !(REG_READ(RTC_IO_DIG_PAD_HOLD_REG) & (GPIO_HOLD_MASK[16] | GPIO_HOLD_MASK[17])) &&
        (REG_READ(GPIO_IN_REG) & (1U << 16));
  }
  bool weak17_admitted_() const {
    return !weak17_recovery_blocked_ && !weak17_.consumed() && !model_.active() && weak17_environment_() && weak17_inputs_() &&
        !(REG_READ(GPIO_IN_REG) & (1U << 17)) && !(REG_READ(IO_MUX_GPIO17_REG) & FUN_PU);
  }
  bool weak17_apply_(bool up) {
    // The ONLY write in this experiment: two internal resistor bits of pad17.
    // Preserve every mux/drive/input bit; never write GPIO16, GPIO output/OE,
    // flash, SPI, HOLD or bus registers. A weak pull need not move the actual
    // voltage: log the input and do not infer a valid HIGH from FUN_PU alone.
    const uint32_t desired = up ? FUN_PU : weak17_pull_before_;
    const uint32_t current = REG_READ(IO_MUX_GPIO17_REG);
    REG_WRITE(IO_MUX_GPIO17_REG, (current & ~(FUN_PU | FUN_PD)) | desired);
    const bool matches = (REG_READ(IO_MUX_GPIO17_REG) & (FUN_PU | FUN_PD)) == desired;
    if (!up && matches) weak17_recovery_clear(weak17_recovery_record);
    ESP_LOGI("pm17", "%s pull_readback_ok=%u p16=%u p17=%u remaining_ms=%u", up ? "PULL_UP_BEGIN" : "PULL_RESTORED",
             matches, unsigned((REG_READ(GPIO_IN_REG) >> 16) & 1), unsigned((REG_READ(GPIO_IN_REG) >> 17) & 1),
             unsigned(weak17_.remaining(millis())));
    return matches;
  }
  void restore_weak17_() { weak17_.restore([this](bool up) { return weak17_apply_(up); }); }
  void weak17_recover_boot_() {
    if (!weak17_recovery_valid(weak17_recovery_record)) return;
    weak17_.block_replay_after_recovery();
    // A reset cannot silently turn a six-second test into a lasting pull-up.
    // Recovery restores only the saved pull bits, never mux/OE or GPIO16. If
    // ownership/CS is unexpected, do not override it or launch another trial.
    if (!weak17_platform_() || !weak17_inputs_()) {
      weak17_recovery_blocked_ = true; status_set_warning();
      ESP_LOGW("pm17", "boot pull recovery blocked: ownership/CS changed"); return;
    }
    weak17_pull_before_ = weak17_recovery_record.original_pd ? FUN_PD : 0;
    if (!weak17_apply_(false)) { weak17_recovery_blocked_ = true; status_set_warning(); }
    else ESP_LOGI("pm17", "pending pull restored after reset; start consumed");
  }
#endif
#ifdef CGDN1_GPIO23_PROBE
  Gpio23Trial gpio23_;
  bool gpio23_was_on_{true};
  bool gpio23_safe_() const {
    return millis() >= 5000 && gpio_get_level(GPIO_NUM_34) == 0 &&
        gpio_get_level(GPIO_NUM_36) != 0 && pm_ && !pm_->enabled() &&
        switches_[0] && !switches_[0]->state && !ota_ && !wifi_.trial_active();
  }
  void restore_gpio23_() {
    gpio23_.restore([](bool high) {
      ESP_LOGI("pm23", "RESTORE_HIGH cancellation or shutdown");
      return gpio_set_level(GPIO_NUM_23, high ? 1 : 0) == ESP_OK;
    });
  }
#endif
  void capture_tick_(uint32_t now) {
    if (!capture_ || uint32_t(now - capture_tick_ms_) < 40) return;
    capture_tick_ms_ = now;
    if (model_.screen == Screen::PASSWORD || wifi_.trial_active() || ota_) {
      capture_.reset(); ESP_LOGI("ui_frame", "capture cancelled"); return;
    }
    if (capture_offset_ == 0) ESP_LOGI("ui_frame", "BEGIN %s %u", UI_VERSION, unsigned(now));
    if (capture_offset_ == 2560) {
      ESP_LOGI("ui_frame", "END"); capture_.reset(); return;
    }
    char hex[257];
    for (size_t i = 0; i < 128; i++) std::snprintf(hex + 2 * i, 3, "%02x", capture_[capture_offset_ + i]);
    ESP_LOGI("ui_frame", "%04u:%s", unsigned(capture_offset_), hex);
    capture_offset_ += 128;
  }
  static std::string number(float value, int decimals) {
    if (!std::isfinite(value)) return "—";
    char out[24]; std::snprintf(out, sizeof(out), decimals ? "%.1f" : "%.0f", double(value));
    for (char *p = out; *p; p++) if (*p == '.') *p = ',';
    return out;
  }
  void draw_number_(Painter &p, int x, int y, const std::string &s, int align, font::Font *preferred, int width = 144) {
    font::Font *f = ink(preferred, s).width <= width ? preferred : ink(number_, s).width <= width ? number_ : medium_;
    p.text(x, y, f, s, align, false, width);
  }
  static const char *setting_name_(int index) {
    static const char *const names[] = {"Яркость", "Сенсор PM2.5", "BLE-сканер", "Ночной режим", "Wi-Fi", "Назад"};
    return names[std::clamp(index, 0, 5)];
  }
  std::string setting_value_(int index) const {
    if (index == 0) return std::to_string(int(std::lround(brightness_->state))) + " / 6";
    if (index < 4) return switches_[index - 1]->state ? "Вкл." : "Выкл.";
    return "";
  }
  std::string selected_ssid_() const {
    return size_t(std::max(0, model_.network)) < wifi_.networks().size() ? wifi_.networks()[model_.network].ssid : "";
  }
  void render_menu_(Painter &p) {
    auto t = [&](int x, int y, const std::string &s, int align = -1, bool selected = false, int width = 140) {
      p.text(x, y, small_, s, align, selected, width);
    };
    const auto screen = model_.screen;
    if (screen == Screen::MENU) {
      p.text(10, 9, title_, "Управление"); p.rule(30);
      const int first = std::max(0, model_.menu - 3);
      for (int i = first; i < std::min(first + 4, 6); i++) {
        const int y = 39 + (i - first) * 18; const bool selected = i == model_.menu;
        if (selected) p.selected(y);
        t(10, y, setting_name_(i), -1, selected, 104); t(150, y, setting_value_(i), 1, selected, 37);
      }
      t(10, 112, "Центр: выбрать");
    } else if (screen == Screen::SETTING) {
      p.text(10, 10, title_, setting_name_(model_.menu));
      const std::string value = model_.menu == 0 ? std::to_string(model_.draft_value) + " / 6" : model_.draft_value ? "Вкл." : "Выкл.";
      p.text(80, 43, model_.menu == 0 ? number_ : medium_, value, 0);
      t(80, 79, model_.menu == 0 ? "Слева −   Справа +" : "Края: переключить", 0);
      t(80, 96, "Свайп: отмена", 0);
      t(80, 112, "Центр: применить", 0);
    } else if (screen == Screen::NETWORKS) {
      p.text(10, 9, title_, "Сети Wi-Fi"); p.rule(30);
      const auto &nets = wifi_.networks(); const int total = nets.size() + 2;
      const int first = std::max(0, model_.network - 3);
      for (int i = first; i < std::min(first + 4, total); i++) {
        const bool selected = i == model_.network; const int y = 39 + (i - first) * 18;
        if (selected) p.selected(y);
        if (i < int(nets.size())) {
          t(10, y, nets[i].ssid, -1, selected, 105);
          t(150, y, nets[i].rssi == -127 ? "сохр." : std::to_string(nets[i].rssi), 1, selected, 32);
        } else t(10, y, i == int(nets.size()) ? "Обновить список" : "Назад", -1, selected);
      }
      t(10, 112, wifi_.scanning() ? "Поиск сетей…" : "Центр: выбрать");
    } else if (screen == Screen::PASSWORD) {
      p.text(10, 9, title_, "Пароль Wi-Fi"); t(10, 30, selected_ssid_());
      const size_t n = std::strlen(model_.password.data());
      t(10, 51, std::string(std::min(size_t(15), n), '*') + "_  " + std::to_string(n));
      if (model_.keyboard_group < 4) {
        const char *set = Model::characters(model_.keyboard_group); const int size = std::strlen(set);
        const char current = set[model_.character];
        std::string selector;
        selector += set[Model::cycle(model_.character, -1, size)]; selector += "   ";
        selector += current == ' ' ? '_' : current; selector += "   "; selector += set[Model::cycle(model_.character, 1, size)];
        p.text(80, 72, medium_, selector, 0);
      } else p.text(80, 72, title_, model_.keyboard_group == 4 ? "Удалить символ" : model_.keyboard_group == 5 ? "Подключиться" : "Отмена", 0);
      static const char *const groups[] = {"abc", "ABC", "123", "#?!", "Удалить", "Готово", "Отмена"};
      t(10, 100, model_.password_invalid ? "Нужно 8–63 символа" : groups[model_.keyboard_group]);
      t(10, 112, "Свайп: набор/действие");
    } else if (screen == Screen::CONNECTING || screen == Screen::WIFI_OK) {
      p.text(10, 12, title_, screen == Screen::CONNECTING ? "Подключение…" : "Wi-Fi подключён");
      t(10, 44, selected_ssid_());
      t(10, 74, screen == Screen::CONNECTING ? "Проверяем соединение" : "Настройки сохранены");
      t(10, 111, screen == Screen::CONNECTING ? "Центр: отмена" : "Центр: к списку сетей");
    } else {
      const bool error = screen == Screen::WIFI_ERROR;
      p.text(10, 9, title_, error ? "Не удалось войти" : "Подключение Wi-Fi"); t(10, 31, selected_ssid_());
      const char *options[] = {error ? "Изменить пароль" : "Подключиться", error ? "Повторить" : "Изменить пароль", "Назад"};
      for (int i = 0; i < 3; i++) { const int y = 56 + 18 * i; if (model_.choice == i) p.selected(y); t(10, y, options[i], -1, model_.choice == i); }
      t(10, 112, error ? "Старая сеть сохранена" : "Центр: выбрать");
    }
  }
  void render_info_(Painter &p, const Readings &in) {
    auto t = [&](int x, int y, const std::string &s, int align = -1, int width = 140) { p.text(x, y, small_, s, align, false, width); };
    p.text(10, 23, title_, model_.info == 0 ? "Устройство" : model_.info == 1 ? "Сеть" : "Прошивка"); p.rule(43);
    auto *wf = wifi::global_wifi_component;
    if (model_.info == 0) {
      t(10, 53, "Wi-Fi"); t(150, 53, wf->is_connected() ? "Подключён" : "Нет сети", 1, 88);
      bool ha_connected = false;
      for (const auto &client : api::global_api_server->active_clients())
        if (std::strncmp(client->get_name(), "Home Assistant", 14) == 0) ha_connected = true;
      t(10, 73, "Home Assistant"); t(150, 73, ha_connected ? "В сети" : "Нет", 1, 45);
      t(10, 93, "Батарея"); t(150, 93, number(battery_->state, 0) + (in.usb ? "% · USB" : "%"), 1, 86);
      t(10, 111, "Центр: подробнее");
    } else if (model_.info == 1) {
      char ssid[wifi::SSID_BUFFER_SIZE]; t(10, 51, wf->is_connected() ? wf->wifi_ssid_to(ssid) : "Wi-Fi не подключён");
      std::string ip = "—"; for (const auto &a : wf->get_ip_addresses()) if (a.is_set() && a.is_ip4()) { char b[network::IP_ADDRESS_BUFFER_SIZE]; ip = a.str_to(b); break; }
      t(10, 70, "IP " + ip);
      t(10, 89, wf->is_connected() ? std::to_string(wf->wifi_rssi()) + " dBm" : "AP: ожидание");
      t(10, 111, "Центр: прошивка");
    } else {
      t(10, 51, PUBLIC_VERSION ? "Версия " + std::to_string(PUBLIC_VERSION) : UI_VERSION);
      t(10, 70, "ESPHome " ESPHOME_VERSION);
      char mac[MAC_ADDRESS_PRETTY_BUFFER_SIZE]; t(10, 89, get_mac_address_pretty_into_buffer(mac));
      t(10, 111, std::string(switches_[1]->state ? "BLE вкл. · " : "BLE выкл. · ") + std::to_string(millis_64() / 60000) + " мин.");
    }
  }
  Model model_;
  uint32_t inventory_next_{UINT32_MAX}, inventory_tick_{0};
  WifiSettings wifi_;
  cgdn1_display::Cgdn1Display *display_{nullptr};
  cgdn1_pm::Cgdn1Pm *pm_{nullptr};
  number::Number *brightness_{nullptr};
  switch_::Switch *switches_[3]{};
  sensor::Sensor *battery_{nullptr}, *pm25_sensor_{nullptr};
  font::Font *small_{nullptr}, *title_{nullptr}, *medium_{nullptr}, *large_{nullptr}, *number_{nullptr}, *summary_{nullptr};
  bool ota_{false}, ota_was_on_{true}, idle_shown_{false}, touched_{false}, pages_ready_{false};
  cgdn1_led::Sensor shown_sensor_{cgdn1_led::SENSOR_NONE};
  float shown_value_{NAN};
  int ota_percent_{0};
  uint32_t net_since_{0}, pm_ms_{0};
  bool pm_seen_{false};
  bool was_connected_{false}, offline_notice_{false};
  uint32_t offline_since_{0};
  std::unique_ptr<uint8_t[]> capture_;
  size_t capture_offset_{0};
  uint32_t capture_tick_ms_{0};
};
}  // namespace esphome::cgdn1_ui
