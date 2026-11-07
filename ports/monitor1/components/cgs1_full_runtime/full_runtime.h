#pragma once

// Thin encrypted-API facade. Hardware grant/producer recovery lives in the
// separately exec'ed guardian, not a lambda/client request in this component.
#include "esphome/core/component.h"
#include "esphome/components/json/json_util.h"
#include "supervisor_full_coordinator.h"
#include "supervisor_bridge_policy.h"
#include "supervisor_ram_budget.h"
#include "supervisor_full_diagnostics_json.h"
#include "supervisor_full_reclaim.h"
#include "supervisor_wifi_private_root.h"
#include "wifi_store_install.h"
#include "post_return_wifi_link.h"
#include "post_return_network_recovery.h"
#include "full_release_store.h"
#include "full_boot_flow.h"
#include "core_reboot_flow.h"
#include "core_display_admission.h"
#include <sys/reboot.h>

namespace esphome::cgs1_full_runtime {
class FullRuntime : public Component {
 public:
  void set_api(api::APIServer *value){api_=value;}
  void set_ota(ESPHomeOTAComponent *value){ota_=value;}
  void set_recover_original_network_after_return(bool value){recover_original_network_=value;}
  void set_core_release_autostart(bool value){core_release_autostart_=value;}
  void set_artifact(int index,uint32_t size,const char *sha) {
    if(index>=0 && index<2)manifest_[size_t(index)]={size,sha};
  }
  float get_setup_priority() const override{return setup_priority::LATE;}
  void setup() override {
    if(!api_ || !ota_){error_="api_and_noise_ota_required";return;}
    stage_=std::make_unique<cgs1_net_trial::FullStaging>(manifest_);
    materialized_=std::make_unique<cgs1_supervisor::FullMaterialize>();
    policy_=std::make_unique<cgs1_supervisor::Cgs1BridgePolicy>(*api_,*ota_);
    coordinator_=std::make_unique<Coordinator>(*policy_);
    boot_backend_.owner=this;
    reboot_backend_.owner=this;
    reboot_flow_=std::make_unique<RebootFlow>(reboot_backend_);
    boot_flow_=std::make_unique<BootFlow>(boot_backend_,VENDOR_STARTUP_SETTLE_MS);
    // Missing/invalid own mode leaves stock running. Setup never creates a
    // directory or infers activation from merely finding installed files.
    bool enabled=false;
    if(core_release_autostart_ && open_core_store_(false))enabled=core_store_->enabled();
    boot_flow_->start(enabled,cgs1_supervisor::clock_ms());
  }
  void loop() override {
    if(!coordinator_)return;
    coordinator_->poll();
    if(reboot_flow_)reboot_flow_->poll(cgs1_supervisor::clock_ms());
    if(boot_flow_)boot_flow_->poll(cgs1_supervisor::clock_ms());
    if(core_release_autostart_ && !boot_return_handled_ && coordinator_->acquired() &&
        coordinator_->phase()==cgs1_supervisor::CoordinatorPhase::RETURNED) {
      // Any completed return (requested or fault) opts out durably. Stock
      // fallback must survive the next power cycle, not just this process.
      // A failed write is reported; the consumed boot marker still prevents
      // an automatic retry during the present Linux boot.
      boot_return_handled_=true;
      boot_return_mode_saved_=open_core_store_(false) && core_store_->set_enabled(false);
    }
    if(!post_wifi_attempted_ && coordinator_->acquired() &&
        coordinator_->phase()==cgs1_supervisor::CoordinatorPhase::RETURNED) {
      // This is a live lifecycle join, never a caller job/boolean or a read
      // of a historical RAM directory after OTA. It starts only after all
      // existing return/reopen gates passed, and cannot delay those gates.
      post_wifi_attempted_=true;
      if(recover_original_network_) {
        // One compiled opt-in, one adapter for this actual return. Reuse its
        // observation for reporting instead of hashing stock images twice.
        post_network_=std::make_unique<cgs1_returned_network::Backend>(coordinator_->returned_session());
        post_recovery_=std::make_unique<cgs1_returned_network::Recovery<>>(*post_network_);
        post_recovery_->open();
      }else {
        post_wifi_=std::make_unique<cgs1_returned_wifi::Observation>(coordinator_->returned_session());
        post_wifi_opened_=post_wifi_->open();
      }
    }
    if(post_wifi_)post_wifi_->poll(); // Internally <=1Hz and <=60s, no signal.
    if(post_network_)post_network_->poll_observation();
    if(post_recovery_)post_recovery_->poll();
  }
  bool ok() const{return ok_;}
  std::string error() const{return error_;}
  void install_core_release(StringRef job,JsonObject root) {
    root["ok"]=false;root["vendor_boot_files_changed"]=false;
    if(!core_release_autostart_ || !quiet_stock_()) {root["error"]="core_profile_and_quiet_stock_required";return;}
    if(!open_core_store_(true)) {root["error"]=boot_error_;return;}
    const bool installed=core_store_->install(text_(job));
    root["ok"]=installed;root["error"]=installed?"":core_store_->error();
    root["enabled"]=core_store_->enabled();
  }
  void set_core_boot_mode(bool enabled,JsonObject root) {
    root["ok"]=false;root["enabled"]=false;
    if(!core_release_autostart_ || !quiet_stock_() || !open_core_store_(false)) {
      root["error"]="core_profile_quiet_stock_and_store_required";return;
    }
    const bool saved=core_store_->set_enabled(enabled);
    if(saved && !enabled && boot_flow_)boot_flow_->cancel_before_launch();
    root["ok"]=saved;root["error"]=saved?"":core_store_->error();root["enabled"]=core_store_->enabled();
  }
  void start_installed_core(JsonObject root) {
    root["ok"]=false;
    // Explicit current-boot activation uses the same once-per-boot flow as
    // startup. No file stream, shell/path or bypass of board/RAM gates exists.
    if(!core_release_autostart_ || installed_start_requested_ || !quiet_stock_() ||
        !stage_ || !stage_->job().empty() || !boot_flow_ ||
        boot_flow_->state()!=cgs1_supervisor::FullBootState::DISABLED ||
        !open_core_store_(false) || !core_store_->enabled()) {
      root["error"]="enabled_unattempted_installed_core_required";return;
    }
    installed_start_requested_=true;
    boot_flow_=std::make_unique<BootFlow>(boot_backend_,VENDOR_STARTUP_SETTLE_MS);
    boot_flow_->start(true,cgs1_supervisor::clock_ms());root["ok"]=true;
  }
  void reboot_core_device(StringRef expected_boot_id,JsonObject root) {
    root["ok"]=false;root["queued"]=false;
    // An explicit exact boot ID prevents accidentally restarting a replacement
    // appliance/boot after a stale plan. All state/files are rechecked again
    // by the deferred poll immediately before the fixed Linux syscall.
    const auto current=cgs1_net_trial::read_small("/proc/sys/kernel/random/boot_id",64);
    if(current!=text_(expected_boot_id)+"\n" || !reboot_flow_) {
      root["error"]="exact_current_boot_required";return;
    }
    const bool queued=reboot_flow_->request(cgs1_supervisor::clock_ms());
    root["ok"]=queued;root["queued"]=queued;root["error"]=queued?"":"verified_enabled_core_and_quiet_stock_required";
  }
  void new_session(StringRef previous_job,JsonObject root) {
    const auto previous=text_(previous_job);root["ok"]=false;root["previous_job"]=previous;
    root["programs_and_evidence_preserved"]=true;root["hardware_or_network_mutations"]=false;
    if(!last_reset_job_.empty() && previous==last_reset_job_) {
      // Reconcile a lost ACK without abandoning a later queued/active job.
      root["ok"]=true;root["already_reset"]=true;return;
    }
    if(previous.empty() || !stage_ || stage_->job()!=previous || !coordinator_ ||
        !coordinator_->quiescent_for_new_session() || !policy_) {
      root["error"]="exact_terminal_quiescent_session_required";return;
    }
    if(post_recovery_) {
      const auto state=post_recovery_->state();
      if(state!=cgs1_returned_network::State::READY && state!=cgs1_returned_network::State::SKIPPED &&
          state!=cgs1_returned_network::State::REFUSED && state!=cgs1_returned_network::State::EXPIRED) {
        root["error"]="post_return_network_operation_still_active";return;
      }
    }
    cgs1_net_trial::StockInspection stock;cgs1_supervisor::OriginalEffects effects;
    if(!policy_->capture(stock,effects)) {root["error"]="fresh_fixed_stock_required";return;}
    // Allocate the empty replacements first. No file is removed, no previous
    // nonce is reused and no hardware action is queued here. Destruction order
    // closes captures before the scope anchor and its materialized runtime FD.
    auto stage=std::make_unique<cgs1_net_trial::FullStaging>(manifest_);
    auto materialized=std::make_unique<cgs1_supervisor::FullMaterialize>();
    auto coordinator=std::make_unique<Coordinator>(*policy_);
    post_recovery_.reset();post_network_.reset();post_wifi_.reset();
    coordinator_.reset();materialized_.reset();stage_.reset();
    stage_=std::move(stage);materialized_=std::move(materialized);coordinator_=std::move(coordinator);
    post_wifi_attempted_=false;post_wifi_opened_=false;prepared_attempted_=false;
    boot_return_handled_=false;boot_return_mode_saved_=false;
    last_reset_job_=previous;ok_=true;error_.clear();
    root["ok"]=true;root["already_reset"]=false;
  }
  void purge_inactive_cache(StringRef job,StringRef native_sha,StringRef guardian_sha,JsonObject root) {
    const auto name=text_(job),native=text_(native_sha),guardian=text_(guardian_sha);
    if(last_cache_purge_attempted_ && name==last_cache_purge_job_ &&
        native==last_cache_purge_hashes_[0] && guardian==last_cache_purge_hashes_[1]) {
      cache_report_(root);return;
    }
    if((stage_ && stage_->job()==name) || !coordinator_ || !policy_ ||
        coordinator_->phase()!=cgs1_supervisor::CoordinatorPhase::IDLE ||
        native!=manifest_[0].sha256 || guardian!=manifest_[1].sha256) {
      root["ok"]=false;root["error"]="idle_historical_exact_compiled_cache_required";return;
    }
    cgs1_net_trial::StockInspection stock;cgs1_supervisor::OriginalEffects effects;
    if(!policy_->capture(stock,effects)) {root["ok"]=false;root["error"]="fresh_fixed_stock_required";return;}
    last_cache_purge_=cgs1_supervisor::FullReclaim{};
    last_cache_purge_job_=name;last_cache_purge_hashes_={native,guardian};
    last_cache_purge_attempted_=true; // Before any possible unlink/uncertain ACK.
    last_cache_purge_ok_=last_cache_purge_.purge_inactive_cache(name,native,guardian);
    cache_report_(root);
  }
  void inspect_start(JsonObject root) const {
    // Read the SAME fixed board capture used immediately before guardian
    // creation. This creates no plan/file/lease, suspends nothing and cannot
    // queue a launch. A successful read is historical metadata only: spawn_
    // must still repeat its own complete capture after the request response.
    root["ok"]=false;root["read_only"]=true;
    root["process_signals_exposed"]=false;root["network_mutations_exposed"]=false;
    if(!policy_ || !coordinator_ || coordinator_->phase()!=cgs1_supervisor::CoordinatorPhase::IDLE) {
      root["error"]="idle_bridge_required";return;
    }
    cgs1_net_trial::StockInspection stock;cgs1_supervisor::OriginalEffects effects;
    const bool captured=policy_->capture(stock,effects);
    root["ok"]=captured;root["error"]=policy_->capture_error();
    root["stock_error"]=policy_->capture_stock_error();
    if(captured) {
      root["boot_id"]=stock.boot_id;root["bridge_sha256"]=stock.bridge_sha;
      root["pm_enabled"]=effects.pm_enabled;root["pm_mux"]=effects.pm_mux;
      root["brightness"]=effects.brightness;
    }
  }
  void install_wifi_store(JsonObject root) const {
    // Installation is allowed only while the real stock application is
    // available and no full takeover owns hardware. It creates one fixed own
    // directory, never a Store decision or a supplicant configuration.
    root["ok"]=false;root["created"]=false;
    if(!coordinator_ || coordinator_->phase()!=cgs1_supervisor::CoordinatorPhase::IDLE) {
      root["error"]="idle_bridge_required";return;
    }
    cgs1_net_trial::StockInspection stock;
    cgs1_supervisor::RunnerWifiPrivateRoot parent;
    if(!stock.inspect() || !cgs1_net_trial::DisplayMaintenance::handoff_objection(stock).empty() || !parent.open()) {
      root["error"]="fresh_uncontested_stock_and_private_parent_required";return;
    }
    const int held=parent.duplicate();cgs1_wifi_private::DirectoryInstallation operation;
    const bool installed=held>=0 && operation.ensure(held);const bool closed=held<0 || !::close(held);
    root["created"]=operation.created();
    const bool verified=installed && closed && parent.current();
    root["ok"]=verified;
    root["error"]=verified?"":"private_wifi_directory_installation_unverified";
  }
  void begin(StringRef job,StringRef kind) {
    ok_=false;error_.clear();
    if(!stage_){error_="not_initialized";return;}
    if(stage_->job().empty()) {
      cgs1_net_trial::StockInspection stock;
      if(!stock.inspect()){error_="fresh_fixed_cgs1_inspection_required";return;}
      if(!ram_fits_(2*image_bytes_()+STARTUP_RESERVE)){error_="insufficient_ram_headroom_for_full_release";return;}
    }
    result_(stage_->begin(text_(job),cgs1_net_trial::FullStaging::kind(text_(kind))));
  }
  void chunk(StringRef job,StringRef kind,int offset,StringRef hex) {
    if(!stage_){ok_=false;error_="not_initialized";return;}
    result_(stage_->append(text_(job),cgs1_net_trial::FullStaging::kind(text_(kind)),offset,hex.c_str(),hex.size()));
  }
  void seal(StringRef job,StringRef kind) {
    if(!stage_){ok_=false;error_="not_initialized";return;}
    result_(stage_->seal(text_(job),cgs1_net_trial::FullStaging::kind(text_(kind))));
  }
  void prepare(StringRef job) {
    ok_=false;error_.clear();
    if(!stage_ || stage_->job()!=text_(job) || prepared_attempted_) {
      error_="ready_unprepared_full_job_required";return;
    }
    cgs1_net_trial::StockInspection stock;
    if(!stock.inspect()) {
      error_="fresh_uncontested_stock_required";return;
    }
    const auto display=cgs1_net_trial::DisplayMaintenance::handoff_objection(stock);
    if(core_release_autostart_) {
      // Only the ordinary core profile can spend this fixed known-miio
      // repair. Keep the legacy trial feature disabled. No native output,
      // stock termination or guardian creation occurs while it is pending.
      if(!coordinator_ || coordinator_->phase()!=cgs1_supervisor::CoordinatorPhase::IDLE) {
        error_="idle_core_required_before_display_admission";return;
      }
      const auto state=core_display_.step(stock,display);
      if(state!=cgs1_supervisor::CoreDisplayState::READY) {
        error_=state==cgs1_supervisor::CoreDisplayState::WAITING?
          "core_display_repair_pending":"core_display_admission_refused";return;
      }
    }else if(!display.empty()) {error_="fresh_uncontested_stock_required";return;}
    if(!ram_fits_(image_bytes_()+STARTUP_RESERVE)){error_="insufficient_ram_headroom_for_materialization";return;}
    prepared_attempted_=true;ok_=materialized_->prepare(*stage_);
    if(!ok_){error_="full_materialization_refused_partial_output_preserved";return;}
    // Reclaim newly redundant uploads before granting startup readiness.
    // Peak staging/materialization and native-start RAM thresholds stay the
    // same. This reduces actual tmpfs use instead of lowering a safety bound.
    ok_=materialized_->release_uploads();
    if(!ok_)error_="upload_duplicate_release_failed_output_preserved";
  }
  void launch(StringRef job,cgs1_supervisor::FullRunMode mode=cgs1_supervisor::FullRunMode::PERMANENT) {
    ok_=false;error_.clear();
    if(!stage_ || !coordinator_ || stage_->job()!=text_(job)) {error_="full_job_mismatch";return;}
    if(!materialized_->uploads_released()){error_="completed_full_preparation_required";return;}
    if(!ram_fits_(STARTUP_RESERVE)){error_="insufficient_ram_headroom_for_native_startup";return;}
    // request() queues only; component.loop() performs fork/pause after the
    // action's response has left its API connection stack.
    ok_=coordinator_->request(*materialized_,stage_->job(),{},mode);
    if(!ok_)error_=coordinator_->error();
  }
  void report(JsonObject root) const {
    root["core_release_autostart_supported"]=core_release_autostart_;
    root["hard_runtime_ms"]=coordinator_?coordinator_->hard_runtime_ms():0;
    root["core_boot_state"]=boot_flow_?unsigned(boot_flow_->state()):0;
    root["core_boot_error"]=boot_error_;
    root["core_boot_enabled"]=core_parent_ && core_parent_->current() && core_store_ && core_store_->enabled();
    root["core_boot_job"]=boot_job_;
    root["core_display_repair_requested"]=core_display_.requested();
    root["core_display_repair_completed"]=core_display_.completed();
    root["core_display_admission_error"]=core_display_.error();
    root["core_display_repair_state"]=core_display_.repair_state();
    root["core_display_repair_error"]=core_display_.repair_error();
    root["core_return_mode_saved"]=boot_return_mode_saved_;
    root["core_reboot_requested"]=reboot_flow_ && reboot_flow_->requested();
    root["core_reboot_consumed"]=reboot_flow_ && reboot_flow_->consumed();
    root["core_reboot_errno"]=reboot_errno_;
    if(policy_) {
      root["board_capture_error"]=policy_->capture_error();
      root["board_capture_stock_error"]=policy_->capture_stock_error();
    }
    const auto ram=cgs1_supervisor::read_ram_budget();
    root["ram_budget_known"]=ram.known;root["ram_reclaim_estimate_bytes"]=ram.reclaim_estimate_bytes;
    root["ram_total_bytes"]=ram.total_bytes;root["ram_initial_required_bytes"]=2*image_bytes_()+STARTUP_RESERVE;
    root["ok"]=ok_;root["error"]=error_;root["hardware_trial_active"]=false;
    root["materialized"]=materialized_ && materialized_->ready();
    root["upload_duplicates_released"]=materialized_ && materialized_->uploads_released();
    root["released_upload_bytes"]=materialized_?materialized_->released_upload_bytes():0;
    if(stage_) {
      root["job"]=stage_->job();root["ready"]=stage_->ready();
      auto artifacts=root["artifacts"].to<JsonArray>();
      for(unsigned i=0;i<2;++i) {
        auto row=artifacts.add<JsonObject>();row["kind"]=cgs1_net_trial::FullStaging::NAMES[i];
        row["size"]=manifest_[i].size;row["sha256"]=manifest_[i].sha256;
        row["offset"]=stage_->offset(int(i));row["verified"]=stage_->verified(int(i));
      }
    }
    if(coordinator_) {
      root["phase"]=unsigned(coordinator_->phase());root["coordinator_error"]=coordinator_->error();
      root["native_acquired"]=coordinator_->acquired();
      const auto phase=coordinator_->phase();
      root["hardware_trial_active"]=phase!=cgs1_supervisor::CoordinatorPhase::IDLE &&
        phase!=cgs1_supervisor::CoordinatorPhase::RETURNED && phase!=cgs1_supervisor::CoordinatorPhase::REFUSED;
    }
    const auto*wifi=post_network_?&post_network_->observation():post_wifi_.get();
    root["post_return_wifi_observer_created"]=wifi!=nullptr;
    if(wifi) {
      auto network=root["post_return_wifi"].to<JsonObject>();
      network["opened"]=post_network_?post_network_->observation_opened():post_wifi_opened_;
      network["state"]=unsigned(wifi->state());network["error"]=unsigned(wifi->error());
      network["original_association_observed"]=wifi->state()==cgs1_returned_wifi::State::ASSOCIATED;
      network["observed_monotonic_ms"]=wifi->observed_ms();
      network["ever_original_association_observed"]=wifi->first_association_ms()!=0;
      network["first_original_association_ms"]=wifi->first_association_ms();
      network["last_original_association_ms"]=wifi->last_association_ms();
      network["snapshot_only"]=true;network["fresh_dhcp_lease_proven"]=false;
      network["gateway_reachability_proven"]=false;network["current_commit_authority"]=false;
      network["dhcp_signals_exposed"]=false;network["network_configuration_writes_exposed"]=false;
    }
    root["post_return_network_recovery_enabled"]=recover_original_network_;
    root["post_return_network_recovery_created"]=bool(post_recovery_);
    if(!last_reset_job_.empty())root["last_session_reset_job"]=last_reset_job_;
    if(post_recovery_) {
      auto network=root["post_return_network_recovery"].to<JsonObject>();
      network["state"]=unsigned(post_recovery_->state());
      network["error"]=unsigned(post_recovery_->error());
      network["last_check"]=unsigned(post_network_->last_check());
      network["original_state"]=unsigned(post_network_->original_state());
      network["original_error"]=unsigned(post_network_->original_error());
      network["original_binding_check"]=unsigned(post_network_->original_binding_check());
      network["capture_admission_waits"]=post_network_->capture_admission_waits();
      network["capture_opened"]=post_network_->capture_opened();
      network["capture_failed"]=post_network_->capture_broken();
      network["capture_error"]=post_network_->capture_error();
      network["packet_error"]=post_network_->packet_error();
      network["renew_attempted"]=post_recovery_->renew_attempted();
      network["signal_attempted"]=post_network_->signal_attempted();
      network["signal_queued"]=post_network_->signal_queued();
      network["system_error"]=post_network_->system_error();
      network["ready_observed_monotonic_ms"]=post_recovery_->ready_at();
      network["historical_recovery_observed"]=post_recovery_->ready_at()!=0;
      network["current_commit_authority"]=false;
      network["remote_start_or_retry_exposed"]=false;
    }
    if(last_retirement_attempted_)retirement_report_(root["last_retirement"].to<JsonObject>());
    if(last_upload_dedup_attempted_)upload_dedup_report_(root["last_upload_dedup"].to<JsonObject>());
    if(last_cache_purge_attempted_)cache_report_(root["last_cache_purge"].to<JsonObject>());
  }
  void diagnostics(StringRef job,JsonObject root) const {
    // Never read an active session's output as if it were a finished report.
    // A new bridge after OTA may read a previous nonce; this grants no launch
    // or recovery authority over that historical RAM directory.
    if(coordinator_) {
      const auto p=coordinator_->phase();
      if(p!=cgs1_supervisor::CoordinatorPhase::IDLE && p!=cgs1_supervisor::CoordinatorPhase::RETURNED &&
         p!=cgs1_supervisor::CoordinatorPhase::REFUSED){root["ok"]=false;root["error"]="full_session_active";return;}
    }
    cgs1_supervisor::FullDiagnostics snapshot;
    const bool read=snapshot.read(text_(job));root["ok"]=read;root["error"]=snapshot.error;
    cgs1_supervisor::diagnostic_metadata_json(snapshot,root);
    cgs1_supervisor::FullStateMetadata storage;
    if(read && storage.read(text_(job)))cgs1_supervisor::diagnostic_state_metadata_json(storage,root);
  }
  void diagnostic_page(StringRef job,int file_index,int page_index,JsonObject root) const {
    // The same inactive-session fence applies to every page. Numeric indexes
    // address only the five compiled names and eight tail pages; no remote
    // string is interpreted as a path or a command.
    if(coordinator_) {
      const auto phase=coordinator_->phase();
      if(phase!=cgs1_supervisor::CoordinatorPhase::IDLE && phase!=cgs1_supervisor::CoordinatorPhase::RETURNED &&
         phase!=cgs1_supervisor::CoordinatorPhase::REFUSED){root["ok"]=false;root["error"]="full_session_active";return;}
    }
    cgs1_supervisor::FullDiagnostics snapshot;cgs1_supervisor::FullDiagnosticPage page;
    if(!snapshot.read(text_(job))) {root["ok"]=false;root["error"]=snapshot.error;return;}
    if(!snapshot.page(file_index,page_index,page)) {root["ok"]=false;root["error"]="fixed_diagnostic_page_unavailable";return;}
    root["ok"]=true;root["error"]="";cgs1_supervisor::diagnostic_page_json(snapshot,page,root);
  }
  void reclaim(StringRef job,JsonObject root) const {
    if((stage_ && stage_->job()==text_(job)) || (coordinator_ &&
       coordinator_->phase()!=cgs1_supervisor::CoordinatorPhase::IDLE)) {
      root["ok"]=false;root["error"]="idle_bridge_and_historical_job_required";return;
    }
    cgs1_supervisor::FullReclaim operation;
    root["ok"]=operation.run(text_(job));root["error"]=operation.error;
    root["removed_files"]=operation.removed_files;root["removed_bytes"]=operation.removed_bytes;
    root["unlaunched_session"]=operation.unlaunched;
    root["materialized_images_preserved"]=true;
  }
  void retire(StringRef job,StringRef native_sha,StringRef guardian_sha,JsonObject root) {
    if((stage_ && stage_->job()==text_(job)) || !coordinator_ ||
       coordinator_->phase()!=cgs1_supervisor::CoordinatorPhase::IDLE) {
      root["ok"]=false;root["error"]="idle_bridge_and_historical_job_required";return;
    }
    last_retirement_job_=text_(job);last_retirement_attempted_=true;
    cgs1_supervisor::FullReclaim operation;
    last_retirement_ok_=operation.retire(last_retirement_job_,text_(native_sha),text_(guardian_sha));
    last_retirement_=std::move(operation);retirement_report_(root);
  }
  void deduplicate_uploads(StringRef job,StringRef native_sha,StringRef guardian_sha,JsonObject root) {
    const auto name=text_(job),native=text_(native_sha),guardian=text_(guardian_sha);
    // Read back an ambiguous same-request outcome; never unlink again. This
    // one-use actor keeps its result in status for the rest of this bridge
    // process. Another job/request needs its own reviewed bridge lifecycle.
    if(last_upload_dedup_attempted_) {
      if(name==last_upload_dedup_job_ && native==last_upload_dedup_hashes_[0] && guardian==last_upload_dedup_hashes_[1])
        upload_dedup_report_(root);
      else {root["ok"]=false;root["error"]="upload_dedup_actor_already_consumed";}
      return;
    }
    if((stage_ && stage_->job()==name) || !coordinator_ ||
       coordinator_->phase()!=cgs1_supervisor::CoordinatorPhase::IDLE || !policy_) {
      root["ok"]=false;root["error"]="idle_bridge_and_historical_job_required";return;
    }
    cgs1_net_trial::StockInspection stock;cgs1_supervisor::OriginalEffects effects;
    if(!policy_->capture(stock,effects)) {
      root["ok"]=false;root["error"]="fresh_fixed_stock_before_upload_dedup_required";return;
    }
    last_upload_dedup_job_=name;last_upload_dedup_hashes_={native,guardian};
    last_upload_dedup_attempted_=true; // Retain intent before any possible unlink.
    last_upload_dedup_ok_=last_upload_dedup_.deduplicate_uploads(name,native,guardian);
    upload_dedup_report_(root);
  }
 private:
  struct RebootBackend {
    FullRuntime *owner{nullptr};
    bool ready(){return owner->reboot_ready_();}
    void restart(){
      ::sync();
      // On success this fixed syscall does not return. A returned failure is
      // reported with errno and never retried by the lifecycle scheduler.
      if(::reboot(RB_AUTOBOOT))owner->reboot_errno_=errno;
    }
  };
  using RebootFlow=cgs1_supervisor::CoreRebootFlow<RebootBackend>;
  RebootBackend reboot_backend_;std::unique_ptr<RebootFlow>reboot_flow_;int reboot_errno_{0};
  bool reboot_ready_() {
    if(!core_release_autostart_ || !boot_flow_ || !policy_ || !coordinator_ ||
        !cgs1_supervisor::core_reboot_scheduler_ready(boot_flow_->state(),boot_error_) ||
        !stage_ || !stage_->job().empty() ||
        coordinator_->phase()!=cgs1_supervisor::CoordinatorPhase::IDLE ||
        !core_parent_ || !core_parent_->current() || !core_store_ ||
        !core_store_->enabled() || !core_store_->verify())return false;
    cgs1_net_trial::StockInspection stock;cgs1_supervisor::OriginalEffects effects;
    return policy_->capture_for_core_reboot(stock,effects);
  }
  struct BootBackend {
    FullRuntime *owner{nullptr};
    bool ready(){return owner->boot_ready_();}
    bool consume(){return owner->boot_consume_();}
    cgs1_supervisor::FullBootStage stage(){return owner->boot_stage_();}
    cgs1_supervisor::FullBootQueue prepare_and_launch(){return owner->boot_launch_();}
  };
  using BootFlow=cgs1_supervisor::FullBootFlow<BootBackend>;
  // On the measured CGS1 boot SnowApp was ready at ~8s but its miio child
  // appeared at ~46s and inherited DRM after the earlier 15s admission.
  // Give that ordinary startup a full minute before consuming a native boot
  // attempt. Exact current-owner checks and the separately bound one-shot
  // repair still run afterward; unknown/late conflicts continue to refuse.
  // This also permits offline boots: readiness does not require a cloud or
  // Wi-Fi connection. The scheduler's existing 180s total bound is unchanged.
  static constexpr uint64_t VENDOR_STARTUP_SETTLE_MS=60000;
  BootBackend boot_backend_;std::unique_ptr<BootFlow>boot_flow_;
  bool core_release_autostart_{false},installed_start_requested_{false};
  bool boot_return_handled_{false},boot_return_mode_saved_{false};
  std::unique_ptr<cgs1_supervisor::RunnerWifiPrivateRoot>core_parent_;
  std::unique_ptr<cgs1_supervisor::FullReleaseStore>core_store_;
  std::string boot_job_,boot_id_,boot_error_;
  bool quiet_stock_() {
    if(!coordinator_ || !policy_)return false;
    const auto phase=coordinator_->phase();
    if(phase!=cgs1_supervisor::CoordinatorPhase::IDLE && !coordinator_->quiescent_for_new_session())return false;
    cgs1_net_trial::StockInspection stock;cgs1_supervisor::OriginalEffects effects;
    return policy_->capture(stock,effects);
  }
  bool open_core_store_(bool create) {
    // Close the child before its fenced parent. The parent object holds every
    // canonical prefix; later boot chunks recheck it instead of trusting a path.
    core_store_.reset();core_parent_.reset();
    core_parent_=std::make_unique<cgs1_supervisor::RunnerWifiPrivateRoot>();
    if(!core_parent_->open()){boot_error_="canonical_core_parent_unavailable";return false;}
    const int fd=core_parent_->duplicate();
    core_store_=std::make_unique<cgs1_supervisor::FullReleaseStore>(manifest_);
    const bool opened=fd>=0 && core_store_->open(fd,create);
    if(fd>=0)::close(fd);
    if(!opened){boot_error_=core_store_->error();return false;}
    boot_error_.clear();return true;
  }
  bool boot_ready_() {
    if(!stage_ || !stage_->job().empty() || !coordinator_ ||
        coordinator_->phase()!=cgs1_supervisor::CoordinatorPhase::IDLE ||
        !core_parent_ || !core_parent_->current() || !core_store_ || !core_store_->enabled()) {
      boot_error_="boot_waiting_for_empty_stage_and_current_store";return false;
    }
    cgs1_net_trial::StockInspection stock;cgs1_supervisor::OriginalEffects effects;
    // This is readiness to CONSUME the durable boot attempt, not permission
    // to take over hardware. A known inherited miio descriptor is repairable
    // only later in prepare(), AFTER consume_boot_attempt. Never start repair
    // here: a bridge crash before that record could otherwise replay TERM.
    if(!stock.inspect()){boot_error_="boot_waiting_for_fixed_stock";return false;}
    const auto display=cgs1_net_trial::DisplayMaintenance::handoff_objection(stock);
    if(display.empty()) {
      if(!policy_->capture(stock,effects)){boot_error_="boot_waiting_for_fixed_stock";return false;}
    }else if(display!="inherited_miio_drm_cleanup_required" || !cgs1::pm.available()) {
      boot_error_="boot_waiting_for_uncontested_display";return false;
    }
    if(!ram_fits_(2*image_bytes_()+STARTUP_RESERVE)){boot_error_="boot_waiting_for_ram_headroom";return false;}
    boot_id_=stock.boot_id;return true;
  }
  bool boot_consume_() {
    if(!core_parent_->current() || !core_store_->verify() || !core_store_->consume_boot_attempt(boot_id_)) {
      boot_error_=core_store_->error();return false;
    }
    // Eight cryptographic random bytes choose only a new private RAM nonce.
    // No secret is generated/exported; failure leaves the consumed boot intent.
    const int fd=::open("/dev/urandom",O_RDONLY|O_CLOEXEC);std::array<unsigned char,8> bytes{};
    const bool read=fd>=0 && ::read(fd,bytes.data(),bytes.size())==ssize_t(bytes.size());
    if(fd>=0)::close(fd);
    if(!read){boot_error_="boot_nonce_unavailable";return false;}
    static constexpr char hex[]="0123456789abcdef";
    for(auto b:bytes){boot_job_+=hex[b>>4];boot_job_+=hex[b&15];}
    if(boot_job_==std::string(16,'0')){boot_error_="boot_nonce_invalid";return false;}
    boot_error_.clear();return true;
  }
  cgs1_supervisor::FullBootStage boot_stage_() {
    bool done=false;
    if(!core_parent_->current() || !core_store_->stream_tick(*stage_,boot_job_,done)) {
      boot_error_=core_store_->error();return cgs1_supervisor::FullBootStage::FAILED;
    }
    return done?cgs1_supervisor::FullBootStage::READY:cgs1_supervisor::FullBootStage::MORE;
  }
  cgs1_supervisor::FullBootQueue boot_launch_() {
    prepare(StringRef(boot_job_));
    if(!ok_) {
      boot_error_=error_;
      // This exact branch failed a READ before prepare_attempted_ is set.
      // No materialization/coordinator request/fork/stock signal occurred.
      // All other failures are consumed and terminal; none are retried.
      if(!prepared_attempted_ && error_=="fresh_uncontested_stock_required")
        return cgs1_supervisor::FullBootQueue::WAIT_FOR_STOCK;
      if(!prepared_attempted_ && error_=="core_display_repair_pending")
        return cgs1_supervisor::FullBootQueue::WAIT_FOR_DISPLAY;
      return cgs1_supervisor::FullBootQueue::FAILED;
    }
    launch(StringRef(boot_job_));
    // A completed display repair/read wait must not remain labelled as an
    // error after the first actual native launch was successfully queued.
    // A failed/uncertain queue still retains its exact refusal; no retry.
    boot_error_=ok_?"":error_;
    return ok_?cgs1_supervisor::FullBootQueue::QUEUED:cgs1_supervisor::FullBootQueue::FAILED;
  }
  using Coordinator=cgs1_supervisor::FullCoordinator<cgs1_supervisor::Cgs1BridgePolicy>;
  api::APIServer *api_{nullptr};ESPHomeOTAComponent *ota_{nullptr};
  std::array<cgs1_net_trial::FullStaging::Artifact,2> manifest_{};
  std::unique_ptr<cgs1_net_trial::FullStaging> stage_;
  std::unique_ptr<cgs1_supervisor::FullMaterialize>materialized_;
  std::unique_ptr<cgs1_supervisor::Cgs1BridgePolicy> policy_;
  std::unique_ptr<Coordinator> coordinator_;bool ok_{false},prepared_attempted_{false};std::string error_;
  cgs1_supervisor::CoreDisplayAdmission<> core_display_;
  std::unique_ptr<cgs1_returned_wifi::Observation>post_wifi_;
  bool post_wifi_attempted_{false},post_wifi_opened_{false};
  // Reverse destruction retires Recovery before its borrowed Backend, and
  // both before coordinator's lifetime anchor. No returned scope survives it.
  bool recover_original_network_{false};
  std::unique_ptr<cgs1_returned_network::Backend>post_network_;
  std::unique_ptr<cgs1_returned_network::Recovery<>>post_recovery_;
  std::string last_reset_job_;
  cgs1_supervisor::FullReclaim last_cache_purge_;std::string last_cache_purge_job_;
  std::array<std::string,2>last_cache_purge_hashes_{};
  bool last_cache_purge_attempted_{false},last_cache_purge_ok_{false};
  cgs1_supervisor::FullReclaim last_retirement_;std::string last_retirement_job_;
  bool last_retirement_attempted_{false},last_retirement_ok_{false};
  cgs1_supervisor::FullReclaim last_upload_dedup_;std::string last_upload_dedup_job_;
  std::array<std::string,2>last_upload_dedup_hashes_{};
  bool last_upload_dedup_attempted_{false},last_upload_dedup_ok_{false};
  void cache_report_(JsonObject root)const {
    root["job"]=last_cache_purge_job_;root["ok"]=last_cache_purge_ok_;root["error"]=last_cache_purge_.error;
    root["removed_programs"]=last_cache_purge_.retired_files;
    root["removed_program_bytes"]=last_cache_purge_.retired_bytes;
    root["removed_uploads"]=last_cache_purge_.removed_files;
    root["removed_upload_bytes"]=last_cache_purge_.removed_bytes;
    root["cache_only"]=true;root["completed_recovery_proven"]=false;
    root["logs_receipts_preferences_preserved"]=true;
  }
  void upload_dedup_report_(JsonObject root)const {
    root["job"]=last_upload_dedup_job_;root["ok"]=last_upload_dedup_ok_;root["error"]=last_upload_dedup_.error;
    root["removed_files"]=last_upload_dedup_.removed_files;root["removed_bytes"]=last_upload_dedup_.removed_bytes;
    root["materialized_images_preserved"]=true;root["logs_and_receipts_preserved"]=true;
    root["completed_recovery_proven"]=false;
  }
  void retirement_report_(JsonObject root) const {
    root["job"]=last_retirement_job_;root["ok"]=last_retirement_ok_;root["error"]=last_retirement_.error;
    root["retired_files"]=last_retirement_.retired_files;root["retired_bytes"]=last_retirement_.retired_bytes;
    root["removed_flat_files"]=last_retirement_.removed_files;root["removed_flat_bytes"]=last_retirement_.removed_bytes;
    root["logs_and_receipts_preserved"]=true;
    auto hashes=root["retired_sha256"].to<JsonArray>();for(const auto &hash:last_retirement_.retired_sha256)hashes.add(hash);
  }
  static std::string text_(StringRef value){return {value.c_str(),value.size()};}
  static constexpr uint64_t STARTUP_RESERVE=32ULL*1024*1024;
  uint64_t image_bytes_() const{return uint64_t(manifest_[0].size)+manifest_[1].size;}
  static bool ram_fits_(uint64_t needed) {
    const auto ram=cgs1_supervisor::read_ram_budget();return ram.known && ram.reclaim_estimate_bytes>=needed;
  }
  void result_(bool okay){ok_=okay;error_=okay?"":stage_->error();}
};
}  // namespace esphome::cgs1_full_runtime
