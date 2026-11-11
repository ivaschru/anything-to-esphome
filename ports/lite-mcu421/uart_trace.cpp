// Offline reader for two Saleae Async Serial analyzer CSV exports from one capture.
// Reuse the firmware parser so capture evidence is subject to the same CG/TLV checks.
#include "../lite-mcu4x/components/cgdn1_mcu/serial_transport.h"
#include "../lite-mcu4x/components/cgdn1_mcu/telemetry.h"

#include <array>
#include <cmath>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <string_view>

namespace {
using namespace qingping::mcu4x;

struct ByteSample {
  double time;
  uint8_t value;
  bool damaged;
};

class Channel {
 public:
  Channel(const char *path, const char *direction, bool mcu)
      : input_(path, std::ios::binary), direction_(direction), mcu_(mcu) {
    if (!input_) throw std::runtime_error("cannot open CSV");
    if (!read_row_() || row_ != "Time [s],Value,Parity Error,Framing Error")
      throw std::runtime_error("expected a per-analyzer Async Serial CSV header");
  }

  bool advance() {
    if (!read_row_()) return false;
    auto tail = row_;
    std::array<std::string_view, 4> cells;
    for (size_t i = 0; i < cells.size() - 1; ++i) {
      const auto comma = tail.find(',');
      if (comma == std::string_view::npos) throw std::runtime_error("expected four CSV columns");
      cells[i] = tail.substr(0, comma);
      tail.remove_prefix(comma + 1);
    }
    cells.back() = tail;

    char *end = nullptr;
    const double time = std::strtod(cells[0].data(), &end);
    if (end == cells[0].data() || end != cells[0].data() + cells[0].size() ||
        !std::isfinite(time) || time < sample.time)
      throw std::runtime_error("invalid or decreasing timestamp");

    const auto value = cells[1];
    if (value.size() != 4 || (value.substr(0, 2) != "0x" && value.substr(0, 2) != "0X") ||
        nibble(value[2]) < 0 || nibble(value[3]) < 0)
      throw std::runtime_error("export each 8-bit analyzer in hexadecimal display mode");
    for (const auto flag : {cells[2], cells[3]}) {
      if (!flag.empty() && flag != "Error") throw std::runtime_error("invalid analyzer error flag");
    }
    sample = {time, static_cast<uint8_t>((nibble(value[2]) << 4) | nibble(value[3])),
              !cells[2].empty() || !cells[3].empty()};
    return true;
  }

  void consume() {
    if (sample.damaged) {
      // The errored byte is not a reliable delimiter, even if it decodes as CR.
      // Discard to the next trustworthy delimiter and keep the other RX stream.
      receiver_.discard_line();
      previous_cr_ = false;
      emit_("uart_error");
      return;
    }
    const auto event = receiver_.feed(sample.value);
    if (previous_cr_ && sample.value == '\n') emit_("lf_after_cr", "LF");
    previous_cr_ = sample.value == '\r';
    if (event == SerialEvent::NONE) return;
    const char *boundary = sample.value == '\r' ? "CR" : sample.value == '\n' ? "LF" : "";
    switch (event) {
      case SerialEvent::FRAME: emit_frame_(boundary); break;
      case SerialEvent::POLL: emit_("get_down", boundary); break;
      case SerialEvent::DOWN_NONE: emit_("down_none", boundary); break;
      case SerialEvent::DOWN: emit_("down", boundary); break;
      case SerialEvent::OK: emit_("ok", boundary); break;
      case SerialEvent::ERROR_REPLY: emit_("error_reply", boundary); break;
      case SerialEvent::MCU_VERSION:
        prefix_("mcu_version", boundary);
        std::cout << "\t\t\t";
        if (mcu_) std::cout << std::setfill('0') << std::setw(4) << receiver_.mcu_version() << std::setfill(' ');
        std::cout << '\n';
        break;
      case SerialEvent::UNKNOWN: emit_("unknown_line", boundary); break;
      case SerialEvent::INVALID: emit_("invalid_line", boundary); break;
      case SerialEvent::LINE_TOO_LONG: emit_("line_too_long"); break;
      case SerialEvent::NONE: break;
    }
  }

  void finish() const {
    if (receiver_.has_partial_line()) emit_("unfinished_line");
  }

  ByteSample sample{-std::numeric_limits<double>::infinity(), 0, false};

 private:
  bool read_row_() {
    // Read only the short numeric export format. A raw UART log or one
    // malformed long row must never allocate unbounded memory.
    input_.getline(buffer_.data(), buffer_.size());
    if (input_.eof() && input_.gcount() == 0 && !input_.bad()) return false;
    if (input_.fail()) throw std::runtime_error("unreadable or oversized CSV row");
    row_ = {buffer_.data(), static_cast<size_t>(input_.gcount() - !input_.eof())};
    if (!row_.empty() && row_.back() == '\r') row_.remove_suffix(1);
    return true;
  }

  void prefix_(const char *event, const char *boundary) const {
    std::cout << sample.time << '\t' << direction_ << '\t' << event << '\t' << boundary << '\t';
  }

  void emit_(const char *event, const char *boundary = "") const {
    prefix_(event, boundary);
    std::cout << "\t\t\t\n";
  }

  void emit_frame_(const char *boundary) const {
    const auto &frame = receiver_.frame();
    Telemetry readings;
    const bool report = mcu_ && frame.command == 0x32;
    const bool valid = report && decode_telemetry(frame, readings) == TelemetryError::NONE;
    prefix_(report && !valid ? "report_layout_mismatch" : "frame", boundary);
    std::cout << "0x" << std::hex << +frame.command << '\t';
    for (size_t i = 0; i < frame.count; ++i) {
      if (i) std::cout << ',';
      std::cout << "0x" << std::hex << +frame.tlvs[i].key << ':' << std::dec << frame.tlvs[i].length;
    }
    std::cout << std::dec << '\t';
    // Export numeric sensor fields only from valid MCU reports. A downlink or
    // unknown TLV can carry household configuration. Its value stays private.
    constexpr std::array<const char *, FIELD_COUNT> names{
        "T", "RH", "battery", "voltage", "charge", "CO2", "PM25", "PM10"};
    if (valid) {
      const char *separator = "";
      for (size_t i = 0; i < FIELD_COUNT; ++i) {
        if (!readings.present[i]) continue;
        std::cout << separator << names[i] << '=' << readings.values[i];
        separator = ",";
      }
    }
    std::cout << "\t\n";
  }

  std::ifstream input_;
  const char *direction_;
  bool mcu_;
  SerialReceiver receiver_;
  std::array<char, 128> buffer_{};
  std::string_view row_;
  bool previous_cr_{false};
};
}  // namespace

int main(int argc, char **argv) {
  if (argc != 3) {
    std::cerr << "Usage: lite421-uart-trace esp-to-mcu.csv mcu-to-esp.csv\n";
    return 2;
  }
  try {
    if (!std::filesystem::is_regular_file(argv[1]) || !std::filesystem::is_regular_file(argv[2]) ||
        std::filesystem::equivalent(argv[1], argv[2]))
      throw std::runtime_error("pass two distinct regular CSV files from the same capture");
    Channel esp(argv[1], "esp_to_mcu", false);
    Channel mcu(argv[2], "mcu_to_esp", true);
    bool has_esp = esp.advance(), has_mcu = mcu.advance();
    std::cout << std::fixed << std::setprecision(12)
              << "time_s\tdirection\tevent\tboundary\tcommand\ttlv_key:length\traw_measurements\tmcu_version\n";
    // Merge by timestamp with one lookahead per wire. The channel's parser
    // state stays independent even when the two byte streams overlap.
    while (has_esp || has_mcu) {
      if (has_esp && (!has_mcu || esp.sample.time <= mcu.sample.time)) {
        esp.consume();
        has_esp = esp.advance();
        if (!has_esp) esp.finish();
      } else {
        mcu.consume();
        has_mcu = mcu.advance();
        if (!has_mcu) mcu.finish();
      }
    }
    std::cout.flush();
    if (!std::cout) throw std::runtime_error("cannot write TSV output");
  } catch (const std::filesystem::filesystem_error &) {
    std::cerr << "Cannot inspect the two input files\n";
    return 1;
  } catch (const std::runtime_error &error) {
    std::cerr << "UART trace: " << error.what() << '\n';
    return 1;
  }
}
