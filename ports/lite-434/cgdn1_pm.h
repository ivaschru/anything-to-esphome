#pragma once
#include "esphome/core/component.h"
#include "esphome/core/hal.h"
#include "esphome/core/log.h"
#include "esphome/components/pmsa003i/pmsa003i.h"
#include <cmath>
#include <string>

namespace esphome::cgdn1_pm {
[[maybe_unused]] static constexpr const char *TAG = "cgdn1_pm";
// Original stock 4.3.4 / HW0001 is a separate release profile. Its fan has
// NOT been stopped successfully while preserving all physical measurements.
// Keep the known sensor rail HIGH throughout PM OFF. Only polling changes;
// never claim a fan-off state from an absent PM value or a GPIO latch alone.
// GPIO18, GPIO23, the board power latch and sensor commands are unchanged.
class Cgdn1Pm : public Component {
 public:
  void set_reader(pmsa003i::PMSA003IComponent *reader) { reader_ = reader; }
  void set_enable_pin(GPIOPin *pin) { enable_pin_ = pin; }
  void set_sensors(sensor::Sensor *pm1, sensor::Sensor *pm25, sensor::Sensor *pm10) {
    sensors_[0] = pm1; sensors_[1] = pm25; sensors_[2] = pm10;
  }
  void set_source_sensors(sensor::Sensor *, sensor::Sensor *, sensor::Sensor *) {}
  void set_warmup_time(uint32_t ms) { warmup_ms_ = ms; }
  void set_enabled(bool enabled) {
    if (enabled_ == enabled) return;
    enabled_ = enabled;
    if (setup_done_) apply_();
  }
  // The shared SCD4x driver owns this scoped interface. Here it deliberately
  // does nothing: this profile does not cut or pulse the rail for a read.
  class ScdWindow {
   public:
    explicit ScdWindow(Cgdn1Pm *) {}
    ScdWindow(const ScdWindow &) = delete;
    ScdWindow &operator=(const ScdWindow &) = delete;
    void wire_ok() {}
    void finish() {}
  };
  std::string rail_state() const { return enabled_ ? "PM ON" : "PM polling OFF; fan remains ON"; }
  std::string window_detail() const { return "continuous HIGH; no transaction windows"; }
  std::string source_guard_detail() const { return "4.3.4 polling-only; no rail gating"; }
  bool enabled() const { return enabled_; }
  bool ready() const { return ready_; }
  uint32_t warmup_remaining_ms() const {
    if (!enabled_ || ready_) return 0;
    const uint32_t elapsed = millis() - warmup_started_;
    return elapsed < warmup_ms_ ? warmup_ms_ - elapsed : 0;
  }
  float get_setup_priority() const override { return setup_priority::DATA - 1.0f; }
  void setup() override {
    // Set the latch before enabling the output, preserving the boot level.
    enable_pin_->digital_write(true);
    enable_pin_->setup();
    setup_done_ = true;
    apply_();
  }
  void on_shutdown() override { enable_pin_->digital_write(true); }
  void dump_config() override {
    ESP_LOGCONFIG("cgdn1_pm", "4.3.4 polling-only: PM %s; fan shutdown unsupported",
                  enabled_ ? "ON" : "OFF");
    LOG_PIN("  Enable pin: ", enable_pin_);
  }
 protected:
  void apply_() {
    cancel_timeout("pm_warmup");
    reader_->stop_poller();
    ready_ = false;
    // Invalidating all physical PM exports prevents stale/zero values from
    // masquerading as clean air. CO2/T/RH are independent and not modified.
    for (auto *sensor : sensors_) if (sensor) sensor->publish_state(NAN);
    enable_pin_->digital_write(true);
    if (!enabled_) { reader_->status_clear_warning(); return; }
    warmup_started_ = millis();
    set_timeout("pm_warmup", warmup_ms_, [this]() {
      if (!enabled_) return;
      if (reader_->is_failed()) { status_set_warning(); return; }
      ready_ = true;
      reader_->update(); reader_->start_poller(); status_clear_warning();
    });
  }
  pmsa003i::PMSA003IComponent *reader_{nullptr};
  GPIOPin *enable_pin_{nullptr};
  sensor::Sensor *sensors_[3]{};
  uint32_t warmup_ms_{30000}, warmup_started_{0};
  bool enabled_{true}, ready_{false}, setup_done_{false};
};
}  // namespace esphome::cgdn1_pm
