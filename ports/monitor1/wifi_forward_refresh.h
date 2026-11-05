#pragma once

// One DHCP refresh of an already SELECTed, currently COMPLETED native candidate.
// No old-gateway requirement: that gateway may belong to the departed network.
// Instead, the SAME authority object must still hold dual BOUND guardians,
// frozen writers and UNCOMMITTED Store, and the candidate's LIVE packet capture
// must bind the same owner/association/absolute deadline. After ACK, connectivity
// independently proves the NEW kernel route and NEW gateway. Signal delivery
// alone never grants commit authority; no process restart/release is available.
#include "dhcp_renew_once.h"
#include "wifi_forward_select.h"
#include "wifi_forward_connectivity.h"

namespace cgs1_wifi_forward {
enum class RefreshResult {REFUSED,LEASE_ALREADY_OBSERVED,QUEUED,FAILED_CONSUMED};
template<class Authority,class Selection,class Connection,class System=cgs1_dhcp_renew::Kernel>
class Refresh {
 public:
  Refresh(Authority&authority,const Selection&selection,Connection&connection):
    authority_(authority),selection_(selection),connection_(connection){}
  RefreshResult start() {
    if(attempted_)return result_; // No re-admission or signal on another click.
    attempted_=true;const auto candidate=selection_.target();
    if(candidate<0 || !authority_.claim_forward(Step::REFRESH,candidate) ||
        !selection_.sent() || selection_.result()==cgs1_wifi_switch::Reply::REFUSED ||
        !selection_.bound_to(authority_) || !connection_.bound_to(authority_,candidate) ||
        !authority_.forward_current(candidate))return result_;
    // Automatic DHCP activity may have already completed after association.
    // Do not perturb it just to manufacture another proof for this adapter.
    if(connection_.lease_without_gateway()) {
      result_=RefreshResult::LEASE_ALREADY_OBSERVED;return result_;
    }
    if(connection_.failed() || !connection_.active())return result_;
    const auto inventory=System::inventory();
    if(!inventory.scan_complete || inventory.clients.size()!=1 || !inventory.executable.verified ||
        inventory.executable.sha256!=cgs1_dhcp_wait::REVIEWED_SHA ||
        !inventory.executable.filesystem_read_only || !inventory.vendor_launcher_matches)return result_;
    owner_=inventory.clients[0].process;
    if(!connection_.current_binding(owner_))return result_;
    if(connection_.lease_without_gateway()) {
      result_=RefreshResult::LEASE_ALREADY_OBSERVED;return result_;
    }
    if(!authority_.forward_current(candidate))return result_;
    // As in the physically verified stock test, BOUND by itself is unsafe.
    // Require exact reviewed BusyBox/libc, positive BASE and select INPUT,
    // quiet handlers/double snapshots, and a final same-birth check. No more
    // potentially blocking control-socket I/O follows this state observation.
    const auto begin=System::now();const auto state=System::state();const auto now=System::now();
    if(!state.verified || !state.base_timeout_verified || state.state!=2 ||
        state.owner.pid!=owner_.pid || state.owner.start!=owner_.start ||
        state.owner.executable!=owner_.executable || !begin || now<begin || now-begin>2000 ||
        !connection_.active() || connection_.failed() || now>=connection_.deadline() || !System::same(owner_))return result_;
    const auto final=System::now();
    if(final<now || final-begin>2000 || final>=connection_.deadline())return result_;
    signal_attempted_=true;system_error_=System::queue(owner_.pid);
    result_=system_error_?RefreshResult::FAILED_CONSUMED:RefreshResult::QUEUED;
    return result_;
  }
  bool attempted()const{return attempted_;}bool signal_attempted()const{return signal_attempted_;}
  int system_error()const{return system_error_;}RefreshResult result()const{return result_;}
 private:
  Authority&authority_;const Selection&selection_;Connection&connection_;
  cgs1_net_trial::ProcessIdentity owner_;
  bool attempted_{false},signal_attempted_{false};int system_error_{0};RefreshResult result_{RefreshResult::REFUSED};
};
} // namespace cgs1_wifi_forward
