#pragma once

// Independent per-process snapshot of the later touchscreen Wi-Fi transaction.
// A guardian must hold the complete rollback baseline BEFORE publishing ARMED,
// and the exact new profile ID BEFORE publishing BOUND. These acknowledgements
// do not select a network or grant recovery permission. They only prepare the
// already-running, independently supervised guardian to survive native failure.
#include "supervisor_full_plan.h"
#include "supervisor_process_tree.h"
#include "wifi_guard_record_files.h"
#include "wifi_daemon_inspect.h"
#include "supervisor_wifi_private_root.h"
#include "wifi_guard_retirement_ack_files.h"
#include <memory>

namespace cgs1_supervisor {
class RunnerWifiJournal {
 public:
  RunnerWifiJournal()=default;
  RunnerWifiJournal(const RunnerWifiJournal&)=delete;
  RunnerWifiJournal&operator=(const RunnerWifiJournal&)=delete;
  ~RunnerWifiJournal(){if(runtime_>=0)::close(runtime_);}
  bool open(int runtime,const FullPlan&full,cgs1_wifi_guard::Role role) {
    if(attempted_)return false;
    attempted_=true;
    if(!plan_shape(full) || (role!=cgs1_wifi_guard::Role::PRIMARY && role!=cgs1_wifi_guard::Role::BACKUP))return false;
    self_=cgs1_net_trial::process_identity(::getpid());
    if(!self_.running() || self_.executable!="/tmp/qingping-full-"+full.nonce+"/guardian/program")return false;
    runtime_=::fcntl(runtime,F_DUPFD_CLOEXEC,3);
    if(runtime_<0 || !journal_.open(runtime_))return false;
    // Failure disables future Wi-Fi admission, not otherwise working full UI.
    // A transaction can never ARM until the canonical root is available.
    private_root_.open();
    full_=full;role_=role;ready_=true;return true;
  }
  bool poll() {
    if(!ready_ || failed_)return false;
    const auto now=cgs1_wifi_guard::monotonic_ms();
    check_="poll_clock";
    if(!now || (cached_ && now<plan_.created_ms))return fail_();
    // A durable commit is the decision, not a UI ACK. Reconcile it even when
    // the old forward deadline has just elapsed; forcing native death solely
    // because its success ACK was lost would undo successful user work. This
    // does NOT retire the journal, authorize another transaction, prove lease
    // freshness or weaken any native-death/recovery/effects gate.
    const bool expired=cached_ && now>=plan_.deadline_ms;
    // Fast guardian heartbeats keep their original cadence. Disk/proc/socket
    // inspection is limited to 20 Hz. A FIRST unresolved deadline forces an
    // immediate fresh decision; an already observed commit uses the ordinary
    // inspection cadence, never an unbounded remembered success flag.
    if(last_poll_ && now<last_poll_)return fail_();
    if(last_poll_ && now-last_poll_<50 && (!expired || commit_observed_))return true;
    last_poll_=now;
    // Once RETIRING has been acknowledged, old binding files may disappear.
    // Keep the sealed snapshot and use the separate retirement receipts;
    // re-running the old ARMED/BOUND path would recreate files during pruning.
    if(retirement_)return poll_retirement_();
    const bool committed=cached_ && committed_record_();
    check_="poll_expired_decision";
    if(expired && !committed)return fail_();
    struct stat entry{};
    if(::fstatat(runtime_,"wifi-transaction.v1",&entry,AT_SYMLINK_NOFOLLOW)) {
      check_="poll_journal_presence";
      if(errno==ENOENT && !cached_)return true;
      return fail_();
    }
    cgs1_wifi_guard::Plan observed;cgs1_wifi_guard::Stamp stamp;
    check_="poll_private_root";if(!private_root_.current())return fail_();
    check_="poll_journal_read";if(!journal_.read(observed,&stamp))return fail_();
    check_="poll_session";if(!session_(observed,now,committed))return fail_();
    check_="poll_writers";if(!writers_stopped_())return fail_();
    check_="poll_daemon";if(!daemon_(observed))return fail_();
    bool new_snapshot=false;
    if(!cached_) {
      // No ADD is legal until BOTH guardians have acknowledged this baseline.
      // Refuse a stale/foreign catalog before granting even the first ACK.
      check_="arm_original_catalog";
      if(!catalog_(observed,-1))return fail_();
      plan_=std::move(observed);stamp_=stamp;cached_=true;
      records_.reset(new cgs1_wifi_guard::RecordFiles);
      check_="arm_record_open";
      if(!records_->open(runtime_,plan_,stamp_))return fail_();
      // Publication can become visible before fsync/readback reports success.
      // Native could see both files and ADD while this actor receives a lost
      // local ACK. Prepare recovery BEFORE publishing, not after its reply.
      recoverable_=true;
      new_snapshot=true;
    } else {
      check_="poll_sealed_plan_identity";
      if(!(stamp==stamp_) || !same_(observed,plan_))return fail_();
    }
    if(!armed_) {
      // During a known pre-write lock wait neither guardian ACK is invented.
      // Revalidate the unchanged original catalog on later polls; native
      // cannot ADD until both actual ARMED records exist.
      check_="arm_original_catalog";
      if(!new_snapshot && !catalog_(plan_,-1))return fail_();
      check_="arm_ack";const auto result=ack_(cgs1_wifi_guard::Stage::ARMED,-1);
      if(result==AckProgress::FAILED)return fail_();
      if(result==AckProgress::WAITING)return true;
      armed_=true;
    }
    if(::fstatat(runtime_,"wifi-candidate.v1",&entry,AT_SYMLINK_NOFOLLOW)) {
      check_="poll_candidate_presence";
      return errno==ENOENT && bound_<0?true:fail_();
    }
    int candidate=-1;
    check_="poll_candidate_binding";
    if(!records_->read_candidate(candidate) || (bound_>=0 && bound_!=candidate))return fail_();
    if(!bound_acknowledged_) {
      // Before either guardian releases a BOUND ACK, the ADD result must still
      // be ONE new empty disabled ordinary profile. Keys have not been set yet.
      check_="bound_empty_catalog";
      if(!catalog_(plan_,candidate))return fail_();
      bound_=candidate;
      check_="bound_ack";
      const auto result=ack_(cgs1_wifi_guard::Stage::BOUND,bound_);
      if(result==AckProgress::FAILED)return fail_();
      if(result==AckProgress::WAITING)return true;
      bound_acknowledged_=true;
    }
    if(committed) {
      commit_observed_=true;
      // Each real guardian publishes only its own birth-bound acknowledgement
      // after reading the durable decision itself. Two files alone never
      // replace a fresh decision/lock for the later retirement operation.
      check_="committed_ack";
      const auto result=ack_(cgs1_wifi_guard::Stage::COMMITTED,bound_);
      if(result==AckProgress::FAILED)return fail_();
      if(result==AckProgress::WAITING)return true;
      const auto name="wifi-retirement-"+plan_.decision.transaction+".v1";
      if(!::fstatat(runtime_,name.c_str(),&entry,AT_SYMLINK_NOFOLLOW)) {
        check_="retirement_intent_read";
        cgs1_wifi_retirement::Intent intent;cgs1_wifi_guard::Stamp identity;
        if(!cgs1_wifi_retirement::IntentFile<>::read_for_plan(runtime_,plan_,stamp_,bound_,intent,identity))return fail_();
        retirement_.reset(new cgs1_wifi_retirement::AckFiles<>);
        check_="retirement_ack_open";
        if(!retirement_->open(runtime_,intent,identity))return fail_();
        return poll_retirement_();
      }
      check_="retirement_intent_presence";
      if(errno!=ENOENT)return fail_();
    }
    return true;
  }
  bool has_snapshot()const{return cached_;}
  bool armed()const{return armed_;}
  bool failed()const{return failed_;}
  bool commit_observed()const{return commit_observed_;}
  bool retirement_active()const{return bool(retirement_);}
  bool retirement_committed()const{return retirement_ && retiring_ack_ && committed_record_();}
  int bound_candidate()const{return bound_;}
  const cgs1_wifi_guard::Plan*cached_plan()const{return cached_?&plan_:nullptr;}
  const cgs1_wifi_guard::Stamp*cached_stamp()const{return cached_?&stamp_:nullptr;}
  int duplicate_private_parent()const{return private_root_.duplicate();}
  bool matches_owner_plan(const cgs1_net_trial::StockInspection&stock)const {
    if(!stock.verified || stock.boot_id!=full_.stock.boot_id || stock.bridge_sha!=full_.stock.bridge_sha)return false;
    for(unsigned n=0;n<full_.stock.processes.size();++n) {
      const auto&a=stock.processes[n];const auto&b=full_.stock.processes[n];
      if(a.pid!=b.pid || a.start!=b.start || a.parent!=b.parent || a.executable!=b.executable)return false;
    }
    return true;
  }
  bool current_snapshot_matches()const {
    // Recovery may inspect an expired transaction, but never silently replace
    // its cached rollback basis with a fresh file after a lost native lease.
    cgs1_wifi_guard::Plan now;cgs1_wifi_guard::Stamp stamp;
    return cached_ && journal_.read(now,&stamp) && stamp==stamp_ && same_(now,plan_);
  }
  bool recovery_basis_matches(const cgs1_wifi_guard::Plan&requested)const {
    // An expired forward lease must still be recoverable. Retained plan/bound
    // data survive a failed poll, but corruption/replacement is not permission
    // to substitute a new baseline. Native-death/flock proof is separate.
    const auto now=cgs1_wifi_guard::monotonic_ms();int candidate=-1;
    // A cached RETIRING guardian is deliberately retaining its exact bound
    // candidate after the old binding is pruned. This path can only KEEP an
    // independently rechecked COMMITTED decision, never run WPA rollback.
    const bool retirement_basis=retirement_ && retiring_ack_ &&
      retirement_->plan_state()==cgs1_wifi_retirement::PlanState::PRESENT &&
      (retirement_->old_state()==cgs1_wifi_retirement::OldState::PRESENT ||
       retirement_->old_state()==cgs1_wifi_retirement::OldState::CLEAR);
    const bool binding=bound_<0 || (records_ && records_->read_candidate(candidate) && candidate==bound_) || retirement_basis;
    return private_root_.current() && cached_ && recoverable_ && binding && same_(requested,plan_) && current_snapshot_matches() &&
      now>=plan_.created_ms && plan_.created_ms>=full_.created_ms &&
      plan_.full_session==full_.nonce && plan_.boot_id==full_.stock.boot_id &&
      cgs1_net_trial::read_small("/proc/sys/kernel/random/boot_id",64)==full_.stock.boot_id+"\n" && writers_stopped_();
  }
 private:
  int runtime_{-1},bound_{-1};bool attempted_{false},ready_{false},failed_{false},cached_{false},armed_{false},recoverable_{false},commit_observed_{false};
  uint64_t last_poll_{0};FullPlan full_;cgs1_wifi_guard::Plan plan_;cgs1_wifi_guard::Stamp stamp_;
  cgs1_wifi_guard::Role role_{cgs1_wifi_guard::Role::PRIMARY};
  cgs1_net_trial::ProcessIdentity self_;cgs1_wifi_guard::Journal journal_;
  std::unique_ptr<cgs1_wifi_guard::RecordFiles>records_;
  std::unique_ptr<cgs1_wifi_retirement::AckFiles<>>retirement_;bool retiring_ack_{false},retired_ack_{false};
  mutable bool decision_lock_busy_{false};uint64_t retirement_busy_since_{0};
  bool bound_acknowledged_{false};uint64_t record_busy_since_{0};
  enum class AckProgress {ACK,WAITING,FAILED};
  AckProgress ack_(cgs1_wifi_guard::Stage stage,int candidate) {
    if(records_->acknowledge(role_,stage,self_,candidate)) {
      record_busy_since_=0;return AckProgress::ACK;
    }
    if(!records_->publication_busy())return AckProgress::FAILED;
    const auto now=cgs1_wifi_guard::monotonic_ms();
    if(!now || now<plan_.created_ms || (record_busy_since_ && now<record_busy_since_))return AckProgress::FAILED;
    if(!record_busy_since_)record_busy_since_=now;
    // One absolute 3s contention budget, not renewed by another poll. The
    // ordinary forward deadline/boot/plan/daemon/writer checks run BEFORE
    // every call. After commit the Store is freshly checked, as before.
    // No ACK is returned until its real fixed-file publication succeeds.
    return now-record_busy_since_<3000?AckProgress::WAITING:AckProgress::FAILED;
  }
  RunnerWifiPrivateRoot private_root_;
  const char*check_{"not_opened"};
  bool fail_(){
    // A failed guardian previously exported only a generic stop reason. Keep
    // the first fixed check label in the private coordinator log, without
    // journal bytes, credentials, SSIDs, caller paths or retry authority.
    if(!failed_)::dprintf(STDERR_FILENO,"CGS1_WIFI_GUARD refusal=%s cached=%u bound=%d role=%u\n",
      check_,unsigned(cached_),bound_,unsigned(role_));
    failed_=true;return false;
  }
  bool poll_retirement_() {
    using namespace cgs1_wifi_retirement;
    // Both RETIRED files are durable lifecycle receipts. Check them BEFORE
    // looking at old journal/catalog names: native may already have created
    // the next generation after seeing this pair. No new WPA permission is
    // obtained here; its fresh baseline must still pass the ordinary path.
    if(retired_ack_ && retirement_->both(AckStage::RETIRED)) {
      retirement_.reset();records_.reset();plan_=cgs1_wifi_guard::Plan{};stamp_=cgs1_wifi_guard::Stamp{};
      bound_=-1;cached_=armed_=recoverable_=commit_observed_=retiring_ack_=retired_ack_=false;retirement_busy_since_=0;
      bound_acknowledged_=false;record_busy_since_=0;
      return true;
    }
    check_="retirement_scope_writers_daemon";
    if(!private_root_.current() || !writers_stopped_() || !daemon_(plan_))return fail_();
    if(!committed_record_()) {
      // Native pruning and these guardians now share read-only SH leases;
      // they cannot block one another while verifying the durable decision.
      // A genuine EX writer still excludes every reader. Preserve the500ms
      // bounded refusal for that case, without publishing ANY ACK. Foreign
      // bytes/decision/parent still fail immediately; a stuck owner fails on
      // the fixed bound, which repeated polls cannot extend.
      const auto now=cgs1_wifi_guard::monotonic_ms();
      check_="retirement_decision_or_contention";
      if(!decision_lock_busy_ || !now)return fail_();
      if(!retirement_busy_since_)retirement_busy_since_=now;
      return now>=retirement_busy_since_ && now-retirement_busy_since_<500?true:fail_();
    }
    retirement_busy_since_=0;
    if(!retiring_ack_) {
      check_="retiring_ack";
      if(retirement_->acknowledge(role_,AckStage::RETIRING,plan_)!=IntentWrite::ACK)return fail_();
      retiring_ack_=true;return true;
    }
    const auto old=retirement_->old_state();const auto journal=retirement_->plan_state();
    check_="retirement_old_and_plan_identity";
    if(old==OldState::CONFLICT || old==OldState::UNREADABLE || journal==PlanState::CONFLICT || journal==PlanState::UNREADABLE ||
        (journal==PlanState::MISSING && old!=OldState::CLEAR))return fail_();
    if(old==OldState::PRESENT || journal==PlanState::PRESENT)return true;
    if(!retired_ack_) {
      check_="retired_ack";
      if(retirement_->acknowledge(role_,AckStage::RETIRED,plan_)!=IntentWrite::ACK)return fail_();
      retired_ack_=true;
    }
    return true;
  }
  bool session_(const cgs1_wifi_guard::Plan&p,uint64_t now,bool exact_commit)const {
    return p.full_session==full_.nonce && p.boot_id==full_.stock.boot_id && p.created_ms>=full_.created_ms &&
      now>=p.created_ms && (now<p.deadline_ms || exact_commit) &&
      cgs1_net_trial::read_small("/proc/sys/kernel/random/boot_id",64)==full_.stock.boot_id+"\n";
  }
  bool committed_record_()const {
    // No caller pathname, credentials or success boolean. Each guardian reads
    // the canonical private inode under its own fresh nonblocking Store lock.
    // A busy writer, wrong key under the same epoch, foreign commit, corrupt
    // record or substituted parent remains UNKNOWN, never COMMITTED.
    decision_lock_busy_=false;
    if(!cached_ || !recoverable_ || bound_<0 || !private_root_.current())return false;
    const int parent=private_root_.duplicate();if(parent<0)return false;
    cgs1_wifi_private::Store<>store;cgs1_wifi_private::Networks networks;
    const bool opened=store.open_readonly(parent,plan_.decision.transaction.c_str());
    decision_lock_busy_=!opened && store.lease_busy();
    const bool loaded=opened &&
      store.load(networks)!=cgs1_wifi_private::Load::ERROR;
    ::close(parent);
    return loaded && cgs1_wifi_decision::inspect(plan_.decision,store)==cgs1_wifi_decision::Decision::COMMITTED &&
      private_root_.current();
  }
  bool writers_stopped_()const {
    for(unsigned role:{1U,2U}) {
      const auto&old=full_.stock.processes[role];const auto actual=cgs1_net_trial::process_identity(old.pid);
      if(actual.pid!=old.pid || actual.start!=old.start || actual.executable!=old.executable ||
          (actual.state!='T' && actual.state!='t'))return false;
    }
    const auto&old=full_.stock.processes[0];const auto actual=process_stamp(pid_t(old.pid));
    if(actual.start)return actual.start!=old.start || actual.state=='Z' || actual.state=='X';
    // An unreadable process is not an absent writer. /proc itself is already
    // used for the live guardian identity; still distinguish ENOENT explicitly.
    struct stat entry{};return ::lstat(("/proc/"+std::to_string(old.pid)).c_str(),&entry)<0 && errno==ENOENT;
  }
  static bool same_(const cgs1_wifi_guard::Plan&a,const cgs1_wifi_guard::Plan&b) {
    cgs1_wifi_guard::detail::Bytes x,y;
    return cgs1_wifi_guard::detail::encode(a,x) && cgs1_wifi_guard::detail::encode(b,y) && x.value==y.value;
  }
  static bool daemon_(const cgs1_wifi_guard::Plan&p) {
    const auto actual=cgs1_wifi::inspect_daemon(0);
    return actual.verified && actual.process.pid==long(p.daemon_pid) &&
      actual.process.start==p.daemon_start && actual.socket_inode==p.socket_inode;
  }
  static bool profile_(const cgs1_wifi::SavedProfile&a,const cgs1_wifi::SavedProfile&b) {
    return a.id==b.id && a.ssid_text==b.ssid_text && a.bssid==b.bssid && a.flags==b.flags &&
      a.current==b.current && a.disabled==b.disabled && a.flags_known && !a.temporarily_disabled;
  }
  static bool catalog_(const cgs1_wifi_guard::Plan&p,int candidate) {
    cgs1_wifi::ReadOnlyControl control;std::string reply;std::vector<cgs1_wifi::SavedProfile> current;
    const bool read=daemon_(p) && control.open(0) && control.request("LIST_NETWORKS",reply) &&
      cgs1_wifi::parse_saved_profiles(reply,current) && daemon_(p);
    const bool closed=control.close();
    if(!read || !closed || current.size()!=p.original.size()+(candidate>=0?1u:0u))return false;
    for(const auto&old:p.original) {
      const auto at=std::find_if(current.begin(),current.end(),[&](const auto&v){return v.id==old.id;});
      if(at==current.end() || !profile_(*at,old))return false;
    }
    if(candidate>=0) {
      const auto at=std::find_if(current.begin(),current.end(),[&](const auto&v){return v.id==candidate;});
      if(at==current.end() || !at->ssid_text.empty() || at->bssid!="any" || at->current ||
          !at->disabled || at->flags!="[DISABLED]" || !at->flags_known || at->temporarily_disabled)return false;
    }
    return true;
  }
};
} // namespace cgs1_supervisor
