#pragma once

// Admission for one retirement step, with no filesystem/network operations of
// its own. Production supplies the same NativeWifiScope as preparation; tests
// can advance a synthetic clock without touching a monitor or its credentials.
namespace cgs1_wifi_retirement {
template<class Authority,class Plan,class Peers,class Clock>
bool retirement_scope_alive(Authority&authority,const Plan&plan,const Peers&expected,
    unsigned long long created,const Clock&clock,bool&step_admitted) {
  const auto before=clock.now();
  if(!created || !before || before<created || before-created>=10000)return false;
  // One full admission per synchronous step; all later checks in that SAME
  // step still verify live exact bindings. The caller clears this private bit
  // at both step boundaries. Nothing here grants WPA/hardware authority or
  // extends the original deadline, including after slow full admission IO.
  if(step_admitted?!authority.retirement_current(plan,expected):
      !authority.retirement_admit(plan,expected))return false;
  // Scope/procfs/control reads can take time on this ARM board. A timestamp
  // captured before those reads is not permission to write after the bound.
  const auto after=clock.now();
  if(after<before || after-created>=10000)return false;
  step_admitted=true;return true;
}
} // namespace cgs1_wifi_retirement
