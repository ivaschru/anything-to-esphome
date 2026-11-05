#pragma once

// Actual ESPHome host bindings for FullCoordinator. These methods run only
// on its main loop. They neither alter identities/keys nor call setup twice.
#include "esphome/components/api/api_server.h"
#include "esphome/components/esphome/ota/ota_esphome.h"
#include "stock_pm_control.h"
#include "supervisor_full_plan.h"
#include "display_ownership.h"
#include "core_reboot_flow.h"

#ifndef USE_CGS1_TRANSPORT_GATE
#error "Full coordinator requires the pinned host API/OTA transport-gate patch"
#endif

namespace cgs1_supervisor {
class Cgs1BridgePolicy {
 public:
  Cgs1BridgePolicy(esphome::api::APIServer &api,esphome::ESPHomeOTAComponent &ota)
      :api_(api),ota_(ota){}
  const std::string&capture_error()const{return capture_error_;}
  const std::string&capture_stock_error()const{return capture_stock_error_;}
  bool capture(cgs1_net_trial::StockInspection &stock,OriginalEffects &effects) {
    return capture_(stock,effects,false);
  }
  // Only the fixed Linux reboot admission calls this read. It preserves all
  // stock/PM/mux/brightness checks and may recognize the exact repairable miio
  // owner. It is not the capture used to create a native takeover plan.
  bool capture_for_core_reboot(cgs1_net_trial::StockInspection &stock,OriginalEffects &effects) {
    return capture_(stock,effects,true);
  }
 private:
  bool capture_(cgs1_net_trial::StockInspection &stock,OriginalEffects &effects,bool for_reboot) {
    // Preserve the exact admission order and refusals, but retain a fixed
    // diagnostic label BEFORE guardian fork/log creation. A generic capture
    // failure otherwise makes a harmless pre-acquire refusal indistinguishable
    // from a different hardware/identity problem. These fields authorize no
    // retry and export no device file contents or credential-bearing values.
    capture_error_.clear();capture_stock_error_.clear();
    if(!cgs1::pm.available())return capture_fail_("stock_pm_unavailable");
    if(!stock.inspect()) {
      capture_stock_error_=stock.error;return capture_fail_("stock_inspection_refused");
    }
    const auto display=cgs1_net_trial::DisplayMaintenance::handoff_objection(stock);
    if(for_reboot?!core_reboot_display_ready(display):!display.empty())
      return capture_fail_("display_handoff_refused");
    const auto hardware=cgs1_pm::inspect();
    if(!hardware.write_only_supported() || !hardware.pinmux_readable)
      return capture_fail_("pm_hardware_inspection_refused");
    effects.boot_id=stock.boot_id;effects.pm_enabled=cgs1::pm.enabled();
    effects.pm_mux=hardware.pinmux_value&cgs1_pm::pinmux::MASK;
    if(effects.pm_mux!=(effects.pm_enabled?cgs1_pm::pinmux::UART:cgs1_pm::pinmux::GPIO))
      return capture_fail_("pm_mux_state_differs");
    if(cgs1_net_trial::read_small("/sys/class/backlight/rk28_bl/max_brightness",16)!="1000\n")
      return capture_fail_("brightness_limit_differs");
    auto text=cgs1_net_trial::read_small("/sys/class/backlight/rk28_bl/brightness",16);
    if(text.empty() || text.back()!='\n')return capture_fail_("brightness_read_unavailable");
    text.pop_back();uint64_t value=0;
    if(!bootstrap_number(text,1000,value))return capture_fail_("brightness_value_refused");
    effects.brightness=unsigned(value);return true;
  }
 public:
  bool suspend_pm(bool expected){return cgs1::pm.suspend_for_trial(expected);}
  void release_pm(){cgs1::pm.resume_after_trial();}
  bool pause_transport() {
    // OTA must be completely idle. API clients are removed only AFTER the
    // original launch response returned, by the coordinator's deferred poll.
    if(!ota_.cgs1_pause_transport())return false;
    if(api_.cgs1_pause_transport())return true;
    ota_.cgs1_resume_transport();return false;
  }
  bool resume_transport() {
    // Attempt both independently: one successful bind must not prevent the
    // other's retry, and a pending conflict never marks a component failed.
    const bool api=api_.cgs1_resume_transport(),ota=ota_.cgs1_resume_transport();
    return api && ota;
  }
  bool stock_recovered(const FullPlan &plan) {
    cgs1_net_trial::StockInspection fresh;
    return fresh.inspect() && fresh.boot_id==plan.stock.boot_id &&
      fresh.processes[2].start==plan.stock.processes[2].start &&
      cgs1_net_trial::DisplayMaintenance::handoff_objection(fresh).empty();
  }
 private:
  esphome::api::APIServer &api_;esphome::ESPHomeOTAComponent &ota_;
  std::string capture_error_,capture_stock_error_;
  bool capture_fail_(const char*reason){capture_error_=reason;return false;}
};
}  // namespace cgs1_supervisor
