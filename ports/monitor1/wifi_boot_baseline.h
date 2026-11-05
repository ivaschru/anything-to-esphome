#pragma once

// Structural classification for the separate saved-network boot adapter.
// This deliberately does NOT relax ProbeBackend::read(), Plan::valid(), or
// ordinary touchscreen preparation. A disconnected catalog must later have
// its OWN sealed plan mode and guardian rollback policy; it cannot be passed
// off as a connected baseline with an invented CURRENT row.
//
// No socket, signal, credential, Store or filesystem operation occurs here.
// The result grants no write/commit/lease authority. Production still needs
// independently verified boot/daemon/catalog stability and frozen writers.
#include "wifi_saved_profiles.h"

namespace cgs1_wifi_boot {
enum class Baseline {UNSUPPORTED,CONNECTED,UNASSOCIATED};

inline Baseline classify(const cgs1_wifi::Status&status,
    const std::vector<cgs1_wifi::SavedProfile>&profiles) {
  if(profiles.size()>=32)return Baseline::UNSUPPORTED;
  const cgs1_wifi::SavedProfile*current=nullptr;
  for(size_t n=0;n<profiles.size();++n) {
    const auto&p=profiles[n];
    if(p.id<0 || p.id>1000000 || p.ssid_text.size()>128 ||
        (p.bssid!="any" && !cgs1_wifi::mac_address(p.bssid)) ||
        !p.flags_known || p.temporarily_disabled || (p.current && p.disabled))
      return Baseline::UNSUPPORTED;
    for(unsigned char c:p.ssid_text)if(c<32 || c==127)return Baseline::UNSUPPORTED;
    // Recheck the actual flags rather than trusting separately supplied
    // booleans. P2P/backoff/unknown or contradictory rows are never normalized.
    if(p.flags!=(p.current?"[CURRENT]":p.disabled?"[DISABLED]":""))
      return Baseline::UNSUPPORTED;
    for(size_t before=0;before<n;++before)
      if(profiles[before].id==p.id)return Baseline::UNSUPPORTED;
    if(p.current){if(current)return Baseline::UNSUPPORTED;current=&p;}
  }
  if(status.state=="COMPLETED") {
    if(!current || current->id!=status.network_id ||
        !cgs1_wifi::mac_address(status.bssid) || status.bssid=="00:00:00:00:00:00")
      return Baseline::UNSUPPORTED;
    return Baseline::CONNECTED;
  }
  // Association/authentication in progress or actual STATUS association
  // metadata is not a quiescent boot baseline. LIST_NETWORKS CURRENT is a
  // different observation: the exact vendor formatter compares current_ssid
  // pointers, not wpa_state. Retain that real row even if STATUS is SCANNING;
  // never invent a CURRENT row or treat it as a successful association.
  if(status.state!="DISCONNECTED" && status.state!="INACTIVE" && status.state!="SCANNING")
    return Baseline::UNSUPPORTED;
  if(status.network_id!=-1 || status.frequency>0 || status.ssid_text_bytes>0 ||
      (!status.bssid.empty() && status.bssid!="00:00:00:00:00:00") ||
      (!status.key_management.empty() && status.key_management!="UNKNOWN" && status.key_management!="NONE"))
    return Baseline::UNSUPPORTED;
  // A retained ip_address is intentionally irrelevant. This says only "no
  // WPA association", never that DHCP is fresh or the old route is usable.
  // Post-SELECT DHCP/kernel/gateway evidence must stay the ordinary real proof.
  return Baseline::UNASSOCIATED;
}
} // namespace cgs1_wifi_boot
