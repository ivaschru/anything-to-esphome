#pragma once

// Experimental native-only binding. Including this file does not install
// callbacks or start a network operation. Only a profile's explicit loop()
// call can attach it after the real native display/session became ready.
// No maintenance action, remote password input, or fixture factory is exposed.
#include "full_native_runtime.h"
#include "wifi_local_flow.h"
#include "native_wifi_scan.h"
#include "wifi_boot_flow.h"

namespace cgs1_native_wifi_ui {
inline bool transition_idle();
class Factory final {
 public:
  using Transaction=cgs1_supervisor::NativeWifiTransaction;
  explicit Factory(cgs1_supervisor::NativeFullBootstrap&bootstrap):scope_(bootstrap){}
  std::unique_ptr<Transaction>make(){return std::make_unique<Transaction>(scope_);}
 private:
  cgs1_supervisor::NativeWifiScope scope_;
};
class Runtime final {
 public:
  Runtime(cgs1_supervisor::NativeFullBootstrap&bootstrap,esphome::cgs1_panel::Panel&panel):
    factory_(bootstrap),controller_(factory_),boot_(factory_),panel_(panel) {
    if(!cgs1_full::session.attach_transition_guard(cgs1_native_wifi_ui::transition_idle))std::_Exit(73);
    // Discovery is an explicit local screen request. It does not start on
    // construction/boot and cannot run alongside a credential transaction.
    panel_.set_wifi_actions([this]{request_scan_();},[this](const std::string&ssid,const char*password,size_t size){
      if(!interactive_() || !boot_.finished() || scan_requested_ || scanning_())return false;
      return controller_.submit(ssid,password,size);
    },[this]{return interactive_() && boot_.finished() && controller_.confirm();},
      [this]{return interactive_() && (boot_.finished()?controller_.cancel():boot_.cancel());});
    publish_();
  }
  void loop() {
    // A previously accepted stock-return/restart has precedence. Do not
    // advance a queued credential operation during its response grace period.
    if(!interactive_())return;
    if(!boot_.finished()) {
      boot_.poll();publish_boot_();
      if(boot_.return_required() && !return_queued_)return_queued_=cgs1_full::request_return();
      if(!boot_.finished())return;
      // Release all displayed boot metadata before the manual editor becomes
      // available. No boot result can become a later manual READY/confirmation.
      published_once_=false;
    }
    scan_loop_();controller_.poll();publish_();
    if(controller_.return_required() && !return_queued_)
      return_queued_=cgs1_full::request_return();
  }
  bool transition_idle()const {
    return boot_.finished() && !scan_requested_ && !scanning_() && !controller_.return_required() &&
      (controller_.view().stage==cgs1_wifi_local::Stage::IDLE ||
       controller_.view().stage==cgs1_wifi_local::Stage::SAVED);
  }
  void report(JsonObject root)const {
    // Fixed, read-only diagnostics only. No SSID, credential, network ID,
    // private record, path or caller-supplied recovery authority is returned.
    root["initialized"]=true;root["boot_stage"]=unsigned(boot_.stage());
    root["boot_flow_stage"]=unsigned(boot_.flow_stage());
    root["boot_observations"]=boot_.observations();
    root["boot_finished"]=boot_.finished();root["boot_return_required"]=boot_.return_required();
    root["manual_stage"]=unsigned(controller_.view().stage);
    root["manual_may_submit"]=controller_.view().may_submit && boot_.finished();
  }
 private:
  Factory factory_;cgs1_wifi_local::Controller<Factory>controller_;
  cgs1_wifi_boot::Controller<Factory>boot_;
  esphome::cgs1_panel::Panel&panel_;cgs1_wifi_local::View published_;
  bool published_once_{false},return_queued_{false};
  using Scan=cgs1_wifi_scan::Session<cgs1_wifi::NativeScanControl,cgs1_wifi_forward::FlowClock>;
  // Session holds references: destroy it before its transport, including on
  // an explicit later user refresh. Neither object is copied across requests.
  std::unique_ptr<cgs1_wifi::NativeScanControl>scan_transport_;
  cgs1_wifi_forward::FlowClock scan_clock_;std::unique_ptr<Scan>scan_;
  bool scan_requested_{false},scan_published_{false};
  bool interactive_()const {
    return cgs1_full::display_valid() && !cgs1_full::restart.pending() && !cgs1_full::return_requested_at &&
      cgs1_full::session.state()==cgs1_supervisor::NativeState::RUNNING;
  }
  bool scanning_()const{return scan_ && scan_->state()==cgs1_wifi_scan::State::WAITING;}
  void request_scan_() {
    if(!interactive_() || !boot_.finished() || !controller_.view().may_submit || scan_requested_ || scanning_())return;
    scan_requested_=true;panel_.set_wifi_networks({},true);
  }
  void scan_loop_() {
    if(scan_requested_) {
      scan_requested_=false;scan_.reset();scan_transport_=std::make_unique<cgs1_wifi::NativeScanControl>();
      scan_=std::make_unique<Scan>(*scan_transport_,scan_clock_);scan_published_=false;
      (void)scan_->start();
    }
    if(!scan_ || scan_published_)return;
    scan_->poll();if(scanning_())return;
    std::vector<esphome::cgs1_panel::WifiNetwork>networks;
    if(scan_->state()==cgs1_wifi_scan::State::COMPLETE)for(const auto&network:scan_->networks())
      networks.push_back({network.ssid,network.label,network.supported});
    panel_.set_wifi_networks(std::move(networks),false);scan_published_=true;
  }
  void publish_() {
    const auto&view=controller_.view();if(published_once_ && view==published_)return;
    using Local=cgs1_wifi_local::Stage;using Screen=esphome::cgs1_panel::WifiStage;
    Screen stage=Screen::RETURNING;
    switch(view.stage) {
      case Local::IDLE:stage=Screen::IDLE;break;
      case Local::PREPARING:stage=Screen::PREPARING;break;
      case Local::ASSOCIATING:stage=Screen::ASSOCIATING;break;
      case Local::DHCP:stage=Screen::DHCP;break;
      case Local::VERIFYING:stage=Screen::VERIFYING;break;
      case Local::READY:stage=Screen::READY;break;
      case Local::SAVING:stage=Screen::SAVING;break;
      case Local::SAVED:stage=Screen::SAVED;break;
      case Local::RETURNING:stage=Screen::RETURNING;break;
    }
    using Failure=esphome::cgs1_panel::WifiFailure;
    const auto failure=view.failure==cgs1_wifi_local::Failure::TIMEOUT?Failure::TIMEOUT:
      view.failure==cgs1_wifi_local::Failure::PROTECTION?Failure::PROTECTION:
      view.failure==cgs1_wifi_local::Failure::NONE?Failure::NONE:Failure::UNKNOWN;
    panel_.set_wifi_state(stage,failure,view.address,view.remaining_seconds,view.may_submit);
    published_=view;published_once_=true;
  }
  void publish_boot_() {
    using Screen=esphome::cgs1_panel::WifiStage;
    using F=cgs1_wifi_forward::FlowStage;
    Screen stage=Screen::PREPARING;
    const auto current=boot_.flow_stage();
    if(boot_.return_required())stage=Screen::RETURNING;
    else if(current==F::ASSOCIATING)stage=Screen::ASSOCIATING;
    else if(current==F::DHCP)stage=Screen::DHCP;
    else if(current==F::VERIFYING)stage=Screen::VERIFYING;
    else if(current==F::READY || current==F::RESTORING || current==F::COMMITTING ||
        current==F::RECONCILING || current==F::RETIRING)stage=Screen::SAVING;
    panel_.set_wifi_state(stage,boot_.return_required()?esphome::cgs1_panel::WifiFailure::PROTECTION:
      esphome::cgs1_panel::WifiFailure::NONE,"",0,false);
  }
};
inline std::unique_ptr<Runtime>runtime;
inline bool transition_idle(){return runtime && runtime->transition_idle();}
inline void report(JsonObject root){if(runtime)runtime->report(root);else root["initialized"]=false;}
inline void loop(esphome::cgs1_panel::Panel&panel) {
  if(!runtime) {
    if(!panel.ready() || !cgs1_full::display_valid() ||
        cgs1_full::session.state()!=cgs1_supervisor::NativeState::RUNNING)return;
    runtime=std::make_unique<Runtime>(cgs1_full::bootstrap,panel);
  }
  runtime->loop();
}
} // namespace cgs1_native_wifi_ui
