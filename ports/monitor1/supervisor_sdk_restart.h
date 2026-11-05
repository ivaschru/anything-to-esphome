#pragma once

// A host "safe reboot" exits unless a re-exec path is explicitly armed.
// This adapter restarts only the already verified fixed native executable;
// it is not a Linux/router reboot or a caller-provided command. The ordinary
// SDK shutdown hooks still checkpoint preferences/thermal state and obtain
// BOTH NativeSession RESTART ACKs before arch_restart executes the image.
#include "supervisor_native_session.h"
#include "esphome/components/host/core.h"
#include "esphome/core/application.h"

namespace cgs1_supervisor {
class SdkRestart {
 public:
  explicit SdkRestart(NativeSession &session):session_(session){}
  bool request() {
    // Refuse the request before queuing it while a local Wi-Fi operation
    // owns its journal. The shutdown hook repeats this guard at actual exec.
    if(requested_ || !session_.restart_allowed())return false;
    requested_=clock_ms();return requested_!=0;
  }
  bool pending() const{return requested_!=0;}
  bool loop(const std::string &trusted_fixed_image) {
    if(!requested_)return true;
    const auto now=clock_ms();
    if(!now || now<requested_)return false;
    if(now-requested_<500)return true; // Let the action response leave API stack.
    if(session_.state()!=NativeState::RUNNING || trusted_fixed_image.empty() ||
       esphome::host::get_exe_path()!=trusted_fixed_image || !esphome::host::get_argv())return false;
    esphome::host::arm_reexec(trusted_fixed_image);
    esphome::App.safe_reboot();
    return false; // A returning restart must end in guardian recovery.
  }
 private:
  NativeSession &session_;uint64_t requested_{0};
};
}  // namespace cgs1_supervisor
