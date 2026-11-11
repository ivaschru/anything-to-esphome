#pragma once

#include "protocol.h"

#include <array>
#include <cstddef>
#include <cstdint>
#include <string_view>

namespace qingping::mcu4x {

// The vendor MCU speaks CR-terminated ASCII, including `get_down\r` and
// `hex_string <CG frame>\r`. Accept LF and CRLF as framing too, without
// interpreting an empty CRLF tail as another request. This class never opens
// a UART, writes a GPIO, transmits a response or logs incoming bytes.
enum class SerialEvent { NONE, FRAME, POLL, OK, DOWN_NONE, DOWN, ERROR_REPLY, MCU_VERSION,
                         UNKNOWN, INVALID, LINE_TOO_LONG };

class SerialReceiver {
 public:
  static constexpr size_t PREFIX_SIZE = 11;  // "hex_string "
  static constexpr size_t MAX_LINE = PREFIX_SIZE + MAX_FRAME * 2;

  SerialEvent feed(uint8_t byte) {
    if (byte == '\r' || byte == '\n') {
      if (discarding_) {
        // A damaged/oversized line cannot donate its suffix to a new packet.
        // The next delimiter, rather than a plausible prefix inside the bad
        // line, is the only resynchronization point.
        discarding_ = false;
        length_ = 0;
        return SerialEvent::NONE;
      }
      if (!length_) return SerialEvent::NONE;
      const auto event = finish_line_();
      length_ = 0;
      return event;
    }
    if (discarding_) return SerialEvent::NONE;
    if (byte < 0x20 || byte > 0x7e) {
      discard_line();
      return SerialEvent::INVALID;
    }
    if (length_ == MAX_LINE) {
      discard_line();
      return SerialEvent::LINE_TOO_LONG;
    }
    line_[length_++] = static_cast<char>(byte);
    return SerialEvent::NONE;
  }

  // The frame owns its bytes. Consume it only on FRAME, before feeding the
  // next line. UNKNOWN/INVALID/LINE_TOO_LONG explicitly retire a prior packet;
  // none of these events may extend the freshness of a sensor reading.
  const Frame &frame() const { return frame_; }
  Error frame_error() const { return frame_error_; }
  // Consume only on MCU_VERSION. Leading zeroes are restored by the caller.
  uint16_t mcu_version() const { return mcu_version_; }
  bool has_partial_line() const { return length_ != 0 || discarding_; }

  void abandon_partial_line() {
    // The adapter can call this after a bounded inter-byte timeout. Preserve
    // the discard-until-delimiter rule even across that timeout, otherwise a
    // truncated tail could become an apparently independent valid command.
    if (has_partial_line()) discard_line();
  }

  // A capture adapter can mark a byte with a framing/parity error even when
  // its decoded value looks printable. Its entire line is then untrusted.
  void discard_line() {
    length_ = 0;
    discarding_ = true;
    frame_ = {};
    frame_error_ = Error::NONE;
    mcu_version_ = 0;
  }

 private:
  SerialEvent finish_line_() {
    const std::string_view line(line_.data(), length_);
    frame_ = {};
    frame_error_ = Error::NONE;
    mcu_version_ = 0;
    if (line == "get_down") return SerialEvent::POLL;
    if (line == "ok") return SerialEvent::OK;
    if (line == "down none") return SerialEvent::DOWN_NONE;
    if (line.substr(0, 5) == "down ") return SerialEvent::DOWN;
    if (line == "error") return SerialEvent::ERROR_REPLY;
    constexpr std::string_view version_prefix = "mcu_version ";
    // The stock 4.2.1 handler accepts a four-digit MCU version. Recognize
    // the plain numeric form without retaining the command or other text.
    if (line.size() == version_prefix.size() + 4 && line.substr(0, version_prefix.size()) == version_prefix) {
      uint16_t version = 0;
      for (const char digit : line.substr(version_prefix.size())) {
        if (digit < '0' || digit > '9') return SerialEvent::UNKNOWN;
        version = static_cast<uint16_t>(version * 10 + (digit - '0'));
      }
      mcu_version_ = version;
      return SerialEvent::MCU_VERSION;
    }
    constexpr std::string_view prefix = "hex_string ";
    if (line.substr(0, prefix.size()) != prefix) return SerialEvent::UNKNOWN;
    frame_error_ = decode_hex(line.substr(prefix.size()), frame_);
    return frame_error_ == Error::NONE ? SerialEvent::FRAME : SerialEvent::INVALID;
  }

  std::array<char, MAX_LINE> line_{};
  size_t length_{0};
  bool discarding_{false};
  Frame frame_{};
  Error frame_error_{Error::NONE};
  uint16_t mcu_version_{0};
};

}  // namespace qingping::mcu4x
