#pragma once
#include <cmath>
#include <cstdint>

namespace qingping_pm {
// Source-ready GPIO13 policy, independent of ESPHome scheduling. A restored PM OFF
// must not cut a line while another sensor is still doing asynchronous setup.
// Observe actual source callbacks first. If a source then fails, restore HIGH
// and latch the fallback until an explicit PM ON request, avoiding fan cycling.
class RailPolicy {
 public:
  void sample(unsigned index, float value, uint32_t now) {
    if (index >= 3) return;
    seen_[index] = true; finite_[index] = std::isfinite(value); at_[index] = now;
  }
  bool high(bool enabled, uint32_t now) {
    if (enabled) { fault_ = false; cut_ = false; return true; }
    bool healthy = true;
    for (unsigned i = 0; i < 3; ++i)
      healthy &= seen_[i] && finite_[i] && uint32_t(now - at_[i]) <= 90000U;
    // Preserve the *first* reason before restoring HIGH. Later good reports
    // must not overwrite the evidence that triggered this latched fallback.
    if (cut_ && !healthy && !fault_) {
      fault_now_ = now; fault_bad_ = 0; fault_seen_ = 0; fault_finite_ = 0;
      for (unsigned i = 0; i < 3; ++i) {
        fault_age_[i] = uint32_t(now - at_[i]);
        fault_at_[i] = at_[i];
        if (seen_[i]) fault_seen_ |= uint8_t(1U << i);
        if (finite_[i]) fault_finite_ |= uint8_t(1U << i);
        if (!seen_[i] || !finite_[i] || fault_age_[i] > 90000U)
          fault_bad_ |= uint8_t(1U << i);
      }
    }
    if (cut_ && !healthy) fault_ = true;
    if (fault_ || !healthy) return true;
    cut_ = true; return false;
  }
  bool fault() const { return fault_; }
  bool cut() const { return cut_ && !fault_; }
  uint32_t fault_now() const { return fault_now_; }
  uint8_t fault_bad() const { return fault_bad_; }
  uint8_t fault_seen() const { return fault_seen_; }
  uint8_t fault_finite() const { return fault_finite_; }
  uint32_t fault_age(unsigned i) const { return i < 3 ? fault_age_[i] : 0; }
  uint32_t fault_at(unsigned i) const { return i < 3 ? fault_at_[i] : 0; }
 private:
  uint32_t fault_now_{0}, fault_age_[3]{}, fault_at_[3]{};
  uint8_t fault_bad_{0}, fault_seen_{0}, fault_finite_{0};
  bool seen_[3]{}, finite_[3]{};
  uint32_t at_[3]{};
  bool cut_{false}, fault_{false};
};
}  // namespace qingping_pm
