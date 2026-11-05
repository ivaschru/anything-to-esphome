#pragma once

// Vendor-process handover shared by the permanent runner and its Linux
// fixture. This class NEVER launches SnowApp or a native app. A separately
// verified guardian runner owns native termination, recovery exclusion and
// the durable armed plan. BoardPolicy owns fixed GPIO/mux/backlight recovery.
//
// Stock processes are not our children on Linux 3.10 (no pidfd). Every signal
// therefore requires the exact live PID/start/exe from the sealed plan. Stop
// the sole restart producer first. This is the existing vendor-fence model,
// not the stronger unreaped-own-child primitive used for our native process.
#include "network_preflight.h"
#include "supervisor_client.h"
#include <signal.h>

namespace cgs1_supervisor {
enum class TakeoverStage { EMPTY, ADMITTED, MUTATING, EXCLUSIVE, RECOVERED, FAILED };

template<class BoardPolicy, class RecoveryFence> class VendorTakeover {
 public:
  VendorTakeover(BoardPolicy &board, RecoveryFence &fence) : board_(board), fence_(fence) {}
  TakeoverStage stage() const { return stage_; }
  const char *error() const { return error_; }
  bool side_effect_restore_failed() const { return restore_failed_; }

  bool admit(const cgs1_net_trial::StockInspection &plan) {
    if (stage_ != TakeoverStage::EMPTY) return fail_("admission_repeated");
    if (!plan.verified || !board_.validate_plan(plan)) return fail_("plan_or_board_unverified");
    for (const auto &process : plan.processes)
      if (!current_(process) || !cgs1_net_trial::process_identity(process.pid).running())
        return fail_("vendor_birth_not_running");
    if (plan.processes[0].parent != plan.processes[1].pid)
      return fail_("stock_wrapper_relation_changed");
    plan_ = plan;
    stage_ = TakeoverStage::ADMITTED;
    return true;
  }

  bool take_over() {
    // Preserve the original short-circuit order and run each predicate once.
    // Distinct fixed labels identify an early refusal without another probe,
    // signal, admission retry or weakened guardian/board requirement.
    if (stage_ != TakeoverStage::ADMITTED) return fail_("takeover_stage_not_admitted");
    if (!fence_.both_guardians_armed()) return fail_("armed_recovery_required");
    if (!board_.validate_plan(plan_)) return fail_("fresh_board_validation_required");
    for (const auto &process : plan_.processes)
      if (!current_(process) || !cgs1_net_trial::process_identity(process.pid).running())
        return fail_("vendor_changed_before_first_signal");
    // Mark mutation before the first STOP: a failure anywhere below still
    // requires recovery, including a fault between STOP and its acknowledgement.
    stage_ = TakeoverStage::MUTATING;
    for (unsigned role : {2U,1U,0U}) {
      if (!fence_.both_guardians_armed() || !signal_(role,SIGSTOP) || !await_stopped_(role))
        return fail_("vendor_stop_not_confirmed");
    }
    // A local stock-screen setting could change between plan capture and
    // STOP. While the original GUI is still alive but frozen, confirm the
    // original physical settings once more. On mismatch recovery retains that
    // GUI instead of killing it and restoring an older snapshot over it.
    if (!board_.prepare_frozen_stock(plan_))return fail_("frozen_stock_preparation_failed");
    if (!fence_.both_guardians_armed() || !signal_(0,SIGKILL) || !await_dead_(0))
      return fail_("stock_death_not_confirmed");
    // Old kernel deferred fput can outlive /proc/PID/exe. The board adapter
    // must inspect DRM/UART ownership after the settling interval too.
    ::usleep(500000);
    if (!fence_.both_guardians_armed() || !stopped_(2) || !stopped_(1) ||
        !board_.exclusive_after_stock_death(plan_)) return fail_("exclusive_hardware_not_confirmed");
    stage_ = TakeoverStage::EXCLUSIVE;
    return true;
  }

  bool recover() {
    if (recovery_attempted_) return recovery_result_;
    if (stage_ == TakeoverStage::EMPTY || !plan_.verified) return fail_("no_admitted_recovery_plan");
    // This predicate means the runner has killed/reaped its exact native
    // child and excluded the other recovery actor. A timeout/unknown D-state
    // must return false; observing a stale heartbeat alone is insufficient.
    if (!fence_.native_dead_and_recovery_owned()) return fail_("native_death_and_sole_recovery_required");
    recovery_attempted_ = true;
    bool okay = true;
    if (stopped_(2)) {
      // PM/mux/Wi-Fi/brightness return precedes the vendor producer. A failed
      // optional restore remains an error but cannot strand the watchdog.
      restore_failed_ = !board_.restore_side_effects(plan_);
      if (restore_failed_) okay = false;
      if (!board_.may_resume_vendor()) return fail_("recovery_receipt_unconfirmed_no_resume");
    }
    if (current_(plan_.processes[0])) {
      // Lost guardian during a partial takeover: retain the original GUI,
      // its thermal state and wrapper; do not clear the one-shot helper flag.
      okay = resume_if_current_(0) && okay;
      okay = resume_if_current_(1) && okay;
    } else {
      // The original GUI died. Its paused old wrapper must not execute its
      // fallback concurrently with the sole vendor watchdog's next launch.
      if (current_(plan_.processes[1]) &&
          (!signal_recovery_(1,SIGKILL) || !await_dead_(1)))
        return fail_("old_wrapper_death_unconfirmed_no_resume");
      // Retirement of the one-shot helper and its durable prepare receipt
      // precede CONT. An uncertain prepare must not let a fresh GUI recreate
      // the marker before backup can reconcile the same transaction.
      if (stopped_(2) && !board_.prepare_stock_relaunch(plan_))
        return fail_("stock_relaunch_prepare_unconfirmed_no_resume");
    }
    const bool producer_resumed = resume_if_current_(2);
    okay = producer_resumed && okay;
    if (okay) { stage_ = TakeoverStage::RECOVERED; error_ = ""; }
    else fail_(producer_resumed ? "stock_resumed_with_restore_error" : "vendor_producer_resume_failed");
    recovery_result_ = okay;
    return recovery_result_;
  }

 private:
  using Identity = cgs1_net_trial::ProcessIdentity;
  BoardPolicy &board_; RecoveryFence &fence_;
  cgs1_net_trial::StockInspection plan_;
  TakeoverStage stage_{TakeoverStage::EMPTY};
  const char *error_{""}; bool restore_failed_{false};
  bool recovery_attempted_{false},recovery_result_{false};
  bool fail_(const char *error) { stage_ = TakeoverStage::FAILED; error_ = error; return false; }
  static bool current_(const Identity &identity) { return cgs1_net_trial::same_process(identity); }
  bool stopped_(unsigned role) const {
    if (!current_(plan_.processes[role])) return false;
    const auto state = cgs1_net_trial::process_identity(plan_.processes[role].pid).state;
    return state == 'T' || state == 't';
  }
  bool signal_(unsigned role,int signal) {
    return current_(plan_.processes[role]) && !::kill(pid_t(plan_.processes[role].pid),signal);
  }
  bool signal_recovery_(unsigned role,int signal) {
    return fence_.native_dead_and_recovery_owned() && signal_(role,signal);
  }
  bool resume_if_current_(unsigned role) {
    // Never replace a changed/missing watchdog identity with a guessed PID.
    if (!current_(plan_.processes[role])) return false;
    return signal_recovery_(role,SIGCONT);
  }
  bool await_stopped_(unsigned role) {
    const auto start = clock_ms();
    while (start && clock_ms()-start < 2000) {
      if (stopped_(role)) return true;
      if (!current_(plan_.processes[role]) || !fence_.both_guardians_armed()) return false;
      ::usleep(1000);
    }
    return false;
  }
  bool await_dead_(unsigned role) {
    const auto start = clock_ms();
    while (start && clock_ms()-start < 3000) {
      if (!current_(plan_.processes[role])) return true;
      const auto state = cgs1_net_trial::process_identity(plan_.processes[role].pid).state;
      if (state == 'Z' || state == 'X') return true;
      ::usleep(1000);
    }
    return false;
  }
};
}  // namespace cgs1_supervisor
