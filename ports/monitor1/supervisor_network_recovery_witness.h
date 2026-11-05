#pragma once

// Recovery permission is a local C++ capability, never a boolean carried by
// IPC. RunnerFence alone may issue it after proving native death. The witness
// does not own the flock: destroying its issuing fence immediately revokes it.
// A copied descriptor number, another runtime directory, a replaced lock inode
// or a forked process must not inherit that permission.
#include <sys/file.h>
#include <sys/stat.h>
#include <sys/vfs.h>
#include <fcntl.h>
#include <unistd.h>
#include <memory>

namespace cgs1_supervisor {
enum class RunnerRole {PRIMARY,BACKUP};
class RunnerFence;
class RunnerRecoveryLock {
 public:
  RunnerRecoveryLock()=default;
  RunnerRecoveryLock(const RunnerRecoveryLock&)=delete;
  RunnerRecoveryLock&operator=(const RunnerRecoveryLock&)=delete;
  ~RunnerRecoveryLock(){if(fd_>=0)::close(fd_);if(runtime_>=0)::close(runtime_);}
  bool acquire(int runtime) {
    if(attempted_)return false;
    attempted_=true;owner_=::getpid();
    runtime_=::fcntl(runtime,F_DUPFD_CLOEXEC,3);
    if(runtime_<0 || !directory_(runtime_,directory_info_))return false;
    // Open a fresh file description AFTER fork. An inherited flock FD would
    // give primary and backup one shared owner instead of mutual exclusion.
    fd_=::openat(runtime_,"recovery.lock",O_RDWR|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC);
    if(fd_<0 || !lock_(runtime_,lock_info_))return false;
    owned_=!::flock(fd_,LOCK_EX|LOCK_NB);
    return owned_ && bound_to_runtime(runtime);
  }
  bool owned()const{return bound_to_runtime(runtime_);}
  bool bound_to_runtime(int runtime)const {
    if(!owned_ || owner_!=::getpid() || runtime_<0 || fd_<0)return false;
    struct stat held{},supplied{},lock{};
    return directory_(runtime_,held) && directory_(runtime,supplied) &&
      same_(held,directory_info_) && same_(held,supplied) && lock_(runtime_,lock) && same_(lock,lock_info_);
  }
 private:
  int fd_{-1},runtime_{-1};pid_t owner_{0};bool attempted_{false},owned_{false};
  struct stat directory_info_{},lock_info_{};
  static bool same_(const struct stat&a,const struct stat&b){return a.st_dev==b.st_dev && a.st_ino==b.st_ino;}
  static bool directory_(int fd,struct stat&info) {
    struct statfs fs{};
    return fd>=0 && !::fstat(fd,&info) && S_ISDIR(info.st_mode) && info.st_uid==0 &&
      (info.st_mode&07777)==0700 && info.st_nlink>=2 && !::fstatfs(fd,&fs) && fs.f_type==0x01021994;
  }
  bool lock_(int runtime,struct stat&info)const {
    struct stat entry{};
    return !::fstat(fd_,&info) && S_ISREG(info.st_mode) && info.st_uid==0 &&
      (info.st_mode&07777)==0600 && info.st_nlink==1 && !info.st_size &&
      info.st_dev==directory_info_.st_dev && !::fstatat(runtime,"recovery.lock",&entry,AT_SYMLINK_NOFOLLOW) &&
      same_(entry,info) && S_ISREG(entry.st_mode);
  }
};

class NetworkRecoveryWitness {
 public:
  NetworkRecoveryWitness()=default;
  NetworkRecoveryWitness(const NetworkRecoveryWitness&)=delete;
  NetworkRecoveryWitness&operator=(const NetworkRecoveryWitness&)=delete;
  NetworkRecoveryWitness(NetworkRecoveryWitness&&)=default;
  NetworkRecoveryWitness&operator=(NetworkRecoveryWitness&&)=default;
  bool valid_for_runtime(int runtime)const {
    const auto owner=owner_.lock();return owner && owner->bound_to_runtime(runtime);
  }
 private:
  friend class RunnerFence;
  explicit NetworkRecoveryWitness(const std::shared_ptr<RunnerRecoveryLock>&owner):owner_(owner){}
  std::weak_ptr<RunnerRecoveryLock> owner_;
};
} // namespace cgs1_supervisor
