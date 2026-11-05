#pragma once

// Ordinary cold/warm startup record, distinct from a same-boot trial seed.
// This is our own versioned file, NEVER stock QSettings/temperature calibration.
// Stock saveTempFix writes a UNIX timestamp periodically and at shutdown;
// initWarmStart accepts abs(now-timestamp)<=1799, restores seven terms and
// warm residual, empties the average, then replays elapsed seconds. The model
// owns that exact policy. A file checksum detects corruption, not authenticity.
#include "thermal_model.h"
#include <iomanip>
#include <locale>
#include <sstream>
#include <string>

namespace cgs1_thermal {
struct PersistentState {
  int64_t saved_unix{0};
  std::array<double,7> currents{};
  bool has_warm{false};
  ThermalPart warm{Model::WARM,1,0};
};
inline constexpr const char *STATE_PROFILE = "CGS1_4.1.8_0287_THERMAL_V1";
inline uint32_t state_crc32(const std::string &bytes) {
  uint32_t crc = 0xffffffffU;
  for (unsigned char byte : bytes) {
    crc ^= byte;
    for (unsigned bit=0; bit<8; ++bit) crc = (crc >> 1) ^ (0xedb88320U & (0U - (crc & 1)));
  }
  return ~crc;
}
inline bool valid_state(const PersistentState &state) {
  if (state.saved_unix <= 0 || state.saved_unix > 4102444800LL ||
      state.warm.time_constants != Model::WARM || state.warm.maximum_input!=1 ||
      !std::isfinite(state.warm.amplitude) || std::abs(state.warm.amplitude)>20 ||
      !std::isfinite(state.warm.current) || std::abs(state.warm.current)>20) return false;
  Model check;
  return check.seed(state.currents,nullptr,0,state.has_warm ? &state.warm : nullptr);
}
inline PersistentState capture_state(const Model &model,int64_t now) {
  PersistentState state;
  state.saved_unix=now;state.currents=model.currents();
  if (const auto *warm=model.warm_residual()) {state.has_warm=true;state.warm=*warm;}
  return state;
}
inline std::string format_state(const PersistentState &state) {
  if (!valid_state(state)) return {};
  std::ostringstream payload;
  payload.imbue(std::locale::classic());
  payload << std::setprecision(17) << STATE_PROFILE << ' ' << state.saved_unix;
  for (double current : state.currents) payload << ' ' << current;
  payload << ' ' << int(state.has_warm) << ' ' << state.warm.amplitude << ' ' << state.warm.current << '\n';
  const auto text=payload.str();
  std::ostringstream checksum;
  checksum.imbue(std::locale::classic());
  checksum << std::hex << std::setw(8) << std::setfill('0') << state_crc32(text) << '\n';
  return text+checksum.str();
}
inline bool parse_state(const std::string &text,PersistentState &result) {
  if (text.empty() || text.size()>1024 || text.find('\0')!=std::string::npos) return false;
  const size_t newline=text.find('\n');
  if (newline==std::string::npos || text.size()!=newline+10 || text.back()!='\n') return false;
  uint32_t crc=0;
  for(size_t i=newline+1;i<newline+9;++i) {
    const unsigned char c=text[i];
    if (!((c>='0' && c<='9') || (c>='a' && c<='f'))) return false;
    crc=(crc<<4) | uint32_t(c<='9' ? c-'0' : c-'a'+10);
  }
  if (crc!=state_crc32(text.substr(0,newline+1))) return false;
  std::istringstream input(text.substr(0,newline));
  input.imbue(std::locale::classic());
  PersistentState candidate;std::string profile;int has_warm;
  if (!(input>>profile>>candidate.saved_unix) || profile!=STATE_PROFILE) return false;
  for(double &value:candidate.currents) if (!(input>>value)) return false;
  if (!(input>>has_warm>>candidate.warm.amplitude>>candidate.warm.current) ||
      (has_warm!=0 && has_warm!=1)) return false;
  candidate.has_warm=has_warm!=0;
  input>>std::ws;
  if (!input.eof() || !valid_state(candidate)) return false;
  // Bound the unused residual too: future format changes must not turn a
  // formerly ignored NaN/extreme field into an accepted live coefficient.
  if (!std::isfinite(candidate.warm.amplitude) || std::abs(candidate.warm.amplitude)>20 ||
      !std::isfinite(candidate.warm.current) || std::abs(candidate.warm.current)>20) return false;
  result=candidate;
  return true;
}
inline bool restore_state(Model &model,const PersistentState &state,int64_t now,const Sample &sample) {
  return valid_state(state) && model.warm_start(now,state.saved_unix,state.currents,
                                               state.has_warm ? &state.warm : nullptr,sample);
}

// The original refreshValue counter saves on counter>60: starting at zero,
// this is 62 successful two-second samples. Failed sensor reads do not advance
// this count. A final explicit shutdown checkpoint is independent of cadence.
class StateCadence {
 public:
  bool successful_sample() {
    if (count_<=60) {++count_;return false;}
    count_=0;return true;
  }
 private:
  unsigned count_{0};
};
} // namespace cgs1_thermal
