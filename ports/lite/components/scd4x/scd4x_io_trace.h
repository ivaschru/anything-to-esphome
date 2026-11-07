#pragma once
#include <cstdint>
#include <cstdio>
#include <string>

namespace qingping_pm {
// Read-only evidence for the existing SCD4x transaction. Never retries, changes
// a pin, issues a new command or alters calibration. Keep the first failure
// after recovery so a later successful sample cannot erase what went wrong.
class ScdIoTrace {
 public:
  void attempt() { ++attempts_; }
  void failure(unsigned stage, int error, uint32_t now) {
    ++failures_; last_stage_ = stage; last_error_ = error; last_at_ = now;
    if (!first_stage_) { first_stage_ = stage; first_error_ = error; first_at_ = now; }
  }
  void success() { ++good_; }
  std::string summary() const {
    char b[200];
    // stages: 1=ready-command write, 2=ready read/not-ready, 3=measurement
    // command write, 4=measurement read/CRC. Error numbers are the pinned
    // ESPHome i2c::ErrorCode, not an interpretation of physical board wiring.
    snprintf(b, sizeof(b), "try=%lu ok=%lu fail=%lu first=%u/%d@%lu last=%u/%d@%lu",
      (unsigned long)attempts_, (unsigned long)good_, (unsigned long)failures_,
      first_stage_, first_error_, (unsigned long)first_at_,
      last_stage_, last_error_, (unsigned long)last_at_);
    return b;
  }
 private:
  uint32_t attempts_{}, good_{}, failures_{}, first_at_{}, last_at_{};
  unsigned first_stage_{}, last_stage_{};
  int first_error_{}, last_error_{};
};
}  // namespace qingping_pm
