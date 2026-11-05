#pragma once
// Use ESPHome's existing Wi-Fi stack and preference namespace. Trials alter
// only RAM: loss of power before COMMIT therefore boots the previous saved
// configuration. No password is logged, published to HA or returned by status.
#include "ui_model.h"
#include "esphome/components/wifi/wifi_component.h"
#include "esphome/core/preferences.h"
#include <cstdio>
#include <vector>

namespace esphome::cgdn1_ui {
struct SavedNetwork { char ssid[33]{}; char password[65]{}; };
struct SavedNetworks { uint32_t magic{0x43554932}; uint8_t count{0}; int8_t active{-1}; SavedNetwork entries[4]{}; };
struct Network { std::string ssid; int rssi{-127}; bool secured{true}; };

class WifiSettings : public wifi::WiFiScanResultsListener {
 public:
  void setup() {
    // A stable dedicated key is intentional: ESPHome's own saved-Wi-Fi key
    // includes the whole configuration hash and otherwise changes on a UI OTA.
    pref_ = global_preferences->make_preference<SavedNetworks>(0x43554932);
    SavedNetworks loaded{};
    if (pref_.load(&loaded) && loaded.magic == 0x43554932 && loaded.count <= 4 && loaded.active >= -1 && loaded.active < loaded.count) {
      bool valid = true;
      for (int i = 0; i < loaded.count; i++)
        valid = valid && std::memchr(loaded.entries[i].ssid, 0, 33) && std::memchr(loaded.entries[i].password, 0, 65);
      if (valid) saved_ = loaded;
    }
    erase_secret(reinterpret_cast<char *>(&loaded), sizeof(loaded));
    wifi::global_wifi_component->add_scan_results_listener(this);
    if (saved_.active >= 0) {
      const auto &entry = saved_.entries[saved_.active];
      wifi::WiFiAP active;
      active.set_ssid(entry.ssid); active.set_password(entry.password);
      wifi::global_wifi_component->set_sta(active);
      wifi::global_wifi_component->start_connecting(active);
    }
    // The compiled-in/current ESPHome profile is available even on the first
    // upgrade, before our optional four-network history has been created.
    append_current_();
  }
  void on_wifi_scan_results(const wifi::wifi_scan_vector_t<wifi::WiFiScanResult> &results) override {
    if (!scanning_) return;
    networks_.clear();
    for (const auto &r : results) {
      if (r.get_is_hidden() || r.get_ssid().empty()) continue;
      const std::string name = r.get_ssid().str();
      auto found = std::find_if(networks_.begin(), networks_.end(), [&](const Network &n) { return n.ssid == name; });
      if (found != networks_.end()) { if (r.get_rssi() > found->rssi) found->rssi = r.get_rssi(); continue; }
      if (networks_.size() < 12) networks_.push_back({name, r.get_rssi(), r.get_with_auth()});
    }
    std::stable_sort(networks_.begin(), networks_.end(), [](const Network &a, const Network &b) { return a.rssi > b.rssi; });
    for (int i = 0; i < saved_.count; i++) append_saved_(saved_.entries[i].ssid, saved_.entries[i].password[0] != 0);
    append_current_(); scanning_ = false;
  }
  void scan(uint32_t now) {
    if (trial_.active() || scanning_) return;
    scanning_ = true; scan_started_ = now;
    wifi::global_wifi_component->start_scanning();
  }
  bool scanning() const { return scanning_; }
  const std::vector<Network> &networks() const { return networks_; }
  int saved_index(const std::string &ssid) const {
    for (int i = 0; i < saved_.count; i++) if (ssid == saved_.entries[i].ssid) return i;
    return -1;
  }
  bool known(const std::string &ssid) const {
    return saved_index(ssid) >= 0 || wifi::global_wifi_component->get_sta().get_ssid().str() == ssid;
  }
  bool start_saved(const Network &n, uint32_t now) {
    const int index = saved_index(n.ssid);
    if (index >= 0) return start(n, saved_.entries[index].password, now);
    const auto current = wifi::global_wifi_component->get_sta();
    if (current.get_ssid().str() == n.ssid) return start(n, current.get_password().c_str(), now);
    if (!n.secured) return start(n, "", now);
    return false;
  }
  bool start(const Network &n, const char *password, uint32_t now) {
    if (trial_.active() || n.ssid.empty() || n.ssid.size() > 32 || !valid_password(password, n.secured)) return false;
    auto *wf = wifi::global_wifi_component;
    previous_ = wf->get_sta();  // complete in-RAM recovery copy, never printed
    candidate_ = wifi::WiFiAP{};
    candidate_.set_ssid(n.ssid); candidate_.set_password(password);
    scanning_ = false;  // freeze the selected list while the transaction owns it
    trial_.begin(now);
    // set_sta alone does not reconnect an already connected component. Use
    // the SDK's public connection entry point; disable/enable is wrong here
    // because enable() reloads the old persistent credentials in this SDK.
    wf->set_sta(candidate_); wf->start_connecting(candidate_);
    return true;
  }
  void cancel() { if (trial_.cancel() == TrialAction::ROLLBACK) rollback_(); }
  bool trial_active() const { return trial_.active(); }
  TrialAction tick(uint32_t now, bool ota_active) {
    if (scanning_ && uint32_t(now - scan_started_) >= 20000) scanning_ = false;
    // loop() runs far more often than the display. Do not query lwIP/netif
    // or allocate address buffers when there is no credential trial: that
    // would needlessly load the CPU and change the sensor's self-heating.
    if (!trial_.active()) return TrialAction::NONE;
    auto *wf = wifi::global_wifi_component;
    char ssid[wifi::SSID_BUFFER_SIZE];
    bool has_ip = false;
    for (const auto &ip : wf->get_ip_addresses()) if (ip.is_set() && ip.is_ip4()) has_ip = true;
    const bool matches = wf->is_connected() && has_ip && candidate_.get_ssid() == wf->wifi_ssid_to(ssid);
    const TrialAction action = trial_.tick(now, matches, ota_active);
    if (action == TrialAction::COMMIT) {
      // One preference blob atomically holds the four profiles and active
      // index. It is written only after STABLE. Do not call save_wifi_sta():
      // that creates a second, config-hash-dependent credential store and a
      // second commit boundary. The previous ESPHome slot keeps its own key.
      SavedNetworks before = saved_;
      remember_(previous_);
      remember_(candidate_);
      saved_.active = saved_index(candidate_.get_ssid().str());
      if (!pref_.save(&saved_) || !global_preferences->sync()) {
        saved_ = before; pref_.save(&saved_); global_preferences->sync();
        erase_secret(reinterpret_cast<char *>(&before), sizeof(before));
        rollback_();
        return TrialAction::ROLLBACK;
      }
      erase_secret(reinterpret_cast<char *>(&before), sizeof(before));
      candidate_ = previous_ = wifi::WiFiAP{};
    } else if (action == TrialAction::ROLLBACK) rollback_();
    return action;
  }
 private:
  void append_saved_(const std::string &ssid, bool secured = true) {
    if (ssid.empty()) return;
    for (const auto &n : networks_) if (n.ssid == ssid) return;
    networks_.push_back({ssid, -127, secured});
  }
  void append_current_() {
    const auto current = wifi::global_wifi_component->get_sta();
    append_saved_(current.get_ssid().str(), !current.get_password().empty());
  }
  void remember_(const wifi::WiFiAP &profile) {
    const std::string ssid = profile.get_ssid().str();
    if (ssid.empty()) return;
    int index = saved_index(ssid);
    if (index < 0) {
      if (saved_.count < 4) index = saved_.count++;
      else {
        // Fixed four-entry history; evict the oldest, never a partial draft.
        for (int i = 1; i < 4; i++) saved_.entries[i - 1] = saved_.entries[i];
        index = 3;
      }
    }
    auto &out = saved_.entries[index];
    erase_secret(out.password, sizeof(out.password));
    std::snprintf(out.ssid, sizeof(out.ssid), "%s", profile.get_ssid().c_str());
    std::snprintf(out.password, sizeof(out.password), "%s", profile.get_password().c_str());
  }
  void rollback_() {
    auto *wf = wifi::global_wifi_component;
    wf->set_sta(previous_); wf->start_connecting(previous_);
    candidate_ = previous_ = wifi::WiFiAP{};
  }
  ESPPreferenceObject pref_;
  SavedNetworks saved_{};
  std::vector<Network> networks_;
  wifi::WiFiAP previous_, candidate_;
  NetworkTrial trial_;
  bool scanning_{false};
  uint32_t scan_started_{0};
};
}  // namespace esphome::cgdn1_ui
