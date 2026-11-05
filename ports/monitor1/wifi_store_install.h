#pragma once

// Narrow installation of the OWN private Wi-Fi directory. No profile, key,
// journal, decision, network command or child file is read/written here. Store
// intentionally requires this directory to exist and never creates it while
// deciding a transaction. The API caller supplies only a freshly fenced root
// FD, never a remote pathname, mode or parent chosen by an incoming request.
#include <cerrno>
#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>

namespace cgs1_wifi_private {
class DirectoryInstallation final {
 public:
  bool ensure(int trusted_parent) {
    if(attempted_)return false;
    attempted_=true;struct stat parent{};
    if(trusted_parent<0 || ::fstat(trusted_parent,&parent) || !private_(parent))return false;
    struct stat named{};
    if(::fstatat(trusted_parent,"wifi",&named,AT_SYMLINK_NOFOLLOW)) {
      if(errno!=ENOENT)return false;
      if(::mkdirat(trusted_parent,"wifi",0700)) {
        // An already-created directory is reconciled by the same strict
        // metadata checks; no chmod, replacement, cleanup or foreign repair.
        if(errno!=EEXIST)return false;
      }else created_=true;
    }
    const int child=::openat(trusted_parent,"wifi",O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
    if(child<0)return false;
    struct stat held{},parent_after{},named_after{};
    const bool okay=!::fstat(child,&held) && private_(held) && held.st_dev==parent.st_dev &&
      !::fsync(child) && !::fsync(trusted_parent) && !::fstat(trusted_parent,&parent_after) &&
      private_(parent_after) && same_(parent,parent_after) &&
      !::fstatat(trusted_parent,"wifi",&named_after,AT_SYMLINK_NOFOLLOW) &&
      private_(named_after) && same_(held,named_after);
    const bool closed=!::close(child);return okay && closed;
  }
  bool created()const{return created_;}
 private:
  bool attempted_{false},created_{false};
  static bool private_(const struct stat&info) {
    return S_ISDIR(info.st_mode) && info.st_uid==0 && (info.st_mode&07777)==0700;
  }
  static bool same_(const struct stat&a,const struct stat&b){return a.st_dev==b.st_dev && a.st_ino==b.st_ino;}
};
} // namespace cgs1_wifi_private
