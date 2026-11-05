#pragma once

// Pure parsing/scaling, independently testable without ESPHome or hardware.
// The interface and curve below were inspected in this unit's stock binary;
// they do not establish a health threshold or laboratory TVOC accuracy.
#include <cctype>
#include <cmath>
#include <cstdio>

namespace cgs1_direct_trial {
inline bool parse_voc_measurement(const char *text, float &raw) {
  double value, equivalent_co2;
  int used = 0;
  if (std::sscanf(text, " tvoc %lf co2_eq %lf %n", &value, &equivalent_co2, &used) != 2 ||
      used == 0 || !std::isfinite(value) || value < 0 || value > 1000000 ||
      !std::isfinite(equivalent_co2) || equivalent_co2 < 0 || equivalent_co2 > 1000000)
    return false;
  for (const char *p = text + used; *p; ++p)
    if (!std::isspace(static_cast<unsigned char>(*p))) return false;
  // co2_eq is a metal-oxide estimate, not this unit's physical S8 CO2. Parse it
  // only to validate the record; never substitute it for the actual CO2 sensor.
  raw = float(value);
  return true;
}
inline float voc_stock_estimate_ppm(float raw) {
  float value = raw * 0.8f;
  if (value > 218.0f) value = float(std::sqrt(double(value)/200.0)*200.0);
  value = std::fmax(1.0f, std::fmin(2187.0f, value));
  return value / 1000.0f;
}
}  // namespace cgs1_direct_trial
