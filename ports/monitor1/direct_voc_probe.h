#pragma once

// Short-lived discovery of the exact stock TVOC measurement interface. A read
// performs an ordinary kernel-driver measurement; it is not a baseline read,
// initialization, reset, calibration or direct I²C command. Run only under the
// same exclusive-reader guard as the S8/PM trial. Preserve the already running
// sensor state and its last humidity compensation during this 25-second test.
#include "esphome/core/hal.h"
#include "esphome/core/log.h"
#include "direct_voc_protocol.h"
#include "monotonic_cadence.h"
#include <cerrno>
#include <fcntl.h>
#include <unistd.h>

namespace cgs1_direct_trial {
class VOCProbe {
 public:
  void loop() {
    const uint32_t now = esphome::millis();
    if (!cadence_.due(now)) return;
    const int fd = ::open("/sys/devices/2005e000.i2c/i2c-3/3-0058/iaq_measure",
                          O_RDONLY | O_CLOEXEC | O_NONBLOCK);
    if (fd < 0) {
      ESP_LOGW("cgs1.direct.voc", "Measurement open errno=%d", errno);
      return;
    }
    char value[128];
    const ssize_t count = ::read(fd, value, sizeof(value)-1);
    const int saved_errno = errno;
    ::close(fd);
    if (count <= 0) {
      ESP_LOGW("cgs1.direct.voc", "Measurement read count=%d errno=%d",
               int(count), saved_errno);
      return;
    }
    value[count] = '\0';
    float raw;
    if (parse_voc_measurement(value, raw)) {
      raw_ = raw;
      estimate_ = voc_stock_estimate_ppm(raw);
      seen_ = now;
      valid_ = true;
    }
    // Log only a bounded measurement string. Do not inspect adjacent sysfs
    // action nodes: some reads of init/test/reset files have side effects.
    for (ssize_t i = 0; i < count; ++i)
      if (value[i] < 32 || value[i] > 126) value[i] = ' ';
    if (logged_++ < 5)
      ESP_LOGI("cgs1.direct.voc", "Measurement bytes=%u text=%s", unsigned(count), value);
  }
  float raw() const { return fresh_() ? raw_ : NAN; }
  float estimate() const { return fresh_() ? estimate_ : NAN; }

 private:
  bool fresh_() const { return valid_ && uint32_t(esphome::millis()-seen_) <= 3000; }
  cgs1_time::Cadence<1000> cadence_;
  uint32_t seen_ = 0;
  unsigned logged_ = 0;
  float raw_ = NAN, estimate_ = NAN;
  bool valid_ = false;
};
inline VOCProbe voc;
}  // namespace cgs1_direct_trial
