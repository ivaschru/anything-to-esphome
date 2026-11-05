#pragma once

// Original-network recovery AFTER the native writer has died and stock has
// resumed. This is intentionally separate from native-frozen forward refresh
// and from the remote diagnostic SIGUSR1 API. A real ReturnedFullSession,
// exact uncommitted journal/Store and a CURRENT original association are
// required. There is no caller PID, signal, network ID, pathname or command.
//
// Stock remains running. Its own Wi-Fi action can race these observations:
// that revokes attribution instead of triggering SELECT, a restart or another
// signal. The sole possible mutation is the reviewed DHCP client's normal
// BOUND renewal signal, after fresh positive-timer/quiet-handler checks. This
// is not an atomic network transaction, a durable decision or commit authority.
#include "post_return_wifi_link.h"
#include "dhcp_renew_once.h"

namespace cgs1_returned_network {
enum class Open {ACTIVE,SKIPPED,REFUSED};
enum class Renew {WAITING,QUEUED,REFUSED,FAILED_CONSUMED};
enum class State {UNOPENED,WAITING_ORIGINAL,WAITING_LEASE,CHECKING_GATEWAY,READY,SKIPPED,REFUSED,EXPIRED};
enum class Error {NONE,OPEN,CLOCK_OR_SCOPE,CAPTURE_START,CAPTURE_POLL,GATEWAY_START,GATEWAY_POLL,RENEW};
enum class Check {NONE,OPEN,INVENTORY,ORIGINAL,CAPTURE_SCOPE,CAPTURE_OPEN,CAPTURE_OWNER,CAPTURE_ORIGINAL,RENEW_BINDING,RENEW_STATE,RENEW_FINAL,RENEW_SEND};

// Compile-time test seams do not cross the runtime boundary. Backend below
// permanently chooses the real observation/capture/socket/kernel classes.
template<class Original=cgs1_returned_wifi::Observation,
         class Capture=cgs1_dhcp_lease::CaptureProbe<>,
         class Gateway=cgs1_gateway::Probe<>,class System=cgs1_dhcp_renew::Kernel>
class BoundBackend final {
 public:
  explicit BoundBackend(cgs1_supervisor::ReturnedFullSession scope):original_(std::move(scope)){}
  BoundBackend(const BoundBackend&)=delete;BoundBackend&operator=(const BoundBackend&)=delete;
  ~BoundBackend(){stop();}
  Open open() {
    check_=Check::OPEN;
    observation_opened_=original_.open();
    if(!observation_opened_)return Open::REFUSED;
    const auto state=original_.state();
    return state==cgs1_returned_wifi::State::NO_TRANSACTION ||
      state==cgs1_returned_wifi::State::COMMITTED?Open::SKIPPED:Open::ACTIVE;
  }
  uint64_t now()const{return System::now();}
  void poll_observation(){original_.poll();}
  const Original&observation()const{return original_;}
  bool observation_opened()const{return observation_opened_;}
  bool live()const{return original_.live_scope();}
  bool original_ready() {
    check_=Check::INVENTORY;
    const auto inventory=System::inventory();
    if(!inventory.scan_complete || inventory.clients.size()!=1 ||
        !inventory.executable.verified || !inventory.executable.filesystem_read_only ||
        inventory.executable.sha256!=cgs1_dhcp_wait::REVIEWED_SHA ||
        !inventory.vendor_launcher_matches)return false;
    const auto owner=inventory.clients[0].process;
    check_=Check::ORIGINAL;
    if(!original_.original_binding(owner))return false;
    owner_=owner;return true;
  }
  bool start_capture() {
    // The capture owns its own baseline and fixed deadline. Recheck that it
    // describes the journal's ORIGINAL network, not a concurrent stock choice.
    check_=Check::CAPTURE_SCOPE;
    capture_admission_waiting_=false;
    if(!live())return false;
    if(!original_.original_binding(owner_)) {
      // No capture has been attempted and no signal/packet has been sent.
      // A DHCP-owner/association snapshot can disappear between the two
      // adjacent read-only checks after stock resumes its own writers. Treat
      // ONLY that still-live, non-revoked admission gap as bounded waiting.
      // The next poll starts again with the complete inventory/original
      // checks; it cannot reuse owner_ as authority or extend the60s scope.
      // A revoked stock/journal/scope remains a terminal refusal, as does
      // every failure after calling capture_.start() below.
      capture_admission_waiting_=live() &&
        (original_.state()==cgs1_returned_wifi::State::WAITING ||
         original_.state()==cgs1_returned_wifi::State::ASSOCIATED) &&
        original_.error()==cgs1_returned_wifi::Error::NONE;
      if(capture_admission_waiting_)++capture_admission_waits_;
      return false;
    }
    check_=Check::CAPTURE_OPEN;
    if(!capture_.start())return false;
    check_=Check::CAPTURE_OWNER;
    if(!capture_.current_binding(owner_))return false;
    check_=Check::CAPTURE_ORIGINAL;
    return original_.original_binding(owner_);
  }
  void poll_capture(){capture_.poll();}
  bool capture_failed()const{return capture_.failed() || !capture_.active();}
  bool current_lease() {
    return live() && capture_.current_lease(owner_) && original_.original_binding(owner_) &&
      capture_.current_lease(owner_);
  }
  Renew renew() {
    if(signal_consumed_)return signal_queued_?Renew::QUEUED:Renew::FAILED_CONSUMED;
    check_=Check::RENEW_BINDING;
    if(!live() || !capture_.current_binding(owner_) || !original_.original_binding(owner_))
      return Renew::REFUSED;
    // Do not manufacture a second lease if natural DHCP already supplied one.
    if(capture_.current_lease(owner_))return Renew::WAITING;
    // All potentially blocking control/Store reads precede this final exact
    // state observation. A non-BOUND or unverified client is only observed;
    // it may already be renewing, requesting or starting after stock return.
    check_=Check::RENEW_STATE;
    const auto began=now();const auto state=System::state();const auto checked=now();
    if(!state.verified || !state.base_timeout_verified || state.state!=2 ||
        state.owner.pid!=owner_.pid || state.owner.start!=owner_.start ||
        state.owner.executable!=owner_.executable || !began || checked<began ||
        checked-began>2000)return Renew::WAITING;
    check_=Check::RENEW_FINAL;
    if(!live() || !capture_.active() || capture_.failed() || checked>=capture_.deadline() ||
        !System::same(owner_))return Renew::REFUSED;
    if(!live())return Renew::REFUSED;
    const auto final=now();
    if(final<checked || final-began>2000 || final>=capture_.deadline())return Renew::REFUSED;
    // Consume BEFORE kill(), including ESRCH/uncertain delivery. The enclosing
    // live coordinator can create this adapter once only; a new bridge cannot
    // reopen an old returned scope. No remote START or retry API is provided.
    check_=Check::RENEW_SEND;
    signal_consumed_=true;system_error_=System::queue(owner_.pid);
    signal_queued_=system_error_==0;
    return signal_queued_?Renew::QUEUED:Renew::FAILED_CONSUMED;
  }
  bool start_gateway(){return current_lease() && gateway_.start();}
  void poll_gateway(){gateway_.poll();}
  bool gateway_failed()const{return gateway_.failed() || (gateway_.finished() && !gateway_.reachable());}
  bool ready() {
    if(!gateway_.reachable() || !current_lease() || !gateway_.recent_binding(owner_))return false;
    // Drain again after blocking control reads: a queued NAK/loss must revoke
    // the old ACK before READY can be recorded. No more packets are emitted.
    capture_.poll();
    return current_lease() && live();
  }
  void stop(){capture_.stop();gateway_.stop();}
  bool signal_attempted()const{return signal_consumed_;}
  bool signal_queued()const{return signal_queued_;}
  int system_error()const{return system_error_;}
  // Fixed labels/counters only. These existing diagnostic errors contain no
  // packet payload, hostname, SSID, key, argv, environment or memory bytes.
  Check last_check()const{return check_;}
  bool capture_opened()const{return capture_.opened();}
  bool capture_broken()const{return capture_.failed();}
  const std::string&capture_error()const{return capture_.error();}
  const std::string&packet_error()const{return capture_.capture_error();}
  bool capture_admission_waiting()const{return capture_admission_waiting_;}
  unsigned capture_admission_waits()const{return capture_admission_waits_;}
  auto original_state()const{return original_.state();}
  auto original_error()const{return original_.error();}
  auto original_binding_check()const{return original_.binding_check();}
 private:
  Original original_;Capture capture_;Gateway gateway_;
  cgs1_net_trial::ProcessIdentity owner_;
  bool observation_opened_{false},signal_consumed_{false},signal_queued_{false};int system_error_{0};
  Check check_{Check::NONE};
  bool capture_admission_waiting_{false};unsigned capture_admission_waits_{0};
};
using Backend=BoundBackend<>;

// Compile-time fixtures exercise sequencing/faults only. Production fixes
// Backend above; no configuration, IPC or YAML can substitute a backend.
template<class Transport=Backend>class Recovery final {
 public:
  explicit Recovery(Transport&transport):transport_(transport){}
  ~Recovery(){transport_.stop();}
  bool open() {
    if(attempted_)return state_!=State::UNOPENED && state_!=State::REFUSED;
    attempted_=true;const auto result=transport_.open();
    if(result==Open::SKIPPED){state_=State::SKIPPED;transport_.stop();return true;}
    if(result!=Open::ACTIVE)return fail_(Error::OPEN);
    last_=transport_.now();
    if(!last_ || !transport_.live())return fail_(Error::CLOCK_OR_SCOPE);
    state_=State::WAITING_ORIGINAL;return true;
  }
  void poll() {
    if(terminal_())return;
    const auto now=transport_.now();
    if(!now || now<last_ || !transport_.live()) {expire_();return;}
    // Packet collection is nonblocking; expensive admission/renewal attempts
    // are paced to one per second. The real scope's original 60-second window
    // bounds every phase, including potentially slow Store/control operations.
    if(state_!=State::WAITING_ORIGINAL) {
      transport_.poll_capture();
      // Packet loss/closure revokes evidence immediately, even between the
      // paced one-second admission checks and while an echo is outstanding.
      if(transport_.capture_failed()){fail_(Error::CAPTURE_POLL);return;}
    }
    if(state_==State::CHECKING_GATEWAY) {
      transport_.poll_gateway();
      if(transport_.gateway_failed()){fail_(Error::GATEWAY_POLL);return;}
      if(transport_.ready()) {
        const auto finished=transport_.now();
        if(!finished || finished<now || !transport_.live()) {
          expire_();return;
        }
        state_=State::READY;ready_at_=finished;transport_.stop();return;
      }
    }
    if(last_work_ && now-last_work_<1000){last_=now;return;}
    last_=now;last_work_=now;
    if(state_==State::WAITING_ORIGINAL) {
      if(!transport_.original_ready())return;
      if(!transport_.start_capture()) {
        if(transport_.capture_admission_waiting())return;
        fail_(Error::CAPTURE_START);return;
      }
      state_=State::WAITING_LEASE;return;
    }
    if(state_==State::CHECKING_GATEWAY)return;
    if(transport_.current_lease()) {
      if(!transport_.start_gateway()){fail_(Error::GATEWAY_START);return;}
      state_=State::CHECKING_GATEWAY;return;
    }
    if(renew_attempted_)return;
    const auto result=transport_.renew();
    if(result==Renew::WAITING)return;
    renew_attempted_=true;
    if(result!=Renew::QUEUED)fail_(Error::RENEW);
  }
  State state()const{return state_;}
  Error error()const{return error_;}
  bool renew_attempted()const{return renew_attempted_;}
  uint64_t ready_at()const{return ready_at_;}
  // READY is historical evidence at ready_at(), never a current commit or
  // receipt getter. Sockets close immediately; no authority outlives capture.
 private:
  Transport&transport_;State state_{State::UNOPENED};Error error_{Error::NONE};
  bool attempted_{false},renew_attempted_{false};uint64_t last_{0},last_work_{0},ready_at_{0};
  bool terminal_()const {
    return state_==State::UNOPENED || state_==State::READY || state_==State::SKIPPED ||
      state_==State::REFUSED || state_==State::EXPIRED;
  }
  bool fail_(Error error){error_=error;state_=State::REFUSED;transport_.stop();return false;}
  void expire_(){error_=Error::CLOCK_OR_SCOPE;state_=State::EXPIRED;transport_.stop();}
};
} // namespace cgs1_returned_network
