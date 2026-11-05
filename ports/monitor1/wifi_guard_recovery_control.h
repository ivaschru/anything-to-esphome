#pragma once

// Concrete private-disk + actual UNIX control transport for rollback. The
// full-runtime Authority binder is still required: it must prove native death,
// owned recovery flock, immutable session/boot/journal and stopped stock writers.
// This type is not installed, exported by an API, or selectable by a request.
#include "wifi_guard_recovery.h"
#include "wifi_daemon_inspect.h"

namespace cgs1_wifi_recovery {template<class Authority>class ControlBackend;}
namespace cgs1_wifi {
class GuardianRecoveryControl {
  template<class Authority>friend class cgs1_wifi_recovery::ControlBackend;
  ReadOnlyControl control_;
  bool open(){return control_.open(0);}
  bool close(){return control_.close();}
  bool catalog(std::vector<SavedProfile>&profiles){
    std::string reply;return control_.request("LIST_NETWORKS",reply) && parse_saved_profiles(reply,profiles);
  }
  cgs1_wifi_switch::Reply command(const char*verb,int id,bool no_connect=false) {
    using Reply=cgs1_wifi_switch::Reply;
    const bool enable=!std::strcmp(verb,"ENABLE_NETWORK");
    const bool known=enable || !std::strcmp(verb,"SELECT_NETWORK") || !std::strcmp(verb,"REMOVE_NETWORK");
    if(id<0 || id>1000000 || !known || no_connect!=enable)return Reply::REFUSED;
    const auto command=std::string(verb)+" "+std::to_string(id)+(no_connect?" no-connect":"");
    std::string reply;
    if(!control_.exchange_(command.c_str(),reply,150)){control_.close();return Reply::AMBIGUOUS;}
    if(reply=="OK\n")return Reply::ACK;
    if(reply=="FAIL\n")return Reply::REFUSED;
    control_.close();return Reply::AMBIGUOUS;
  }
};
} // namespace cgs1_wifi

namespace cgs1_wifi_recovery {
template<class Authority>class ControlBackend {
 public:
  ControlBackend(Authority&authority,int trusted_private_parent,const cgs1_wifi_guard::Plan&plan,int bound_candidate)
      :authority_(authority),plan_(plan),bound_(bound_candidate) {
    if(cgs1_wifi_guard::valid(plan_) && bound_>=-1 && bound_<=1000000 && !find(plan_.original,bound_))
      parent_=::fcntl(trusted_private_parent,F_DUPFD_CLOEXEC,3);
  }
  ~ControlBackend(){control_.close();if(parent_>=0)::close(parent_);}
  ControlBackend(const ControlBackend&)=delete;ControlBackend&operator=(const ControlBackend&)=delete;
  bool recovery_exclusive(const cgs1_wifi_guard::Plan&requested) {
    if(failed_ || closed_ || parent_<0 || !same_plan_(requested) ||
        !authority_.recovery_exclusive(plan_) || !same_daemon_())return false;
    if(!opened_) {
      opened_=control_.open();
      if(!opened_ || !same_daemon_()){fail_();return false;}
    }
    return true;
  }
  Decision decision(const cgs1_wifi_decision::Plan&requested) {
    auto whole=plan_;whole.decision=requested;
    if(failed_ || closed_ || !same_plan_(whole))return Decision::UNKNOWN;
    // Native is already dead and this actor holds recovery ownership. A busy
    // writer lock, bad metadata, uncertain sync or foreign durable decision is
    // UNKNOWN, never permission to restore an old network over a new commit.
    cgs1_wifi_private::Store<> store;cgs1_wifi_private::Networks networks;
    if(!store.open_readonly(parent_,plan_.decision.transaction.c_str()) ||
        store.load(networks)==cgs1_wifi_private::Load::ERROR)return Decision::UNKNOWN;
    return cgs1_wifi_decision::inspect(plan_.decision,store);
  }
  bool catalog(std::vector<Profile>&profiles) {
    if(failed_ || closed_ || !opened_ || !same_daemon_() || !control_.catalog(profiles) || !same_daemon_()) {
      fail_();return false;
    }
    return true;
  }
  bool verified_no_connect(){return authority_.verified_no_connect(plan_);}
  Reply select_original(int id) {
    if(plan_.catalog_mode!=cgs1_wifi_prepare::CatalogMode::CONNECTED || id!=original_current(plan_))return Reply::REFUSED;
    return write_("SELECT_NETWORK",id,false);
  }
  Reply enable_original_no_connect(int id) {
    const auto*old=find(plan_.original,id);
    if(!old || (old->current && plan_.catalog_mode==cgs1_wifi_prepare::CatalogMode::CONNECTED) ||
        old->disabled || !verified_no_connect())return Reply::REFUSED;
    return write_("ENABLE_NETWORK",id,true);
  }
  Reply remove_candidate(int id) {
    if(find(plan_.original,id) || id<0 || (bound_>=0 && id!=bound_))return Reply::REFUSED;
    if(bound_<0) {
      std::vector<Profile> profiles;
      if(!catalog(profiles) || !shape(plan_,profiles,id,true))return Reply::REFUSED;
      const auto*added=find(profiles,id);
      if(!added || !added->disabled || !added->ssid_text.empty())return Reply::REFUSED;
    }
    return write_("REMOVE_NETWORK",id,false);
  }
  bool close(){closed_=true;return control_.close();}
 private:
  Authority&authority_;cgs1_wifi_guard::Plan plan_;int bound_{-1},parent_{-1};
  cgs1_wifi::GuardianRecoveryControl control_;bool opened_{false},failed_{false},closed_{false};
  void fail_(){failed_=true;control_.close();}
  bool same_plan_(const cgs1_wifi_guard::Plan&other)const {
    cgs1_wifi_guard::detail::Bytes a,b;
    return cgs1_wifi_guard::detail::encode(plan_,a) && cgs1_wifi_guard::detail::encode(other,b) && a.value==b.value;
  }
  bool same_daemon_()const {
    const auto actual=cgs1_wifi::inspect_daemon(0);
    return actual.verified && actual.process.pid==long(plan_.daemon_pid) &&
        actual.process.start==plan_.daemon_start && actual.socket_inode==plan_.socket_inode;
  }
  Reply write_(const char*verb,int id,bool no_connect) {
    if(!recovery_exclusive(plan_) || decision(plan_.decision)!=Decision::UNCOMMITTED ||
        (no_connect && !verified_no_connect()))return Reply::REFUSED;
    const auto reply=control_.command(verb,id,no_connect);
    if(reply!=Reply::ACK || !same_daemon_()){fail_();return reply==Reply::ACK?Reply::AMBIGUOUS:reply;}
    return Reply::ACK;
  }
};
} // namespace cgs1_wifi_recovery
