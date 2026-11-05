#pragma once

#include <array>
#include <cerrno>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <string>

namespace cgs1_ha {
// HA values are display inputs only. This class deliberately has no reference
// to a physical Sensor or UART and cannot publish imported data as a local
// measurement. The clock is supplied by the caller, making expiry testable.
class SourceCache {
 public:
  static constexpr size_t COUNT = 5;
  static constexpr uint32_t TTL_MS = 180000;
  enum Status { UNCONFIGURED, WAITING, INVALID_STATE, UNIT_MISMATCH, OUT_OF_RANGE, STALE, READY };

  bool configure(size_t index, const std::string& entity) {
    if (index >= COUNT || !valid_entity(entity)) return false;
    if (sources_[index].entity == entity) return true;
    sources_[index] = Entry{};
    sources_[index].entity = entity;
    return true;
  }
  const std::string& entity(size_t index) const { return sources_[index].entity; }
  bool configured(size_t index) const { return index < COUNT && !sources_[index].entity.empty(); }
  void state(size_t index, const std::string& text, uint32_t now) {
    if (!configured(index)) return;
    auto& s = sources_[index];
    s.state_at = now;
    s.state_seen = true;
    s.raw = parse_decimal(text);
  }
  void unit(size_t index, const std::string& text, uint32_t now) {
    if (!configured(index)) return;
    auto& s = sources_[index];
    s.unit_at = now;
    s.unit_seen = true;
    // Bound memory even if an authenticated client sends an unexpected value.
    s.unit = text.size() <= 24 ? text : std::string{};
  }
  Status status(size_t index, uint32_t now) const {
    if (!configured(index)) return UNCONFIGURED;
    const auto& s = sources_[index];
    if (!s.state_seen || !s.unit_seen) return WAITING;
    if (uint32_t(now - s.state_at) >= TTL_MS || uint32_t(now - s.unit_at) >= TTL_MS) return STALE;
    if (!std::isfinite(s.raw)) return INVALID_STATE;
    const float result = convert(index, s.raw, s.unit);
    if (!std::isfinite(result)) return UNIT_MISMATCH;
    static constexpr float MIN[] = {0, -100, 0, 0, 0};
    static constexpr float MAX[] = {100000, 100, 100, 100000, 1000};
    return result < MIN[index] || result > MAX[index] ? OUT_OF_RANGE : READY;
  }
  float value(size_t index, uint32_t now) const {
    return status(index, now) == READY ? convert(index, sources_[index].raw, sources_[index].unit) : NAN;
  }
  static const char* description(Status status) {
    switch (status) {
      case UNCONFIGURED:
        return "Местный сенсор";
      case WAITING:
        return "Ждём значение и единицу HA";
      case INVALID_STATE:
        return "HA: нет числового значения";
      case UNIT_MISMATCH:
        return "HA: несовместимая единица";
      case OUT_OF_RANGE:
        return "HA: значение вне диапазона";
      case STALE:
        return "HA: ответ устарел";
      case READY:
        return "Сводный HA";
    }
    return "Местный сенсор";
  }
  static bool valid_entity(const std::string& s) {
    if (s.empty()) return true;  // Clearing a binding intentionally selects local.
    if (s.size() > 255 || s.size() <= 7 || s.compare(0, 7, "sensor.")) return false;
    for (size_t i = 7; i < s.size(); ++i)
      if (!((s[i] >= 'a' && s[i] <= 'z') || (s[i] >= '0' && s[i] <= '9') || s[i] == '_')) return false;
    return true;
  }
  static float parse_decimal(const std::string& text) {
    if (text.empty() || text.size() > 48) return NAN;
    // Reject hex, locale commas, whitespace, embedded NULs and partial parses.
    // Scientific notation remains valid for normal HA numeric sensors.
    for (char c : text)
      if (!((c >= '0' && c <= '9') || c == '-' || c == '+' || c == '.' || c == 'e' || c == 'E')) return NAN;
    char* end = nullptr;
    errno = 0;
    const float v = std::strtof(text.c_str(), &end);
    return errno == ERANGE || end != text.c_str() + text.size() || !std::isfinite(v) ? NAN : v;
  }
  static float convert(size_t index, float value, const std::string& original_unit) {
    std::string unit;
    for (char c : original_unit) {
      if (c == ' ') continue;
      unit += c >= 'A' && c <= 'Z' ? char(c - 'A' + 'a') : c;
    }
    if (index == 0 || index == 4) {
      if (unit == "ppm") return value;
      if (unit == "ppb") return value / 1000;
      // A VOC mixture has no unique molecular mass: converting µg/m³ to ppm
      // would invent a gas composition. Keep the physical local fallback.
      return NAN;
    }
    if (index == 1) {
      if (unit == "°c" || unit == "c" || unit == "℃") return value;
      if (unit == "°f" || unit == "f" || unit == "℉") return (value - 32) * (5.0f / 9);
      if (unit == "k") return value - 273.15f;
      return NAN;
    }
    if (index == 2) return unit == "%" ? value : NAN;
    if (index == 3) {
      if (unit == "µg/m³" || unit == "μg/m³" || unit == "ug/m3" || unit == "µg/m3" || unit == "мкг/м³")
        return value;
      if (unit == "mg/m³" || unit == "mg/m3" || unit == "мг/м³") return value * 1000;
    }
    return NAN;
  }

 private:
  struct Entry {
    std::string entity, unit;
    float raw{NAN};
    uint32_t state_at{0}, unit_at{0};
    bool state_seen{false}, unit_seen{false};
  };
  std::array<Entry, COUNT> sources_{};
};
}  // namespace cgs1_ha
