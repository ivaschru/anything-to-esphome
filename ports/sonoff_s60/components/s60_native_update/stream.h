#pragma once

// The only image mutation is replacement of known fixed slots inside segment
// data. Headers/addresses/lengths remain unchanged. Both layout and every marker
// byte are checked while streaming, including across arbitrary HTTP boundaries.
// The caller must separately verify SHA-256 of ALL original HTTP bytes before
// end()/activation. This class has no network, flash or activation authority.
#include "slot_markers.h"
#include <array>
#include <cstdint>
#include <cstring>
#include <string>
#include <vector>

namespace esphome::s60_native_update {
struct Patch { uint32_t offset; uint8_t slot; };
using Values = std::array<std::string, SLOT_COUNT>;

template<class Digest> class ImageStream {
 public:
  ImageStream(size_t size, const std::vector<Patch> &patches, const Values &values)
      : size_(size), patches_(patches), values_(values) {
    valid_ = size >= 64 && size < 0x1f0000 && !patches.empty() && patches.size() <= 128;
    std::array<unsigned, SLOT_COUNT> counts{};
    size_t previous_end = 24;
    for (const auto &p : patches) {
      if (p.slot >= SLOT_COUNT) { valid_ = false; break; }
      const size_t length = marker_size(p.slot);
      valid_ &= p.offset >= previous_end && p.offset < size && length <= size - p.offset;
      valid_ &= values[p.slot].size() <= length;
      if (p.slot == 4 || p.slot == 8) valid_ &= values[p.slot].size() == length;
      if (p.slot != 8) valid_ &= values[p.slot].find('\0') == std::string::npos;
      bool unchanged = values[p.slot].size() == length;
      for (size_t j = 0; unchanged && j < length; ++j)
        unchanged &= uint8_t(values[p.slot][j]) == marker_byte(p.slot, j);
      valid_ &= !unchanged;
      previous_end = size_t(p.offset) + length;
      ++counts[p.slot];
    }
    for (auto count : counts) valid_ &= count > 0;
    digest_.init();
  }

  bool push(uint8_t *bytes, size_t length) {
    if (!valid_ || length > size_ - position_) return valid_ = false;
    size_t hash_start = 0;
    for (size_t i = 0; i < length; ++i, ++position_) {
      const uint8_t original = bytes[i];
      bool data = false;
      if (position_ < 24) {
        header_[position_] = original;
        if (position_ == 23) {
          if (header_[0] != 0xe9 || header_[1] < 1 || header_[1] > 16 ||
              header_[12] != 5 || header_[13] || header_[23] != 1) return valid_ = false;
          remaining_segments_ = header_[1]; segment_header_ = 24;
        }
      } else if (position_ >= segment_header_ && position_ < segment_header_ + 8 && remaining_segments_) {
        segment_[position_ - segment_header_] = original;
        if (position_ == segment_header_ + 7) {
          uint32_t n = uint32_t(segment_[4]) | uint32_t(segment_[5]) << 8 |
                       uint32_t(segment_[6]) << 16 | uint32_t(segment_[7]) << 24;
          data_start_ = position_ + 1;
          if (n > size_ - data_start_) return valid_ = false;
          data_end_ = data_start_ + n;
          // Empty segments are valid; advance them at their header boundary.
          if (!n) advance_segment_();
        }
      } else if (position_ >= data_start_ && position_ < data_end_) {
        data = true; original_xor_ ^= original;
      } else if (remaining_segments_ == 0 && position_ == checksum_) {
        if (original != original_xor_) return valid_ = false;
        bytes[i] = output_xor_;
      } else if (remaining_segments_ == 0 && position_ > checksum_) {
        const size_t at = position_ - checksum_ - 1;
        if (at >= 32 || !hash_done_) return valid_ = false;
        bytes[i] = hash_[at];
      } else if (remaining_segments_ != 0) return valid_ = false;

      if (patch_index_ < patches_.size()) {
        const auto &p = patches_[patch_index_];
        if (position_ >= p.offset) {
          const size_t at = position_ - p.offset;
          if (!data || at >= marker_size(p.slot) || original != marker_byte(p.slot, at)) return valid_ = false;
          bytes[i] = at < values_[p.slot].size() ? uint8_t(values_[p.slot][at]) : 0;
          if (at + 1 == marker_size(p.slot)) ++patch_index_;
        }
      }
      if (data) {
        output_xor_ ^= bytes[i];
        if (position_ + 1 == data_end_) advance_segment_();
      }
      if (position_ >= 24 && !remaining_segments_ && position_ == checksum_) {
        if (checksum_ + 33 != size_) return valid_ = false;
        digest_.add(bytes + hash_start, i + 1 - hash_start);
        digest_.calculate(); digest_.get_bytes(hash_.data()); hash_done_ = true;
        hash_start = length;
      }
    }
    if (!hash_done_ && hash_start < length) digest_.add(bytes + hash_start, length - hash_start);
    return true;
  }
  bool complete() const { return valid_ && position_ == size_ && hash_done_ && patch_index_ == patches_.size(); }

 private:
  void advance_segment_() {
    if (--remaining_segments_) segment_header_ = data_end_;
    else checksum_ = data_end_ + 15 - data_end_ % 16;
  }
  size_t size_, position_{0}, patch_index_{0};
  const std::vector<Patch> &patches_; const Values &values_;
  Digest digest_; std::array<uint8_t,32> hash_{};
  uint8_t header_[24]{}, segment_[8]{}, original_xor_{0xef}, output_xor_{0xef};
  size_t segment_header_{24}, data_start_{0}, data_end_{0}, checksum_{0};
  uint8_t remaining_segments_{0}; bool valid_{false}, hash_done_{false};
};
}  // namespace esphome::s60_native_update
