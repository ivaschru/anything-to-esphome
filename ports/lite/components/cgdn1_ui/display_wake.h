#pragma once
#include <cstdint>

namespace esphome::cgdn1_ui {
// Separate the user's Display intent from a temporary night
// wake. Touch must not disable the schedule or change the manual intent. Unsigned
// elapsed time also works across millis() rollover; every window is < 2^31 ms.
class DisplayWake {
 public:
  static constexpr uint32_t WAKE_MS = 30000;
  void request(bool on) { requested_ = on; if (!on) awake_ = false; }
  void set_night(bool active) {
    if (active != night_) { night_ = active; awake_ = false; }
  }
  bool night() const { return night_; }
  bool visible(uint32_t now) const {
    return night_ ? awake_ && uint32_t(now - last_touch_) < WAKE_MS : requested_;
  }
  // Caller accepts only recognized physical gestures. A dark wake is consumed
  // by the UI before it can navigate, save a draft or confirm a restart.
  void wake(uint32_t now) { awake_ = true; last_touch_ = now; }
  void activity(uint32_t now) { if (night_ && awake_) last_touch_ = now; }
 private:
  bool requested_{true}, night_{false}, awake_{false};
  uint32_t last_touch_{0};
};
}  // namespace esphome::cgdn1_ui
