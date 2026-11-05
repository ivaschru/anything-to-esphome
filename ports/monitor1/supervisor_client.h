#pragma once

// Native side of a pre-existing private supervisor socketpair. This does not
// discover a server, trust an environment string or grant hardware ownership.
// Bootstrap must independently validate the guardian PID/start/exe and pass
// the inherited endpoint. No password/key/configuration text crosses it.
#include "supervisor_channel.h"
#include <algorithm>
#include <poll.h>
#include <ctime>

namespace cgs1_supervisor {
inline uint64_t clock_ms() {
  timespec value{};
  if(::clock_gettime(CLOCK_MONOTONIC,&value) || value.tv_sec<0)return 0;
  return uint64_t(value.tv_sec)*1000+uint64_t(value.tv_nsec)/1000000;
}

class ChannelClient {
 public:
  ChannelClient() = default;
  ChannelClient(const ChannelClient &) = delete;
  ChannelClient &operator=(const ChannelClient &) = delete;
  ~ChannelClient() {if(fd_>=0)::close(fd_);}
  bool open(int fd,pid_t guardian,uid_t user) {
    if(attempted_)return false;
    attempted_=true;
    if(guardian<=1 || !configure_channel(fd,true))return false;
    fd_=fd;guardian_=guardian;user_=user;
    return true;
  }
  bool hello() {
    if(fd_<0 || faulted_ || hello_attempted_)return false;
    hello_attempted_=true;
    const Frame request{Kind::HELLO,0,0,clock_ms(),0};
    if(!request.monotonic_ms || send_frame(fd_,request)!=Send::SENT)return fault_();
    Frame ack;
    if(!acknowledgement_(request,ack) || !ack.generation)return fault_();
    generation_=ack.generation;sequence_=0;ready_=true;
    return true;
  }
  bool notify(Kind kind,uint64_t argument=0) {
    if(kind!=Kind::PULSE && kind!=Kind::OTA_PROGRESS)return fault_();
    if((kind==Kind::PULSE && argument) || argument>100000)return fault_();
    Frame request;
    return send_(kind,argument,request);
  }
  bool request(Kind kind) {
    switch(kind) {
      case Kind::READY:case Kind::OTA_BEGIN:case Kind::OTA_END:
      case Kind::RESTART:case Kind::EXIT_STOCK:case Kind::OTA_ABORT:break;
      default:return fault_();
    }
    Frame sent,ack;
    if(!send_(kind,0,sent) || !acknowledgement_(sent,ack))return fault_();
    if(kind==Kind::OTA_END || kind==Kind::RESTART || kind==Kind::EXIT_STOCK)waiting_=true;
    return true;
  }
  bool faulted() const {return faulted_;}
  bool awaiting_exec_or_exit() const {return waiting_;}
  uint64_t generation() const {return generation_;}
  Receive last_receive() const{return last_receive_;}

 private:
  int fd_{-1};pid_t guardian_{-1};uid_t user_{0};
  bool attempted_{false},hello_attempted_{false},ready_{false},faulted_{false},waiting_{false};
  uint64_t generation_{0},sequence_{0};
  Receive last_receive_{Receive::EMPTY};
  bool fault_() {faulted_=true;return false;}
  bool send_(Kind kind,uint64_t argument,Frame &sent) {
    if(!ready_ || faulted_ || waiting_ || sequence_==UINT64_MAX)return fault_();
    sent={kind,generation_,sequence_+1,clock_ms(),argument};
    if(!sent.monotonic_ms || send_frame(fd_,sent)!=Send::SENT)return fault_();
    ++sequence_;return true;
  }
  bool acknowledgement_(const Frame &request,Frame &ack) {
    const uint64_t started=clock_ms();
    if(!started || started>UINT64_MAX-5000)return false;
    const uint64_t end=started+5000;
    while(true) {
      const uint64_t now=clock_ms();
      if(!now || now<started || now>=end)return false;
      const auto result=receive_frame(fd_,guardian_,user_,ack);last_receive_=result;
      if(result==Receive::FRAME) {
        const uint64_t observed=clock_ms();
        return ack.kind==Kind::ACK && ack.sequence==request.sequence &&
          ack.argument==uint64_t(request.kind) && ack.monotonic_ms>=request.monotonic_ms &&
          observed>=started && observed<end && ack.monotonic_ms<=observed &&
          observed-ack.monotonic_ms<=2000 &&
          (request.kind==Kind::HELLO ? ack.generation>0 : ack.generation==generation_);
      }
      if(result!=Receive::EMPTY)return false;
      pollfd item{fd_,POLLIN,0};
      const int waited=::poll(&item,1,int(std::min<uint64_t>(20,end-now)));
      if(waited<0 && errno!=EINTR)return false;
      // Read queued data before treating HUP as failure: an ACK followed by
      // guardian exec/close is a valid end-of-session response. No resend.
    }
  }
};
}  // namespace cgs1_supervisor
