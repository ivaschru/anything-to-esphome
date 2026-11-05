#pragma once

// Bounded RAM handoff for the one fingerprinted CGS1. API callers provide
// only the existing job id: no paths, commands, deadlines or executable bytes
// can be selected at launch. StockInspection and Staging own those decisions.
// Preparation is read-only toward stock; the separately tested shell guardian
// is the sole owner of takeover/recovery. Its two timers survive API loss.
#include <signal.h>
#include <sys/wait.h>

#include <map>
#include <set>

#include "network_preflight.h"
#include "thermal_seed_codec.h"
#include "trial_staging.h"

namespace cgs1_net_trial {
inline double kernel_uptime() {
  double value = NAN;
  const auto text = read_small("/proc/uptime", 128);
  return std::sscanf(text.c_str(), "%lf", &value) == 1 && std::isfinite(value)
             ? value
             : NAN;
}

class TrialCoordinator {
public:
  static constexpr int DEADLINE = 90;
  const std::string &error() const { return error_; }
  const std::string &phase() const { return phase_; }
  bool launched() const { return launched_; }
  bool preparing() const { return observer_pid_ > 0; }
  bool prepared() const { return prepared_; }
  bool pm_enabled() const { return pm_enabled_; }
  bool finished() const { return finished_; }

  bool prepare(Staging &stage, const StockInspection &inspection,
               bool pm_enabled) {
    error_.clear();
    if (preparing() || launched_)
      return fail("job_already_preparing_or_launched");
    if (!inspection.verified || !stage.revalidate(stage.job()))
      return fail("fresh_verified_job_required");
    for (const auto &identity : inspection.processes)
      if (!same_process(identity) || !process_identity(identity.pid).running())
        return fail("preparation_process_changed");
    if (!directory_.empty() && directory_ != stage.directory())
      return fail("another_directory_owned");
    directory_ = stage.directory();
    inspection_ = inspection;
    pm_enabled_ = pm_enabled;
    prepared_ = false;
    // Re-preparation may refresh only our exact metadata files. An unexpected
    // inode or a symlink is evidence to preserve, never recursive cleanup.
    if (!clear_metadata())
      return false;
    static constexpr const char *ROLES[] = {"stock", "wrapper", "watchdog",
                                            "bridge"};
    for (size_t i = 0; i < 4; ++i)
      if (!write_private(std::string(ROLES[i]) + ".identity",
                         inspection.processes[i].guard_line()))
        return false;
    if (!write_private("attempted", "/tmp/qingping-pm-helper.attempted\n") ||
        !write_private("pm-state", pm_enabled ? "1\n" : "0\n") ||
        !write_private("drm-publishers", publisher_snapshot()) ||
        !write_private("capture-ui", ""))
      return false;
    const int output = create_private("thermal-seed.partial");
    if (output < 0)
      return false;
    // Copy all argv strings BEFORE fork. The child does only async-signal-safe
    // fd/session/exec operations, never C++ allocation or ESPHome work.
    const std::string executable = directory_ + "/thermal-observer";
    const std::string pid = std::to_string(inspection.processes[0].pid);
    const long limit = descriptor_limit();
    const pid_t child = ::fork();
    if (child == 0) {
      ::setsid();
      ::dup2(output, STDOUT_FILENO);
      int null = ::open("/dev/null", O_RDWR);
      if (null >= 0) {
        ::dup2(null, STDIN_FILENO);
        ::dup2(null, STDERR_FILENO);
      }
      for (int fd = 3; fd < limit; ++fd)
        ::close(fd);
      ::alarm(6);
      ::execl(executable.c_str(), executable.c_str(), "--seed", pid.c_str(),
              static_cast<char *>(nullptr));
      ::_exit(127);
    }
    ::close(output);
    if (child < 0)
      return fail("observer_fork_failed");
    observer_pid_ = child;
    observer_started_ = kernel_uptime();
    phase_ = "capturing-thermal-state";
    return true;
  }

  void poll() {
    if (observer_pid_ > 0) {
      int status = 0;
      const pid_t result = ::waitpid(observer_pid_, &status, WNOHANG);
      if (result == 0) {
        if (kernel_uptime() - observer_started_ > 8) {
          // An unreaped direct child cannot have its PID reused. Do not signal
          // a process merely because its name resembles our helper.
          ::kill(observer_pid_, SIGKILL);
          phase_ = "observer-timeout";
        }
        return;
      }
      observer_pid_ = 0;
      if (result < 0 || !WIFEXITED(status) || WEXITSTATUS(status) != 0) {
        fail("thermal_observer_failed");
        phase_ = "preparation-failed";
        return;
      }
      cgs1_thermal::HandoffState seed;
      const std::string text =
          read_small(directory_ + "/thermal-seed.partial", 2048);
      if (!cgs1_thermal::parse_handoff(text, inspection_.boot_id,
                                       kernel_uptime(), seed)) {
        fail("thermal_seed_invalid");
        phase_ = "preparation-failed";
        return;
      }
      for (const auto &identity : inspection_.processes)
        if (!same_process(identity)) {
          fail("stock_changed_during_capture");
          phase_ = "preparation-failed";
          return;
        }
      if (!write_private("thermal-seed", text)) {
        phase_ = "preparation-failed";
        return;
      }
      prepared_ = true;
      phase_ = "prepared";
    }
    if (controller_pid_ > 0) {
      int status;
      if (::waitpid(controller_pid_, &status, WNOHANG) != 0)
        controller_pid_ = 0;
    }
    // Do not infer successful recovery from a timer or lost TCP connection.
    // The bridge checks a fresh full stock inspection before releasing PM.
    if (launched_ && !finished_ &&
        read_small(directory_ + "/backup-finished", 64) == "done\n") {
      StockInspection after;
      if (after.inspect() && after.boot_id == inspection_.boot_id &&
          after.processes[2].start == inspection_.processes[2].start) {
        finished_ = true;
        phase_ = "stock-restored";
      } else {
        error_ = "stock_recovery_not_yet_verified";
      }
    }
  }

  // Called only after StockPMControl has atomically blocked new writes and
  // confirmed no queued/in-flight command and the same state used by prepare.
  bool launch(Staging &stage) {
    error_.clear();
    if (!prepared_ || preparing() || launched_)
      return fail("prepared_unlaunched_job_required");
    if (!stage.revalidate(stage.job()))
      return fail(stage.error());
    cgs1_thermal::HandoffState seed;
    if (!cgs1_thermal::parse_handoff(
            read_small(directory_ + "/thermal-seed", 2048), inspection_.boot_id,
            kernel_uptime(), seed))
      return fail("fresh_thermal_seed_required");
    for (const auto &identity : inspection_.processes)
      if (!same_process(identity) || !process_identity(identity.pid).running())
        return fail("launch_process_changed");
    const std::string guard = directory_ + "/guard.sh";
    const long limit = descriptor_limit();
    int log = create_private("controller.log");
    if (log < 0)
      return false;
    // The acknowledged launch is never replayable. Even a later fork/exec
    // failure retains this decision so reconnect must inspect actual state.
    launched_ = true;
    const pid_t child = ::fork();
    if (child == 0) {
      ::setsid();
      int null = ::open("/dev/null", O_RDWR);
      if (null >= 0)
        ::dup2(null, STDIN_FILENO);
      ::dup2(log, STDOUT_FILENO);
      ::dup2(log, STDERR_FILENO);
      for (int fd = 3; fd < limit; ++fd)
        ::close(fd);
      ::execl("/bin/sh", "/bin/sh", guard.c_str(), directory_.c_str(), "90",
              static_cast<char *>(nullptr));
      ::_exit(127);
    }
    ::close(log);
    if (child < 0) {
      // No child exists and no signal/hardware action has happened. Retain
      // the one-shot decision but let the bridge read fresh PM state again.
      finished_ = true;
      phase_ = "launch-failed-before-child";
      return fail("controller_fork_failed");
    }
    controller_pid_ = child;
    phase_ = "launch-requested";
    return true;
  }

  bool request_recovery() {
    if (!launched_ || finished_)
      return fail("no_active_trial");
    if (owned_.count("recover-now"))
      return true;
    return write_private("recover-now", "requested\n");
  }
  // Diagnostics can fetch only these fixed small logs, never an arbitrary
  // filename, credentials, compiled ELF or general-purpose directory listing.
  std::string diagnostic(const std::string &name) const {
    static const std::set<std::string> NAMES = {
        "phase",          "program.log",    "guardian.log", "backup.log",
        "controller.log", "recovery-error", "trial-exit",   "recovered",
        "pm-power-armed", "pm-power-restored", "pm-power-recovery-error",
        "wifi-ram-armed", "wifi-ram-restored", "wifi-ram-guard-verified", "wifi-ram-recovery-error", "wifi-ram-phase"};
    return !directory_.empty() && NAMES.count(name)
               ? read_small(directory_ + "/" + name, 49152)
               : "";
  }
  bool reset_preparation() {
    if (preparing() || launched_)
      return fail("trial_evidence_preserved");
    if (!clear_metadata())
      return false;
    directory_.clear();
    prepared_ = false;
    phase_ = "idle";
    return true;
  }

private:
  std::string directory_, error_, phase_{"idle"};
  StockInspection inspection_;
  bool pm_enabled_{false}, prepared_{false}, launched_{false}, finished_{false};
  pid_t observer_pid_{0}, controller_pid_{0};
  double observer_started_{0};
  // Metadata is bounded and never includes files created by the trial itself.
  // Post-trial artifacts stay available for explicit evidence/cleanup review.
  std::map<std::string, std::pair<dev_t, ino_t>> owned_;
  bool fail(const std::string &reason) {
    error_ = reason;
    return false;
  }
  static long descriptor_limit() {
    return std::clamp(::sysconf(_SC_OPEN_MAX), 256L, 65536L);
  }
  int create_private(const std::string &name) {
    int fd = ::open((directory_ + "/" + name).c_str(),
                    O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0600);
    if (fd < 0) {
      fail("metadata_creation_failed_" + name);
      return -1;
    }
    struct stat info{};
    if (::fstat(fd, &info)) {
      ::close(fd);
      fail("metadata_identity_failed");
      return -1;
    }
    owned_[name] = {info.st_dev, info.st_ino};
    return fd;
  }
  bool write_private(const std::string &name, const std::string &text) {
    int fd = create_private(name);
    if (fd < 0)
      return false;
    size_t offset = 0;
    while (offset < text.size()) {
      ssize_t n = ::write(fd, text.data() + offset, text.size() - offset);
      if (n < 0 && errno == EINTR)
        continue;
      if (n <= 0) {
        ::close(fd);
        return fail("metadata_write_failed");
      }
      offset += size_t(n);
    }
    ::close(fd);
    return true;
  }
  bool clear_metadata() {
    for (const auto &entry : owned_) {
      struct stat actual{};
      const auto path = directory_ + "/" + entry.first;
      if (::lstat(path.c_str(), &actual) || !S_ISREG(actual.st_mode) ||
          actual.st_dev != entry.second.first ||
          actual.st_ino != entry.second.second)
        return fail("metadata_identity_changed");
    }
    for (const auto &entry : owned_)
      if (::unlink((directory_ + "/" + entry.first).c_str()))
        return fail("metadata_cleanup_failed");
    owned_.clear();
    return true;
  }
  static std::string publisher_snapshot() {
    // Only inherited DRM fds of the exact vendor port6868 publisher may be
    // retired by the already tested UI backend after stock exits.
    std::string text;
    DIR *dir = ::opendir("/proc");
    if (!dir)
      return text;
    int count = 0;
    while (const auto *entry = ::readdir(dir)) {
      const std::string name = entry->d_name;
      if (name.empty() ||
          name.find_first_not_of("0123456789") != std::string::npos)
        continue;
      const auto identity =
          process_identity(std::strtol(name.c_str(), nullptr, 10));
      if (identity.executable != "/usr/bin/avahi-publish" ||
          !identity.running())
        continue;
      const auto args = process_arguments(identity.pid);
      if (args.size() != 6 ||
          args[0].substr(args[0].find_last_of('/') + 1) !=
              "avahi-publish-service" ||
          args[3] != "6868" || args[4].rfind("mac=", 0) != 0 ||
          args[5].rfind("port=", 0) != 0)
        continue;
      const auto path = "/proc/" + name + "/fd";
      DIR *fds = ::opendir(path.c_str());
      bool holds_drm = false;
      if (fds) {
        while (const auto *fd = ::readdir(fds))
          if (read_link(path + "/" + fd->d_name) == "/dev/dri/card0")
            holds_drm = true;
        ::closedir(fds);
      }
      if (holds_drm && same_process(identity) && ++count <= 8)
        text += std::to_string(identity.pid) + " " +
                std::to_string(identity.start) + "\n";
    }
    ::closedir(dir);
    return text;
  }
};
} // namespace cgs1_net_trial
