#pragma once
#include <cstdint>

namespace qingping::mcu4x {

// Deliberately NOT a settings encoder. MCU0354's validated CG parser accepts
// a zero-length payload and its NET Task then executes zero setter branches.
// This fixed packet asks that loop to run without sending any TLV value.
// Applicability to MCU0425 still requires a separate, explicit hardware trial.
inline constexpr char EMPTY_POLL[] = "hex_string 4347310000bb00\r";
inline constexpr char REPORT_ACK[] = "ok\r";

class PollProbe {
 public:
  static constexpr uint32_t WINDOW_MS = 30000;
  static constexpr uint8_t MAX_POLLS = 3;
  static constexpr uint8_t MAX_ACKS = 8;

  void start(uint32_t now) {
    // A component setup or accidental repeated call cannot replenish the
    // budget. No API or incoming command can restart this one-boot probe.
    if (started_) return;
    started_ = true;
    start_ = now;
  }
  bool poll_due(uint32_t now) {
    if (!active_(now) || received_ || polls_ == MAX_POLLS) return false;
    // Measure from the actual send. A delayed loop must not catch up with a
    // burst of overdue polls when Wi-Fi or another setup stage took time.
    if (now - (polls_ ? last_poll_ : start_) < 5000) return false;
    last_poll_ = now;
    ++polls_;
    return true;
  }
  bool acknowledge_report(uint32_t now, uint8_t command) {
    // Caller must first validate the whole CG frame/checksum. Never ACK the
    // downlink command: a local UART echo must not become an endless TX loop.
    if (!active_(now) || command != 0x32) return false;
    received_ = true;
    if (acks_ == MAX_ACKS) return false;
    ++acks_;
    return true;
  }
  uint8_t polls() const { return polls_; }
  uint8_t acks() const { return acks_; }

 private:
  bool active_(uint32_t now) const { return started_ && now - start_ < WINDOW_MS; }
  uint32_t start_{0};
  uint32_t last_poll_{0};
  uint8_t polls_{0};
  uint8_t acks_{0};
  bool started_{false};
  bool received_{false};
};

// Separate experiment: query six fresh snapshots, without ACKs, even after
// receiving a report. This isolates polling from the first probe's ACK loop.
// It is deliberately finite and cannot be used as a production settings API.
template<uint32_t WINDOW, uint8_t LIMIT> class FixedPollSeries {
 public:
  static constexpr uint32_t WINDOW_MS = WINDOW;
  static constexpr uint8_t MAX_POLLS = LIMIT;
  void start(uint32_t now) {
    if (started_) return;
    started_ = true;
    start_ = now;
  }
  bool poll_due(uint32_t now) {
    if (!started_ || now - start_ >= WINDOW_MS || polls_ == MAX_POLLS) return false;
    if (now - (polls_ ? last_poll_ : start_) < (polls_ ? 15000U : 5000U)) return false;
    last_poll_ = now;
    ++polls_;
    return true;
  }
  uint8_t polls() const { return polls_; }
 private:
  uint32_t start_{0};
  uint32_t last_poll_{0};
  uint8_t polls_{0};
  bool started_{false};
};
using PollSeries = FixedPollSeries<90000, 6>;
// Same observed wire message/cadence, extended only for the USB/battery test.
// It still stops before the independent trial's five-minute stock return.
using PollLong = FixedPollSeries<240000, 16>;
}  // namespace qingping::mcu4x
