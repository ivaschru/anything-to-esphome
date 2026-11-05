#pragma once

// Read-only privacy observation for ONE reviewed ET_EXEC image. A version or
// quiet LOG_LEVEL cannot establish this: wpa_msg callbacks bypass the printf
// threshold, and show_keys may change through a separate vendor entry point.
// Read only the two proven 32-bit debug globals, never a memory range, string,
// configuration or key. No PID/address/path is accepted from a user or API.
#include "wpa_vendor_binary.h"
#include "wifi_version_logging.h"

namespace cgs1_wifi_vendor {
static constexpr const char *REVIEWED_WPA_SHA256=
  "207b35acc0a06f4c0b6c3fbc1618d85a74248c29b09815c988b8fa109e55f626";
static constexpr size_t REVIEWED_WPA_SIZE=1118292;

struct PrivacyInspection {
  bool verified{false},cleanup_verified{true};
  cgs1_wifi::DaemonInspection daemon;
  std::string error;
  // This report is diagnostic only. Production setter authority must retain
  // the exact native scope and call the observer again BEFORE EACH setter.
  // A historical verified report must never become a durable permission bit.
};

namespace privacy_detail {
inline bool quiet_words(uint32_t level,uint32_t show_keys) {
  return level>=3 && level<=5 && show_keys==0;
}
#if defined(__linux__)
struct Descriptor {
  int fd{-1};explicit Descriptor(int value):fd(value){}
  ~Descriptor(){if(fd>=0)::close(fd);}
  Descriptor(const Descriptor&)=delete;Descriptor&operator=(const Descriptor&)=delete;
};
inline bool debug_words(int mem,uint32_t &level,uint32_t &show_keys) {
  // ET_EXEC addresses are meaningful only after the caller's full image hash,
  // live executable inode and owner checks. These fixed offsets are .data and
  // .bss debug integers from analyze_wpa_vendor_logging.py, not search results
  // or caller-selected offsets. pread never advances into adjacent variables.
  uint8_t words[2][4]{};
  constexpr off_t OFFSETS[]={0x1204dc,0x120bbc};
  for(unsigned n=0;n<2;++n) {
    ssize_t count;
    do {count=::pread(mem,words[n],4,OFFSETS[n]);}while(count<0 && errno==EINTR);
    if(count!=4)return false;
  }
  auto le=[](const uint8_t*p){return uint32_t(p[0])|(uint32_t(p[1])<<8)|
      (uint32_t(p[2])<<16)|(uint32_t(p[3])<<24);};
  level=le(words[0]);show_keys=le(words[1]);return true;
}
inline bool same_daemon(const cgs1_wifi::DaemonInspection&a,const cgs1_wifi::DaemonInspection&b) {
  return a.verified && b.verified && a.socket_inode==b.socket_inode &&
    a.process.pid==b.process.pid && a.process.start==b.process.start &&
    a.process.executable==b.process.executable;
}
#endif
} // namespace privacy_detail

inline PrivacyInspection inspect_privacy() {
  PrivacyInspection result;
#if defined(__linux__)
  using privacy_detail::Descriptor;
  const auto before=cgs1_wifi::inspect_daemon(0);
  if(!before.verified || before.process.executable!="/usr/sbin/wpa_supplicant") {
    result.error="privacy_verified_vendor_owner_required";return result;
  }
  const auto image=read_supplicant();
  if(!image.verified || image.sha256!=REVIEWED_WPA_SHA256 || image.bytes.size()!=REVIEWED_WPA_SIZE) {
    result.error="privacy_reviewed_exact_image_required";return result;
  }
  const auto root="/proc/"+std::to_string(before.process.pid);
  Descriptor proc(::open(root.c_str(),O_RDONLY|O_DIRECTORY|O_CLOEXEC|O_NOFOLLOW));
  struct stat st{},exe_before{},exe_after{};struct statfs fs{};
  if(proc.fd<0 || ::fstat(proc.fd,&st) || st.st_uid!=0 || !S_ISDIR(st.st_mode) ||
      ::fstatfs(proc.fd,&fs) || fs.f_type!=0x9fa0 ||
      ::fstatat(proc.fd,"exe",&exe_before,0) || !S_ISREG(exe_before.st_mode) ||
      uint64_t(exe_before.st_dev)!=image.file_device || uint64_t(exe_before.st_ino)!=image.file_inode) {
    result.error="privacy_current_executable_inode_required";return result;
  }
  Descriptor memory(::openat(proc.fd,"mem",O_RDONLY|O_CLOEXEC|O_NOFOLLOW));
  if(memory.fd<0 || ::fstat(memory.fd,&st) || !S_ISREG(st.st_mode) || st.st_uid!=0 ||
      ::fstatfs(memory.fd,&fs) || fs.f_type!=0x9fa0) {
    result.error="privacy_fixed_debug_flags_unavailable";return result;
  }
  uint32_t first_level=0,first_keys=0,last_level=0,last_keys=0;
  const bool first=privacy_detail::debug_words(memory.fd,first_level,first_keys);
  const auto metadata=cgs1_wifi::inspect_version_logging(0);
  result.cleanup_verified=metadata.cleanup_verified;
  const bool last=privacy_detail::debug_words(memory.fd,last_level,last_keys);
  const auto after=cgs1_wifi::inspect_daemon(0);
  const uint32_t expected=metadata.level=="INFO"?3:metadata.level=="WARNING"?4:metadata.level=="ERROR"?5:0;
  if(!first || !last || !privacy_detail::quiet_words(first_level,first_keys) ||
      first_level!=last_level || first_keys!=last_keys || !metadata.verified ||
      !metadata.cleanup_verified || first_level!=expected ||
      !privacy_detail::same_daemon(before,after) ||
      ::fstatat(proc.fd,"exe",&exe_after,0) || exe_before.st_dev!=exe_after.st_dev ||
      exe_before.st_ino!=exe_after.st_ino) {
    result.error="privacy_flags_metadata_or_owner_refused";return result;
  }
  result.daemon=after;result.verified=true;
#else
  result.error="privacy_verified_linux_required";
#endif
  return result;
}
} // namespace cgs1_wifi_vendor
