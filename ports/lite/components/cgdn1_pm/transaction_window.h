#pragma once
#include <cstdint>

namespace qingping_pm {
// GPIO13/SCD4x read window for the qualified Lite profile. Its HIGH
// interval surrounds one ordinary SCD4x read, not a sensor restart or a new
// command. This tests continued measurement while the interface is unavailable.
// Nothing here establishes which PCB rail is connected or that the fan is quiet.
class TransactionWindow {
 public:
  static constexpr uint32_t MAX_HIGH_US = 25000;
  static constexpr uint32_t TRIAL_MS = 0;  // ordinary operation: no experiment deadline
  bool begin(uint32_t now_us) {
    if (active_ || failed_ || completed_) return false;
    active_ = true; started_us_ = now_us; ++windows_; return true;
  }
  void end(uint32_t now_us, bool wire_ok) {
    if (!active_) return;
    last_us_ = uint32_t(now_us - started_us_);
    if (last_us_ > max_us_) max_us_ = last_us_;
    active_ = false;
    // This is a synchronous duration check, not an independent hardware timer.
    // A blocked I2C call can exceed the budget; then keep HIGH permanently.
    if (!wire_ok || last_us_ > MAX_HIGH_US) failed_ = true;
  }
  void observe_low(uint32_t now_ms) {
    if (!started_) { started_ = true; first_low_ms_ = now_ms; }
    if (TRIAL_MS != 0 && uint32_t(now_ms - first_low_ms_) >= TRIAL_MS) completed_ = true;
  }
  void cancel() { completed_ = true; }
  bool active() const { return active_; }
  bool failed() const { return failed_; }
  bool completed() const { return completed_; }
  bool hold_high() const { return active_ || failed_ || completed_; }
  uint32_t windows() const { return windows_; }
  uint32_t last_us() const { return last_us_; }
  uint32_t max_us() const { return max_us_; }
 private:
  uint32_t started_us_{0}, first_low_ms_{0}, windows_{0}, last_us_{0}, max_us_{0};
  bool active_{false}, failed_{false}, completed_{false}, started_{false};
};
}  // namespace qingping_pm
