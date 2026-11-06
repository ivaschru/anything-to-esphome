#include "power_supply.h"
#include <cassert>
#include <iostream>
int main() {
  using namespace cgs1_power;
  auto good=parse("85\n","4123000\n","Charging\n","Charging\n");
  assert(good.complete() && good.capacity==85 && std::fabs(good.voltage-4.123f)<0.0001f);
  assert(good.charging() && good.external_known() && good.external());
  auto full=parse("100","4200000","Full","Full");
  assert(full.complete() && !full.charging() && full.external());
  auto discharging=parse("0","3100000","Discharging","Discharging");
  assert(discharging.complete() && !discharging.charging() && !discharging.external());
  auto paused=parse("75","3900000","Not charging","Not charging");
  assert(paused.complete() && !paused.charging() && !paused.external_known());
  for(const auto*bad:{"","-1","101","NaN","50.0","50x","1 0","9999999999999999999"})
    assert(!std::isfinite(parse(bad,"4000000","Full","Full").capacity));
  assert(!std::isfinite(parse(std::string("50\0x",4),"4000000","Full","Full").capacity));
  for(const auto*bad:{"0","1999999","5000001","NaN","4000000x","-4000000"})
    assert(!std::isfinite(parse("50",bad,"Full","Full").voltage));
  auto changed=parse("50","4000000","Charging","Discharging");
  assert(!changed.complete() && !std::isfinite(changed.capacity) && !changed.status_valid());
  auto unknown=parse("50","4000000","Unknown","Unknown");
  assert(!unknown.complete() && !unknown.status_valid() && !unknown.external_known());
  // Missing capacity remains unavailable even when voltage/status are valid.
  auto missing=parse("","4000000","Full","Full");
  assert(!missing.complete() && !std::isfinite(missing.capacity) && missing.status_valid());
  std::cout<<"power parsing/ranges/charging transitions: passed\n";
}
