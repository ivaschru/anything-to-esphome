#pragma once

// Restore original ENABLED flags without leaving the candidate association.
// This runs before durable commit. A partial/ambiguous result leaves the
// independent rollback plan armed; no automatic resend or credential rewrite.
#include "wifi_forward_select.h"
namespace cgs1_wifi_forward {
template<class Authority,class Preparation,class Connection>class Restoration {
 public:
  using Reply=cgs1_wifi_switch::Reply;
  Restoration(Authority&authority,const Preparation&prepared,Connection&connection):
    authority_(authority),prepared_(prepared),connection_(connection){}
  Reply start() {
    if(attempted_)return result_;
    attempted_=true;const auto id=prepared_.candidate();
    if(id<0 || !authority_.claim_forward(Step::RESTORE,id) || !connection_.bound_to(authority_,id) ||
        !authority_.forward_current(id) || !authority_.forward_no_connect(id) ||
        !connection_.observe().verified || !control_.open()) {control_.close();return result_;}
    // IDs come only from the immutable original plan. An originally disabled
    // profile is never enabled, and no existing profile's SSID/key is set.
    for(const auto&old:authority_.forward_plan().original) {
      if(old.disabled)continue;
      if(old.id==id || !authority_.forward_current(id) || !authority_.forward_no_connect(id) ||
          !connection_.observe().verified) {control_.close();return result_;}
      ++send_attempts_;const auto reply=control_.enable_no_connect(old.id);
      if(reply!=Reply::ACK) {result_=reply;control_.close();return result_;}
      if(!connection_.accept_restored_fallback(old.id)) {
        result_=Reply::AMBIGUOUS;control_.close();return result_;
      }
    }
    if(!control_.close()) {result_=Reply::AMBIGUOUS;return result_;}
    if(connection_.fallback_flags_restored() && connection_.observe().verified)result_=Reply::ACK;
    return result_;
  }
  bool attempted()const{return attempted_;}unsigned send_attempts()const{return send_attempts_;}
 private:
  Authority&authority_;const Preparation&prepared_;Connection&connection_;cgs1_wifi::ForwardCandidateControl control_;
  bool attempted_{false};unsigned send_attempts_{0};Reply result_{Reply::REFUSED};
};
} // namespace cgs1_wifi_forward
