#pragma once

// Local screen events -> the existing guarded transaction, without ESPHome
// dependencies. Factory is a compile-time collaborator, never an API-selected
// implementation. The production binding below creates only NativeWifiTransaction.
//
// A successful submit means that a binary request was queued. It does not mean
// association, a DHCP ACK, or a saved network. In particular, the touch handler
// never performs WPA/file I/O while it borrows the password input buffer.
#include "wifi_request.h"
#include "wifi_forward_flow.h"
#include <memory>

namespace cgs1_wifi_local {
enum class Stage {IDLE,PREPARING,ASSOCIATING,DHCP,VERIFYING,READY,SAVING,SAVED,RETURNING};
enum class Failure {NONE,TIMEOUT,PROTECTION,UNKNOWN};
struct View {
  Stage stage{Stage::IDLE};Failure failure{Failure::NONE};
  std::string address;unsigned remaining_seconds{0};bool may_submit{true};
  bool operator==(const View&other)const {
    return stage==other.stage && failure==other.failure && address==other.address &&
      remaining_seconds==other.remaining_seconds && may_submit==other.may_submit;
  }
  bool operator!=(const View&other)const{return !(*this==other);}
};

template<class Factory>class Controller final {
 public:
  using Transaction=typename Factory::Transaction;
  explicit Controller(Factory&factory):factory_(factory){}
  Controller(const Controller&)=delete;Controller&operator=(const Controller&)=delete;
  bool submit(const std::string&ssid,const char*password,size_t size) {
    if(!view_.may_submit || return_required_)return false;
    cgs1_wifi_private::Network next;cgs1_wifi_request::Error error;
    if(!cgs1_wifi_request::derive(ssid,password,size,next,error))return false;
    // A prior SAVED means the real flow has already obtained dual retirement.
    // Only this new explicit screen submission may allocate the next actor;
    // no poll, lost acknowledgement, or status query retries the previous one.
    transaction_.reset();request_=next;queued_=true;confirmation_consumed_=false;
    view_={Stage::PREPARING,Failure::NONE,"",0,false};return true;
  }
  bool confirm() {
    if(!transaction_ || view_.stage!=Stage::READY || confirmation_consumed_ || return_required_)return false;
    // Consume before calling the transaction. A refusal is not a later click's
    // permission to replay; request recovery instead of keeping a false READY.
    confirmation_consumed_=true;
    if(!transaction_->confirm()){require_return_(Failure::PROTECTION);return false;}
    view_.stage=Stage::SAVING;return true;
  }
  bool cancel() {
    if(return_required_ || view_.stage==Stage::IDLE || view_.stage==Stage::SAVED || confirmation_consumed_)return false;
    // Queued input has not opened a plan or touched WPA. It can be erased
    // immediately, but still returns through the same native shutdown path.
    if(queued_){queued_=false;require_return_(Failure::NONE);return true;}
    if(!transaction_ || !transaction_->cancel())return false;
    require_return_(Failure::NONE);return true;
  }
  void poll() {
    if(return_required_)return;
    if(queued_) {
      // Consume the queue before any potentially blocking construction/read.
      // Failure is terminal for this native owner; it never starts a new plan.
      queued_=false;transaction_=factory_.make();
      const bool started=transaction_ && transaction_->begin(request_);
      request_=cgs1_wifi_private::Network{};
      if(!started){require_return_(Failure::PROTECTION);return;}
    }
    if(!transaction_)return;
    transaction_->poll();
    using F=cgs1_wifi_forward::FlowStage;
    const auto current=transaction_->stage();
    if(transaction_->recovery_required() || current==F::RECOVERY_REQUIRED) {
      const auto error=transaction_->error();
      require_return_(error==cgs1_wifi_forward::FlowError::TIMEOUT?Failure::TIMEOUT:
        error==cgs1_wifi_forward::FlowError::CANCELLED?Failure::NONE:Failure::PROTECTION);return;
    }
    // These are presentation mappings, not weaker versions of the transaction
    // guards. READY/SAVED come only from the existing lease/commit/retirement
    // flow. No cached IP, click, or lifecycle callback can manufacture them.
    switch(current) {
      case F::PREPARING:case F::SELECTING:view_.stage=Stage::PREPARING;break;
      case F::ASSOCIATING:view_.stage=Stage::ASSOCIATING;break;
      case F::DHCP:view_.stage=Stage::DHCP;break;
      case F::VERIFYING:view_.stage=Stage::VERIFYING;break;
      case F::READY:view_.stage=confirmation_consumed_?Stage::SAVING:Stage::READY;break;
      case F::RESTORING:case F::COMMITTING:case F::RECONCILING:case F::RETIRING:view_.stage=Stage::SAVING;break;
      case F::SAVED:view_.stage=Stage::SAVED;break;
      default:require_return_(Failure::PROTECTION);return;
    }
    view_.failure=Failure::NONE;view_.may_submit=current==F::SAVED;
    view_.remaining_seconds=transaction_->remaining_seconds();
    // Drop a previous address on loss of READY. A SAVED address is useful
    // display metadata, never a new connectivity proof after commit.
    view_.address=transaction_->address();
  }
  const View&view()const{return view_;}
  bool return_required()const{return return_required_;}
 private:
  Factory&factory_;std::unique_ptr<Transaction>transaction_;
  cgs1_wifi_private::Network request_;View view_;
  bool queued_{false},confirmation_consumed_{false},return_required_{false};
  void require_return_(Failure failure) {
    request_=cgs1_wifi_private::Network{};queued_=false;return_required_=true;
    view_={Stage::RETURNING,failure,"",0,false};
    // Do not destroy the live transaction here or restore configuration from
    // it. The outer runtime ends native; guardians retain the independent
    // death/exclusive-lock authority needed to restore its actual journal.
  }
};
} // namespace cgs1_wifi_local
