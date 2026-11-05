#pragma once

// A core-profile-only repair of one known late inherited miio DRM descriptor.
// This is deliberately separate from the disabled legacy trial API. The
// production repair below already verifies its fixed executable/script SHA,
// exact argv and process birth before one TERM, closes inherited descriptors
// before exec, and refuses duplicate/replayed client replacement.
#include "display_ownership.h"

namespace cgs1_supervisor {
enum class CoreDisplayState {READY,WAITING,REFUSED};
template<class Repair=cgs1_net_trial::DisplayMaintenance> class CoreDisplayAdmission final {
 public:
  CoreDisplayState step(const cgs1_net_trial::StockInspection &stock,const std::string &objection) {
    if(refused_)return CoreDisplayState::REFUSED;
    if(!stock.verified)return fail_("verified_stock_required");
    // A later full->stock return legitimately creates a new SnowApp birth.
    // Its fresh clean inventory needs no old repair authority. A new conflict
    // still refuses instead of spending a second repair in this component.
    if(completed_)return objection.empty()?CoreDisplayState::READY:
      fail_("display_contested_after_completed_repair");
    if(requested_) {
      // The same stock, wrapper, watchdog and coordinator must survive the
      // repair. A replacement invalidates this lifecycle rather than granting
      // authority over a new process. No pathname/PID comes from a remote API.
      if(stock.boot_id!=baseline_.boot_id)return fail_("boot_changed_during_repair");
      for(unsigned i=0;i<stock.processes.size();++i) {
        const auto &a=stock.processes[i],&b=baseline_.processes[i];
        if(a.pid!=b.pid || a.start!=b.start || a.executable!=b.executable)
          return fail_("stock_changed_during_repair");
      }
      repair_.poll();
      if(!repair_.error().empty())return fail_("known_miio_repair_failed");
      if(repair_.busy())return CoreDisplayState::WAITING;
      if(repair_.state()!="restarted-clean" && repair_.state()!="already-clean")
        return fail_("known_miio_repair_not_verified");
      // poll() can finish restarting the client AFTER this invocation's
      // objection was sampled. Never decide from that pre-repair inventory:
      // yield once, then require the caller's next complete fresh capture.
      // This adds no repair retry and never admits an unknown/current owner.
      if(!completion_observed_) {completion_observed_=true;return CoreDisplayState::WAITING;}
      // A fresh inventory is supplied on EVERY step, including completion.
      // A second inherited client, unknown owner or incomplete inventory is
      // never cleared by repeating the repair or by accepting its old result.
      if(!objection.empty())return fail_("display_still_contested_after_repair");
      completed_=true;
      return CoreDisplayState::READY;
    }
    if(objection.empty())return CoreDisplayState::READY;
    if(objection!="inherited_miio_drm_cleanup_required")
      return fail_("unexpected_display_owner_or_inventory");
    baseline_=stock;requested_=true; // Consume before the potentially ambiguous TERM.
    if(!repair_.start(stock))return fail_("known_miio_repair_start_refused");
    return CoreDisplayState::WAITING;
  }
  bool requested()const{return requested_;}
  bool completed()const{return completed_;}
  const std::string &error()const{return error_;}
  const std::string &repair_state()const{return repair_.state();}
  const std::string &repair_error()const{return repair_.error();}
 private:
  Repair repair_;cgs1_net_trial::StockInspection baseline_;
  bool requested_{false},completed_{false},refused_{false},completion_observed_{false};std::string error_;
  CoreDisplayState fail_(const char *error) {
    refused_=true;error_=error;return CoreDisplayState::REFUSED;
  }
};
} // namespace cgs1_supervisor
