#pragma once

// A fixed appliance restart, queued after the API response. No command,
// executable, pathname, reboot flags or environment comes from the caller.
// Both admission checks require quiet stock and the verified enabled core
// release. A failed/ambiguous invocation is consumed, never retried.
#include <cstdint>
#include <string>
#include "full_boot_flow.h"
namespace cgs1_supervisor {
inline bool core_reboot_scheduler_ready(FullBootState state,const std::string &error) {
  // After a bridge OTA the same Linux boot may already have consumed its
  // automatic native attempt. An explicit appliance restart is the recovery
  // path; it never reuses that native attempt within the current boot.
  return state==FullBootState::DISABLED ||
    (state==FullBootState::REFUSED && error=="boot_attempt_already_consumed");
}
inline bool core_reboot_display_ready(const std::string &objection) {
  // Reboot closes processes through the OS. This does NOT authorize taking
  // over an occupied display: ordinary/native/guardian capture stays strict.
  return objection.empty() || objection=="inherited_miio_drm_cleanup_required";
}
template<class Backend> class CoreRebootFlow {
 public:
  explicit CoreRebootFlow(Backend &backend):backend_(backend){}
  bool request(uint64_t now) {
    if(requested_ || !now || !backend_.ready())return false;
    requested_=true;queued_at_=now;return true;
  }
  void poll(uint64_t now) {
    if(!requested_ || consumed_)return;
    if(!now || now<queued_at_){consumed_=true;return;}
    if(now-queued_at_<500)return;
    consumed_=true;
    if(backend_.ready())backend_.restart();
  }
  bool requested()const{return requested_;}
  bool consumed()const{return consumed_;}
 private:
  Backend &backend_;bool requested_{false},consumed_{false};uint64_t queued_at_{0};
};
} // namespace cgs1_supervisor
