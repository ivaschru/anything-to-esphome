#pragma once
#if defined(__linux__)

// Read-only identity of the process actually running this code. A caller's
// PID, JSON report or copied executable is never a substitute for /proc/self.
// The expected pin must still come from separately authenticated host input;
// this reader neither authenticates that input nor authorizes a trial.
#include "initial_trial_admission.h"
#include "supervisor_process_tree.h"
#include <type_traits>

namespace cgs1_initial_trial {
template<bool NativeFixture=false> class BasicInitialGuardianSelf {
 public:
  BasicInitialGuardianSelf()=default;
  BasicInitialGuardianSelf(const BasicInitialGuardianSelf &)=delete;
  BasicInitialGuardianSelf &operator=(const BasicInitialGuardianSelf &)=delete;
  ~BasicInitialGuardianSelf(){for(int fd:{image_,root_,tmp_,anchor_})if(fd>=0)::close(fd);}
  const char *error() const{return error_;}

  bool open(const std::string &job_id,const DirectoryIdentity &identity,uint64_t bytes,const std::string &sha) {
    if(!begin_(identity,bytes,sha))return false;
    if(job_id.size()!=32 || job_id.find_first_not_of("0123456789abcdef")!=std::string::npos)
      return refuse_("exact_guardian_job_required");
    leaf_="qingping-initial-guardian-"+job_id;
    path_="/tmp/"+leaf_;
    anchor_=::open("/",DIR_FLAGS);tmp_=anchor_>=0?::openat(anchor_,"tmp",DIR_FLAGS):-1;
    if(!tmp_current_(tmp_,&tmp_identity_))return refuse_("root_owned_sticky_tmpfs_required");
    root_=::openat(tmp_,leaf_.c_str(),DIR_FLAGS);
    return admit_();
  }

  template<bool Fixture=NativeFixture,std::enable_if_t<Fixture && Fixture==NativeFixture,int> =0>
  bool open_native_fixture(const std::string &private_path,const DirectoryIdentity &identity,
      uint64_t bytes,const std::string &sha) {
    // Native hosted self-exec cannot use an ARM header or the monitor's
    // tmpfs /tmp. Only this explicitly different compile-time type exposes
    // the private test path. Kernel self identity, inode/hash/metadata and
    // refusal checks below remain real; no fake /proc or expected PID seam.
    if(!begin_(identity,bytes,sha))return false;
    if(private_path.empty() || private_path[0]!='/' || private_path.back()=='/' ||
       private_path.find('\0')!=std::string::npos)return refuse_("private_fixture_path_required");
    fixture_=true;path_=private_path;root_=::open(path_.c_str(),DIR_FLAGS);
    return admit_();
  }

  bool current() {
    if(!verified_)return false;
    const auto started=cgs1_supervisor::process_tree_clock_ms();
    const auto actual=cgs1_supervisor::process_stamp(::getpid());
    if(!started || ::getuid()!=0 || ::geteuid()!=0 || !same_actor_(actual) ||
       !named_() || !listed_() || !image_current_() || !kernel_image_() ||
       !image_current_() || !listed_() || !named_() ||
       !same_actor_(cgs1_supervisor::process_stamp(::getpid())))
      return refuse_("guardian_self_or_named_image_changed");
    const auto finished=cgs1_supervisor::process_tree_clock_ms();
    // Checked after IO, not a hard IO timeout. Keep this out of the future
    // independent child-stop timer; a hash read is not a deadline mechanism.
    if(!finished || finished<started || finished-started>1000)
      return refuse_("guardian_self_observation_stale");
    return true;
  }

  bool matches_actual_process(uint32_t pid,uint64_t start,int opened_executable) {
    // A future stock scanner may use this relationship for THIS process
    // only. There is no method to register an arbitrary permitted PID or
    // transfer the relationship to a fork child, sibling or serialized proof.
    struct stat actual{};
    if(!current() || pid!=uint32_t(actor_.pid) || start!=actor_.start ||
       opened_executable<0 || ::fstat(opened_executable,&actual) || !same_file(image_snapshot_,actual))
      return refuse_("actual_guardian_process_and_image_required");
    return current();
  }

 private:
  inline static constexpr int DIR_FLAGS=O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_NOATIME|O_CLOEXEC;
  inline static constexpr int FILE_FLAGS=O_RDONLY|O_NONBLOCK|O_NOFOLLOW|O_NOATIME|O_CLOEXEC;
  int anchor_{-1},tmp_{-1},root_{-1},image_{-1};
  bool attempted_{false},verified_{false},fixture_{false};
  std::string path_,leaf_;DirectoryIdentity identity_{},tmp_identity_{};
  uint64_t bytes_{0};Digest digest_{};struct stat root_snapshot_{},image_snapshot_{};
  cgs1_supervisor::ProcessStamp actor_{};const char *error_{"unobserved"};
  bool refuse_(const char *reason){verified_=false;error_=reason;return false;}
  bool begin_(const DirectoryIdentity &identity,uint64_t bytes,const std::string &sha) {
    if(attempted_)return refuse_("guardian_self_open_consumed_no_retry");
    attempted_=true;identity_=identity;bytes_=bytes;
    if(::getuid()!=0 || ::geteuid()!=0 || ::getpid()<=1 || !identity.device || !identity.inode ||
       bytes<52 || bytes>16*1024*1024 || !cgs1_supervisor::parse_digest(sha,digest_))
      return refuse_("exact_guardian_root_and_image_pin_required");
    actor_=cgs1_supervisor::process_stamp(::getpid());
    if(actor_.pid!=::getpid() || actor_.owner!=0 || actor_.parent<1 || !actor_.start || !alive_(actor_))
      return refuse_("actual_root_guardian_birth_required");
    return true;
  }
  static bool alive_(const cgs1_supervisor::ProcessStamp &a) {
    return a.state=='R' || a.state=='S' || a.state=='D' || a.state=='I';
  }
  bool same_actor_(const cgs1_supervisor::ProcessStamp &a) const {
    return a.pid==actor_.pid && a.pid==::getpid() && a.start==actor_.start &&
      a.parent==actor_.parent && a.owner==0 && alive_(a);
  }
  static bool tmp_current_(int fd,DirectoryIdentity *identity=nullptr) {
    struct stat value{};struct statfs fs{};
    if(fd<0 || ::fstat(fd,&value) || !S_ISDIR(value.st_mode) || value.st_uid!=0 ||
       (value.st_mode&07777)!=01777 || ::fstatfs(fd,&fs) || fs.f_type!=0x01021994)return false;
    if(identity)*identity={uint64_t(value.st_dev),uint64_t(value.st_ino)};
    return true;
  }
  bool named_() const {
    int tmp=-1,named=-1;bool okay=true;
    if(fixture_) {
      // This branch can be set only by the compile-time fixture entry above.
      if constexpr(!NativeFixture)return false;
      named=::open(path_.c_str(),DIR_FLAGS);
    } else {
      struct stat anchor{};DirectoryIdentity observed{};
      tmp=::openat(anchor_,"tmp",DIR_FLAGS);
      okay=!::fstat(anchor_,&anchor) && S_ISDIR(anchor.st_mode) && anchor.st_uid==0 &&
        !(anchor.st_mode&0022) && tmp_current_(tmp_,&observed) &&
        observed.device==tmp_identity_.device && observed.inode==tmp_identity_.inode &&
        tmp_current_(tmp,&observed) && observed.device==tmp_identity_.device && observed.inode==tmp_identity_.inode;
      if(okay)named=::openat(tmp,leaf_.c_str(),DIR_FLAGS);
    }
    struct stat held{},fresh{};struct statfs fs{};
    okay=okay && private_directory(root_,identity_) && private_directory(named,identity_) &&
      !::fstat(root_,&held) && !::fstat(named,&fresh) && same_file(root_snapshot_,held) && same_file(held,fresh);
    if(!fixture_)okay=okay && !::fstatfs(named,&fs) && fs.f_type==0x01021994;
    for(int fd:{named,tmp})if(fd>=0 && ::close(fd))okay=false;
    return okay;
  }
  bool listed_() const {
    const int scan=::openat(root_,".",DIR_FLAGS);DIR *directory=scan>=0?::fdopendir(scan):nullptr;
    if(!directory){if(scan>=0)::close(scan);return false;}
    bool okay=true;unsigned programs=0;
    while(okay) {
      errno=0;const auto *entry=::readdir(directory);
      if(!entry){okay=errno==0;break;}
      if(!std::strcmp(entry->d_name,".") || !std::strcmp(entry->d_name,".."))continue;
      // No credentials, preferences, prior job or extra executable can share
      // the guardian directory. Never remove unknown history to make it pass.
      okay=!std::strcmp(entry->d_name,"program") && ++programs==1;
    }
    if(::closedir(directory))okay=false;
    return okay && programs==1;
  }
  bool image_current_() const {
    struct stat held{},after{},named{};Digest actual{};
    return !::fstat(image_,&held) && same_file(image_snapshot_,held) &&
      no_reported_file_capability(image_) && cgs1_supervisor::image_hash(image_,bytes_,actual) && actual==digest_ &&
      !::fstat(image_,&after) && same_file(held,after) &&
      !::fstatat(root_,"program",&named,AT_SYMLINK_NOFOLLOW) && same_file(after,named);
  }
  bool kernel_image_() const {
    // A kernel magic link is intentionally followed only for our actual
    // current process. A matching basename, reported PID or copied file is
    // insufficient. Verify the live opened image, metadata AND exact path.
    const auto proc="/proc/"+std::to_string(::getpid());
    const int task=::open(proc.c_str(),DIR_FLAGS);struct stat directory{},actual{},after{};struct statfs fs{};
    bool okay=task>=0 && !::fstat(task,&directory) && S_ISDIR(directory.st_mode) &&
      directory.st_uid==0 && !(directory.st_mode&0022) && !::fstatfs(task,&fs) && fs.f_type==0x9fa0;
    char path[4096]{};const auto count=okay?::readlinkat(task,"exe",path,sizeof(path)):-1;
    okay=okay && count>0 && count<ssize_t(sizeof(path)) && std::string(path,size_t(count))==path_+"/program";
    const int image=okay?::openat(task,"exe",O_RDONLY|O_NONBLOCK|O_NOATIME|O_CLOEXEC):-1;
    okay=okay && image>=0 && !::fstat(image,&actual) && same_file(image_snapshot_,actual) &&
      !::fstat(image,&after) && same_file(actual,after);
    for(int fd:{image,task})if(fd>=0 && ::close(fd))okay=false;
    return okay;
  }
  bool admit_() {
    struct statfs fs{};
    if(!private_directory(root_,identity_) || ::fstat(root_,&root_snapshot_) ||
       (!fixture_ && (::fstatfs(root_,&fs) || fs.f_type!=0x01021994)))
      return refuse_("exact_private_guardian_directory_required");
    image_=::openat(root_,"program",FILE_FLAGS);
    if(image_<0 || ::fstat(image_,&image_snapshot_) || !S_ISREG(image_snapshot_.st_mode) ||
       image_snapshot_.st_uid!=0 || (image_snapshot_.st_mode&07777)!=0700 || image_snapshot_.st_nlink!=1 ||
       uint64_t(image_snapshot_.st_size)!=bytes_ || uint64_t(image_snapshot_.st_dev)!=identity_.device)
      return refuse_("plain_exact_guardian_program_required");
    if(!fixture_) {
      std::array<unsigned char,52> h{};
      if(::pread(image_,h.data(),h.size(),0)!=ssize_t(h.size()) ||
         h[0]!=0x7f || h[1]!='E' || h[2]!='L' || h[3]!='F' || h[4]!=1 || h[5]!=1 || h[6]!=1 ||
         (h[16]!=2 && h[16]!=3) || h[17] || h[18]!=40 || h[19] ||
         h[20]!=1 || h[21] || h[22] || h[23] || h[40]!=52 || h[41] || (h[37]&6)!=4)
        return refuse_("arm32_hardfloat_guardian_required");
    }
    verified_=true;error_="";return current();
  }
};
using InitialGuardianSelf=BasicInitialGuardianSelf<>;
// This grants no fork or signal. The stock scanner joins the live reader
// itself for this actual caller only, never a serialized permitted PID. Production
// initial installation and vendor-kernel execution remain unqualified.
}  // namespace cgs1_initial_trial
#endif
