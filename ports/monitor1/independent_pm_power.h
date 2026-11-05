#pragma once

// Independent PM power for the fingerprinted CGS1 board, never ESP32 GPIOs.
// The stock PM25API chooses these two sysfs nodes when its SCD30 legacy flag
// is absent and writes power first, reset second. Other board branches are
// intentionally unsupported. Inspection is read-only; the controller below
// needs a separate exclusive-owner/guardian adapter before hardware use.
#include <cstdint>
#include <cstddef>
#include <cerrno>
#include <array>
#include <string>
#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>
#include "pm_uart_pinmux.h"
#if defined(__linux__)
#include <sys/vfs.h>
#endif

namespace cgs1_pm {
inline constexpr const char *POWER = "/sys/devices/pwm-pm25.28/enable";
inline constexpr const char *RESET = "/sys/devices/pwm-sensor.27/pm25_rst";
inline constexpr const char *LEGACY_FLAG =
    "/sys/devices/2005e000.i2c/i2c-3/3-0061/scd30_co2";
inline constexpr std::array<const char *, 5> KNOWN_NODES = {
    POWER, RESET, "/sys/devices/data-pm25.28/enable",
    "/sys/devices/data-pm25.29/enable", "/sys/devices/pwm-sensor.27/enable"};

struct Pins {
  int power{-1}, reset{-1};
  bool coherent() const { return (power == 0 || power == 1) && power == reset; }
  bool operator==(const Pins &other) const {
    return power == other.power && reset == other.reset;
  }
};

inline int parse_bit(const char *text, size_t size) {
  // Accept only the exact values emitted by the kernel, not atoi("1garbage")
  // or a truncated prefix. Missing/unreadable is distinct from power off.
  if (!text || (size != 1 && size != 2) ||
      (text[0] != '0' && text[0] != '1') || (size == 2 && text[1] != '\n'))
    return -1;
  return text[0] - '0';
}

struct NodeEvidence {
  int stat_error{0}, mode{-1}, owner{-1};
  long path_filesystem_type{0};
  int open_error{0}, filesystem_error{0}, read_error{0}, bytes{-1}, bit{-1};
  long filesystem_type{0};
  std::string text;
};

inline NodeEvidence inspect_node(const char *path) {
  NodeEvidence result;
#if defined(__linux__)
  struct stat metadata{};
  if (::lstat(path, &metadata)) result.stat_error = errno;
  else {
    result.mode = int(metadata.st_mode & 07777);
    result.owner = int(metadata.st_uid);
    struct statfs path_fs{};
    if (!::statfs(path, &path_fs)) result.path_filesystem_type = path_fs.f_type;
  }
  // These are constant kernel paths only. Never accept paths over the API,
  // create a missing node or follow a final symlink to a normal data file.
  const int fd = ::open(path, O_RDONLY | O_NOFOLLOW | O_CLOEXEC | O_NONBLOCK);
  if (fd < 0) { result.open_error = errno; return result; }
  struct statfs fs{};
  if (::fstatfs(fd, &fs)) result.filesystem_error = errno;
  else result.filesystem_type = fs.f_type;
  char bytes[65]{};
  // Only a verified sysfs inode is read. A finite diagnostic string helps
  // distinguish absent paths, driver read errors and a different show format;
  // it never turns any of those conditions into permission to write.
  if (!result.filesystem_error && fs.f_type == 0x62656572) {
    const ssize_t count = ::read(fd, bytes, sizeof(bytes) - 1);
    if (count < 0) result.read_error = errno;
    else {
      result.bytes = int(count);
      result.text.assign(bytes, size_t(count));
      result.bit = parse_bit(bytes, size_t(count));
    }
  }
  ::close(fd);
#else
  (void) path;
#endif
  return result;
}

struct Inspection {
  Pins pins;
  std::array<NodeEvidence, KNOWN_NODES.size()> nodes;
  bool legacy_flag_present{false}, legacy_flag_known{false};
  bool pinmux_readable{false};
  uint32_t pinmux_value{0xffffffffU};
  bool supported() const {
    return legacy_flag_known && !legacy_flag_present && pins.coherent();
  }
  bool write_only_supported() const {
    if (!legacy_flag_known || legacy_flag_present) return false;
    for (size_t i = 0; i < 2; ++i) {
      const auto &node = nodes[i];
      if (node.stat_error || node.mode != 0200 || node.owner != 0 ||
          node.path_filesystem_type != 0x62656572) return false;
    }
    return true;
  }
};

inline Inspection inspect() {
  Inspection result;
#if defined(__linux__)
  for (size_t i = 0; i < KNOWN_NODES.size(); ++i)
    result.nodes[i] = inspect_node(KNOWN_NODES[i]);
  result.pins = {result.nodes[0].bit, result.nodes[1].bit};
  // A denied or otherwise failed stat must not look like a missing flag.
  // errno is deliberately checked immediately, before another syscall.
  struct stat info{};
  const int status = ::lstat(LEGACY_FLAG, &info);
  result.legacy_flag_present = status == 0;
  result.legacy_flag_known = status == 0 || errno == ENOENT;
  pinmux::Register reg;
  result.pinmux_readable = reg.open();
  if (result.pinmux_readable) result.pinmux_value = reg.read();
#endif
  return result;
}

// This board has no show/readback handler: a successful kernel store is a
// command acknowledgement, not proof that its fan or laser physically works.
// Verification comes from fresh valid UART frames in the new generation.
// The adapter must fence stock/watchdog identities, validate both fixed nodes,
// arm the independent guardian BEFORE writing, and drain/invalidate old UART
// input. This class grants none of those capabilities by itself.
template <class Adapter> class Controller {
 public:
  explicit Controller(Adapter &adapter) : adapter_(adapter) {}
  bool start(bool original_enabled, uint32_t now) {
    if (started_ || faulted_ || !permitted_()) return false;
    // The caller supplies the coordinator's validated fresh stock flag, never
    // a guessed sysfs read. The flag remains the guardian's restore source.
    original_ = enabled_ = original_enabled; started_ = true;
    on_at_ = now; frame_seen_ = false; ++generation_;
    if (!adapter_.invalidate_reader(generation_)) { faulted_ = true; return false; }
    return true;
  }
  bool request(bool enabled, uint32_t now) {
    if (!started_ || faulted_) return false;
    if (!permitted_()) { faulted_ = true; return false; }
    if (enabled_ == enabled) return true; // No duplicate store/warm-up reset.
    frame_seen_ = false; ++generation_;
    if (!adapter_.invalidate_reader(generation_)) { faulted_ = true; return false; }
    // A partial write is NOT success and is never automatically replayed.
    // Latch the fault; the independent guardian owns exact original recovery.
    if (!permitted_() || !adapter_.write_power(enabled) ||
        !permitted_() || !adapter_.write_reset(enabled) ||
        !permitted_() || !adapter_.write_pinmux(enabled)) {
      faulted_ = true; return false;
    }
    enabled_ = enabled; on_at_ = now;
    return true;
  }
  // Only the current decoder generation can establish live PM feedback.
  // No calibration, power cycling or retry is triggered by a missing frame.
  bool valid_frame(unsigned generation) {
    if (!enabled() || generation != generation_) return false;
    frame_seen_ = true; return true;
  }
  bool enabled() const { return started_ && !faulted_ && enabled_; }
  bool ready() const { return enabled() && frame_seen_; }
  bool warming(uint32_t now) const {
    return enabled() && !frame_seen_ && uint32_t(now - on_at_) < 30000;
  }
  bool first_frame_timed_out(uint32_t now) const {
    return enabled() && !frame_seen_ && uint32_t(now - on_at_) >= 30000;
  }
  bool faulted() const { return faulted_; }
  unsigned generation() const { return generation_; }
  bool original() const { return original_; }

 private:
  Adapter &adapter_;
  bool original_{false}, enabled_{false}, frame_seen_{false};
  bool started_{false}, faulted_{false};
  uint32_t on_at_{0};
  unsigned generation_{0};
  bool permitted_() const {
    return adapter_.exclusive() && adapter_.recovery_armed() && adapter_.metadata_verified();
  }
};
} // namespace cgs1_pm
