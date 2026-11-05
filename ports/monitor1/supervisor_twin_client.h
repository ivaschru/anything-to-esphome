#pragma once

// Shared native endpoint for TWO independently validated guardians. Bootstrap
// passes inherited descriptors and exact birth identities, never discovers a
// listener from environment text. No hardware setup is authorized by this
// class alone: the runner must already have armed recovery and taken over.
#include "supervisor_client.h"
#include "supervisor_process_tree.h"

namespace cgs1_supervisor {
class TwinClient {
 public:
  bool connect(const std::array<int,2> &descriptors,const std::array<ProcessStamp,2> &guardians) {
    if(attempted_)return false;
    attempted_=true;guardians_=guardians;
    if(descriptors[0]==descriptors[1] || guardians[0].pid==guardians[1].pid ||
       ::getppid()!=guardians[0].pid || !parents_current_())return fault_();
    for(unsigned i=0;i<2;++i) {
      if(!clients_[i].open(descriptors[i],guardians_[i].pid,guardians_[i].owner)) {
        ::dprintf(STDERR_FILENO,"CGS1_TWIN channel refused index=%u errno=%d\n",i,errno);return fault_();
      }
      if(!clients_[i].hello()) {
        ::dprintf(STDERR_FILENO,"CGS1_TWIN hello refused index=%u receive=%u errno=%d\n",
          i,unsigned(clients_[i].last_receive()),errno);return fault_();
      }
    }
    connected_=true;return true;
  }
  bool pulse(bool hardware_ready) {
    if(!connected_ || faulted_ || waiting_)return fault_();
    const auto now=clock_ms();
    if(!now || (last_pulse_ && now<last_pulse_))return fault_();
    const bool becoming_ready=hardware_ready && !ready_;
    if(!becoming_ready && last_pulse_ && now-last_pulse_<1000)return true;
    // Birth checks are needed for each transmitted pulse/command, not every
    // fast GUI loop. Loss is detected within 1 s; independent guardian leases
    // still prevent any competing hardware recovery before native termination.
    if(!parents_current_())return fault_();
    if(hardware_ready && !ready_) {
      for(auto &client:clients_)if(!client.request(Kind::READY))return fault_();
      ready_=true;
    }
    for(auto &client:clients_)if(!client.notify(Kind::PULSE))return fault_();
    last_pulse_=now;return true;
  }
  bool ota_progress(uint64_t fraction) {
    if(!connected_ || faulted_ || waiting_ || fraction>100000 || !parents_current_())return fault_();
    for(auto &client:clients_)if(!client.notify(Kind::OTA_PROGRESS,fraction))return fault_();
    return true;
  }
  bool request(Kind kind) {
    if(!connected_ || faulted_ || waiting_ || !parents_current_())return fault_();
    for(auto &client:clients_)if(!client.request(kind))return fault_();
    if(kind==Kind::OTA_END || kind==Kind::RESTART || kind==Kind::EXIT_STOCK)waiting_=true;
    return true;
  }
  bool faulted() const {return faulted_;}
  bool waiting() const {return waiting_;}
  bool current_ready_peers(std::array<ProcessStamp,2>&out)const {
    // A bounded read-only view of the ALREADY admitted channel peers. Never
    // re-read numeric environment fields as authority for a later Wi-Fi write.
    // This proves channel readiness/births only; the native board scope still
    // has to validate boot, runtime, frozen writers and its own executable.
    const auto now=clock_ms();
    if(!connected_ || !ready_ || faulted_ || waiting_ || !last_pulse_ || now<last_pulse_ ||
        now-last_pulse_>=1500 || !parents_current_())return false;
    out=guardians_;return true;
  }
  std::array<uint64_t,2> generations() const {
    return {clients_[0].generation(),clients_[1].generation()};
  }
 private:
  std::array<ChannelClient,2> clients_;std::array<ProcessStamp,2> guardians_{};
  bool attempted_{false},connected_{false},ready_{false},faulted_{false},waiting_{false};uint64_t last_pulse_{0};
  bool fault_(){faulted_=true;return false;}
  bool parents_current_() const {
    for(unsigned i=0;i<2;++i) {
      const auto actual=process_stamp(guardians_[i].pid);
      if(actual.start!=guardians_[i].start || !actual.start || actual.owner!=guardians_[i].owner ||
         (actual.state!='S' && actual.state!='R' && actual.state!='D'))return false;
      if(!i && actual.parent!=guardians_[1].pid)return false;
    }
    return true;
  }
};
}  // namespace cgs1_supervisor
