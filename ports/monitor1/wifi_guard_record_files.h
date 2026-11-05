#pragma once

// Fixed private files for the Wi-Fi guardian handshake. This is a local
// transport layer, not permission to select a network. The full runtime must
// supply already verified peer/native identities and still own hardware/WPA.
#include "wifi_guard_records.h"
#include "network_preflight.h"
#include <ctime>

namespace cgs1_wifi_guard {
inline uint64_t monotonic_ms() {
  timespec t{};
  if(::clock_gettime(CLOCK_MONOTONIC,&t) || t.tv_sec<0 || uint64_t(t.tv_sec)>(UINT64_MAX-999)/1000)return 0;
  return uint64_t(t.tv_sec)*1000+uint64_t(t.tv_nsec)/1000000;
}
class RecordFiles {
 public:
  using Peer=cgs1_net_trial::ProcessIdentity;
  RecordFiles()=default;RecordFiles(const RecordFiles &)=delete;RecordFiles &operator=(const RecordFiles &)=delete;
  ~RecordFiles(){if(directory_>=0)::close(directory_);}
  bool open(int held,const Plan &plan,const Stamp &stamp) {
    if(attempted_)return false;
    attempted_=true;struct stat dir{};struct statfs fs{};
    if(!valid(plan) || !valid(stamp) || ::fstat(held,&dir) || !S_ISDIR(dir.st_mode) ||
        dir.st_uid!=0 || (dir.st_mode&07777)!=0700 || ::fstatfs(held,&fs) || fs.f_type!=0x01021994)return false;
    directory_=::fcntl(held,F_DUPFD_CLOEXEC,3);device_=dir.st_dev;
    full_=plan.full_session;transaction_=plan.decision.transaction;stamp_=stamp;
    Plan observed;return directory_>=0 && current_(observed,false);
  }
  bool bind_candidate(int candidate,const Peer &native,const std::array<Peer,2> &guardians) {
    publication_busy_=false;
    Plan p;
    if(!sender_(native) || !both_ready(Stage::ARMED,guardians) || !current_(p,true))return false;
    Record r;r.full_session=full_;r.transaction=transaction_;r.plan=stamp_;r.candidate=candidate;
    return binding_for(r,p,stamp_) && publish_(File::CANDIDATE,r);
  }
  bool read_candidate(int &candidate)const {
    candidate=-1;Plan p;Record r;
    // Recovery must also be able to read an expired binding; a read alone does
    // not authorize another mutation or extend its independent deadline.
    if(!current_(p,false) || read_(File::CANDIDATE,r)!=Read::PRESENT || !binding_for(r,p,stamp_))return false;
    candidate=r.candidate;return true;
  }
  bool acknowledge(Role role,Stage stage,const Peer &self,int candidate=-1) {
    publication_busy_=false;
    Plan p;
    const bool timed=stage!=Stage::COMMITTED;
    if(!sender_(self) || !current_(p,timed))return false;
    if(stage==Stage::BOUND || stage==Stage::COMMITTED) {
      int bound=-1;Record armed;
      const Stage earlier=stage==Stage::COMMITTED?Stage::BOUND:Stage::ARMED;
      const int prior_candidate=earlier==Stage::BOUND?candidate:-1;
      if(!read_candidate(bound) || bound!=candidate || read_(file_(role,earlier),armed)!=Read::PRESENT ||
          !acknowledgement_for(armed,p,stamp_,role,earlier,uint32_t(self.pid),self.start,prior_candidate))return false;
    }
    Record r;r.full_session=full_;r.transaction=transaction_;r.plan=stamp_;r.candidate=candidate;
    r.role=uint8_t(role);r.stage=uint8_t(stage);r.pid=uint32_t(self.pid);r.start=self.start;
    return acknowledgement_for(r,p,stamp_,role,stage,r.pid,r.start,candidate) && publish_(file_(role,stage),r);
  }
  // True ONLY when flock refused before any temporary file/write/rename.
  // A caller may wait under its unchanged scope/deadline, then obtain fresh
  // admission. False after every other refusal or uncertain publication.
  bool publication_busy()const{return publication_busy_;}
  bool both_ready(Stage stage,const std::array<Peer,2> &peers)const {
    Plan p;
    const bool timed=stage!=Stage::COMMITTED;
    if(peers[0].pid==peers[1].pid || !current_(p,timed))return false;
    int candidate=-1;
    if((stage==Stage::BOUND || stage==Stage::COMMITTED) && !read_candidate(candidate))return false;
    for(unsigned i=0;i<2;++i) {
      const Role role=i==0?Role::PRIMARY:Role::BACKUP;Record ack;
      if(!alive_(peers[i]) || read_(file_(role,stage),ack)!=Read::PRESENT ||
          !acknowledgement_for(ack,p,stamp_,role,stage,uint32_t(peers[i].pid),peers[i].start,candidate))return false;
    }
    // Two individually valid old snapshots do not make a live pair. Recheck
    // both peers and the deadline after reading both acknowledgements.
    return alive_(peers[0]) && alive_(peers[1]) && current_(p,timed);
  }
 private:
  enum class File {CANDIDATE,PRIMARY_ARMED,BACKUP_ARMED,PRIMARY_BOUND,BACKUP_BOUND,PRIMARY_COMMITTED,BACKUP_COMMITTED,INVALID};
  enum class Read {MISSING,PRESENT,ERROR};
  int directory_{-1};dev_t device_{};bool attempted_{false};Stamp stamp_;
  std::string full_,transaction_;
  bool publication_busy_{false};
  static const char *name_(File f) {
    switch(f) {
      case File::CANDIDATE:return "wifi-candidate.v1";
      case File::PRIMARY_ARMED:return "wifi-primary-armed.v1";
      case File::BACKUP_ARMED:return "wifi-backup-armed.v1";
      case File::PRIMARY_BOUND:return "wifi-primary-bound.v1";
      case File::BACKUP_BOUND:return "wifi-backup-bound.v1";
      case File::PRIMARY_COMMITTED:return "wifi-primary-committed.v1";
      case File::BACKUP_COMMITTED:return "wifi-backup-committed.v1";
      default:return nullptr;
    }
  }
  static File file_(Role role,Stage stage) {
    if(role==Role::PRIMARY && stage==Stage::ARMED)return File::PRIMARY_ARMED;
    if(role==Role::BACKUP && stage==Stage::ARMED)return File::BACKUP_ARMED;
    if(role==Role::PRIMARY && stage==Stage::BOUND)return File::PRIMARY_BOUND;
    if(role==Role::BACKUP && stage==Stage::BOUND)return File::BACKUP_BOUND;
    if(role==Role::PRIMARY && stage==Stage::COMMITTED)return File::PRIMARY_COMMITTED;
    if(role==Role::BACKUP && stage==Stage::COMMITTED)return File::BACKUP_COMMITTED;
    return File::INVALID;
  }
  static bool shape_(File f,const Record &r) {
    return valid(r) && (f==File::CANDIDATE?!r.role:
      f==file_(Role(r.role),Stage(r.stage)));
  }
  static bool alive_(const Peer &expected) {
    if(expected.pid<=1 || !expected.start || expected.executable.empty())return false;
    const auto now=cgs1_net_trial::process_identity(expected.pid);
    return now.running() && now.pid==expected.pid && now.start==expected.start && now.executable==expected.executable;
  }
  static bool sender_(const Peer &self){return self.pid==::getpid() && alive_(self);}
  bool directory_private_()const {
    struct stat s{};return directory_>=0 && !::fstat(directory_,&s) && S_ISDIR(s.st_mode) &&
      s.st_uid==0 && (s.st_mode&07777)==0700 && s.st_dev==device_;
  }
  bool current_(Plan &out,bool timed)const {
    if(!directory_private_())return false;
    Journal journal;Stamp current;
    if(!journal.open(directory_) || !journal.read(out,&current) || !(current==stamp_) ||
        out.full_session!=full_ || out.decision.transaction!=transaction_)return false;
    const auto now=timed?monotonic_ms():0;
    return !timed || (now && now>=out.created_ms && now<out.deadline_ms);
  }
  bool regular_(const struct stat &s,mode_t mode)const {
    return S_ISREG(s.st_mode) && s.st_uid==0 && (s.st_mode&07777)==mode && s.st_nlink==1 && s.st_dev==device_;
  }
  static bool same_(const struct stat &a,const struct stat &b) {
    return a.st_dev==b.st_dev && a.st_ino==b.st_ino && a.st_size==b.st_size && a.st_nlink==b.st_nlink &&
      a.st_mtim.tv_sec==b.st_mtim.tv_sec && a.st_mtim.tv_nsec==b.st_mtim.tv_nsec &&
      a.st_ctim.tv_sec==b.st_ctim.tv_sec && a.st_ctim.tv_nsec==b.st_ctim.tv_nsec;
  }
  Read read_(File f,Record &out,struct stat *identity=nullptr)const {
    const auto name=name_(f);if(!name || !directory_private_())return Read::ERROR;
    const int file=::openat(directory_,name,O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC);
    if(file<0)return errno==ENOENT?Read::MISSING:Read::ERROR;
    struct stat before{},after{},named{};cgs1_wifi_private::detail::Bytes bytes;bytes.value.resize(118);
    bool okay=!::fstat(file,&before) && regular_(before,0400) && before.st_size==118;size_t at=0;
    while(okay && at<bytes.value.size()) {
      const auto n=::read(file,&bytes.value[at],bytes.value.size()-at);
      if(n<0 && errno==EINTR)continue;
      if(n<=0)okay=false;else at+=size_t(n);
    }
    okay=okay && !::fstat(file,&after) && same_(before,after);::close(file);
    if(!okay || !directory_private_() || ::fstatat(directory_,name,&named,AT_SYMLINK_NOFOLLOW) ||
        !regular_(named,0400) || !same_(after,named) || !decode(bytes,out) || !shape_(f,out))return Read::ERROR;
    if(identity)*identity=named;
    return Read::PRESENT;
  }
  bool publish_(File f,const Record &r) {
    publication_busy_=false;
    const auto name=name_(f);if(!name || !shape_(f,r) || !directory_private_())return false;
    // A post-commit acknowledgement reports a completed decision, never
    // extends the forward mutation window. Its producer independently read
    // the exact durable Store; earlier ARMED/BOUND still require a live lease.
    const bool timed=f!=File::PRIMARY_COMMITTED && f!=File::BACKUP_COMMITTED;
    const int lock=::openat(directory_,"wifi-journal.lock",O_RDWR|O_CREAT|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC,0600);
    if(lock<0)return false;
    struct Close {int fd;~Close(){::close(fd);}} held{lock};struct stat lock_stat{};
    if(::fstat(lock,&lock_stat) || !regular_(lock_stat,0600))return false;
    if(::flock(lock,LOCK_EX|LOCK_NB)) {
      // Both guardians and the native binding publisher use this same lock.
      // A visible binding can precede its publisher's final fsync/readback.
      // No write has started here, so distinguish that ordinary contention
      // from partial/uncertain publication; never generalize this to IO errors.
      publication_busy_=errno==EWOULDBLOCK || errno==EAGAIN;
      return false;
    }
    Plan p;if(!current_(p,timed))return false;
    Record existing;cgs1_wifi_private::detail::Bytes encoded,previous;
    if(!encode(r,encoded))return false;
    const auto found=read_(f,existing);
    if(found==Read::ERROR)return false;
    // A lost local publish ACK is reconciled by exact existing bytes. This
    // never rewrites a file, changes its deadline or repairs a conflicting ACK.
    if(found==Read::PRESENT)return encode(existing,previous) && previous.value==encoded.value;
    const auto temporary="."+std::string(name)+"-"+transaction_+"-"+std::to_string(::getpid());
    const int file=::openat(directory_,temporary.c_str(),O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);
    if(file<0)return false;
    struct stat created{};bool okay=!::fstat(file,&created) && regular_(created,0600);size_t at=0;
    while(okay && at<encoded.value.size()) {
      const auto n=::write(file,encoded.value.data()+at,encoded.value.size()-at);
      if(n<0 && errno==EINTR)continue;
      if(n<=0)okay=false;else at+=size_t(n);
    }
    okay=okay && !::fchmod(file,0400) && !::fsync(file);const bool closed=::close(file)==0;
    struct stat named{};okay=okay && closed && current_(p,timed) &&
      ::fstatat(directory_,name,&named,AT_SYMLINK_NOFOLLOW)<0 && errno==ENOENT;
    if(okay && !::renameat(directory_,temporary.c_str(),directory_,name)) {
      if(::fsync(directory_))return false;
      struct stat installed{};Record observed;
      return read_(f,observed,&installed)==Read::PRESENT && installed.st_dev==created.st_dev &&
        installed.st_ino==created.st_ino && encode(observed,previous) && previous.value==encoded.value;
    }
    if(!::fstatat(directory_,temporary.c_str(),&named,AT_SYMLINK_NOFOLLOW) &&
        named.st_dev==created.st_dev && named.st_ino==created.st_ino)(void)::unlinkat(directory_,temporary.c_str(),0);
    return false;
  }
};
} // namespace cgs1_wifi_guard
