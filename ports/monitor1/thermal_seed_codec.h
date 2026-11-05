#pragma once

// The engine contains double terms. ArduinoJson 7 may store short decimals
// as float even with USE_DOUBLE=1, so this handoff uses the existing strict
// text format and double parsing instead. No hardware/memory/file access.
#include <iomanip>
#include <locale>
#include <sstream>
#include <string>
#include <vector>

#include "thermal_model.h"

namespace cgs1_thermal {
struct HandoffState {
  std::string boot_id;
  double created_uptime{0};
  std::array<double, 7> currents{};
  bool has_warm{false};
  ThermalPart warm{Model::BASIC, 1, 0};
  std::vector<float> average;
};

inline bool valid_boot_id(const std::string &value) {
  if (value.size() != 36)
    return false;
  for (size_t i = 0; i < value.size(); ++i) {
    if (i == 8 || i == 13 || i == 18 || i == 23) {
      if (value[i] != '-')
        return false;
    } else if (!((value[i] >= '0' && value[i] <= '9') ||
                 (value[i] >= 'a' && value[i] <= 'f')))
      return false;
  }
  return true;
}

inline bool parse_handoff(const std::string &text,
                          const std::string &actual_boot, double current_uptime,
                          HandoffState &result) {
  if (text.empty() || text.size() > 2048 ||
      text.find('\0') != std::string::npos || !valid_boot_id(actual_boot) ||
      !std::isfinite(current_uptime) || current_uptime < 0)
    return false;
  HandoffState candidate;
  std::string magic;
  std::istringstream input(text);
  input.imbue(std::locale::classic());
  if (!(input >> magic >> candidate.boot_id >> candidate.created_uptime) ||
      magic != "CGS1_THERMAL_V1" || candidate.boot_id != actual_boot ||
      !std::isfinite(candidate.created_uptime) ||
      candidate.created_uptime < 0 ||
      candidate.created_uptime > current_uptime ||
      current_uptime - candidate.created_uptime > 30)
    return false;
  for (double &current : candidate.currents)
    if (!(input >> current))
      return false;
  int has_warm, count;
  if (!(input >> has_warm >> candidate.warm.amplitude >>
        candidate.warm.current) ||
      (has_warm != 0 && has_warm != 1) ||
      !std::isfinite(candidate.warm.amplitude) ||
      std::abs(candidate.warm.amplitude) > 20 ||
      !std::isfinite(candidate.warm.current) ||
      std::abs(candidate.warm.current) > 20)
    return false;
  candidate.has_warm = has_warm != 0;
  for (int &value : candidate.warm.time_constants)
    if (!(input >> value) || value < 1 || value > 1000000)
      return false;
  if (!(input >> count) || count < 1 || count > 20)
    return false;
  candidate.average.resize(size_t(count));
  for (float &value : candidate.average)
    if (!(input >> value))
      return false;
  input >> std::ws;
  if (!input.eof())
    return false;
  Model check;
  if (!check.seed(candidate.currents, candidate.average.data(),
                  candidate.average.size(),
                  candidate.has_warm ? &candidate.warm : nullptr))
    return false;
  result = candidate; // Failed parsing never partially changes live state.
  return true;
}

inline std::string format_handoff(const HandoffState &state) {
  if (!valid_boot_id(state.boot_id) || !std::isfinite(state.created_uptime) ||
      state.created_uptime < 0)
    return {};
  std::ostringstream output;
  output.imbue(std::locale::classic());
  output << std::setprecision(17) << "CGS1_THERMAL_V1 " << state.boot_id << ' '
         << state.created_uptime << '\n';
  for (double value : state.currents)
    output << value << ' ';
  output << int(state.has_warm) << ' ' << state.warm.amplitude << ' '
         << state.warm.current << ' ';
  for (int value : state.warm.time_constants)
    output << value << ' ';
  output << state.average.size();
  for (float value : state.average)
    output << ' ' << value;
  output << '\n';
  const std::string text = output.str();
  HandoffState check;
  return parse_handoff(text, state.boot_id, state.created_uptime, check)
             ? text
             : std::string{};
}
} // namespace cgs1_thermal
