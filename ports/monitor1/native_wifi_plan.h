#pragma once

// Assemble one native Wi-Fi request from the actual admitted session, a live
// non-secret daemon/catalog snapshot and the canonical private Store. This is
// a builder, not a network writer: no journal publication, ADD/SELECT, signal,
// Store commit, success callback or alternative runtime path exists here.
#include "native_wifi_scope.h"
#include "dhcp_capture_probe.h"
#include "wifi_scan_results.h"
#include <openssl/rand.h>

namespace cgs1_wifi_request {
enum class PlanError {NONE,CONSUMED,REQUEST,SCOPE,CLOCK,SNAPSHOT,NONCE,STORE,CAPACITY,CHANGED,SAVED_RECORD};

class NativePlanSource final {
 public:
  uint64_t now()const{return cgs1_dhcp_lease::capture_now_ms();}
  bool begin(cgs1_dhcp_lease::ProbeFence&out){return backend_.prepare() && backend_.read(out);}
  bool unchanged(const cgs1_dhcp_lease::ProbeFence&before) {
    cgs1_dhcp_lease::ProbeFence after;
    return backend_.read(after) && cgs1_dhcp_lease::same_probe_fence(before,after);
  }
  bool nonce(std::string&out)const {
    // No time/PID fallback and no retry after failure/collision. Randomness
    // namespaces a decision; scope/Store/guardian proofs still give authority.
    std::array<unsigned char,8>bytes{};
    if(::RAND_bytes(bytes.data(),bytes.size())!=1)return false;
    constexpr char HEX[]="0123456789abcdef";out.clear();out.reserve(16);
    for(auto byte:bytes){out+=HEX[byte>>4];out+=HEX[byte&15];}
    return cgs1_checkpoint::valid_epoch(out.c_str());
  }
 private:
  cgs1_dhcp_lease::ProbeBackend backend_;
};

class NativeUnassociatedPlanSource final {
 public:
  uint64_t now()const{return cgs1_dhcp_lease::capture_now_ms();}
  bool begin(cgs1_dhcp_lease::ProbeFence&out){return backend_.prepare() && backend_.read_unassociated(out);}
  bool unchanged(const cgs1_dhcp_lease::ProbeFence&before) {
    cgs1_dhcp_lease::ProbeFence after;
    return backend_.read_unassociated(after) && cgs1_dhcp_lease::same_probe_fence(before,after);
  }
  bool nonce(std::string&out)const{return randomness_.nonce(out);}
 private:
  cgs1_dhcp_lease::ProbeBackend backend_;NativePlanSource randomness_;
};

class NativeBootPlanSource final {
 public:
  uint64_t now()const{return cgs1_dhcp_lease::capture_now_ms();}
  bool begin(cgs1_dhcp_lease::ProbeFence&out){return backend_.prepare() && backend_.read_boot(out);}
  bool unchanged(const cgs1_dhcp_lease::ProbeFence&before) {
    cgs1_dhcp_lease::ProbeFence after;
    return backend_.read_boot(after) && cgs1_dhcp_lease::same_probe_fence(before,after);
  }
  bool nonce(std::string&out)const{return randomness_.nonce(out);}
 private:
  cgs1_dhcp_lease::ProbeBackend backend_;NativePlanSource randomness_;
};

template<class Scope,class Source=NativePlanSource,
    cgs1_wifi_prepare::CatalogMode Mode=cgs1_wifi_prepare::CatalogMode::CONNECTED,
    bool BootReplay=false>class PlanBuilder {
 public:
  explicit PlanBuilder(Scope&scope):scope_(scope){}
  PlanBuilder(const PlanBuilder&)=delete;PlanBuilder&operator=(const PlanBuilder&)=delete;
  PlanError error()const{return error_;}
  bool saved_preferred_connected()const{return saved_preferred_connected_;}
  bool build(const cgs1_wifi_private::Network&network,cgs1_wifi_guard::Plan&out) {
    return build_(&network,out);
  }
  bool build_saved(cgs1_wifi_guard::Plan&out) {
    // Boot receives no caller-supplied SSID/key/index. The preferred entry is
    // read from the same locked Store snapshot that becomes the exact CAS
    // baseline. Missing/empty data is a refusal, never an empty-password or
    // default-network fallback. This method alone cannot arm any journal.
    return build_(nullptr,out);
  }
 private:
  bool build_(const cgs1_wifi_private::Network*requested,cgs1_wifi_guard::Plan&out) {
    if(attempted_){error_=PlanError::CONSUMED;return false;}
    attempted_=true;
    if(requested && (BootReplay || !requested->ssid_size || requested->ssid_size>32))return fail_(PlanError::REQUEST);
    cgs1_wifi_guard::Plan plan;
    if(!scope_.identify_plan(plan))return fail_(PlanError::SCOPE);
    plan.catalog_mode=Mode;
    plan.created_ms=source_.now();
    if(!plan.created_ms || plan.created_ms>UINT64_MAX-120000)return fail_(PlanError::CLOCK);
    plan.deadline_ms=plan.created_ms+120000;
    cgs1_dhcp_lease::ProbeFence baseline;
    if(!source_.begin(baseline) || baseline.boot!=plan.boot_id || !baseline.daemon.verified ||
        baseline.daemon.process.pid<2 || baseline.daemon.process.pid>2147483647 ||
        !baseline.daemon.process.start || !baseline.daemon.socket_inode)return fail_(PlanError::SNAPSHOT);
    const auto observed=cgs1_wifi_boot::classify(baseline.association,baseline.profiles);
    if constexpr(BootReplay) {
      if(observed==cgs1_wifi_boot::Baseline::UNSUPPORTED)return fail_(PlanError::SNAPSHOT);
      plan.catalog_mode=observed==cgs1_wifi_boot::Baseline::CONNECTED?
        cgs1_wifi_prepare::CatalogMode::CONNECTED:cgs1_wifi_prepare::CatalogMode::UNASSOCIATED;
    }
    if(!cgs1_wifi_prepare::supported_catalog(baseline.profiles,plan.catalog_mode))return fail_(PlanError::SNAPSHOT);
    // Match the sealed baseline semantics to the actual STATUS/catalog join.
    // A selected-but-unassociated CURRENT pointer cannot pass CONNECTED; the
    // dedicated boot source is never chosen as fallback after a read error.
    const auto expected=plan.catalog_mode==cgs1_wifi_prepare::CatalogMode::CONNECTED
      ?cgs1_wifi_boot::Baseline::CONNECTED:cgs1_wifi_boot::Baseline::UNASSOCIATED;
    if(observed!=expected)
      return fail_(PlanError::SNAPSHOT);
    plan.daemon_pid=uint32_t(baseline.daemon.process.pid);plan.daemon_start=baseline.daemon.process.start;
    plan.socket_inode=baseline.daemon.socket_inode;plan.original=baseline.profiles;
    if(!source_.nonce(plan.decision.transaction) || plan.decision.transaction.size()!=16 ||
        !cgs1_checkpoint::valid_epoch(plan.decision.transaction.c_str()))return fail_(PlanError::NONCE);
    const int parent=scope_.duplicate_private_parent();if(parent<0)return fail_(PlanError::SCOPE);
    cgs1_wifi_private::Store<>store;cgs1_wifi_private::Networks previous;
    const bool opened=store.open_existing(parent,plan.decision.transaction.c_str());::close(parent);
    if(!opened)return fail_(PlanError::STORE);
    const auto loaded=store.load(previous);
    if(loaded==cgs1_wifi_private::Load::ERROR)return fail_(PlanError::STORE);
    plan.decision.before.present=loaded==cgs1_wifi_private::Load::LOADED;
    if(plan.decision.before.present) {
      plan.decision.before.decision_epoch=store.decision_epoch();
      if(plan.decision.before.decision_epoch==plan.decision.transaction)return fail_(PlanError::NONCE);
      plan.decision.before.networks=previous;
    }
    if(!requested && (!plan.decision.before.present || previous.empty()))
      return fail_(PlanError::SAVED_RECORD);
    // Update only our own overlay. The explicitly selected network goes first:
    // that same atomic record must tell a later boot which choice to prefer,
    // rather than guessing from an unrelated timestamp or second marker.
    // Preserve every OTHER key and their relative order. Capacity exhaustion
    // is a refusal, never implicit eviction of a fallback the user may need.
    // The exact old ordered record above remains the unchanged rollback/CAS
    // baseline; building this desired value performs no commit or selection.
    if(!requested) {
      // Reapply exactly the previously accepted ordered record. Do not move
      // a discovered SSID, replace a key, or silently evict a fallback at boot.
      // The candidate is always desired.front(); fresh DHCP and the normal
      // guarded commit/retirement are still required before success.
      plan.decision.desired=previous;
    }else {
      const auto&network=*requested;
      const auto at=std::find_if(previous.begin(),previous.end(),[&](const auto&old){
        return old.ssid_size==network.ssid_size && !std::memcmp(old.ssid.data(),network.ssid.data(),network.ssid_size);
      });
      if(at==previous.end() && previous.size()>=cgs1_wifi_private::detail::MAX_NETWORKS)
        return fail_(PlanError::CAPACITY);
      plan.decision.desired.reserve(previous.size()+(at==previous.end()?1:0));
      plan.decision.desired.push_back(network);
      for(auto old=previous.begin();old!=previous.end();++old)
        if(old!=at)plan.decision.desired.push_back(*old);
    }
    if(!cgs1_wifi_guard::valid(plan) || !scope_.current(plan) || !store.verify_unchanged() ||
        !source_.unchanged(baseline) || !scope_.current(plan) || !store.verify_unchanged())return fail_(PlanError::CHANGED);
    const auto final=source_.now();
    if(final<plan.created_ms || final>=plan.deadline_ms)return fail_(PlanError::CLOCK);
    if(!requested && plan.catalog_mode==cgs1_wifi_prepare::CatalogMode::CONNECTED) {
      // A stable joined COMPLETED/CURRENT association to the preferred SSID
      // needs no ADD/SELECT or flash rewrite on every native exec/boot. This
      // skip claims only an existing association, not a fresh DHCP receipt or
      // knowledge of the vendor's password. Exact binary SSID decoding avoids
      // confusing a literal escape with a different user's network.
      const auto&preferred=plan.decision.desired.front();std::string decoded;
      for(const auto&p:plan.original)if(p.current)
        saved_preferred_connected_=cgs1_wifi_scan::decode_ssid(p.ssid_text,decoded) &&
          decoded.size()==preferred.ssid_size &&
          !std::memcmp(decoded.data(),preferred.ssid.data(),preferred.ssid_size);
    }
    out=std::move(plan);return true;
    // The Store flock is released here. Preparation subsequently reacquires
    // and compares the complete baseline before either guardian arms it. This
    // result is not a lease, a fresh DHCP proof or permission for first SELECT.
  }
 private:
  Scope&scope_;Source source_;bool attempted_{false},saved_preferred_connected_{false};PlanError error_{PlanError::NONE};
  bool fail_(PlanError error){error_=error;return false;}
};
} // namespace cgs1_wifi_request

namespace cgs1_supervisor {
using NativeWifiPlanBuilder=cgs1_wifi_request::PlanBuilder<NativeWifiScope>;
// The boot builder has no user-request path. It classifies ONE stable actual
// capture and binds the selected mode plus exactly the saved ordered record.
using NativeBootWifiPlanBuilder=cgs1_wifi_request::PlanBuilder<NativeWifiScope,
  cgs1_wifi_request::NativeBootPlanSource,cgs1_wifi_prepare::CatalogMode::CONNECTED,true>;
// SOURCE-only compile target. No ordinary transaction/runtime calls this
// alias; FilePreparationAuthority still refuses UNASSOCIATED before arming.
using NativeUnassociatedWifiPlanBuilder=cgs1_wifi_request::PlanBuilder<NativeWifiScope,
  cgs1_wifi_request::NativeUnassociatedPlanSource,cgs1_wifi_prepare::CatalogMode::UNASSOCIATED>;
} // namespace cgs1_supervisor
