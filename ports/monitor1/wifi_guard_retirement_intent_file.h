#pragma once

// Fixed private tmpfs transport for the METADATA retirement intent. Publishing
// it is not permission to clean a file or select a network. The later native
// adapter still owns the full/native lease and canonical Store decision lock;
// each guardian must call flush_verified() before its RETIRING acknowledgement.
// No caller path, credential getter, network command or deletion exists here.
#include "wifi_guard_retirement_record.h"
#include "network_preflight.h"

namespace cgs1_wifi_retirement {
enum class IntentState {MISSING,MATCH,CONFLICT,UNREADABLE};
enum class IntentWrite {ACK,REFUSED,UNCERTAIN,CONSUMED};
struct IntentPosix {
  static ssize_t write(int fd,const void*p,size_t n){return ::write(fd,p,n);}
  static int sync(int fd){return ::fsync(fd);}
  static int rename(int dir,const char*from,const char*to){return ::renameat(dir,from,dir,to);}
};
template<class IO=IntentPosix>class IntentFile {
 public:
  IntentFile()=default;IntentFile(const IntentFile&)=delete;IntentFile&operator=(const IntentFile&)=delete;
  ~IntentFile(){if(runtime_>=0)::close(runtime_);}
  bool open(int runtime,const Intent&expected,const cgs1_wifi_guard::Stamp*published=nullptr) {
    if(open_attempted_)return false;
    open_attempted_=true;
    if(!valid(expected) || ::geteuid()!=0)return false;
    expected_=expected;root_="/tmp/qingping-full-"+expected.full_session;
    name_="wifi-retirement-"+expected.transaction+".v1";
    runtime_=::fcntl(runtime,F_DUPFD_CLOEXEC,3);
    if(runtime_<0 || ::fstat(runtime_,&root_identity_))return false;
    if(published) {
      if(!published->inode || published->device!=uint64_t(root_identity_.st_dev) || published->size!=INTENT_BYTES ||
          published->mtime_nsec>=1000000000 || published->ctime_nsec>=1000000000)return false;
      pinned_=true;pinned_stamp_=*published;
    }
    return current_root_();
  }
  IntentState inspect(cgs1_wifi_guard::Stamp*stamp=nullptr)const {
    if(!current_root_())return IntentState::UNREADABLE;
    const int fd=::openat(runtime_,name_.c_str(),O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC);
    if(fd<0)return errno==ENOENT?IntentState::MISSING:IntentState::UNREADABLE;
    struct stat before{},after{},named{};cgs1_wifi_private::detail::Bytes bytes;bytes.value.resize(INTENT_BYTES);
    bool okay=!::fstat(fd,&before) && regular_(before,0400,INTENT_BYTES);size_t at=0;
    while(okay && at<bytes.value.size()) {
      const auto n=::read(fd,&bytes.value[at],bytes.value.size()-at);
      if(n<0 && errno==EINTR)continue;
      if(n<=0)okay=false;else at+=size_t(n);
    }
    okay=okay && !::fstat(fd,&after) && same_(before,after);const bool closed=!::close(fd);
    if(!okay || !closed || !current_root_() || ::fstatat(runtime_,name_.c_str(),&named,AT_SYMLINK_NOFOLLOW) ||
        !regular_(named,0400,INTENT_BYTES) || !same_(before,named))return IntentState::UNREADABLE;
    Intent decoded;cgs1_wifi_private::detail::Bytes expected;
    if(!decode(bytes,decoded) || !encode(expected_,expected) || bytes.value!=expected.value)return IntentState::CONFLICT;
    const auto current=stamp_(named);
    if(pinned_ && !(current==pinned_stamp_))return IntentState::CONFLICT;
    pinned_=true;pinned_stamp_=current;
    if(stamp)*stamp=current;
    return IntentState::MATCH;
  }
  bool flush_verified()const {
    // A visible rename whose directory fsync reply was lost is reconciled
    // without rewriting its bytes. Both guardian ACK producers must establish
    // this barrier independently before native may prune old recovery files.
    cgs1_wifi_guard::Stamp before,after;
    if(inspect(&before)!=IntentState::MATCH)return false;
    const int fd=::openat(runtime_,name_.c_str(),O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC);
    if(fd<0)return false;
    struct stat held{};const bool file_ok=!::fstat(fd,&held) && regular_(held,0400,INTENT_BYTES) && stamp_(held)==before;
    const bool synced=file_ok && !IO::sync(fd);const bool closed=!::close(fd);
    return synced && closed && !IO::sync(runtime_) && inspect(&after)==IntentState::MATCH && after==before;
  }
  bool verify_baseline(const cgs1_wifi_guard::Plan&snapshot)const {
    // Before a FIRST RETIRING ACK, each guardian checks all seven originals
    // against its own cached transaction, rather than trusting native's ACK.
    return inspect()==IntentState::MATCH && baseline_(snapshot);
  }
  static bool read_for_plan(int runtime,const cgs1_wifi_guard::Plan&plan,
      const cgs1_wifi_guard::Stamp&plan_stamp,int candidate,Intent&out,cgs1_wifi_guard::Stamp&identity) {
    if(!cgs1_wifi_guard::valid(plan) || !cgs1_wifi_guard::valid(plan_stamp))return false;
    const auto name="wifi-retirement-"+plan.decision.transaction+".v1";
    const int fd=::openat(runtime,name.c_str(),O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC);
    if(fd<0)return false;
    struct stat before{},after{};cgs1_wifi_private::detail::Bytes bytes;bytes.value.resize(INTENT_BYTES);
    bool okay=!::fstat(fd,&before) && S_ISREG(before.st_mode) && before.st_size==ssize_t(INTENT_BYTES);size_t at=0;
    while(okay && at<bytes.value.size()) {
      const auto n=::read(fd,&bytes.value[at],bytes.value.size()-at);
      if(n<0 && errno==EINTR)continue;
      if(n<=0)okay=false;else at+=size_t(n);
    }
    okay=okay && !::fstat(fd,&after) && same_(before,after);const bool closed=!::close(fd);
    Intent decoded;
    if(!okay || !closed || !decode(bytes,decoded) || !for_plan(decoded,plan,plan_stamp,candidate,decoded.peers))return false;
    const auto stamp=stamp_(before);IntentFile verified;
    // Untrusted decoded bytes are not released until the normal canonical
    // root/boot/mode/nlink/named-inode checks have accepted that exact file.
    if(!verified.open(runtime,decoded,&stamp) || verified.inspect()!=IntentState::MATCH)return false;
    out=std::move(decoded);identity=stamp;return true;
  }
  IntentWrite publish(const cgs1_wifi_guard::Plan&snapshot) {
    if(publish_attempted_)return IntentWrite::CONSUMED;
    publish_attempted_=true;
    if(!native_() || !current_root_() || !for_plan(expected_,snapshot,expected_.plan,expected_.candidate,expected_.peers))return IntentWrite::REFUSED;
    const int lock=::openat(runtime_,"wifi-journal.lock",O_RDWR|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC);
    if(lock<0)return IntentWrite::REFUSED;
    struct Close {int fd;~Close(){::close(fd);}}held{lock};struct stat lock_info{},lock_entry{};
    if(::fstat(lock,&lock_info) || !regular_(lock_info,0600,0) || ::flock(lock,LOCK_EX|LOCK_NB) ||
        ::fstatat(runtime_,"wifi-journal.lock",&lock_entry,AT_SYMLINK_NOFOLLOW) || !same_(lock_info,lock_entry))return IntentWrite::REFUSED;
    const auto existing=inspect();
    if(existing==IntentState::MATCH)return flush_verified()?IntentWrite::ACK:IntentWrite::UNCERTAIN;
    if(existing!=IntentState::MISSING || !baseline_(snapshot))return IntentWrite::REFUSED;
    cgs1_wifi_private::detail::Bytes bytes;if(!encode(expected_,bytes))return IntentWrite::REFUSED;
    const auto temporary=".wifi-retirement-"+expected_.transaction+"-"+std::to_string(::getpid());
    const int fd=::openat(runtime_,temporary.c_str(),O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);
    if(fd<0)return IntentWrite::REFUSED;
    struct stat created{};bool okay=!::fstat(fd,&created) && regular_(created,0600,0);size_t at=0;
    while(okay && at<bytes.value.size()) {
      const auto n=IO::write(fd,bytes.value.data()+at,bytes.value.size()-at);
      if(n<0 && errno==EINTR)continue;
      if(n<=0 || size_t(n)>bytes.value.size()-at)okay=false;else at+=size_t(n);
    }
    okay=okay && !::fchmod(fd,0400) && !IO::sync(fd);const bool closed=!::close(fd);
    // Partial/uncertain temporary files are retained for outcome review. No
    // repair, cleanup, overwrite or automatic second publication is attempted.
    if(!okay || !closed)return IntentWrite::UNCERTAIN;
    if(!native_() || !baseline_(snapshot) || inspect()!=IntentState::MISSING)return IntentWrite::REFUSED;
    if(IO::rename(runtime_,temporary.c_str(),name_.c_str()))return IntentWrite::UNCERTAIN;
    if(IO::sync(runtime_))return IntentWrite::UNCERTAIN;
    cgs1_wifi_guard::Stamp installed;
    return inspect(&installed)==IntentState::MATCH && installed.device==uint64_t(created.st_dev) &&
      installed.inode==uint64_t(created.st_ino)?IntentWrite::ACK:IntentWrite::UNCERTAIN;
  }
 private:
  int runtime_{-1};bool open_attempted_{false},publish_attempted_{false};Intent expected_;
  mutable bool pinned_{false};mutable cgs1_wifi_guard::Stamp pinned_stamp_;
  std::string root_,name_;struct stat root_identity_{};
  static cgs1_wifi_guard::Stamp stamp_(const struct stat&s) {
    return {uint64_t(s.st_dev),uint64_t(s.st_ino),uint64_t(s.st_size),uint64_t(s.st_mtim.tv_sec),uint64_t(s.st_mtim.tv_nsec),
      uint64_t(s.st_ctim.tv_sec),uint64_t(s.st_ctim.tv_nsec)};
  }
  static bool same_(const struct stat&a,const struct stat&b){return stamp_(a)==stamp_(b) && a.st_nlink==b.st_nlink && a.st_mode==b.st_mode && a.st_uid==b.st_uid;}
  bool regular_(const struct stat&s,mode_t mode,size_t size)const {
    return S_ISREG(s.st_mode) && s.st_uid==0 && (s.st_mode&07777)==mode && s.st_nlink==1 &&
      s.st_dev==root_identity_.st_dev && s.st_size==ssize_t(size);
  }
  bool current_root_()const {
    if(runtime_<0)return false;
    struct stat held{},named{};struct statfs fs{};
    return !::fstat(runtime_,&held) && S_ISDIR(held.st_mode) && held.st_uid==0 && (held.st_mode&07777)==0700 &&
      held.st_dev==root_identity_.st_dev && held.st_ino==root_identity_.st_ino &&
      !::fstatfs(runtime_,&fs) && fs.f_type==0x01021994 && !::lstat(root_.c_str(),&named) &&
      S_ISDIR(named.st_mode) && named.st_dev==held.st_dev && named.st_ino==held.st_ino &&
      cgs1_net_trial::read_link("/proc/self/fd/"+std::to_string(runtime_))==root_ &&
      cgs1_net_trial::read_small("/proc/sys/kernel/random/boot_id",64)==expected_.boot_id+"\n";
  }
  bool native_()const {
    const auto self=cgs1_net_trial::process_identity(::getpid());
    return self.running() && self.executable==root_+"/native/program";
  }
  bool peers_()const {
    for(const auto&peer:expected_.peers) {
      const auto actual=cgs1_net_trial::process_identity(peer.pid);
      if(!actual.running() || actual.start!=peer.start || actual.executable!=root_+"/guardian/program")return false;
    }
    return true;
  }
  bool baseline_(const cgs1_wifi_guard::Plan&snapshot)const {
    if(!current_root_() || !peers_() || !for_plan(expected_,snapshot,expected_.plan,expected_.candidate,expected_.peers))return false;
    // Only journal metadata is read here. Its sensitive payload was validated
    // by the caller's sealed snapshot; this layer never reads/exports keys.
    struct stat journal{};
    if(::fstatat(runtime_,"wifi-transaction.v1",&journal,AT_SYMLINK_NOFOLLOW) ||
        !regular_(journal,0400,expected_.plan.size) || !(stamp_(journal)==expected_.plan))return false;
    for(size_t n=0;n<OLD_FILES;++n) {
      const auto name=old_name(OldFile(n));const int fd=::openat(runtime_,name,O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC);
      if(fd<0)return false;
      struct stat before{},after{},named{};cgs1_wifi_private::detail::Bytes bytes;bytes.value.resize(118);
      const bool read=!::fstat(fd,&before) && regular_(before,0400,118) && stamp_(before)==expected_.old_files[n] &&
        ::read(fd,&bytes.value[0],bytes.value.size())==118 && !::fstat(fd,&after) && same_(before,after);
      const bool closed=!::close(fd);cgs1_wifi_guard::Record record;
      if(!read || !closed || ::fstatat(runtime_,name,&named,AT_SYMLINK_NOFOLLOW) || !same_(before,named) || !cgs1_wifi_guard::decode(bytes,record))return false;
      if(!n) {if(!cgs1_wifi_guard::binding_for(record,snapshot,expected_.plan) || record.candidate!=expected_.candidate)return false;}
      else {
        const size_t role=(n-1)%2;const auto stage=n<=2?cgs1_wifi_guard::Stage::ARMED:n<=4?cgs1_wifi_guard::Stage::BOUND:cgs1_wifi_guard::Stage::COMMITTED;
        if(!cgs1_wifi_guard::acknowledgement_for(record,snapshot,expected_.plan,role?cgs1_wifi_guard::Role::BACKUP:cgs1_wifi_guard::Role::PRIMARY,
            stage,expected_.peers[role].pid,expected_.peers[role].start,stage==cgs1_wifi_guard::Stage::ARMED?-1:expected_.candidate))return false;
      }
    }
    return current_root_() && peers_();
  }
};
} // namespace cgs1_wifi_retirement
