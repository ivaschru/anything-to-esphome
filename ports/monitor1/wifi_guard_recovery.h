#pragma once

// Independent-guardian rollback policy. Not yet wired to a device writer.
// No credential, SSID/key setter, ADD, SAVE_CONFIG, arbitrary command or caller
// pathname exists here. The production Backend must hold the real recovery
// flock AFTER native death, fence boot/full-session/plan/WPA socket ownership,
// and reread the private durable decision before EVERY possible mutation.
// A mock Backend never supplies production authority.
#include "wifi_guard_plan.h"

namespace cgs1_wifi_recovery {
using Decision=cgs1_wifi_decision::Decision;
using Reply=cgs1_wifi_switch::Reply;
using Profile=cgs1_wifi::SavedProfile;
enum class Result {
  CONFIGURATION_RESTORED,KEEP_COMMITTED,REFUSED,DECISION_UNKNOWN,
  READ_UNAVAILABLE,SELECT_UNCERTAIN,ENABLE_UNCERTAIN,REMOVE_UNCERTAIN,CONSUMED
};

inline const Profile *find(const std::vector<Profile>&profiles,int id) {
  const auto at=std::find_if(profiles.begin(),profiles.end(),[&](const auto&p){return p.id==id;});
  return at==profiles.end()?nullptr:&*at;
}
inline int original_current(const cgs1_wifi_guard::Plan&plan) {
  for(const auto&p:plan.original)if(p.current)return p.id;
  return -1;
}
inline bool ordinary(const Profile&p) {
  // Recovery restores CONFIGURATION, not successful authentication. The
  // reviewed vendor LIST_NETWORKS formats TEMP-DISABLED from a DIFFERENT
  // field (0x268) than configured disabled (0x1f0). Authentication backoff may
  // appear/expire while native dies or original association restarts. Refusing
  // that known runtime flag can strand stock behind its recovery receipt gate.
  // Decode the exact flags again and require consistent typed fields; unknown,
  // P2P, duplicate and contradictory tags still fail BEFORE any WPA write.
  // Initial plans remain strict: valid(plan) never admits TEMP-DISABLED there.
  if(p.id<0 || p.id>1000000 || !p.flags_known || p.flags.size()>256)return false;
  Profile decoded;decoded.flags=p.flags;
  return cgs1_wifi::parse_profile_flags(decoded) && decoded.flags_known &&
    decoded.current==p.current && decoded.disabled==p.disabled &&
    decoded.temporarily_disabled==p.temporarily_disabled;
}
inline bool shape(const cgs1_wifi_guard::Plan&plan,const std::vector<Profile>&profiles,
                  int candidate,bool candidate_present) {
  if(!cgs1_wifi_guard::valid(plan) || profiles.size()!=plan.original.size()+(candidate_present?1u:0u))return false;
  unsigned currents=0;
  for(size_t i=0;i<profiles.size();++i) {
    const auto&p=profiles[i];if(!ordinary(p))return false;
    for(size_t j=0;j<i;++j)if(profiles[j].id==p.id)return false;
    currents+=p.current;
    const auto*old=find(plan.original,p.id);
    if(old) {
      if(p.ssid_text!=old->ssid_text || p.bssid!=old->bssid)return false;
      // The forward path never enables an originally disabled profile. An
      // unexpected change is not silently normalized by sending DISABLE.
      if(old->disabled && !p.disabled)return false;
    } else if(!candidate_present || p.id!=candidate || p.bssid!="any")return false;
  }
  return currents<=1;
}
inline bool restored_flags(const cgs1_wifi_guard::Plan&plan,const std::vector<Profile>&profiles) {
  for(const auto&old:plan.original) {
    const auto*now=find(profiles,old.id);
    if(!now || now->disabled!=old.disabled || (now->current && !old.current))return false;
  }
  // Absence of CURRENT can be an in-progress WPA association. This result is
  // CONFIGURATION only; separate lease/route/gateway proof must establish
  // connectivity. Never mistake a retained old IPv4 address for a new lease.
  return true;
}

template<class Backend> class Recovery {
 public:
  explicit Recovery(Backend&backend):backend_(backend){}
  Result attempt(const cgs1_wifi_guard::Plan&plan,int bound_candidate=-1) {
    if(consumed_)return Result::CONSUMED;
    consumed_=true;
    // A quiescent boot baseline may have no CURRENT, or a merely configured
    // CURRENT pointer. Never run the connected SELECT-original policy for it.
    // Its separate restoration policy is not yet enabled in this revision.
    if(plan.catalog_mode!=cgs1_wifi_prepare::CatalogMode::CONNECTED)return Result::REFUSED;
    if(!cgs1_wifi_guard::valid(plan) || bound_candidate<-1 || bound_candidate>1000000 ||
        find(plan.original,bound_candidate) || !backend_.recovery_exclusive(plan))return Result::REFUSED;
    const auto decision=backend_.decision(plan.decision);
    if(decision==Decision::COMMITTED)return Result::KEEP_COMMITTED;
    if(decision!=Decision::UNCOMMITTED)return Result::DECISION_UNKNOWN;
    std::vector<Profile> profiles;
    if(!backend_.catalog(profiles))return Result::READ_UNAVAILABLE;
    int candidate=bound_candidate;
    if(profiles.size()==plan.original.size())
      return shape(plan,profiles,candidate,false) && restored_flags(plan,profiles)
        ?Result::CONFIGURATION_RESTORED:Result::REFUSED;
    if(candidate<0) {
      // Lost ADD reply before ID binding: only ONE new empty disabled profile
      // is attributable under the exclusive writer fence. Never guess among
      // several additions or remove a nonempty/unbound profile.
      for(const auto&p:profiles)if(!find(plan.original,p.id)) {
        if(candidate>=0 || !p.ssid_text.empty() || !p.disabled || p.current)return Result::REFUSED;
        candidate=p.id;
      }
    }
    if(candidate<0 || !shape(plan,profiles,candidate,true))return Result::REFUSED;
    const int original=original_current(plan);
    const auto*old=find(profiles,original);const auto*added=find(profiles,candidate);
    if(!old || !added)return Result::REFUSED;
    bool another_current=false,additional_enabled=false,needs_enable=false;
    for(const auto&p:plan.original)if(p.id!=original && !p.disabled) {
      additional_enabled=true;
      needs_enable|=find(profiles,p.id)->disabled;
    }
    for(const auto&p:profiles)if(p.current && p.id!=original)another_current=true;
    const bool select=old->disabled || !added->disabled || another_current;
    // Verify no-connect support BEFORE a SELECT would disable old automatic
    // fallback networks. No plain ENABLE retry/fallback is allowed. Upstream
    // hostap_2_5 has this feature; the actual vendor capability is independent.
    if((needs_enable || (select && additional_enabled)) && !backend_.verified_no_connect())return Result::REFUSED;
    if(select) {
      auto proof=before_write_(plan,profiles,candidate);
      if(proof!=Result::CONFIGURATION_RESTORED)return proof;
      if(backend_.select_original(original)!=Reply::ACK)return Result::SELECT_UNCERTAIN;
      if(!backend_.catalog(profiles))return Result::READ_UNAVAILABLE;
      if(!shape(plan,profiles,candidate,true))return Result::REFUSED;
      for(const auto&p:profiles)
        if((p.id==original && p.disabled) || (p.id!=original && !p.disabled))return Result::REFUSED;
    }
    for(const auto&previous:plan.original) {
      if(previous.id==original || previous.disabled)continue;
      const auto*now=find(profiles,previous.id);
      if(!now || now->current)return Result::REFUSED;
      if(!now->disabled)continue; // Lost prior ACK already applied: no resend.
      const auto proof=before_write_(plan,profiles,candidate);
      if(proof!=Result::CONFIGURATION_RESTORED)return proof;
      if(backend_.enable_original_no_connect(previous.id)!=Reply::ACK)return Result::ENABLE_UNCERTAIN;
      if(!backend_.catalog(profiles))return Result::READ_UNAVAILABLE;
      if(!shape(plan,profiles,candidate,true) || find(profiles,previous.id)->disabled ||
          find(profiles,previous.id)->current || find(profiles,original)->disabled || !find(profiles,candidate)->disabled)
        return Result::REFUSED;
    }
    if(!restored_flags(plan,profiles) || !find(profiles,candidate)->disabled)return Result::REFUSED;
    const auto proof=before_write_(plan,profiles,candidate);
    if(proof!=Result::CONFIGURATION_RESTORED)return proof;
    if(backend_.remove_candidate(candidate)!=Reply::ACK)return Result::REMOVE_UNCERTAIN;
    if(!backend_.catalog(profiles))return Result::READ_UNAVAILABLE;
    return shape(plan,profiles,candidate,false) && restored_flags(plan,profiles)
      ?Result::CONFIGURATION_RESTORED:Result::REFUSED;
  }
 private:
  Backend&backend_;bool consumed_{false};
  Result before_write_(const cgs1_wifi_guard::Plan&plan,std::vector<Profile>&profiles,int candidate) {
    if(!backend_.recovery_exclusive(plan))return Result::REFUSED;
    const auto decision=backend_.decision(plan.decision);
    if(decision==Decision::COMMITTED)return Result::KEEP_COMMITTED;
    if(decision!=Decision::UNCOMMITTED)return Result::DECISION_UNKNOWN;
    std::vector<Profile> fresh;
    if(!backend_.catalog(fresh))return Result::READ_UNAVAILABLE;
    if(!shape(plan,fresh,candidate,true) || fresh.size()!=profiles.size())return Result::REFUSED;
    for(const auto&old:profiles) {
      const auto*now=find(fresh,old.id);
      // CURRENT may appear while WPA finishes the already-requested old
      // association. Enabling/SSID/BSSID changes are never accepted as that.
      if(!now || now->disabled!=old.disabled || now->ssid_text!=old.ssid_text || now->bssid!=old.bssid ||
          (now->current && now->id!=original_current(plan) &&
           (now->id!=candidate || now->disabled)))return Result::REFUSED;
    }
    profiles=std::move(fresh);return Result::CONFIGURATION_RESTORED;
  }
};
} // namespace cgs1_wifi_recovery
