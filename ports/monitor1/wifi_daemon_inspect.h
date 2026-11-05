#pragma once

// Read-only socket-owner identity. /proc/net/unix's socket inode is NOT the
// filesystem inode returned by lstat(path). Match its exact kernel Path and
// inode to a daemon's fd link, then fence PID/start/executable before/after.
// No argv, environment, config file or credential is read.
#include "network_preflight.h"
#include "wifi_saved_profiles.h"

namespace cgs1_wifi {
struct DaemonInspection {
  bool verified{false};uint64_t socket_inode{0};
  cgs1_net_trial::ProcessIdentity process;
  std::string error;
};
inline DaemonInspection inspect_daemon(size_t selected,const std::string &proc="/proc") {
  DaemonInspection result;
#if defined(__linux__)
  if(selected>=CONTROL_PATHS.size() || ::geteuid()!=0) {result.error="root_selected_socket_required";return result;}
  result.socket_inode=control_socket_inode(cgs1_net_trial::read_small(proc+"/net/unix",65536),CONTROL_PATHS[selected]);
  if(!result.socket_inode) {result.error="unique_kernel_socket_inode_required";return result;}
  static constexpr const char *PATHS[]={"/sbin/wpa_supplicant","/usr/sbin/wpa_supplicant","/usr/bin/wpa_supplicant"};
  unsigned owners=0;
  const auto target="socket:["+std::to_string(result.socket_inode)+"]";
  for(const char *executable:PATHS) {
    const auto process=cgs1_net_trial::unique_process(executable,{},proc);
    if(!process.pid)continue;
    const auto base=proc+"/"+std::to_string(process.pid);struct stat owner{};
    if(::lstat(base.c_str(),&owner) || !S_ISDIR(owner.st_mode) || owner.st_uid!=0)continue;
    DIR *fds=::opendir((base+"/fd").c_str());if(!fds)continue;
    bool owns=false;unsigned count=0;
    while(const auto *entry=::readdir(fds)) {
      const std::string name=entry->d_name;
      if(name.empty() || name.find_first_not_of("0123456789")!=std::string::npos)continue;
      if(++count>1024){owns=false;break;}
      if(cgs1_net_trial::read_link(base+"/fd/"+name)==target)owns=true;
    }
    ::closedir(fds);
    if(owns && cgs1_net_trial::same_process(process,proc)) {++owners;result.process=process;}
  }
  const auto after=control_socket_inode(cgs1_net_trial::read_small(proc+"/net/unix",65536),CONTROL_PATHS[selected]);
  if(owners!=1 || after!=result.socket_inode) {result.error="unique_stable_socket_owner_required";return result;}
  result.verified=true;
#else
  (void)selected;(void)proc;result.error="verified_linux_required";
#endif
  return result;
}
} // namespace cgs1_wifi
