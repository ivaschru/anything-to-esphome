#pragma once

// One automatic attempt per component lifetime, plus the backend's durable
// Linux-boot marker. This scheduler never retries a consumed attempt, even
// after staging, materialization or queueing fails. The existing independent
// coordinator/guardians remain responsible for hardware and stock fallback.
#include <cstdint>
namespace cgs1_supervisor {
enum class FullBootState:uint8_t {DISABLED,WAITING,STAGING,QUEUED,REFUSED};
enum class FullBootStage:uint8_t {MORE,READY,FAILED};
enum class FullBootQueue:uint8_t {WAIT_FOR_STOCK,QUEUED,FAILED,WAIT_FOR_DISPLAY};
template<class Backend> class FullBootFlow {
 public:
  explicit FullBootFlow(Backend &backend,uint64_t startup_settle_ms=15000)
      :backend_(backend),startup_settle_ms_(startup_settle_ms){}
  void start(bool enabled,uint64_t now) {
    if(started_)return;
    started_=true;started_at_=now;
    state_=enabled && now?FullBootState::WAITING:FullBootState::DISABLED;
  }
  void poll(uint64_t now) {
    if(state_==FullBootState::DISABLED || state_==FullBootState::QUEUED || state_==FullBootState::REFUSED)return;
    if(!now || now<started_at_ || now-started_at_>180000){state_=FullBootState::REFUSED;return;}
    if(state_==FullBootState::WAITING) {
      // The caller may require a longer initial vendor startup window. This
      // only postpones readiness reads; it does not extend the 180s deadline,
      // consume another attempt or relax any later DRM/process capture.
      if(now-started_at_<startup_settle_ms_ || (last_read_ && now-last_read_<1000))return;
      last_read_=now;
      if(!backend_.ready())return;
      state_=FullBootState::REFUSED; // Fail closed BEFORE durable intent.
      if(!backend_.consume())return;
      state_=FullBootState::STAGING;
    }
    if(state_==FullBootState::STAGING) {
      const auto progress=backend_.stage();
      if(progress==FullBootStage::FAILED){state_=FullBootState::REFUSED;return;}
      if(progress==FullBootStage::MORE)return;
      if(last_prepare_ && now-last_prepare_<1000)return;
      last_prepare_=now;
      state_=FullBootState::REFUSED; // Queue action is consumed regardless of ACK.
      const auto queued=backend_.prepare_and_launch();
      if(queued==FullBootQueue::QUEUED)state_=FullBootState::QUEUED;
      // This result is allowed only BEFORE prepare_attempted_, file creation,
      // queueing, fork or hardware actions. The unchanged complete stock
      // inspection is retried at <=1Hz within the original 180s bound.
      else if(queued==FullBootQueue::WAIT_FOR_STOCK)state_=FullBootState::STAGING;
      // A separately consumed known-miio repair can be asynchronous. This
      // wait never repeats its TERM/fork or grants a second native launch;
      // it shares the original180s deadline and <=1Hz admission cadence.
      else if(queued==FullBootQueue::WAIT_FOR_DISPLAY)state_=FullBootState::STAGING;
    }
  }
  FullBootState state()const{return state_;}
  void cancel_before_launch() {
    if(state_==FullBootState::WAITING || state_==FullBootState::STAGING)state_=FullBootState::DISABLED;
  }
 private:
  Backend &backend_;uint64_t startup_settle_ms_;FullBootState state_{FullBootState::DISABLED};
  bool started_{false};uint64_t started_at_{0},last_read_{0},last_prepare_{0};
};
} // namespace cgs1_supervisor
