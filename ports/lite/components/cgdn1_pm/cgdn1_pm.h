#pragma once
#include "esphome/core/component.h"
#include "esphome/core/hal.h"
#include "esphome/core/log.h"
#include "esphome/components/pmsa003i/pmsa003i.h"
#include <cmath>

namespace esphome::cgdn1_pm {
static constexpr const char *TAG = "cgdn1_pm";

// PM OFF is a measurement preference, not permission to cut a sensor supply.
// GPIO13 LOW can also interrupt CO2 communication on supported CGDN1 boards.
// Keep its known-working HIGH state for both restored and runtime OFF; suspend
// only PM polling and publish unavailable values. This does not stop the fan.
// Whole-board shutdown stays exclusively in cgdn1_boot; GPIO18 is untouched.
class Cgdn1Pm : public Component {
 public:
  void set_reader(pmsa003i::PMSA003IComponent *reader) { reader_ = reader; }
  void set_enable_pin(GPIOPin *pin) { enable_pin_ = pin; }
  void set_sensors(sensor::Sensor *pm1, sensor::Sensor *pm25, sensor::Sensor *pm10) {
    sensors_[0] = pm1; sensors_[1] = pm25; sensors_[2] = pm10;
  }
  void set_warmup_time(uint32_t ms) { warmup_ms_ = ms; }
  // The template switch restores before sensor setup. Save its request without
  // cutting the supply under PMSA003I::setup(), whose failed probe is permanent.
  void set_enabled(bool enabled) {
    if (enabled_ == enabled) return;
    enabled_ = enabled;
    if (setup_done_) apply_();
  }
  bool enabled() const { return enabled_; }
  bool ready() const { return ready_; }
  uint32_t warmup_remaining_ms() const {
    if (!enabled_ || ready_) return 0;
    const uint32_t elapsed = millis() - warmup_started_;
    return elapsed < warmup_ms_ ? warmup_ms_ - elapsed : 0;
  }
  float get_setup_priority() const override { return setup_priority::DATA - 1.0f; }
  void setup() override {
    // cgdn1_boot already held the rail high for the reader's initial probe.
    // Preserve that level while configuring the output; then apply restoration.
    enable_pin_->digital_write(true);
    enable_pin_->setup();
    setup_done_ = true;
    apply_();
  }
  void dump_config() override {
    ESP_LOGCONFIG("cgdn1_pm", "PM polling: %s; readings: %s; warmup: %u ms; GPIO13 HIGH",
                  enabled_ ? "ON" : "OFF", ready_ ? "ready" : "unavailable", (unsigned) warmup_ms_);
    LOG_PIN("  Enable pin: ", enable_pin_);
  }

 protected:
  void invalidate_() {
    // HA must see unknown/unavailable, never a convincing stale value or zero.
    for (auto *s : sensors_) if (s != nullptr) s->publish_state(NAN);
  }
  void apply_() {
    cancel_timeout("pm_warmup");
    reader_->stop_poller();
    ready_ = false;
    invalidate_();
    // Restore/rapid toggles must never cut the rail under asynchronous CO2
    // setup or a pending measurement. Polling and rail ownership are separate.
    enable_pin_->digital_write(true);
    ESP_LOGI("cgdn1_pm", "PM polling %s; GPIO13 HIGH", enabled_ ? "ON (warming up)" : "OFF");
    if (!enabled_) {
      reader_->status_clear_warning();  // deliberately stopped polling does not imply an I2C failure
      return;
    }
    // Each wake starts a new warmup. Turning off cancels it, so an old callback
    // cannot restart polling after a quick ON/OFF or ON/OFF/ON sequence.
    warmup_started_ = millis();
    set_timeout("pm_warmup", warmup_ms_, [this]() {
      if (!enabled_) return;
      if (reader_->is_failed()) {
        status_set_warning();
        ESP_LOGW("cgdn1_pm", "Reader failed its boot probe; keep readings unavailable");
        return;
      }
      ready_ = true;
      reader_->update();
      reader_->start_poller();
      status_clear_warning();
      ESP_LOGI("cgdn1_pm", "PM warmup complete; polling resumed");
    });
  }
  pmsa003i::PMSA003IComponent *reader_{nullptr};
  GPIOPin *enable_pin_{nullptr};
  sensor::Sensor *sensors_[3]{};
  uint32_t warmup_ms_{30000};
  uint32_t warmup_started_{0};
  bool enabled_{true}, ready_{false}, setup_done_{false};
};
}  // namespace esphome::cgdn1_pm
