#pragma once
#if defined(__linux__)

// Read-only, pre-intent filesystem portion of a FUTURE device scope collector.
// It joins fixed names/bytes/metadata below /data/.esphome-cgs1, not USB,
// device identity, vendor files, boot, stock processes, resources or authority.
// Pins must come from the separately validated exact plan/terminal receipts.
// No shell, arbitrary path, directory creation, repair, cleanup or activation.
#include "initial_trial_intent.h"
#include <type_traits>

namespace cgs1_initial_trial {
struct InitialPayloadPin {uint64_t bytes{0};std::string sha256;};
struct InitialFilesystemBinding {
  DirectoryIdentity root;
  std::string plan_id,plan_sha256,commit_nonce;
  // Fixed order below is also the public staging.STAGED insertion order.
  std::array<InitialPayloadPin,9> payload;
};

template<long FilesystemMagic=0xef53> class BasicInitialFilesystem {
 public:
  inline static constexpr std::array<const char *,9> PAYLOAD={
    "program","pm_qt_bridge.so","launch.sh","SnowApp-with-PM","startup-hook.sh",
    "stock-start.sh.original","stock-watchdog.sh.original","start.sh.candidate","watchdog.sh.candidate"};
  BasicInitialFilesystem()=default;
  BasicInitialFilesystem(const BasicInitialFilesystem &)=delete;
  BasicInitialFilesystem &operator=(const BasicInitialFilesystem &)=delete;
  ~BasicInitialFilesystem(){for(int fd:{anchor_,root_,lock_})if(fd>=0)::close(fd);}
  const char *error() const{return error_;}
  bool open(const InitialFilesystemBinding &binding) {
    const auto fd=::open("/",DIRECTORY_FLAGS);
    const bool okay=open_(fd,binding);if(fd>=0)::close(fd);return okay;
  }
  template<long Magic=FilesystemMagic,std::enable_if_t<Magic!=0xef53 && Magic==FilesystemMagic,int> =0>
  bool open_fixture_root(int anchor,const InitialFilesystemBinding &binding) {
    // Compile-time tmpfs fixture seam only. Production ext4 has no runtime
    // root/path/filesystem override and always walks the fixed absolute path.
    return open_(anchor,binding);
  }
  bool current() {
    if(!verified_)return false;
    struct stat named{},held{};int data=-1,root=-1;
    if(!walk_(data,root))return refuse_("named_private_root_changed");
    const bool named_ok=!::fstat(root,&named) && !::fstat(root_,&held) &&
      same_file(named,held) && same_file(root_snapshot_,held);
    ::close(root);::close(data);
    if(!named_ok || !contents_(false))return refuse_("initial_filesystem_changed_or_unreadable");
    // Close the read window with a fresh independent fixed-name walk. A held
    // old directory does not make a renamed/replaced installation current.
    if(!walk_(data,root))return refuse_("named_root_changed_after_readback");
    const bool closed=!::fstat(root,&named) && !::fstat(root_,&held) &&
      same_file(named,held) && same_file(root_snapshot_,held);
    ::close(root);::close(data);
    return closed || refuse_("named_root_changed_after_readback");
  }
  int duplicate_verified_root_fd() {
    if(!current())return -1;
    const int copy=::fcntl(root_,F_DUPFD_CLOEXEC,3);
    if(copy>=0 && !current()){::close(copy);return -1;}
    return copy;
  }
 private:
  inline static constexpr int DIRECTORY_FLAGS=O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_NOATIME|O_CLOEXEC;
  int anchor_{-1},root_{-1},lock_{-1};bool attempted_{false},verified_{false};
  InitialFilesystemBinding binding_{};DirectoryIdentity data_identity_{};
  struct stat root_snapshot_{},lock_snapshot_{};std::array<struct stat,13> files_{};
  const char *error_{""};
  bool refuse_(const char *error){error_=error;verified_=false;return false;}
  static bool directory_(int fd,struct stat &value) {
    return fd>=0 && !::fstat(fd,&value) && S_ISDIR(value.st_mode) && value.st_uid==0;
  }
  bool filesystem_(int fd) const {
    struct statfs fs{};return !::fstatfs(fd,&fs) && fs.f_type==FilesystemMagic;
  }
  bool walk_(int &data,int &root) const {
    data=::openat(anchor_,"data",DIRECTORY_FLAGS);struct stat value{};
    if(!directory_(data,value) || !filesystem_(data) ||
       uint64_t(value.st_dev)!=data_identity_.device || uint64_t(value.st_ino)!=data_identity_.inode) {
      if(data>=0)::close(data);data=-1;return false;
    }
    root=::openat(data,".esphome-cgs1",DIRECTORY_FLAGS);
    if(!private_directory(root,binding_.root) || !filesystem_(root)) {
      if(root>=0)::close(root);::close(data);root=data=-1;return false;
    }
    return true;
  }
  bool open_(int anchor,const InitialFilesystemBinding &binding) {
    if(attempted_)return refuse_("filesystem_open_consumed_no_retry");
    attempted_=true;
    if(::getuid()!=0 || ::geteuid()!=0 || !binding.root.device || !binding.root.inode ||
       !lower_hex(binding.plan_id,32) || !lower_hex(binding.plan_sha256,64) ||
       !lower_hex(binding.commit_nonce,32))return refuse_("exact_plan_root_commit_binding_required");
    for(const auto &pin:binding.payload)
      if(!pin.bytes || pin.bytes>16*1024*1024 || !lower_hex(pin.sha256,64))return refuse_("exact_payload_pins_required");
    struct stat value{};
    if(!directory_(anchor,value))return refuse_("root_anchor_unreadable");
    anchor_=::fcntl(anchor,F_DUPFD_CLOEXEC,3);binding_=binding;
    const int data=::openat(anchor_,"data",DIRECTORY_FLAGS);
    if(!directory_(data,value) || !filesystem_(data) || uint64_t(value.st_dev)!=binding.root.device) {
      if(data>=0)::close(data);return refuse_("same_ext4_data_required");
    }
    data_identity_={uint64_t(value.st_dev),uint64_t(value.st_ino)};::close(data);
    int checked_data=-1;
    if(!walk_(checked_data,root_))return refuse_("exact_named_initial_root_required");
    ::close(checked_data);
    lock_=::openat(root_,".commit-disabled.lock",DIRECTORY_FLAGS);
    if(!directory_(lock_,lock_snapshot_) || (lock_snapshot_.st_mode&07777)!=0700 ||
       uint64_t(lock_snapshot_.st_dev)!=binding.root.device || !filesystem_(lock_) ||
       ::fstat(root_,&root_snapshot_) || !contents_(true))return refuse_("disabled_root_contents_unverified");
    verified_=true;return current();
  }
  bool exact_entries_(int fd,bool lock) const {
    const int copy=::openat(fd,".",DIRECTORY_FLAGS);if(copy<0)return false;
    DIR *directory=::fdopendir(copy);if(!directory){::close(copy);return false;}
    std::array<bool,13> seen{};unsigned count=0;bool valid=true;errno=0;
    while(const auto *entry=::readdir(directory)) {
      if(!std::strcmp(entry->d_name,".") || !std::strcmp(entry->d_name,".."))continue;
      size_t index=13;
      if(lock){if(!std::strcmp(entry->d_name,"owner"))index=0;}
      else {
        for(size_t i=0;i<PAYLOAD.size();++i)if(!std::strcmp(entry->d_name,PAYLOAD[i]))index=i;
        if(!std::strcmp(entry->d_name,"install.intent"))index=9;
        if(!std::strcmp(entry->d_name,"disabled"))index=10;
        if(!std::strcmp(entry->d_name,"pm-helper.disabled"))index=11;
        if(!std::strcmp(entry->d_name,".commit-disabled.lock"))index=12;
      }
      // Unknown files include autostart stores, partial replacement debris,
      // rollback locks and previous trial markers. Preserve/refuse them all.
      if(index==13 || seen[index] || ++count>(lock?1:13)){valid=false;break;}
      seen[index]=true;errno=0;
    }
    valid=valid && errno==0 && count==(lock?1:13);
    if(::closedir(directory))valid=false;
    return valid;
  }
  bool file_(int directory,const char *name,uint64_t size,mode_t mode,
             const std::string &sha,const std::string *text,size_t index,bool capture) {
    const int fd=::openat(directory,name,O_RDONLY|O_NONBLOCK|O_NOFOLLOW|O_NOATIME|O_CLOEXEC);
    if(fd<0)return false;
    struct stat before{},after{},named{};Digest actual{},expected{};bool valid=true;
    valid=!::fstat(fd,&before) && S_ISREG(before.st_mode) && before.st_uid==0 &&
      (before.st_mode&07777)==mode && before.st_nlink==1 && before.st_size==off_t(size) &&
      uint64_t(before.st_dev)==binding_.root.device && (capture || same_file(files_[index],before));
    if(valid && text) {
      std::array<char,128> bytes{};
      valid=text->size()<=bytes.size() && ::pread(fd,bytes.data(),text->size(),0)==ssize_t(text->size()) &&
        !std::memcmp(bytes.data(),text->data(),text->size());
    } else if(valid) valid=cgs1_supervisor::parse_digest(sha,expected) &&
      cgs1_supervisor::image_hash(fd,before.st_size,actual) && actual==expected;
    valid=valid && !::fstat(fd,&after) && same_file(before,after) &&
      !::fstatat(directory,name,&named,AT_SYMLINK_NOFOLLOW) && same_file(after,named);
    if(::close(fd))valid=false;
    if(valid && capture)files_[index]=after;
    return valid;
  }
  bool contents_(bool capture) {
    struct stat held{},named{};
    if(!exact_entries_(root_,false) || !exact_entries_(lock_,true) ||
       ::fstat(lock_,&held) || !same_file(lock_snapshot_,held) ||
       ::fstatat(root_,".commit-disabled.lock",&named,AT_SYMLINK_NOFOLLOW) || !same_file(held,named))return false;
    for(size_t i=0;i<PAYLOAD.size();++i) {
      const auto &pin=binding_.payload[i];const mode_t mode=i==0 || i==2 || i==3?0700:0600;
      if(!file_(root_,PAYLOAD[i],pin.bytes,mode,pin.sha256,nullptr,i,capture))return false;
    }
    const std::string install=binding_.plan_id+" "+binding_.plan_sha256+"\n";
    const std::string owner="commit-disabled "+binding_.commit_nonce+" "+binding_.plan_id+"\n";
    const std::string empty;
    return file_(root_,"install.intent",install.size(),0600,"",&install,9,capture) &&
      file_(root_,"disabled",0,0600,"",&empty,10,capture) &&
      file_(root_,"pm-helper.disabled",0,0600,"",&empty,11,capture) &&
      file_(lock_,"owner",owner.size(),0600,"",&owner,12,capture) &&
      exact_entries_(root_,false) && exact_entries_(lock_,true);
  }
};
using InitialFilesystem=BasicInitialFilesystem<>;
// Initial-only proof: creating the trial marker invalidates this strict empty-
// history scope. The full guardian needs a separately joined claimed/live
// observation, not a caller flag that suppresses unexpected marker detection.
}  // namespace cgs1_initial_trial
#endif
