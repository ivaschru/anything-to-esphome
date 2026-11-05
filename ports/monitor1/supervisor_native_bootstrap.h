#pragma once

// Earliest native bootstrap, before ANY UART/DRM/PM/backlight setup. The
// immutable plan supplies only a nonce inside a COMPILED fixed /tmp layout;
// the guardian SHA/architecture must be compiled into this native release.
// Both actual guardians must ACK HELLO, which their runner permits only
// after armed takeover and exclusive-hardware validation have completed.
#include "supervisor_peer_bootstrap.h"
#include "supervisor_full_plan.h"

namespace cgs1_supervisor {
class NativeFullBootstrap {
 public:
  bool open(const Digest &compiled_guardian_digest,const ExecutableSpec &architecture={}) {
    if(attempted_)return false;
    attempted_=true;
    trace_(1);
    if(::getuid()!=0 || ::geteuid()!=0)return false;
    trace_(2);
    uint64_t plan_fd=0,runtime_fd=0;
    if(!environment_fd_("CGS1_FULL_PLAN_FD",plan_fd) || !environment_fd_("CGS1_RUNTIME_FD",runtime_fd) ||
       plan_fd==runtime_fd || !read_full_plan_fd(int(plan_fd),plan_) ||
       compiled_guardian_digest!=plan_.guardian_digest)return false;
    // Do not apply takeover freshness after OTA exec. The original boot-local
    // plan remains immutable; current guardian generation/leases attest exec.
    trace_(3);
    if(cgs1_net_trial::read_small("/proc/sys/kernel/random/boot_id",64)!=plan_.stock.boot_id+"\n")return false;
    root_="/tmp/qingping-full-"+plan_.nonce;
    trace_(4);
    struct stat held{},path{};struct statfs fs{};
    if(::fstat(int(runtime_fd),&held) || !S_ISDIR(held.st_mode) || held.st_uid!=0 ||
       (held.st_mode&07777)!=0700 || ::lstat(root_.c_str(),&path) || !S_ISDIR(path.st_mode) ||
       held.st_dev!=path.st_dev || held.st_ino!=path.st_ino || path.st_uid!=0 ||
       (path.st_mode&07777)!=0700 || ::fstatfs(int(runtime_fd),&fs) || fs.f_type!=0x01021994)return false;
    trace_(5);const char *preferences=std::getenv("ESPHOME_PREFDIR");
    if(!preferences || preferences!=root_+"/prefs")return false;
    trace_(6);for(const char *name:{"prefs","thermal"}) {
      struct stat store{};
      if(::fstatat(int(runtime_fd),name,&store,AT_SYMLINK_NOFOLLOW) || !S_ISDIR(store.st_mode) ||
         store.st_uid!=0 || (store.st_mode&07777)!=0700 || store.st_dev!=held.st_dev)return false;
    }
    trace_(7);const auto old_stock=process_stamp(pid_t(plan_.stock.processes[0].pid));
    if(old_stock.start==plan_.stock.processes[0].start && old_stock.state!='Z' && old_stock.state!='X')return false;
    trace_(8);for(unsigned role:{1U,2U,3U}) {
      const auto &expected=plan_.stock.processes[role];const auto actual=process_stamp(pid_t(expected.pid));
      if(actual.start!=expected.start || actual.owner!=0 || !cgs1_net_trial::same_process(expected))return false;
      if(role!=3 && actual.state!='T' && actual.state!='t')return false;
      if(role==3 && actual.state!='R' && actual.state!='S' && actual.state!='D')return false;
    }
    // Coordinator FD/plan FD/directory FD must not alias either lease channel.
    trace_(9);for(const char *name:{"CGS1_PRIMARY_FD","CGS1_BACKUP_FD"}) {
      uint64_t fd=0;
      if(!environment_fd_(name,fd) || fd==plan_fd || fd==runtime_fd)return false;
    }
    guardian_directory_=root_+"/guardian";
    trace_(10);
    GuardianRelease release{guardian_directory_.c_str(),compiled_guardian_digest,architecture};
    if(!peers_.connect_inherited(release))return false;
    runtime_=int(runtime_fd);connected_=true;trace_(11);return true;
  }
  // Numeric post-mortem only; no descriptor, environment or secret content.
  unsigned diagnostic_stage() const{return stage_;}
  bool connected() const{return connected_;}
  TwinClient &client(){return peers_.client();}
  const FullPlan &plan() const{return plan_;}
  int runtime_fd() const{return runtime_;}
  std::string thermal_directory() const{return connected_?root_+"/thermal":"";}
  std::string preferences_directory() const{return connected_?root_+"/prefs":"";}
  std::string native_program() const{return connected_?root_+"/native/program":"";}
  bool arm_pm(){return arm_("pm-power-armed","CGS1_PM_V2\n");}
  bool arm_brightness(){return arm_("brightness-armed","CGS1_BL_V1\n");}
 private:
  bool attempted_{false},connected_{false};unsigned stage_{0};int runtime_{-1};FullPlan plan_;NativePeers peers_;
  std::string root_,guardian_directory_;
  void trace_(unsigned stage) {
    stage_=stage;
    // A killed process cannot log a returned failure. Fixed stage/time
    // breadcrumbs identify the last entered check without dumping its data.
    ::dprintf(STDERR_FILENO,"CGS1_BOOT stage=%u ms=%llu\n",stage,
      static_cast<unsigned long long>(clock_ms()));
  }
  static bool environment_fd_(const char *name,uint64_t &out) {
    const char *text=std::getenv(name);
    return text && ::strnlen(text,21)<=20 && bootstrap_number(text,INT_MAX,out) && out>=3;
  }
  bool arm_(const char *name,const char *proof) {
    if(!connected_ || peers_.client().faulted() || peers_.client().waiting())return false;
    // A committed recovery receipt means this runtime is already retiring.
    // Never begin another hardware mutation after either actor returned it.
    struct stat entry{};
    if(!::fstatat(runtime_,"effects-result",&entry,AT_SYMLINK_NOFOLLOW) || errno!=ENOENT)return false;
    const size_t size=std::strlen(proof);
    const int previous=::openat(runtime_,name,O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC);
    if(previous>=0) {
      struct stat info{},dir{};char bytes[32]{};
      const bool valid=!::fstat(previous,&info) && !::fstat(runtime_,&dir) &&
        S_ISREG(info.st_mode) && info.st_uid==0 && (info.st_mode&07777)==0600 &&
        info.st_nlink==1 && info.st_dev==dir.st_dev && info.st_size==ssize_t(size) &&
        size<sizeof(bytes) && ::read(previous,bytes,sizeof(bytes))==ssize_t(size) && !std::memcmp(bytes,proof,size);
      ::close(previous);return valid;
    }
    if(errno!=ENOENT)return false;
    const int fd=::openat(runtime_,name,O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);
    if(fd<0)return false;
    const bool committed=::write(fd,proof,size)==ssize_t(size) && !::fsync(fd);
    ::close(fd);
    // On uncertain/short write caller must exit; never "repair" and retry a
    // marker after a hardware mutation could already have happened.
    return committed && !::fsync(runtime_);
  }
};
}  // namespace cgs1_supervisor
