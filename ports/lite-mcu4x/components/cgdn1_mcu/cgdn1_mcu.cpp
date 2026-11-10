#include "cgdn1_mcu.h"
#include "esphome/core/hal.h"
#include "esphome/core/log.h"

#include <cmath>
#include <cinttypes>

namespace esphome::cgdn1_mcu {
static const char *const TAG = "cgdn1_mcu";
using namespace qingping::mcu4x;

void Cgdn1Mcu::setup() {
  this->check_uart_settings(115200, 1, uart::UART_CONFIG_PARITY_NONE, 8);
  for (auto *value : sensors_) if (value != nullptr) value->publish_state(NAN);
}

void Cgdn1Mcu::loop() {
  const uint32_t now = millis();
  // Setup can wait for Wi-Fi. Start the one-boot window only when UART is
  // actually serviced; start() is idempotent and cannot replenish its budget.
  if (poll_probe_) probe_.start(now);
  if (poll_series_) series_.start(now);
  if (poll_long_) long_.start(now);
  // Timeout is inter-byte, not total packet time. Keep a damaged suffix out of
  // the next packet; the receiver waits for a delimiter before accepting again.
  if (this->available() == 0 && receiver_.has_partial_line() && now - last_byte_ >= 250)
    receiver_.abandon_partial_line();
  for (size_t budget = 0; budget < 512 && this->available(); ++budget) {
    uint8_t byte;
    if (!this->read_byte(&byte)) break;
    ++received_bytes_;
    last_byte_ = now;
    switch (receiver_.feed(byte)) {
      case SerialEvent::FRAME: {
        const auto &frame = receiver_.frame();
        ++received_;
        pm_ack_.observe(frame, now);
        if (poll_probe_ && probe_.acknowledge_report(now, frame.command))
          this->write_str(REPORT_ACK);
        last_frame_ = now;
        // Record schema only (command, keys and byte counts), never values.
        // This lets one bounded trial identify a changed MCU0425 layout even
        // when the reference0354 decoder rightly refuses its measurements.
        last_layout_ = std::to_string(frame.command) + ":";
        for (size_t i = 0; i < frame.count; ++i) {
          const auto &tlv = frame.tlvs[i];
          last_layout_ += std::to_string(tlv.key) + "/" + std::to_string(tlv.length) + ",";
          if (frame.command == 0x32 && tlv.length == 1) {
            constexpr uint8_t status_keys[] = {3, 4, 9, 12};
            for (size_t j = 0; j < 4; ++j)
              if (tlv.key == status_keys[j]) sensor_status_[j] = frame.bytes[tlv.offset];
          }
        }
        Telemetry sample;
        const auto result = decode_telemetry(frame, sample);
        schema_error_ = static_cast<uint32_t>(result);
        if (result != TelemetryError::NONE) {
          ++rejected_;
          break;
        }
        // A setting-only ACK has no measurements and must not inflate the
        // decoded-report counter or imply that any physical field is fresh.
        bool has_measurements = false;
        for (bool present : sample.present) has_measurements |= present;
        if (!has_measurements) break;
        ++frames_;
        state_.apply(sample, now);
        for (size_t i = 0; i < FIELD_COUNT; ++i)
          if (sample.present[i] && sensors_[i] != nullptr) sensors_[i]->publish_state(sample.values[i]);
        break;
      }
      case SerialEvent::POLL: ++polls_; break;
      case SerialEvent::UNKNOWN: ++unknown_lines_; break;
      case SerialEvent::INVALID:
      case SerialEvent::LINE_TOO_LONG: ++rejected_; break;
      default: break;  // Neither ACKs nor unrelated lines refresh sensor data.
    }
  }
  // The optional probe has only two fixed ASCII messages and a one-boot
  // budget. It cannot write settings/MCU flash or accept a caller's payload.
  if (poll_probe_ && probe_.poll_due(now)) this->write_str(EMPTY_POLL);
  if (poll_series_ && series_.poll_due(now)) this->write_str(EMPTY_POLL);
  if (poll_long_ && long_.poll_due(now)) this->write_str(EMPTY_POLL);
  for (size_t i = 0; i < FIELD_COUNT; ++i)
    if (state_.expire(i, now, stale_after_) && sensors_[i] != nullptr) sensors_[i]->publish_state(NAN);
  if (now - last_summary_ >= 30000) {
    last_summary_ = now;
    ESP_LOGD(TAG, "RX reports=%" PRIu32 " rejected=%" PRIu32 " polls=%" PRIu32,
             frames_, rejected_, polls_);
  }
}

void Cgdn1Mcu::diagnostics(JsonObject root) const {
  root["ok"] = true;
  root["received_frames"] = received_;
  root["received_bytes"] = received_bytes_;
  root["unknown_lines"] = unknown_lines_;
  root["probe_polls"] = probe_.polls();
  root["probe_acks"] = probe_.acks();
  root["series_polls"] = series_.polls();
  root["long_polls"] = long_.polls();
  root["pm_interval_ack_count"] = pm_ack_.count();
  root["pm_interval_ack_status"] = pm_ack_.status();
  root["pm_interval_ack_age_ms"] = pm_ack_.age(millis());
  JsonObject statuses = root["status_codes"].to<JsonObject>();
  constexpr const char *status_names[] = {"tlv_03", "tlv_04", "tlv_09", "tlv_0c"};
  for (size_t j = 0; j < 4; ++j)
    if (sensor_status_[j] >= 0) statuses[status_names[j]] = sensor_status_[j];
  root["decoded_reports"] = frames_;
  root["rejected"] = rejected_;
  root["polls"] = polls_;
  root["schema_error"] = schema_error_;
  root["last_layout"] = last_layout_;
  root["last_frame_age_ms"] = received_ ? static_cast<int64_t>(millis() - last_frame_) : -1;
  static const char *const fields[] = {"temperature", "humidity", "battery", "voltage",
                                    "charge", "co2", "pm25", "pm10"};
  JsonObject raw = root["raw_counts"].to<JsonObject>();
  for (size_t i = 0; i < FIELD_COUNT; ++i)
    if (state_.valid(i)) raw[fields[i]] = state_.value(i);
}

void Cgdn1Mcu::dump_config() {
  ESP_LOGCONFIG(TAG, "External MCU: reference 0354 wire layout");
  ESP_LOGCONFIG(TAG, "  Mode: %s", poll_long_ ? "bounded long poll series without ACK" :
      (poll_series_ ? "bounded poll series without ACK" :
      (poll_probe_ ? "bounded fixed poll probe" : "passive RX")));
  ESP_LOGCONFIG(TAG, "  Raw counts only; no settings, GPIO power or MCU OTA");
  ESP_LOGCONFIG(TAG, "  Field expiry: %" PRIu32 " ms", stale_after_);
}
}  // namespace esphome::cgdn1_mcu
