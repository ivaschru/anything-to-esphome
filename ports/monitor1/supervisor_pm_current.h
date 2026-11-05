#pragma once

// Last ACKNOWLEDGED native PM state inside one boot-local guarded session.
// OriginalEffects remains the immutable STOCK recovery snapshot. This small
// record allows OTA exec to retain a later native ON/OFF choice without
// reasserting GPIOs or mistaking the first stock state for current hardware.
#include <sys/stat.h>
#include <sys/vfs.h>
#include <fcntl.h>
#include <unistd.h>
#include <cerrno>
#include <cstring>
#include <string>

namespace cgs1_supervisor {
class CurrentPmStore {
 public:
  ~CurrentPmStore(){if(directory_>=0)::close(directory_);}
  bool open(int held_runtime) {
    if(directory_>=0)return false;
    struct stat info{};struct statfs fs{};
    if(::fstat(held_runtime,&info) || !S_ISDIR(info.st_mode) || info.st_uid!=0 ||
       (info.st_mode&07777)!=0700 || ::fstatfs(held_runtime,&fs) || fs.f_type!=0x01021994)return false;
    directory_=::fcntl(held_runtime,F_DUPFD_CLOEXEC,3);device_=info.st_dev;return directory_>=0;
  }
  bool load(bool original,bool &current) const {
    if(directory_<0)return false;
    const int fd=::openat(directory_,"pm-current",O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC);
    if(fd<0){if(errno==ENOENT){current=original;return true;}return false;}
    struct stat before{},after{},entry{};char bytes[32]{};
    const bool valid=!::fstat(fd,&before) && S_ISREG(before.st_mode) && before.st_uid==0 &&
      (before.st_mode&07777)==0600 && before.st_nlink==1 && before.st_dev==device_ &&
      before.st_size>0 && before.st_size<ssize_t(sizeof(bytes));
    const auto n=valid?::read(fd,bytes,sizeof(bytes)):-1;
    const bool stable=n==before.st_size && n>0 && !::fstat(fd,&after) &&
      after.st_size==before.st_size && after.st_mtime==before.st_mtime && after.st_ctime==before.st_ctime &&
      !::fstatat(directory_,"pm-current",&entry,AT_SYMLINK_NOFOLLOW) &&
      entry.st_dev==before.st_dev && entry.st_ino==before.st_ino && entry.st_nlink==1;
    ::close(fd);
    const std::string text=stable?std::string(bytes,size_t(n)):"";
    if(text!="CGS1_PM_CURRENT_V1 0\n" && text!="CGS1_PM_CURRENT_V1 1\n")return false;
    current=text=="CGS1_PM_CURRENT_V1 1\n";return true;
  }
  bool save(bool enabled) {
    bool previous=false;if(!load(false,previous))return false;
    const auto temporary="pm-current.tmp."+std::to_string(::getpid());
    const int fd=::openat(directory_,temporary.c_str(),O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);
    if(fd<0)return false;
    const char *text=enabled?"CGS1_PM_CURRENT_V1 1\n":"CGS1_PM_CURRENT_V1 0\n";
    const auto size=std::strlen(text);
    const bool written=::write(fd,text,size)==ssize_t(size) && !::fsync(fd);::close(fd);
    return written && !::renameat(directory_,temporary.c_str(),directory_,"pm-current") && !::fsync(directory_);
  }
 private:
  int directory_{-1};dev_t device_{};
};
}  // namespace cgs1_supervisor
