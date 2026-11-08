#pragma once
#include "stream.h"

namespace esphome::qf_native_update {
// Keep original-byte authentication coupled to the transformer. A successful
// push() means only that this chunk is writable to the INACTIVE slot. Only
// verified() permits the caller to activate it; a truncated/wrong-digest body
// never becomes a bootable update. No HTTP/flash credentials enter this class.
template<class Digest> class VerifiedImageStream {
 public:
  VerifiedImageStream(size_t size, const std::vector<Patch> &patches, const Values &values)
      : stream_(size, patches, values) { original_.init(); }
  bool push(uint8_t *bytes, size_t size) {
    if (!good_ || finalized_) return false;
    original_.add(bytes, size);
    return good_ = stream_.push(bytes, size);
  }
  bool verified(const char *expected_sha256) {
    if (!good_ || finalized_ || !stream_.complete()) return false;
    finalized_ = true; original_.calculate();
    return good_ = original_.equals_hex(expected_sha256);
  }
 private:
  ImageStream<Digest> stream_; Digest original_;
  bool good_{true}, finalized_{false};
};
}  // namespace esphome::qf_native_update
