#pragma once

// Canonical private Wi-Fi parent, captured independently by EACH guardian
// before native starts. No caller pathname/FD chooses another empty store and
// thereby turns an already committed real decision into "uncommitted".
// Keep every prefix FD and recheck names/inodes/modes before later use. This
// reader creates no directory/file and never reads credential/config bytes.
#include <fcntl.h>
#include <initializer_list>
#include <sys/stat.h>
#include <unistd.h>

namespace cgs1_supervisor {
class RunnerWifiPrivateRoot {
 public:
  RunnerWifiPrivateRoot()=default;
  RunnerWifiPrivateRoot(const RunnerWifiPrivateRoot&)=delete;
  RunnerWifiPrivateRoot&operator=(const RunnerWifiPrivateRoot&)=delete;
  ~RunnerWifiPrivateRoot(){for(int fd:{parent_,data_,root_})if(fd>=0)::close(fd);}
  bool open() {
    if(attempted_)return false;
    attempted_=true;owner_=::getpid();
    root_=::open("/",O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
    if(!ordinary_(root_,root_identity_))return false;
    data_=::openat(root_,"data",O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
    if(!ordinary_(data_,data_identity_))return false;
    parent_=::openat(data_,".esphome-cgs1",O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
    if(!private_(parent_,parent_identity_) || parent_identity_.st_dev!=data_identity_.st_dev)return false;
    opened_=true;return current();
  }
  bool current()const {
    if(!opened_ || owner_!=::getpid())return false;
    struct stat root{},data{},parent{},data_name{},parent_name{};
    return ordinary_(root_,root) && same_(root,root_identity_) && ordinary_(data_,data) &&
      same_(data,data_identity_) && private_(parent_,parent) && same_(parent,parent_identity_) &&
      !::fstatat(root_,"data",&data_name,AT_SYMLINK_NOFOLLOW) && S_ISDIR(data_name.st_mode) && same_(data_name,data) &&
      !::fstatat(data_,".esphome-cgs1",&parent_name,AT_SYMLINK_NOFOLLOW) && S_ISDIR(parent_name.st_mode) && same_(parent_name,parent);
  }
  int duplicate()const{return current()?::fcntl(parent_,F_DUPFD_CLOEXEC,3):-1;}
 private:
  int root_{-1},data_{-1},parent_{-1};pid_t owner_{0};bool attempted_{false},opened_{false};
  struct stat root_identity_{},data_identity_{},parent_identity_{};
  static bool same_(const struct stat&a,const struct stat&b){return a.st_dev==b.st_dev && a.st_ino==b.st_ino;}
  static bool ordinary_(int fd,struct stat&info) {
    return fd>=0 && !::fstat(fd,&info) && S_ISDIR(info.st_mode) && info.st_uid==0 && !(info.st_mode&0022);
  }
  static bool private_(int fd,struct stat&info){return ordinary_(fd,info) && (info.st_mode&07777)==0700;}
};
} // namespace cgs1_supervisor
