#pragma once

// Lease/generation rules for a dedicated Linux supervisor, not a hardware
// ownership grant. The adapter must first verify its own child PID/start,
// executable inode/hash/owner and recovery guardians; SCM_CREDENTIALS belongs
// to supervisor_channel.h. This class never signals a process or writes files.
#include "supervisor_channel.h"
#include "supervisor_image_types.h"
#include <algorithm>

namespace cgs1_supervisor {
struct Timing {
  uint64_t startup_ms{30000},lease_ms{10000},ota_ms{120000},exec_ms{30000},fresh_ms{2000};
  unsigned max_restarts{3};
  uint64_t restart_reset_ms{300000};
};
enum class Phase {IDLE,STARTING,RUNNING,OTA,WAITING_EXEC,STOP_REQUESTED,FAULT};
enum class Fault {NONE,CONFIG,CLOCK,DEADLINE,BAD_MESSAGE,BAD_STATE,REPLAY,IMAGE,RESTART_LIMIT,CHANNEL};
struct Reply {bool accepted{false},has_ack{false};Frame ack{};};

class Lease {
 public:
  bool begin(uint64_t now,const Image &image,const Timing &timing={}) {
    if(attempted_)return false;
    attempted_=true;timing_=timing;
    if(!now || !same_image(image,image) || timing.startup_ms<1000 || timing.startup_ms>120000 ||
       timing.lease_ms<1000 || timing.lease_ms>30000 || timing.ota_ms<1000 || timing.ota_ms>180000 ||
       timing.exec_ms<1000 || timing.exec_ms>120000 || !timing.fresh_ms ||
       timing.fresh_ms>2000 || timing.fresh_ms>timing.lease_ms ||
       !timing.max_restarts || timing.max_restarts>3 || timing.restart_reset_ms<60000 ||
       timing.restart_reset_ms>86400000) {fail(Fault::CONFIG);return false;}
    last_now_=now;image_=image;phase_=Phase::STARTING;
    return deadline_(now,timing_.startup_ms,deadline_at_);
  }
  Phase phase() const {return phase_;}
  Fault fault() const {return fault_;}
  uint64_t generation() const {return generation_;}
  uint64_t deadline() const {return deadline_at_;}
  void fail(Fault reason) {if(phase_!=Phase::FAULT){phase_=Phase::FAULT;fault_=reason;}}
  void tick(uint64_t now) {
    if(phase_==Phase::FAULT || phase_==Phase::STOP_REQUESTED || phase_==Phase::IDLE)return;
    if(!now || now<last_now_){fail(Fault::CLOCK);return;}
    last_now_=now;
    if(now>=deadline_at_ || (phase_==Phase::OTA && now>=ota_hard_deadline_))fail(Fault::DEADLINE);
  }
  Reply receive(const Frame &frame,uint64_t now,const Image &running,const Image &path={}) {
    // Expire BEFORE reading queued work. Receipt of a previously sent frame
    // cannot revive a lease that has already expired in the independent clock.
    tick(now);
    if(phase_==Phase::FAULT || phase_==Phase::STOP_REQUESTED || phase_==Phase::IDLE)return {};
    if(!frame.monotonic_ms || frame.monotonic_ms>now || now-frame.monotonic_ms>timing_.fresh_ms)
      return refused_(Fault::CLOCK);
    if(frame.kind==Kind::HELLO) {
      if(frame.generation || frame.sequence || frame.argument)return refused_(Fault::BAD_MESSAGE);
      if(phase_==Phase::STARTING && !hello_) {
        if(!same_image(running,image_))return refused_(Fault::IMAGE);
      } else if(phase_==Phase::WAITING_EXEC) {
        if(!same_image(running,next_image_))return refused_(Fault::IMAGE);
        image_=next_image_;phase_=Phase::STARTING;
      } else return refused_(Fault::BAD_STATE);
      if(generation_==UINT64_MAX)return refused_(Fault::REPLAY);
      ++generation_;sequence_=0;last_sent_=frame.monotonic_ms;hello_=true;
      // Keep the ORIGINAL startup/exec deadline. Repeated HELLO cannot buy
      // another grace period, even if the executable is still initializing.
      return acknowledged_(frame,now);
    }
    if(!hello_ || frame.generation!=generation_ || sequence_==UINT64_MAX ||
       frame.sequence!=sequence_+1 || !frame.sequence || frame.monotonic_ms<last_sent_)
      return refused_(Fault::REPLAY);
    if(!same_image(running,image_))return refused_(Fault::IMAGE);
    if(frame.kind!=Kind::OTA_PROGRESS && frame.argument)return refused_(Fault::BAD_MESSAGE);
    sequence_=frame.sequence;last_sent_=frame.monotonic_ms;
    switch(frame.kind) {
      case Kind::PULSE:
        if(phase_==Phase::RUNNING) {
          if(!deadline_(frame.monotonic_ms,timing_.lease_ms,deadline_at_))return {};
        } else if(phase_!=Phase::STARTING && phase_!=Phase::OTA)return refused_(Fault::BAD_STATE);
        // Pre-ready pulses do not extend startup, and UI pulses cannot hide
        // an OTA transfer that has stopped making byte progress.
        return {true,false,{}};
      case Kind::READY:
        if(phase_!=Phase::STARTING)return refused_(Fault::BAD_STATE);
        phase_=Phase::RUNNING;stable_since_=now;
        if(!deadline_(frame.monotonic_ms,timing_.lease_ms,deadline_at_))return {};
        return acknowledged_(frame,now);
      case Kind::OTA_BEGIN:
        if(phase_!=Phase::RUNNING)return refused_(Fault::BAD_STATE);
        if(!restart_allowed_(now))return {};
        phase_=Phase::OTA;progress_=0;stable_since_=0;
        if(!deadline_(now,timing_.ota_ms,ota_hard_deadline_) ||
           !deadline_(frame.monotonic_ms,timing_.lease_ms,deadline_at_))return {};
        return acknowledged_(frame,now);
      case Kind::OTA_PROGRESS:
        if(phase_!=Phase::OTA || frame.argument>100000 || frame.argument<progress_)
          return refused_(Fault::BAD_MESSAGE);
        if(frame.argument>progress_) {
          progress_=frame.argument;
          if(!deadline_(frame.monotonic_ms,timing_.lease_ms,deadline_at_))return {};
        }
        // Duplicate percentages may be harmless callbacks but grant no time.
        // Even genuine progress remains bounded by the total OTA deadline.
        return {true,false,{}};
      case Kind::OTA_END:
        if(phase_!=Phase::OTA)return refused_(Fault::BAD_STATE);
        // Host OTA must have atomically installed a verified new inode.
        // The adapter hashes that fixed private path; payload never supplies
        // a path/hash or permission to adopt an unrelated executable.
        if(!same_image(path,path) || same_image(path,image_))return refused_(Fault::IMAGE);
        next_image_=path;phase_=Phase::WAITING_EXEC;
        if(!deadline_(now,timing_.exec_ms,deadline_at_))return {};
        return acknowledged_(frame,now);
      case Kind::OTA_ABORT:
        if(phase_!=Phase::OTA)return refused_(Fault::BAD_STATE);
        // Only a failed download with the OLD verified image still at the
        // fixed path may resume. A published replacement cannot be ignored.
        if(!same_image(path,image_))return refused_(Fault::IMAGE);
        if(restarts_)--restarts_;  // No exec occurred: return the reserved slot.
        phase_=Phase::RUNNING;stable_since_=now;
        if(!deadline_(frame.monotonic_ms,timing_.lease_ms,deadline_at_))return {};
        return acknowledged_(frame,now);
      case Kind::RESTART:
        if(phase_!=Phase::RUNNING)return refused_(Fault::BAD_STATE);
        if(!restart_allowed_(now))return {};
        next_image_=image_;phase_=Phase::WAITING_EXEC;stable_since_=0;
        if(!deadline_(now,timing_.exec_ms,deadline_at_))return {};
        return acknowledged_(frame,now);
      case Kind::EXIT_STOCK:
        phase_=Phase::STOP_REQUESTED;
        return acknowledged_(frame,now);
      default:return refused_(Fault::BAD_MESSAGE);
    }
  }
 private:
  Timing timing_;Image image_,next_image_;
  Phase phase_{Phase::IDLE};Fault fault_{Fault::NONE};
  bool attempted_{false},hello_{false};unsigned restarts_{0};
  uint64_t generation_{0},sequence_{0},last_sent_{0},last_now_{0},deadline_at_{0};
  uint64_t ota_hard_deadline_{0},progress_{0},stable_since_{0};
  bool deadline_(uint64_t now,uint64_t duration,uint64_t &result) {
    if(now>UINT64_MAX-duration){fail(Fault::CLOCK);return false;}
    result=now+duration;return true;
  }
  Reply refused_(Fault fault) {fail(fault);return {};}
  Reply acknowledged_(const Frame &request,uint64_t now) const {
    return {true,true,{Kind::ACK,generation_,request.sequence,now,uint64_t(request.kind)}};
  }
  bool restart_allowed_(uint64_t now) {
    // Bound a restart LOOP, not all future maintenance in a weeks-long full
    // session. Only continuous RUNNING with live pulses earns a fresh budget;
    // tick() has already rejected a gap or clock reversal before this point.
    if(stable_since_ && now>=stable_since_ && now-stable_since_>=timing_.restart_reset_ms)restarts_=0;
    if(restarts_>=timing_.max_restarts){fail(Fault::RESTART_LIMIT);return false;}
    ++restarts_;return true;
  }
};
}  // namespace cgs1_supervisor
