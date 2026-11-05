#pragma once

// Native-only committed Wi-Fi choices, separate from the vendor supplicant
// file. This is the DISK part of the future guarded network transaction, not
// permission to select a network or retire its independent rollback lease.
// No production caller is connected yet. In particular, do not call SAVE_CONFIG
// against the stock 0777 file to make this store appear integrated.
//
// A record contains its transaction decision together with the credentials.
// There must not be a second, independently published "commit succeeded"
// marker: a crash between two such renames would give the guardian and next
// boot contradictory decisions. The guardian must inspect this exact record
// after a lost ACK. A visible but un-fsynced rename is UNCERTAIN, never a reason
// to repeat commit or blindly roll back a possibly committed decision.
#include "checkpoint_epoch.h"
#include <array>
#include <cerrno>
#include <cstdint>
#include <cstring>
#include <string>
#include <vector>
#include <fcntl.h>
#include <sys/file.h>
#include <sys/stat.h>
#include <unistd.h>

namespace cgs1_wifi_private {
inline void erase_bytes(void *data,size_t length) {
  // glibc 2.23 has no portable explicit_bzero. Volatile stores prevent this
  // cleanup from being optimized out. This limits ordinary buffer retention;
  // it is not a claim of protection against root, swap or forensic snapshots.
  volatile unsigned char *p=static_cast<volatile unsigned char *>(data);
  while(length--)*p++=0;
}
struct Network {
  uint8_t ssid_size{0};
  std::array<uint8_t,32> ssid{};
  // WPA2-PSK is 32 binary bytes, not a passphrase or an escaping-dependent
  // control command. Conversion from a locally entered passphrase is a
  // separate adapter. WPA3/EAP/open networks are not silently approximated.
  std::array<uint8_t,32> psk{};
  ~Network(){erase_bytes(psk.data(),psk.size());}
};
using Networks=std::vector<Network>;

namespace detail {
inline constexpr size_t MAX_NETWORKS=16,MAX_RECORD=8+16+1+MAX_NETWORKS*65+4;
struct Bytes {
  Bytes()=default;Bytes(const Bytes &)=delete;Bytes &operator=(const Bytes &)=delete;
  std::string value;
  ~Bytes(){erase_bytes(value.empty()?nullptr:&value[0],value.size());}
};
inline uint32_t crc32(const std::string &s,size_t length) {
  uint32_t crc=0xffffffffU;
  for(size_t i=0;i<length;++i) {
    crc^=uint8_t(s[i]);
    for(unsigned j=0;j<8;++j)crc=(crc>>1)^(0xedb88320U & (0U-(crc&1)));
  }
  return ~crc; // Accidental corruption detection, NOT authentication.
}
inline bool valid(const Networks &networks) {
  if(networks.size()>MAX_NETWORKS)return false;
  for(size_t i=0;i<networks.size();++i) {
    const auto &n=networks[i];
    if(!n.ssid_size || n.ssid_size>32)return false;
    for(size_t j=0;j<i;++j)
      if(networks[j].ssid_size==n.ssid_size &&
          !std::memcmp(networks[j].ssid.data(),n.ssid.data(),n.ssid_size))return false;
  }
  // An empty overlay is intentional: forget our own networks without deleting
  // any vendor profile. SSIDs are bytes, so NUL/quotes/newlines are not syntax.
  return true;
}
inline bool encode(const char *epoch,const Networks &networks,Bytes &out) {
  if(!cgs1_checkpoint::valid_epoch(epoch) || !valid(networks))return false;
  auto &s=out.value;
  erase_bytes(s.empty()?nullptr:&s[0],s.size());s.clear();s.reserve(MAX_RECORD);
  // Reserve before appending any key: reallocation must not free a partly
  // filled credential buffer that our final scope cleanup cannot reach.
  s="CGS1WF1\n";s.append(epoch,16);s+=char(networks.size());
  for(const auto &n:networks) {
    s+=char(n.ssid_size);s.append(reinterpret_cast<const char *>(n.ssid.data()),n.ssid_size);
    s.append(reinterpret_cast<const char *>(n.psk.data()),n.psk.size());
  }
  const uint32_t crc=crc32(s,s.size());
  for(unsigned shift=0;shift<32;shift+=8)s+=char(crc>>shift);
  return true;
}
inline bool decode(const Bytes &record,std::string &epoch,Networks &networks) {
  const auto &s=record.value;
  if(s.size()<29 || s.size()>MAX_RECORD || s.compare(0,8,"CGS1WF1\n"))return false;
  const auto selected_epoch=s.substr(8,16);
  if(!cgs1_checkpoint::valid_epoch(selected_epoch.c_str()))return false;
  uint32_t stored=0;
  for(unsigned i=0;i<4;++i)stored|=uint32_t(uint8_t(s[s.size()-4+i]))<<(i*8);
  if(stored!=crc32(s,s.size()-4))return false;
  const size_t count=uint8_t(s[24]);if(count>MAX_NETWORKS)return false;
  Networks selected;selected.reserve(count);size_t at=25;
  for(size_t i=0;i<count;++i) {
    if(at>=s.size()-4)return false;
    Network n;n.ssid_size=uint8_t(s[at++]);
    if(!n.ssid_size || n.ssid_size>32 || s.size()-4-at<size_t(n.ssid_size)+32)return false;
    std::memcpy(n.ssid.data(),s.data()+at,n.ssid_size);at+=n.ssid_size;
    std::memcpy(n.psk.data(),s.data()+at,32);at+=32;selected.push_back(n);
  }
  if(at!=s.size()-4 || !valid(selected))return false;
  epoch=selected_epoch;networks=std::move(selected);return true;
}
struct Posix {
  static ssize_t write(int fd,const void *p,size_t size){return ::write(fd,p,size);}
  static int sync(int fd){return ::fsync(fd);}
  static int rename(int dir,const char *from,const char *to){return ::renameat(dir,from,dir,to);}
};
} // namespace detail

enum class Load {MISSING,LOADED,ERROR};
enum class Commit {COMMITTED,ALREADY_COMMITTED,REFUSED,UNCERTAIN};

// IO substitution exists only for Linux fault fixtures. Production uses real
// POSIX calls. There is no remote pathname/command/credential export interface.
template<class IO=detail::Posix> class Store {
 public:
  Store()=default;Store(const Store &)=delete;Store &operator=(const Store &)=delete;
  ~Store(){if(lock_>=0)::close(lock_);if(directory_>=0)::close(directory_);if(parent_>=0)::close(parent_);}
  bool open_existing(int trusted_parent,const char *epoch) {
    return open_(trusted_parent,epoch,true);
  }
  // Shared leases exclude every cooperating writer, but permit independent
  // guardians/native retirement to verify the same durable decision together.
  // This route cannot create the lock inode or publish any credential record.
  bool open_readonly(int trusted_parent,const char *epoch) {
    return open_(trusted_parent,epoch,false);
  }
 private:
  bool open_(int trusted_parent,const char *epoch,bool writable) {
    lease_busy_=false;
    if(attempted_)return fail_("wifi_store_already_attempted");
    attempted_=true;
    if(!cgs1_checkpoint::valid_epoch(epoch))return fail_("wifi_transaction_epoch_required");
    epoch_=epoch;
    // Caller supplies an ALREADY fenced private parent FD from the native
    // bootstrap. No absolute path traversal or implicit directory creation.
    // The production adapter must create wifi/0700 as a separately verified
    // installation step. A missing/inaccessible directory is not an empty one.
    struct stat parent{};
    if(trusted_parent<0 || ::fstat(trusted_parent,&parent) || !private_directory_(parent))
      return fail_("wifi_private_parent_required");
    parent_=::fcntl(trusted_parent,F_DUPFD_CLOEXEC,3);
    if(parent_<0)return fail_("wifi_parent_descriptor_unavailable");
    directory_=::openat(parent_,DIRECTORY,O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
    if(directory_<0 || ::fstat(directory_,&directory_identity_) ||
        !private_directory_(directory_identity_) || directory_identity_.st_dev!=parent.st_dev || !same_directory_())
      return fail_("wifi_private_directory_required");
    lock_=::openat(directory_,"networks.lock",(writable?(O_RDWR|O_CREAT):O_RDONLY)|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC,0600);
    if(lock_<0 || !private_file_(lock_,nullptr))
      return fail_("wifi_writer_lease_unavailable");
    if(::flock(lock_,(writable?LOCK_EX:LOCK_SH)|LOCK_NB)) {
      // Distinguish only a known lock refusal before load/publication. An
      // unsafe inode, IO error or uncertain commit is never a retry signal.
      lease_busy_=errno==EAGAIN || errno==EWOULDBLOCK;
      return fail_("wifi_writer_lease_unavailable");
    }
    writable_=writable;ready_=true;return true;
  }
 public:
  Load load(Networks &networks) {
    if(!ready_ || loaded_) {fail_("wifi_first_load_required");return Load::ERROR;}
    struct stat identity{};const int found=read_(last_record_,identity);
    std::string decision;Networks selected;
    if(found<0 || (found && !detail::decode(last_record_,decision,selected))) {
      fail_("wifi_record_invalid_or_inaccessible");return Load::ERROR;
    }
    // read_ fsyncs the observed file and directory. A new guardian/store can
    // therefore reconcile a visible commit after a lost ACK without writing
    // the credentials a second time. This does not simulate physical power loss.
    loaded_=true;present_=found==1;last_identity_=identity;decision_=decision;
    networks=std::move(selected);error_.clear();return found?Load::LOADED:Load::MISSING;
  }
  bool decided_here()const{return loaded_ && present_ && decision_==epoch_;}
  bool loaded()const{return loaded_;}
  bool present()const{return loaded_ && present_;}
  const std::string &transaction_epoch()const{return epoch_;}
  const std::string &decision_epoch()const{return decision_;}
  bool matches_loaded(const char *decision,const Networks &networks)const {
    if(!loaded_ || uncertain_ || !present_)return false;
    detail::Bytes expected;
    return detail::encode(decision,networks,expected) && expected.value==last_record_.value;
  }
  bool verify_unchanged()const {
    if(!loaded_ || uncertain_)return false;
    detail::Bytes current;struct stat identity{};const int found=read_(current,identity);
    return found>=0 && bool(found)==present_ && current.value==last_record_.value &&
      (!present_ || same_file_(identity,last_identity_));
  }
  const std::string &error()const{return error_;} // Fixed codes, never credentials.
  bool lease_busy()const{return lease_busy_;}
  Commit commit(const Networks &networks) {
    // Primitive storage callers already own their separate policy. Native
    // forward switching must use commit_guarded() so live connectivity/scope
    // are checked AFTER temp-file fsync, immediately before publication.
    struct PrimitiveAdmission {bool before_publish()const{return true;}} admission;
    return commit_guarded(networks,admission);
  }
  template<class Admission>Commit commit_guarded(const Networks &networks,Admission&admission) {
    // Enforce this in the storage primitive too, not merely by callers'
    // convention. Refusal precedes temporary-file IO and admission callbacks.
    if(!ready_ || !loaded_ || consumed_ || uncertain_)return refused_("wifi_unambiguous_unused_store_required");
    if(!writable_)return refused_("wifi_read_only_store");
    consumed_=true;detail::Bytes record;
    if(!detail::encode(epoch_.c_str(),networks,record))return refused_("wifi_networks_invalid");
    detail::Bytes actual;struct stat identity{};const int found=read_(actual,identity);
    if(found<0 || bool(found)!=present_ || actual.value!=last_record_.value ||
        (present_ && !same_file_(identity,last_identity_)))return refused_("wifi_record_changed");
    // Same transaction cannot change its decision, even after reopening. The
    // exact prior decision can be acknowledged without another flash write.
    if(decided_here()) {
      if(record.value!=actual.value)return refused_("wifi_transaction_decision_conflict");
      return Commit::ALREADY_COMMITTED;
    }
    const std::string temporary=".networks-"+epoch_+"-"+std::to_string(::getpid());
    const int file=::openat(directory_,temporary.c_str(),O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);
    if(file<0)return refused_("wifi_new_inode_unavailable");
    struct stat created{};bool okay=private_file_(file,&created);size_t at=0;
    while(okay && at<record.value.size()) {
      const auto n=IO::write(file,record.value.data()+at,record.value.size()-at);
      if(n<0 && errno==EINTR)continue;
      if(n<=0 || size_t(n)>record.value.size()-at)okay=false;else at+=size_t(n);
    }
    okay=okay && IO::sync(file)==0;const bool closed=::close(file)==0;okay=okay && closed;
    // Re-read bytes + identity immediately before publication; another writer
    // ignoring flock must not be silently overwritten. Parent and directory
    // identity are also checked. Cooperative root callers share networks.lock;
    // a hostile root race is outside this process isolation boundary.
    detail::Bytes latest;struct stat before_rename{};
    const auto latest_found=okay?read_(latest,before_rename):-1;
    okay=okay && latest_found==found && latest.value==actual.value &&
      (!present_ || same_file_(before_rename,identity));
    // Preparation/fsync may block past a transaction deadline or a network
    // change. The concrete native gate owns this SAME Store lease and checks
    // exact UNCOMMITTED bytes + live owner/association/lease/gateway/scope.
    // A refusal consumes this writer and removes only its unpublished temp;
    // it never rewrites a decision, releases recovery, or retries publication.
    if(!okay || !admission.before_publish() || IO::rename(directory_,temporary.c_str(),NAME)) {
      unlink_own_(temporary,created);return refused_("wifi_commit_not_published");
    }
    // From rename onward, never delete/overwrite/retry on an uncertain result.
    // Recovery must open a new instance and inspect the transaction in the
    // same record before deciding whether its rollback lease can be retired.
    if(IO::sync(directory_))return uncertain_result_("wifi_visible_commit_not_durable");
    detail::Bytes installed;struct stat published{};
    if(read_(installed,published)!=1 || installed.value!=record.value ||
        published.st_dev!=created.st_dev || published.st_ino!=created.st_ino)
      return uncertain_result_("wifi_commit_readback_failed");
    decision_=epoch_;present_=true;last_identity_=published;
    last_record_.value.swap(record.value);error_.clear();return Commit::COMMITTED;
  }
 private:
  inline static constexpr const char *DIRECTORY="wifi",*NAME="networks.v1";
  int parent_{-1},directory_{-1},lock_{-1};
  bool attempted_{false},ready_{false},loaded_{false},present_{false},consumed_{false},uncertain_{false};
  bool lease_busy_{false};
  bool writable_{false};
  struct stat directory_identity_{},last_identity_{};
  std::string epoch_,decision_,error_;detail::Bytes last_record_;
  bool fail_(const char *code){error_=code;return false;}
  Commit refused_(const char *code){fail_(code);return Commit::REFUSED;}
  Commit uncertain_result_(const char *code){uncertain_=true;fail_(code);return Commit::UNCERTAIN;}
  static bool private_directory_(const struct stat &s) {
    return S_ISDIR(s.st_mode) && s.st_uid==0 && (s.st_mode&07777)==0700;
  }
  bool same_directory_()const {
    struct stat named{},parent{};
    return parent_>=0 && !::fstat(parent_,&parent) && private_directory_(parent) &&
      !::fstatat(parent_,DIRECTORY,&named,AT_SYMLINK_NOFOLLOW) && private_directory_(named) &&
      named.st_dev==directory_identity_.st_dev && named.st_ino==directory_identity_.st_ino;
  }
  static bool same_file_(const struct stat &a,const struct stat &b) {
    return a.st_dev==b.st_dev && a.st_ino==b.st_ino && a.st_size==b.st_size &&
      a.st_mtim.tv_sec==b.st_mtim.tv_sec && a.st_mtim.tv_nsec==b.st_mtim.tv_nsec &&
      a.st_ctim.tv_sec==b.st_ctim.tv_sec && a.st_ctim.tv_nsec==b.st_ctim.tv_nsec;
  }
  bool private_file_(int fd,struct stat *out)const {
    struct stat s{};
    if(::fstat(fd,&s) || !S_ISREG(s.st_mode) || s.st_uid!=0 || (s.st_mode&07777)!=0600 ||
        s.st_nlink!=1 || s.st_dev!=directory_identity_.st_dev)return false;
    if(out)*out=s;
    return true;
  }
  int read_(detail::Bytes &bytes,struct stat &identity)const {
    if(!same_directory_())return -1;
    const int file=::openat(directory_,NAME,O_RDONLY|O_NONBLOCK|O_NOFOLLOW|O_CLOEXEC);
    if(file<0)return errno==ENOENT?0:-1;
    struct stat before{},after{};
    if(!private_file_(file,&before) || before.st_size<29 || before.st_size>ssize_t(detail::MAX_RECORD)) {
      ::close(file);return -1;
    }
    detail::Bytes selected;selected.value.resize(size_t(before.st_size));size_t at=0;bool okay=true;
    while(at<selected.value.size()) {
      const auto count=::read(file,&selected.value[at],selected.value.size()-at);
      if(count<0 && errno==EINTR)continue;
      if(count<=0){okay=false;break;}at+=size_t(count);
    }
    // These are deliberately real fsync calls, not fault-hook calls used for
    // the publishing path. Reconciliation has its own read/sync failure result.
    okay=okay && !::fstat(file,&after) && same_file_(before,after) && !::fsync(file);
    ::close(file);struct stat named{};
    okay=okay && same_directory_() && !::fstatat(directory_,NAME,&named,AT_SYMLINK_NOFOLLOW) &&
      same_file_(after,named) && !::fsync(directory_);
    if(!okay)return -1;
    bytes.value.swap(selected.value);identity=after;return 1;
  }
  void unlink_own_(const std::string &name,const struct stat &created)const {
    struct stat actual{};
    if(same_directory_() && !::fstatat(directory_,name.c_str(),&actual,AT_SYMLINK_NOFOLLOW) &&
        actual.st_dev==created.st_dev && actual.st_ino==created.st_ino)
      (void)::unlinkat(directory_,name.c_str(),0);
    // Old crash remnants / a substituted inode are evidence, not garbage to sweep.
  }
};
} // namespace cgs1_wifi_private
