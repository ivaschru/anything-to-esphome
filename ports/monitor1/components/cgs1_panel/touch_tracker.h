#pragma once
#include <algorithm>

namespace esphome::cgs1_panel {
// Linux input UAPI numbers, kept here so event semantics can be tested on the
// build Mac without including Linux-only kernel headers or opening a device.
struct TouchTracker {
  enum class Phase { NONE, DOWN, MOVE, UP };
  struct Event {
    Phase phase{Phase::NONE};
    int x{0}, y{0};
  };
  static constexpr int SYN = 0, KEY = 1, ABS = 3, REPORT = 0, DROPPED = 3;
  static constexpr int SLOT = 0x2f, X = 0x35, Y = 0x36, TRACKING = 0x39, TOUCH = 0x14a;
  bool feed(int type, int code, int value, int& x, int& y) {
    const auto event = feed_event(type, code, value);
    if (event.phase == Phase::DOWN) {
      x = event.x;
      y = event.y;
      return true;
    }
    return false;
  }
  Event feed_event(int type, int code, int value) {
    if (type == SYN && code == DROPPED) {
      down_ = reported_ = false;
      have_x_ = have_y_ = false;
      return {};
    }
    if (type == ABS && code == SLOT) {
      slot_ = value;
      return {};
    }
    if (type == ABS && code == TRACKING) {
      tracking_protocol_ = true;
      if (slot_ == 0) down_ = value >= 0;
    }
    if (type == ABS && slot_ == 0) {
      if (code == X) {
        x_ = value;
        have_x_ = true;
      }
      if (code == Y) {
        y_ = value;
        have_y_ = true;
      }
    }
    // BTN_TOUCH is global for all fingers. Once a Type-B tracking ID was
    // observed, it must not resurrect slot0 when only another finger is down.
    if (type == KEY && code == TOUCH && !tracking_protocol_) down_ = value != 0;
    if (type != SYN || code != REPORT) return {};
    const bool valid = have_x_ && have_y_ && x_ >= 0 && x_ <= 720 && y_ >= 0 && y_ <= 720;
    Event result;
    if (valid && down_ && !reported_)
      result = {Phase::DOWN, std::min(x_, 719), std::min(y_, 719)};
    else if (valid && down_ && reported_ && (x_ != last_x_ || y_ != last_y_))
      result = {Phase::MOVE, std::min(x_, 719), std::min(y_, 719)};
    else if (!down_ && reported_)
      result = {Phase::UP, std::min(last_x_, 719), std::min(last_y_, 719)};
    // Coordinates survive a normal lift because Type-B devices can report
    // only a changed axis on the next contact. Loss of synchronization above
    // invalidates both axes instead. No global BTN_TOUCH can invent slot0.
    reported_ = down_;
    if (valid) {
      last_x_ = x_;
      last_y_ = y_;
    }
    return result;
  }

 private:
  int slot_{0}, x_{0}, y_{0}, last_x_{0}, last_y_{0};
  bool have_x_{false}, have_y_{false}, down_{false}, reported_{false}, tracking_protocol_{false};
};
}  // namespace esphome::cgs1_panel
