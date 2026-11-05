#pragma once
#include <cstdint>

namespace esphome::cgdn1_ui {
// A temporary, deliberately narrow experiment: the sole permitted output is
// the already configured GPIO23 latch, LOW once and then its original HIGH.
// This timer is cooperative firmware logic, NOT a guarantee after power loss.
// If LOW cuts the MCU rail, only the owner's rear-button recovery can help.
class Gpio23Trial {
 public:
  static constexpr uint32_t LOW_MS = 6000;
  bool active() const { return active_; }
  bool consumed() const { return consumed_; }
  uint32_t remaining(uint32_t now) const {
    const uint32_t elapsed = now - started_;
    return active_ && elapsed < LOW_MS ? LOW_MS - elapsed : 0;
  }
  template<class Write> bool start(uint32_t now, bool admitted, Write write) {
    if (!admitted || consumed_) return false;
    // Claim before the write: duplicate API packets cannot restart or extend
    // this boot's experiment, even when the initial LOW reports an error.
    consumed_ = active_ = true;
    started_ = now;
    if (!write(false)) { restore(write); return false; }
    return true;
  }
  template<class Write> void tick(uint32_t now, bool safe, Write write) {
    // Unsigned subtraction also bounds a trial crossing millis() wraparound.
    // Loss of USB, normal PM ON, Wi-Fi trial or OTA ends LOW immediately.
    if (active_ && (!safe || uint32_t(now - started_) >= LOW_MS)) restore(write);
  }
  template<class Write> void restore(Write write) {
    if (!active_) return;
    // Keep the recovery claim active if the SDK fails HIGH. Subsequent loop
    // and shutdown calls may retry HIGH only; LOW is never repeated.
    if (write(true)) active_ = false;
  }
 private:
  uint32_t started_{0};
  bool active_{false}, consumed_{false};
};
}  // namespace esphome::cgdn1_ui
