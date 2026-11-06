#pragma once

// Disk decision for the independent Wi-Fi guardian. This does not select or
// restore a profile. It answers the narrower question that must PRECEDE any
// timeout rollback: did this exact transaction already commit, did the exact
// old record survive, or is the outcome unknown?
//
// The caller must own/fence the guardian transaction and runtime profiles as
// well. The plan and both credential sets stay in a private sealed local
// journal, never a remote action, log, Trelio file or HA entity. A nonce alone
// is not enough: wrong credentials under the same nonce remain UNKNOWN.
#include "wifi_private_store.h"

namespace cgs1_wifi_decision {
using cgs1_wifi_private::Networks;
enum class Decision {COMMITTED,UNCOMMITTED,UNKNOWN};
struct Baseline {
  bool present{false};
  std::string decision_epoch;
  Networks networks;
};
struct Plan {
  std::string transaction;
  Baseline before;
  Networks desired;
};
inline bool valid(const Plan &p) {
  if(p.transaction.size()!=16 || !cgs1_checkpoint::valid_epoch(p.transaction.c_str()) ||
      !cgs1_wifi_private::detail::valid(p.desired))return false;
  if(!p.before.present)return p.before.decision_epoch.empty() && p.before.networks.empty();
  // A new transaction may not reuse the old committed nonce, even when its
  // SSID happens to match. A reopened already-committed transaction still has
  // its original earlier baseline in the independently retained plan.
  return p.before.decision_epoch.size()==16 && cgs1_checkpoint::valid_epoch(p.before.decision_epoch.c_str()) &&
    p.before.decision_epoch!=p.transaction && cgs1_wifi_private::detail::valid(p.before.networks);
}
inline bool saved_replay(const Plan&p) {
  // A boot reapplication cannot invent/edit/reorder a preference. Compare
  // canonical records with the SAME old decision epoch, including all key
  // bytes and fallback order. These bounded private buffers erase on scope
  // exit; neither hashes nor credentials become diagnostics or API fields.
  if(!valid(p) || !p.before.present || p.before.networks.empty())return false;
  cgs1_wifi_private::detail::Bytes before,desired;
  return cgs1_wifi_private::detail::encode(p.before.decision_epoch.c_str(),p.before.networks,before) &&
    cgs1_wifi_private::detail::encode(p.before.decision_epoch.c_str(),p.desired,desired) && before.value==desired.value;
}
inline bool manual_update(const Plan&p) {
  // Only the explicitly chosen first network may be added/rekeyed/promoted.
  // Every other previous key and relative order must survive unchanged.
  if(!valid(p) || p.desired.empty())return false;
  const auto&chosen=p.desired.front();Networks expected{chosen};
  for(const auto&old:p.before.networks)
    if(old.ssid_size!=chosen.ssid_size || std::memcmp(old.ssid.data(),chosen.ssid.data(),chosen.ssid_size))
      expected.push_back(old);
  cgs1_wifi_private::detail::Bytes actual,wanted;
  return cgs1_wifi_private::detail::encode(p.transaction.c_str(),p.desired,actual) &&
    cgs1_wifi_private::detail::encode(p.transaction.c_str(),expected,wanted) && actual.value==wanted.value;
}
template<class IO> Decision inspect(const Plan &p,const cgs1_wifi_private::Store<IO> &store) {
  if(!valid(p) || store.transaction_epoch()!=p.transaction || !store.loaded() ||
      !store.verify_unchanged())return Decision::UNKNOWN;
  if(store.decided_here()) {
    return store.matches_loaded(p.transaction.c_str(),p.desired)
      ?Decision::COMMITTED:Decision::UNKNOWN;
  }
  if(store.present()!=p.before.present)return Decision::UNKNOWN;
  if(!store.present())return Decision::UNCOMMITTED;
  return store.matches_loaded(p.before.decision_epoch.c_str(),p.before.networks)
    ?Decision::UNCOMMITTED:Decision::UNKNOWN;
  // UNKNOWN never authorizes rollback or retry. A newer foreign commit, bad
  // record, occupied flock, substituted inode or failed sync is not "old".
  // A fresh load can reconcile a visible rename after the old writer is gone.
  // COMMITTED forbids timeout rollback even if a UI/ACK was lost; connectivity
  // after that decision has its separate normal reconnect/fallback policy.
}
} // namespace cgs1_wifi_decision
