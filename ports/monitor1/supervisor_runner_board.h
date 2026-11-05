#pragma once

// Production fixed-board binder. Fixture Boards are separate C++ types and
// cannot be selected by an argv, macro in a deployed YAML, or control message.
#include "supervisor_cgs1_board_policy.h"
#include "supervisor_full_plan.h"
#include "supervisor_publishers.h"
#include "supervisor_network_recovery_witness.h"
#include "supervisor_wifi_guard_cache.h"
#include "supervisor_wifi_recovery.h"

namespace cgs1_supervisor {
class Cgs1RunnerBoard {
 public:
  Cgs1RunnerBoard(int runtime,const FullPlan &plan)
      :runtime_(runtime),original_(plan.effects),effects_(hardware_),policy_(effects_),full_(plan) {
    ready_=plan_shape(plan) && effects_.open(runtime,plan.effects);
  }
  bool ready() const{return ready_;}
  const std::string &validation_error()const{return validation_error_;}
  bool configure_network_guardian(RunnerRole role) {
    return ready_ && wifi_journal_.open(runtime_,full_,role==RunnerRole::PRIMARY?
      cgs1_wifi_guard::Role::PRIMARY:cgs1_wifi_guard::Role::BACKUP);
  }
  bool poll_network_guardian(){return ready_ && wifi_journal_.poll();}
  void bind_network_recovery(NetworkRecoveryWitness&&witness) {
    // This alone enables no WPA command. Dedicated recovery must additionally
    // validate FullPlan, boot, immutable Wi-Fi journal, stopped stock writers
    // and the private durable decision before each individual mutation.
    network_recovery_=std::move(witness);
  }
  bool validate_plan(const cgs1_net_trial::StockInspection &plan) const {
    validation_error_.clear();
    if(!ready_){validation_error_="board_not_ready";return false;}
    if(!policy_.validate_plan(plan)){validation_error_=policy_.validation_error();return false;}
    if(!publishers_.capture_or_validate(plan)){validation_error_="publisher_inventory_refused";return false;}
    return true;
  }
  bool exclusive_after_stock_death(const cgs1_net_trial::StockInspection &plan) const {
    return ready_ && policy_.exclusive_after_stock_death(plan);
  }
  bool prepare_frozen_stock(const cgs1_net_trial::StockInspection &plan) {
    cgs1_pm::pinmux::Register mux;
    return ready_ && mux.open() && (mux.read()&cgs1_pm::pinmux::MASK)==original_.pm_mux &&
      cgs1_net_trial::read_small("/sys/class/backlight/rk28_bl/max_brightness",16)=="1000\n" &&
      cgs1_net_trial::read_small("/sys/class/backlight/rk28_bl/brightness",16)==std::to_string(original_.brightness)+"\n" &&
      publishers_.prepare_frozen_stock(plan);
  }
  bool restore_side_effects(const cgs1_net_trial::StockInspection &plan) {
    if(!ready_)return false;
    struct stat entry{};
    if(::fstatat(runtime_,"wifi-transaction.v1",&entry,AT_SYMLINK_NOFOLLOW))
      return errno==ENOENT && policy_.restore_side_effects(plan);
    // Only a verified native death + our own recovery flock can produce the
    // narrow receipt. UNKNOWN/uncertain cleanup leaves the old gate closed;
    // neither a UI ACK nor a cached COMMITTED boolean can resume stock here.
    if(!wifi_recovery_attempted_) {
      wifi_recovery_attempted_=true;
      RunnerWifiRecovery recovery(runtime_,network_recovery_,wifi_journal_);
      (void)recovery.attempt();wifi_receipt_=recovery.receipt();
    }
    return wifi_receipt_ && effects_.restore_before_vendor_start(plan,wifi_receipt_.get());
  }
  bool may_resume_vendor() const{return ready_ && effects_.safe_to_resume_vendor(wifi_receipt_.get());}
  bool prepare_stock_relaunch(const cgs1_net_trial::StockInspection &plan) {
    // The late backup may arrive after a new stock GUI has recreated its
    // helper marker. A committed prepare record MUST suppress another unlink.
    // Before commit the watchdog is still STOPped, so retrying the marker
    // retirement by a new recovery actor cannot affect a fresh GUI.
    constexpr const char *name="vendor-relaunch-prepared";
    constexpr const char proof[]="CGS1_VENDOR_PREPARED_V1\n";
    const int previous=::openat(runtime_,name,O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC);
    if(previous>=0) {
      struct stat info{},entry{},dir{};char data[sizeof(proof)]{};
      const bool valid=!::fstat(previous,&info) && !::fstat(runtime_,&dir) &&
        S_ISREG(info.st_mode) && info.st_uid==0 && (info.st_mode&07777)==0600 &&
        info.st_nlink==1 && info.st_dev==dir.st_dev && info.st_size==ssize_t(sizeof(proof)-1) &&
        ::read(previous,data,sizeof(data))==ssize_t(sizeof(proof)-1) && !std::memcmp(data,proof,sizeof(proof)-1) &&
        !::fstatat(runtime_,name,&entry,AT_SYMLINK_NOFOLLOW) && entry.st_ino==info.st_ino && entry.st_dev==info.st_dev;
      ::close(previous);return valid;
    }
    if(errno!=ENOENT || !ready_ || !policy_.prepare_stock_relaunch(plan))return false;
    const auto temporary="vendor-relaunch.tmp."+std::to_string(::getpid());
    const int output=::openat(runtime_,temporary.c_str(),O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);
    if(output<0)return false;
    const bool written=runner_write_(output,proof,sizeof(proof)-1) && !::fsync(output);
    ::close(output);
    return written && !::renameat(runtime_,temporary.c_str(),runtime_,name) && !::fsync(runtime_);
  }
 private:
  int runtime_;OriginalEffects original_;bool ready_{false};Cgs1EffectHardware hardware_;
  RecoveryEffects<> effects_;Cgs1BoardPolicy<RecoveryEffects<>> policy_;
  mutable PublisherRetirement publishers_;
  mutable std::string validation_error_;
  NetworkRecoveryWitness network_recovery_;
  FullPlan full_;RunnerWifiJournal wifi_journal_;
  bool wifi_recovery_attempted_{false};std::unique_ptr<NetworkRecoveryReceipt>wifi_receipt_;
  static bool runner_write_(int fd,const void *data,size_t size) {
    return ::write(fd,data,size)==ssize_t(size);
  }
};
}  // namespace cgs1_supervisor
