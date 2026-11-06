#pragma once
#if defined(__linux__)

// Read-only building blocks for the initial trial, NOT an execution adapter.
// The caller must obtain the root identity and program pin from the exact
// successful stage/commit receipts and fresh fixed-path scope collector.
// A held directory alone does not prove that the named installation root,
// stock session, disable flags or consumed intent are still current.
#include "supervisor_image.h"
#include <sys/vfs.h>
#include <sys/xattr.h>
#include <dirent.h>

namespace cgs1_initial_trial {
using cgs1_supervisor::Digest;

struct DirectoryIdentity {uint64_t device{0},inode{0};};
inline bool private_directory(int fd,const DirectoryIdentity &expected) {
  struct stat value{};
  return expected.device && expected.inode && !::fstat(fd,&value) && S_ISDIR(value.st_mode) &&
    value.st_uid==0 && (value.st_mode&07777)==0700 && value.st_nlink>=2 &&
    uint64_t(value.st_dev)==expected.device && uint64_t(value.st_ino)==expected.inode;
}
inline bool same_file(const struct stat &a,const struct stat &b) {
  return a.st_dev==b.st_dev && a.st_ino==b.st_ino && a.st_mode==b.st_mode &&
    a.st_uid==b.st_uid && a.st_gid==b.st_gid && a.st_size==b.st_size &&
    a.st_nlink==b.st_nlink && cgs1_supervisor::image_same_timestamp(a,b);
}
inline bool no_reported_file_capability(int fd) {
  // ENODATA by itself can also conceal an inaccessible attribute. Corroborate
  // it with a complete successful bounded name listing under the admitted
  // root caller. ENOTSUP/EPERM/ERANGE and a present, even empty, capability
  // are refusals. An LSM hiding attributes remains a qualification boundary;
  // this helper does not prove post-exec credentials/PDEATHSIG on that kernel.
  if(::geteuid()!=0)return false;
  const auto size=::flistxattr(fd,nullptr,0);
  if(size<0 || size>4096)return false;
  std::array<char,4096> names{};
  const auto got=::flistxattr(fd,names.data(),names.size());
  if(got!=size)return false;
  size_t offset=0;
  while(offset<size_t(got)) {
    const auto remaining=size_t(got)-offset;
    const auto length=::strnlen(names.data()+offset,remaining);
    if(!length || length==remaining || !std::strcmp(names.data()+offset,"security.capability"))return false;
    offset+=length+1;
  }
  errno=0;
  const auto capability=::fgetxattr(fd,"security.capability",nullptr,0);
  return capability<0 && errno==ENODATA;
}

// Production is ext4. Only isolated host fixtures instantiate a tmpfs type;
// there is no runtime filesystem/architecture/path override or install CLI.
template<long FilesystemMagic=0xef53> class BasicInitialBridgeImage {
 public:
  BasicInitialBridgeImage()=default;
  BasicInitialBridgeImage(const BasicInitialBridgeImage &)=delete;
  BasicInitialBridgeImage &operator=(const BasicInitialBridgeImage &)=delete;
  ~BasicInitialBridgeImage(){close_();}
  const char *error() const{return error_;}
  bool open(int trusted_root,const DirectoryIdentity &identity,uint64_t bytes,const std::string &sha) {
    if(attempted_)return fail_("image_already_attempted");
    attempted_=true;identity_=identity;bytes_=bytes;
    if(::geteuid()!=0 || bytes<52 || bytes>16*1024*1024 ||
       !cgs1_supervisor::parse_digest(sha,digest_) || !private_directory(trusted_root,identity))
      return fail_("exact_private_root_and_artifact_pin_required");
    root_=::fcntl(trusted_root,F_DUPFD_CLOEXEC,3);
    if(!root_current_())return fail_("private_ext4_root_required");
    // O_NOATIME avoids turning a new hash read into an unnecessary NAND
    // timestamp update. No chmod, xattr removal, fsync or repair is allowed.
    image_=::openat(root_,"program",O_RDONLY|O_NONBLOCK|O_NOFOLLOW|O_NOATIME|O_CLOEXEC);
    struct stat before{};
    if(image_<0 || ::fstat(image_,&before) || !program_(before) || !arm_elf_() ||
       !no_reported_file_capability(image_))return fail_("plain_pinned_arm_program_required");
    snapshot_=before;verified_=true;
    if(!current())return false;
    return true;
  }
  bool current() {
    if(!verified_ || !root_current_())return fail_("image_scope_changed");
    struct stat held{},named{},after{};Digest digest{};
    if(::fstat(image_,&held) || !program_(held) || !same_file(snapshot_,held) ||
       !no_reported_file_capability(image_) || !cgs1_supervisor::image_hash(image_,held.st_size,digest) ||
       digest!=digest_ || ::fstat(image_,&after) || !same_file(held,after) ||
       ::fstatat(root_,"program",&named,AT_SYMLINK_NOFOLLOW) || !same_file(after,named) ||
       !no_reported_file_capability(image_) || !root_current_())return fail_("image_changed_or_unreadable");
    return true;
  }
  int duplicate_verified_read_fd() {
    // This is a read descriptor, not exec authority. A future child entry
    // must recheck the entire named scope and this pin immediately before
    // fd-based exec, with fixed RAM cwd/env and no credential transitions.
    if(!current())return -1;
    const int copy=::fcntl(image_,F_DUPFD_CLOEXEC,3);
    if(copy<0)return -1;
    if(!current()){::close(copy);return -1;}
    return copy;
  }
 private:
  int root_{-1},image_{-1};bool attempted_{false},verified_{false};
  DirectoryIdentity identity_{};uint64_t bytes_{0};Digest digest_{};struct stat snapshot_{};
  const char *error_{""};
  void close_(){for(int fd:{image_,root_})if(fd>=0)::close(fd);image_=root_=-1;}
  bool fail_(const char *error){error_=error;verified_=false;return false;}
  bool root_current_() const {
    struct statfs fs{};
    return root_>=0 && private_directory(root_,identity_) && !::fstatfs(root_,&fs) && fs.f_type==FilesystemMagic;
  }
  bool program_(const struct stat &value) const {
    // Initial staging promises 0700. The wider OTA mode accepted by normal
    // runtime images is intentionally not used for a first disabled trial.
    return S_ISREG(value.st_mode) && value.st_uid==0 && (value.st_mode&07777)==0700 &&
      value.st_nlink==1 && uint64_t(value.st_size)==bytes_ && uint64_t(value.st_dev)==identity_.device;
  }
  bool arm_elf_() const {
    std::array<unsigned char,52> h{};
    if(::pread(image_,h.data(),h.size(),0)!=ssize_t(h.size()))return false;
    return h[0]==0x7f && h[1]=='E' && h[2]=='L' && h[3]=='F' && h[4]==1 && h[5]==1 && h[6]==1 &&
      (h[16]==2 || h[16]==3) && h[17]==0 && h[18]==40 && h[19]==0 &&
      h[20]==1 && h[21]==0 && h[22]==0 && h[23]==0 && h[40]==52 && h[41]==0 &&
      (h[37]&6)==4;
  }
};
using InitialBridgeImage=BasicInitialBridgeImage<>;

class InitialRamDirectory {
 public:
  InitialRamDirectory()=default;
  InitialRamDirectory(const InitialRamDirectory &)=delete;
  InitialRamDirectory &operator=(const InitialRamDirectory &)=delete;
  ~InitialRamDirectory(){if(root_>=0)::close(root_);}
  bool open(int trusted_job,const DirectoryIdentity &identity) {
    if(attempted_)return false;
    attempted_=true;identity_=identity;
    if(::geteuid()!=0 || !private_directory(trusted_job,identity_))return false;
    root_=::fcntl(trusted_job,F_DUPFD_CLOEXEC,3);
    verified_=true;return current();
  }
  bool current() {
    struct statfs fs{};
    if(!verified_ || !private_directory(root_,identity_) || ::fstatfs(root_,&fs) ||
       fs.f_type!=0x01021994 || fs.f_bsize<=0 ||
       uint64_t(fs.f_bavail)<(8*1024*1024+uint64_t(fs.f_bsize)-1)/uint64_t(fs.f_bsize))return refuse_();
    const int scan=::openat(root_,".",O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_NOATIME|O_CLOEXEC);
    if(scan<0)return refuse_();
    DIR *directory=::fdopendir(scan);if(!directory){::close(scan);return refuse_();}
    bool empty=true;errno=0;
    while(const auto *entry=::readdir(directory)) {
      if(std::strcmp(entry->d_name,".") && std::strcmp(entry->d_name,"..")){empty=false;break;}
    }
    const bool readable=errno==0;::closedir(directory);
    if(!empty || !readable || !private_directory(root_,identity_))return refuse_();
    return true;
  }
  int duplicate_verified_read_fd() {
    if(!current())return -1;
    const auto copy=::fcntl(root_,F_DUPFD_CLOEXEC,3);
    if(copy>=0 && !current()){::close(copy);return -1;}
    return copy;
  }
 private:
  int root_{-1};bool attempted_{false},verified_{false};DirectoryIdentity identity_{};
  bool refuse_(){verified_=false;return false;}
};
// RAM admission is initial-only: an empty private tmpfs and an 8 MiB filesystem
// budget, not proof of MemAvailable, RSS, a canonical job path or a live run.
// A future entry must fchdir the admitted fd, set ESPHOME_PREFDIR=./prefs and
// clear inherited loader/credential environment before the approved ELF exec.
}  // namespace cgs1_initial_trial
#endif
