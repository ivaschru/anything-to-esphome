#pragma once

// ESPHome 2026.10.1 host OTA binding. This is deliberately independent of the
// screen, sensor drivers and recovery-plan implementation. Only a native app
// already admitted by its two guardians may attach this listener.
#include "supervisor_native_session.h"
#include "esphome/components/ota/ota_backend.h"
#include <cstdlib>

#ifndef USE_OTA_STATE_LISTENER
#error "Native supervision requires OTA state listeners in the build"
#endif

namespace cgs1_supervisor {
class SdkOtaListener final : public esphome::ota::OTAStateListener {
 public:
  explicit SdkOtaListener(NativeSession &session) : session_(session) {}

  bool attach(esphome::ota::OTAComponent &parent) {
    if (attached_) return false;
    // Registration occurs once before OTA setup/use. Reattaching on exec is
    // unnecessary: exec creates a fresh process and a fresh listener vector.
    parent.add_state_listener(this);
    attached_ = true;
    return true;
  }

  void on_ota_state(esphome::ota::OTAState state, float progress, uint8_t error) override {
    (void) error;  // Error numbers are diagnostic; never authority to retry.
    bool accepted = false;
    switch (state) {
      case esphome::ota::OTA_STARTED: accepted = session_.ota_begin(); break;
      case esphome::ota::OTA_IN_PROGRESS: accepted = session_.ota_progress(progress); break;
      case esphome::ota::OTA_COMPLETED: accepted = session_.ota_end(); break;
      case esphome::ota::OTA_ABORT:
      case esphome::ota::OTA_ERROR: accepted = session_.ota_error(); break;
      default: break;
    }
    // A rejected transition cannot continue to backend write/exec. Avoid
    // shutdown callbacks/destructors that could send a second command or hang
    // with raw hardware FDs held. Guardians first reap us, then own recovery.
    if (!attached_ || !accepted) std::_Exit(73);
  }

  void before_shutdown() {
    // The SDK calls shutdown after COMPLETED too. NativeSession suppresses a
    // duplicate RESTART in that path, while ordinary restarts require ACKs.
    if (!attached_ || !session_.shutdown_for_restart()) std::_Exit(73);
  }

 private:
  NativeSession &session_;
  bool attached_{false};
};
}  // namespace cgs1_supervisor
