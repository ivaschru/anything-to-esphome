#include "../ports/lite-mcu4x/components/cgdn1_mcu/telemetry.h"

#include <cassert>
#include <iostream>
#include <vector>

using namespace qingping::mcu4x;

Frame frame(std::vector<uint8_t> payload, uint8_t command = 0x32) {
  // Test-only independent envelope; the production receiver has no encoder.
  std::vector<uint8_t> bytes{0x43, 0x47, command, static_cast<uint8_t>(payload.size()),
                           static_cast<uint8_t>(payload.size() >> 8)};
  bytes.insert(bytes.end(), payload.begin(), payload.end());
  uint32_t sum = 0;
  for (auto byte : bytes) sum += byte;
  bytes.push_back(sum & 255);
  bytes.push_back((sum >> 8) & 255);
  Frame result;
  assert(decode(bytes.data(), bytes.size(), result) == Error::NONE);
  return result;
}

int main() {
  Telemetry sample;
  auto full = frame({2,4,0, 0x06,0xff, 0x88,0x13,  // T=-250, RH=5000 raw
                    5,1,0, 95, 6,2,0, 0x04,0x10, 7,1,0, 1,
                    8,2,0, 0x20,3, 10,2,0, 12,0, 11,2,0, 17,0});
  assert(decode_telemetry(full, sample) == TelemetryError::NONE);
  assert(sample.values[0] == -250 && sample.values[1] == 5000);
  assert(sample.values[2] == 95 && sample.values[3] == 4100);
  assert(sample.values[4] == 1 && sample.values[5] == 800);
  assert(sample.values[6] == 12 && sample.values[7] == 17);
  for (bool present : sample.present) assert(present);

  // Four-byte ESP32 storage does not establish a four-byte wire type. Wrong
  // lengths, duplicates and the downlink command must retire the whole sample.
  for (auto [candidate, error] : std::vector<std::pair<Frame, TelemetryError>>{
         {frame({8,4,0,0x20,3,0,0}), TelemetryError::LAYOUT},
         {frame({8,2,0,1,0,8,2,0,2,0}), TelemetryError::DUPLICATE},
         {frame({2,4,0,0,0,0,0,2,4,0,0,0,0,0}), TelemetryError::DUPLICATE},
         {frame({8,2,0,0x20,3}, 0x31), TelemetryError::COMMAND},
         {frame({8,2,0,0x20,3,6,1,0,1}), TelemetryError::LAYOUT}}) {
    sample.present.fill(true);
    assert(decode_telemetry(candidate, sample) == error);
    for (bool present : sample.present) assert(!present);
  }
  // Unknown TLVs and settings ACKs may coexist with data but cannot create any.
  assert(decode_telemetry(frame({0x25,1,0,1,0xfe,0,0}), sample) == TelemetryError::NONE);
  for (bool present : sample.present) assert(!present);
  auto invalid = full;
  invalid.tlvs[0].offset = MAX_FRAME;
  assert(decode_telemetry(invalid, sample) == TelemetryError::BOUNDS);
  invalid = full; invalid.count = MAX_TLVS + 1;
  assert(decode_telemetry(invalid, sample) == TelemetryError::BOUNDS);

  TelemetryState state;
  assert(decode_telemetry(frame({8,2,0,0x20,3}), sample) == TelemetryError::NONE);
  state.apply(sample, 0xffffff00U);
  assert(state.valid(5) && state.value(5) == 800);
  assert(!state.expire(5, 0x100U, 1000));
  // Updating voltage near expiry cannot keep the earlier CO2 reading alive.
  assert(decode_telemetry(frame({6,2,0,0x04,0x10}), sample) == TelemetryError::NONE);
  state.apply(sample, 0x200U);
  assert(state.expire(5, 0x2e8U, 1000));
  assert(!state.expire(5, 0x400U, 1000));
  assert(state.valid(3) && !state.expire(3, 0x2e8U, 1000));
  assert(!state.valid(FIELD_COUNT));
  std::cout << "MCU wire widths, direction, duplicate rejection and per-field expiry passed\n";
}
