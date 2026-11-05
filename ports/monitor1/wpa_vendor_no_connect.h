#pragma once

// Exact-image capability, not a version/substring/remote toggle. Offline
// analyze_wpa_vendor_logging.py verifies this handler's early success return
// after disabled=0 and before normal enable/reconnect. The live join below
// binds that code to the current control-socket owner and immutable inode.
// No network command, process memory read, configuration or key getter.
#include "wpa_vendor_privacy.h"

namespace cgs1_wifi_vendor {
struct NoConnectInspection {
  bool verified{false};cgs1_wifi::DaemonInspection daemon;
};
inline NoConnectInspection inspect_no_connect() {
  NoConnectInspection result;
#if defined(__linux__)
  const auto before=cgs1_wifi::inspect_daemon(0);
  if(!before.verified || before.process.executable!="/usr/sbin/wpa_supplicant")return result;
  const auto image=read_supplicant();
  if(!image.verified || image.sha256!=REVIEWED_WPA_SHA256 || image.bytes.size()!=REVIEWED_WPA_SIZE)return result;
  struct stat executable{};
  // This fixed proc magic link intentionally resolves the RUNNING image.
  // A replacement pathname cannot attest an already running different inode.
  const auto path="/proc/"+std::to_string(before.process.pid)+"/exe";
  if(::stat(path.c_str(),&executable) || !S_ISREG(executable.st_mode) || executable.st_uid!=0 ||
      uint64_t(executable.st_dev)!=image.file_device || uint64_t(executable.st_ino)!=image.file_inode)return result;
  const auto after=cgs1_wifi::inspect_daemon(0);
  if(!privacy_detail::same_daemon(before,after))return result;
  struct stat last{};
  if(::stat(path.c_str(),&last) || last.st_dev!=executable.st_dev || last.st_ino!=executable.st_ino)return result;
  result.daemon=after;result.verified=true;
#endif
  return result;
}
} // namespace cgs1_wifi_vendor
