#pragma once
#include <algorithm>
#include <cmath>

// CGS1 rk28_bl uses raw 0..1000. On the observed panel raw10 (1%) is black,
// while raw20 (2%) is visible. Do not present an effectively-off value as
// usable brightness. Display OFF remains a separate, touch-wakeable state.
// Keep this policy above the guarded DRM backend: stock recovery must still
// restore its EXACT original raw value, not a UI-clamped replacement.
namespace cgs1_backlight {
constexpr float MIN_PERCENT=2.0f,DAY_MAX_PERCENT=100.0f,NIGHT_MAX_PERCENT=10.0f;
constexpr int MIN_RAW=20,DAY_MAX_RAW=1000,NIGHT_MAX_RAW=100;
inline float normalized(float value,float maximum,float fallback) {
  if(!std::isfinite(value))value=fallback;
  return std::clamp(value,MIN_PERCENT,maximum);
}
inline float day_percent(float value){return normalized(value,DAY_MAX_PERCENT,10.0f);}
inline float night_percent(float value){return normalized(value,NIGHT_MAX_PERCENT,MIN_PERCENT);}
inline int day_raw(float value){return int(std::lround(day_percent(value)*10));}
inline int night_raw(float value){return int(std::lround(night_percent(value)*10));}
inline int effective(bool screen_on,int requested) {
  // Also protects the first frame/legacy restored state, before any API or
  // local number callback has run. Zero belongs only to explicit screen OFF.
  return screen_on?std::clamp(requested,MIN_RAW,DAY_MAX_RAW):0;
}
}
