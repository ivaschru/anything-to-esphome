#pragma once

// Read-only evidence for a network handoff on the one verified CGS1. This is
// deliberately independent of ESPHome so proc parsing and identity checks can
// be exercised without a monitor. Nothing here sends signals or reads an INI,
// process environment, command payload, Wi-Fi password or MiIO/API key.
#include <dirent.h>
#include <fcntl.h>
#include <openssl/evp.h>
#include <sys/stat.h>
#include <unistd.h>

#include <array>
#include <cerrno>
#include <climits>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <sstream>
#include <string>
#include <vector>
#include "device_profile.h"

namespace cgs1_net_trial {
inline std::string read_small(const std::string& path, size_t limit = 4096) {
  int fd = ::open(path.c_str(), O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
  if (fd < 0) return {};
  std::string text;
  std::array<char, 512> bytes{};
  bool okay = true;
  for (;;) {
    const ssize_t count = ::read(fd, bytes.data(), bytes.size());
    if (count < 0 && errno == EINTR) continue;
    if (count < 0 || text.size() + size_t(count) > limit) {
      okay = false;
      break;
    }
    if (!count) break;
    text.append(bytes.data(), size_t(count));
  }
  ::close(fd);
  return okay ? text : std::string{};
}

inline std::string read_link(const std::string& path) {
  std::array<char, PATH_MAX> value{};
  const ssize_t count = ::readlink(path.c_str(), value.data(), value.size());
  return count > 0 && count < ssize_t(value.size()) ? std::string(value.data(), size_t(count))
                                                    : std::string{};
}

inline std::string sha_file(const std::string& path) {
  int fd = ::open(path.c_str(), O_RDONLY | O_NOFOLLOW | O_CLOEXEC);
  if (fd < 0) return {};
  struct stat info{};
  if (::fstat(fd, &info) || !S_ISREG(info.st_mode) || info.st_size <= 0 || info.st_size > 64 * 1024 * 1024) {
    ::close(fd);
    return {};
  }
  EVP_MD_CTX* hash = EVP_MD_CTX_new();
  if (!hash) {
    ::close(fd);
    return {};
  }
  bool okay = EVP_DigestInit_ex(hash, EVP_sha256(), nullptr) == 1;
  std::array<unsigned char, 16384> bytes{};
  while (okay) {
    ssize_t count = ::read(fd, bytes.data(), bytes.size());
    if (count < 0 && errno == EINTR) continue;
    if (count < 0) {
      okay = false;
      break;
    }
    if (!count) break;
    okay = EVP_DigestUpdate(hash, bytes.data(), size_t(count)) == 1;
  }
  ::close(fd);
  unsigned char digest[32]{};
  unsigned int count = 0;
  okay = okay && EVP_DigestFinal_ex(hash, digest, &count) == 1 && count == 32;
  EVP_MD_CTX_free(hash);
  if (!okay) return {};
  const char* hex = "0123456789abcdef";
  std::string result;
  for (unsigned char byte : digest) {
    result += hex[byte >> 4];
    result += hex[byte & 15];
  }
  return result;
}

struct ProcessIdentity {
  long pid{0}, parent{0};
  unsigned long long start{0};
  char state{'?'};
  std::string executable;
  bool running() const {
    return pid > 1 && start && state != 'T' && state != 't' && state != 'Z' && state != 'X';
  }
  std::string guard_line() const {
    return std::to_string(pid) + " " + std::to_string(start) + " " + executable + "\n";
  }
};

inline bool parse_process_stat(const std::string& text, ProcessIdentity& identity) {
  // Linux comm can contain spaces AND closing parentheses. Splitting the
  // complete stat line on spaces would silently shift field 22 (start tick).
  const auto left = text.find('('), right = text.rfind(')');
  if (left == std::string::npos || right == std::string::npos || right <= left || right + 2 >= text.size())
    return false;
  char* end = nullptr;
  const long pid = std::strtol(text.c_str(), &end, 10);
  if (pid <= 1 || !end || end >= text.c_str() + left) return false;
  while (*end == ' ') ++end;
  if (end != text.c_str() + left) return false;
  std::istringstream fields(text.substr(right + 2));
  char state;
  long parent;
  std::string ignored, tick;
  if (!(fields >> state >> parent) || parent < 0) return false;
  for (int field = 5; field < 22; ++field)
    if (!(fields >> ignored)) return false;
  if (!(fields >> tick) || tick.empty() || tick.find_first_not_of("0123456789") != std::string::npos)
    return false;
  errno = 0;
  const auto start = std::strtoull(tick.c_str(), &end, 10);
  if (errno || !start || !end || *end) return false;
  identity.pid = pid;
  identity.parent = parent;
  identity.state = state;
  identity.start = start;
  return true;
}

inline ProcessIdentity process_identity(long pid, const std::string& proc = "/proc") {
  ProcessIdentity result;
  if (pid <= 1 || pid > INT_MAX) return result;
  const std::string base = proc + "/" + std::to_string(pid);
  if (!parse_process_stat(read_small(base + "/stat"), result) || result.pid != pid) return {};
  result.executable = read_link(base + "/exe");
  if (result.executable.empty() || result.executable.find_first_of(" \t\r\n") != std::string::npos) return {};
  return result;
}

inline bool same_process(const ProcessIdentity& expected, const std::string& proc = "/proc") {
  const auto actual = process_identity(expected.pid, proc);
  return actual.pid == expected.pid && actual.start == expected.start &&
         actual.executable == expected.executable;
}

inline std::vector<std::string> process_arguments(long pid, const std::string& proc = "/proc") {
  const auto text = read_small(proc + "/" + std::to_string(pid) + "/cmdline", 4096);
  std::vector<std::string> result;
  if (text.empty() || text.back() != '\0') return result;
  size_t offset = 0;
  while (offset < text.size()) {
    const auto end = text.find('\0', offset);
    if (end == std::string::npos || end == offset || result.size() >= 32) return {};
    result.emplace_back(text.substr(offset, end - offset));
    offset = end + 1;
  }
  return result;
}

inline ProcessIdentity unique_process(const std::string& executable,
                                      const std::vector<std::string>& arguments = {},
                                      const std::string& proc = "/proc") {
  DIR* directory = ::opendir(proc.c_str());
  if (!directory) return {};
  ProcessIdentity result;
  bool duplicate = false;
  while (const auto* entry = ::readdir(directory)) {
    const std::string name = entry->d_name;
    if (name.empty() || name.find_first_not_of("0123456789") != std::string::npos) continue;
    const auto candidate = process_identity(std::strtol(name.c_str(), nullptr, 10), proc);
    if (candidate.executable != executable || !candidate.running()) continue;
    if (!arguments.empty() && process_arguments(candidate.pid, proc) != arguments) continue;
    if (result.pid) {
      duplicate = true;
      break;
    }
    result = candidate;
  }
  ::closedir(directory);
  return duplicate ? ProcessIdentity{} : result;
}

struct StockInspection {
  // Paths and approved fingerprints are source-controlled evidence, never
  // caller-supplied RPC arguments. A mismatch is an explicit stop condition.
  static constexpr std::array<const char*, 6> PATHS = {"/data/bin/SnowApp",
                                                       "/data/bin/watchdog.sh",
                                                       "/data/etc/init.d/start.sh",
                                                       "/data/.esphome-cgs1/launch.sh",
                                                       "/data/.esphome-cgs1/pm_qt_bridge.so",
                                                       "/data/.esphome-cgs1/SnowApp-with-PM"};
  static constexpr std::array<const char*, 6> HASHES = {
      "a39016531620a874668ee322f0e976f48e47943742c54c8a7291b9e830c91abb",
      "1d74ef0946734e1ddf9e76301012f9ed66d7b38d9d7a0239a5d0e80acabf2cce",
      "f104f873dd3ce4544d5f3e3f90a4056bffc811bcaae037e347306e1084e7f1d1",
      "0e3b041b629cf24f1be8327df858913bd7f6f37164013b52cb1d9ef232ad4117",
      cgs1_device_profile::PM_HELPER_SHA,
      "c1a1700e5172e7a9f415b947ad9b3e852e2d3ec2ca770315894a3b9e7866530a"};
  std::array<ProcessIdentity, 4> processes{};  // stock, wrapper, watchdog, bridge
  std::string boot_id, bridge_sha, error;
  bool verified{false};

  bool inspect() {
    return inspect_for_bridge(::getpid());
  }
  // A standalone permanent guardian verifies the already captured coordinator
  // birth too. Its own PID is deliberately NOT substituted for the bridge.
  // This is a local typed interface, never a caller-selected PID in an RPC;
  // executable path, root ownership and all ordinary board checks still apply.
  bool inspect_for_bridge(long bridge_pid) {
    verified = false;
    error.clear();
    if (read_small("/sys/class/net/wlan0/address", 64) != cgs1_device_profile::WLAN_MAC_LINE ||
        read_small("/data/etc/os-release", 128) != "CLEARGRASS_VERSION=4.1.8_0287\n")
      return fail("unexpected_device_or_stock_version");
    for (size_t i = 0; i < PATHS.size(); ++i)
      if (sha_file(PATHS[i]) != HASHES[i]) return fail("critical_file_changed_" + std::to_string(i));
    boot_id = read_small("/proc/sys/kernel/random/boot_id", 64);
    if (boot_id.size() != 37 || boot_id.back() != '\n') return fail("invalid_boot_identity");
    boot_id.pop_back();
    processes[0] = unique_process(PATHS[0]);
    if (!processes[0].pid) return fail("stock_process_not_unique");
    processes[1] = process_identity(processes[0].parent);
    if (processes[1].executable != "/bin/busybox" || !processes[1].running() ||
        process_arguments(processes[1].pid) !=
            std::vector<std::string>{"/bin/sh", PATHS[5], "-platform", "EGLFS"})
      return fail("unexpected_stock_wrapper");
    processes[2] = unique_process("/bin/busybox", {"/bin/sh", PATHS[1]});
    processes[3] = process_identity(bridge_pid);
    if (!processes[2].pid || !processes[3].running() ||
        processes[3].executable != "/data/.esphome-cgs1/program")
      return fail("unexpected_watchdog_or_bridge");
    bridge_sha = sha_file(processes[3].executable);
    if (bridge_sha.size() != 64) return fail("bridge_fingerprint_unavailable");
    if (::access("/tmp/qingping-pm-helper.attempted", F_OK) ||
        !::access("/data/.esphome-cgs1/pm-helper.disabled", F_OK))
      return fail("pm_helper_not_in_verified_state");
    for (const auto& process : processes) {
      struct stat owner{};
      if (::stat(("/proc/" + std::to_string(process.pid)).c_str(), &owner) || owner.st_uid != 0)
        return fail("unexpected_process_owner");
      if (!same_process(process)) return fail("process_changed_during_inspection");
    }
    verified = true;
    return true;
  }

 private:
  bool fail(const std::string& reason) {
    error = reason;
    return false;
  }
};
}  // namespace cgs1_net_trial
