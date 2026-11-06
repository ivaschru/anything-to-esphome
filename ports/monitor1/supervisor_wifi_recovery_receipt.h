#pragma once

// A live, noncopyable, native-death/flock-bound receipt. This is intentionally
// not an on-disk success flag: every use reopens the canonical private Store,
// rechecks the exact decision and (for rollback) the restored WPA catalog.
// No credentials, key hashes, caller directory or success boolean are exposed.
#include "supervisor_network_receipt.h"
#include "supervisor_wifi_recovery_authority.h"
#include "wifi_guard_recovery_control.h"
#include "wifi_unassociated_recovery.h"

namespace cgs1_supervisor {
class RunnerWifiRecovery;
class RunnerWifiRecoveryReceipt final:public NetworkRecoveryReceipt {
 public:
  ~RunnerWifiRecoveryReceipt()override{if(runtime_>=0)::close(runtime_);}
  bool verify_for(int runtime,const cgs1_net_trial::StockInspection&stock)const override {
    struct stat held{},supplied{};
    if(runtime_<0 || ::fstat(runtime_,&held) || ::fstat(runtime,&supplied) ||
        held.st_dev!=supplied.st_dev || held.st_ino!=supplied.st_ino ||
        !witness_.valid_for_runtime(runtime_) || !journal_.matches_owner_plan(stock))return false;
    const auto*plan=journal_.cached_plan();if(!plan)return false;
    const int parent=journal_.duplicate_private_parent();if(parent<0)return false;
    RunnerWifiRecoveryAuthority authority(runtime_,witness_,journal_);
    cgs1_wifi_recovery::ControlBackend backend(authority,parent,*plan,journal_.bound_candidate());
    ::close(parent);
    using Result=cgs1_wifi_recovery::Result;using Decision=cgs1_wifi_decision::Decision;
    const auto expected=result_==Result::KEEP_COMMITTED?Decision::COMMITTED:Decision::UNCOMMITTED;
    bool okay=backend.recovery_exclusive(*plan) && backend.decision(plan->decision)==expected;
    if(okay && result_==Result::CONFIGURATION_RESTORED) {
      std::vector<cgs1_wifi::SavedProfile>profiles;
      // Both modes must first exclude foreign rows and a leftover candidate.
      // Only a CONNECTED baseline promises selection of its old CURRENT row;
      // an unassociated baseline promises the exact enabled flags, not a
      // connection, address, or a newly invented CURRENT profile.
      okay=backend.catalog(profiles) && cgs1_wifi_recovery::shape(*plan,profiles,journal_.bound_candidate(),false) &&
        (cgs1_wifi_prepare::unassociated(plan->catalog_mode)?
          cgs1_wifi_recovery::unassociated_flags_restored(*plan,profiles):
          cgs1_wifi_recovery::restored_flags(*plan,profiles));
    }
    // KEEP_COMMITTED preserves the user's exact durable decision; it does not
    // assert current connectivity or restore the old credentials. A future
    // boot/reconnect adapter remains responsible for applying that overlay.
    const bool cleanup=backend.close();
    return okay && cleanup && authority.recovery_exclusive(*plan);
  }
 private:
  friend class RunnerWifiRecovery;
  RunnerWifiRecoveryReceipt(int runtime,const NetworkRecoveryWitness&witness,const RunnerWifiJournal&journal,
      cgs1_wifi_recovery::Result result):witness_(witness),journal_(journal),result_(result) {
    runtime_=::fcntl(runtime,F_DUPFD_CLOEXEC,3);
  }
  int runtime_{-1};const NetworkRecoveryWitness&witness_;const RunnerWifiJournal&journal_;
  cgs1_wifi_recovery::Result result_;
};
} // namespace cgs1_supervisor
