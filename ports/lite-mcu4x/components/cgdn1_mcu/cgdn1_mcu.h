#pragma once

#include "serial_transport.h"
#include "telemetry.h"
#include "poll_probe.h"
#include "pm_ack.h"
#include "esphome/core/component.h"
#include "esphome/components/sensor/sensor.h"
#include "esphome/components/uart/uart.h"
#include "esphome/components/json/json_util.h"

namespace esphome::cgdn1_mcu {

class Cgdn1Mcu : public Component, public uart::UARTDevice {
 public:
  void setup() override;
  void loop() override;
  void dump_config() override;
  void diagnostics(JsonObject root) const;
  float get_setup_priority() const override { return setup_priority::DATA; }
  void set_sensor(size_t index, sensor::Sensor *value) {
    if (index < sensors_.size()) sensors_[index] = value;
  }
  void set_stale_after(uint32_t value) { stale_after_ = value; }
  void set_poll_probe(bool value) { poll_probe_ = value; }
  void set_poll_series(bool value) { poll_series_ = value; }
  void set_poll_long(bool value) { poll_long_ = value; }

 protected:
  // Fixed storage and a bounded per-loop byte budget keep noisy UART input
  // from starving Wi-Fi/API. No raw packet bytes or command text are logged.
  qingping::mcu4x::SerialReceiver receiver_;
  qingping::mcu4x::TelemetryState state_;
  qingping::mcu4x::PollProbe probe_;
  qingping::mcu4x::PollSeries series_;
  qingping::mcu4x::PollLong long_;
  qingping::mcu4x::PmIntervalAck pm_ack_;
  std::array<sensor::Sensor *, qingping::mcu4x::FIELD_COUNT> sensors_{};
  uint32_t stale_after_{30000};
  uint32_t last_byte_{0};
  uint32_t last_summary_{0};
  uint32_t frames_{0};
  uint32_t received_{0};
  uint32_t last_frame_{0};
  uint32_t schema_error_{0};
  uint32_t received_bytes_{0};
  uint32_t unknown_lines_{0};
  bool poll_probe_{false};
  bool poll_series_{false};
  bool poll_long_{false};
  // Four fixed diagnostic TLVs, not an arbitrary-value dump. Keep wire-key
  // names until each code's meaning and stock status translation are proven.
  std::array<int16_t, 4> sensor_status_{{-1, -1, -1, -1}};
  std::string last_layout_;
  uint32_t rejected_{0};
  uint32_t polls_{0};
};
}  // namespace esphome::cgdn1_mcu
