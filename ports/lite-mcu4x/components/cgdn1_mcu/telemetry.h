#pragma once

#include "protocol.h"

#include <array>
#include <cstddef>
#include <cstdint>

namespace qingping::mcu4x {

// This is the *wire* layout of the manufacturer MCU 0354 reference, not the
// widths of variables in the ESP32's RAM. Its 0x080106b4/0x080106dc/0x080106e8
// emitters put TWO bytes in CO2/PM TLVs, even though stock ESP32 copies those
// bytes into four-byte variables. A different length is a schema mismatch;
// never pad/truncate it into an apparently supported measurement.
enum class Field : size_t { TEMPERATURE_RAW, HUMIDITY_RAW, BATTERY_RAW, VOLTAGE_RAW,
                            CHARGE_RAW, CO2_RAW, PM25_RAW, PM10_RAW, COUNT };
constexpr size_t FIELD_COUNT = static_cast<size_t>(Field::COUNT);

struct Telemetry {
  std::array<int32_t, FIELD_COUNT> values{};
  std::array<bool, FIELD_COUNT> present{};
};

// Stock 4.2.1 passes these two divided wire values into its compensation
// code. They are diagnostic inputs: no stock calibration, status-bit
// semantics or unobserved sentinel is inferred from the physical units.
struct Stock421Inputs {
  float temperature{0};
  float humidity{0};
  bool valid{false};
};

inline Stock421Inputs stock421_inputs(const Telemetry &sample) {
  constexpr size_t temperature = static_cast<size_t>(Field::TEMPERATURE_RAW);
  constexpr size_t humidity = static_cast<size_t>(Field::HUMIDITY_RAW);
  if (!sample.present[temperature] || !sample.present[humidity] ||
      sample.values[humidity] < 0 || sample.values[humidity] > 10000) return {};
  return {sample.values[temperature] / 100.0f, sample.values[humidity] / 100.0f, true};
}

enum class TelemetryError { NONE, COMMAND, LAYOUT, DUPLICATE, BOUNDS };

inline TelemetryError decode_telemetry(const Frame &frame, Telemetry &out) {
  out = {};
  // 0x31 is ESP -> MCU; the reference MCU builds its reports with 0x32 at
  // 0x08010890. Accepting the opposite direction would turn requests into data.
  if (frame.command != 0x32) return TelemetryError::COMMAND;
  if (frame.length < 7 || frame.length > MAX_FRAME || frame.count > MAX_TLVS)
    return TelemetryError::BOUNDS;
  Telemetry candidate;
  for (size_t i = 0; i < frame.count; ++i) {
    const auto &tlv = frame.tlvs[i];
    if (tlv.offset < 5 || tlv.offset > frame.length - 2 ||
        tlv.length > frame.length - 2 - tlv.offset) return TelemetryError::BOUNDS;
    Field field;
    size_t length;
    switch (tlv.key) {
      case 0x02: field = Field::TEMPERATURE_RAW; length = 4; break;
      case 0x05: field = Field::BATTERY_RAW; length = 1; break;
      case 0x06: field = Field::VOLTAGE_RAW; length = 2; break;
      case 0x07: field = Field::CHARGE_RAW; length = 1; break;
      case 0x08: field = Field::CO2_RAW; length = 2; break;
      case 0x0a: field = Field::PM25_RAW; length = 2; break;
      case 0x0b: field = Field::PM10_RAW; length = 2; break;
      default: continue;  // Settings ACKs and unknown keys are not samples.
    }
    const size_t index = static_cast<size_t>(field);
    if (candidate.present[index]) return TelemetryError::DUPLICATE;
    if (tlv.length != length) return TelemetryError::LAYOUT;
    const auto *value = frame.bytes.data() + tlv.offset;
    candidate.present[index] = true;
    if (field == Field::TEMPERATURE_RAW) {
      // Avoid implementation-defined unsigned-to-int16 conversion for negative
      // values. No physical scale or stock heat compensation is implied here.
      const uint16_t bits = little16(value);
      candidate.values[index] = bits & 0x8000 ? static_cast<int32_t>(bits) - 65536 : bits;
      const size_t humidity = static_cast<size_t>(Field::HUMIDITY_RAW);
      candidate.present[humidity] = true;
      candidate.values[humidity] = little16(value + 2);
    } else {
      candidate.values[index] = length == 1 ? value[0] : little16(value);
    }
  }
  out = candidate;  // A late invalid/duplicate TLV cannot leak earlier fields.
  return TelemetryError::NONE;
}

// Reception time belongs to each field. A voltage-only frame, ACK or get_down
// must never renew CO2 or T/RH. Expire once, including across millis() wrap.
class TelemetryState {
 public:
  void apply(const Telemetry &sample, uint32_t now) {
    for (size_t i = 0; i < FIELD_COUNT; ++i) {
      if (!sample.present[i]) continue;
      values_[i] = sample.values[i];
      updated_[i] = now;
      valid_[i] = true;
    }
  }
  bool expire(size_t index, uint32_t now, uint32_t max_age) {
    if (index >= FIELD_COUNT || !valid_[index] || now - updated_[index] < max_age) return false;
    valid_[index] = false;
    return true;
  }
  bool valid(size_t index) const { return index < FIELD_COUNT && valid_[index]; }
  int32_t value(size_t index) const { return index < FIELD_COUNT ? values_[index] : 0; }

 private:
  std::array<int32_t, FIELD_COUNT> values_{};
  std::array<uint32_t, FIELD_COUNT> updated_{};
  std::array<bool, FIELD_COUNT> valid_{};
};
}  // namespace qingping::mcu4x
