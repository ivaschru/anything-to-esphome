#pragma once

// Private, bounded network-transaction journal for the existing two full-mode
// guardians. This codec/publication layer has NO device/socket operations.
// Do not enable candidate preparation until both guardian loops consume and
// acknowledge this journal and recovery checks it BEFORE vendor CONT.
//
// Unlike FullPlan, this later touchscreen transaction cannot be inherited at
// process startup. Publish a complete 0400 inode once under a held root0700
// tmpfs directory FD. Readers verify canonical bytes/CRC AND inode identity;
// CRC is corruption detection, not authority against another root process.
// Credentials stay only in the private local journal, never an API/log/report.
#include "wifi_commit_decision.h"
#include "wifi_profile_prepare.h"
#include <sys/vfs.h>

namespace cgs1_wifi_guard {
inline constexpr size_t MAX_PLAN=8192;
struct Stamp {
  uint64_t device{0},inode{0},size{0},mtime_sec{0},mtime_nsec{0},ctime_sec{0},ctime_nsec{0};
};
inline bool operator==(const Stamp &a,const Stamp &b) {
  return a.device==b.device && a.inode==b.inode && a.size==b.size && a.mtime_sec==b.mtime_sec &&
    a.mtime_nsec==b.mtime_nsec && a.ctime_sec==b.ctime_sec && a.ctime_nsec==b.ctime_nsec;
}
inline bool valid(const Stamp &s) {
  return s.inode && s.size>=120 && s.size<=MAX_PLAN && s.mtime_nsec<1000000000 && s.ctime_nsec<1000000000;
}
struct Plan {
  std::string full_session,boot_id;
  uint64_t created_ms{0},deadline_ms{0};
  uint32_t daemon_pid{0};uint64_t daemon_start{0},socket_inode{0};
  std::vector<cgs1_wifi::SavedProfile> original;
  cgs1_wifi_prepare::CatalogMode catalog_mode{cgs1_wifi_prepare::CatalogMode::CONNECTED};
  cgs1_wifi_decision::Plan decision;
};
inline bool valid_boot(const std::string &s) {
  if(s.size()!=36)return false;
  for(size_t i=0;i<s.size();++i) {
    if(i==8 || i==13 || i==18 || i==23){if(s[i]!='-')return false;}
    else if(!((s[i]>='0' && s[i]<='9') || (s[i]>='a' && s[i]<='f')))return false;
  }
  return true;
}
inline bool valid(const Plan &p) {
  if(p.full_session.size()!=16 || !cgs1_checkpoint::valid_epoch(p.full_session.c_str()) || !valid_boot(p.boot_id) ||
      !p.created_ms || p.deadline_ms<p.created_ms || p.deadline_ms-p.created_ms<10000 ||
      p.deadline_ms-p.created_ms>120000 || p.daemon_pid<2 || p.daemon_pid>2147483647 ||
      !p.daemon_start || !p.socket_inode || !cgs1_wifi_decision::valid(p.decision) ||
      p.decision.desired.empty() || !cgs1_wifi_prepare::supported_catalog(p.original,p.catalog_mode))return false;
  for(size_t i=0;i<p.original.size();++i) {
    const auto &profile=p.original[i];
    if(profile.id<0 || profile.id>1000000 || profile.ssid_text.size()>128 ||
        (profile.bssid!="any" && !cgs1_wifi::mac_address(profile.bssid)) ||
        (profile.current && profile.disabled))return false;
    for(unsigned char c:profile.ssid_text)if(c<32 || c==127)return false;
    // Restrict to the exact ordinary flags admitted by this first adapter.
    // Unknown/P2P/TEMP-DISABLED profiles are never normalized into a plausible
    // baseline. A repeated ID likewise cannot identify an exact rollback set.
    const auto flags=profile.current?"[CURRENT]":profile.disabled?"[DISABLED]":"";
    if(profile.flags!=flags)return false;
    for(size_t j=0;j<i;++j)if(p.original[j].id==profile.id)return false;
  }
  return true;
}
namespace detail {
using cgs1_wifi_private::detail::Bytes;
inline void number(std::string &s,uint64_t n,unsigned width) {
  for(unsigned i=0;i<width;++i)s+=char(n>>(i*8));
}
struct Cursor {
  const std::string &s;size_t at{0};
  bool text(size_t size,std::string &out) {
    if(at>s.size() || size>s.size()-at)return false;
    out.assign(s.data()+at,size);at+=size;return true;
  }
  bool number(unsigned width,uint64_t &out) {
    if(width>8 || at>s.size() || width>s.size()-at)return false;
    out=0;for(unsigned i=0;i<width;++i)out|=uint64_t(uint8_t(s[at++]))<<(i*8);
    return true;
  }
  bool sized(unsigned width,std::string &out,size_t maximum) {
    uint64_t size=0;return number(width,size) && size<=maximum && text(size_t(size),out);
  }
};
inline bool encode(const Plan &p,Bytes &out) {
  if(!valid(p))return false;
  auto &s=out.value;cgs1_wifi_private::erase_bytes(s.empty()?nullptr:&s[0],s.size());
  // V2 binds the baseline semantics into the canonical/CRC-protected bytes.
  // Reject old/unknown encodings rather than guessing whether a configured
  // CURRENT row represented a real association. Runtime filename stays fixed;
  // each full session has its own private tmpfs directory and exact inode.
  s.clear();s.reserve(MAX_PLAN);s="CGS1WJ2\n";s+=p.full_session;s+=p.boot_id;
  number(s,p.created_ms,8);number(s,p.deadline_ms,8);number(s,p.daemon_pid,4);
  number(s,p.daemon_start,8);number(s,p.socket_inode,8);s+=p.decision.transaction;
  number(s,unsigned(p.catalog_mode),1);number(s,p.original.size(),1);
  for(const auto &profile:p.original) {
    number(s,uint32_t(profile.id),4);number(s,profile.ssid_text.size(),1);s+=profile.ssid_text;
    number(s,profile.bssid.size(),1);s+=profile.bssid;
    number(s,(profile.current?1:0)|(profile.disabled?2:0),1);
  }
  Bytes before,desired;
  if(p.decision.before.present && !cgs1_wifi_private::detail::encode(
      p.decision.before.decision_epoch.c_str(),p.decision.before.networks,before))return false;
  if(!cgs1_wifi_private::detail::encode(p.decision.transaction.c_str(),p.decision.desired,desired))return false;
  number(s,before.value.size(),2);s+=before.value;number(s,desired.value.size(),2);s+=desired.value;
  if(s.size()>MAX_PLAN-4)return false;
  number(s,cgs1_wifi_private::detail::crc32(s,s.size()),4);return true;
}
inline bool decode(const Bytes &encoded,Plan &out) {
  const auto &s=encoded.value;
  if(s.size()<120 || s.size()>MAX_PLAN || s.compare(0,8,"CGS1WJ2\n"))return false;
  Cursor crc{s,s.size()-4};uint64_t checksum=0;
  if(!crc.number(4,checksum) || checksum!=cgs1_wifi_private::detail::crc32(s,s.size()-4))return false;
  Plan p;Cursor input{s,8};uint64_t pid=0,count=0,mode=0;
  if(!input.text(16,p.full_session) || !input.text(36,p.boot_id) || !input.number(8,p.created_ms) ||
      !input.number(8,p.deadline_ms) || !input.number(4,pid) || !input.number(8,p.daemon_start) ||
      !input.number(8,p.socket_inode) || !input.text(16,p.decision.transaction) ||
      !input.number(1,mode) || mode>2 || !input.number(1,count) || count>=32)return false;
  p.catalog_mode=static_cast<cgs1_wifi_prepare::CatalogMode>(mode);
  p.daemon_pid=uint32_t(pid);p.original.reserve(size_t(count));
  for(size_t i=0;i<count;++i) {
    cgs1_wifi::SavedProfile profile;uint64_t id=0,flags=0;
    if(!input.number(4,id) || id>1000000 || !input.sized(1,profile.ssid_text,128) ||
        !input.sized(1,profile.bssid,17) || !input.number(1,flags) || flags>2)return false;
    profile.id=int(id);profile.current=flags==1;profile.disabled=flags==2;
    profile.flags=profile.current?"[CURRENT]":profile.disabled?"[DISABLED]":"";
    p.original.push_back(profile);
  }
  Bytes before,desired;
  if(!input.sized(2,before.value,cgs1_wifi_private::detail::MAX_RECORD) ||
      !input.sized(2,desired.value,cgs1_wifi_private::detail::MAX_RECORD) || input.at!=s.size()-4)return false;
  p.decision.before.present=!before.value.empty();std::string desired_epoch;
  if((p.decision.before.present && !cgs1_wifi_private::detail::decode(before,
      p.decision.before.decision_epoch,p.decision.before.networks)) ||
      !cgs1_wifi_private::detail::decode(desired,desired_epoch,p.decision.desired) ||
      desired_epoch!=p.decision.transaction || !valid(p))return false;
  Bytes canonical;
  if(!encode(p,canonical) || canonical.value!=s)return false;
  out=std::move(p);return true;
}
} // namespace detail

class Journal {
 public:
  Journal()=default;Journal(const Journal &)=delete;Journal &operator=(const Journal &)=delete;
  ~Journal(){if(directory_>=0)::close(directory_);}
  bool open(int held_directory) {
    if(attempted_)return false;
    attempted_=true;struct stat dir{};struct statfs fs{};
    if(held_directory<0 || ::fstat(held_directory,&dir) || !S_ISDIR(dir.st_mode) || dir.st_uid!=0 ||
        (dir.st_mode&07777)!=0700 || ::fstatfs(held_directory,&fs) || fs.f_type!=0x01021994)return false;
    directory_=::fcntl(held_directory,F_DUPFD_CLOEXEC,3);device_=dir.st_dev;return directory_>=0;
  }
  bool publish(const Plan &plan) {
    if(directory_<0 || published_attempt_)return false;
    published_attempt_=true;detail::Bytes record;
    if(!detail::encode(plan,record) || !directory_private_())return false;
    const int writer_lock=::openat(directory_,"wifi-journal.lock",O_RDWR|O_CREAT|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC,0600);
    if(writer_lock<0)return false;
    struct Close {int fd;~Close(){::close(fd);}} held_lock{writer_lock};
    struct stat lock_identity{};
    if(::fstat(writer_lock,&lock_identity) || !regular_(lock_identity,0600) ||
        ::flock(writer_lock,LOCK_EX|LOCK_NB))return false;
    struct stat existing{};
    if(!::fstatat(directory_,NAME,&existing,AT_SYMLINK_NOFOLLOW) || errno!=ENOENT)return false;
    const auto temporary=".wifi-plan-"+plan.decision.transaction+"-"+std::to_string(::getpid());
    const int file=::openat(directory_,temporary.c_str(),O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);
    if(file<0)return false;
    struct stat created{};bool okay=!::fstat(file,&created) && regular_(created,0600);size_t at=0;
    while(okay && at<record.value.size()) {
      const auto n=::write(file,record.value.data()+at,record.value.size()-at);
      if(n<0 && errno==EINTR)continue;
      if(n<=0)okay=false;else at+=size_t(n);
    }
    okay=okay && !::fchmod(file,0400) && !::fsync(file);const bool closed=::close(file)==0;
    okay=okay && closed && directory_private_();
    // All cooperating publishers share the fixed private flock. Recheck the
    // absent destination immediately before a single rename. Unlike a hard
    // link/unlink pair, this has no crash window leaving an unreadable nlink2
    // plan. A hostile root race ignoring the lock is outside this boundary.
    okay=okay && ::fstatat(directory_,NAME,&existing,AT_SYMLINK_NOFOLLOW)<0 && errno==ENOENT;
    const bool renamed=okay && !::renameat(directory_,temporary.c_str(),directory_,NAME);
    if(renamed) {
      if(::fsync(directory_))return false; // Observable outcome: fresh read, never replay.
      struct stat installed{};Plan observed;detail::Bytes verified;
      return !::fstatat(directory_,NAME,&installed,AT_SYMLINK_NOFOLLOW) && regular_(installed,0400) &&
        installed.st_dev==created.st_dev && installed.st_ino==created.st_ino && read(observed) &&
        detail::encode(observed,verified) && verified.value==record.value;
    }
    struct stat temporary_now{};
    if(::fstatat(directory_,temporary.c_str(),&temporary_now,AT_SYMLINK_NOFOLLOW) ||
        temporary_now.st_dev!=created.st_dev || temporary_now.st_ino!=created.st_ino)return false;
    (void)::unlinkat(directory_,temporary.c_str(),0);return false;
  }
  bool read(Plan &out,Stamp *stamp=nullptr)const {
    if(directory_<0 || !directory_private_())return false;
    const int file=::openat(directory_,NAME,O_RDONLY|O_NONBLOCK|O_NOFOLLOW|O_CLOEXEC);
    if(file<0)return false;
    struct stat before{},after{},named{};
    if(::fstat(file,&before) || !regular_(before,0400) || before.st_size<120 || before.st_size>ssize_t(MAX_PLAN)) {
      ::close(file);return false;
    }
    detail::Bytes record;record.value.resize(size_t(before.st_size));size_t at=0;bool okay=true;
    while(at<record.value.size()) {
      const auto n=::read(file,&record.value[at],record.value.size()-at);
      if(n<0 && errno==EINTR)continue;
      if(n<=0){okay=false;break;}at+=size_t(n);
    }
    okay=okay && !::fstat(file,&after) && same_(before,after);::close(file);
    if(!okay || !directory_private_() || ::fstatat(directory_,NAME,&named,AT_SYMLINK_NOFOLLOW) ||
        !regular_(named,0400) || !same_(named,after) || !detail::decode(record,out))return false;
    if(stamp)*stamp={uint64_t(named.st_dev),uint64_t(named.st_ino),uint64_t(named.st_size),
      uint64_t(named.st_mtim.tv_sec),uint64_t(named.st_mtim.tv_nsec),
      uint64_t(named.st_ctim.tv_sec),uint64_t(named.st_ctim.tv_nsec)};
    return true;
  }
 private:
  inline static constexpr const char *NAME="wifi-transaction.v1";
  int directory_{-1};dev_t device_{};bool attempted_{false},published_attempt_{false};
  bool directory_private_()const {
    struct stat s{};return !::fstat(directory_,&s) && S_ISDIR(s.st_mode) && s.st_uid==0 &&
      (s.st_mode&07777)==0700 && s.st_dev==device_;
  }
  bool regular_(const struct stat &s,mode_t mode)const {
    return S_ISREG(s.st_mode) && s.st_uid==0 && (s.st_mode&07777)==mode && s.st_nlink==1 && s.st_dev==device_;
  }
  static bool same_(const struct stat &a,const struct stat &b) {
    return a.st_dev==b.st_dev && a.st_ino==b.st_ino && a.st_size==b.st_size && a.st_nlink==b.st_nlink &&
      a.st_mtim.tv_sec==b.st_mtim.tv_sec && a.st_mtim.tv_nsec==b.st_mtim.tv_nsec &&
      a.st_ctim.tv_sec==b.st_ctim.tv_sec && a.st_ctim.tv_nsec==b.st_ctim.tv_nsec;
  }
};
} // namespace cgs1_wifi_guard
