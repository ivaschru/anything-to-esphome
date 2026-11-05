#pragma once

// Native-only orchestration of the already guarded forward adapters. All
// collaborators are compile-time types; production aliases are fixed. Nothing
// accepts remote success booleans, profile IDs, paths, commands or old lease
// generations. This does not use the older diagnostic policy's synthetic
// initial lease: the plan/Preparation verify the original catalog and private
// baseline, while ONLY a post-SELECT REQUEST/ACK + kernel + gateway observation
// can make the candidate READY or permit a durable commit.
//
// Cancellation/failure NEVER restores WPA from this still-live writer. The
// caller must end this native owner so the independent guardian can establish
// native-death/exclusive ownership and execute its existing recovery policy.
// RECOVERY_REQUIRED is not a receipt, retry permission or a "returned" result.
#include "wifi_forward_association.h"
#include "wifi_forward_refresh.h"
#include "wifi_guard_retirement.h"

namespace cgs1_wifi_forward {
enum class FlowStage {IDLE,PREPARING,SELECTING,ASSOCIATING,DHCP,VERIFYING,READY,
  RESTORING,COMMITTING,RECONCILING,RETIRING,SAVED,RECOVERY_REQUIRED};
enum class FlowError {NONE,PREPARATION,SELECTION,ASSOCIATION,CONNECTIVITY,
  TIMEOUT,CLOCK,CANCELLED,RESTORATION,COMMIT,RETIREMENT};
struct FlowClock {uint64_t now()const{return cgs1_dhcp_lease::capture_now_ms();}};

template<class Authority,class Preparation,class Selection,class Connection,
  class Refresh,class Restoration,class Retirement,class AssociationGate,class Clock=FlowClock>
class Flow {
 public:
  Flow(Authority&authority,Preparation&prepared,Selection&selection,Connection&connection,
      Refresh&refresh,Restoration&restoration,Retirement&retirement,AssociationGate&association):
    authority_(authority),prepared_(prepared),selection_(selection),connection_(connection),
    refresh_(refresh),restoration_(restoration),retirement_(retirement),association_(association){}
  Flow(const Flow&)=delete;Flow&operator=(const Flow&)=delete;
  bool begin(const cgs1_wifi_private::Network&network) {
    if(begun_ || !network.ssid_size || network.ssid_size>32 || !cgs1_wifi_guard::valid(authority_.forward_plan()))return false;
    begun_=true;request_=network;stage_=FlowStage::PREPARING;return true;
  }
  FlowStage stage()const{return stage_;}FlowError error()const{return error_;}
  bool recovery_required()const{return stage_==FlowStage::RECOVERY_REQUIRED;}
  const std::string&address()const{return address_;}
  unsigned remaining_seconds()const {
    const auto now=clock_.now();const auto&plan=authority_.forward_plan();
    return now>=plan.created_ms && now<plan.deadline_ms
      ?unsigned((plan.deadline_ms-now+999)/1000):0;
  }
  bool confirm() {
    // Consume the user's local intent once. The NEXT poll obtains a new
    // observation, then restoration and Store's own final publication gate
    // repeat their stronger checks. This click itself proves no connectivity.
    const auto now=clock_.now();
    if(stage_!=FlowStage::READY || confirmed_ || !now || now<last_ || now>=authority_.forward_plan().deadline_ms)return false;
    confirmed_=true;return true;
  }
  bool cancel() {
    if(!begun_ || confirmed_ || stage_==FlowStage::IDLE || stage_==FlowStage::SAVED ||
        stage_==FlowStage::RECOVERY_REQUIRED || post_commit_())return false;
    fail_(FlowError::CANCELLED);return true;
  }
  void poll() {
    if(!begun_ || stage_==FlowStage::SAVED || recovery_required())return;
    const auto now=clock_.now();const auto&plan=authority_.forward_plan();
    if(!now || now<plan.created_ms || now<last_){fail_(FlowError::CLOCK);return;}
    last_=now;
    // Once commit may have happened, expiry cannot authorize rollback or
    // a repeated write. Reconciliation is read-only and internally bounded;
    // retirement has its own independently checked 10-second deadline.
    if(!post_commit_() && now>=plan.deadline_ms){fail_(FlowError::TIMEOUT);return;}
    if(stage_==FlowStage::PREPARING) {
      const bool prepared=prepared_.prepare(plan.decision.transaction.c_str(),request_);
      request_=cgs1_wifi_private::Network{}; // Erase this extra request copy.
      if(!prepared){fail_(FlowError::PREPARATION);return;}
      stage_=FlowStage::SELECTING;return;
    }
    if(stage_==FlowStage::SELECTING) {
      const auto selected=selection_.start();
      if(selected==cgs1_wifi_switch::Reply::REFUSED || !selection_.sent()){fail_(FlowError::SELECTION);return;}
      stage_=FlowStage::ASSOCIATING;return; // AMBIGUOUS: observe, never resend.
    }
    if(stage_==FlowStage::ASSOCIATING) {
      if(now<next_probe_)return;
      next_probe_=now>UINT64_MAX-250?UINT64_MAX:now+250;const auto association=association_.poll();
      if(association==AssociationResult::FAILED){fail_(FlowError::ASSOCIATION);return;}
      if(association!=AssociationResult::COMPLETED)return;
      if(!connection_.start()){fail_(FlowError::CONNECTIVITY);return;}
      associated_=clock_.now();stage_=FlowStage::DHCP;return;
    }
    if(stage_==FlowStage::DHCP || stage_==FlowStage::VERIFYING || stage_==FlowStage::READY) {
      if(now<next_probe_ && !confirmed_)return;
      next_probe_=now>UINT64_MAX-250?UINT64_MAX:now+250;
      const auto observation=connection_.observe();const auto checked=clock_.now();
      if(checked<now || checked>=plan.deadline_ms){fail_(checked<now?FlowError::CLOCK:FlowError::TIMEOUT);return;}
      last_=checked;
      if(connection_.failed()){fail_(FlowError::CONNECTIVITY);return;}
      if(!healthy_(observation)) {
        // A pending Echo/queued packet is not failure or readiness. Any gap
        // restarts the five-second stable interval and revokes READY. A prior
        // confirmation cannot be carried over to a later unrelated interval.
        if(confirmed_){fail_(FlowError::CONNECTIVITY);return;}
        stable_=0;address_.clear();stage_=FlowStage::DHCP;
        if(!refresh_started_ && checked>=associated_ && checked-associated_>=1000) {
          refresh_started_=true;(void)refresh_.start();
          // A refused/not-BOUND refresh does not mean DHCP failed. Natural
          // DHCP may still finish; this consumed action is never retried.
          if(connection_.failed())fail_(FlowError::CONNECTIVITY);
        }
        return;
      }
      address_=observation.ipv4;
      if(!stable_)stable_=checked;
      if(checked<stable_){fail_(FlowError::CLOCK);return;}
      if(checked-stable_<5000){stage_=FlowStage::VERIFYING;return;}
      stage_=confirmed_?FlowStage::RESTORING:FlowStage::READY;return;
    }
    if(stage_==FlowStage::RESTORING) {
      if(restoration_.start()!=cgs1_wifi_switch::Reply::ACK){fail_(FlowError::RESTORATION);return;}
      stage_=FlowStage::COMMITTING;return;
    }
    if(stage_==FlowStage::COMMITTING) {
      const auto committed=authority_.commit_forward(connection_);
      if(committed==cgs1_wifi_switch::Reply::REFUSED){fail_(FlowError::COMMIT);return;}
      // Never call commit_forward again, including after an ambiguous reply.
      connection_.stop();stage_=committed==cgs1_wifi_switch::Reply::ACK?FlowStage::RETIRING:FlowStage::RECONCILING;return;
    }
    if(stage_==FlowStage::RECONCILING) {
      if(authority_.reconcile_forward_commit()!=cgs1_wifi_switch::Reply::ACK){fail_(FlowError::COMMIT);return;}
      stage_=FlowStage::RETIRING;return;
    }
    if(stage_==FlowStage::RETIRING) {
      if(!retirement_opened_) {
        retirement_opened_=true;
        if(!retirement_.open(prepared_.candidate())){fail_(FlowError::RETIREMENT);return;}
      }
      const auto result=retirement_.step();
      if(result==cgs1_wifi_retirement::Result::COMPLETE)stage_=FlowStage::SAVED;
      else if(result!=cgs1_wifi_retirement::Result::WAITING)fail_(FlowError::RETIREMENT);
    }
  }
 private:
  Authority&authority_;Preparation&prepared_;Selection&selection_;Connection&connection_;
  Refresh&refresh_;Restoration&restoration_;Retirement&retirement_;AssociationGate&association_;Clock clock_;
  cgs1_wifi_private::Network request_;FlowStage stage_{FlowStage::IDLE};FlowError error_{FlowError::NONE};
  bool begun_{false},confirmed_{false},refresh_started_{false},retirement_opened_{false};
  uint64_t last_{0},next_probe_{0},associated_{0},stable_{0};std::string address_;
  bool post_commit_()const {
    return stage_==FlowStage::RECONCILING || stage_==FlowStage::RETIRING;
  }
  bool healthy_(const cgs1_wifi_switch::Observation&observation)const {
    const auto&plan=authority_.forward_plan();
    return observation.verified && observation.completed && observation.id==prepared_.candidate() &&
      observation.lease_current && observation.route_bound && observation.gateway_reachable &&
      cgs1_wifi_switch::usable_ipv4(observation.ipv4) && observation.lease_generation>=plan.created_ms &&
      observation.lease_generation<plan.deadline_ms;
  }
  void fail_(FlowError error){request_=cgs1_wifi_private::Network{};connection_.stop();error_=error;stage_=FlowStage::RECOVERY_REQUIRED;}
};
} // namespace cgs1_wifi_forward
