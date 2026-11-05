#pragma once

// A vendor avahi publisher can inherit Qt's DRM master reference. Capture
// only its exact root/PID/start/exe/fixed argv while admitting the verified
// stock plan. Retire it while ORIGINAL STOCK IS STILL ALIVE AND STOPPED.
// If either guardian dies mid-retirement, recovery can resume that same GUI;
// stock is killed only after publisher death and a stock-only DRM inventory.
// This deliberately needs no new post-death discovery or broadened PID API.
#include "display_ownership.h"
#include "supervisor_process_tree.h"
#include "supervisor_client.h"

namespace cgs1_supervisor {
class PublisherRetirement {
 public:
  bool capture_or_validate(const cgs1_net_trial::StockInspection &stock) {
    if(!stock.verified)return false;
    std::vector<cgs1_net_trial::DisplayOwner> owners;
    // Use the same bounded, strictly clean snapshot as board admission.
    // A transient stock subprocess must exit naturally; it is never added
    // to known_, granted a signal, or mistaken for an allowed publisher.
    if(!cgs1_net_trial::DisplayMaintenance::handoff_inventory(stock,owners).empty())return false;
    if(captured_)return known_inventory_(owners,stock);
    std::vector<cgs1_net_trial::ProcessIdentity> candidate;
    for(const auto &owner:owners) {
      if(is_stock_(owner.process,stock))continue;
      // The fingerprinted CGS1 has one such publisher. Additional owners
      // are refused before STOP; a long kill loop cannot starve peer leases.
      if(candidate.size()>=1 || !cgs1_net_trial::vendor_publisher(owner.process) ||
         !root_birth_(owner.process))return false;
      candidate.push_back(owner.process);
    }
    known_=std::move(candidate);captured_=true;return true;
  }
  bool prepare_frozen_stock(const cgs1_net_trial::StockInspection &stock) {
    if(attempted_ || !captured_)return false;
    attempted_=true;
    for(unsigned role:{0U,1U,2U}) {
      const auto &expected=stock.processes[role];
      if(!cgs1_net_trial::same_process(expected))return false;
      const auto current=cgs1_net_trial::process_identity(expected.pid);
      if(current.state!='T' && current.state!='t')return false;
    }
    std::vector<cgs1_net_trial::DisplayOwner> owners;
    if(!cgs1_net_trial::DisplayMaintenance::handoff_inventory(stock,owners).empty() ||
       !known_inventory_(owners,stock))return false;
    for(const auto &publisher:known_) {
      if(!cgs1_net_trial::same_process(publisher))continue;
      if(!root_birth_(publisher) || !cgs1_net_trial::vendor_publisher(publisher) ||
         ::kill(pid_t(publisher.pid),SIGTERM))return false;
      if(!await_dead_(publisher,1000)) {
        if(!cgs1_net_trial::same_process(publisher) || !root_birth_(publisher) ||
           !cgs1_net_trial::vendor_publisher(publisher) || ::kill(pid_t(publisher.pid),SIGKILL) ||
           !await_dead_(publisher,2000))return false;
      }
    }
    if(!known_.empty())::usleep(500000);  // Old-kernel deferred fput, before stock KILL.
    if(!cgs1_net_trial::display_owners(owners))return false;
    for(const auto &owner:owners)if(!is_stock_(owner.process,stock))return false;
    return true;
  }
 private:
  bool captured_{false},attempted_{false};std::vector<cgs1_net_trial::ProcessIdentity> known_;
  static bool is_stock_(const cgs1_net_trial::ProcessIdentity &p,const cgs1_net_trial::StockInspection &s) {
    return p.pid==s.processes[0].pid && p.start==s.processes[0].start && p.executable==s.processes[0].executable;
  }
  bool known_inventory_(const std::vector<cgs1_net_trial::DisplayOwner> &owners,
                        const cgs1_net_trial::StockInspection &stock) const {
    for(const auto &owner:owners) {
      if(is_stock_(owner.process,stock))continue;
      const auto found=std::find_if(known_.begin(),known_.end(),[&](const auto &p) {
        return p.pid==owner.process.pid && p.start==owner.process.start && p.executable==owner.process.executable;
      });
      if(found==known_.end() || !root_birth_(owner.process) ||
         !cgs1_net_trial::vendor_publisher(owner.process))return false;
    }
    return true;
  }
  static bool await_dead_(const cgs1_net_trial::ProcessIdentity &publisher,uint64_t limit) {
    const auto started=clock_ms();if(!started)return false;
    while(clock_ms()>=started && clock_ms()-started<limit) {
      if(!cgs1_net_trial::same_process(publisher))return true;
      const auto actual=cgs1_net_trial::process_identity(publisher.pid);
      if(actual.state=='Z' || actual.state=='X')return true;
      ::usleep(1000);
    }
    return false;
  }
  static bool root_birth_(const cgs1_net_trial::ProcessIdentity &publisher) {
    const auto actual=process_stamp(pid_t(publisher.pid));
    return actual.pid==publisher.pid && actual.start==publisher.start && actual.owner==0 &&
      (actual.state=='R' || actual.state=='S' || actual.state=='D');
  }
};
}  // namespace cgs1_supervisor
