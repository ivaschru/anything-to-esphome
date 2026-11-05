#pragma once

// Native application's lifecycle adapter. The caller MUST first complete
// NativePeers verification and the separate armed hardware takeover. This
// adapter grants neither UART/display ownership nor permission to launch.
//
// OTA callbacks run inside the blocking SDK transfer, rather than relying on
// GUI-loop pulses. Both independent guardians must acknowledge transitions.
// A partial/lost ACK is terminal: repeating a command could advance one peer
// twice while leaving the other on the previous generation.
#include "supervisor_twin_client.h"
#include <cmath>

namespace cgs1_supervisor {
enum class NativeState { STARTING, RUNNING, TRANSFER, WAITING_EXEC, EXITING, FAULT };

class NativeSession {
 public:
  explicit NativeSession(TwinClient &client) : client_(client) {}
  NativeSession(const NativeSession &) = delete;
  NativeSession &operator=(const NativeSession &) = delete;

  NativeState state() const { return state_; }
  bool transfer_armed() const { return state_ == NativeState::TRANSFER; }
  bool attach_transition_guard(bool (*guard)()) {
    // Local compiled binding only. Register once after RUNNING; a later
    // caller cannot replace a busy guard or remove it with a null pointer.
    if(state_!=NativeState::RUNNING || transition_guard_ || !guard)return false;
    transition_guard_=guard;return true;
  }
  bool restart_allowed()const {
    return state_==NativeState::RUNNING && (!transition_guard_ || transition_guard_());
  }

  bool loop(bool hardware_ready) {
    if (state_ == NativeState::FAULT) return false;
    // No new traffic after an acknowledged exec/exit. The independent exec
    // deadline still forces recovery if the SDK never performs the restart.
    if (state_ == NativeState::WAITING_EXEC || state_ == NativeState::EXITING) return true;
    if (!client_.pulse(hardware_ready)) return fault_();
    if (state_ == NativeState::STARTING && hardware_ready) state_ = NativeState::RUNNING;
    return true;
  }

  bool ota_begin() {
    // STARTED follows authentication in the pinned SDK, but can precede its
    // backend begin(). A subsequent backend failure must take the ABORT path.
    // An active local network journal must reach retirement or native-death
    // recovery. Re-exec would discard its live owner without proving death.
    // In the pinned SDK STARTED precedes backend begin, so refusing here ends
    // native before an OTA write and lets the ordinary guardians recover it.
    if (!restart_allowed()) return fault_();
    if (!client_.request(Kind::OTA_BEGIN)) return fault_();
    progress_ = 0;
    state_ = NativeState::TRANSFER;
    return true;
  }

  bool ota_progress(float percent) {
    if (state_ != NativeState::TRANSFER || !std::isfinite(percent) ||
        percent < 0.0f || percent > 100.0f) return fault_();
    const uint64_t scaled = static_cast<uint64_t>(double(percent) * 1000.0);
    if (scaled < progress_) return fault_();
    // Duplicate progress may be reported, but the guardian grants more time
    // only for a genuine increase. The total OTA deadline is never reset.
    if (!client_.ota_progress(scaled)) return fault_();
    progress_ = scaled;
    return true;
  }

  bool ota_end() {
    if (state_ != NativeState::TRANSFER) return fault_();
    // The host backend has already renamed program. Each guardian verifies
    // and fsyncs the new fixed-path image before its ACK; the native app must
    // not issue a second RESTART from its later on_shutdown() callback.
    if (!client_.request(Kind::OTA_END)) return fault_();
    state_ = NativeState::WAITING_EXEC;
    return true;
  }

  bool ota_error() {
    if (state_ == NativeState::FAULT) return false;
    if (state_ == NativeState::WAITING_EXEC || state_ == NativeState::EXITING) return fault_();
    // Rejected auth/size probes can emit SDK ERROR without STARTED. They
    // must not send an unarmed ABORT, reserve a restart slot or alter leases.
    if (state_ != NativeState::TRANSFER) return true;
    // ABORT is accepted only if the old fixed-path image remains verified.
    // An error after replacement cannot be relabelled as a harmless failure.
    if (!client_.request(Kind::OTA_ABORT)) return fault_();
    progress_ = 0;
    state_ = NativeState::RUNNING;
    return true;
  }

  bool shutdown_for_restart() {
    if (state_ == NativeState::WAITING_EXEC || state_ == NativeState::EXITING) return true;
    if (!restart_allowed() || !client_.request(Kind::RESTART)) return fault_();
    state_ = NativeState::WAITING_EXEC;
    return true;
  }

  bool exit_stock() {
    if (state_ != NativeState::RUNNING || !client_.request(Kind::EXIT_STOCK)) return fault_();
    state_ = NativeState::EXITING;
    return true;
  }

 private:
  TwinClient &client_;
  NativeState state_{NativeState::STARTING};
  uint64_t progress_{0};
  bool (*transition_guard_)()=nullptr;
  bool fault_() { state_ = NativeState::FAULT; return false; }
};
}  // namespace cgs1_supervisor
