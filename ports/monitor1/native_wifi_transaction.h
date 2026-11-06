#pragma once

// Fixed native request ownership. A local caller supplies only a derived
// binary Network. The live Scope, actual Store snapshot, CSPRNG plan builder
// and every writer/proof/retirement type are compiled here; callers cannot
// substitute a fixture, success flag, network ID, path or transport.
//
// begin() assembles/queues exactly one transaction. It performs no ADD/SELECT
// or durable decision; poll() subsequently runs the guarded flow. This class
// never performs guardian recovery while its native owner is still alive.
#include "native_wifi_plan.h"
#include "native_wifi_forward.h"
#include "native_wifi_scan.h"

namespace cgs1_supervisor {
class NativeWifiTransaction final {
 public:
  explicit NativeWifiTransaction(NativeWifiScope&scope):scope_(scope){}
  NativeWifiTransaction(const NativeWifiTransaction&)=delete;
  NativeWifiTransaction&operator=(const NativeWifiTransaction&)=delete;
  bool begin(const cgs1_wifi_private::Network&network) {
    if(attempted_)return false;
    attempted_=true;NativeWifiPlanBuilder builder(scope_);cgs1_wifi_guard::Plan plan;
    if(!builder.build(network,plan)){plan_error_=builder.error();return false;}
    // References below point only into this owned, immovable Join. Its
    // declaration order also makes destruction run flow/transport before
    // the immutable authority whose private key-bearing plan they reference.
    joined_=std::make_unique<Join>(scope_,std::move(plan));
    if(!joined_->flow.begin(network)){joined_.reset();return false;}
    return true;
  }
  bool begin_saved() {
    if(attempted_)return false;
    attempted_=true;NativeBootWifiPlanBuilder builder(scope_);cgs1_wifi_guard::Plan plan;
    if(!builder.build_saved(plan)){plan_error_=builder.error();return false;}
    // An existing stable preferred association needs no duplicate profile,
    // SELECT or flash commit. A different/no association follows exactly the
    // normal guarded flow with the already accepted saved preferred entry.
    if(builder.saved_preferred_connected()){saved_skip_=true;return true;}
    const auto network=plan.decision.desired.front();
    if(cgs1_wifi_prepare::unassociated(plan.catalog_mode) && !saved_visible_(network)) {
      // No transaction has been armed and no radio mutation was sent. An
      // absent/unknown cached AP is not a failure requiring stock takeover:
      // keep the full screen available for a new locally entered network.
      // Visible cached preference still follows the original verified flow.
      saved_deferred_=true;return true;
    }
    joined_=std::make_unique<Join>(scope_,std::move(plan));
    if(!joined_->flow.begin(network)){joined_.reset();return false;}
    return true;
  }
  bool saved_skipped()const{return saved_skip_;}
  bool saved_deferred()const{return saved_deferred_;}
  void poll(){if(joined_)joined_->flow.poll();}
  bool confirm(){return joined_ && joined_->flow.confirm();}
  bool cancel(){return joined_ && joined_->flow.cancel();}
  bool recovery_required()const{return joined_ && joined_->flow.recovery_required();}
  // Diagnostic observation only: this bit cannot authorize a SELECT, retry,
  // receipt or commit. It distinguishes admission refusal from an attempted
  // selection when changing Wi-Fi makes the native API briefly unreachable.
  bool selection_sent()const{return joined_ && joined_->selection.sent();}
  cgs1_wifi_request::PlanError plan_error()const{return plan_error_;}
  cgs1_wifi_forward::FlowStage stage()const {
    return joined_?joined_->flow.stage():cgs1_wifi_forward::FlowStage::IDLE;
  }
  cgs1_wifi_forward::FlowError error()const {
    return joined_?joined_->flow.error():cgs1_wifi_forward::FlowError::NONE;
  }
  unsigned remaining_seconds()const{return joined_?joined_->flow.remaining_seconds():0;}
  std::string address()const{return joined_?joined_->flow.address():"";}
  // Post-mortem diagnostics do not expose any transaction inputs or grant a
  // retry. The same real retirement object supplies these fixed observations.
  unsigned retirement_phase()const{return joined_?unsigned(joined_->retirement.phase()):0;}
  unsigned retirement_failed_from()const{return joined_?unsigned(joined_->retirement.failed_from()):0;}
  const char*retirement_check()const{return joined_?joined_->retirement.last_check():"not_created";}
  // Fixed diagnostic labels from the real connection object. Read-only
  // observation does not re-open capture or grant another start/SELECT.
  const char*connection_check()const{return joined_?joined_->connection.error().c_str():"not_created";}
  const char*authority_check()const{return joined_?joined_->authority.last_check():"not_created";}
 private:
  struct Join final {
    NativeWifiPrepareAuthority authority;NativeWifiPreparation prepared;
    NativeWifiSelection selection;NativeWifiConnectivity connection;
    NativeWifiRefresh refresh;NativeWifiRestoration restoration;
    NativeWifiRetirement retirement;NativeWifiAssociation association;NativeWifiFlow flow;
    Join(NativeWifiScope&scope,cgs1_wifi_guard::Plan plan):
      authority(scope,std::move(plan)),prepared(authority,authority.forward_plan().catalog_mode),selection(authority,prepared),
      connection(authority,prepared),refresh(authority,selection,connection),
      restoration(authority,prepared,connection),retirement(scope),association(authority,prepared),
      flow(authority,prepared,selection,connection,refresh,restoration,retirement,association){}
    Join(const Join&)=delete;Join&operator=(const Join&)=delete;
  };
  static bool saved_visible_(const cgs1_wifi_private::Network&network) {
    cgs1_wifi::NativeScanControl control;std::vector<cgs1_wifi_scan::Network>rows;
    const bool read=control.open() && control.read(rows);const bool closed=control.close();
    if(!read || !closed)return false;
    for(const auto&row:rows)if(row.supported && row.ssid.size()==network.ssid_size &&
        !std::memcmp(row.ssid.data(),network.ssid.data(),network.ssid_size))return true;
    return false;
  }
  NativeWifiScope&scope_;bool attempted_{false},saved_skip_{false},saved_deferred_{false};
  cgs1_wifi_request::PlanError plan_error_{cgs1_wifi_request::PlanError::NONE};
  std::unique_ptr<Join>joined_;
};
} // namespace cgs1_supervisor
