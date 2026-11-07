#pragma once
#include "esphome/core/component.h"
#include "esphome/core/hal.h"
#include "esphome/core/log.h"
#include "esphome/components/pmsa003i/pmsa003i.h"
#include <cmath>
#include <string>
#include <cstdio>
#include "rail_policy.h"
#include "transaction_window.h"

namespace esphome::cgdn1_pm {
static constexpr const char *TAG = "cgdn1_pm";

// Quiet PM OFF for the qualified direct-I2C Lite profile. LOW follows actual
// CO2/raw T/raw RH reports; a source failure restores HIGH with a latch.
// GPIO18/23 are unchanged. SCD4x reads briefly restore GPIO13 through RAII;
// the ordinary measurement core keeps running. No unknown sensor command or
// PCB supply topology is assumed. Hardware/acoustic qualification is per build.
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
  void set_source_sensors(sensor::Sensor *co2, sensor::Sensor *temperature, sensor::Sensor *humidity) {
    sources_[0] = co2; sources_[1] = temperature; sources_[2] = humidity;
  }
  // RAII closes the HIGH window on every early return in the actual driver.
  // No deferred callback may retain this token, and it cannot be copied.
  class ScdWindow {
   public:
    explicit ScdWindow(Cgdn1Pm *owner) : owner_(owner) {
      opened_ = owner_ != nullptr && owner_->begin_scd_window_();
    }
    ScdWindow(const ScdWindow &) = delete;
    ScdWindow &operator=(const ScdWindow &) = delete;
    ~ScdWindow() { finish(); }
    void wire_ok() { wire_ok_ = true; }
    void finish() {
      if (opened_) { owner_->end_scd_window_(wire_ok_); opened_ = false; }
    }
   private:
    Cgdn1Pm *owner_; bool opened_{false}, wire_ok_{false};
  };
  std::string window_detail() const {
    char out[144];
    snprintf(out, sizeof(out), "windows=%lu last_us=%lu max_us=%lu failed=%u completed=%u active=%u",
      (unsigned long)window_.windows(), (unsigned long)window_.last_us(),
      (unsigned long)window_.max_us(), unsigned(window_.failed()),
      unsigned(window_.completed()), unsigned(window_.active()));
    return out;
  }
  void on_shutdown() override {
    window_.cancel();
    enable_pin_->digital_write(true); rail_high_ = true;
  }
  std::string rail_state() const {
    if (enabled_) return "PM ON";
    if (window_.failed()) return "Transaction guard fallback";
    if (window_.completed()) return "Transaction trial complete";
    if (rail_.fault()) return "Sensor guard fallback";
    return rail_.cut() ? "GPIO13 LOW + CO2 windows" : "Waiting for sensors";
  }
  // C/T/H bits are 1/2/4. f_age and f_at belong to the first fault,
  // not the latest recovered source; timestamps expose clock/wrap mistakes too.
  std::string source_guard_detail() const {
    char text[240];
    snprintf(text, sizeof(text),
      "bad=%u seen=%u finite=%u f_now=%lu f_age=%lu/%lu/%lu f_at=%lu/%lu/%lu",
      unsigned(rail_.fault_bad()), unsigned(rail_.fault_seen()), unsigned(rail_.fault_finite()),
      (unsigned long)rail_.fault_now(),
      (unsigned long)rail_.fault_age(0), (unsigned long)rail_.fault_age(1), (unsigned long)rail_.fault_age(2),
      (unsigned long)rail_.fault_at(0), (unsigned long)rail_.fault_at(1), (unsigned long)rail_.fault_at(2));
    return text;
  }
  void loop() override { if (setup_done_) apply_gate_(); }
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
    // These are raw sensor callbacks, not recalculated HA temperature values.
    // All three must have produced a real finite report during this boot.
    for (unsigned i = 0; i < 3; ++i) if (sources_[i])
      sources_[i]->add_on_state_callback([this, i](float value) { rail_.sample(i, value, millis()); });
    setup_done_ = true;
    apply_();
  }
  void dump_config() override {
    ESP_LOGCONFIG("cgdn1_pm", "PM polling: %s; readings: %s; warmup: %u ms; PM source guard active",
                  enabled_ ? "ON" : "OFF", ready_ ? "ready" : "unavailable", (unsigned) warmup_ms_);
    LOG_PIN("  Enable pin: ", enable_pin_);
  }

 protected:
  void apply_gate_() {
    const bool source_high = rail_.high(enabled_, millis());
    if (!source_high) window_.observe_low(millis());
    const bool high = source_high || window_.hold_high();
    if (high == rail_high_) return;
    enable_pin_->digital_write(high); rail_high_ = high;
    ESP_LOGI("cgdn1_pm", "PM source guard: GPIO13=%s (%s)", high ? "HIGH" : "LOW", rail_state().c_str());
    ESP_LOGI("cgdn1_pm", "PM guard detail: %s", source_guard_detail().c_str());
  }
  bool begin_scd_window_() {
    // Boot/setup and any latched fallback retain normal HIGH. No GPIO18/23,
    // mux, pulls, calibration, reset or arbitrary bus command is exposed.
    if (!setup_done_ || enabled_ || rail_high_ || !rail_.cut() || window_.hold_high()) return false;
    if (!window_.begin(micros())) return false;
    enable_pin_->digital_write(true); rail_high_ = true;
    delayMicroseconds(1000);  // small settling interval, not a sensor power-up claim
    return true;
  }
  void end_scd_window_(bool wire_ok) {
    window_.end(micros(), wire_ok);
    apply_gate_();
  }
  qingping_pm::TransactionWindow window_;
  qingping_pm::RailPolicy rail_;
  sensor::Sensor *sources_[3]{};
  bool rail_high_{true};
  void invalidate_() {
    // HA must see unknown/unavailable, never a convincing stale value or zero.
    for (auto *s : sensors_) if (s != nullptr) s->publish_state(NAN);
  }
  void apply_() {
    cancel_timeout("pm_warmup");
    reader_->stop_poller();
    ready_ = false;
    invalidate_();
    // Wait for actual sources before LOW; source failure latches HIGH.
    apply_gate_();
    ESP_LOGI("cgdn1_pm", "PM polling %s; PM source guard active", enabled_ ? "ON (warming up)" : "OFF");
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
