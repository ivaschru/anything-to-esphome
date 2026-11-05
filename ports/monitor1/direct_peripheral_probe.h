#pragma once

// Discovery-only additions to the guarded direct CO2 trial. UART bytes and one
// known temperature/humidity sysfs node are read only while SnowApp is stopped.
// No PM command, GPIO write, driver unbind, VOC reset or calibration occurs.
#include <fcntl.h>
#include <unistd.h>

#include <cerrno>
#include <cmath>
#include <cstdio>

#include "direct_pm_protocol.h"
#include "monotonic_cadence.h"
#include "esphome/components/uart/uart_component.h"
#include "esphome/core/hal.h"
#include "esphome/core/log.h"

namespace cgs1_direct_trial {
class PeripheralProbe {
 public:
  // The native UI trial has one separate, validated thermal reader. Disable
  // this discovery-only SHT read there, avoiding two independent cadences on
  // the same kernel measurement node. Existing direct trials keep it enabled.
  void set_read_trh(bool enabled) { read_trh_ = enabled; }
  // Buffered UART frames after handoff must not make a disabled PM look live.
  // This flag reports state; it never toggles GPIO or power.
  void set_pm_enabled(bool enabled) { pm_enabled_ = enabled; }
  // A power transition invalidates the decoder AND the UART backlog. A good
  // frame from before OFF must never become a new ON reading. Drain is bounded
  // so a faulty/busy UART cannot hang the independent hard-return guardian.
  bool restart_pm_reader(esphome::uart::UARTComponent *pm) {
    unsigned drained = 0;
    uint8_t byte;
    while (pm->available() && drained < 8192) {
      if (!pm->read_byte(&byte)) return false;
      ++drained;
    }
    if (pm->available()) return false;
    decoder_ = PMDecoder{};
    used_ = 0; valid_frames_ = 0; pm_seen_ = 0;
    pm25_ = pm25_raw_ = NAN;
    return true;
  }
  bool fresh_pm_frame() const {
    return pm_enabled_ && valid_frames_ && uint32_t(esphome::millis() - pm_seen_) <= 5000;
  }
  void loop(esphome::uart::UARTComponent* pm) {
    const uint32_t now = esphome::millis();
    {
      while (pm->available()) {
        uint8_t value;
        if (!pm->read_byte(&value)) break;
        PMFrame frame;
        if (decoder_.feed(value, frame)) {
          // The verified unit has no pm25_calibrate record and its stock
          // constructor defaults PM25K to 1.0. No calibration is written here.
          pm25_raw_ = pm25_mass(frame.pm25_raw);
          pm25_ = pm25_corrected(frame.pm25_raw);
          pm_seen_ = now;
          ++valid_frames_;
        }
        if (frames_ < 6) {
          if (used_ < sizeof(bytes_))
            bytes_[used_++] = value;
          else
            overflow_ = true;
        }
        last_byte_ = now;
      }
      // At 9600 baud a character takes about 1 ms. A 30 ms idle gap separates
      // bursts without assuming an unverified packet length or checksum.
      if (used_ && uint32_t(now - last_byte_) >= 30) {
        char hex[sizeof(bytes_) * 2 + 1];
        for (size_t i = 0; i < used_; ++i) std::snprintf(hex + 2 * i, 3, "%02X", bytes_[i]);
        ESP_LOGI("cgs1.direct.pm", "UART burst bytes=%u overflow=%d hex=%s", unsigned(used_), overflow_, hex);
        used_ = 0;
        overflow_ = false;
        ++frames_;
      }
    }
    if (read_trh_ && trh_cadence_.due(now)) {
      ++trh_reads_;
      const char* path = "/sys/devices/2005e000.i2c/i2c-3/3-0044/temper_humidy";
      int fd = ::open(path, O_RDONLY | O_CLOEXEC | O_NONBLOCK);
      if (fd < 0) {
        ESP_LOGW("cgs1.direct.trh", "Measurement open errno=%d", errno);
        return;
      }
      char value[128];
      ssize_t count = ::read(fd, value, sizeof(value) - 1);
      const int saved_errno = errno;
      ::close(fd);
      if (count < 0) {
        ESP_LOGW("cgs1.direct.trh", "Measurement read errno=%d", saved_errno);
        return;
      }
      value[count] = '\0';
      // This exact node is measurement data. Escape line breaks/control bytes
      // so one read remains one bounded diagnostic record, never a log command.
      for (ssize_t i = 0; i < count; ++i)
        if (value[i] < 32 || value[i] > 126) value[i] = ' ';
      ESP_LOGI("cgs1.direct.trh", "Measurement bytes=%u text=%s", unsigned(count), value);
      double temperature_milli, humidity_milli;
      if (std::sscanf(value, "%lf,%lf", &temperature_milli, &humidity_milli) == 2 &&
          temperature_milli >= -40000 && temperature_milli <= 125000 && humidity_milli >= 0 &&
          humidity_milli <= 100000) {
        // The kernel node already reports milli-units. The verified stock
        // TRHAPI divides both fields by 1000; these are NOT raw SHT ticks.
        // Stock ambient/self-heating compensation belongs to a later layer.
        temperature_ = float(temperature_milli / 1000.0);
        humidity_ = float(humidity_milli / 1000.0);
        trh_seen_ = now;
        trh_valid_ = true;
      }
    }
  }
  float pm25() const {
    return pm_enabled_ && valid_frames_ && uint32_t(esphome::millis() - pm_seen_) <= 5000 ? pm25_ : NAN;
  }
  float raw_pm25() const {
    return pm_enabled_ && valid_frames_ && uint32_t(esphome::millis() - pm_seen_) <= 5000 ? pm25_raw_ : NAN;
  }
  float temperature() const {
    return trh_valid_ && uint32_t(esphome::millis() - trh_seen_) <= 5000 ? temperature_ : NAN;
  }
  float humidity() const {
    return trh_valid_ && uint32_t(esphome::millis() - trh_seen_) <= 5000 ? humidity_ : NAN;
  }

 private:
  uint8_t bytes_[256]{};
  size_t used_ = 0;
  uint32_t last_byte_ = 0;
  cgs1_time::Cadence<3000> trh_cadence_;
  unsigned frames_ = 0;
  unsigned trh_reads_ = 0;
  bool overflow_ = false;
  PMDecoder decoder_;
  unsigned valid_frames_ = 0;
  uint32_t pm_seen_ = 0, trh_seen_ = 0;
  float pm25_ = NAN, pm25_raw_ = NAN, temperature_ = NAN, humidity_ = NAN;
  bool trh_valid_ = false, read_trh_ = true, pm_enabled_ = true;
};
inline PeripheralProbe peripheral;
}  // namespace cgs1_direct_trial
