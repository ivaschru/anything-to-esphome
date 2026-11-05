#pragma once

// Fixed verified CGS1 board adapter for VendorTakeover. No API/environment
// selector can substitute device IDs, executable paths, files or register
// addresses. RecoveryActions is the runner's sealed-journal recovery object;
// its implementation must independently fence native death/sole recovery
// and restore only armed PM/mux/Wi-Fi/brightness changes before returning.
#include "supervisor_vendor_takeover.h"
#include "display_ownership.h"

namespace cgs1_supervisor {
template<class RecoveryActions> class Cgs1BoardPolicy {
 public:
  explicit Cgs1BoardPolicy(RecoveryActions &recovery) : recovery_(recovery) {}
  const std::string &validation_error() const {return validation_error_;}

  bool validate_plan(const cgs1_net_trial::StockInspection &plan) const {
    validation_error_.clear();
    if (!plan.verified || plan.processes[3].pid <= 1) return validation_fail_("unverified_plan");
    cgs1_net_trial::StockInspection fresh;
    // Includes exact device/stock version/six critical SHA, process root
    // ownership, stock-wrapper argv/relation, watchdog and helper state.
    if (!fresh.inspect_for_bridge(plan.processes[3].pid))
      return validation_fail_("stock_inspection:"+fresh.error);
    if (fresh.boot_id != plan.boot_id) return validation_fail_("boot_identity_changed");
    if (fresh.bridge_sha != plan.bridge_sha) return validation_fail_("bridge_fingerprint_changed");
    for (unsigned i=0;i<4;++i) {
      const auto &a=plan.processes[i], &b=fresh.processes[i];
      if (a.pid!=b.pid || a.start!=b.start || a.parent!=b.parent || a.executable!=b.executable)
        return validation_fail_("process_identity_changed_role_"+std::to_string(i));
    }
    const auto display=cgs1_net_trial::DisplayMaintenance::handoff_objection(fresh);
    return display.empty() || validation_fail_("display_handoff:"+display);
  }

  bool exclusive_after_stock_death(const cgs1_net_trial::StockInspection &) const {
    // Even a recognised inherited publisher must be retired before this
    // point. A recognised owner is not equivalent to an unowned display.
    std::vector<cgs1_net_trial::DisplayOwner> owners;
    if (!cgs1_net_trial::display_owners(owners) || !owners.empty()) return false;
    return no_uart_owners_();
  }

  bool restore_side_effects(const cgs1_net_trial::StockInspection &plan) {
    return recovery_.restore_before_vendor_start(plan);
  }
  bool may_resume_vendor() const {return recovery_.safe_to_resume_vendor();}

  bool prepare_stock_relaunch(const cgs1_net_trial::StockInspection &) {
    // Only the existing verified one-shot helper marker is retired. There is
    // no shell, script execution, new SnowApp spawner or user-selected path.
    constexpr const char *path="/tmp/qingping-pm-helper.attempted";
    struct stat info{};
    if (::lstat(path,&info)) return errno==ENOENT;
    if (!S_ISREG(info.st_mode) || info.st_uid!=0 || info.st_nlink!=1) return false;
    return !::unlink(path);
  }

 private:
  RecoveryActions &recovery_;
  // Values come only from compiled diagnostic labels above/StockInspection.
  // Never copy argv, credentials, file contents or user text into this field.
  mutable std::string validation_error_;
  bool validation_fail_(const std::string &why) const {validation_error_=why;return false;}
  static bool no_uart_owners_() {
    std::array<dev_t,2> devices{};
    unsigned port=0;
    for(const char *node:{"/dev/ttyS0","/dev/ttyS2"}) {
      struct stat info{};
      if(::lstat(node,&info) || !S_ISCHR(info.st_mode) || info.st_uid!=0)return false;
      devices[port++]=info.st_rdev;
    }
    DIR *proc=::opendir("/proc");if(!proc)return false;
    bool clean=true;unsigned processes=0,descriptors=0;
    while(clean) {
      const auto *entry=::readdir(proc);if(!entry)break;
      const std::string name=entry->d_name;
      if(name.empty() || name.find_first_not_of("0123456789")!=std::string::npos)continue;
      if(++processes>1024){clean=false;break;}
      const auto path="/proc/"+name+"/fd";
      DIR *fds=::opendir(path.c_str());
      if(!fds) {
        // An exited process is ordinary; denied/unreadable is not an empty
        // descriptor table and must not grant exclusive UART ownership.
        if(errno!=ENOENT && errno!=ESRCH)clean=false;
        continue;
      }
      while(const auto *fd=::readdir(fds)) {
        if(fd->d_name[0]=='.')continue;
        if(++descriptors>8192){clean=false;break;}
        // stat follows the proc FD link WITHOUT opening the device. Compare
        // rdev, not path text: an alias of the same UART is still a reader.
        struct stat target{};
        if(::stat((path+"/"+fd->d_name).c_str(),&target)) {
          if(errno!=ENOENT && errno!=ESRCH){clean=false;break;}
          continue;
        }
        if(S_ISCHR(target.st_mode) && (target.st_rdev==devices[0] || target.st_rdev==devices[1])) {
          clean=false;break;
        }
      }
      ::closedir(fds);
    }
    ::closedir(proc);return clean;
  }
};
}  // namespace cgs1_supervisor
