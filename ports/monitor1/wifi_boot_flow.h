#pragma once

// One saved-network application per native owner. Factory is a compiled
// collaborator; production can create only NativeWifiTransaction. Boot never
// accepts SSIDs/passwords/paths or a caller-provided readiness/commit flag.
// A missing record or an already selected preferred SSID is a no-write result.
// Only a failed pre-plan SNAPSHOT may be observed again: begin_saved() has
// then created no Join/journal and issued no mutation. Every admitted flow,
// lost ACK, confirmation and failure is terminal for this controller.
#include "native_wifi_plan.h"
#include "wifi_forward_flow.h"
#include <memory>

namespace cgs1_wifi_boot {
enum class Stage {WAITING,APPLYING,NO_RECORD,ALREADY_CONNECTED,SAVED,UNAVAILABLE,RETURNING};
template<class Factory,class Clock=cgs1_wifi_forward::FlowClock>class Controller final {
 public:
  using Transaction=typename Factory::Transaction;
  explicit Controller(Factory&factory):factory_(factory){}
  Controller(const Controller&)=delete;Controller&operator=(const Controller&)=delete;
  Stage stage()const{return stage_;}
  bool finished()const{return stage_==Stage::NO_RECORD || stage_==Stage::ALREADY_CONNECTED ||
    stage_==Stage::SAVED || stage_==Stage::UNAVAILABLE;}
  bool return_required()const{return stage_==Stage::RETURNING;}
  unsigned observations()const{return observations_;}
  cgs1_wifi_forward::FlowStage flow_stage()const {
    return transaction_?transaction_->stage():cgs1_wifi_forward::FlowStage::IDLE;
  }
  void poll() {
    if(finished() || return_required())return;
    const auto now=clock_.now();
    if(!now || (last_ && now<last_)){fail_();return;}
    last_=now;
    if(stage_==Stage::WAITING) {
      if(!started_) {
        if(now>UINT64_MAX-20000){stage_=Stage::UNAVAILABLE;return;}
        started_=now;until_=now+20000;
      }
      if(now>=until_){stage_=Stage::UNAVAILABLE;return;}
      if(now<next_)return;
      next_=now+1000;++observations_;transaction_=factory_.make();
      if(!transaction_){stage_=Stage::UNAVAILABLE;return;}
      if(!transaction_->begin_saved()) {
        const auto error=transaction_->plan_error();transaction_.reset();
        if(error==cgs1_wifi_request::PlanError::SNAPSHOT)return;
        stage_=error==cgs1_wifi_request::PlanError::SAVED_RECORD?Stage::NO_RECORD:Stage::UNAVAILABLE;
        return;
      }
      if(transaction_->saved_skipped()){stage_=Stage::ALREADY_CONNECTED;return;}
      stage_=Stage::APPLYING;
    }
    // The transaction owns the stronger clock/lease/Store/guardian checks.
    // This policy never retries its start or calls guardian recovery while
    // native is alive. The runtime must terminate native on RETURNING.
    transaction_->poll();
    using F=cgs1_wifi_forward::FlowStage;
    if(transaction_->recovery_required() || transaction_->stage()==F::RECOVERY_REQUIRED){fail_();return;}
    if(transaction_->stage()==F::SAVED){stage_=Stage::SAVED;return;}
    if(transaction_->stage()==F::IDLE){fail_();return;}
    if(transaction_->stage()==F::READY && !confirmed_) {
      // The exact saved record is an already accepted preference. Apply its
      // confirmation once only after the SAME fresh DHCP/route/gateway and
      // stable interval used by the manual flow. This does not introduce a
      // new user choice or weaken commit/retirement publication checks.
      confirmed_=true;if(!transaction_->confirm())fail_();
    }
  }
  bool cancel() {
    if(finished() || return_required() || confirmed_)return false;
    if(stage_==Stage::WAITING){transaction_.reset();stage_=Stage::UNAVAILABLE;return true;}
    if(!transaction_ || !transaction_->cancel())return false;
    fail_();return true;
  }
 private:
  Factory&factory_;Clock clock_;std::unique_ptr<Transaction>transaction_;
  Stage stage_{Stage::WAITING};bool confirmed_{false};unsigned observations_{0};
  uint64_t started_{0},until_{0},next_{0},last_{0};
  void fail_() {
    // A clock failure before any admitted flow has nothing to roll back.
    stage_=stage_==Stage::APPLYING?Stage::RETURNING:Stage::UNAVAILABLE;
  }
};
} // namespace cgs1_wifi_boot
