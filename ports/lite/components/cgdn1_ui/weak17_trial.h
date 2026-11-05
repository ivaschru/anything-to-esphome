#pragma once
#include <cstdint>

namespace esphome::cgdn1_ui {
// RTC-noinit retains this tiny public pull snapshot across a warm reset. It
// contains no identifiers/secrets, writes no flash/NVS and has no constructor.
// Complementary fields reject erased/random/torn records after full power loss.
struct Weak17RecoveryRecord {
  uint32_t magic, magic_inverse, original_pd, original_pd_inverse;
};
static constexpr uint32_t WEAK17_RECOVERY_MAGIC = 0x504D3137U;
inline bool weak17_recovery_valid(const volatile Weak17RecoveryRecord &record) {
  return record.magic == WEAK17_RECOVERY_MAGIC && record.magic_inverse == ~WEAK17_RECOVERY_MAGIC &&
      record.original_pd <= 1 && record.original_pd_inverse == ~record.original_pd;
}
inline void weak17_recovery_arm(volatile Weak17RecoveryRecord &record, bool original_pd) {
  record.magic = 0;
  record.original_pd = original_pd ? 1U : 0U;
  record.original_pd_inverse = ~record.original_pd;
  record.magic_inverse = ~WEAK17_RECOVERY_MAGIC;
  __atomic_thread_fence(__ATOMIC_SEQ_CST);
  record.magic = WEAK17_RECOVERY_MAGIC;
  __atomic_thread_fence(__ATOMIC_SEQ_CST);
}
inline void weak17_recovery_clear(volatile Weak17RecoveryRecord &record) {
  record.magic = 0;
  __atomic_thread_fence(__ATOMIC_SEQ_CST);
}
// Timer/one-shot policy for a WEAK internal pull only. The adapter owns a
// fixed GPIO17 pull-mask snapshot; it must never alter a pin's output or mux.
class Weak17Trial {
 public:
  static constexpr uint32_t DURATION_MS = 6000;
  bool active() const { return active_; }
  bool consumed() const { return consumed_; }
  void block_replay_after_recovery() { consumed_ = true; }
  uint32_t remaining(uint32_t now) const {
    const uint32_t elapsed = now - start_;
    return active_ && elapsed < DURATION_MS ? DURATION_MS - elapsed : 0;
  }
  template<class Apply> bool begin(uint32_t now, bool admitted, Apply apply) {
    if (!admitted || consumed_) return false;
    consumed_ = active_ = true; start_ = now;
    if (!apply(true)) { restore(apply); return false; }
    return true;
  }
  template<class Apply> void tick(uint32_t now, bool safe, Apply apply) {
    if (active_ && (!safe || uint32_t(now - start_) >= DURATION_MS)) restore(apply);
  }
  template<class Apply> void restore(Apply apply) {
    // A failed readback retains the restoration obligation. Only restoring
    // the original pulls may repeat; a new pull-up is never replayed.
    if (active_ && apply(false)) active_ = false;
  }
 private:
  uint32_t start_{0};
  bool active_{false}, consumed_{false};
};
}  // namespace esphome::cgdn1_ui
