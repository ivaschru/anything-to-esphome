#pragma once
#include "protocol.h"

namespace qingping::mcu4x {
// Separate wire evidence, never a physical fan-state sensor. The 0354 input
// handler emits key0x25 after processing PM interval0x24. Retain the raw status
// until exact0425 has been observed. Duplicate/malformed ACKs do not count.
class PmIntervalAck {
 public:
  bool observe(const Frame &frame, uint32_t now) {
    if (frame.command != 0x32 || frame.length < 7 || frame.length > MAX_FRAME || frame.count > MAX_TLVS)
      return false;
    bool found = false;
    uint8_t status = 0;
    for (size_t i = 0; i < frame.count; ++i) {
      const auto &tlv = frame.tlvs[i];
      if (tlv.key != 0x25) continue;
      if (found || tlv.length != 1 || tlv.offset < 5 || tlv.offset >= frame.length - 2)
        return false;
      found = true; status = frame.bytes[tlv.offset];
    }
    if (!found) return false;
    ++count_; status_ = status; at_ = now;
    return true;
  }
  uint32_t count() const { return count_; }
  int status() const { return status_; }
  int64_t age(uint32_t now) const { return count_ ? int64_t(now - at_) : -1; }
 protected:
  uint32_t count_{0};
  uint32_t at_{0};
  int status_{-1};
};
}  // namespace qingping::mcu4x
