#pragma once

// Join the REAL runner capability/cache authority with the REAL fixed WPA
// transport and private durable decision. No arbitrary Backend or remote flag
// can be selected here. The private parent is the canonical inode captured by
// this guardian before native started; no caller path/FD or credentials exist.
// This helper never resumes stock or bypasses the generic effects receipt gate.
#include "supervisor_wifi_recovery_authority.h"
#include "wifi_guard_recovery_control.h"
#include "wifi_unassociated_recovery.h"
#include "supervisor_wifi_recovery_receipt.h"
#include <memory>

namespace cgs1_supervisor {
class RunnerWifiRecovery {
 public:
  using Result=cgs1_wifi_recovery::Result;
  RunnerWifiRecovery(int runtime,const NetworkRecoveryWitness&witness,
      const RunnerWifiJournal&journal)
      :runtime_(runtime),witness_(witness),journal_(journal){}
  RunnerWifiRecovery(const RunnerWifiRecovery&)=delete;
  RunnerWifiRecovery&operator=(const RunnerWifiRecovery&)=delete;
  Result attempt() {
    if(consumed_)return Result::CONSUMED;
    consumed_=true;
    const auto*plan=journal_.cached_plan();if(!plan)return Result::REFUSED;
    struct Parent {int fd;~Parent(){if(fd>=0)::close(fd);}} parent{journal_.duplicate_private_parent()};
    if(parent.fd<0)return Result::REFUSED;
    RunnerWifiRecoveryAuthority authority(runtime_,witness_,journal_);
    if(journal_.retirement_active()) {
      // Old binding ACKs may already have been pruned after both guardians
      // retained their snapshots. A retirement actor has no rollback route:
      // keep only the freshly verified exact canonical COMMITTED decision.
      // No control endpoint was opened and no WPA command can be replayed.
      result_=authority.recovery_exclusive(*plan) && journal_.retirement_committed()?
        Result::KEEP_COMMITTED:Result::REFUSED;
      return result_;
    }
    cgs1_wifi_recovery::ControlBackend backend(authority,parent.fd,*plan,journal_.bound_candidate());
    // The immutable journal chooses the rollback policy. A boot that had no
    // association has no proven old network to SELECT: remove its candidate
    // and restore configuration flags only. Never infer this mode from an
    // error in the connected recovery path or from a current socket reply.
    Result result;
    if(plan->catalog_mode==cgs1_wifi_prepare::CatalogMode::UNASSOCIATED) {
      cgs1_wifi_recovery::UnassociatedRecovery recovery(backend);
      result=recovery.attempt(*plan,journal_.bound_candidate());
    }else {
      cgs1_wifi_recovery::Recovery recovery(backend);
      result=recovery.attempt(*plan,journal_.bound_candidate());
    }
    // A leaked/uncertain local endpoint is not a completed recovery receipt.
    // After a lost command ACK a NEW actor must reconcile the catalog; this
    // instance is consumed and cannot blindly repeat SELECT/ENABLE/REMOVE.
    result_=backend.close()?result:Result::READ_UNAVAILABLE;
    return result_;
  }
  std::unique_ptr<NetworkRecoveryReceipt> receipt()const {
    if(!consumed_ || (result_!=Result::CONFIGURATION_RESTORED && result_!=Result::KEEP_COMMITTED))return {};
    return std::unique_ptr<NetworkRecoveryReceipt>(new RunnerWifiRecoveryReceipt(runtime_,witness_,journal_,result_));
  }
 private:
  int runtime_;const NetworkRecoveryWitness&witness_;const RunnerWifiJournal&journal_;
  bool consumed_{false};
  Result result_{Result::REFUSED};
};
} // namespace cgs1_supervisor
