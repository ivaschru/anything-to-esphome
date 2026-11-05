#pragma once

// Transaction-bound PRE-COMMIT network evidence for a prepared/selected native
// candidate. Unlike the diagnostic CaptureProbe, a historical lease boolean
// is never a token: every observation drains the SAME live packet socket and
// rereads BOUND guardians/Store, DHCP owner, WPA association and kernel route.
// This class cannot SELECT, signal DHCP, commit Store or disarm recovery.
// Production types are fixed in native_wifi_forward.h; fixture types are only
// compile-time inputs to isolated tests, never runtime/API selectors.
#include "dhcp_capture_probe.h"
#include "gateway_echo.h"
#include "wifi_guard_plan.h"
#include <memory>

namespace cgs1_wifi_forward {
inline bool selected_catalog(const cgs1_wifi_guard::Plan&plan,
    const cgs1_wifi::SavedProfile&prepared,const cgs1_dhcp_lease::ProbeFence&actual,
    const std::vector<int>&restored={}) {
  if(actual.boot!=plan.boot_id || actual.daemon.process.pid!=long(plan.daemon_pid) ||
      actual.daemon.process.start!=plan.daemon_start || actual.daemon.socket_inode!=plan.socket_inode ||
      actual.association.state!="COMPLETED" || actual.association.network_id!=prepared.id ||
      actual.profiles.size()!=plan.original.size()+1)return false;
  for(const auto&old:plan.original) {
    if(old.id==prepared.id)return false;
    const auto at=std::find_if(actual.profiles.begin(),actual.profiles.end(),[&](const auto&p){return p.id==old.id;});
    // SELECT_NETWORK disables all other profiles. Their non-secret identity
    // must remain exact; restoring enabled flags belongs to later commit.
    const bool enabled=std::find(restored.begin(),restored.end(),old.id)!=restored.end();
    if((enabled && old.disabled) || at==actual.profiles.end() || at->ssid_text!=old.ssid_text || at->bssid!=old.bssid ||
        !at->flags_known || at->temporarily_disabled || at->current || at->disabled==enabled ||
        at->flags!=(enabled?"":"[DISABLED]"))return false;
  }
  const auto at=std::find_if(actual.profiles.begin(),actual.profiles.end(),[&](const auto&p){return p.id==prepared.id;});
  return at!=actual.profiles.end() && at->ssid_text==prepared.ssid_text && at->bssid==prepared.bssid &&
    at->flags_known && !at->temporarily_disabled && at->current && !at->disabled && at->flags=="[CURRENT]";
}

template<class Authority,class Preparation,class Backend=cgs1_dhcp_lease::ProbeBackend,
         class Capture=cgs1_dhcp_lease::PacketCapture<>,class Socket=cgs1_gateway::Echo<>>
class Connectivity {
 public:
  Connectivity(Authority&authority,const Preparation&prepared):authority_(authority),prepared_(prepared){}
  bool start() {
    if(attempted_)return active_ && !failed_; // No rearm or new generation.
    attempted_=true;
    const auto*profile=prepared_.prepared_profile();
    if(!profile || profile->id<0 || prepared_.candidate()!=profile->id || !profile->disabled ||
        profile->current || profile->temporarily_disabled || !profile->flags_known || profile->flags!="[DISABLED]")
      return fail_("forward_preparation_required");
    candidate_=*profile;plan_=&authority_.forward_plan();
    // Preserve the original short-circuit order, but retain the precise
    // failed read. A generic CONNECTIVITY failure cannot distinguish a
    // revoked authority from a transient STATUS/catalog read on the board.
    // Labels are fixed source strings; no SSID, key or control reply is logged.
    if(!cgs1_wifi_guard::valid(*plan_))return fail_("forward_plan_invalid");
    if(!authority_.forward_current(candidate_.id))return fail_("forward_initial_authority");
    if(!backend_.prepare())return fail_("forward_initial_dhcp_owner");
    if(!backend_.read(baseline_))return fail_("forward_initial_association_read");
    if(!selected_catalog(*plan_,candidate_,baseline_))return fail_("forward_initial_catalog");
    const auto now=backend_.now();const auto view=backend_.ipv4();
    if(!now || now<plan_->created_ms || now>=plan_->deadline_ms || !view.verified ||
        !view.up || !view.running || view.index<=0)return fail_("forward_interface_or_deadline");
    generation_=now;last_ms_=now;deadline_=plan_->deadline_ms;
    if(!witness_.arm(generation_,view.index,now,deadline_) || !capture_.open(generation_,deadline_))
      return fail_("forward_capture_open_refused");
    active_=true;
    return fence_(); // Reads after bind cannot outlive the absolute deadline.
  }
  cgs1_wifi_switch::Observation observe() {
    cgs1_wifi_switch::Observation out;
    if(!active_ || failed_ || !fence_())return out;
    const bool drained=drain_();
    if(!fence_())return out;
    // A NAK/release may still be queued behind the eight-frame budget. Yield
    // and drain it on the next call before granting ANY observation.
    if(!drained)return out;
    const auto view=backend_.ipv4();const auto now=backend_.now();
    if(!clock_(now))return out;
    if(socket_ && !cgs1_gateway::same_view(socket_->view(),view)) {
      fail_("forward_gateway_view_changed");return out;
    }
    if(echo_ready_ && (!echo_observed_ || now<echo_observed_)) {
      fail_("forward_gateway_clock_invalid");return out;
    }
    if(!witness_.matches(view,generation_,now))return out;
    if(!socket_ || (echo_ready_ && now-echo_observed_>=7500)) {
      // Refresh only a PREVIOUSLY ACKNOWLEDGED probe, never retry an ambiguous
      // send or missing reply. At most 16 fixed Echo requests fit in 120 s.
      if(echo_attempts_>=16){fail_("forward_echo_budget");return out;}
      socket_=std::make_unique<Socket>();echo_ready_=false;++echo_attempts_;
      if(!socket_->start() || !cgs1_gateway::same_view(socket_->view(),view) || !fence_()) {
        fail_("forward_gateway_start_or_fence");return out;
      }
    }
    const auto reply=socket_->poll();
    if(reply==cgs1_gateway::EchoResult::FAILED){fail_("forward_gateway_reply_refused");return out;}
    if(reply==cgs1_gateway::EchoResult::WAITING)return out;
    echo_ready_=true;echo_observed_=socket_->observed_ms();
    // Even an authenticated API click needs a fresh local proof. The network
    // may have changed while the last Echo/control read was in progress.
    if(!fence_() || !drain_())return out;
    const auto kernel=backend_.ipv4();const auto final=backend_.now();
    if(!clock_(final) || !echo_observed_ || final<echo_observed_ || final-echo_observed_>10000 ||
        !cgs1_gateway::same_view(socket_->view(),kernel) || !witness_.matches(kernel,generation_,final))return out;
    out.verified=true;out.completed=true;out.id=candidate_.id;out.ipv4=cgs1_ipv4::address_text(kernel.address);
    out.lease_generation=generation_;out.lease_current=true;out.route_bound=true;out.gateway_reachable=true;
    return out;
  }
  void stop(){attempted_=true;active_=false;witness_.invalidate();capture_.close();if(socket_)socket_->close();}
  bool failed()const{return failed_;}bool active()const{return active_;}
  uint64_t generation()const{return generation_;}uint64_t deadline()const{return deadline_;}
  unsigned echo_attempts()const{return echo_attempts_;}
  const std::string&error()const{return error_;}
  bool bound_to(const Authority&authority,int candidate)const {
    return &authority==&authority_ && active_ && !failed_ && candidate==candidate_.id;
  }
  bool current_binding(const cgs1_net_trial::ProcessIdentity&owner) {
    // Used ONLY by the separately guarded one-shot native DHCP refresh.
    // This checks ownership/association/deadline, not a historical lease flag.
    return active_ && !failed_ && backend_.owner_matches(owner) && fence_() && drain_() && clock_(backend_.now());
  }
  bool lease_without_gateway() {
    // Suppress an unnecessary refresh as soon as a live REQUEST/ACK lease is
    // established, even while Echo is still pending. This narrower result is
    // NEVER sufficient for commit; observe() adds the independent gateway.
    if(!active_ || failed_ || !fence_() || !drain_())return false;
    const auto view=backend_.ipv4();const auto now=backend_.now();
    return clock_(now) && witness_.matches(view,generation_,now);
  }
  bool accept_restored_fallback(int id) {
    // Only the ORIGINAL enabled flags may change, one acknowledged no-connect
    // restoration at a time. SSID/BSSID/daemon/association/owner remain exact.
    // This method reads the actual result; it accepts no caller success flag.
    if(!active_ || failed_ || !plan_ || !echo_ready_ || !authority_.forward_current(candidate_.id))return false;
    const auto old=std::find_if(plan_->original.begin(),plan_->original.end(),[&](const auto&p){return p.id==id;});
    if(old==plan_->original.end() || old->disabled || id==candidate_.id ||
        std::find(restored_.begin(),restored_.end(),id)!=restored_.end())return false;
    auto expected=baseline_;auto at=std::find_if(expected.profiles.begin(),expected.profiles.end(),[&](const auto&p){return p.id==id;});
    if(at==expected.profiles.end() || !at->disabled || at->current || at->flags!="[DISABLED]")return false;
    at->disabled=false;at->flags.clear();cgs1_dhcp_lease::ProbeFence actual;
    const auto view=backend_.ipv4();const auto now=backend_.now();
    if(!clock_(now) || !backend_.read(actual) || !cgs1_dhcp_lease::same_probe_fence(expected,actual) || !drain_())return false;
    const auto final_view=backend_.ipv4();const auto final=backend_.now();
    if(!clock_(final) || !cgs1_gateway::same_view(view,final_view) ||
        !cgs1_gateway::same_view(socket_->view(),final_view) || final<echo_observed_ || final-echo_observed_>10000 ||
        !witness_.matches(final_view,generation_,final))return false;
    baseline_=std::move(actual);restored_.push_back(id);return fence_();
  }
  bool fallback_flags_restored()const {
    if(!active_ || failed_ || !plan_)return false;
    for(const auto&old:plan_->original) {
      const auto at=std::find_if(baseline_.profiles.begin(),baseline_.profiles.end(),[&](const auto&p){return p.id==old.id;});
      if(at==baseline_.profiles.end() || at->current || at->disabled!=old.disabled)return false;
    }
    return true; // observe() must still freshly verify before persistence.
  }
 private:
  Authority&authority_;const Preparation&prepared_;const cgs1_wifi_guard::Plan*plan_{nullptr};
  cgs1_wifi::SavedProfile candidate_;Backend backend_;Capture capture_;
  std::vector<int>restored_;
  cgs1_dhcp_lease::ProbeFence baseline_;cgs1_dhcp_lease::Witness witness_;std::unique_ptr<Socket>socket_;
  bool attempted_{false},active_{false},failed_{false},echo_ready_{false};unsigned echo_attempts_{0};
  uint64_t generation_{0},last_ms_{0},deadline_{0},echo_observed_{0};std::string error_;
  bool fail_(const char*why){failed_=true;error_=why;stop();return false;}
  bool clock_(uint64_t now) {
    if(!now || now<last_ms_ || now>=deadline_)return fail_("forward_clock_or_deadline");
    last_ms_=now;return true;
  }
  bool drain_() {
    // Bounded work cannot starve the native lease pulse. Only EMPTY proves
    // the queue was drained; reaching the budget yields without readiness.
    for(unsigned n=0;n<8;++n) {
      cgs1_dhcp_lease::Captured frame;const auto result=capture_.next(frame);
      if(result==cgs1_dhcp_lease::CaptureResult::FAILED)return fail_("forward_capture_loss_or_metadata");
      if(result==cgs1_dhcp_lease::CaptureResult::EMPTY)return true;
      if(result==cgs1_dhcp_lease::CaptureResult::MESSAGE)
        witness_.observe(frame.message,frame.generation,frame.interface_index,frame.observed_ms,frame.request_earliest_ms);
    }
    return false;
  }
  bool fence_() {
    if(!active_ || !clock_(backend_.now()))return false;
    cgs1_dhcp_lease::ProbeFence current;
    if(!authority_.forward_current(candidate_.id))return fail_("forward_fence_authority");
    if(!backend_.read(current))return fail_("forward_fence_association_read");
    if(!cgs1_dhcp_lease::same_probe_fence(baseline_,current))return fail_("forward_fence_changed");
    if(!selected_catalog(*plan_,candidate_,current,restored_))return fail_("forward_fence_catalog");
    return clock_(backend_.now());
  }
};
} // namespace cgs1_wifi_forward
