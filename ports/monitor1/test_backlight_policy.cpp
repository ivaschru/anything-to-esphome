// Source regression for the observed 1%-black/2%-visible boundary. No sysfs,
// display, network, firmware or device is opened by this host executable.
#include "cgs1_backlight.h"
#include <cassert>
#include <limits>
int main() {
  using namespace cgs1_backlight;
  assert(day_raw(1)==20 && day_raw(2)==20 && day_raw(100)==1000);
  assert(night_raw(0.1f)==20 && night_raw(0.5f)==20 && night_raw(1)==20);
  assert(night_raw(2)==20 && night_raw(10)==100 && night_raw(50)==100);
  assert(day_percent(1)==2 && night_percent(0.5f)==2);
  assert(day_raw(std::numeric_limits<float>::quiet_NaN())==100);
  assert(night_raw(std::numeric_limits<float>::infinity())==20);
  // Zero/legacy bad state cannot blank a visible frame; explicit OFF alone
  // may write zero. Waking the same stored state is immediately visible.
  for(int raw=-10;raw<=1010;++raw) {
    assert(effective(false,raw)==0);
    assert(effective(true,raw)>=20 && effective(true,raw)<=1000);
  }
  assert(effective(false,10)==0 && effective(true,10)==20);
  assert(day_raw(37)==370 && night_raw(3.5f)==35); // Valid preferences preserved.
}
