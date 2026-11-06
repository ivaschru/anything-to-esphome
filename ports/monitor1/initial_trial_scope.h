#pragma once
#if defined(__linux__)

// Joined READ-ONLY pre-start device evidence, not a standalone guardian or
// launch adapter. The caller still needs the exact independently validated
// host USB/plan/commit receipts. A matching plan marker is not authentication
// of arbitrary caller-supplied fields or permission to execute a program.
#include "initial_trial_device.h"
#include "initial_trial_stock.h"
#include "initial_trial_filesystem.h"
#include "initial_trial_ram_scope.h"
#include "initial_trial_resources.h"
#include "initial_trial_exec.h"

namespace cgs1_initial_trial {
struct InitialScopeBinding {
  InitialDeviceIdentity device;InitialStockIdentity stock;
  InitialFilesystemBinding filesystem;
  std::string ram_job_id;DirectoryIdentity ram;
};
struct InitialScopeObservation {
  bool verified{false};uint64_t conservative_free_bytes{0},observed_at_ms{0};
  const char *error{"unobserved"};
};
template<long DataFilesystem=0xef53,long ProcFilesystem=0x9fa0,
         long SysFilesystem=0x62656572,long AnchorFilesystem=0>
class BasicInitialPrestartScope {
 public:
  using SelfReader=BasicInitialGuardianSelf<ProcFilesystem!=0x9fa0>;
  // An admission freshness window, checked AFTER reads return. It is not a
  // measured monitor latency, hard IO timeout or independent stop deadline.
  inline static constexpr uint64_t WINDOW_MS=5000;
  BasicInitialPrestartScope()=default;
  BasicInitialPrestartScope(const BasicInitialPrestartScope &)=delete;
  BasicInitialPrestartScope &operator=(const BasicInitialPrestartScope &)=delete;
  ~BasicInitialPrestartScope(){if(fixture_proc_>=0)::close(fixture_proc_);}
  const char *error() const{return error_;}
  bool open(const InitialScopeBinding &binding,SelfReader *self=nullptr) {
    if(!begin_(binding))return false;
    if(!device_.open(binding.device) || !vendor_.open() || !filesystem_.open(binding.filesystem) ||
       !named_ram_.open(binding.ram_job_id,binding.ram) || !admit_fds_() ||
       !stock_.open(binding.stock,vendor_,self))return refuse_("initial_join_readers_unverified");
    verified_=true;error_="";return current();
  }
  template<long Magic=DataFilesystem,std::enable_if_t<Magic==DataFilesystem && Magic!=0xef53 &&
      ProcFilesystem!=0x9fa0 && SysFilesystem!=0x62656572 && AnchorFilesystem!=0,int> =0>
  bool open_fixture_root(int root,int proc,int watchdog,const InitialScopeBinding &binding,
      const std::array<InitialVendorPin,9> &pins,const std::string &stock_path,const std::string &watchdog_path,
      SelfReader *self=nullptr) {
    // All filesystem types must be explicitly non-production at compile time.
    // No CLI, environment flag, production root/hash/CPU override or fallback.
    if(!begin_(binding))return false;
    fixture_proc_=::fcntl(proc,F_DUPFD_CLOEXEC,3);
    if(fixture_proc_<0 || !device_.open_fixture_root(root,binding.device,"armv7l") ||
       !vendor_.open_fixture_root(root,pins) || !filesystem_.open_fixture_root(root,binding.filesystem) ||
       !named_ram_.open_fixture_root(root,binding.ram_job_id,binding.ram) || !admit_fds_() ||
       !stock_.open_fixture_root(proc,watchdog,binding.stock,vendor_,stock_path,watchdog_path,self))
      return refuse_("synthetic_join_readers_unverified");
    verified_=true;error_="";return current();
  }
  bool current() {
    if(!verified_)return false;
    const auto started=cgs1_supervisor::process_tree_clock_ms();
    const auto before=resources_();
    if(!started || !before.verified || before.observed_at_ms<started || !parts_(false))
      return refuse_("prestart_scope_or_initial_resources_changed");
    const auto after=resources_();const auto finished=cgs1_supervisor::process_tree_clock_ms();
    if(!after.verified || !finished || finished<started || finished-started>WINDOW_MS ||
       after.observed_at_ms<before.observed_at_ms || after.observed_at_ms>finished)
      return refuse_("prestart_scope_stale_or_final_resources_unverified");
    observation_={true,std::min(before.conservative_free_bytes,after.conservative_free_bytes),finished,""};
    return true;
  }
  InitialScopeObservation read() {
    if(!current())return {false,0,0,error_};
    return observation_; // A fresh read, never an old serialized positive or execution grant.
  }
  int duplicate_verified_root_fd() {
    if(!current())return -1;
    const int fd=filesystem_.duplicate_verified_root_fd();
    if(fd>=0 && !current()){::close(fd);return -1;}
    return fd;
  }
  bool prepare_entry(BasicInitialBridgeEntry<DataFilesystem> &entry) {
    if(entry_attempted_)return refuse_("prestart_entry_prepare_consumed_no_retry");
    entry_attempted_=true;
    // Inert fd entry only. No intent claim/fork/start occurs here, and the
    // caller's actual guardian identity/host authorization remain unproven.
    return (current() && entry.prepare(image_,ram_) && current()) || refuse_("prestart_inert_entry_unverified");
  }
  bool acknowledge_intent(BasicInitialTrialIntent<DataFilesystem> &intent) {
    if(intent_attempted_)return refuse_("prestart_intent_join_consumed_no_retry");
    intent_attempted_=true;
    const auto started=cgs1_supervisor::process_tree_clock_ms();const auto before=resources_();
    // Do NOT call filesystem.current() after a claim but before its explicit
    // transition: the new unknown marker correctly refuses an ordinary read.
    // The actual creator object, root/plan/bridge, boot AND RAM must all match.
    if(!verified_ || !started || !before.verified || before.observed_at_ms<started ||
       !intent.matches_prestart_binding(binding_.filesystem.root,binding_.filesystem.plan_id,
         binding_.filesystem.plan_sha256,binding_.filesystem.payload[0].sha256,binding_.device.boot_id,binding_.ram) ||
       !parts_(true) || !filesystem_.acknowledge_intent(intent))return refuse_("exact_prestart_intent_join_unverified");
    const auto now=cgs1_supervisor::process_tree_clock_ms();
    if(!now || now<started || now-started>WINDOW_MS)return refuse_("prestart_intent_join_stale");
    return current();
  }
 private:
  InitialScopeBinding binding_{};InitialScopeObservation observation_{};
  bool attempted_{false},verified_{false},entry_attempted_{false},intent_attempted_{false};
  int fixture_proc_{-1};const char *error_{"unobserved"};
  BasicInitialDeviceIdentity<DataFilesystem,ProcFilesystem,SysFilesystem> device_;
  BasicInitialVendorFiles<DataFilesystem> vendor_;
  BasicInitialFilesystem<DataFilesystem> filesystem_;
  BasicInitialRamScope<AnchorFilesystem> named_ram_;
  BasicInitialBridgeImage<DataFilesystem> image_;InitialRamDirectory ram_;
  BasicInitialStockSession<ProcFilesystem,DataFilesystem> stock_;
  BasicInitialKernelResources<ProcFilesystem> kernel_;
  bool refuse_(const char *reason) {
    verified_=false;observation_={false,0,0,reason};error_=reason;return false;
  }
  bool begin_(const InitialScopeBinding &binding) {
    if(attempted_)return refuse_("prestart_scope_open_consumed_no_retry");
    attempted_=true;
    if(!binding.device.valid() || !binding.stock.valid() || !binding.ram.device || !binding.ram.inode ||
       binding.ram_job_id.size()!=32 || binding.ram_job_id.find_first_not_of("0123456789abcdef")!=std::string::npos)
      return refuse_("exact_prestart_binding_required");
    binding_=binding;return true;
  }
  bool admit_fds_() {
    const int root=filesystem_.duplicate_verified_root_fd();
    const int job=named_ram_.duplicate_verified_read_fd();const auto &pin=binding_.filesystem.payload[0];
    bool okay=root>=0 && job>=0 && image_.open(root,binding_.filesystem.root,pin.bytes,pin.sha256) &&
      ram_.open(job,binding_.ram);
    for(int fd:{job,root})if(fd>=0 && ::close(fd))okay=false;
    return okay;
  }
  InitialResourceObservation resources_() const {
    if constexpr(ProcFilesystem==0x9fa0)return kernel_.read();
    else return kernel_.read_fixture_root(fixture_proc_);
  }
  bool parts_(bool joining_intent) {
    // Fixed readers were opened from THIS binding, with image/RAM fds from
    // its actual named roots. Finish with independent device/vendor/name
    // rechecks. This never replaces the host's USB/plan authentication.
    return device_.current() && vendor_.current() && (joining_intent || filesystem_.current()) &&
      named_ram_.current() && image_.current() && ram_.current() && stock_.current() &&
      image_.current() && named_ram_.current() && (joining_intent || filesystem_.current()) &&
      vendor_.current() && device_.current();
  }
};
using InitialPrestartScope=BasicInitialPrestartScope<>;
// Pre-start only. Once the program runs, RAM is no longer empty and its API
// is in use. A future guardian needs actual kernel-child/endpoint ownership,
// an independent stop timer and authenticated live samples, not this reader
// on a blocking timer loop. No host USB proof, self-image admission, fork or
// hardware qualification is created by this source.
}  // namespace cgs1_initial_trial
#endif
