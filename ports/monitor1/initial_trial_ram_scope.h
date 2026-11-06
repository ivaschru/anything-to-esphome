#pragma once
#if defined(__linux__)

// Named RAM/boot-lock scope for the initial trial. This does not create a
// scratch directory, delete stale state or reserve a name against another
// root process. The host must separately select/review the existing job.
#include "initial_trial_admission.h"
#include <type_traits>

namespace cgs1_initial_trial {
template<long AnchorFilesystem=0> class BasicInitialRamScope {
 public:
  BasicInitialRamScope()=default;
  BasicInitialRamScope(const BasicInitialRamScope &)=delete;
  BasicInitialRamScope &operator=(const BasicInitialRamScope &)=delete;
  ~BasicInitialRamScope(){for(int fd:{anchor_,tmp_,job_})if(fd>=0)::close(fd);}
  const char *error() const{return error_;}
  bool open(const std::string &job_id,const DirectoryIdentity &expected) {
    const int root=::open("/",DIRECTORY_FLAGS);
    const bool okay=open_(root,job_id,expected);
    if(root>=0 && ::close(root))return refuse_("ram_anchor_close_uncertain");
    return okay;
  }
  template<long Magic=AnchorFilesystem,std::enable_if_t<Magic!=0 && Magic==AnchorFilesystem,int> =0>
  bool open_fixture_root(int root,const std::string &job_id,const DirectoryIdentity &expected) {
    // Only a compile-time synthetic-root type exposes this entry. The
    // production class always walks /tmp and has no runtime path override.
    return open_(root,job_id,expected);
  }
  bool current() {
    if(!verified_ || !named_() || !tmp_listing_() || !ram_.current() || !tmp_listing_() || !named_())
      return refuse_("initial_named_ram_or_boot_lock_changed");
    return true;
  }
  int duplicate_verified_read_fd() {
    if(!current())return -1;
    const int fd=ram_.duplicate_verified_read_fd();
    if(fd>=0 && !current()){::close(fd);return -1;}
    return fd;
  }
 private:
  inline static constexpr int DIRECTORY_FLAGS=O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_NOATIME|O_CLOEXEC;
  int anchor_{-1},tmp_{-1},job_{-1};bool attempted_{false},verified_{false};
  DirectoryIdentity tmp_identity_{},expected_{};struct stat job_snapshot_{};
  std::string leaf_;InitialRamDirectory ram_;const char *error_{"unobserved"};
  bool refuse_(const char *reason){verified_=false;error_=reason;return false;}
  static bool tmp_directory_(int fd,DirectoryIdentity *identity=nullptr) {
    struct stat value{};struct statfs fs{};
    if(fd<0 || ::fstat(fd,&value) || !S_ISDIR(value.st_mode) || value.st_uid!=0 ||
       (value.st_mode&07777)!=01777 || ::fstatfs(fd,&fs) || fs.f_type!=0x01021994)return false;
    if(identity)*identity={uint64_t(value.st_dev),uint64_t(value.st_ino)};
    return true;
  }
  bool named_() const {
    const int tmp=::openat(anchor_,"tmp",DIRECTORY_FLAGS);DirectoryIdentity observed{};
    bool okay=tmp_directory_(tmp,&observed) && observed.device==tmp_identity_.device && observed.inode==tmp_identity_.inode &&
      tmp_directory_(tmp_);
    const int job=okay?::openat(tmp,leaf_.c_str(),DIRECTORY_FLAGS):-1;
    struct stat held{},named{};
    okay=okay && job>=0 && private_directory(job,expected_) && private_directory(job_,expected_) &&
      !::fstat(job_,&held) && !::fstat(job,&named) && same_file(job_snapshot_,held) && same_file(held,named);
    for(int fd:{job,tmp})if(fd>=0 && ::close(fd))okay=false;
    return okay;
  }
  bool tmp_listing_() const {
    const int scan=::openat(tmp_,".",DIRECTORY_FLAGS);DIR *directory=scan>=0?::fdopendir(scan):nullptr;
    if(!directory){if(scan>=0)::close(scan);return false;}
    bool okay=true;unsigned count=0;
    while(okay) {
      errno=0;const auto *entry=::readdir(directory);
      if(!entry){okay=errno==0;break;}
      if(!std::strcmp(entry->d_name,".") || !std::strcmp(entry->d_name,".."))continue;
      // A complete successful directory listing establishes absence. Do not
      // follow the lock, classify its type, remove it or use !exists on an
      // unreadable path as a substitute. Other /tmp entries are preserved.
      if(++count>4096 || !std::strcmp(entry->d_name,"qingping-cgs1-esphome.lock"))okay=false;
    }
    if(::closedir(directory))okay=false;
    return okay;
  }
  bool open_(int root,const std::string &job_id,const DirectoryIdentity &expected) {
    if(attempted_)return refuse_("ram_scope_open_consumed_no_retry");
    attempted_=true;struct stat anchor{};struct statfs fs{};
    if(::getuid()!=0 || ::geteuid()!=0 || job_id.size()!=32 ||
       job_id.find_first_not_of("0123456789abcdef")!=std::string::npos ||
       !expected.device || !expected.inode || root<0 || ::fstat(root,&anchor) ||
       !S_ISDIR(anchor.st_mode) || anchor.st_uid!=0 || (anchor.st_mode&0022) ||
       (AnchorFilesystem && (::fstatfs(root,&fs) || fs.f_type!=AnchorFilesystem)))
      return refuse_("exact_preexisting_ram_identity_required");
    expected_=expected;leaf_="qingping-initial-trial-"+job_id;anchor_=::fcntl(root,F_DUPFD_CLOEXEC,3);
    tmp_=::openat(anchor_,"tmp",DIRECTORY_FLAGS);
    if(!tmp_directory_(tmp_,&tmp_identity_) || expected.device!=tmp_identity_.device)
      return refuse_("fixed_root_owned_sticky_tmpfs_required");
    job_=::openat(tmp_,leaf_.c_str(),DIRECTORY_FLAGS);
    if(job_<0 || !private_directory(job_,expected) || ::fstat(job_,&job_snapshot_) || !ram_.open(job_,expected))
      return refuse_("exact_empty_private_ram_job_required");
    verified_=true;error_="";return current();
  }
};
using InitialRamScope=BasicInitialRamScope<>;
// Empty-job and 8 MiB tmpfs capacity admission come from InitialRamDirectory;
// neither is a MemFree observation, host USB proof, intent or launch grant.
}  // namespace cgs1_initial_trial
#endif
