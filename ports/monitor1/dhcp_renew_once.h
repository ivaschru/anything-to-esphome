#pragma once

// One controlled diagnostic SIGUSR1, never release/restart/killall. The caller
// must independently authorize the physical test and save a host intent before
// calling its argument-free API. This object consumes its attempt BEFORE any
// gate, and a repeated API call only reconciles that SAME result. A fresh OTA
// or process restart is not permission to replay the host intent.
//
// This is not a Wi-Fi forward/commit adapter. It changes no WPA profile or
// configuration and never treats signal delivery as a DHCP ACK. The already
// armed passive capture must independently observe REQUEST -> ACK and the
// kernel address/route, including all of its queue-loss/association fences.
#include "dhcp_wait_inspect.h"
#include "gateway_probe.h"
#include <cerrno>
#include <csignal>

namespace cgs1_dhcp_renew {
struct Kernel {
  static auto inventory(){return cgs1_dhcp::inspect();}
  static auto state(){return cgs1_dhcp_wait::inspect();}
  static uint64_t now(){return cgs1_dhcp_lease::capture_now_ms();}
  static bool same(const cgs1_net_trial::ProcessIdentity&owner){return cgs1_net_trial::same_process(owner);}
  static int queue(int pid) {
#if defined(__linux__)
    errno=0;return ::kill(pid,SIGUSR1)==0?0:(errno?errno:EIO);
#else
    (void)pid;return ENOTSUP;
#endif
  }
};
// Compile-time injection is restricted to public isolated fixtures. The
// maintenance component always uses Backend<>; no runtime backend selector.
template<class Capture=cgs1_dhcp_lease::CaptureProbe<>,class Gateway=cgs1_gateway::Probe<>,class System=Kernel>
class Backend {
 public:
  Backend(Capture&capture,Gateway&gateway):
    capture_(capture),gateway_(gateway){}
  bool ready() {
    if(send_consumed_){error_="renew_signal_attempt_already_consumed";return false;}
    ready_=false;
    const auto inventory=System::inventory();
    if(!inventory.scan_complete || inventory.clients.size()!=1 || !inventory.executable.verified ||
        inventory.executable.sha256!=cgs1_dhcp_wait::REVIEWED_SHA ||
        !inventory.executable.filesystem_read_only || !inventory.vendor_launcher_matches) {
      error_="renew_exact_owner_required";return false;
    }
    owner_=inventory.clients[0].process;
    // Network/control checks precede the final state/timer read. Their
    // blocking I/O cannot silently stale a previously obtained state proof.
    if(!capture_.current_binding(owner_) || !gateway_.recent_binding(owner_)) {
      error_="renew_capture_and_recent_gateway_binding_required";return false;
    }
    ready_=true;return true;
  }
  bool send() {
    if(!ready_ || send_consumed_){error_="renew_preflight_or_single_attempt_required";return false;}
    send_consumed_=true;
#if defined(__linux__)
    const auto begin=System::now();
    const auto state=System::state();
    const auto now=System::now();
    if(!state.verified || !state.base_timeout_verified || state.owner.pid!=owner_.pid || state.owner.start!=owner_.start ||
        state.owner.executable!=owner_.executable || state.state!=2 || !begin || now<begin || now-begin>2000) {
      error_="renew_fresh_bound_positive_timer_required";return false;
    }
    // Only cached deadlines and a final proc birth/executable reread follow
    // the state proof; no more WPA/control socket requests are issued.
    // A vanished/changed process or expired capture consumes this attempt and
    // sends nothing. The unavoidable old-kernel PID race is minimized by the
    // final birth/executable reread; no caller chooses a PID or signal number.
    const auto echo=gateway_.observed_ms();
    if(!capture_.active() || capture_.failed() || now>=capture_.deadline() || !gateway_.reachable() ||
        !echo || now<echo || now-echo>10000 || !System::same(owner_)) {
      error_="renew_final_owner_or_deadline_changed";return false;
    }
    const auto final_now=System::now();
    if(final_now<now || final_now-begin>2000 || final_now>=capture_.deadline() || final_now-echo>10000) {
      error_="renew_final_clock_or_deadline_changed";return false;
    }
    signal_attempted_=true;
    const int result=System::queue(owner_.pid);system_error_=result;
    if(result){error_="renew_signal_result_refused_no_retry";return false;}
    return true;
#else
    error_="renew_verified_linux_required";return false;
#endif
  }
  bool signal_attempted()const{return signal_attempted_;}
  int system_error()const{return system_error_;}
  const std::string&error()const{return error_;}
  const cgs1_net_trial::ProcessIdentity&owner()const{return owner_;}
 private:
  Capture&capture_;Gateway&gateway_;
  cgs1_net_trial::ProcessIdentity owner_;
  bool ready_{false},send_consumed_{false},signal_attempted_{false};int system_error_{0};
  std::string error_;
};

template<class Transport>class OneShot {
 public:
  explicit OneShot(Transport&transport):transport_(transport){}
  bool start() {
    if(attempted_)return queued_; // Reconcile, never send a second signal.
    attempted_=true;
    if(!transport_.ready() || !transport_.send())return false;
    queued_=true;return true;
  }
  bool attempted()const{return attempted_;}bool queued()const{return queued_;}
 private:
  Transport&transport_;bool attempted_{false},queued_{false};
};
} // namespace cgs1_dhcp_renew
