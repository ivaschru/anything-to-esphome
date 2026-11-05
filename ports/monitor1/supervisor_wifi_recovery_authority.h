#pragma once

// Production authority for the fixed Wi-Fi recovery ControlBackend. Unlike
// fixture booleans, each call rechecks a live runner capability and the exact
// cached boot/session/journal/frozen-writer basis. The backend independently
// rechecks WPA PID/start/socket and the durable decision before every write.
// Constructing this object neither opens WPA nor changes the generic effects
// gate; Cgs1RunnerBoard still needs the separately tested recovery orchestration.
#include "supervisor_network_recovery_witness.h"
#include "supervisor_wifi_guard_cache.h"
#include "wpa_vendor_no_connect.h"

namespace cgs1_supervisor {
class RunnerWifiRecoveryAuthority {
 public:
  RunnerWifiRecoveryAuthority(int runtime,const NetworkRecoveryWitness&witness,const RunnerWifiJournal&journal)
      :witness_(witness),journal_(journal) {runtime_=::fcntl(runtime,F_DUPFD_CLOEXEC,3);}
  RunnerWifiRecoveryAuthority(const RunnerWifiRecoveryAuthority&)=delete;
  RunnerWifiRecoveryAuthority&operator=(const RunnerWifiRecoveryAuthority&)=delete;
  ~RunnerWifiRecoveryAuthority(){if(runtime_>=0)::close(runtime_);}
  bool recovery_exclusive(const cgs1_wifi_guard::Plan&plan)const {
    return runtime_>=0 && witness_.valid_for_runtime(runtime_) && journal_.recovery_basis_matches(plan);
  }
  bool verified_no_connect(const cgs1_wifi_guard::Plan&plan)const {
    if(!recovery_exclusive(plan))return false;
    const auto proof=cgs1_wifi_vendor::inspect_no_connect();
    return proof.verified && proof.daemon.process.pid==long(plan.daemon_pid) &&
      proof.daemon.process.start==plan.daemon_start && proof.daemon.socket_inode==plan.socket_inode && recovery_exclusive(plan);
  }
 private:
  int runtime_{-1};const NetworkRecoveryWitness&witness_;const RunnerWifiJournal&journal_;
};
} // namespace cgs1_supervisor
