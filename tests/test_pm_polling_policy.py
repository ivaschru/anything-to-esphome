"""Exercise the real PM component's rail/reader lifecycle without hardware."""
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]

# Only the SDK boundary is faked. Production apply_(), setup() and its warmup
# callback are compiled unchanged, so the old GPIO13 LOW behavior fails here.
HAL = r'''
#pragma once
#include <cstdint>
#include <cmath>
#include <functional>
#include <map>
#include <string>
#include <vector>
namespace esphome {
inline uint32_t clock_ms = 0;
inline uint32_t millis() { return clock_ms; }
namespace setup_priority { constexpr float DATA = 600; }
struct GPIOPin {
  bool configured = false, high_before_setup = false;
  std::vector<bool> writes;
  void digital_write(bool high) { writes.push_back(high); }
  void setup() {
    configured = true;
    high_before_setup = !writes.empty() && writes.back();
  }
};
struct Component {
  bool warning = false;
  struct Timer { uint32_t at; std::function<void()> call; };
  std::map<std::string, Timer> timers;
  virtual ~Component() = default;
  virtual float get_setup_priority() const { return 0; }
  virtual void setup() {}
  virtual void dump_config() {}
  void status_set_warning() { warning = true; }
  void status_clear_warning() { warning = false; }
  void cancel_timeout(const char *key) { timers.erase(key); }
  void set_timeout(const char *key, uint32_t delay, std::function<void()> call) {
    timers[key] = {clock_ms + delay, call};
  }
  void advance(uint32_t delta) {
    clock_ms += delta;
    auto copy = timers;
    for (auto &entry : copy) if (entry.second.at <= clock_ms) {
      timers.erase(entry.first);
      entry.second.call();
    }
  }
};
namespace sensor {
struct Sensor { float state = 123; void publish_state(float v) { state = v; } };
}
namespace pmsa003i {
struct PMSA003IComponent {
  bool polling = true, failed = false;
  unsigned updates = 0;
  void stop_poller() { polling = false; }
  void start_poller() { polling = true; }
  void update() { ++updates; }
  bool is_failed() { return failed; }
  void status_clear_warning() {}
};
}
}
#define ESP_LOGCONFIG(...) ((void)0)
#define ESP_LOGI(...) ((void)0)
#define ESP_LOGW(...) ((void)0)
#define LOG_PIN(...) ((void)0)
'''


def run_component(header=None):
    """Optional header supports proving that the previous revision regresses."""
    compiler = shutil.which("c++")
    if not compiler:
        raise unittest.SkipTest("C++ compiler is not installed")
    with tempfile.TemporaryDirectory(prefix="qingping-pm-policy-") as directory:
        work = Path(directory)
        for relative in (
            "esphome/core/component.h", "esphome/core/hal.h",
            "esphome/core/log.h", "esphome/components/pmsa003i/pmsa003i.h",
        ):
            path = work / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(HAL if relative.endswith("component.h") else "#pragma once\n")
        executable = work / "policy"
        command = [compiler, "-std=c++17", "-Wall", "-Wextra", "-Werror",
                   "-fsanitize=address,undefined", "-fno-omit-frame-pointer",
                   "-I", str(work)]
        if header:
            command.append(f'-DPM_HEADER="{header}"')
        subprocess.run(command + [str(ROOT / "tests/pm_polling_policy.cpp"),
                                  "-o", str(executable)], check=True)
        return subprocess.run([str(executable)], capture_output=True, text=True)


class PmPollingPolicyTests(unittest.TestCase):
    def test_restoration_cancellation_and_reader_failure(self):
        result = run_component()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
