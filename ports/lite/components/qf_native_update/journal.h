#pragma once
#include <cstdint>
#include <cstddef>

namespace esphome::qf_native_update {
// Fixed, value-free NVS record. No erase/reset or automatic replay is part of
// this policy. The sequence survives known failures as well as successful boots.
struct Journal {
  uint32_t magic{0x51464e31}, sequence{0}, target{0};
  uint8_t phase{0}, profile{0}; uint8_t reserved[2]{};
};
enum class Recovery { BLOCKED, READY, TARGET_BOOTED };
inline Recovery review_journal(const Journal &record, size_t size, uint8_t profile, uint32_t revision) {
  if (size != sizeof(Journal) || record.magic != 0x51464e31 || record.profile != profile ||
      record.phase < 1 || record.phase > 3 || !record.sequence || !record.target ||
      record.reserved[0] || record.reserved[1]) return Recovery::BLOCKED;
  if (record.phase == 1) return record.target == revision ? Recovery::TARGET_BOOTED : Recovery::BLOCKED;
  // A known pre-activation failure never selected another boot slot. It may
  // be followed by a NEW explicit click even after a restart. By contrast,
  // booting older firmware after a completed newer update requires review.
  if (record.phase == 3 && record.target > revision) return Recovery::BLOCKED;
  return Recovery::READY;
}
inline bool newer_release(uint32_t revision, uint32_t version, uint32_t installed_revision, uint32_t installed_version) {
  return revision > installed_revision && version > installed_version && revision <= 1000000 && version <= 1000000;
}
}  // namespace esphome::qf_native_update
