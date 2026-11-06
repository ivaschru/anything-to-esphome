#pragma once

// Native-only PREPARATION of a new disabled WPA2 candidate. No network select,
// ENABLE, SAVE_CONFIG, existing-profile setter or password getter exists here.
// A production independent guardian authority is still required and not wired
// into the full runtime yet. Never substitute a UI timer or unconditional true
// callback for that authority. The fixture authority is container-only.
#include "wifi_private_store.h"
#include "wifi_saved_profiles.h"
#include "wifi_switch_transaction.h"

namespace cgs1_wifi_prepare {
using cgs1_wifi_switch::Reply;
enum class State {IDLE,REFUSED,RECOVERY_REQUIRED,PREPARED};
enum class Step {CREATE,BIND,SSID,KEY_MANAGEMENT,PROTOCOL,PSK,VERIFY};
// A boot with no association is a different sealed recovery baseline. The
// ordinary caller stays CONNECTED by default; a retained configured CURRENT
// pointer in an unassociated catalog must not fabricate a working connection.
enum class CatalogMode {CONNECTED,UNASSOCIATED,UNASSOCIATED_MANUAL};
// Value 1 remains saved-record-only. Value 2 is a separately sealed local
// touchscreen request; older guardians reject its unknown mode byte.
inline bool unassociated(CatalogMode mode) {
  return mode==CatalogMode::UNASSOCIATED || mode==CatalogMode::UNASSOCIATED_MANUAL;
}
template<class Authority> class Preparation;
inline bool supported_catalog(const std::vector<cgs1_wifi::SavedProfile> &profiles,
    CatalogMode mode=CatalogMode::CONNECTED) {
  if((mode!=CatalogMode::CONNECTED && !unassociated(mode)) ||
      (mode==CatalogMode::CONNECTED && profiles.empty()) || profiles.size()>=32)return false;
  unsigned currents=0;
  for(const auto &p:profiles) {
    if(!p.flags_known || p.temporarily_disabled)return false;
    if(p.current)++currents;
  }
  return mode==CatalogMode::CONNECTED?currents==1:currents<=1;
}
inline bool same_original(const std::vector<cgs1_wifi::SavedProfile> &before,
    const std::vector<cgs1_wifi::SavedProfile> &now,int candidate) {
  if(now.size()!=before.size()+(candidate>=0?1u:0u))return false;
  for(const auto &old:before) {
    const auto found=std::find_if(now.begin(),now.end(),[&](const auto &p){return p.id==old.id;});
    if(found==now.end() || found->ssid_text!=old.ssid_text || found->bssid!=old.bssid ||
        found->flags!=old.flags || !found->flags_known || found->temporarily_disabled)return false;
  }
  if(candidate<0)return true;
  const auto found=std::find_if(now.begin(),now.end(),[&](const auto &p){return p.id==candidate;});
  return found!=now.end() && found->disabled && !found->current && found->flags_known &&
    !found->temporarily_disabled && found->bssid=="any";
}
} // namespace cgs1_wifi_prepare

#if defined(__linux__)
namespace cgs1_wifi {
// Only Preparation can use the private exchange. It supplies a newly returned
// ID, never an arbitrary existing profile. All command text is fixed ASCII plus
// bounded integers/hex; the key-bearing command buffer is erased after send.
class NativeCandidateControl {
  template<class Authority> friend class cgs1_wifi_prepare::Preparation;
  ReadOnlyControl control_;
  bool open(){return control_.open(0);}
  bool close(){return control_.close();}
  bool catalog(std::vector<SavedProfile> &profiles) {
    std::string reply;
    return control_.request("LIST_NETWORKS",reply) && parse_saved_profiles(reply,profiles);
  }
  cgs1_wifi_prepare::Reply lost_(){control_.close();return cgs1_wifi_prepare::Reply::AMBIGUOUS;}
  cgs1_wifi_prepare::Reply create_(int &id) {
    std::string reply;
    if(!control_.exchange_("ADD_NETWORK",reply,150))return lost_();
    if(reply=="FAIL\n")return cgs1_wifi_prepare::Reply::REFUSED;
    if(!reply.empty() && reply.back()=='\n')reply.pop_back();
    if(!decimal(reply,1000000,id))return lost_();
    return cgs1_wifi_prepare::Reply::ACK;
  }
  cgs1_wifi_prepare::Reply set_(int candidate,const char *name,const uint8_t *bytes,size_t size) {
    if(candidate<0 || candidate>1000000)return cgs1_wifi_prepare::Reply::REFUSED;
    cgs1_wifi_private::detail::Bytes command;
    // Fixed upper bound covers 64 key/SSID hex digits plus the typed prefix.
    // Reserve BEFORE secret bytes so a growing string cannot leave an earlier
    // partial key in a freed allocation outside the scope eraser's reach.
    command.value.reserve(160);
    command.value="SET_NETWORK "+std::to_string(candidate)+" "+name+" ";
    if(!std::strcmp(name,"ssid") || !std::strcmp(name,"psk")) {
      if(!bytes || (std::strcmp(name,"ssid")==0?(size<1 || size>32):size!=32))
        return cgs1_wifi_prepare::Reply::REFUSED;
      constexpr char HEX[]="0123456789abcdef";
      for(size_t i=0;i<size;++i){command.value+=HEX[bytes[i]>>4];command.value+=HEX[bytes[i]&15];}
    } else if(!std::strcmp(name,"key_mgmt"))command.value+="WPA-PSK";
    else if(!std::strcmp(name,"proto"))command.value+="RSN";
    else return cgs1_wifi_prepare::Reply::REFUSED;
    std::string reply;
    const bool received=control_.exchange_(command.value.c_str(),reply,150);
    // Reply is only a fixed status; the local command containing a binary PSK
    // rendered as hex is erased on every path, including timeout/refusal.
    if(!received)return lost_();
    if(reply=="OK\n")return cgs1_wifi_prepare::Reply::ACK;
    if(reply=="FAIL\n")return cgs1_wifi_prepare::Reply::REFUSED;
    return lost_();
  }
};
} // namespace cgs1_wifi

namespace cgs1_wifi_prepare {
template<class Authority> class Preparation {
 public:
  explicit Preparation(Authority &authority,CatalogMode mode=CatalogMode::CONNECTED):authority_(authority),mode_(mode){}
  State state()const{return state_;}
  int candidate()const{return state_==State::PREPARED?candidate_:-1;}
  const cgs1_wifi::SavedProfile*prepared_profile()const {
    return state_==State::PREPARED?&prepared_profile_:nullptr;
  }
  bool prepare(const char *transaction,const cgs1_wifi_private::Network &network) {
    if(attempted_)return false;
    attempted_=true;
    if(!cgs1_checkpoint::valid_epoch(transaction) || !network.ssid_size || network.ssid_size>32) {
      state_=State::REFUSED;return false;
    }
    transaction_=transaction;
    // arm_prepare must ACK only once both independent local guardians have an
    // immutable baseline/deadline and exclusive ownership. It must also verify
    // the exact supplicant PID/start/socket and private logging configuration:
    // an unknown daemon debug/show-keys mode forbids passing it credentials.
    // Preparation intentionally cannot create that authority by itself.
    if(!authority_.admitted(transaction_,Step::CREATE,-1) || !control_.open() ||
        !control_.catalog(original_) || !supported_catalog(original_,mode_)) {
      state_=State::REFUSED;return false;
    }
    // Bind the exact requested credential bytes to the immutable recovery
    // plan. A matching transaction/SSID alone must not authorize a different
    // key than the one both guardians will retain and the Store will commit.
    const auto armed=authority_.arm_prepare(transaction_,original_,network);
    if(armed!=Reply::ACK) {
      state_=armed==Reply::REFUSED?State::REFUSED:State::RECOVERY_REQUIRED;return false;
    }
    // After an armed CREATE intent, even loss of the entire caller is handled
    // by the independent authority. It reconciles ADD from the exact original
    // catalog; a lost ADD reply never permits another ADD from this instance.
    state_=State::RECOVERY_REQUIRED;
    if(!authority_.admitted(transaction_,Step::CREATE,-1) || control_.create_(candidate_)!=Reply::ACK)
      return false;
    for(const auto &old:original_)if(old.id==candidate_)return false;
    std::vector<cgs1_wifi::SavedProfile> now;
    if(!control_.catalog(now) || !same_original(original_,now,candidate_))return false;
    const auto added=std::find_if(now.begin(),now.end(),[&](const auto &p){return p.id==candidate_;});
    if(added==now.end() || !added->ssid_text.empty())return false;
    // Publish the returned ID to both guardians BEFORE any key/SSID setter.
    // An ambiguous bind leaves a disabled candidate for guardian cleanup and
    // transmits no credentials. No caller-selected profile ID is accepted.
    if(!authority_.admitted(transaction_,Step::BIND,candidate_) ||
        authority_.bind_candidate(transaction_,candidate_)!=Reply::ACK)return false;
    struct Setting {Step step;const char *name;const uint8_t *bytes;size_t size;};
    const Setting settings[]={
      {Step::SSID,"ssid",network.ssid.data(),network.ssid_size},
      {Step::KEY_MANAGEMENT,"key_mgmt",nullptr,0},
      {Step::PROTOCOL,"proto",nullptr,0},
      {Step::PSK,"psk",network.psk.data(),network.psk.size()}
    };
    for(const auto &setting:settings) {
      // Recheck ownership and the disabled candidate immediately before EACH
      // setter. A foreign catalog change or enabled candidate aborts; original
      // network fields are never copied, read for credentials or rewritten.
      if(!authority_.admitted(transaction_,setting.step,candidate_) || !control_.catalog(now) ||
          !same_original(original_,now,candidate_) ||
          control_.set_(candidate_,setting.name,setting.bytes,setting.size)!=Reply::ACK)return false;
    }
    if(!authority_.admitted(transaction_,Step::VERIFY,candidate_) || !control_.catalog(now) ||
        !same_original(original_,now,candidate_) || !control_.close())return false;
    // Pin the NON-SECRET identity actually acknowledged by LIST_NETWORKS.
    // Forward connectivity must not accept another SSID under a reused ID.
    const auto final=std::find_if(now.begin(),now.end(),[&](const auto&p){return p.id==candidate_;});
    if(final==now.end())return false;
    prepared_profile_=*final;
    // PREPARED means four setters ACKed for the new still-disabled profile.
    // It does NOT prove association, PSK validity, DHCP, persistence or a ready
    // UI. Those belong to the separately guarded selection/commit transaction.
    state_=State::PREPARED;return true;
  }
 private:
  Authority &authority_;const CatalogMode mode_;cgs1_wifi::NativeCandidateControl control_;
  State state_{State::IDLE};bool attempted_{false};int candidate_{-1};
  std::string transaction_;std::vector<cgs1_wifi::SavedProfile> original_;
  cgs1_wifi::SavedProfile prepared_profile_;
};
} // namespace cgs1_wifi_prepare
#endif
