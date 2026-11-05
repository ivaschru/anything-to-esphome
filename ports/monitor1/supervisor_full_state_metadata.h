#pragma once

// Finished-session metadata only. Observe two compiled own filenames without
// opening/reading their contents: a host .prefs payload can contain private
// transport material. No path argument, directory scan, symlink following,
// content hash, SDK key enumeration or write is available through this probe.
#include "supervisor_full_diagnostics.h"
#include "device_profile.h"

namespace cgs1_supervisor {
struct FullStateFileMetadata {
  const char *name;
  bool directory_present{false},directory_private{false},file_present{false},file_private_regular{false};
  int directory_errno{0},file_errno{0};uint64_t filesystem_type{0};
  uint64_t file_bytes{0},file_inode{0},file_device{0},file_links{0};
  unsigned file_mode{0},file_uid{0};bool file_symlink{false};
};
struct FullStateMetadata {
  std::array<FullStateFileMetadata,2> files{{{"ram_preferences"},{"durable_preferences"}}};
  bool read(const std::string &nonce) {
    if(nonce.size()!=16 || nonce=="0000000000000000" ||
       nonce.find_first_not_of("0123456789abcdef")!=std::string::npos)return false;
    int ram=open_parent_(("/tmp/qingping-full-"+nonce).c_str(),files[0],0x01021994);
    if(ram>=0) {
      ram=child_(ram,"prefs",files[0]);
      if(ram>=0)observe_(ram,cgs1_device_profile::SDK_PREFS_FILE,files[0]);
    }
    int durable=open_parent_("/data/.esphome-cgs1",files[1],0);
    if(durable>=0) {
      durable=child_(durable,"full-state",files[1]);
      if(durable>=0)durable=child_(durable,"prefs",files[1]);
      if(durable>=0)observe_(durable,"preferences.v1",files[1]);
    }
    return true;
  }
 private:
  static bool private_(int fd) {
    struct stat info{};
    return !::fstat(fd,&info) && S_ISDIR(info.st_mode) && info.st_uid==0 && (info.st_mode&07777)==0700;
  }
  static int open_parent_(const char *path,FullStateFileMetadata &item,uint64_t required_filesystem) {
    const int fd=::open(path,O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
    if(fd<0){item.directory_errno=errno;return -1;}
    struct statfs fs{};item.directory_present=true;
    const bool statted=!::fstatfs(fd,&fs);
    if(statted)item.filesystem_type=uint64_t(fs.f_type);
    if(!private_(fd) || !statted || (required_filesystem && item.filesystem_type!=required_filesystem)) {
      item.directory_errno=EPERM;::close(fd);return -1;
    }
    return fd;
  }
  static int child_(int parent,const char *name,FullStateFileMetadata &item) {
    const int child=::openat(parent,name,O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
    const int error=errno;struct stat before{},after{};
    const bool okay=child>=0 && private_(child) && !::fstat(parent,&before) &&
      !::fstat(child,&after) && before.st_dev==after.st_dev;
    ::close(parent);
    if(!okay) {
      item.directory_errno=child<0?error:EPERM;
      if(child>=0)::close(child);
      return -1;
    }
    return child;
  }
  static void observe_(int directory,const char *name,FullStateFileMetadata &item) {
    item.directory_private=true;
    struct stat info{},parent{};
    // fstatat(AT_SYMLINK_NOFOLLOW) does not open a FIFO/device/file, nor read
    // a symlink target. Report its type as metadata without traversing it.
    if(::fstatat(directory,name,&info,AT_SYMLINK_NOFOLLOW))item.file_errno=errno;
    else {
      item.file_present=true;item.file_symlink=S_ISLNK(info.st_mode);
      item.file_bytes=info.st_size>=0?uint64_t(info.st_size):0;
      item.file_inode=uint64_t(info.st_ino);item.file_device=uint64_t(info.st_dev);
      item.file_links=uint64_t(info.st_nlink);item.file_mode=unsigned(info.st_mode&07777);item.file_uid=info.st_uid;
      item.file_private_regular=!::fstat(directory,&parent) && S_ISREG(info.st_mode) && info.st_uid==0 &&
        (info.st_mode&07777)==0600 && info.st_nlink==1 && info.st_dev==parent.st_dev;
    }
    ::close(directory);
  }
};
}  // namespace cgs1_supervisor
