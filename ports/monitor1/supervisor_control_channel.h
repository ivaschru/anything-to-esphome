#pragma once

// Coordinator/guardian control is a different typed protocol from native
// lifecycle messages. Only numeric commands/nonce/sequence/time/reason cross
// an inherited private socketpair; no path, shell, password or executable.
// Distinct magic rejects a native lease packet on a control FD and vice versa.
#include "supervisor_client.h"
#include "supervisor_process_tree.h"

namespace cgs1_supervisor {
enum class Control : uint8_t {
  PREPARED=1,ACQUIRE=2,ACQUIRED=3,RELEASE_NATIVE=4,RECOVER=5,ALIVE=6,
  RECOVERED=7,REFUSED=8,ACK=9
};
struct ControlFrame {
  Control command{Control::REFUSED};
  uint64_t nonce{0},sequence{0},monotonic_ms{0},argument{0};
};
inline bool known_control(uint8_t value){return value>=1 && value<=9;}
inline Wire encode_control(const ControlFrame &value) {
  // Same bounded integer layout, intentionally different protocol magic.
  auto wire=encode({Kind(uint8_t(value.command)),value.nonce,value.sequence,value.monotonic_ms,value.argument});
  wire[2]='G';return wire;
}
inline bool decode_control(const Wire &wire,ControlFrame &out) {
  if(wire[0]!='C' || wire[1]!='S' || wire[2]!='G' || wire[3]!='1' || !known_control(wire[5]))return false;
  auto native_layout=wire;native_layout[2]='L';Frame value;
  if(!decode(native_layout,value) || !value.generation || !value.sequence || !value.monotonic_ms)return false;
  out={Control(wire[5]),value.generation,value.sequence,value.monotonic_ms,value.argument};return true;
}
inline bool control_nonce(const std::string &text,uint64_t &out) {
  if(text.size()!=16)return false;
  uint64_t value=0;
  for(char c:text) {
    if(!((c>='0' && c<='9') || (c>='a' && c<='f')))return false;
    value=(value<<4)|uint64_t(c<='9'?c-'0':c-'a'+10);
  }
  if(!value)return false;
  out=value;return true;
}
class ControlPeer {
 public:
  ControlPeer()=default;
  ControlPeer(const ControlPeer &)=delete;
  ControlPeer &operator=(const ControlPeer &)=delete;
  ~ControlPeer(){if(fd_>=0)::close(fd_);}
  bool open(int fd,const ProcessStamp &peer,uint64_t nonce) {
    if(attempted_)return false;
    attempted_=true;
    if(!nonce || peer.pid<=1 || !peer.start || !configure_channel(fd,true))return false;
    fd_=fd;peer_=peer;nonce_=nonce;return true;
  }
  bool send(Control command,uint64_t argument=0) {
    if(faulted_ || fd_<0 || !known_control(uint8_t(command)) || sent_==UINT64_MAX || !same_birth_())return fail_();
    const auto now=clock_ms();if(!now || now<last_sent_)return fail_();
    const ControlFrame value{command,nonce_,sent_+1,now,argument};
    if(send_wire(fd_,encode_control(value))!=Send::SENT)return fail_();
    ++sent_;last_sent_=now;return true;
  }
  Receive receive(ControlFrame &out) {
    // Preparation waits poll at 100 ms. Draining one old packet per poll
    // would merely keep pace with the heartbeat sender and leave ACQUIRED
    // stale behind that queue. Eight bounded packets catch up without an
    // unbounded read loop or postponing the caller's independent deadlines.
    for(unsigned drained=0;drained<8;++drained) {
    if(faulted_ || fd_<0 || !same_birth_()){fail_(20);return Receive::INVALID;}
    Wire wire{};const auto received=receive_wire(fd_,peer_.pid,peer_.owner,wire);
    if(received==Receive::EMPTY || received==Receive::CLOSED)return received;
    ControlFrame value;const auto now=clock_ms();
    if(received!=Receive::FRAME){fail_(21);return Receive::INVALID;}
    if(!decode_control(wire,value)){fail_(22);return Receive::INVALID;}
    if(value.nonce!=nonce_){fail_(23);return Receive::INVALID;}
    if(received_==UINT64_MAX || value.sequence!=received_+1){fail_(24);return Receive::INVALID;}
    if(!now || value.monotonic_ms>now){fail_(25);return Receive::INVALID;}
    if(value.monotonic_ms<last_received_){fail_(26);return Receive::INVALID;}
    if(now-value.monotonic_ms>2000) {
      // Stock retirement/image verification can queue ALIVE for more than
      // 2 s while still fitting the independent preparation/peer deadlines.
      // Consume only the authenticated next sequence of an argument-free
      // heartbeat; DO NOT return a frame or refresh any caller's liveness.
      // Stale commands, future times, wrong nonce/birth and replay still fail.
      // Eight packets per call bound drainage: an old queue cannot starve the
      // runner's 5 s peer check, native lease or hard session deadline.
      if(value.command!=Control::ALIVE || value.argument){fail_(27);return Receive::INVALID;}
      received_=value.sequence;last_received_=value.monotonic_ms;
      if(discarded_!=UINT64_MAX)++discarded_;
      continue;
    }
    received_=value.sequence;last_received_=value.monotonic_ms;out=value;return Receive::FRAME;
    }
    return Receive::EMPTY;
  }
  bool faulted() const{return faulted_;}
  uint64_t discarded_heartbeats() const{return discarded_;}
  unsigned diagnostic_failure() const{return failure_;}
 private:
  int fd_{-1};ProcessStamp peer_{};uint64_t nonce_{0},sent_{0},received_{0},last_sent_{0},last_received_{0},discarded_{0};
  bool attempted_{false},faulted_{false};unsigned failure_{0};
  bool fail_(unsigned reason=1){if(!faulted_)failure_=reason;faulted_=true;return false;}
  bool same_birth_() const {
    const auto current=process_stamp(peer_.pid);
    return current.start==peer_.start && current.owner==peer_.owner &&
           (current.state=='R' || current.state=='S' || current.state=='D');
  }
};
}  // namespace cgs1_supervisor
