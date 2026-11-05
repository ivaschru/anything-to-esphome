#pragma once

// Waiting for authentication must not consume Connectivity::start() while
// STATUS still says SCANNING/ASSOCIATING. This fixed read-only gate supplies
// no lease proof and cannot retry SELECT or alter the transaction deadline.
#include "wifi_guard_plan.h"
#include "wifi_daemon_inspect.h"
namespace cgs1_wifi_forward {
enum class AssociationResult {WAITING,COMPLETED,FAILED};
template<class Authority,class Preparation>class Association {
 public:
  Association(Authority&authority,const Preparation&prepared):authority_(authority),prepared_(prepared){}
  AssociationResult poll() {
#if defined(__linux__)
    const auto id=prepared_.candidate();const auto&plan=authority_.forward_plan();
    if(id<0 || !authority_.forward_current(id))return AssociationResult::FAILED;
    const auto before=cgs1_wifi::inspect_daemon(0);cgs1_wifi::ReadOnlyControl control;cgs1_wifi::Status status;
    if(!same_(before,plan) || !control.open(0))return AssociationResult::FAILED;
    const bool read=cgs1_wifi::read_status(control,status);const bool closed=control.close();
    if(!read || !closed || !same_(cgs1_wifi::inspect_daemon(0),plan) || !authority_.forward_current(id))
      return AssociationResult::FAILED;
    // The old CURRENT may remain observable briefly after the one SELECT.
    // Authentication failures also remain bounded waiting: there is no text
    // log parsing or invented "wrong password" diagnosis in this adapter.
    return status.state=="COMPLETED" && status.network_id==id
      ?AssociationResult::COMPLETED:AssociationResult::WAITING;
#else
    return AssociationResult::FAILED;
#endif
  }
 private:
  Authority&authority_;const Preparation&prepared_;
  static bool same_(const cgs1_wifi::DaemonInspection&actual,const cgs1_wifi_guard::Plan&plan) {
    return actual.verified && actual.process.pid==long(plan.daemon_pid) &&
      actual.process.start==plan.daemon_start && actual.socket_inode==plan.socket_inode;
  }
};
} // namespace cgs1_wifi_forward
