#pragma once

// ESPHome host millis() is Linux uptime modulo 2^32, NOT time since this
// application started. An initial absolute deadline of 1000 can therefore
// already be more than half a uint32 cycle in the past. Comparing `now < end`
// also stops reads across the roughly 49.7-day rollover.
#include <cstdint>

namespace cgs1_time {
template<uint32_t Interval> class Cadence {
 public:
  static_assert(Interval > 0 && Interval < 0x80000000U, "bounded nonzero cadence required");
  bool due(uint32_t now) {
    // Take one immediate first measurement at ANY host uptime. Later reads
    // compare elapsed unsigned time, including rollover. A delayed loop gets
    // one real sample; it never replays imagined samples/calibration steps.
    // The caller must run at least once per full millis cycle; the independent
    // 10-second native lease is much stricter than that practical requirement.
    if (!started_ || uint32_t(now-last_) >= Interval) {
      started_ = true; last_ = now; return true;
    }
    return false;
  }
 private:
  uint32_t last_{0}; bool started_{false};
};
}  // namespace cgs1_time
