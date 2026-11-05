#pragma once

// Separate guardian rollback POLICY for a sealed unassociated boot baseline.
// It never calls SELECT: an old configured CURRENT pointer does not identify
// a working association. Native must already be dead and the concrete backend
// must own the exact recovery fence and re-read the private Store decision.
//
// Remove only our bound candidate, then restore original enabled flags with
// verified no-connect. A lost ACK consumes this actor; another actor observes
// actual rows and skips effects already applied. No lease/route/gateway or
// Internet claim is made by CONFIGURATION_RESTORED.
#include "wifi_guard_recovery.h"

namespace cgs1_wifi_recovery {
inline bool unassociated_flags_restored(const cgs1_wifi_guard::Plan&plan,
    const std::vector<Profile>&profiles) {
  if(plan.catalog_mode!=cgs1_wifi_prepare::CatalogMode::UNASSOCIATED ||
      profiles.size()!=plan.original.size())return false;
  for(const auto&old:plan.original) {
    const auto*now=find(profiles,old.id);
    if(!now || now->disabled!=old.disabled)return false;
  }
  // CURRENT is volatile selected-profile metadata. Shape/ordinary validation
  // separately excludes foreign IDs, duplicate rows and disabled CURRENT.
  return true;
}

template<class Backend>class UnassociatedRecovery {
 public:
  explicit UnassociatedRecovery(Backend&backend):backend_(backend){}
  Result attempt(const cgs1_wifi_guard::Plan&plan,int bound_candidate=-1) {
    if(consumed_)return Result::CONSUMED;
    consumed_=true;
    if(plan.catalog_mode!=cgs1_wifi_prepare::CatalogMode::UNASSOCIATED ||
        !cgs1_wifi_guard::valid(plan) || bound_candidate<-1 || bound_candidate>1000000 ||
        find(plan.original,bound_candidate) || !backend_.recovery_exclusive(plan))return Result::REFUSED;
    auto decision=decision_(plan);if(decision!=Result::CONFIGURATION_RESTORED)return decision;
    std::vector<Profile>rows;if(!backend_.catalog(rows))return Result::READ_UNAVAILABLE;
    const bool present=rows.size()==plan.original.size()+1;
    if(!present && rows.size()!=plan.original.size())return Result::REFUSED;
    int candidate=bound_candidate;
    if(present && candidate<0) {
      // Reconcile a lost ADD reply only for ONE new empty disabled row.
      // A nonempty/unbound or backoff profile is never guessed to be ours.
      for(const auto&p:rows)if(!find(plan.original,p.id)) {
        if(candidate>=0 || !p.ssid_text.empty() || !p.disabled || p.current || p.temporarily_disabled)
          return Result::REFUSED;
        candidate=p.id;
      }
      if(candidate<0)return Result::REFUSED;
    }
    if(!shape(plan,rows,candidate,present))return Result::REFUSED;
    bool needs_enable=false;
    for(const auto&old:plan.original)needs_enable|=!old.disabled && find(rows,old.id)->disabled;
    // Without a bound candidate there was no admitted SELECT. An unexpected
    // change to old flags is not permission for an unbound actor to repair it.
    if((!present && bound_candidate<0 && needs_enable) ||
        (needs_enable && !backend_.verified_no_connect()))return Result::REFUSED;
    if(present) {
      const auto proof=fresh_(plan,rows,candidate,true);
      if(proof!=Result::CONFIGURATION_RESTORED)return proof;
      if(backend_.remove_candidate(candidate)!=Reply::ACK)return Result::REMOVE_UNCERTAIN;
      if(!backend_.catalog(rows))return Result::READ_UNAVAILABLE;
      if(!shape(plan,rows,candidate,false))return Result::REFUSED;
    }
    for(const auto&old:plan.original) {
      if(old.disabled)continue;
      const auto*now=find(rows,old.id);
      if(!now)return Result::REFUSED;
      if(!now->disabled)continue; // Earlier lost ACK already applied: no resend.
      const auto proof=fresh_(plan,rows,candidate,false);
      if(proof!=Result::CONFIGURATION_RESTORED)return proof;
      if(!backend_.verified_no_connect())return Result::REFUSED;
      if(backend_.enable_original_no_connect(old.id)!=Reply::ACK)return Result::ENABLE_UNCERTAIN;
      if(!backend_.catalog(rows))return Result::READ_UNAVAILABLE;
      if(!shape(plan,rows,candidate,false) || find(rows,old.id)->disabled)return Result::REFUSED;
    }
    // A final scope/decision/catalog fence is needed even when no write was
    // necessary or a later actor only reconciled an already-applied command.
    const auto proof=fresh_(plan,rows,candidate,false);
    if(proof!=Result::CONFIGURATION_RESTORED)return proof;
    return unassociated_flags_restored(plan,rows)?Result::CONFIGURATION_RESTORED:Result::REFUSED;
  }
 private:
  Backend&backend_;bool consumed_{false};
  Result decision_(const cgs1_wifi_guard::Plan&plan) {
    const auto state=backend_.decision(plan.decision);
    return state==Decision::COMMITTED?Result::KEEP_COMMITTED:
      state==Decision::UNCOMMITTED?Result::CONFIGURATION_RESTORED:Result::DECISION_UNKNOWN;
  }
  Result fresh_(const cgs1_wifi_guard::Plan&plan,std::vector<Profile>&rows,int candidate,bool present) {
    if(!backend_.recovery_exclusive(plan))return Result::REFUSED;
    const auto decision=decision_(plan);if(decision!=Result::CONFIGURATION_RESTORED)return decision;
    std::vector<Profile>fresh;if(!backend_.catalog(fresh))return Result::READ_UNAVAILABLE;
    if(!shape(plan,fresh,candidate,present) || fresh.size()!=rows.size())return Result::REFUSED;
    for(const auto&old:rows) {
      const auto*now=find(fresh,old.id);
      // Association/backoff may progress independently; configured enabled
      // flags and non-secret identities must still match immediately before
      // our next mutation. Shape excludes every unrecognized current row.
      if(!now || now->disabled!=old.disabled || now->ssid_text!=old.ssid_text || now->bssid!=old.bssid)
        return Result::REFUSED;
    }
    rows=std::move(fresh);return Result::CONFIGURATION_RESTORED;
  }
};
} // namespace cgs1_wifi_recovery
