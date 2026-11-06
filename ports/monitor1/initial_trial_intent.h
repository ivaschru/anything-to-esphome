#pragma once
#if defined(__linux__)

// Device-side ONE-shot marker primitive, not an installation/launch command.
// A future guardian must validate the named root/stock/flags/resources and
// consume its separate host intent before calling this fixed-root writer.
// Both opt-outs stay set. Existing/partial markers are never adopted, retried,
// repaired, unlinked or bypassed by selecting a different nonce.
#include "initial_trial_admission.h"
#include "supervisor_process_tree.h"

namespace cgs1_initial_trial {
struct IntentBinding {
  std::string plan_id,plan_sha256,boot_id,bridge_sha256,guardian_sha256,nonce;
  DirectoryIdentity ram;
};
inline bool lower_hex(const std::string &value,size_t length) {
  return value.size()==length && value.find_first_not_of("0123456789abcdef")==std::string::npos;
}
inline bool valid_intent_binding(const IntentBinding &value) {
  if(!lower_hex(value.plan_id,32) || !lower_hex(value.plan_sha256,64) ||
     !lower_hex(value.bridge_sha256,64) || !lower_hex(value.guardian_sha256,64) ||
     !lower_hex(value.nonce,32) || !value.ram.device || !value.ram.inode || value.boot_id.size()!=36)return false;
  for(size_t index=0;index<36;++index) {
    const bool dash=index==8 || index==13 || index==18 || index==23;
    if(dash ? value.boot_id[index]!='-' :
       std::string("0123456789abcdef").find(value.boot_id[index])==std::string::npos)return false;
  }
  return true;
}

template<long FilesystemMagic=0xef53> class BasicInitialTrialIntent {
 public:
  inline static constexpr const char *NAME="initial-trial.intent";
  BasicInitialTrialIntent()=default;
  BasicInitialTrialIntent(const BasicInitialTrialIntent &)=delete;
  BasicInitialTrialIntent &operator=(const BasicInitialTrialIntent &)=delete;
  ~BasicInitialTrialIntent(){if(record_>=0)::close(record_);if(root_>=0)::close(root_);}
  const char *error() const{return error_;}
  bool open(int trusted_root,const DirectoryIdentity &root,const IntentBinding &binding) {
    if(open_attempted_)return fail_("intent_open_already_attempted");
    open_attempted_=true;
    if(::getuid()!=0 || ::geteuid()!=0 || !valid_intent_binding(binding) ||
       !private_directory(trusted_root,root))return fail_("exact_private_intent_binding_required");
    guardian_=cgs1_supervisor::process_stamp(::getpid());
    if(guardian_.pid<=1 || !guardian_.start || guardian_.owner!=0)return fail_("guardian_birth_unverified");
    identity_=root;binding_=binding;
    root_=::fcntl(trusted_root,F_DUPFD_CLOEXEC,3);
    if(!root_current_() || !boot_current_())return fail_("intent_root_or_boot_changed");
    // Only hashes, numeric identities and a correlation nonce. No device
    // credentials, private profile body, generic argv or environment.
    text_="CGS1_INITIAL_TRIAL_V1\n"+binding.plan_id+"\n"+binding.plan_sha256+"\n"+
      binding.boot_id+"\n"+binding.bridge_sha256+"\n"+binding.guardian_sha256+"\n"+
      binding.nonce+"\n"+std::to_string(binding.ram.device)+" "+std::to_string(binding.ram.inode)+"\n"+
      std::to_string(guardian_.pid)+" "+std::to_string(guardian_.start)+"\n";
    opened_ready_=true;return true;
  }
  bool claim() {
    if(claim_attempted_)return fail_("intent_claim_consumed_no_retry");
    claim_attempted_=true;  // Consume BEFORE the first possible NAND write.
    if(!opened_ready_ || root_<0 || text_.empty() || !root_current_() || !boot_current_() || !guardian_current_())
      return fail_("intent_live_scope_unverified");
    record_=::openat(root_,NAME,O_RDWR|O_CREAT|O_EXCL|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC,0600);
    if(record_<0)return fail_("intent_exists_or_create_failed_no_retry");
    struct stat created{};
    if(::fstat(record_,&created) || !regular_(created,0) || ::fchmod(record_,0600) ||
       ::write(record_,text_.data(),text_.size())!=ssize_t(text_.size()) ||
       ::fsync(record_) || ::fsync(root_) || ::fstat(record_,&snapshot_))
      return fail_("intent_write_or_sync_unknown_no_cleanup");
    verified_=true;
    if(!current())return fail_("intent_independent_readback_failed");
    return true;
  }
  bool current() {
    if(!verified_ || !root_current_() || !boot_current_() || !guardian_current_())
      return fail_("intent_scope_no_longer_verified");
    struct stat before{},after{},named{};
    std::array<char,512> bytes{};
    if(text_.size()>bytes.size() || ::fstat(record_,&before) ||
       !regular_(before,text_.size()) || !same_file(snapshot_,before) ||
       ::pread(record_,bytes.data(),text_.size(),0)!=ssize_t(text_.size()) ||
       std::memcmp(bytes.data(),text_.data(),text_.size()) ||
       ::fstat(record_,&after) || !same_file(before,after) ||
       ::fstatat(root_,NAME,&named,AT_SYMLINK_NOFOLLOW) || !same_file(after,named) ||
       !root_current_() || !boot_current_() || !guardian_current_())
      return fail_("intent_changed_or_readback_unavailable");
    return true;
  }
  bool authorize_one_fork() {
    // A persisted record alone never mints a second permission. Only this
    // creator process/object can consume its one in-memory launch grant.
    if(fork_attempted_)return false;
    fork_attempted_=true;
    return current();
  }
  bool matches_filesystem_binding(const DirectoryIdentity &root,const std::string &plan_id,
                                  const std::string &plan_sha256,const std::string &bridge_sha256) {
    // Read-only join with the creator's already claimed record. Matching text
    // or a copied JSON flag is insufficient: current() also checks the exact
    // held/named inode, boot and THIS creator process birth. This grants no
    // fork and neither exposes nor relaxes guardian/RAM/nonce admission.
    return current() && identity_.device==root.device && identity_.inode==root.inode &&
      binding_.plan_id==plan_id && binding_.plan_sha256==plan_sha256 && binding_.bridge_sha256==bridge_sha256;
  }
 private:
  int root_{-1},record_{-1};DirectoryIdentity identity_{};IntentBinding binding_{};
  cgs1_supervisor::ProcessStamp guardian_{};struct stat snapshot_{};
  bool open_attempted_{false},opened_ready_{false},claim_attempted_{false},fork_attempted_{false},verified_{false};
  std::string text_;const char *error_{""};
  bool fail_(const char *reason){error_=reason;verified_=opened_ready_=false;return false;}
  bool regular_(const struct stat &value,size_t size) const {
    return S_ISREG(value.st_mode) && value.st_uid==0 && (value.st_mode&07777)==0600 &&
      value.st_nlink==1 && value.st_size==off_t(size) && uint64_t(value.st_dev)==identity_.device;
  }
  bool root_current_() const {
    struct statfs fs{};
    return root_>=0 && private_directory(root_,identity_) && !::fstatfs(root_,&fs) && fs.f_type==FilesystemMagic;
  }
  bool boot_current_() const {
    const int fd=::open("/proc/sys/kernel/random/boot_id",O_RDONLY|O_NOFOLLOW|O_CLOEXEC);
    if(fd<0)return false;
    char bytes[64]{};const auto count=::read(fd,bytes,sizeof(bytes));::close(fd);
    return count==37 && std::string(bytes,size_t(count))==binding_.boot_id+"\n";
  }
  bool guardian_current_() const {
    const auto actual=cgs1_supervisor::process_stamp(::getpid());
    return actual.pid==guardian_.pid && actual.start==guardian_.start && actual.owner==0;
  }
};
using InitialTrialIntent=BasicInitialTrialIntent<>;
}  // namespace cgs1_initial_trial
#endif
