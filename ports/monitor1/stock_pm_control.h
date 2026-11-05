#pragma once

// Client for the narrow, root-only Qt helper. Hardware and the persistent PM
// setting remain owned by SnowApp. ESPHome never restores an old desired state
// on startup and never automatically retries an ambiguous ON/OFF request.
#include "esphome/core/hal.h"
#include "esphome/core/log.h"
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>
#include <fcntl.h>
#include <cstring>
#include <cerrno>

namespace cgs1 {
class StockPMControl {
 public:
  void request(bool enabled) {
    if (suspended_) {
      ESP_LOGW("cgs1.pm", "PM request rejected during bounded native UI trial");
      return;
    }
    // Keep at most the most recent user request not yet sent. Once sent, it is
    // consumed regardless of network outcome; subsequent GET resolves state.
    pending_ = enabled ? 1 : 0;
  }
  bool available() const { return !suspended_ && have_state_ && esphome::millis() - confirmed_at_ <= 15000; }
  bool enabled() const { return enabled_; }
  // Atomic in the ESPHome event loop: never drop a queued user request or an
  // in-flight SET/GET just to make takeover convenient. A busy helper means
  // launch must wait and then read actual state again; no command is retried.
  bool suspend_for_trial(bool expected) {
    if (suspended_ || pending_ >= 0 || fd_ >= 0 || !available() || enabled_ != expected) return false;
    suspended_ = true;
    return true;
  }
  void resume_after_trial() {
    suspended_ = false;
    have_state_ = false;
    started_ = false;  // Read fresh Qt state, never replay a desired PM value.
  }

  void loop() {
    if (suspended_) return;
    const uint32_t now = esphome::millis();
    if (fd_ < 0) {
      if (pending_ < 0 && started_ && now - attempted_at_ < 5000) return;
      started_ = true;
      attempted_at_ = now;
      const int desired = pending_;
      pending_ = -1;
      fd_ = ::socket(AF_UNIX, SOCK_STREAM | SOCK_NONBLOCK | SOCK_CLOEXEC, 0);
      if (fd_ < 0) return;
      sockaddr_un address{};
      address.sun_family = AF_UNIX;
      std::strncpy(address.sun_path, "/data/.esphome-cgs1/pm-control.sock", sizeof(address.sun_path) - 1);
      if (::connect(fd_, reinterpret_cast<sockaddr *>(&address), sizeof(address)) != 0) {
        finish_(false); return;
      }
      const char *command = desired < 0 ? "GET\n" : desired ? "ON\n" : "OFF\n";
      const size_t length = std::strlen(command);
      if (::send(fd_, command, length, MSG_NOSIGNAL) != length) { finish_(false); return; }
      received_ = 0;
      std::memset(reply_, 0, sizeof(reply_));
      return;
    }
    // The server cancels queued GUI work after 3 s. This is nonblocking, so
    // waiting a little longer here leaves API/OTA and the sensor loop alive.
    if (now - attempted_at_ > 3600) { finish_(false); return; }
    const ssize_t count = ::recv(fd_, reply_ + received_, sizeof(reply_) - received_ - 1, MSG_DONTWAIT);
    if (count < 0 && (errno == EAGAIN || errno == EWOULDBLOCK)) return;
    if (count <= 0) { finish_(false); return; }
    received_ += count;
    if (std::strchr(reply_, '\n') == nullptr) {
      if (received_ >= sizeof(reply_) - 1) finish_(false);
      return;
    }
    const bool on = std::strcmp(reply_, "OK 1\n") == 0;
    const bool off = std::strcmp(reply_, "OK 0\n") == 0;
    if (on || off) {
      enabled_ = on;
      have_state_ = true;
      confirmed_at_ = now;
      finish_(true);
    } else finish_(false);
  }

 private:
  int fd_{-1}, pending_{-1};
  bool started_{false}, have_state_{false}, enabled_{false}, failure_reported_{false}, suspended_{false};
  uint32_t attempted_at_{0}, confirmed_at_{0};
  char reply_[16]{};
  size_t received_{0};
  void finish_(bool success) {
    if (fd_ >= 0) ::close(fd_);
    fd_ = -1;
    if (!success && !failure_reported_)
      ESP_LOGW("cgs1.pm", "Stock PM helper unavailable; no state change confirmed");
    if (success && failure_reported_)
      ESP_LOGI("cgs1.pm", "Stock PM helper communication restored");
    failure_reported_ = !success;
  }
};
inline StockPMControl pm;
}  // namespace cgs1
