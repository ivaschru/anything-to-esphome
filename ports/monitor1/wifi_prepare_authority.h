#pragma once

// Concrete file/Store handshake for Preparation. Scope is a compile-time type;
// the production alias supplies only NativeWifiScope, never a caller boolean,
// environment selector or remotely selected directory. This class publishes
// the recovery plan/binding but cannot ADD, SET, SELECT, ENABLE or SAVE_CONFIG.
#include "wifi_guard_record_files.h"
#include "wifi_forward_step.h"
#include <memory>

namespace cgs1_wifi_prepare {
template<class Scope>class FilePreparationAuthority {
 public:
  using Peer=cgs1_net_trial::ProcessIdentity;
  FilePreparationAuthority(Scope&scope,cgs1_wifi_guard::Plan plan):scope_(scope),plan_(std::move(plan)){}
  FilePreparationAuthority(const FilePreparationAuthority&)=delete;
  FilePreparationAuthority&operator=(const FilePreparationAuthority&)=delete;
  ~FilePreparationAuthority(){if(runtime_>=0)::close(runtime_);}
  const cgs1_wifi_guard::Plan&forward_plan()const{return plan_;}
  const char*last_check()const{return check_;}
  bool claim_forward(cgs1_wifi_forward::Step step,int candidate) {
    const auto index=unsigned(step);
    if(index>=forward_claims_.size() || phase_!=Phase::BOUND || candidate!=candidate_ || forward_claims_[index])return false;
    forward_claims_[index]=true;return true; // Consumed even if later gates fail.
  }
  bool forward_current(int candidate) {
    // Read-only PRE-COMMIT admission. The exact prepared ID, frozen writer
    // scope, current Store and both BOUND guardians must still agree. This
    // deliberately expires once Store is committed; post-commit reconciliation
    // belongs to the independent decision/retirement flow.
    check_="authority_bound_identity";
    if(phase_!=Phase::BOUND || candidate!=candidate_ || !records_)return false;
    check_="authority_first_live";if(!live_())return false;
    check_="authority_store_baseline";if(!baseline_())return false;
    check_="authority_bound_records";
    if(!records_->both_ready(cgs1_wifi_guard::Stage::BOUND,peers_))return false;
    check_="authority_last_live";return live_();
  }
  bool forward_no_connect(int candidate) {
    // SELECT disables enabled originals, including the previous CURRENT.
    // Verify their later restoration
    // can use the reviewed vendor no-connect path BEFORE changing association.
    return forward_current(candidate) && scope_.verified_no_connect(plan_) && forward_current(candidate);
  }
  template<class Connection>Reply commit_forward(Connection&connection) {
    if(!claim_forward(cgs1_wifi_forward::Step::COMMIT,candidate_) || !commit_admitted_(connection))return Reply::REFUSED;
    cgs1_wifi_private::Commit result;
    {
      uint64_t entered=0,until=0;auto owned_store=open_store_(false,entered,until,true);if(!owned_store)return Reply::REFUSED;
      auto&store=*owned_store;cgs1_wifi_private::Networks previous;
      if(store.load(previous)==cgs1_wifi_private::Load::ERROR ||
          cgs1_wifi_decision::inspect(plan_.decision,store)!=cgs1_wifi_decision::Decision::UNCOMMITTED ||
          (cgs1_wifi_guard::monotonic_ms()<entered || cgs1_wifi_guard::monotonic_ms()>=until))return Reply::REFUSED;
      // Only this concrete method installs the borrowed pointer, while it
      // owns the SAME live Store flock. Connectivity's authority rereads then
      // verify this exact locked decision, instead of deadlocking on a second
      // flock or accepting a caller-provided "Store okay" boolean.
      commit_store_=&store;
      struct Clear {FilePreparationAuthority&self;~Clear(){self.commit_store_=nullptr;}} clear{*this};
      struct Gate {
        FilePreparationAuthority&self;Connection&connection;
        bool before_publish(){return self.commit_admitted_(connection);}
      } gate{*this,connection};
      result=store.commit_guarded(plan_.decision.desired,gate);
    } // Release the Store BEFORE either guardian independently reads it.
    if(result!=cgs1_wifi_private::Commit::COMMITTED && result!=cgs1_wifi_private::Commit::ALREADY_COMMITTED)
      return result==cgs1_wifi_private::Commit::UNCERTAIN?Reply::AMBIGUOUS:Reply::REFUSED;
    return reconcile_forward_commit();
  }
  Reply reconcile_forward_commit() {
    // No publication/retry here. Fresh fsync/readback can establish a visible
    // decision after a lost ACK. A foreign/unknown decision never rolls back
    // or becomes permission to rewrite the Store.
    if(!forward_claims_[unsigned(cgs1_wifi_forward::Step::COMMIT)] || !records_)return Reply::REFUSED;
    const auto entered=cgs1_wifi_guard::monotonic_ms();
    if(!entered || entered>UINT64_MAX-3000)return Reply::AMBIGUOUS;
    const auto until=entered+3000;
    for(;;) {
      const auto now=cgs1_wifi_guard::monotonic_ms();
      if(now<entered || now>=until || !committed_() || !live_(true))return Reply::AMBIGUOUS;
      if(records_->both_ready(cgs1_wifi_guard::Stage::COMMITTED,peers_)) {
        if(!live_(true) || !committed_())return Reply::AMBIGUOUS;
        const auto after=cgs1_wifi_guard::monotonic_ms();
        if(after>=entered && after<until) {
          phase_=Phase::COMMITTED;return Reply::ACK;
        }
        return Reply::AMBIGUOUS;
      }
      timespec delay{0,10000000};if(::nanosleep(&delay,nullptr) && errno!=EINTR)return Reply::AMBIGUOUS;
    }
  }
  bool admitted(const std::string&transaction,Step step,int candidate) {
    // The new unassociated route is limited to an unchanged accepted saved
    // record. No API flag can turn a new key/order into a boot preference.
    // baseline_ below must independently read the SAME old decision from disk;
    // an internally consistent but foreign plan is not sufficient authority.
    if(!mode_admitted_())return false;
    if(transaction!=plan_.decision.transaction || !live_() || !baseline_())return false;
    if(step==Step::CREATE) {
      if(candidate!=-1 || (phase_!=Phase::INITIAL && phase_!=Phase::ARMED))return false;
      if(phase_==Phase::ARMED && !records_->both_ready(cgs1_wifi_guard::Stage::ARMED,peers_))return false;
    }else if(step==Step::BIND) {
      if(phase_!=Phase::ARMED || !new_candidate_(candidate) ||
          !records_->both_ready(cgs1_wifi_guard::Stage::ARMED,peers_))return false;
    }else {
      if(phase_!=Phase::BOUND || candidate!=candidate_ ||
          !records_->both_ready(cgs1_wifi_guard::Stage::BOUND,peers_))return false;
    }
    // Even initial ADD admission checks privacy. Crucially this is repeated
    // for SSID/key_mgmt/proto/PSK setters; an old diagnostic card is no token.
    return scope_.credentials_private(plan_) && live_();
  }
  Reply arm_prepare(const std::string&transaction,const std::vector<cgs1_wifi::SavedProfile>&original,
      const cgs1_wifi_private::Network&network) {
    if(arm_attempted_)return Reply::REFUSED;
    arm_attempted_=true;
    if(!mode_admitted_())return Reply::REFUSED;
    if(transaction!=plan_.decision.transaction || phase_!=Phase::INITIAL || !request_matches_(network) ||
        !cgs1_wifi_prepare::same_original(plan_.original,original,-1) || !live_() || !baseline_() ||
        !scope_.credentials_private(plan_))return Reply::REFUSED;
    runtime_=::fcntl(scope_.runtime_fd(),F_DUPFD_CLOEXEC,3);
    if(runtime_<0 || !clean_generation_())return Reply::REFUSED;
    cgs1_wifi_guard::Journal journal;
    if(!journal.open(runtime_))return Reply::REFUSED;
    // After a publication attempt, uncertainty belongs to the guardians.
    // Never publish a replacement plan or invoke ADD after a lost local ACK.
    phase_=Phase::UNCERTAIN;
    if(!journal.publish(plan_))return Reply::AMBIGUOUS;
    cgs1_wifi_guard::Plan observed;
    if(!journal.read(observed,&stamp_) || !exact_plan_(observed))return Reply::AMBIGUOUS;
    records_=std::make_unique<cgs1_wifi_guard::RecordFiles>();
    if(!records_->open(runtime_,plan_,stamp_) || !wait_(cgs1_wifi_guard::Stage::ARMED))return Reply::AMBIGUOUS;
    phase_=Phase::ARMED;return Reply::ACK;
  }
  Reply bind_candidate(const std::string&transaction,int candidate) {
    if(bind_attempted_)return Reply::REFUSED;
    bind_attempted_=true;
    if(!admitted(transaction,Step::BIND,candidate))return Reply::REFUSED;
    const auto self=cgs1_net_trial::process_identity(::getpid());
    phase_=Phase::UNCERTAIN;candidate_=candidate;
    if(!records_->bind_candidate(candidate,self,peers_) || !wait_(cgs1_wifi_guard::Stage::BOUND))return Reply::AMBIGUOUS;
    phase_=Phase::BOUND;return Reply::ACK;
  }
 private:
  enum class Phase {INITIAL,ARMED,BOUND,UNCERTAIN,COMMITTED};
  Scope&scope_;const cgs1_wifi_guard::Plan plan_;
  int runtime_{-1},candidate_{-1};Phase phase_{Phase::INITIAL};
  bool arm_attempted_{false},bind_attempted_{false},peers_pinned_{false};
  std::array<bool,4>forward_claims_{};
  const cgs1_wifi_private::Store<>*commit_store_{nullptr};
  std::array<Peer,2>peers_;cgs1_wifi_guard::Stamp stamp_;
  std::unique_ptr<cgs1_wifi_guard::RecordFiles>records_;
  const char*check_{"authority_not_used"};
  bool live_(bool exact_commit=false) {
    const auto now=cgs1_wifi_guard::monotonic_ms();std::array<Peer,2>current;
    if(!cgs1_wifi_guard::valid(plan_) || !now || now<plan_.created_ms || (!exact_commit && now>=plan_.deadline_ms) ||
        !scope_.keepalive(plan_) || !scope_.guardians(plan_,current))return false;
    if(!peers_pinned_){peers_=current;peers_pinned_=true;}
    for(unsigned n=0;n<2;++n)if(current[n].pid!=peers_[n].pid || current[n].start!=peers_[n].start ||
        current[n].executable!=peers_[n].executable)return false;
    // keepalive/guardian checks perform real I/O. A valid entry timestamp
    // must not authorize SELECT or a key setter after that I/O passed the
    // absolute transaction deadline. Recheck on return, never renew it.
    const auto after=cgs1_wifi_guard::monotonic_ms();
    return after>=now && (exact_commit || after<plan_.deadline_ms);
  }
  // All native Store admissions share the same known-pre-load contention
  // handling. This does not retry load/commit/publication after an error.
  std::unique_ptr<cgs1_wifi_private::Store<>>open_store_(bool exact_commit,uint64_t&entered,uint64_t&until,bool writable=false) {
    entered=cgs1_wifi_guard::monotonic_ms();
    if(!entered || entered>UINT64_MAX-3000)return nullptr;
    until=exact_commit?entered+3000:std::min(entered+3000,plan_.deadline_ms);
    for(;;) {
      const int parent=scope_.duplicate_private_parent();if(parent<0)return nullptr;
      auto store=std::make_unique<cgs1_wifi_private::Store<>>();
      const bool opened=writable?store->open_existing(parent,plan_.decision.transaction.c_str()):
        store->open_readonly(parent,plan_.decision.transaction.c_str());::close(parent);
      if(opened) {
        const auto after=cgs1_wifi_guard::monotonic_ms();
        if(after<entered || after>=until)return nullptr;
        return store;
      }
      const bool busy=store->lease_busy();store.reset();
      check_="authority_store_open";if(!busy)return nullptr;
      // Independent readers share SH leases; publication still needs EX.
      // Wait only on classified EAGAIN/EWOULDBLOCK before load, under fresh live scope,
      // pinned peers and one absolute bound. No WPA/key/commit is repeated.
      check_="authority_store_busy_timeout";
      const auto now=cgs1_wifi_guard::monotonic_ms();
      if(!now || now<entered || now>=until || !live_(exact_commit))return nullptr;
      const auto checked=cgs1_wifi_guard::monotonic_ms();
      if(checked<now || checked>=until)return nullptr;
      timespec delay{0,10000000};if(::nanosleep(&delay,nullptr) && errno!=EINTR)return nullptr;
    }
  }
  bool baseline_() {
    if(commit_store_)return cgs1_wifi_decision::inspect(plan_.decision,*commit_store_)==cgs1_wifi_decision::Decision::UNCOMMITTED;
    uint64_t entered=0,until=0;auto store=open_store_(false,entered,until);if(!store)return false;
    cgs1_wifi_private::Networks networks;check_="authority_store_load";
    if(store->load(networks)==cgs1_wifi_private::Load::ERROR)return false;
    check_="authority_store_decision";
    return cgs1_wifi_decision::inspect(plan_.decision,*store)==cgs1_wifi_decision::Decision::UNCOMMITTED &&
      cgs1_wifi_guard::monotonic_ms()>=entered && cgs1_wifi_guard::monotonic_ms()<until;
  }
  bool committed_() {
    uint64_t entered=0,until=0;auto store=open_store_(true,entered,until);if(!store)return false;
    cgs1_wifi_private::Networks networks;
    return store->load(networks)==cgs1_wifi_private::Load::LOADED &&
      cgs1_wifi_decision::inspect(plan_.decision,*store)==cgs1_wifi_decision::Decision::COMMITTED &&
      cgs1_wifi_guard::monotonic_ms()>=entered && cgs1_wifi_guard::monotonic_ms()<until;
  }
  template<class Connection>bool commit_admitted_(Connection&connection) {
    if(!connection.bound_to(*this,candidate_) || !connection.fallback_flags_restored() || !forward_current(candidate_))return false;
    const auto actual=connection.observe();const auto now=cgs1_wifi_guard::monotonic_ms();
    return actual.verified && actual.completed && actual.id==candidate_ && actual.lease_current &&
      actual.route_bound && actual.gateway_reachable && cgs1_wifi_switch::usable_ipv4(actual.ipv4) &&
      actual.lease_generation>=plan_.created_ms && actual.lease_generation<plan_.deadline_ms &&
      now>=plan_.created_ms && now<plan_.deadline_ms;
  }
  bool new_candidate_(int id)const {
    if(id<0 || id>1000000)return false;
    for(const auto&p:plan_.original)if(p.id==id)return false;
    return true;
  }
  bool request_matches_(const cgs1_wifi_private::Network&network)const {
    if(!network.ssid_size || network.ssid_size>32)return false;
    for(size_t index=0;index<plan_.decision.desired.size();++index) {
      if(index && plan_.catalog_mode==CatalogMode::UNASSOCIATED)return false;
      const auto&expected=plan_.decision.desired[index];
      if(expected.ssid_size!=network.ssid_size)continue;
      unsigned difference=0;
      for(size_t n=0;n<network.ssid_size;++n)difference|=network.ssid[n]^expected.ssid[n];
      for(size_t n=0;n<32;++n)difference|=network.psk[n]^expected.psk[n];
      if(!difference)return true;
    }
    return false;
  }
  bool mode_admitted_()const {
    return plan_.catalog_mode==CatalogMode::CONNECTED ||
      (plan_.catalog_mode==CatalogMode::UNASSOCIATED && cgs1_wifi_decision::saved_replay(plan_.decision));
  }
  bool clean_generation_()const {
    // All previous generation files must already have been retired by the
    // independently acknowledged retirement flow. Do not erase or repair them.
    constexpr const char*NAMES[]={"wifi-transaction.v1","wifi-candidate.v1",
      "wifi-primary-armed.v1","wifi-backup-armed.v1","wifi-primary-bound.v1",
      "wifi-backup-bound.v1","wifi-primary-committed.v1","wifi-backup-committed.v1"};
    struct stat st{};
    for(const char*name:NAMES)if(!::fstatat(runtime_,name,&st,AT_SYMLINK_NOFOLLOW) || errno!=ENOENT)return false;
    return true;
  }
  bool exact_plan_(const cgs1_wifi_guard::Plan&observed)const {
    cgs1_wifi_guard::detail::Bytes expected,actual;
    return cgs1_wifi_guard::detail::encode(plan_,expected) &&
      cgs1_wifi_guard::detail::encode(observed,actual) && expected.value==actual.value;
  }
  bool wait_(cgs1_wifi_guard::Stage stage) {
    const auto entered=cgs1_wifi_guard::monotonic_ms();
    if(!entered || entered>UINT64_MAX-3000)return false;
    const auto until=std::min(plan_.deadline_ms,entered+3000);
    for(;;) {
      auto now=cgs1_wifi_guard::monotonic_ms();
      if(!now || now<entered || now>=until)return false;
      if(!live_() || !baseline_())return false;
      if(records_->both_ready(stage,peers_)) {
        if(!live_())return false;
        now=cgs1_wifi_guard::monotonic_ms();return now>=entered && now<until;
      }
      now=cgs1_wifi_guard::monotonic_ms();
      if(!now || now<entered || now>=until)return false;
      // Fixed 3-second absolute bound, never renewed by polling or heartbeat.
      // The existing lease pulse stays live during this synchronous ACK wait.
      // Return to the absolute deadline check after EINTR as well. A signal
      // stream cannot keep restarting a relative sleep beyond this budget.
      timespec delay{0,10000000};if(::nanosleep(&delay,nullptr) && errno!=EINTR)return false;
    }
  }
};
} // namespace cgs1_wifi_prepare
