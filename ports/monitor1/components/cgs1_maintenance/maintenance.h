#pragma once
#include <array>
#include <cstdio>
#include <memory>
#include <string>

#include "esphome/components/json/json_util.h"
#include "esphome/core/component.h"
#include "esphome/core/hal.h"
#include "network_preflight.h"
#include "network_trial_coordinator.h"
#include "display_ownership.h"
#include "diagnostic_text.h"
#include "independent_pm_power.h"
#include "wifi_control_inspect.h"
#include "wifi_saved_profiles.h"
#include "wifi_daemon_inspect.h"
#include "wifi_version_logging.h"
#include "dhcp_owner_inspect.h"
#include "dhcp_capture_probe.h"
#include "gateway_probe.h"
#include "bluetooth_inventory.h"
#include "bluetooth_vendor_binary.h"
#include "wpa_vendor_binary.h"
#include "wpa_vendor_privacy.h"
#include "busybox_vendor_binary.h"
#include "dhcp_wait_inspect.h"
#include "dhcp_renew_once.h"
#if defined(__linux__)
#include "stock_pm_control.h"
#include "supervisor_kernel_probe.h"
#endif
#include "trial_staging.h"

namespace esphome::cgs1_maintenance {
class Maintenance : public Component {
public:
  void set_artifact(int index, uint32_t size, const char *sha) {
    manifest_[index] = {size, sha};
  }
  void set_fixture_mode(bool enabled) { fixture_mode_ = enabled; }
  void set_allow_network_trial(bool enabled) { allow_trial_ = enabled; }
  void setup() override {
    stage_ = std::make_unique<cgs1_net_trial::Staging>(manifest_);
  }
  float get_setup_priority() const override { return setup_priority::LATE; }
  bool ok() const { return ok_; }
  std::string error() const { return error_; }
  void loop() override {
    coordinator_.poll();
    display_.poll();
    dhcp_capture_.poll();
    gateway_probe_.poll();
#if defined(__linux__)
    if (pm_suspended_ && coordinator_.finished()) {
      cgs1::pm.resume_after_trial();
      pm_suspended_ = false;
    }
#endif
  }
  void inspect() {
    inspected_ = false;
    ok_ = false;
    error_.clear();
#ifdef __APPLE__
    // This compile target cannot control CGS1 hardware. Fixture staging still
    // requires the private prefix used by the isolated test harness.
    const char *prefs = std::getenv("ESPHOME_PREFDIR");
    inspected_ = fixture_mode_ && prefs &&
                 std::strncmp(prefs, "/tmp/qingping-ui-render-", 23) == 0;
    if (!inspected_) {
      error_ = "local_fixture_not_enabled";
      return;
    }
#elif defined(__linux__)
    // No environment switch can bypass these Linux identity/process/hash
    // checks. Even a successful check grants staging only in this release.
    inspected_ = inspection_.inspect();
    if (!inspected_) {
      error_ = inspection_.error;
      return;
    }
#else
    error_ = "unsupported_platform";
    return;
#endif
    inspected_at_ = millis();
    ok_ = true;
  }
  void inspect_supervisor_kernel() {
    ok_=false;error_.clear();kernel_probe_attempted_=false;
#if defined(__linux__)
    kernel_probe_={};
    if((coordinator_.launched() && !coordinator_.finished()) || display_.busy()) {
      error_="active_trial_or_display_cleanup_blocks_kernel_probe";return;
    }
    // Existing exact board/process/critical-file checks run first. The new
    // action does not grant staging, takeover or arbitrary executable access.
    inspect();if(!ok_)return;
    kernel_probe_attempted_=true;
    kernel_probe_=cgs1_supervisor::run_kernel_probe("/data/.esphome-cgs1");
    ok_=kernel_probe_.complete() && cgs1_supervisor::digest_text(kernel_probe_.digest)==inspection_.bridge_sha;
    if(!ok_)error_="supervisor_kernel_probe_failed";
#else
    error_="supervisor_kernel_probe_requires_verified_linux";
#endif
  }
  void inspect_bluetooth() {
    // Existing exact appliance/stock checks first. The inspector is read-only
    // and has no remote path, command, process ID or radio-operation parameter.
    bluetooth_ = {};
    bluetooth_snapshot_ = false;
    bluetooth_page_ = 0;
    inspect();
    if (!ok_) return;
    bluetooth_ = cgs1_bluetooth::inspect();
    ok_ = bluetooth_.supported;
    if (!ok_) error_ = "bluetooth_inventory_requires_linux";
    else accept_bluetooth_snapshot_();
  }
  void bluetooth_page(int page, int generation) {
    ok_ = false; error_.clear();
    if (!bluetooth_snapshot_ || generation <= 0 || uint32_t(generation) != bluetooth_generation_ ||
        page < 0 || size_t(page) >= bluetooth_pages_()) {
      error_ = "current_bluetooth_snapshot_page_required"; return;
    }
    bluetooth_page_ = size_t(page); ok_ = true;
  }
  void capture_wifi_vendor_program() {
    // One capture per bridge process; repeat CAPTURE reports the same immutable
    // snapshot. This never opens a configuration or process-memory file. The
    // exact board/stock check and running WPA executable fence are mandatory.
    ok_=false;error_.clear();
    if(wifi_vendor_attempted_) {
      ok_=wifi_vendor_.verified;
      if(!ok_)error_="wifi_vendor_capture_consumed";
      return;
    }
    wifi_vendor_attempted_=true;
    if((coordinator_.launched() && !coordinator_.finished()) || display_.busy()) {
      error_="active_trial_blocks_wifi_vendor_capture";return;
    }
    inspect();if(!ok_)return;
#if defined(__linux__)
    const auto before=cgs1_wifi::inspect_daemon(0);
    if(!before.verified || before.process.executable!="/usr/sbin/wpa_supplicant") {
      ok_=false;error_="wifi_vendor_exact_live_executable_required";return;
    }
    wifi_vendor_=cgs1_wifi_vendor::read_supplicant();
    if(!wifi_vendor_.verified){ok_=false;error_=wifi_vendor_.error;return;}
    const auto after=cgs1_wifi::inspect_daemon(0);struct stat running{};
    if(!after.verified || after.process.pid!=before.process.pid || after.process.start!=before.process.start ||
        after.socket_inode!=before.socket_inode || after.process.executable!=before.process.executable ||
        ::stat(("/proc/"+std::to_string(before.process.pid)+"/exe").c_str(),&running) ||
        uint64_t(running.st_dev)!=wifi_vendor_.file_device || uint64_t(running.st_ino)!=wifi_vendor_.file_inode) {
      wifi_vendor_={};ok_=false;error_="wifi_vendor_running_inode_changed";return;
    }
    wifi_vendor_generation_=1;wifi_vendor_page_=0;ok_=true;
#else
    ok_=false;error_="wifi_vendor_verified_linux_required";
#endif
  }
  void wifi_vendor_page(int page,int generation) {
    ok_=false;error_.clear();
    if(!wifi_vendor_.verified || generation!=int(wifi_vendor_generation_) || generation<=0 || page<0 || size_t(page)>=wifi_vendor_.pages()) {
      error_="current_wifi_vendor_snapshot_page_required";return;
    }
    wifi_vendor_page_=size_t(page);ok_=true;
  }
  void release_wifi_vendor_program() {
    // Retire only our bounded RAM snapshot, never the immutable vendor source.
    wifi_vendor_={};wifi_vendor_page_=0;wifi_vendor_released_=true;ok_=true;error_.clear();
    wifi_vendor_attempted_=true;
  }
  void wifi_vendor_report(JsonObject root)const {
    root["ok"]=ok_;root["error"]=error_;root["path"]="/usr/sbin/wpa_supplicant";
    root["executed"]=false;root["configuration_or_process_memory_read"]=false;
    root["released"]=wifi_vendor_released_;root["verified"]=wifi_vendor_.verified;
    if(!ok_ || !wifi_vendor_.verified)return;
    root["generation"]=wifi_vendor_generation_;root["bytes"]=wifi_vendor_.bytes.size();root["sha256"]=wifi_vendor_.sha256;
    root["filesystem_type"]=wifi_vendor_.filesystem_type;root["filesystem_flags"]=wifi_vendor_.filesystem_flags;
    root["page"]=wifi_vendor_page_;root["page_count"]=wifi_vendor_.pages();
    root["page_bytes"]=cgs1_wifi_vendor::VendorProgram::PAGE_BYTES;
    root["hex_data"]=wifi_vendor_.page_hex(wifi_vendor_page_);
  }
  void capture_dhcp_vendor_program() {
    // One capture per bridge process; repeat CAPTURE reports the same immutable
    // snapshot. This never opens a configuration or process-memory file. The
    // exact board/stock check and running DHCP executable fence are mandatory.
    ok_=false;error_.clear();
    if(dhcp_vendor_attempted_) {
      ok_=dhcp_vendor_.verified;
      if(!ok_)error_="dhcp_vendor_capture_consumed";
      return;
    }
    dhcp_vendor_attempted_=true;
    if((coordinator_.launched() && !coordinator_.finished()) || display_.busy() || dhcp_capture_.active() || gateway_probe_.active()) {
      error_="active_trial_blocks_dhcp_vendor_capture";return;
    }
    inspect();if(!ok_)return;
#if defined(__linux__)
    const auto before=cgs1_dhcp::inspect();
    if(!before.scan_complete || before.clients.size()!=1 || !before.executable.verified ||
        !before.executable.filesystem_read_only || !before.vendor_launcher_matches ||
        before.clients[0].process.executable!="/bin/busybox") {
      ok_=false;error_="dhcp_vendor_exact_live_executable_required";return;
    }
    dhcp_vendor_=cgs1_dhcp_vendor::read_busybox();
    if(!dhcp_vendor_.verified || dhcp_vendor_.sha256!=before.executable.sha256) {
      ok_=false;error_="dhcp_vendor_code_read_failed";dhcp_vendor_={};return;
    }
    const auto after=cgs1_dhcp::inspect();struct stat running{};
    const auto &owner=before.clients[0].process;
    if(!after.scan_complete || after.clients.size()!=1 || !after.executable.verified ||
        after.clients[0].process.pid!=owner.pid || after.clients[0].process.start!=owner.start ||
        after.clients[0].process.executable!=owner.executable || !cgs1_net_trial::same_process(owner) ||
        after.executable.sha256!=dhcp_vendor_.sha256 ||
        ::stat(("/proc/"+std::to_string(owner.pid)+"/exe").c_str(),&running) ||
        uint64_t(running.st_dev)!=dhcp_vendor_.file_device || uint64_t(running.st_ino)!=dhcp_vendor_.file_inode) {
      dhcp_vendor_={};ok_=false;error_="dhcp_vendor_running_inode_changed";return;
    }
    dhcp_vendor_generation_=1;dhcp_vendor_page_=0;ok_=true;
#else
    ok_=false;error_="dhcp_vendor_verified_linux_required";
#endif
  }
  void dhcp_vendor_page(int page,int generation) {
    ok_=false;error_.clear();
    if(!dhcp_vendor_.verified || generation!=int(dhcp_vendor_generation_) || generation<=0 || page<0 || size_t(page)>=dhcp_vendor_.pages()) {
      error_="current_dhcp_vendor_snapshot_page_required";return;
    }
    dhcp_vendor_page_=size_t(page);ok_=true;
  }
  void release_dhcp_vendor_program() {
    // Retire only our bounded RAM snapshot, never the immutable vendor source.
    dhcp_vendor_={};dhcp_vendor_page_=0;dhcp_vendor_released_=true;ok_=true;error_.clear();
    dhcp_vendor_attempted_=true;
  }
  void dhcp_vendor_report(JsonObject root)const {
    root["ok"]=ok_;root["error"]=error_;root["path"]="/bin/busybox";
    root["executed"]=false;root["configuration_or_process_memory_read"]=false;
    root["released"]=dhcp_vendor_released_;root["verified"]=dhcp_vendor_.verified;
    if(!ok_ || !dhcp_vendor_.verified)return;
    root["generation"]=dhcp_vendor_generation_;root["bytes"]=dhcp_vendor_.bytes.size();root["sha256"]=dhcp_vendor_.sha256;
    root["filesystem_type"]=dhcp_vendor_.filesystem_type;root["filesystem_flags"]=dhcp_vendor_.filesystem_flags;
    root["page"]=dhcp_vendor_page_;root["page_count"]=dhcp_vendor_.pages();
    root["page_bytes"]=cgs1_dhcp_vendor::VendorProgram::PAGE_BYTES;
    root["hex_data"]=dhcp_vendor_.page_hex(dhcp_vendor_page_);
  }
  void capture_bluetooth_vendor_wrapper() {
    // One fixed immutable vendor ELF, captured once into bounded RAM. Every
    // page comes from this snapshot, so a file replacement cannot mix sources.
    bluetooth_vendor_={};bluetooth_vendor_page_=0;
    inspect();if(!ok_)return;
    bluetooth_vendor_=cgs1_bluetooth::read_vendor_wrapper();
    ok_=bluetooth_vendor_.verified;
    if(!ok_){error_=bluetooth_vendor_.error;return;}
    bluetooth_vendor_generation_=bluetooth_vendor_generation_>=0x7ffffffe?1:bluetooth_vendor_generation_+1;
  }
  void bluetooth_vendor_page(int page,int generation) {
    ok_=false;error_.clear();
    if(!bluetooth_vendor_.verified || generation<=0 || uint32_t(generation)!=bluetooth_vendor_generation_ ||
        page<0 || size_t(page)>=bluetooth_vendor_.pages()) {
      error_="current_vendor_binary_snapshot_page_required";return;
    }
    bluetooth_vendor_page_=size_t(page);ok_=true;
  }
  void bluetooth_vendor_report(JsonObject root)const {
    root["ok"]=ok_;root["error"]=error_;
    root["path"]="/usr/bin/rkrtkbt";
    root["executed"]=false;root["radio_operations_exposed"]=false;
    root["configuration_or_credentials_read"]=false;
    root["filesystem_type"]=bluetooth_vendor_.filesystem_type;
    root["filesystem_flags"]=bluetooth_vendor_.filesystem_flags;
    root["statfs_errno"]=bluetooth_vendor_.statfs_error;
    root["statvfs_errno"]=bluetooth_vendor_.statvfs_error;
    if(!ok_ || !bluetooth_vendor_.verified)return;
    root["generation"]=bluetooth_vendor_generation_;
    root["sha256"]=bluetooth_vendor_.sha256;
    root["bytes"]=bluetooth_vendor_.bytes.size();
    root["page"]=bluetooth_vendor_page_;
    root["page_count"]=bluetooth_vendor_.pages();
    root["page_bytes"]=cgs1_bluetooth::VendorBinary::PAGE_BYTES;
    root["hex_data"]=bluetooth_vendor_.page_hex(bluetooth_vendor_page_);
  }
#ifdef __APPLE__
  void fixture_bluetooth_inventory() {
    // Test-only API appears exclusively in the macOS fixture YAML. Exercise
    // the real SDK JSON serializer above its 5120-byte total-result limit;
    // this does not read macOS Bluetooth or exist as a Linux appliance action.
    const char *prefs = std::getenv("ESPHOME_PREFDIR");
    if (!fixture_mode_ || !prefs || std::strncmp(prefs, "/tmp/qingping-ui-render-", 23) != 0) {
      ok_ = false; error_ = "local_fixture_not_enabled"; return;
    }
    bluetooth_ = {}; bluetooth_.supported = true;
    for (unsigned i = 0; i < 256; ++i)
      bluetooth_.items.push_back({"fixture", "/sys/fixture/" + std::to_string(i) + std::string(96, 'n'), std::string(192, 'v')});
    bluetooth_page_ = 0; ok_ = true; error_.clear(); accept_bluetooth_snapshot_();
  }
#endif
  void bluetooth_report(JsonObject root) const {
    root["supported"] = bluetooth_.supported;
    root["partial"] = bluetooth_.partial;
    root["radio_operations_exposed"] = false;
    root["configuration_or_credentials_read"] = false;
    root["generation"] = bluetooth_generation_;
    root["snapshot_available"] = bluetooth_snapshot_;
    root["page"] = bluetooth_page_;
    root["page_count"] = bluetooth_pages_();
    root["item_count"] = bluetooth_.items.size();
    auto items = root["items"].to<JsonArray>();
    // Eight bounded records keep even a worst-case page below the stock
    // SDK's 5120-byte JSON response cap. Never enlarge that global SDK cap.
    const size_t begin = bluetooth_page_ * 8;
    for (size_t index = begin; index < std::min(begin + 8, bluetooth_.items.size()); ++index) {
      const auto &item = bluetooth_.items[index];
      auto row = items.add<JsonObject>();
      row["kind"] = item.kind;
      row["node"] = item.node;
      row["value"] = item.value;
    }
  }
  void supervisor_kernel_report(JsonObject root) const {
    report(root);
  }
  void supervisor_kernel_fields(JsonObject root) const {
    root["supervisor_kernel_probe_attempted"]=kernel_probe_attempted_;
    root["supervisor_kernel_probe_complete"]=false;
    // These two flags describe the kernel probe itself. The independent,
    // argument-free DHCP renewal capability has its own explicit field.
    root["vendor_process_signals_exposed"]=false;
    root["dhcp_fixed_usr1_renewal_exposed"]=true;
    root["hardware_configuration_writes_exposed"]=false;
#if defined(__linux__)
    root["supervisor_kernel_probe_complete"]=kernel_probe_.complete();
    root["supervisor_kernel_probe_code"]=uint32_t(kernel_probe_.code);
    root["supervisor_kernel_probe_flags"]=kernel_probe_.flags;
    root["supervisor_kernel_probe_image_bytes"]=kernel_probe_.bytes;
    root["supervisor_kernel_probe_image_sha256"]=cgs1_supervisor::digest_text(kernel_probe_.digest);
    root["supervisor_kernel_probe_hash_ms"]=kernel_probe_.hash_ms;
    root["supervisor_kernel_probe_running_verify_ms"]=kernel_probe_.running_verify_ms;
    root["supervisor_kernel_probe_elapsed_ms"]=kernel_probe_.elapsed_ms;
#endif
  }
  void begin(StringRef job, StringRef kind) {
    ok_ = false;
    error_.clear();
    if (!stage_) {
      error_ = "not_initialized";
      return;
    }
    if (stage_->job().empty() &&
        (!inspected_ || uint32_t(millis() - inspected_at_) > 60000)) {
      error_ = "fresh_device_inspection_required";
      return;
    }
    result(stage_->begin(string(job),
                         cgs1_net_trial::Staging::kind(string(kind))));
  }
  void chunk(StringRef job, StringRef kind, int offset, StringRef data) {
    if (!stage_) {
      ok_ = false;
      error_ = "not_initialized";
      return;
    }
    result(stage_->append(string(job),
                          cgs1_net_trial::Staging::kind(string(kind)), offset,
                          data.c_str(), data.size()));
  }
  void seal(StringRef job, StringRef kind) {
    if (!stage_) {
      ok_ = false;
      error_ = "not_initialized";
      return;
    }
    result(
        stage_->seal(string(job), cgs1_net_trial::Staging::kind(string(kind))));
  }
  void discard(StringRef job) {
    if (!stage_) {
      ok_ = false;
      error_ = "not_initialized";
      return;
    }
    if (string(job) != stage_->job()) { ok_ = false; error_ = "job_mismatch"; return; }
    if (!coordinator_.reset_preparation()) {
      ok_ = false;
      error_ = coordinator_.error();
      return;
    }
    result(stage_->discard(string(job)));
  }
  void prepare(StringRef job) {
    ok_ = false;
    error_.clear();
#if defined(__linux__)
    if (!allow_trial_ || !stage_ || string(job) != stage_->job()) {
      error_ = "trial_not_enabled_or_job_mismatch";
      return;
    }
    if (!cgs1::pm.available()) {
      error_ = "fresh_pm_state_required";
      return;
    }
    inspect();
    if (!ok_)
      return;
    error_ = cgs1_net_trial::DisplayMaintenance::handoff_objection(inspection_);
    if (!error_.empty() || display_.busy()) { ok_ = false; if(error_.empty())error_="display_cleanup_in_progress"; return; }
    ok_ = coordinator_.prepare(*stage_, inspection_, cgs1::pm.enabled());
    error_ = coordinator_.error();
#else
    error_ = "hardware_preparation_requires_verified_linux";
#endif
  }
  void launch(StringRef job) {
    ok_ = false;
    error_.clear();
#if defined(__linux__)
    if (!allow_trial_ || !stage_ || string(job) != stage_->job() ||
        !coordinator_.prepared() || coordinator_.launched()) {
      error_ = "prepared_unlaunched_job_required";
      return;
    }
    error_ = cgs1_net_trial::DisplayMaintenance::handoff_objection(inspection_);
    if (!error_.empty() || display_.busy()) { if(error_.empty())error_="display_cleanup_in_progress"; return; }
    if (!cgs1::pm.suspend_for_trial(coordinator_.pm_enabled())) {
      error_ = "pm_busy_or_changed_read_actual_state";
      return;
    }
    pm_suspended_ = true;
    ok_ = coordinator_.launch(*stage_);
    error_ = coordinator_.error();
    if (!ok_ && !coordinator_.launched()) {
      cgs1::pm.resume_after_trial();
      pm_suspended_ = false;
    }
#else
    error_ = "hardware_launch_requires_verified_linux";
#endif
  }
  void recover(StringRef job) {
    ok_ = stage_ && string(job) == stage_->job() &&
          coordinator_.request_recovery();
    error_ = ok_ ? "" : coordinator_.error();
  }
  void inspect_display() {
    ok_ = false; error_.clear();
#if defined(__linux__)
    inspect();
    if (!ok_) return;
    ok_ = display_.inventory(display_owners_);
    if (!ok_) error_ = "display_inventory_incomplete";
#else
    error_ = "display_inventory_requires_verified_linux";
#endif
  }
  void cleanup_miio() {
    ok_ = false; error_.clear();
#if defined(__linux__)
    if (!allow_trial_ || (coordinator_.launched() && !coordinator_.finished())) { error_="active_trial_or_cleanup_not_enabled"; return; }
    inspect();
    if (!ok_) return;
    ok_ = display_.start(inspection_);
    error_ = display_.error();
#else
    error_ = "display_cleanup_requires_verified_linux";
#endif
  }
  void inspect_pm_hardware() {
    ok_ = false; error_.clear();
#if defined(__linux__)
    inspect();
    if (!ok_) return;
    pm_hardware_ = cgs1_pm::inspect();
    ok_ = pm_hardware_.supported() || pm_hardware_.write_only_supported();
    if (!ok_) error_ = "independent_pm_board_branch_unverified";
#else
    error_ = "pm_hardware_inspection_requires_verified_linux";
#endif
  }
  void pm_hardware_report(JsonObject root) const {
    report(root);
    root["pm_power_pin"] = pm_hardware_.pins.power;
    root["pm_reset_pin"] = pm_hardware_.pins.reset;
    root["pm_legacy_flag_known"] = pm_hardware_.legacy_flag_known;
    root["pm_legacy_flag_present"] = pm_hardware_.legacy_flag_present;
    root["independent_pm_branch_verified"] = pm_hardware_.supported();
    root["independent_pm_write_only_branch_verified"] = pm_hardware_.write_only_supported();
    root["pm_hardware_write_exposed"] = false;
    root["pm_uart_pinmux_readable"] = pm_hardware_.pinmux_readable;
    root["pm_uart_pinmux_value"] = pm_hardware_.pinmux_value;
    JsonArray nodes = root["pm_kernel_nodes"].to<JsonArray>();
    for (size_t i = 0; i < cgs1_pm::KNOWN_NODES.size(); ++i) {
      const auto &evidence = pm_hardware_.nodes[i];
      JsonObject item = nodes.add<JsonObject>();
      item["path"] = cgs1_pm::KNOWN_NODES[i];
      item["lstat_errno"] = evidence.stat_error;
      item["mode"] = evidence.mode;
      item["owner_uid"] = evidence.owner;
      item["path_filesystem_type"] = evidence.path_filesystem_type;
      item["open_errno"] = evidence.open_error;
      item["filesystem_errno"] = evidence.filesystem_error;
      item["filesystem_type"] = evidence.filesystem_type;
      item["read_errno"] = evidence.read_error;
      item["bytes"] = evidence.bytes;
      item["parsed_bit"] = evidence.bit;
      item["text"] = cgs1_net_trial::plain_diagnostic(evidence.text);
    }
  }
  void inspect_wifi() {
    ok_=false;error_.clear();
    wifi_profiles_.clear();wifi_profiles_verified_=false;wifi_profiles_error_.clear();
    wifi_daemon_={};
#if defined(__linux__)
    inspect();if(!ok_)return;
    wifi_=cgs1_wifi::inspect();
    if(wifi_.available) {
      cgs1_wifi::ReadOnlyControl control;std::string reply;
      wifi_profiles_verified_=control.open(size_t(wifi_.selected)) &&
        control.request("LIST_NETWORKS",reply) && cgs1_wifi::parse_saved_profiles(reply,wifi_profiles_);
      if(!wifi_profiles_verified_)wifi_profiles_error_="read_only_profile_catalog_unavailable";
      wifi_.cleanup_verified=control.close() && wifi_.cleanup_verified;
      wifi_daemon_=cgs1_wifi::inspect_daemon(size_t(wifi_.selected));
    }
    // Successful metadata inspection does not mean that a control socket
    // exists or replied. Keep that distinction in the explicit fields below.
    ok_=true;
#else
    error_="wifi_inspection_requires_verified_linux";
#endif
  }
  void wifi_report(JsonObject root) const {
    report(root);
    root["wifi_control_available"]=wifi_.available;
    root["wifi_control_error"]=wifi_.error;
    root["wifi_control_selected"]=wifi_.selected;
    root["wifi_client_cleanup_verified"]=wifi_.cleanup_verified;
    root["wifi_config_mode"]=wifi_.config_mode;
    root["wifi_config_owner_uid"]=wifi_.config_owner;
    root["wifi_config_lstat_errno"]=wifi_.config_error;
    root["wifi_config_regular"]=wifi_.config_regular;
    root["wifi_config_contents_read"]=false;
    root["wifi_control_write_exposed"]=false;
    root["wifi_profiles_verified"]=wifi_profiles_verified_;
    root["wifi_profiles_error"]=wifi_profiles_error_;
    JsonArray profiles=root["wifi_profiles"].to<JsonArray>();
    for(const auto &profile:wifi_profiles_) {
      auto item=profiles.add<JsonObject>();item["id"]=profile.id;
      // SSIDs are needed only inside local transaction planning, not reports.
      item["ssid_text_bytes"]=profile.ssid_text.size();item["bssid"]=profile.bssid;
      item["current"]=profile.current;item["disabled"]=profile.disabled;
      item["temporarily_disabled"]=profile.temporarily_disabled;
      item["flags_known"]=profile.flags_known;
    }
    root["wifi_daemon_verified_socket_owner"]=wifi_daemon_.verified;
    root["wifi_daemon_error"]=wifi_daemon_.error;
    root["wifi_daemon_pid"]=wifi_daemon_.process.pid;
    root["wifi_daemon_start_tick"]=wifi_daemon_.process.start;
    root["wifi_daemon_executable"]=wifi_daemon_.process.executable;
    root["wifi_daemon_socket_inode"]=wifi_daemon_.socket_inode;
    JsonObject status=root["wifi_status"].to<JsonObject>();
    status["state"]=wifi_.status.state;status["ip_address"]=wifi_.status.ip_address;
    status["bssid"]=wifi_.status.bssid;status["key_management"]=wifi_.status.key_management;
    status["network_id"]=wifi_.status.network_id;status["frequency"]=wifi_.status.frequency;
    status["ssid_text_bytes"]=wifi_.status.ssid_text_bytes;
    JsonArray nodes=root["wifi_control_nodes"].to<JsonArray>();
    for(size_t i=0;i<cgs1_wifi::CONTROL_PATHS.size();++i) {
      auto item=nodes.add<JsonObject>();item["path"]=cgs1_wifi::CONTROL_PATHS[i];
      item["lstat_errno"]=wifi_.nodes[i].error;item["owner_uid"]=wifi_.nodes[i].owner;
      item["mode"]=wifi_.nodes[i].mode;item["is_socket"]=wifi_.nodes[i].socket;
    }
  }
  void inspect_wifi_version_logging() {
    wifi_version_logging_={};inspect_wifi();
    if(!ok_)return;
    if(!wifi_.available || !wifi_daemon_.verified) {
      wifi_version_logging_.error="version_logging_control_unavailable";return;
    }
    wifi_version_logging_=cgs1_wifi::inspect_version_logging(size_t(wifi_.selected));
  }
  void inspect_wifi_privacy() {
    wifi_privacy_={};ok_=false;error_.clear();
    if((coordinator_.launched() && !coordinator_.finished()) || display_.busy() ||
        dhcp_capture_.active() || gateway_probe_.active()) {
      error_="active_trial_or_probe_blocks_privacy_inspection";return;
    }
    inspect();if(!ok_)return;
    wifi_privacy_=cgs1_wifi_vendor::inspect_privacy();
    // Device admission and privacy are distinct. A denied /proc mem open or
    // unknown flags is a useful explicit negative result, never quiet success.
  }
  void inspect_dhcp_wait() {
    dhcp_wait_={};ok_=false;error_.clear();
    if((coordinator_.launched() && !coordinator_.finished()) || display_.busy() ||
        dhcp_capture_.active() || gateway_probe_.active()) {
      error_="active_trial_or_probe_blocks_dhcp_wait_inspection";return;
    }
    inspect();if(!ok_)return;
    dhcp_wait_=cgs1_dhcp_wait::inspect();
  }
  void dhcp_wait_report(JsonObject root)const {
    root["observer_version"]=5;
    root["device_inspection_ok"]=ok_;
    root["verified"]=dhcp_wait_.verified;
    root["error"]=dhcp_wait_.error.empty()?error_:dhcp_wait_.error;
    root["known_state"]=dhcp_wait_.state;
    root["known_syscall"]=dhcp_wait_.syscall_number;
    root["status_available"]=dhcp_wait_.status_available;
    root["signals_quiet"]=dhcp_wait_.signals_quiet;
    root["kernel_snapshot_available"]=dhcp_wait_.kernel_snapshot_available;
    root["usr1_handler"]=dhcp_wait_.usr1_handler;
    root["usr2_handler"]=dhcp_wait_.usr2_handler;
    root["term_handler"]=dhcp_wait_.term_handler;
    root["static_libc_code_only"]=true;
    root["libc_code_available"]=dhcp_wait_.libc_code_available;
    root["libc_code_error"]=dhcp_wait_.libc_code_error;
    root["libc_sha256"]=dhcp_wait_.libc_sha256;
    root["libc_select_text_hex"]=dhcp_wait_.libc_select_hex;
    root["libc_select_elf_value"]=dhcp_wait_.libc_select_value;
    root["libc_select_size"]=dhcp_wait_.libc_select_size;
    root["libc_select_file_offset"]=dhcp_wait_.libc_select_offset;
    root["kernel_pc_in_libc_select"]=dhcp_wait_.kernel_pc_in_libc_select;
    root["legacy_libc_select_call_verified"]=dhcp_wait_.legacy_libc_select_call_verified;
    root["wchan_do_select"]=dhcp_wait_.wchan_do_select;
    root["wchan_poll_timeout"]=dhcp_wait_.wchan_poll_timeout;
    root["owner_pid"]=dhcp_wait_.owner.pid;root["owner_start_tick"]=dhcp_wait_.owner.start;
    root["positive_select_input_timeout_observed"]=dhcp_wait_.verified;
    root["positive_base_timeout_from_preserved_r5"]=dhcp_wait_.base_timeout_verified;
    // A positive select INPUT is not the remaining lease time or a generic
    // permission to send a signal. Never export raw pointers/registers/memory.
    root["remaining_lease_lifetime_proven"]=false;
    root["signal_authority_granted"]=false;root["signals_sent"]=false;
    root["raw_registers_or_memory_exported"]=false;
    root["configuration_or_key_read"]=false;root["network_mutation_exposed"]=false;
  }
  void wifi_privacy_report(JsonObject root)const {
    root["device_inspection_ok"]=ok_;
    root["verified"]=wifi_privacy_.verified;
    root["cleanup_verified"]=wifi_privacy_.cleanup_verified;
    root["error"]=wifi_privacy_.error.empty()?error_:wifi_privacy_.error;
    root["daemon_pid"]=wifi_privacy_.daemon.process.pid;
    root["daemon_start_tick"]=wifi_privacy_.daemon.process.start;
    root["socket_inode"]=wifi_privacy_.daemon.socket_inode;
    root["fixed_debug_words_only"]=true;
    root["arbitrary_memory_reader_exposed"]=false;
    root["credential_or_config_memory_read"]=false;
    root["logging_settings_changed"]=false;
    root["network_mutation_exposed"]=false;
    root["historical_report_grants_write_authority"]=false;
  }
  void wifi_version_logging_report(JsonObject root)const {
    // Deliberately small standalone response, not the full diagnostic report:
    // metadata can be read without truncating an otherwise valid API response.
    root["device_inspection_ok"]=ok_;
    root["verified"]=wifi_version_logging_.verified;
    root["version"]=wifi_version_logging_.version;
    root["log_level"]=wifi_version_logging_.level;
    root["timestamps"]=wifi_version_logging_.timestamps;
    root["reported_level_is_quiet"]=wifi_version_logging_.reported_level_is_quiet();
    root["cleanup_verified"]=wifi_version_logging_.cleanup_verified;
    root["error"]=wifi_version_logging_.error;
    root["config_contents_read"]=false;root["credential_getter_exposed"]=false;
    root["logging_settings_changed"]=false;root["network_mutation_exposed"]=false;
  }
  void start_gateway_probe() {
    if(gateway_probe_.attempted()) {ok_=gateway_probe_.start();error_=gateway_probe_.error();return;}
    if((coordinator_.launched() && !coordinator_.finished()) || display_.busy() || dhcp_capture_.active()) {
      ok_=false;error_="active_trial_display_or_capture_blocks_gateway_probe";return;
    }
    inspect();if(!ok_)return;
    ok_=gateway_probe_.start();error_=gateway_probe_.error();
  }
  void stop_gateway_probe(){gateway_probe_.stop();ok_=true;error_.clear();}
  void gateway_probe_report(JsonObject root)const {
    root["probe_version"]=1;root["attempted"]=gateway_probe_.attempted();root["opened"]=gateway_probe_.opened();
    root["active"]=gateway_probe_.active();root["finished"]=gateway_probe_.finished();root["failed"]=gateway_probe_.failed();
    root["error"]=gateway_probe_.error();root["socket_error"]=gateway_probe_.socket_error();
    root["errno_at_socket_refusal"]=gateway_probe_.system_error();
    root["maximum_window_ms"]=2000;root["maximum_echo_send_attempts"]=1;
    root["echo_send_attempted"]=gateway_probe_.sent();root["automatic_retry"]=false;
    root["gateway_reachable_in_this_session"]=gateway_probe_.reachable();
    root["reply_observed_monotonic_ms"]=gateway_probe_.observed_ms();
    root["current_commit_authority"]=false;root["dhcp_lease_freshness_proven"]=false;
    root["process_signals_exposed"]=false;root["network_configuration_writes_exposed"]=false;
    root["arbitrary_destination_or_payload_exposed"]=false;root["raw_packet_exported"]=false;
    root["credential_getter_exposed"]=false;
  }
  void start_dhcp_capture() {
    // Argument-free, fixed-interface passive diagnostic. A lost START reply
    // cannot create another session, even after the first session has ended.
    if(dhcp_capture_.attempted()) {
      ok_=dhcp_capture_.start();error_=dhcp_capture_.error();return;
    }
    if((coordinator_.launched() && !coordinator_.finished()) || display_.busy()) {
      ok_=false;error_="active_trial_or_display_cleanup_blocks_dhcp_capture";return;
    }
    inspect();if(!ok_)return;
    ok_=dhcp_capture_.start();error_=dhcp_capture_.error();
  }
  void stop_dhcp_capture(){dhcp_capture_.stop();ok_=true;error_.clear();}
  void renew_dhcp_once() {
    if(!dhcp_renew_.attempted()) {
      if(fixture_mode_ || (coordinator_.launched() && !coordinator_.finished()) || display_.busy()) {
        ok_=false;error_="fixture_or_active_trial_blocks_dhcp_renew";dhcp_renew_error_=error_;return;
      }
      inspect();if(!ok_){dhcp_renew_error_=error_;return;} // Exact board/stock/files/process scope first.
    }
    ok_=dhcp_renew_.start();error_=dhcp_renew_backend_.error();dhcp_renew_error_=error_;
  }
  void dhcp_renew_report(JsonObject root)const {
    root["renew_version"]=1;root["attempted"]=dhcp_renew_.attempted();
    root["signal_attempted"]=dhcp_renew_backend_.signal_attempted();
    root["signal_queued"]=dhcp_renew_.queued();root["error"]=dhcp_renew_error_;
    root["signal_errno"]=dhcp_renew_backend_.system_error();
    root["owner_pid"]=dhcp_renew_backend_.owner().pid;
    root["owner_start_tick"]=dhcp_renew_backend_.owner().start;
    root["maximum_signal_attempts"]=1;root["automatic_retry"]=false;
    root["fixed_usr1_only"]=true;root["release_or_process_restart"]=false;
    root["wpa_or_configuration_write"]=false;root["credential_getter_exposed"]=false;
    root["dhcp_ack_or_lease_proven_by_signal"]=false;
  }
  void dhcp_capture_report(JsonObject root)const {
    root["probe_version"]=1;root["attempted"]=dhcp_capture_.attempted();
    root["opened"]=dhcp_capture_.opened();root["active"]=dhcp_capture_.active();
    root["finished"]=dhcp_capture_.finished();root["failed"]=dhcp_capture_.failed();
    root["error"]=dhcp_capture_.error();root["capture_error"]=dhcp_capture_.capture_error();
    root["generation"]=dhcp_capture_.generation();root["deadline_monotonic_ms"]=dhcp_capture_.deadline();
    root["maximum_window_ms"]=60000;root["automatic_rearm"]=false;
    root["packets_sent"]=false;root["process_signals_exposed"]=false;root["network_mutations_exposed"]=false;
    root["raw_packet_or_option_exported"]=false;root["credential_getter_exposed"]=false;
    root["lease_observed_in_this_session"]=dhcp_capture_.lease_observed();
    root["lease_observed_monotonic_ms"]=dhcp_capture_.lease_observed_ms();
    // An observation remains useful historical diagnostics after STOP. Never
    // expose it under the name of a current forward-transaction commit proof.
    root["current_commit_authority"]=false;root["gateway_reachability_proven"]=false;
    root["messages"]=dhcp_capture_.messages();root["requests"]=dhcp_capture_.requests();root["acks"]=dhcp_capture_.acks();
    const auto&c=dhcp_capture_.counters();auto counters=root["capture_counters"].to<JsonObject>();
    counters["received"]=c.received;counters["wrong_direction"]=c.wrong_direction;
    counters["decode_refused"]=c.decode_refused;counters["last_packet_type"]=c.last_packet_type;
    counters["deferred_tx"]=c.deferred_tx;
  }
  void inspect_dhcp_owner() {
    dhcp_owner_={};inspect();if(!ok_)return;
    dhcp_owner_=cgs1_dhcp::inspect();ok_=dhcp_owner_.supported;
    if(!ok_)error_=dhcp_owner_.error;
  }
  void dhcp_owner_report(JsonObject root)const {
    // Standalone bounded metadata, never the complete diagnostic report or
    // raw argv. Hostname/options/config bytes and unknown hashes stay private.
    root["device_inspection_ok"]=ok_;root["error"]=dhcp_owner_.error;
    root["known_path_scan_complete"]=dhcp_owner_.scan_complete;
    root["dhcp_inventory_version"]=5;root["argv_prefix_filter"]=true;root["known_executable_paths_only"]=true;
    root["effective_option_semantics_verified"]=false;
    root["unreadable_processes"]=dhcp_owner_.unreadable;
    root["processes_without_user_executable"]=dhcp_owner_.without_user_executable;
    root["other_interface_clients"]=dhcp_owner_.other_clients;
    root["canonical_private_parent_available"]=dhcp_owner_.canonical_parent_available;
    root["vendor_launcher_matches_known_537_bytes"]=dhcp_owner_.vendor_launcher_matches;
    root["process_signals_exposed"]=false;root["network_mutations_exposed"]=false;
    root["credential_getter_exposed"]=false;root["argv_or_environment_exported"]=false;
    root["fixed_launcher_bytes_exported"]=false;root["unknown_launcher_hash_exported"]=false;
    auto ipv4=root["kernel_ipv4"].to<JsonObject>();
    const auto&v=dhcp_owner_.ipv4;
    ipv4["verified"]=v.verified;ipv4["error"]=v.error;ipv4["interface_index"]=v.index;
    ipv4["up"]=v.up;ipv4["running"]=v.running;ipv4["unique_connected_default_route"]=v.route_bound;
    ipv4["dhcp_lease_freshness_proven"]=false;ipv4["gateway_reachability_proven"]=false;
    ipv4["packets_sent"]=false;ipv4["ioctl_writes_exposed"]=false;
    if(v.verified) {
      ipv4["address"]=cgs1_ipv4::address_text(v.address);ipv4["netmask"]=cgs1_ipv4::address_text(v.netmask);
      if(v.route_bound){ipv4["gateway"]=cgs1_ipv4::address_text(v.route.gateway);ipv4["metric"]=v.route.metric;}
    }
    auto executable=root["resolved_udhcpc_executable"].to<JsonObject>();
    executable["verified"]=dhcp_owner_.executable.verified;
    executable["filesystem_read_only"]=dhcp_owner_.executable.filesystem_read_only;
    if(dhcp_owner_.executable.verified) {
      executable["path"]=dhcp_owner_.executable.path;executable["sha256"]=dhcp_owner_.executable.sha256;
      executable["bytes"]=dhcp_owner_.executable.bytes;executable["busybox_version"]=dhcp_owner_.executable.busybox_version;
    }
    auto reasons=root["failure_stage_counts"].to<JsonArray>();
    const char*stages[]{"stat_parse","exe_read","owner_or_state","argv_prefix","argv_read","argv_shape","birth_changed"};
    for(unsigned n=0;n<7;++n) {
      auto item=reasons.add<JsonObject>();item["stage"]=stages[n];item["count"]=dhcp_owner_.failure_stages[n];
    }
    auto rejected=root["rejected_candidates"].to<JsonArray>();
    for(const auto&r:dhcp_owner_.rejected) {
      auto item=rejected.add<JsonObject>();item["pid"]=r.pid;item["start_tick"]=r.start;
      item["stage"]=r.stage;item["unsupported_short_option_ascii"]=r.short_option;item["argc"]=r.arguments;
      item["argument_failure"]=unsigned(r.failure);item["failure_index"]=r.failure_index;
      auto shape=item["argument_shape"].to<JsonArray>();
      for(const auto&t:r.shape) {
        auto token=shape.add<JsonObject>();token["index"]=t.index;token["kind"]=unsigned(t.kind);
        token["known_option_ascii"]=t.known_option;
      }
    }
    JsonArray parents=root["parent_metadata"].to<JsonArray>();
    const char*paths[]{"/","/data","/data/.esphome-cgs1"};
    for(unsigned n=0;n<3;++n) {
      auto item=parents.add<JsonObject>();const auto&p=dhcp_owner_.parents[n];
      item["path"]=paths[n];item["lstat_errno"]=p.error;item["owner_uid"]=p.owner;item["mode"]=p.mode;
      item["device"]=p.device;item["inode"]=p.inode;item["is_directory"]=p.directory;item["is_symlink"]=p.symlink;
    }
    JsonArray clients=root["wlan0_clients"].to<JsonArray>();
    for(const auto&client:dhcp_owner_.clients) {
      auto item=clients.add<JsonObject>();const auto&p=client.process;const auto&f=client.flags;
      item["pid"]=p.pid;item["parent_pid"]=p.parent;item["start_tick"]=p.start;item["executable"]=p.executable;
      item["background_option"]=f.background;item["foreground_option"]=f.foreground;item["release_option"]=f.release;
      item["additional_options_present"]=f.extra_options;item["script_whitelist_index"]=f.script;
      item["uninterpreted_operand_count"]=f.operands;item["options_observed_after_operand"]=f.options_after_operand;
    }
  }
  void report(JsonObject root) const {
    // Retain the last probe result in the ordinary read-only status too.
    // A lost action response can be reconciled without launching it again.
    supervisor_kernel_fields(root);
    root["last_operation_ok"] = ok_;
    root["error"] = error_;
    root["inspected"] = inspected_;
    root["fixture_mode"] = fixture_mode_;
    root["staging_only"] = !allow_trial_;
    root["launch_enabled"] = allow_trial_;
    root["phase"] = coordinator_.phase();
    root["prepared"] = coordinator_.prepared();
    root["launched"] = coordinator_.launched();
    root["stock_restored"] = coordinator_.finished();
    root["coordinator_error"] = coordinator_.error();
    root["pm_suspended"] = pm_suspended_;
    root["display_cleanup_state"] = display_.state();
    root["display_cleanup_error"] = display_.error();
    root["display_cleanup_attempted"] = display_.attempted();
    root["old_miio_pid"] = display_.old_pid();
    root["new_miio_pid"] = display_.new_pid();
    if (inspection_.verified) {
      root["boot_id"] = inspection_.boot_id;
      root["bridge_sha256"] = inspection_.bridge_sha;
      root["critical_files_verified"] = true;
      JsonArray processes = root["processes"].to<JsonArray>();
      static constexpr const char *NAMES[] = {"stock", "wrapper", "watchdog",
                                              "bridge"};
      for (size_t i = 0; i < inspection_.processes.size(); ++i) {
        const auto &identity = inspection_.processes[i];
        JsonObject item = processes.add<JsonObject>();
        item["role"] = NAMES[i];
        item["pid"] = identity.pid;
        item["start_tick"] = identity.start;
        item["state"] = std::string(1, identity.state);
        item["executable"] = identity.executable;
      }
    }
    if (!stage_)
      return;
    root["job"] = stage_->job();
    root["ready"] = stage_->ready();
    JsonArray artifacts = root["artifacts"].to<JsonArray>();
    for (size_t i = 0; i < cgs1_net_trial::Staging::COUNT; ++i) {
      JsonObject item = artifacts.add<JsonObject>();
      item["kind"] = cgs1_net_trial::Staging::NAMES[i];
      item["size"] = manifest_[i].size;
      item["sha256"] = manifest_[i].sha256;
      item["offset"] = stage_->offset(i);
      item["verified"] = stage_->verified(i);
    }
  }
  void diagnostics(JsonObject root) const {
    report(root);
    root["guard_phase"] = cgs1_net_trial::plain_diagnostic(coordinator_.diagnostic("phase"));
    for (const auto *name :
         {"program.log", "guardian.log", "backup.log",
          "controller.log", "recovery-error", "trial-exit", "recovered",
          "pm-power-armed", "pm-power-restored", "pm-power-recovery-error",
          "wifi-ram-armed", "wifi-ram-restored", "wifi-ram-guard-verified", "wifi-ram-recovery-error", "wifi-ram-phase"})
      root[name] = cgs1_net_trial::plain_diagnostic(coordinator_.diagnostic(name));
  }
  void display_report(JsonObject root) const {
    report(root);
    root["miio_client_sha256"] = cgs1_net_trial::sha_file(cgs1_net_trial::DisplayMaintenance::CLIENT);
    root["miio_script_sha256"] = cgs1_net_trial::sha_file(cgs1_net_trial::DisplayMaintenance::SCRIPT);
    const auto client = cgs1_net_trial::unique_process(cgs1_net_trial::DisplayMaintenance::CLIENT);
    root["miio_client_pid"] = client.pid;
    root["miio_client_argv_expected"] = client.pid && cgs1_net_trial::process_arguments(client.pid) == cgs1_net_trial::DisplayMaintenance::client_arguments();
    JsonArray owners = root["display_owners"].to<JsonArray>();
    for (const auto& owner : display_owners_) {
      JsonObject item = owners.add<JsonObject>();
      item["pid"] = owner.process.pid;
      item["start_tick"] = owner.process.start;
      item["executable"] = owner.process.executable;
      item["drm_descriptors"] = owner.descriptors;
      item["recognized_publisher"] = cgs1_net_trial::vendor_publisher(owner.process);
    }
  }

private:
  cgs1_dhcp_vendor::VendorProgram dhcp_vendor_;
  bool dhcp_vendor_attempted_{false},dhcp_vendor_released_{false};
  uint32_t dhcp_vendor_generation_{0};size_t dhcp_vendor_page_{0};
  cgs1_wifi_vendor::VendorProgram wifi_vendor_;
  bool wifi_vendor_attempted_{false},wifi_vendor_released_{false};
  uint32_t wifi_vendor_generation_{0};size_t wifi_vendor_page_{0};
  cgs1_bluetooth::Inventory bluetooth_;
  cgs1_bluetooth::VendorBinary bluetooth_vendor_;
  uint32_t bluetooth_vendor_generation_{0};
  size_t bluetooth_vendor_page_{0};
  bool bluetooth_snapshot_{false};
  uint32_t bluetooth_generation_{0};
  size_t bluetooth_page_{0};
  size_t bluetooth_pages_() const { return std::max(size_t(1), (bluetooth_.items.size() + 7) / 8); }
  void accept_bluetooth_snapshot_() {
    // Bound to the API's signed integer field. A fresh inspection retires old
    // page coordinates; reads never mix observations from different snapshots.
    bluetooth_generation_ = bluetooth_generation_ >= 0x7ffffffe ? 1 : bluetooth_generation_ + 1;
    bluetooth_snapshot_ = true;
  }
  std::array<cgs1_net_trial::Staging::Artifact, cgs1_net_trial::Staging::COUNT> manifest_{};
  std::unique_ptr<cgs1_net_trial::Staging> stage_;
  cgs1_net_trial::StockInspection inspection_;
  cgs1_net_trial::TrialCoordinator coordinator_;
  cgs1_net_trial::DisplayMaintenance display_;
  cgs1_pm::Inspection pm_hardware_;
  cgs1_wifi::Inspection wifi_;
  std::vector<cgs1_wifi::SavedProfile> wifi_profiles_;
  bool wifi_profiles_verified_{false};std::string wifi_profiles_error_;
  cgs1_wifi::DaemonInspection wifi_daemon_;
  cgs1_wifi::VersionLogging wifi_version_logging_;
  cgs1_wifi_vendor::PrivacyInspection wifi_privacy_;
  cgs1_dhcp_wait::Inspection dhcp_wait_;
  cgs1_dhcp::Inspection dhcp_owner_;
  cgs1_dhcp_lease::CaptureProbe<> dhcp_capture_;
  cgs1_gateway::Probe<> gateway_probe_;
  cgs1_dhcp_renew::Backend<> dhcp_renew_backend_{dhcp_capture_,gateway_probe_};
  cgs1_dhcp_renew::OneShot<cgs1_dhcp_renew::Backend<>> dhcp_renew_{dhcp_renew_backend_};
  std::string dhcp_renew_error_;
  std::vector<cgs1_net_trial::DisplayOwner> display_owners_;
  bool allow_trial_{false}, pm_suspended_{false};
  bool fixture_mode_{false}, inspected_{false}, ok_{false};
  bool kernel_probe_attempted_{false};
#if defined(__linux__)
  cgs1_supervisor::KernelProbeResult kernel_probe_;
#endif
  uint32_t inspected_at_{0};
  std::string error_;
  static std::string string(StringRef v) {
    return std::string(v.c_str(), v.size());
  }
  void result(bool ok) {
    ok_ = ok;
    error_ = ok ? std::string{} : stage_->error();
  }
};
} // namespace esphome::cgs1_maintenance
