#pragma once

// Fixed production native scope, not a caller bool/path/Backend. It joins the
// admitted bootstrap/channel peers with the canonical runtime, stopped stock
// writers, live bridge and WPA owner. It never selects a network or writes a
// journal. File cleanup and forward preparation still need separate decision
// locks and acknowledgements within this currently live scope.
#include "supervisor_native_bootstrap.h"
#include "supervisor_wifi_private_root.h"
#include "wifi_daemon_inspect.h"
#include "wifi_guard_plan.h"
#include "wpa_vendor_privacy.h"
#include "wpa_vendor_no_connect.h"

namespace cgs1_supervisor {
class NativeWifiScope final {
 public:
  explicit NativeWifiScope(NativeFullBootstrap&bootstrap):bootstrap_(bootstrap) {
    if(!bootstrap_.connected())return;
    runtime_=::fcntl(bootstrap_.runtime_fd(),F_DUPFD_CLOEXEC,3);
    ready_=runtime_>=0 && !::fstat(runtime_,&identity_) && private_root_.open();
  }
  NativeWifiScope(const NativeWifiScope&)=delete;NativeWifiScope&operator=(const NativeWifiScope&)=delete;
  ~NativeWifiScope(){if(runtime_>=0)::close(runtime_);}
  int runtime_fd()const{return ready_?runtime_:-1;}
  const char*last_check()const{return check_;}
  int duplicate_private_parent()const{return ready_?private_root_.duplicate():-1;}
  bool identify_plan(cgs1_wifi_guard::Plan&plan)const {
    // Coordinates only, not permission to publish a journal or write WPA.
    // current(plan), exact Store and both independent guardians are checked
    // after the builder has assembled the rest of this immutable plan.
    if(!ready_ || !bootstrap_.connected() || !private_root_.current())return false;
    plan.full_session=bootstrap_.plan().nonce;
    plan.boot_id=bootstrap_.plan().stock.boot_id;return true;
  }
  bool current(const cgs1_wifi_guard::Plan&plan)const {
    check_="scope_initial";
    if(!ready_ || !bootstrap_.connected() || !private_root_.current() || !cgs1_wifi_guard::valid(plan))return false;
    const auto&full=bootstrap_.plan();const auto root="/tmp/qingping-full-"+full.nonce;
    struct stat held{},named{},effects{};struct statfs fs{};
    check_="scope_runtime_boot_effects";
    if(plan.full_session!=full.nonce || plan.boot_id!=full.stock.boot_id || plan.created_ms<full.created_ms ||
        cgs1_net_trial::read_small("/proc/sys/kernel/random/boot_id",64)!=full.stock.boot_id+"\n" ||
        ::fstat(runtime_,&held) || !S_ISDIR(held.st_mode) || held.st_uid!=0 || (held.st_mode&07777)!=0700 ||
        held.st_dev!=identity_.st_dev || held.st_ino!=identity_.st_ino || ::fstatfs(runtime_,&fs) || fs.f_type!=0x01021994 ||
        ::lstat(root.c_str(),&named) || !S_ISDIR(named.st_mode) || named.st_dev!=held.st_dev || named.st_ino!=held.st_ino ||
        cgs1_net_trial::read_link("/proc/self/fd/"+std::to_string(runtime_))!=root ||
        !::fstatat(runtime_,"effects-result",&effects,AT_SYMLINK_NOFOLLOW) || errno!=ENOENT)return false;
    const auto self=cgs1_net_trial::process_identity(::getpid());
    check_="scope_native_stock_writer";
    if(!self.running() || self.executable!=root+"/native/program" || cgs1_net_trial::unique_process("/data/bin/SnowApp").pid)return false;
    for(unsigned n:{1U,2U,3U}) {
      const auto&expected=full.stock.processes[n];const auto actual=cgs1_net_trial::process_identity(expected.pid);
      check_=n==3?"scope_bridge_birth":"scope_frozen_writer_birth";
      if(!cgs1_net_trial::same_process(expected) || (n==3?!actual.running():(actual.state!='T' && actual.state!='t')))return false;
    }
    std::array<ProcessStamp,2>peers;
    check_="scope_ready_peers";
    if(!bootstrap_.client().current_ready_peers(peers))return false;
    check_="scope_peer_executable";
    for(const auto&p:peers)if(cgs1_net_trial::process_identity(p.pid).executable!=root+"/guardian/program")return false;
    const auto daemon=cgs1_wifi::inspect_daemon(0);
    check_="scope_daemon_private_root";
    return daemon.verified && daemon.process.pid==long(plan.daemon_pid) && daemon.process.start==plan.daemon_start &&
      daemon.socket_inode==plan.socket_inode && private_root_.current();
  }
  bool guardians(const cgs1_wifi_guard::Plan&plan,std::array<cgs1_net_trial::ProcessIdentity,2>&out)const {
    std::array<ProcessStamp,2>peers;if(!current(plan))return false;
    check_="scope_guardian_ready_peers";
    if(!bootstrap_.client().current_ready_peers(peers))return false;
    for(unsigned n=0;n<2;++n) {
      out[n]=cgs1_net_trial::process_identity(peers[n].pid);
      check_="scope_guardian_birth";
      if(!out[n].running() || out[n].start!=peers[n].start)return false;
    }
    return true;
  }
  bool keepalive(const cgs1_wifi_guard::Plan&plan) {
    // Bounded file-ACK waits cannot starve the existing 1-second native pulse.
    // current() first requires already-READY peers; this cannot manufacture
    // hardware readiness or revive an expired/waiting/faulted bootstrap.
    return current(plan) && bootstrap_.client().pulse(true) && current(plan);
  }
  // Postcommit housekeeping only. FileRetirement repeats the full, expensive
  // admission once per synchronous step. Within that SAME step every unlink
  // still fences exact boot/runtime/native/frozen writers/peers/WPA socket.
  // This method cannot authorize a SELECT, key setter, hardware action or
  // commit; their current()/privacy/no-connect checks above stay unchanged.
  bool retirement_current(const cgs1_wifi_guard::Plan&plan,
      const std::array<cgs1_net_trial::ProcessIdentity,2>&expected) {
    check_="retirement_fixed_scope";
    if(!ready_ || !bootstrap_.connected() || !private_root_.current() || !cgs1_wifi_guard::valid(plan))return false;
    const auto&full=bootstrap_.plan();const auto root="/tmp/qingping-full-"+full.nonce;
    struct stat held{},named{},effects{};struct statfs fs{};
    if(plan.full_session!=full.nonce || plan.boot_id!=full.stock.boot_id || plan.created_ms<full.created_ms ||
        cgs1_net_trial::read_small("/proc/sys/kernel/random/boot_id",64)!=full.stock.boot_id+"\n" ||
        ::fstat(runtime_,&held) || !S_ISDIR(held.st_mode) || held.st_uid!=0 || (held.st_mode&07777)!=0700 ||
        held.st_dev!=identity_.st_dev || held.st_ino!=identity_.st_ino || ::fstatfs(runtime_,&fs) || fs.f_type!=0x01021994 ||
        ::lstat(root.c_str(),&named) || !S_ISDIR(named.st_mode) || named.st_dev!=held.st_dev || named.st_ino!=held.st_ino ||
        cgs1_net_trial::read_link("/proc/self/fd/"+std::to_string(runtime_))!=root ||
        !::fstatat(runtime_,"effects-result",&effects,AT_SYMLINK_NOFOLLOW) || errno!=ENOENT)return false;
    const auto self=cgs1_net_trial::process_identity(::getpid());
    if(!self.running() || self.executable!=root+"/native/program")return false;
    for(unsigned n:{1U,2U,3U}) {
      const auto&old=full.stock.processes[n];const auto actual=cgs1_net_trial::process_identity(old.pid);
      if(actual.pid!=old.pid || actual.start!=old.start || actual.executable!=old.executable ||
          (n==3?!actual.running():(actual.state!='T' && actual.state!='t')))return false;
    }
    std::array<ProcessStamp,2>peers;
    if(!bootstrap_.client().current_ready_peers(peers))return false;
    for(unsigned n=0;n<2;++n) {
      const auto actual=cgs1_net_trial::process_identity(peers[n].pid);
      if(!actual.running() || actual.pid!=expected[n].pid || actual.start!=expected[n].start ||
          actual.executable!=expected[n].executable || actual.executable!=root+"/guardian/program")return false;
    }
    // The whole-system uniqueness scan is done by current() at step entry.
    // Recheck its EXACT selected daemon/socket here, rather than rescanning
    // every /proc PID three times for each read-only metadata check.
    check_="retirement_daemon_binding";
    if(!retirement_daemon_(plan) || !private_root_.current())return false;
    // Never refresh an already-stale local readiness view after slow IO.
    // The usual rate limit, channel generations and independent leases apply.
    check_="retirement_live_peers";
    return bootstrap_.client().current_ready_peers(peers) && bootstrap_.client().pulse(true) &&
      bootstrap_.client().current_ready_peers(peers);
  }
  bool retirement_admit(const cgs1_wifi_guard::Plan&plan,
      const std::array<cgs1_net_trial::ProcessIdentity,2>&expected) {
    // First/last fences keep the same already-READY peers pulsed around one
    // full scope read. This also retains global SnowApp/WPA uniqueness checks
    // for EVERY step, not a cached grant reused by a later event-loop turn.
    return retirement_current(plan,expected) && current(plan) && retirement_current(plan,expected);
  }
  bool credentials_private(const cgs1_wifi_guard::Plan&plan)const {
    if(!current(plan))return false;
    const auto proof=cgs1_wifi_vendor::inspect_privacy();
    return proof.verified && proof.cleanup_verified && proof.daemon.process.pid==long(plan.daemon_pid) &&
      proof.daemon.process.start==plan.daemon_start && proof.daemon.socket_inode==plan.socket_inode && current(plan);
  }
  bool verified_no_connect(const cgs1_wifi_guard::Plan&plan)const {
    if(!current(plan))return false;
    const auto proof=cgs1_wifi_vendor::inspect_no_connect();
    return proof.verified && proof.daemon.process.pid==long(plan.daemon_pid) &&
      proof.daemon.process.start==plan.daemon_start && proof.daemon.socket_inode==plan.socket_inode && current(plan);
  }
 private:
  NativeFullBootstrap&bootstrap_;RunnerWifiPrivateRoot private_root_;
  int runtime_{-1};bool ready_{false};struct stat identity_{};
  // Observation only: retain the last checked fixed gate without exporting
  // process data or performing another read that could perturb the failure.
  mutable const char*check_{"scope_not_used"};
  static bool retirement_daemon_(const cgs1_wifi_guard::Plan&plan) {
    const auto pid=long(plan.daemon_pid);const auto before=cgs1_net_trial::process_identity(pid);
    if(!before.running() || before.start!=plan.daemon_start ||
        (before.executable!="/sbin/wpa_supplicant" && before.executable!="/usr/sbin/wpa_supplicant" &&
         before.executable!="/usr/bin/wpa_supplicant"))return false;
    const auto base="/proc/"+std::to_string(pid);struct stat owner{};
    if(::lstat(base.c_str(),&owner) || !S_ISDIR(owner.st_mode) || owner.st_uid!=0)return false;
    if(cgs1_wifi::control_socket_inode(cgs1_net_trial::read_small("/proc/net/unix",65536),
        cgs1_wifi::CONTROL_PATHS[0])!=plan.socket_inode)return false;
    DIR*fds=::opendir((base+"/fd").c_str());if(!fds)return false;
    const auto target="socket:["+std::to_string(plan.socket_inode)+"]";unsigned count=0;bool found=false;
    while(const auto*entry=::readdir(fds)) {
      const std::string name=entry->d_name;
      if(name.empty() || name.find_first_not_of("0123456789")!=std::string::npos)continue;
      if(++count>1024){found=false;break;}
      if(cgs1_net_trial::read_link(base+"/fd/"+name)==target)found=true;
    }
    ::closedir(fds);
    const auto after=cgs1_net_trial::process_identity(pid);
    return found && after.running() && after.start==before.start && after.executable==before.executable &&
      cgs1_wifi::control_socket_inode(cgs1_net_trial::read_small("/proc/net/unix",65536),
        cgs1_wifi::CONTROL_PATHS[0])==plan.socket_inode;
  }
};
} // namespace cgs1_supervisor
