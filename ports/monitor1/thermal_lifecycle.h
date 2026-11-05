#pragma once

// Startup/persistence policy, separate from hardware collection and UI trials.
// Enabling requires an explicitly chosen own directory. No automatic file
// discovery, stock-settings migration, boot-ID seed or calibration reset.
#include "thermal_state_store.h"

namespace cgs1_thermal {
class NormalLifecycle {
 public:
  enum class Startup {NOT_STARTED, COLD_MISSING, COLD_INVALID, COLD_EXPIRED, COLD_CLOCK, WARM};
  enum class Save {NOT_DUE, SAVED, FAILED};
  bool configure(const char *directory,const char *epoch=nullptr) {
    if (configured_ || started_) return false;
    return configured_=store_.open_existing(directory,epoch);
  }
  bool begin(Model &model,const Sample &sample,int64_t now) {
    if (!configured_ || started_) return false;
    PersistentState state;
    const bool loaded=store_.load(state);
    const std::string error=store_.error();
    // A concurrent writer is an ownership conflict, not a missing record.
    // I/O/permissions are represented by the store's explicit invalid/access
    // error and diagnosed separately from a normal first-ever cold startup.
    if (!loaded && error=="checkpoint_busy") return false;
    Model selected;
    if (loaded && restore_state(selected,state,now,sample)) startup_=Startup::WARM;
    else if (now<=0 || now>4102444800LL) startup_=Startup::COLD_CLOCK;
    else if (loaded) startup_=Startup::COLD_EXPIRED;
    else startup_=error=="record_missing" ? Startup::COLD_MISSING : Startup::COLD_INVALID;
    model=selected;started_=true;
    return true;
  }
  Save successful_tick(const Model &model,int64_t now) {
    if (!started_) return Save::FAILED;
    ++samples_;
    if (!cadence_.successful_sample()) return Save::NOT_DUE;
    return checkpoint(model,now) ? Save::SAVED : Save::FAILED;
  }
  bool checkpoint(const Model &model,int64_t now) {
    // Never persist an all-zero not-yet-sampled model as a real shutdown
    // state. An explicit clean exit and the periodic timer use the SAME path.
    if (!started_ || !samples_) return false;
    const auto state=capture_state(model,now);
    const auto text=format_state(state);
    if (text.empty()) {last_ok_=false;return false;}
    // Do not replay a write after an ambiguous fsync/rename result merely
    // because two shutdown hooks received the same request. A later genuinely
    // newer successful sample may produce its own different checkpoint.
    if (text==last_attempt_) return last_ok_;
    last_attempt_=text;
    return last_ok_=store_.save(state);
  }
  Startup startup() const {return startup_;}
  bool configured() const {return configured_;}
  bool started() const {return started_;}
  const std::string &storage_error() const {return store_.error();}
 private:
  StateStore store_;StateCadence cadence_;
  bool configured_{false},started_{false},last_ok_{false};
  uint64_t samples_{0};std::string last_attempt_;
  Startup startup_{Startup::NOT_STARTED};
};
} // namespace cgs1_thermal
