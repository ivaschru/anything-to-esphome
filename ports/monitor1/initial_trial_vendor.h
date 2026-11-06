#pragma once
#if defined(__linux__)

// Fixed vendor-file portion of the initial device scope. This reader never
// writes or executes a vendor file, and its result cannot authorize a trial.
// In particular, hashing SnowApp is not proof of its running process identity.
#include "initial_trial_admission.h"
#include <type_traits>

namespace cgs1_initial_trial {
struct InitialVendorPin {uint64_t bytes;const char *sha256;};
template<long DataFilesystem=0xef53> class BasicInitialVendorFiles {
 public:
  inline static constexpr std::array<const char *,9> PATHS={
    "data/bin/SnowApp","data/bin/watchdog.sh","data/etc/init.d/start.sh",
    "etc/init.d/S12_launcher_init","etc/init.d/S50_px3se_init","lib/ld-2.23.so",
    "lib/libc-2.23.so","usr/lib/libstdc++.so.6.0.20","usr/lib/libQt5Core.so.5.9.4"};
  // Only the already reviewed COMMITTED-DISABLED script bytes are admitted.
  // Factory originals belong to capture/staging, not this first-trial phase.
  inline static constexpr std::array<InitialVendorPin,9> PINS={{
    {4925568,"a39016531620a874668ee322f0e976f48e47943742c54c8a7291b9e830c91abb"},
    {1719,"1d74ef0946734e1ddf9e76301012f9ed66d7b38d9d7a0239a5d0e80acabf2cce"},
    {1937,"f104f873dd3ce4544d5f3e3f90a4056bffc811bcaae037e347306e1084e7f1d1"},
    {497,"533cac6f65b3ccf8d3404216c688877ad03a8b03af64edaade9bd6dc3aad1c35"},
    {480,"d818606f68bc1428ef96c5257df751a843cc9a6770dc25a2487a940c6bcb2492"},
    {155376,"6da48efda9ff440998747a66131e8ebdc6a57a15bb19dcfd7895a031368dd50a"},
    {1209932,"6479e377cd35c6e90e9aba990ac5137b195ca765544ad0c561f7f5945ea7133e"},
    {658792,"93cc1352b59a0d3a39a8f9d311332f84115e3c5ee71afd846302b942071675c4"},
    {5427824,"b43e1cc628e625a422cfcf98aad38c9542b98cea28196ac4fd14931fd5ccf88d"}
  }};
  BasicInitialVendorFiles()=default;
  BasicInitialVendorFiles(const BasicInitialVendorFiles &)=delete;
  BasicInitialVendorFiles &operator=(const BasicInitialVendorFiles &)=delete;
  ~BasicInitialVendorFiles(){if(anchor_>=0)::close(anchor_);}
  const char *error() const{return error_;}
  bool open() {
    const int root=::open("/",DIRECTORY_FLAGS);
    const bool okay=open_(root,PINS);if(root>=0)::close(root);return okay;
  }
  template<long Magic=DataFilesystem,std::enable_if_t<Magic!=0xef53 && Magic==DataFilesystem,int> =0>
  bool open_fixture_root(int root,const std::array<InitialVendorPin,9> &pins) {
    // A compile-time non-production type only: no production path/hash
    // override, command line, environment variable or factory fallback.
    return open_(root,pins);
  }
  bool current() {
    if(!verified_)return false;
    if(!anchor_current_())return refuse_("vendor_anchor_changed");
    for(size_t i=0;i<PATHS.size();++i)
      if(!file_(i,false))return refuse_("vendor_file_changed_or_unreadable");
    return anchor_current_() || refuse_("vendor_anchor_changed_after_readback");
  }
  int duplicate_verified_stock_read_fd() {
    // The stock-session reader compares /proc/PID/exe with this exact named
    // SnowApp inode. This read descriptor grants no exec/signal authority.
    if(!current())return -1;
    const int parent=parent_(PATHS[0]);
    if(parent<0){refuse_("stock_parent_unreadable");return -1;}
    const int fd=::openat(parent,"SnowApp",O_RDONLY|O_NONBLOCK|O_NOFOLLOW|O_NOATIME|O_CLOEXEC);
    struct stat value{};
    bool okay=fd>=0 && !::fstat(fd,&value) && same_file(snapshots_[0],value);
    if(::close(parent))okay=false;
    okay=okay && current();
    if(!okay){if(fd>=0)::close(fd);refuse_("stock_read_descriptor_unverified");return -1;}
    return fd;
  }
 private:
  inline static constexpr int DIRECTORY_FLAGS=O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_NOATIME|O_CLOEXEC;
  int anchor_{-1};bool attempted_{false},verified_{false};
  DirectoryIdentity anchor_identity_{},data_identity_{};
  std::array<uint64_t,9> sizes_{};
  // Own the strings even in fixtures; caller lifetimes cannot change pins.
  std::array<std::string,9> digests_{};
  std::array<struct stat,9> snapshots_{};
  const char *error_{"unobserved"};
  bool refuse_(const char *error){verified_=false;error_=error;return false;}
  static bool directory_(int fd,DirectoryIdentity *identity=nullptr) {
    struct stat value{};
    if(fd<0 || ::fstat(fd,&value) || !S_ISDIR(value.st_mode) || value.st_uid!=0 ||
       (value.st_mode&0022))return false;
    if(identity)*identity={uint64_t(value.st_dev),uint64_t(value.st_ino)};
    return true;
  }
  bool anchor_current_() const {
    DirectoryIdentity now{};
    return directory_(anchor_,&now) && now.device==anchor_identity_.device && now.inode==anchor_identity_.inode;
  }
  int parent_(const char *path) const {
    int fd=::fcntl(anchor_,F_DUPFD_CLOEXEC,3);std::string remaining(path);
    size_t slash;
    while(fd>=0 && (slash=remaining.find('/'))!=std::string::npos) {
      const auto component=remaining.substr(0,slash);remaining.erase(0,slash+1);
      const int next=::openat(fd,component.c_str(),DIRECTORY_FLAGS);
      bool okay=directory_(next);
      if(component=="data") {
        DirectoryIdentity identity{};struct statfs fs{};
        okay=okay && directory_(next,&identity) && identity.device==data_identity_.device &&
          identity.inode==data_identity_.inode && !::fstatfs(next,&fs) && fs.f_type==DataFilesystem;
      }
      if(::close(fd))okay=false;
      if(!okay){if(next>=0)::close(next);return -1;}
      fd=next;
    }
    return fd;
  }
  bool file_(size_t i,bool capture) {
    const int parent=parent_(PATHS[i]);if(parent<0)return false;
    const char *leaf=std::strrchr(PATHS[i],'/')+1;
    const int fd=::openat(parent,leaf,O_RDONLY|O_NONBLOCK|O_NOFOLLOW|O_NOATIME|O_CLOEXEC);
    struct stat before{},after{},named{};Digest actual{},expected{};
    bool okay=fd>=0 && !::fstat(fd,&before) && S_ISREG(before.st_mode) && before.st_uid==0 &&
      before.st_nlink==1 && before.st_size==off_t(sizes_[i]) && !(before.st_mode&0022) &&
      (capture || same_file(snapshots_[i],before)) &&
      (i>=3 || uint64_t(before.st_dev)==data_identity_.device) &&
      cgs1_supervisor::parse_digest(digests_[i],expected) &&
      cgs1_supervisor::image_hash(fd,before.st_size,actual) && actual==expected &&
      !::fstat(fd,&after) && same_file(before,after) &&
      !::fstatat(parent,leaf,&named,AT_SYMLINK_NOFOLLOW) && same_file(after,named);
    // A second fixed-name walk catches an ancestor rename while hashing;
    // the old held parent/file fd alone cannot establish the current path.
    const int again=okay?parent_(PATHS[i]):-1;
    okay=okay && again>=0 && !::fstatat(again,leaf,&named,AT_SYMLINK_NOFOLLOW) && same_file(after,named);
    for(int owned:{again,fd,parent})if(owned>=0 && ::close(owned))okay=false;
    if(okay && capture)snapshots_[i]=after;
    return okay;
  }
  bool open_(int root,const std::array<InitialVendorPin,9> &pins) {
    if(attempted_)return refuse_("vendor_open_consumed_no_retry");
    attempted_=true;
    if(::getuid()!=0 || ::geteuid()!=0 || !directory_(root,&anchor_identity_))
      return refuse_("root_owned_vendor_anchor_required");
    for(size_t i=0;i<pins.size();++i) {
      Digest digest{};
      if(!pins[i].bytes || pins[i].bytes>16*1024*1024 || !pins[i].sha256 ||
         !cgs1_supervisor::parse_digest(pins[i].sha256,digest))return refuse_("fixed_vendor_pins_required");
      sizes_[i]=pins[i].bytes;digests_[i]=pins[i].sha256;
    }
    anchor_=::fcntl(root,F_DUPFD_CLOEXEC,3);
    const int data=::openat(anchor_,"data",DIRECTORY_FLAGS);struct statfs fs{};
    bool okay=directory_(data,&data_identity_) && !::fstatfs(data,&fs) && fs.f_type==DataFilesystem;
    if(data>=0 && ::close(data))okay=false;
    if(!okay)return refuse_("fixed_ext4_data_required");
    for(size_t i=0;i<PATHS.size();++i)if(!file_(i,true))return refuse_("initial_vendor_files_unverified");
    verified_=true;error_="";return current();
  }
};
using InitialVendorFiles=BasicInitialVendorFiles<>;
// Still separate: physical device/boot/CPU/CO2/USB identity, stock/watchdog
// process birth/maps, disabled own root, RAM/resources and consumed intent.
// No timestamps or raw vendor bytes/INI/argv are exported by this reader.
}  // namespace cgs1_initial_trial
#endif
