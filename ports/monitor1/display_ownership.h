#pragma once

// Inventory only DRM file descriptors and public process identity. Never read
// process environments, device credentials, Wi-Fi settings or arbitrary RAM.
// One separately gated repair uses the fingerprinted vendor client_restart
// command arguments, with exact PID/start/executable signals instead of the
// vendor shell's name-based ps/grep. All API/DRM descriptors close before exec.
#include <signal.h>
#include <sys/wait.h>
#include <algorithm>
#include <cmath>
#include "network_preflight.h"
#include "display_handoff_settle.h"

namespace cgs1_net_trial {
inline size_t drm_descriptor_count(long pid, const std::string& target = "/dev/dri/card0") {
  const auto path = "/proc/" + std::to_string(pid) + "/fd";
  DIR* directory = ::opendir(path.c_str());
  if (!directory) return 0;
  size_t count = 0;
  while (const auto* entry = ::readdir(directory))
    if (read_link(path + "/" + entry->d_name) == target) ++count;
  ::closedir(directory);
  return count;
}

struct DisplayOwner { ProcessIdentity process; size_t descriptors; };
inline bool display_owners(std::vector<DisplayOwner>& result, const std::string& target = "/dev/dri/card0") {
  result.clear();
  DIR* directory = ::opendir("/proc");
  if (!directory) return false;
  bool complete = true;
  while (const auto* entry = ::readdir(directory)) {
    const std::string name = entry->d_name;
    if (name.empty() || name.find_first_not_of("0123456789") != std::string::npos) continue;
    if (name == "1") {
      if (drm_descriptor_count(1, target)) { complete = false; break; }
      continue; // PID 1 is never a candidate for repair/signals.
    }
    const auto identity = process_identity(std::strtol(name.c_str(), nullptr, 10));
    if (!identity.pid || identity.executable.empty()) continue;
    const size_t descriptors = drm_descriptor_count(identity.pid, target);
    if (!descriptors || !same_process(identity)) continue;
    if (result.size() >= 32) { complete = false; break; }
    result.push_back({identity, descriptors});
  }
  ::closedir(directory);
  return complete;
}

inline bool vendor_publisher(const ProcessIdentity& identity) {
  if (identity.executable != "/usr/bin/avahi-publish") return false;
  const auto args = process_arguments(identity.pid);
  return args.size() == 6 && args[0].substr(args[0].find_last_of('/') + 1) == "avahi-publish-service" &&
         args[3] == "6868" && args[4].rfind("mac=", 0) == 0 && args[5].rfind("port=", 0) == 0;
}

struct VerifiedCGS1MiioPolicy {
  static constexpr const char* CLIENT = "/data/bin/miio/miio_client";
  static constexpr const char* SCRIPT = "/data/bin/miio/miio.sh";
  static std::string client_sha() { return "5ae9e9c15187879a092aebb502f59d7eafdfab8b13ed9453ad5e7d9d263c14d4"; }
  static std::string script_sha() { return "259a9b14c00d04d5dc60181638347fb769a80b68bb891d42be70ffbfd089e6d0"; }
};
// Policy selection exists only in compiled C++ fixture tests. The firmware
// exposes the fixed VerifiedCGS1 alias below: no API/env/config bypass exists.
template<class Policy> class BasicDisplayMaintenance {
 public:
  static constexpr const char* CLIENT=Policy::CLIENT;
  static constexpr const char* SCRIPT=Policy::SCRIPT;
  static std::vector<std::string> client_arguments() {
    return {CLIENT, "-o", "DISABLE_PSM", "-d", "/data/etc/miio/", "-l", "0", "-L",
            "/var/log/miio_client.log", "-s", "1024", "-D"};
  }
  const std::string& error() const { return error_; }
  const std::string& state() const { return state_; }
  bool attempted() const { return attempted_; }
  bool busy() const { return child_ > 0 || state_ == "stopping-client" || state_ == "verifying-client"; }
  long old_pid() const { return original_.pid; }
  long new_pid() const { return replacement_.pid; }
  bool inventory(std::vector<DisplayOwner>& owners) { return display_owners(owners); }

  // Stock and the explicitly recognized publishers are the only allowed DRM
  // owners before handoff. A separate miio client or an unknown inherited fd
  // blocks takeover BEFORE any stock STOP/KILL, instead of guessing later.
  static std::string handoff_inventory(const StockInspection& stock, std::vector<DisplayOwner>& owners) {
    return settle_display_handoff([&]() -> std::string {
      if (!display_owners(owners)) return "display_inventory_incomplete";
      for (const auto& owner : owners) {
        if (owner.process.pid == stock.processes[0].pid && owner.process.start == stock.processes[0].start) continue;
        if (vendor_publisher(owner.process)) continue;
        if (owner.process.executable == CLIENT) return "inherited_miio_drm_cleanup_required";
        return "unexpected_drm_owner_blocks_trial";
      }
      return {};
    }, [&]() { return stock.verified && same_process(stock.processes[0]); }, []() {
      // /proc/uptime is read-only and monotonic on the admitted old kernel.
      double seconds=0;
      const auto text=read_small("/proc/uptime",128);
      return std::sscanf(text.c_str(),"%lf",&seconds)==1 && std::isfinite(seconds) && seconds>0
        ? uint64_t(seconds*1000):uint64_t(0);
    }, []() { ::usleep(50000); });
  }
  static std::string handoff_objection(const StockInspection& stock) {
    std::vector<DisplayOwner> owners;
    return handoff_inventory(stock,owners);
  }
  bool start(const StockInspection& stock) {
    error_.clear();
    if (!stock.verified || busy() || attempted_) return fail("cleanup_already_requested_or_unverified");
    if (sha_file(CLIENT) != Policy::client_sha() || sha_file(SCRIPT) != Policy::script_sha())
      return fail("unverified_miio_client_or_script");
    // Verify exactly one known binary and its whole argv without sending argv
    // to the caller. Do not execute the vendor script's ps/grep kill loop.
    const auto clients=client_processes();
    if(clients.size()!=1)return fail("miio_client_not_unique");
    original_ = clients.front();
    if (!original_.running() || process_arguments(original_.pid) != client_arguments())
      return fail("miio_identity_or_arguments_changed");
    if (!drm_descriptor_count(original_.pid)) { state_ = "already-clean"; return true; }
    for (const auto& identity : stock.processes)
      if (!same_process(identity) || !process_identity(identity.pid).running())
        return fail("stock_changed_before_cleanup");
    attempted_ = true; // Retain the decision before any possibly ambiguous result.
    started_ = uptime();
    state_ = "stopping-client";
    if (!same_process(original_) || ::kill(original_.pid,SIGTERM)) {
      state_="cleanup-needs-review";return fail("original_client_changed_before_signal");
    }
    return true;
  }
  void poll() {
    const double now = uptime();
    if (!busy() || !std::isfinite(now) || now - last_poll_ < .5) return;
    last_poll_ = now;
    if (state_=="stopping-client") {
      if (same_process(original_)) {
        if(now-started_>4){state_="cleanup-needs-review";fail("original_client_did_not_exit_no_forced_kill");}
        return;
      }
      // If the vendor already restarted a clean client, adopt that observed
      // result rather than creating a duplicate. An unexpected client blocks.
      const auto clients=client_processes();
      if(clients.size()>1){state_="cleanup-needs-review";fail("multiple_clients_no_duplicate_spawn");return;}
      if(!clients.empty()) {
        replacement_=clients.front();
        if(process_arguments(replacement_.pid)==client_arguments() && !drm_descriptor_count(replacement_.pid))
          state_="restarted-clean";
        else {state_="cleanup-needs-review";fail("replacement_client_not_verified_no_duplicate_spawn");}
        return;
      }
      const long limit=std::clamp(::sysconf(_SC_OPEN_MAX),256L,65536L);
      const pid_t child=::fork();
      if(child==0) {
        ::setsid();int null=::open("/dev/null",O_RDWR);
        if(null>=0)for(int fd=0;fd<3;++fd)::dup2(null,fd);
        for(int fd=3;fd<limit;++fd)::close(fd);
        ::alarm(20);
        ::execl(CLIENT,CLIENT,"-o","DISABLE_PSM","-d","/data/etc/miio/","-l","0","-L",
                "/var/log/miio_client.log","-s","1024","-D",static_cast<char*>(nullptr));
        ::_exit(127);
      }
      if(child<0){state_="cleanup-needs-review";fail("clean_client_fork_failed");return;}
      child_=child;state_="starting-client";return;
    }
    if (child_ > 0) {
      int status = 0;
      const pid_t result = ::waitpid(child_, &status, WNOHANG);
      if (!result && now - started_ < 22) return;
      if (!result) { ::kill(child_, SIGKILL); return; } // unreaped owned child, PID cannot be reused
      child_ = 0;
      state_ = "verifying-client";
    }
    replacement_ = unique_process(CLIENT);
    if (replacement_.running() && process_arguments(replacement_.pid) == client_arguments() &&
        !drm_descriptor_count(replacement_.pid) && !same_process(original_)) {
      state_ = "restarted-clean";
      return;
    }
    if (now - started_ > 28) {
      state_ = "cleanup-needs-review";
      fail("client_restart_result_not_verified_no_retry");
    }
  }

 private:
  ProcessIdentity original_, replacement_;
  std::string error_, state_{"idle"};
  pid_t child_{0};
  bool attempted_{false};
  double started_{0}, last_poll_{0};
  bool fail(const char* reason) { error_ = reason; return false; }
  static double uptime() {
    double value = NAN;
    const auto text = read_small("/proc/uptime", 128);
    return std::sscanf(text.c_str(), "%lf", &value) == 1 ? value : NAN;
  }
  static std::vector<ProcessIdentity> client_processes() {
    std::vector<ProcessIdentity> result;DIR* directory=::opendir("/proc");
    if(!directory)return result;
    while(const auto* entry=::readdir(directory)) {
      std::string name=entry->d_name;
      if(name.empty() || name.find_first_not_of("0123456789")!=std::string::npos)continue;
      const auto identity=process_identity(std::strtol(name.c_str(),nullptr,10));
      if(identity.executable==CLIENT)result.push_back(identity);
      if(result.size()>2)break;
    }
    ::closedir(directory);return result;
  }
};
using DisplayMaintenance=BasicDisplayMaintenance<VerifiedCGS1MiioPolicy>;
}  // namespace cgs1_net_trial
