#pragma once

// Exactly one SELECT of the NEW, already prepared and dual-BOUND candidate.
// No arbitrary ID/command/key input, retry, ENABLE, SAVE_CONFIG or DHCP signal.
// Lost ACK is an observed UNKNOWN outcome, not permission to resend. Recovery
// remains independently armed before and after this class disappears.
#include "wifi_guard_plan.h"
#include "wifi_forward_step.h"

namespace cgs1_wifi_forward {
template<class Authority,class Preparation>class Selection;
template<class Authority,class Preparation,class Connection>class Restoration;
}
#if defined(__linux__)
namespace cgs1_wifi {
class ForwardCandidateControl {
  template<class Authority,class Preparation>friend class cgs1_wifi_forward::Selection;
  template<class Authority,class Preparation,class Connection>friend class cgs1_wifi_forward::Restoration;
  ReadOnlyControl control_;
  bool open(){return control_.open(0);}
  bool close(){return control_.close();}
  bool catalog(std::vector<SavedProfile>&profiles) {
    std::string reply;return control_.request("LIST_NETWORKS",reply) && parse_saved_profiles(reply,profiles);
  }
  cgs1_wifi_switch::Reply select(int candidate) {
    using Reply=cgs1_wifi_switch::Reply;
    if(candidate<0 || candidate>1000000)return Reply::REFUSED;
    const auto command="SELECT_NETWORK "+std::to_string(candidate);std::string reply;
    if(!control_.exchange_(command.c_str(),reply,150))return Reply::AMBIGUOUS;
    return reply=="OK\n"?Reply::ACK:reply=="FAIL\n"?Reply::REFUSED:Reply::AMBIGUOUS;
  }
  cgs1_wifi_switch::Reply enable_no_connect(int original) {
    using Reply=cgs1_wifi_switch::Reply;
    if(original<0 || original>1000000)return Reply::REFUSED;
    const auto command="ENABLE_NETWORK "+std::to_string(original)+" no-connect";std::string reply;
    if(!control_.exchange_(command.c_str(),reply,150))return Reply::AMBIGUOUS;
    return reply=="OK\n"?Reply::ACK:reply=="FAIL\n"?Reply::REFUSED:Reply::AMBIGUOUS;
  }
};
} // namespace cgs1_wifi

namespace cgs1_wifi_forward {
template<class Authority,class Preparation>class Selection {
 public:
  using Reply=cgs1_wifi_switch::Reply;
  Selection(Authority&authority,const Preparation&preparation):authority_(authority),preparation_(preparation){}
  Reply start() {
    if(attempted_)return result_; // Reconcile THIS stored attempt, no I/O.
    attempted_=true;
    const auto*prepared=preparation_.prepared_profile();
    if(!prepared || preparation_.candidate()!=prepared->id || !authority_.claim_forward(Step::SELECT,prepared->id))return result_;
    const auto&plan=authority_.forward_plan();std::vector<cgs1_wifi::SavedProfile>profiles;
    if(!cgs1_wifi_guard::valid(plan) || !authority_.forward_current(prepared->id) ||
        !control_.open() || !control_.catalog(profiles) || !catalog_(plan,*prepared,profiles)) {
      control_.close();return result_;
    }
    bool enabled_original=false;
    // On successful commit even the ORIGINAL current profile must become an
    // enabled fallback without stealing association from the new candidate.
    // Thus no-connect is needed for every enabled original, not only a second
    // previously enabled fallback. Check capability BEFORE the first SELECT.
    for(const auto&p:plan.original)enabled_original|=!p.disabled;
    if((enabled_original && !authority_.forward_no_connect(prepared->id)) ||
        !authority_.forward_current(prepared->id) || !control_.catalog(profiles) ||
        !catalog_(plan,*prepared,profiles) || !authority_.forward_current(prepared->id)) {
      control_.close();return result_;
    }
    // Consume before send. Even FAIL/timeout/malformed ACK cannot be retried
    // by another click on this object. The final scope check above includes
    // the absolute deadline, frozen writers, same WPA owner and both guardians.
    sent_=true;candidate_=prepared->id;result_=control_.select(candidate_);
    if(!control_.close())result_=Reply::AMBIGUOUS;
    return result_;
  }
  bool attempted()const{return attempted_;}bool sent()const{return sent_;}
  int target()const{return sent_?candidate_:-1;}
  bool bound_to(const Authority&authority)const{return &authority==&authority_;}
  Reply result()const{return result_;}
 private:
  Authority&authority_;const Preparation&preparation_;cgs1_wifi::ForwardCandidateControl control_;
  bool attempted_{false},sent_{false};int candidate_{-1};Reply result_{Reply::REFUSED};
  static bool catalog_(const cgs1_wifi_guard::Plan&plan,const cgs1_wifi::SavedProfile&prepared,
      const std::vector<cgs1_wifi::SavedProfile>&actual) {
    if(prepared.id<0 || prepared.current || !prepared.disabled || !prepared.flags_known ||
        prepared.temporarily_disabled || prepared.flags!="[DISABLED]" ||
        !cgs1_wifi_prepare::same_original(plan.original,actual,prepared.id))return false;
    const auto at=std::find_if(actual.begin(),actual.end(),[&](const auto&p){return p.id==prepared.id;});
    return at!=actual.end() && at->ssid_text==prepared.ssid_text && at->bssid==prepared.bssid;
  }
};
} // namespace cgs1_wifi_forward
#endif
