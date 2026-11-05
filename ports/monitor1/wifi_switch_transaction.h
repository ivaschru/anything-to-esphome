#pragma once

// Wi-Fi switch orchestration, intentionally not connected to a device writer.
//
// A Linux adapter must own both the supplicant writer and an INDEPENDENT local
// recovery process before using this controller. A timer in ESPHome/the remote
// client is insufficient: either can disappear precisely when Wi-Fi changes.
// The adapter must retain the old private configuration and enabled-profile
// set, stage a NEW disabled candidate without modifying an existing profile,
// bind every operation to the exact daemon/socket/transaction, and restore it
// without the controller on timeout. Credentials never enter this policy.
//
// commit() is one local transactional operation: atomically persist and verify
// the new private configuration, then retire its recovery lease. Its ACK may
// only mean BOTH are durable. A lost ACK is reconciled with inspect_guard(),
// never retried. This file alone does not implement that Linux contract and
// must not be advertised as working device Wi-Fi setup until its adapter and
// actual loss-of-connection recovery have been tested.
#include <algorithm>
#include <cstdint>
#include <string>
#include <vector>
#include <arpa/inet.h>

namespace cgs1_wifi_switch {
enum class Reply { ACK, REFUSED, AMBIGUOUS };
enum class Guard { ARMED, COMMITTED, ROLLED_BACK, UNKNOWN };
enum class Phase {
  IDLE, ASSOCIATING, AWAITING_CONFIRMATION, COMMITTING, COMMITTED,
  ROLLING_BACK, ROLLED_BACK, RECOVERY_REQUIRED
};
enum class Error {
  NONE, INVALID_PLAN, BASELINE_CHANGED, ARM_REFUSED, ARM_AMBIGUOUS,
  SELECT_REFUSED, TIMEOUT, CANCELLED, GUARD_UNAVAILABLE, CLOCK_REVERSED,
  INVENTORY_CHANGED, COMMIT_REFUSED, OUTCOME_NOT_VERIFIED
};
struct Profile {
  int id{-1};
  // Non-secret identity from SSID/security/BSSID metadata. Never a PSK hash.
  // The adapter binds this opaque fingerprint to its exact prepared profile.
  std::string fingerprint;
  bool enabled{false}, current{false};
};
struct Inventory {
  bool verified{false};
  std::vector<Profile> profiles;
};
struct Observation {
  bool verified{false}, completed{false};
  int id{-1};
  std::string ipv4;
  uint64_t lease_generation{0};
  // Both proofs must concern wlan0 AFTER the candidate was selected. A
  // retained old IP or another interface's/default route is not success.
  bool lease_current{false}, route_bound{false}, gateway_reachable{false};
};
struct Plan {
  std::vector<Profile> original;
  Profile candidate;
  uint64_t transaction{0}, initial_lease_generation{0};
  uint64_t timeout_ms{60000}, stable_ms{5000};
};

inline bool fingerprint_valid(const std::string &s) {
  if (s.size()!=64) return false;
  return std::all_of(s.begin(),s.end(),[](char c) {
    return (c>='0' && c<='9') || (c>='a' && c<='f');
  });
}
inline bool usable_ipv4(const std::string &s) {
  in_addr address{};
  if (::inet_pton(AF_INET,s.c_str(),&address)!=1) return false;
  const uint32_t n=ntohl(address.s_addr);
  // This implementation deliberately has no IPv6-only success path. Reject
  // unspecified, loopback, link-local, multicast, reserved and broadcast.
  const auto first=n>>24;
  return first!=0 && first!=127 && first<224 && (n>>16)!=0xa9fe;
}
inline bool profiles_valid(const std::vector<Profile> &profiles) {
  if (profiles.empty() || profiles.size()>32) return false;
  std::vector<int> ids;
  for (const auto &p:profiles) {
    if (p.id<0 || p.id>1000000 || !fingerprint_valid(p.fingerprint) ||
        (p.current && !p.enabled) || std::find(ids.begin(),ids.end(),p.id)!=ids.end()) return false;
    ids.push_back(p.id);
  }
  return true;
}
inline const Profile *find(const std::vector<Profile> &profiles,int id) {
  const auto p=std::find_if(profiles.begin(),profiles.end(),[id](const Profile &v){return v.id==id;});
  return p==profiles.end()?nullptr:&*p;
}
inline int current_id(const std::vector<Profile> &profiles) {
  int id=-1;
  for (const auto &p:profiles) if(p.current) {if(id>=0)return -1;id=p.id;}
  return id;
}
inline bool inventory_matches(const Plan &p,const Inventory &actual,bool candidate_present,
                              bool original_flags) {
  if (!actual.verified || !profiles_valid(actual.profiles) ||
      actual.profiles.size()!=p.original.size()+(candidate_present?1:0)) return false;
  for (const auto &before:p.original) {
    const auto *now=find(actual.profiles,before.id);
    if (!now || now->fingerprint!=before.fingerprint ||
        (original_flags && (now->enabled!=before.enabled || now->current!=before.current))) return false;
  }
  if (candidate_present) {
    const auto *now=find(actual.profiles,p.candidate.id);
    if (!now || now->fingerprint!=p.candidate.fingerprint) return false;
    if (original_flags && (now->enabled || now->current)) return false;
  }
  return true;
}
inline bool committed_inventory_matches(const Plan &p,const Inventory &actual) {
  if (!inventory_matches(p,actual,true,false)) return false;
  // SELECT_NETWORK disables the other profiles. Successful persistence must
  // restore their previous enabled flags, otherwise a later unavailable new
  // AP would silently remove the user's old automatic fallback networks.
  for (const auto &before:p.original) {
    const auto *now=find(actual.profiles,before.id);
    if (now->enabled!=before.enabled || now->current) return false;
  }
  const auto *candidate=find(actual.profiles,p.candidate.id);
  return candidate->enabled && candidate->current;
}

template<class Backend> class Transaction {
 public:
  explicit Transaction(Backend &backend):backend_(backend){}
  Phase phase() const {return phase_;}
  Error error() const {return error_;}
  uint64_t identity() const {return plan_.transaction;}
  bool begin(const Plan &plan,uint64_t now) {
    // One controller instance consumes at most one plan. A repeated UI/API
    // request cannot rearm a lease or resend an ambiguous SELECT_NETWORK.
    if (begun_) return false;
    if (!valid_plan(plan) || now>UINT64_MAX-plan.timeout_ms) {error_=Error::INVALID_PLAN;return false;}
    begun_=true;plan_=plan;last_now_=now;deadline_=now+plan.timeout_ms;
    const Observation baseline=backend_.observe();
    if (!inventory_matches(plan_,backend_.inventory(),true,true) ||
        baseline.lease_generation!=plan_.initial_lease_generation ||
        !healthy(baseline,current_id(plan_.original),false)) {
      error_=Error::BASELINE_CHANGED;return false;
    }
    // arm() must return ACK only after a separate process has acknowledged an
    // immutable rollback plan and absolute local deadline, before any select.
    const Reply armed=backend_.arm(plan_,deadline_);
    if (armed!=Reply::ACK) {
      error_=armed==Reply::REFUSED?Error::ARM_REFUSED:Error::ARM_AMBIGUOUS;
      phase_=Phase::RECOVERY_REQUIRED;return false;
    }
    phase_=Phase::ASSOCIATING;
    const Reply selected=backend_.select(plan_.transaction,plan_.candidate.id);
    if (selected==Reply::REFUSED) request_rollback(Error::SELECT_REFUSED);
    // AMBIGUOUS deliberately follows observation, not a retry. It may already
    // have switched the radio. The independent deadline remains armed.
    return true;
  }
  void poll(uint64_t now) {
    if (!active()) return;
    if (now<last_now_) {fail(Error::CLOCK_REVERSED);return;}
    last_now_=now;
    const Guard guard=backend_.inspect_guard(plan_.transaction);
    if (guard==Guard::UNKNOWN) {fail(Error::GUARD_UNAVAILABLE);return;}
    if (guard==Guard::ROLLED_BACK) {
      if (inventory_matches(plan_,backend_.inventory(),false,true) &&
          healthy(backend_.observe(),current_id(plan_.original),false)) phase_=Phase::ROLLED_BACK;
      else fail(Error::OUTCOME_NOT_VERIFIED);
      return;
    }
    if (guard==Guard::COMMITTED) {
      // An independently committed result is accepted only after commit was
      // requested by this controller. Never adopt another actor's decision.
      if (commit_sent_ && committed_inventory_matches(plan_,backend_.inventory()) &&
          healthy(backend_.observe(),plan_.candidate.id,true)) phase_=Phase::COMMITTED;
      else fail(Error::OUTCOME_NOT_VERIFIED);
      return;
    }
    if (now>=deadline_) {request_rollback(Error::TIMEOUT);return;}
    if (phase_==Phase::ROLLING_BACK || phase_==Phase::COMMITTING) return;
    if (!inventory_matches(plan_,backend_.inventory(),true,false)) {fail(Error::INVENTORY_CHANGED);return;}
    const Observation observed=backend_.observe();
    if (!healthy(observed,plan_.candidate.id,true)) {
      stable_=false;phase_=Phase::ASSOCIATING;return;
    }
    if (!stable_ || stable_lease_!=observed.lease_generation || stable_ip_!=observed.ipv4) {
      stable_=true;stable_since_=now;stable_lease_=observed.lease_generation;
      stable_ip_=observed.ipv4;phase_=Phase::ASSOCIATING;
    }
    if (now-stable_since_>=plan_.stable_ms) phase_=Phase::AWAITING_CONFIRMATION;
  }
  bool confirm(uint64_t transaction,uint64_t now) {
    if (transaction!=plan_.transaction || phase_!=Phase::AWAITING_CONFIRMATION) return false;
    // Recheck all independent proofs at the decision, not just when the UI
    // last drew 'connected'. An old touchscreen event cannot confirm a new job.
    poll(now);
    if (phase_!=Phase::AWAITING_CONFIRMATION) return false;
    commit_sent_=true;phase_=Phase::COMMITTING;
    const Reply result=backend_.commit(plan_.transaction);
    if (result==Reply::REFUSED) request_rollback(Error::COMMIT_REFUSED);
    // ACK and lost ACK both require one independent read-back. No second
    // commit or SAVE_CONFIG is sent on any subsequent poll/confirm.
    return true;
  }
  bool cancel(uint64_t transaction,uint64_t now) {
    if (transaction!=plan_.transaction || !active() || commit_sent_) return false;
    poll(now);
    if (!active() || phase_==Phase::RECOVERY_REQUIRED) return false;
    request_rollback(Error::CANCELLED);return true;
  }
 private:
  static bool valid_plan(const Plan &p) {
    return p.transaction && p.initial_lease_generation && p.timeout_ms>=10000 && p.timeout_ms<=120000 &&
      p.stable_ms>=1000 && p.stable_ms<=30000 && p.stable_ms<p.timeout_ms &&
      profiles_valid(p.original) && p.original.size()<32 && current_id(p.original)>=0 &&
      p.candidate.id>=0 && p.candidate.id<=1000000 && !find(p.original,p.candidate.id) &&
      fingerprint_valid(p.candidate.fingerprint) && !p.candidate.enabled && !p.candidate.current;
  }
  bool active() const {
    return phase_==Phase::ASSOCIATING || phase_==Phase::AWAITING_CONFIRMATION ||
      phase_==Phase::COMMITTING || phase_==Phase::ROLLING_BACK;
  }
  bool healthy(const Observation &o,int id,bool candidate) const {
    return o.verified && o.completed && o.id==id && usable_ipv4(o.ipv4) &&
      o.lease_current && o.route_bound && o.gateway_reachable &&
      (!candidate || o.lease_generation>plan_.initial_lease_generation);
  }
  void request_rollback(Error reason) {
    error_=reason;phase_=Phase::ROLLING_BACK;
    if (rollback_sent_) return;
    rollback_sent_=true;
    // Failure/lost ACK never retires the independent lease. poll() waits for
    // its exact outcome and verifies the old profile set and connection. The
    // adapter must CAS ARMED->ROLLBACK; a concurrent committed decision may
    // not be undone by an old cancel/timeout request.
    (void)backend_.rollback(plan_.transaction);
  }
  void fail(Error reason) {error_=reason;phase_=Phase::RECOVERY_REQUIRED;}
  Backend &backend_;Plan plan_;
  Phase phase_{Phase::IDLE};Error error_{Error::NONE};
  bool begun_{false},stable_{false},commit_sent_{false},rollback_sent_{false};
  uint64_t deadline_{0},last_now_{0},stable_since_{0},stable_lease_{0};
  std::string stable_ip_;
};
} // namespace cgs1_wifi_switch
