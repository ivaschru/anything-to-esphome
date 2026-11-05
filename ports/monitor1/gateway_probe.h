#pragma once
// The diagnostic's owner/association fence is independent of Echo's kernel
// route/interface fence. A successful result is historical and never a token
// for a later Wi-Fi commit. Repeated API START reconciles without resending.
#include "dhcp_capture_probe.h"
#include "gateway_echo.h"
namespace cgs1_gateway {
template<class Backend=cgs1_dhcp_lease::ProbeBackend,class Socket=Echo<>>class Probe {
 public:
  bool start() {
    if(attempted_)return opened_ && !failed_;
    attempted_=true;
    if(!backend_.prepare() || !backend_.read(baseline_))return fail_("gateway_initial_owner_or_association_unavailable");
    last_ms_=backend_.now();deadline_=last_ms_+2000;
    if(!last_ms_ || !socket_.start())return fail_("gateway_echo_start_refused");
    opened_=true;cgs1_dhcp_lease::ProbeFence after;
    if(!backend_.read(after) || !cgs1_dhcp_lease::same_probe_fence(baseline_,after))return fail_("gateway_association_changed_during_send");
    if(!clock_())return false;
    active_=true;return true;
  }
  void poll() {
    if(!active_)return;
    if(!clock_())return;
    cgs1_dhcp_lease::ProbeFence current;
    if(!backend_.read(current) || !cgs1_dhcp_lease::same_probe_fence(baseline_,current)) {fail_("gateway_owner_or_association_changed");return;}
    if(!clock_())return;
    const auto result=socket_.poll();
    if(result==EchoResult::FAILED){fail_("gateway_echo_failed");return;}
    if(result==EchoResult::WAITING)return;
    // The socket verified the wire reply, but a concurrent Wi-Fi change must
    // still prevent attributing that reply to the baseline association.
    if(!backend_.read(current) || !cgs1_dhcp_lease::same_probe_fence(baseline_,current) ||
        !same_view(socket_.view(),backend_.ipv4())){fail_("gateway_final_association_or_route_changed");return;}
    if(!clock_())return;
    reachable_=true;observed_ms_=socket_.observed_ms();stop();
  }
  void stop(){attempted_=true;active_=false;finished_=true;socket_.close();}
  bool attempted()const{return attempted_;}bool opened()const{return opened_;}bool active()const{return active_;}
  bool finished()const{return finished_;}bool failed()const{return failed_;}bool reachable()const{return reachable_;}
  bool sent()const{return socket_.sent();}uint64_t observed_ms()const{return observed_ms_;}
  const std::string&error()const{return error_;}const std::string&socket_error()const{return socket_.error();}
  int system_error()const{return socket_.system_error();}
  bool recent_binding(const cgs1_net_trial::ProcessIdentity&owner)const {
    // A recent Echo alone is insufficient. Reread the same association,
    // owner, interface/address/route and keep the fixed freshness cap after
    // the possibly blocking control reads. No new Echo is sent here.
    const auto before=backend_.now();cgs1_dhcp_lease::ProbeFence current;
    if(!reachable_ || failed_ || !observed_ms_ || before<observed_ms_ || before-observed_ms_>10000 ||
        !backend_.owner_matches(owner) || !backend_.read(current) ||
        !cgs1_dhcp_lease::same_probe_fence(baseline_,current) ||
        !same_view(socket_.view(),backend_.ipv4()))return false;
    const auto after=backend_.now();return after>=before && after-observed_ms_<=10000;
  }
 private:
  Backend backend_;Socket socket_;cgs1_dhcp_lease::ProbeFence baseline_;
  bool attempted_{false},opened_{false},active_{false},finished_{false},failed_{false},reachable_{false};
  uint64_t last_ms_{0},deadline_{0},observed_ms_{0};std::string error_;
  bool fail_(const char*error){failed_=true;error_=error;stop();return false;}
  bool clock_(){const auto now=backend_.now();if(!now || now<last_ms_ || now>=deadline_)return fail_("gateway_clock_or_deadline");last_ms_=now;return true;}
};
} // namespace cgs1_gateway
