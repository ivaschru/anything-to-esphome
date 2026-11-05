#pragma once

// Concrete fixed-file retirement backend. Authority is a separate C++ type;
// production binds only NativeWifiScope, fixtures use an isolated local type.
// No runtime flag, callback, remote pathname or command can replace that type.
// Every actual unlink owns BOTH the canonical Store lock and journal flock,
// checks live scope/peers/exact original inode, and unlinks just ONE fixed file.
#include "wifi_guard_retirement.h"
#include "wifi_guard_retirement_ack_files.h"
#include "wifi_guard_record_files.h"
#include "wifi_retirement_scope.h"
#include <memory>

namespace cgs1_wifi_retirement {
struct RetirementPosix:IntentPosix {static int unlink(int root,const char*name){return ::unlinkat(root,name,0);}};
template<class Authority,class IO=RetirementPosix>class RetirementFiles {
 public:
  explicit RetirementFiles(Authority&authority):authority_(authority){}
  RetirementFiles(const RetirementFiles&)=delete;RetirementFiles&operator=(const RetirementFiles&)=delete;
  ~RetirementFiles(){if(runtime_>=0)::close(runtime_);}
  bool open(int candidate) {
    check_="open_unattempted";
    if(attempted_)return false;
    attempted_=true;runtime_=::fcntl(authority_.runtime_fd(),F_DUPFD_CLOEXEC,3);
    cgs1_wifi_guard::Journal journal;
    check_="open_plan_scope_peers";
    if(runtime_<0 || !journal.open(runtime_) || !journal.read(plan_,&plan_stamp_) || !authority_.current(plan_) ||
        !authority_.guardians(plan_,peers_))return false;
    check_="open_clock";
    created_=cgs1_wifi_guard::monotonic_ms();if(!created_ || created_>UINT64_MAX-10000)return false;
    candidate_=candidate;
    const auto name="wifi-retirement-"+plan_.decision.transaction+".v1";struct stat present{};
    if(!::fstatat(runtime_,name.c_str(),&present,AT_SYMLINK_NOFOLLOW)) {
      check_="open_existing_intent";
      if(!IntentFile<IO>::read_for_plan(runtime_,plan_,plan_stamp_,candidate_,intent_,intent_stamp_))return false;
    }else {
      check_="open_new_intent";
      if(errno!=ENOENT)return false;
      intent_.full_session=plan_.full_session;intent_.transaction=plan_.decision.transaction;intent_.boot_id=plan_.boot_id;
      intent_.plan=plan_stamp_;intent_.candidate=candidate_;
      for(size_t n=0;n<OLD_FILES;++n) {
        check_="open_old_ack_metadata";
        struct stat s{};if(::fstatat(runtime_,old_name(OldFile(n)),&s,AT_SYMLINK_NOFOLLOW))return false;
        intent_.old_files[n]=stamp_(s);
      }
    }
    for(unsigned n=0;n<2;++n) {
      check_="open_peer_metadata";
      const Peer actual{uint32_t(peers_[n].pid),peers_[n].start};
      if(intent_stamp_.inode && (intent_.peers[n].pid!=actual.pid || intent_.peers[n].start!=actual.start))return false;
      intent_.peers[n]=actual;
    }
    check_="open_intent_binding";
    if(!for_plan(intent_,plan_,plan_stamp_,candidate_,intent_.peers) ||
        !intent_file_.open(runtime_,intent_,intent_stamp_.inode?&intent_stamp_:nullptr))return false;
    ready_=true;return scope_alive();
  }
  void begin_step(){store_.reset();step_admitted_=false;}
  void end_step(){store_.reset();step_admitted_=false;}
  // Fixed labels only, never paths, SSIDs, credentials or Store contents.
  const char*last_check()const{return check_;}
  bool scope_alive()const {
    check_="scope_time_peers";
    struct Clock {uint64_t now()const{return cgs1_wifi_guard::monotonic_ms();}};
    // Avoid repeated whole-system scans within one synchronous metadata
    // step; retain fresh fixed binding checks before every actual write and
    // the SAME10s bound before/after IO. The private bit never crosses steps.
    return ready_ && retirement_scope_alive(authority_,plan_,peers_,created_,Clock{},step_admitted_);
  }
  bool exact_committed_decision_locked() {
    if(!scope_alive())return false;
    if(!store_) {
      check_="decision_parent";
      const int parent=authority_.duplicate_private_parent();if(parent<0)return false;
      std::unique_ptr<cgs1_wifi_private::Store<>>selected;
      cgs1_wifi_private::Networks networks;
      check_="decision_load";
      const auto entered=cgs1_wifi_guard::monotonic_ms();
      if(!entered || entered>UINT64_MAX-3000){::close(parent);return false;}
      const auto until=std::min(entered+3000,created_+10000);
      for(;;) {
        selected=std::make_unique<cgs1_wifi_private::Store<>>();
        if(selected->open_readonly(parent,plan_.decision.transaction.c_str()))break;
        const bool busy=selected->lease_busy();selected.reset();
        check_="decision_open";if(!busy){::close(parent);return false;}
        // This is a pre-load lock refusal, never a partial unlink/publication.
        // Preserve the original retirement deadline and exact live peers.
        check_="decision_busy_timeout";
        const auto now=cgs1_wifi_guard::monotonic_ms();
        if(now<entered || now>=until || !scope_alive()){::close(parent);return false;}
        timespec delay{0,10000000};
        if(::nanosleep(&delay,nullptr) && errno!=EINTR){::close(parent);return false;}
      }
      const bool loaded=selected->load(networks)==cgs1_wifi_private::Load::LOADED &&
        cgs1_wifi_guard::monotonic_ms()>=entered && cgs1_wifi_guard::monotonic_ms()<until;
      ::close(parent);if(!loaded)return false;store_=std::move(selected);
    }
    check_="decision_match";
    return cgs1_wifi_decision::inspect(plan_.decision,*store_)==cgs1_wifi_decision::Decision::COMMITTED && scope_alive();
  }
  Marker marker() {
    check_="intent_marker";
    cgs1_wifi_guard::Stamp stamp;const auto found=intent_file_.inspect(&stamp);
    if(found==IntentState::MISSING)return Marker::MISSING;
    if(found==IntentState::CONFLICT)return Marker::CONFLICT;
    if(found==IntentState::UNREADABLE)return Marker::UNREADABLE;
    if(!acks_) {
      acks_=std::make_unique<AckFiles<IO>>();
      if(!acks_->open(runtime_,intent_,stamp)){acks_.reset();return Marker::UNREADABLE;}
      intent_stamp_=stamp;
    }
    return Marker::MATCH;
  }
  Journal journal()const {
    check_="journal_identity";
    struct stat s{};
    if(::fstatat(runtime_,"wifi-transaction.v1",&s,AT_SYMLINK_NOFOLLOW))return errno==ENOENT?Journal::RETIRED:Journal::UNREADABLE;
    return regular_(s,plan_stamp_) && stamp_(s)==plan_stamp_?Journal::EXACT_PRESENT:Journal::CONFLICT;
  }
  Files next_old_file() {
    check_="old_ack_identity";
    next_=-1;
    for(size_t n=0;n<OLD_FILES;++n) {
      struct stat s{};
      if(::fstatat(runtime_,old_name(OldFile(n)),&s,AT_SYMLINK_NOFOLLOW)) {
        if(errno==ENOENT)continue;
        return Files::UNREADABLE;
      }
      if(!regular_(s,intent_.old_files[n]) || !(stamp_(s)==intent_.old_files[n]))return Files::CONFLICT;
      if(next_<0)next_=int(n);
    }
    return next_<0?Files::ALL_CLEAR:Files::ONE_BOUND_FILE;
  }
  bool both_committed()const {
    check_="both_committed";
    cgs1_wifi_guard::RecordFiles records;
    return records.open(runtime_,plan_,plan_stamp_) && records.both_ready(cgs1_wifi_guard::Stage::COMMITTED,peers_);
  }
  bool both_retiring()const{check_="both_retiring";return acks_ && acks_->both(AckStage::RETIRING);}
  bool both_retired()const{check_="both_retired";return acks_ && acks_->both(AckStage::RETIRED);}
  Write publish_intent() {
    if(!exact_committed_decision_locked())return Write::REFUSED;
    check_="publish_intent";
    const auto result=intent_file_.publish(plan_);
    return result==IntentWrite::ACK?Write::ACK:result==IntentWrite::UNCERTAIN?Write::UNCERTAIN:Write::REFUSED;
  }
  Write prune_one_bound_file() {
    Lock lock(runtime_);
    if(!lock.valid || marker()!=Marker::MATCH || !both_retiring() || journal()!=Journal::EXACT_PRESENT ||
        next_old_file()!=Files::ONE_BOUND_FILE || !exact_committed_decision_locked())return Write::REFUSED;
    const auto index=size_t(next_);const auto name=old_name(OldFile(index));struct stat current{};
    if(::fstatat(runtime_,name,&current,AT_SYMLINK_NOFOLLOW) || !regular_(current,intent_.old_files[index]) ||
        !(stamp_(current)==intent_.old_files[index]) || !scope_alive())return Write::REFUSED;
    // From this one syscall onward, any lost ACK is UNCERTAIN. The actor is
    // consumed by the ordering policy; a NEW actor must inspect real inodes.
    if(IO::unlink(runtime_,name) || IO::sync(runtime_))return Write::UNCERTAIN;
    return ::fstatat(runtime_,name,&current,AT_SYMLINK_NOFOLLOW)<0 && errno==ENOENT?Write::ACK:Write::UNCERTAIN;
  }
  Write retire_exact_journal() {
    Lock lock(runtime_);
    if(!lock.valid || marker()!=Marker::MATCH || !both_retiring() || next_old_file()!=Files::ALL_CLEAR ||
        journal()!=Journal::EXACT_PRESENT || !exact_committed_decision_locked())return Write::REFUSED;
    struct stat current{};
    if(::fstatat(runtime_,"wifi-transaction.v1",&current,AT_SYMLINK_NOFOLLOW) || !regular_(current,plan_stamp_) ||
        !(stamp_(current)==plan_stamp_) || !scope_alive())return Write::REFUSED;
    if(IO::unlink(runtime_,"wifi-transaction.v1") || IO::sync(runtime_))return Write::UNCERTAIN;
    return journal()==Journal::RETIRED?Write::ACK:Write::UNCERTAIN;
  }
 private:
  Authority&authority_;int runtime_{-1},candidate_{-1},next_{-1};bool attempted_{false},ready_{false};uint64_t created_{0};
  cgs1_wifi_guard::Plan plan_;cgs1_wifi_guard::Stamp plan_stamp_,intent_stamp_;Intent intent_;
  std::array<cgs1_net_trial::ProcessIdentity,2>peers_;IntentFile<IO>intent_file_;
  std::unique_ptr<AckFiles<IO>>acks_;std::unique_ptr<cgs1_wifi_private::Store<>>store_;
  mutable const char*check_{"not_opened"};
  mutable bool step_admitted_{false};
  struct Lock {
    int fd{-1};bool valid{false};
    explicit Lock(int root) {
      fd=::openat(root,"wifi-journal.lock",O_RDWR|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC);
      struct stat held{},named{},parent{};
      valid=fd>=0 && !::fstat(fd,&held) && !::fstat(root,&parent) && S_ISREG(held.st_mode) && held.st_uid==0 &&
        (held.st_mode&07777)==0600 && held.st_nlink==1 && !held.st_size && held.st_dev==parent.st_dev &&
        !::flock(fd,LOCK_EX|LOCK_NB) && !::fstatat(root,"wifi-journal.lock",&named,AT_SYMLINK_NOFOLLOW) &&
        stamp_(held)==stamp_(named) && named.st_nlink==1 && (named.st_mode&07777)==0600;
    }
    ~Lock(){if(fd>=0)::close(fd);}
  };
  static cgs1_wifi_guard::Stamp stamp_(const struct stat&s) {
    return {uint64_t(s.st_dev),uint64_t(s.st_ino),uint64_t(s.st_size),uint64_t(s.st_mtim.tv_sec),uint64_t(s.st_mtim.tv_nsec),uint64_t(s.st_ctim.tv_sec),uint64_t(s.st_ctim.tv_nsec)};
  }
  static bool regular_(const struct stat&s,const cgs1_wifi_guard::Stamp&expected) {
    return S_ISREG(s.st_mode) && s.st_uid==0 && (s.st_mode&07777)==0400 && s.st_nlink==1 &&
      uint64_t(s.st_dev)==expected.device && s.st_size==ssize_t(expected.size);
  }
};
template<class Authority,class IO=RetirementPosix>class FileRetirement {
 public:
  explicit FileRetirement(Authority&authority):files_(authority),policy_(files_){}
  bool open(int candidate){return files_.open(candidate);}
  Result step(){files_.begin_step();const auto result=policy_.step();files_.end_step();return result;}
  Phase phase()const{return policy_.phase();}
  Phase failed_from()const{return policy_.failed_from();}
  const char*last_check()const{return files_.last_check();}
 private:
  RetirementFiles<Authority,IO>files_;Retirement<RetirementFiles<Authority,IO>>policy_;
};
} // namespace cgs1_wifi_retirement
