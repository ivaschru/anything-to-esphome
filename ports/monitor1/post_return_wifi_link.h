#pragma once

// Read-only network observation AFTER the actual native owner returned.
// This deliberately does not reuse the native-frozen refresh authority:
// stock writers are running now. No DHCP signal, SELECT, configuration write,
// credential getter or NetworkRecoveryReceipt can be obtained from this type.
// Store reads retain its ordinary private flock/fsync protocol, never publish
// a new credential record. Association alone is not lease/route/gateway proof.
#include "supervisor_returned_session.h"
#include "supervisor_wifi_private_root.h"
#include "wifi_guard_recovery.h"
#include "dhcp_capture_probe.h"

namespace cgs1_returned_wifi {
enum class State {UNOPENED,NO_TRANSACTION,WAITING,ASSOCIATED,COMMITTED,REFUSED,EXPIRED};
enum class Error {NONE,SCOPE,STOCK,EFFECTS,JOURNAL,PRIVATE_ROOT,DECISION};
// Fixed diagnostic labels identify the last read-only binding check. These
// never expose network credentials, packet contents or a reusable authority.
enum class BindingCheck {NONE,CURRENT_BEFORE,DECISION_BEFORE,OWNER_PREPARE,
  OWNER_MATCH,ASSOCIATION_READ,ASSOCIATION_MATCH,CURRENT_AFTER,DECISION_AFTER,SCOPE};

// Pure metadata comparison for tests and the concrete reader below. This is
// not an authority factory: even a true result cannot construct a receipt or
// execute a network action. It accepts only the exact restored original set.
inline bool original_association(const cgs1_wifi_guard::Plan&plan,const cgs1_dhcp_lease::ProbeFence&fence) {
  if(!cgs1_wifi_guard::valid(plan) || fence.boot!=plan.boot_id || !fence.daemon.verified ||
      fence.daemon.process.pid!=long(plan.daemon_pid) || fence.daemon.process.start!=plan.daemon_start ||
      fence.daemon.socket_inode!=plan.socket_inode || fence.association.state!="COMPLETED" ||
      !fence.daemon.process.running() ||
      (fence.daemon.process.executable!="/sbin/wpa_supplicant" &&
       fence.daemon.process.executable!="/usr/sbin/wpa_supplicant" &&
       fence.daemon.process.executable!="/usr/bin/wpa_supplicant") ||
      fence.association.frequency<2412 || fence.association.frequency>2484 ||
      !cgs1_wifi::mac_address(fence.association.bssid))return false;
  const auto selected=cgs1_wifi_recovery::original_current(plan);
  if(selected<0 || fence.association.network_id!=selected ||
      !cgs1_wifi_recovery::shape(plan,fence.profiles,-1,false) ||
      !cgs1_wifi_recovery::restored_flags(plan,fence.profiles))return false;
  const auto*original=cgs1_wifi_recovery::find(plan.original,selected);
  const auto*current=cgs1_wifi_recovery::find(fence.profiles,selected);
  return original && current && current->current && !current->disabled && !current->temporarily_disabled &&
    (original->bssid=="any" || original->bssid==fence.association.bssid);
}

class Observation final {
 public:
  explicit Observation(cgs1_supervisor::ReturnedFullSession scope):scope_(std::move(scope)){}
  Observation(const Observation&)=delete;Observation&operator=(const Observation&)=delete;
  ~Observation(){if(runtime_>=0)::close(runtime_);}
  bool open() {
    if(attempted_)return false;
    attempted_=true;
    if(!scope_.copy_plan(full_) || (runtime_=scope_.duplicate_runtime())<0)return refuse_(Error::SCOPE);
    if(!stock_.inspect() || stock_.boot_id!=full_.stock.boot_id ||
        !same_(stock_.processes[2],full_.stock.processes[2]) ||
        !same_(stock_.processes[3],full_.stock.processes[3]))return refuse_(Error::STOCK);
    if(!effects_())return refuse_(Error::EFFECTS);
    struct stat entry{};
    if(::fstatat(runtime_,"wifi-transaction.v1",&entry,AT_SYMLINK_NOFOLLOW)) {
      if(errno!=ENOENT)return refuse_(Error::JOURNAL);
      if(!scope_.valid())return refuse_(Error::SCOPE);
      state_=State::NO_TRANSACTION;return true;
    }
    if(!journal_.open(runtime_) || !journal_.read(plan_,&stamp_) ||
        plan_.full_session!=full_.nonce || plan_.boot_id!=full_.stock.boot_id ||
        plan_.created_ms<full_.created_ms)return refuse_(Error::JOURNAL);
    if(!private_root_.open())return refuse_(Error::PRIVATE_ROOT);
    const auto decision=decision_();
    if(decision==cgs1_wifi_decision::Decision::UNKNOWN)return refuse_(Error::DECISION);
    state_=decision==cgs1_wifi_decision::Decision::COMMITTED?State::COMMITTED:State::WAITING;
    if(!scope_.valid())return refuse_(Error::SCOPE);
    return true;
  }
  void poll() {
    if(state_!=State::WAITING && state_!=State::ASSOCIATED)return;
    const auto began=cgs1_supervisor::clock_ms();
    if(!began || began<last_poll_ms_){state_=State::EXPIRED;error_=Error::SCOPE;observed_ms_=0;return;}
    if(last_poll_ms_ && began-last_poll_ms_<1000)return;
    last_poll_ms_=began; // At most one Store/procfs/control observation per second.
    observed_ms_=0;state_=State::WAITING; // Revoke a previous snapshot first.
    if(!scope_.valid()){state_=State::EXPIRED;error_=Error::SCOPE;return;}
    if(!current_())return;
    const auto decision=decision_();
    if(decision==cgs1_wifi_decision::Decision::COMMITTED){state_=State::COMMITTED;return;}
    if(decision!=cgs1_wifi_decision::Decision::UNCOMMITTED){refuse_(Error::DECISION);return;}
    // A transient DHCP-owner gap or ongoing association is WAITING, not a
    // fabricated empty configuration or a reason to restart a stock client.
    cgs1_dhcp_lease::ProbeBackend backend;cgs1_dhcp_lease::ProbeFence fence;
    if(!backend.prepare() || !backend.read(fence) || !original_association(plan_,fence))return;
    if(!current_() || decision_()!=cgs1_wifi_decision::Decision::UNCOMMITTED)return;
    const auto now=cgs1_supervisor::clock_ms();
    if(!now || now<began || !scope_.valid()){state_=State::EXPIRED;error_=Error::SCOPE;return;}
    observed_ms_=now;state_=State::ASSOCIATED;
    if(!first_association_ms_)first_association_ms_=now;
    last_association_ms_=now;
  }
  State state()const{return state_;}Error error()const{return error_;}
  uint64_t observed_ms()const{return observed_ms_;}
  // Historical diagnostics survive window expiry so an outside observer can
  // inspect the outcome AFTER a no-host-polling native trial. They never keep
  // ASSOCIATED current, renew scope, or assert DHCP/gateway/commit readiness.
  uint64_t first_association_ms()const{return first_association_ms_;}
  uint64_t last_association_ms()const{return last_association_ms_;}
  bool live_scope()const{return attempted_ && scope_.valid();}
  bool original_binding(const cgs1_net_trial::ProcessIdentity&owner) {
    // A new read-only snapshot, NOT a signal/commit token. The separate
    // post-return adapter must independently bind its own capture, reviewed
    // DHCP state and single-use operation. Historical ASSOCIATED is never
    // reused as a current network fact, including after scope expiry.
    binding_check_=BindingCheck::CURRENT_BEFORE;
    if((state_!=State::WAITING && state_!=State::ASSOCIATED) || !current_())return false;
    binding_check_=BindingCheck::DECISION_BEFORE;
    if(decision_()!=cgs1_wifi_decision::Decision::UNCOMMITTED)return false;
    cgs1_dhcp_lease::ProbeBackend backend;cgs1_dhcp_lease::ProbeFence fence;
    // Preserve the same short-circuit order and every previous predicate;
    // separate statements only make an unavailable snapshot distinguishable
    // from an expired scope in the bounded physical diagnostic report.
    binding_check_=BindingCheck::OWNER_PREPARE;if(!backend.prepare())return false;
    binding_check_=BindingCheck::OWNER_MATCH;if(!backend.owner_matches(owner))return false;
    binding_check_=BindingCheck::ASSOCIATION_READ;if(!backend.read(fence))return false;
    binding_check_=BindingCheck::ASSOCIATION_MATCH;if(!original_association(plan_,fence))return false;
    binding_check_=BindingCheck::CURRENT_AFTER;if(!current_())return false;
    binding_check_=BindingCheck::DECISION_AFTER;
    if(decision_()!=cgs1_wifi_decision::Decision::UNCOMMITTED)return false;
    binding_check_=BindingCheck::SCOPE;return scope_.valid();
  }
  BindingCheck binding_check()const{return binding_check_;}
  // Explicitly no lease, gateway, current_commit_authority or recovery
  // receipt getter. A separate observer must establish those later facts.
 private:
  cgs1_supervisor::ReturnedFullSession scope_;int runtime_{-1};bool attempted_{false};
  cgs1_supervisor::FullPlan full_;cgs1_net_trial::StockInspection stock_;
  cgs1_wifi_guard::Journal journal_;cgs1_wifi_guard::Plan plan_;cgs1_wifi_guard::Stamp stamp_;
  cgs1_supervisor::RunnerWifiPrivateRoot private_root_;
  State state_{State::UNOPENED};Error error_{Error::NONE};uint64_t observed_ms_{0},last_poll_ms_{0};
  BindingCheck binding_check_{BindingCheck::NONE};
  uint64_t first_association_ms_{0},last_association_ms_{0};
  bool refuse_(Error error){state_=State::REFUSED;error_=error;observed_ms_=0;return false;}
  static bool same_(const cgs1_net_trial::ProcessIdentity&a,const cgs1_net_trial::ProcessIdentity&b) {
    return a.pid==b.pid && a.start==b.start && a.executable==b.executable;
  }
  bool current_() {
    if(!scope_.valid() || !private_root_.current())return refuse_(Error::SCOPE);
    // Fingerprints were checked at open. During this short, non-mutating
    // observation bind to those live process births instead of rehashing all
    // stock binaries every loop and adding heat/load to the sensor monitor.
    for(const auto&process:stock_.processes) {
      const auto current=cgs1_net_trial::process_identity(process.pid);
      if(!current.running() || !same_(process,current))return refuse_(Error::STOCK);
    }
    cgs1_wifi_guard::Plan current;cgs1_wifi_guard::Stamp stamp;
    if(!journal_.read(current,&stamp) || !(stamp==stamp_))return refuse_(Error::JOURNAL);
    return scope_.valid();
  }
  cgs1_wifi_decision::Decision decision_()const {
    const int parent=private_root_.duplicate();if(parent<0)return cgs1_wifi_decision::Decision::UNKNOWN;
    cgs1_wifi_private::Store<>store;cgs1_wifi_private::Networks networks;
    const bool opened=store.open_existing(parent,plan_.decision.transaction.c_str());::close(parent);
    if(!opened || store.load(networks)==cgs1_wifi_private::Load::ERROR || !private_root_.current())
      return cgs1_wifi_decision::Decision::UNKNOWN;
    return cgs1_wifi_decision::inspect(plan_.decision,store);
  }
  bool effects_()const {
    constexpr const char*EXPECTED="CGS1_EFFECTS_OK_V1\n";
    const int fd=::openat(runtime_,"effects-result",O_RDONLY|O_NONBLOCK|O_NOFOLLOW|O_CLOEXEC);
    if(fd<0)return false;
    struct stat before{},after{},named{},directory{};char bytes[64]{};
    const bool valid=!::fstat(runtime_,&directory) && !::fstat(fd,&before) && S_ISREG(before.st_mode) &&
      before.st_uid==0 && (before.st_mode&07777)==0600 && before.st_nlink==1 &&
      before.st_dev==directory.st_dev && before.st_size==ssize_t(std::strlen(EXPECTED));
    const auto n=valid?::read(fd,bytes,sizeof(bytes)):-1;
    const bool stable=n==before.st_size && n>0 && !::fstat(fd,&after) &&
      before.st_dev==after.st_dev && before.st_ino==after.st_ino && before.st_size==after.st_size &&
      before.st_mtim.tv_sec==after.st_mtim.tv_sec && before.st_mtim.tv_nsec==after.st_mtim.tv_nsec &&
      before.st_ctim.tv_sec==after.st_ctim.tv_sec && before.st_ctim.tv_nsec==after.st_ctim.tv_nsec &&
      !::fstatat(runtime_,"effects-result",&named,AT_SYMLINK_NOFOLLOW) &&
      named.st_dev==before.st_dev && named.st_ino==before.st_ino && named.st_uid==0 &&
      (named.st_mode&07777)==0600 && named.st_nlink==1 && named.st_size==before.st_size &&
      named.st_mtim.tv_sec==before.st_mtim.tv_sec && named.st_mtim.tv_nsec==before.st_mtim.tv_nsec &&
      named.st_ctim.tv_sec==before.st_ctim.tv_sec && named.st_ctim.tv_nsec==before.st_ctim.tv_nsec &&
      std::memcmp(bytes,EXPECTED,std::strlen(EXPECTED))==0;
    ::close(fd);return stable;
  }
};
} // namespace cgs1_returned_wifi
