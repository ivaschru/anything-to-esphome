#pragma once

// Byte-stream decoder for the 60-byte frames observed on this CGS1's PM UART.
// This deliberately does not claim PMSx003 compatibility: the on-device
// firmware uses a peculiar additive checksum, not a standard CRC16. Physical
// captures and independently inspected stock code agree on the calculation.
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <cmath>

namespace cgs1_direct_trial {
struct PMFrame {
  int32_t pm25_raw = 0;
  uint32_t counter = 0;
};

// The UART mass field uses hundredths of µg/m³. This extra scale is applied
// in stock processingCacheData(), AFTER dataHandle() and its PM25K multiplier.
// The tested unit has no factory factor record, so its effective PM25K is 1.
// Keep the physical sensor value separate from the vendor's display correction.
inline float pm25_mass(int32_t raw) { return float(raw) / 100.0f; }
inline float pm25_corrected(int32_t raw) {
  const float mass = pm25_mass(raw);
  // Verified stock piecewise curve. Stock also adds qrand()%100 /100 below
  // the breakpoint; deliberately omit this invented noise. Report a stable
  // continuous result, leaving presentation rounding to ESPHome/the UI.
  const float corrected = mass <= 287.0f
      ? 1.423f * mass - 0.0007f * mass * mass
      : mass + 63.0f;
  return std::fmin(999.0f, std::fmax(0.0f, corrected));
}

class PMDecoder {
 public:
  bool feed(uint8_t byte, PMFrame &result) {
    bytes_[used_++] = byte;
    // Resynchronize on the observed header/length. Retain a possible suffix
    // rather than discarding a whole subsequent good frame after corruption.
    while (used_ && bytes_[0] != 0x5A) discard_first_();
    if (used_ >= 2 && bytes_[1] != 0xA5) { discard_first_(); return false; }
    if (used_ >= 4 && (bytes_[2] != 0x34 || bytes_[3] != 0)) {
      discard_first_(); return false;
    }
    if (used_ < sizeof(bytes_)) return false;
    uint16_t sum = 0;
    for (size_t i = 0; i < 56; i += 4)
      sum = uint16_t(sum + bytes_[i] + bytes_[i + 1] + (uint16_t(bytes_[i + 2]) << 8));
    const uint16_t received = (uint16_t(bytes_[58]) << 8) | bytes_[59];
    if (sum != received) {
      ++bad_checksums_;
      discard_first_();
      return false;
    }
    const uint32_t value = little32_(bytes_ + 16);
    result.pm25_raw = int32_t(value);
    result.counter = little32_(bytes_ + 4);
    used_ = 0;
    // A conservative application limit of 999 µg/m³ BEFORE correction is
    // separate from the weak wire checksum. The vendor sentinel 99999 and
    // signed-negative/high-byte corruptions are outside this accepted range.
    if (value > 99900) { ++invalid_values_; return false; }
    return true;
  }
  unsigned bad_checksums() const { return bad_checksums_; }
  unsigned invalid_values() const { return invalid_values_; }

 private:
  static uint32_t little32_(const uint8_t *p) {
    return uint32_t(p[0]) | (uint32_t(p[1]) << 8) |
           (uint32_t(p[2]) << 16) | (uint32_t(p[3]) << 24);
  }
  void discard_first_() {
    --used_;
    std::memmove(bytes_, bytes_ + 1, used_);
  }
  uint8_t bytes_[60]{};
  size_t used_ = 0;
  unsigned bad_checksums_ = 0;
  unsigned invalid_values_ = 0;
};
}  // namespace cgs1_direct_trial
