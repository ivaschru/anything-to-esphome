// Test the production cache: no device, HA instance, GPIO or copied parser.
#include "ports/lite/components/cgdn1_ha_sources/source_cache.h"
#include <cassert>
#include <cmath>
#include <string>
using cgdn1_ha::SourceCache;
int main() {
  SourceCache c;
  for (size_t i=0;i<6;++i) {
    assert(c.configure(i,"sensor.source_"+std::to_string(i)));
    assert(c.status(i,0)==SourceCache::WAITING);
  }
  const char *units[]={"ppm","°F","%","µg/m³","mg/m3","ug/m3"};
  const char *states[]={"612","77","45","8","0.012","17"};
  const float expected[]={612,25,45,8,12,17};
  for(size_t i=0;i<6;++i) {
    c.state(i,states[i],100); assert(c.status(i,100)==SourceCache::WAITING);
    c.unit(i,units[i],100); assert(c.status(i,100)==SourceCache::READY);
    assert(std::abs(c.value(i,100)-expected[i])<0.001f);
    assert(c.status(i,180100)==SourceCache::STALE);
  }
  assert(!c.configure(1,"switch.relay"));
  assert(!c.configure(1,"sensor.Upper"));
  assert(c.entity(1)=="sensor.source_1");
  assert(c.configure(1,"sensor.different_temperature"));
  assert(c.status(1,101)==SourceCache::WAITING); // Never reuse prior source data.
  c.state(1,"20",102);c.unit(1,"ppm",102);
  assert(c.status(1,102)==SourceCache::UNIT_MISMATCH);
  c.unit(1,"°C",102); assert(c.value(1,102)==20);
  c.state(2,"101",103);assert(c.status(2,103)==SourceCache::OUT_OF_RANGE);
  for(const char *bad:{"unknown","unavailable","nan","inf"," 12","12x","0x12","1,2"}) {
    c.state(0,bad,105);assert(c.status(0,105)==SourceCache::INVALID_STATE);
  }
  c.state(0,"700",UINT32_MAX-100);c.unit(0,"ppm",UINT32_MAX-100);
  assert(c.value(0,50)==700); // Monotonic freshness survives millis wrap.
  c.clear_values();assert(c.configured(0));assert(c.status(0,51)==SourceCache::WAITING);
  assert(c.configure(0,""));assert(!c.configured(0));assert(c.status(0,52)==SourceCache::UNCONFIGURED);
  assert(std::isnan(c.value(0,52)));
}
