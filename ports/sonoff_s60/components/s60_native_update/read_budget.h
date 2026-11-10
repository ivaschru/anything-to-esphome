#pragma once
#include <cstdint>

namespace esphome::s60_native_update {
// ESP-IDF 5.5.5 esp_http_client_read() retains its HTTP/parser/transport state
// when -ESP_ERR_HTTP_EAGAIN is returned without payload. Continue THAT read,
// never reopen the request, reset a hash, rewrite an offset or replay INSTALL.
// Two consecutive waits are permitted inside a 45 s idle / 300 s total budget.
// Only positive payload resets the idle/consecutive budget. Other negatives,
// including FIN/TLS/flash errors, remain terminal. Unsigned subtraction also
// keeps the deadline valid when the 32-bit millisecond clock wraps.
class ReadWaitBudget {
 public:
  static constexpr int IDF_HTTP_EAGAIN = -0x7007;
  explicit ReadWaitBudget(uint32_t now) : started_(now), last_data_(now) {}
  void data(uint32_t now) { last_data_ = now; consecutive_ = 0; }
  bool can_wait(int result, uint32_t now) {
    if (result != IDF_HTTP_EAGAIN || uint32_t(now - started_) >= 300000 ||
        uint32_t(now - last_data_) >= 45000 || consecutive_ >= 2) return false;
    ++consecutive_; return true;
  }
 private:
  uint32_t started_, last_data_;
  uint8_t consecutive_{0};
};
}  // namespace esphome::s60_native_update
