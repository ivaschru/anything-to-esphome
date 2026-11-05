#pragma once

// Native SDK lifecycle binding. The compiled guardian digest is an explicit
// release dependency. No local trial shell/seed/prefix can substitute it.
#include "supervisor_native_bootstrap.h"
#include "supervisor_sdk_ota.h"
#include "supervisor_sdk_restart.h"
#include "full_pm_power.h"
#include "thermal_runtime.h"
#include "native_full_state.h"
#include "native_wifi_transaction.h"
#include "esphome/components/cgs1_panel/cgs1_panel.h"
#include "esphome/components/json/json_util.h"
#include <sys/resource.h>

namespace cgs1_full {
inline cgs1_supervisor::NativeFullBootstrap bootstrap;
inline cgs1_supervisor::NativeSession session(bootstrap.client());
inline cgs1_supervisor::SdkOtaListener ota_listener(session);
inline cgs1_supervisor::SdkRestart restart(session);
inline cgs1_pm::FullPmRuntime pm(bootstrap);
inline uint64_t return_requested_at=0,started_at=0;
inline cgs1_full_state::Runtime durable_state;
inline uint64_t last_preferences_checkpoint=0;

inline bool display_valid() {
  return bootstrap.connected() && !bootstrap.client().faulted() && !bootstrap.client().waiting() &&
    session.state()!=cgs1_supervisor::NativeState::FAULT;
}
inline bool arm_brightness(){return display_valid() && bootstrap.arm_brightness();}
inline int original_brightness(){return bootstrap.connected()?int(bootstrap.plan().effects.brightness):-1;}
inline esphome::cgs1_panel::FullDisplayAuthority display_authority() {
  return {display_valid,arm_brightness,original_brightness};
}
inline bool save_pm_choice(bool enabled){return durable_state.write_pm_choice(enabled);}
inline bool setup_pm(esphome::uart::UARTComponent *uart) {
  if(!pm.setup(uart))return false;
  if(!durable_state.ready())return true;
  bool desired=false;const auto found=durable_state.read_pm_choice(desired);
  if(found==cgs1_pm_choice::Read::ERROR) {
    ::dprintf(STDERR_FILENO,"CGS1_FULL saved PM choice refused: %s\n",durable_state.error().c_str());return false;
  }
  // Controller::request is a no-op for an already matching RAM journal, so a
  // planned exec neither reasserts sysfs nor restarts the sensor warm-up. A
  // fresh session applies a different saved choice once, under both guardians.
  if(found==cgs1_pm_choice::Read::LOADED && !pm.restore_desired(desired))return false;
  return pm.set_choice_writer(save_pm_choice);
}
inline bool early(const std::string &compiled_digest,esphome::ESPHomeOTAComponent &ota,bool durable=false) {
  started_at=cgs1_supervisor::clock_ms();
  // Startup triggers precede logger setup. Write directly to the inherited
  // private guardian log so _Exit cannot discard the only failure evidence.
  ::dprintf(STDERR_FILENO,"CGS1_FULL early entered\n");
  cgs1_supervisor::Digest digest{};
  if(!cgs1_supervisor::parse_digest(compiled_digest,digest)) {
    ::dprintf(STDERR_FILENO,"CGS1_FULL compiled pin refused\n");return false;
  }
  if(!bootstrap.open(digest)) {
    ::dprintf(STDERR_FILENO,"CGS1_FULL bootstrap refused stage=%u errno=%d\n",bootstrap.diagnostic_stage(),errno);
    return false;
  }
  ::dprintf(STDERR_FILENO,"CGS1_FULL bootstrap accepted\n");
  // All own SDK/RAM/durable files must be private from first creation. This
  // changes only the native child's umask, never the stock process or parent.
  ::umask(0077);
  if(durable && !durable_state.begin(bootstrap.preferences_directory(),bootstrap.plan().nonce)) {
    ::dprintf(STDERR_FILENO,"CGS1_FULL durable state refused: %s\n",durable_state.error().c_str());return false;
  }
  if(!ota_listener.attach(ota)){::dprintf(STDERR_FILENO,"CGS1_FULL ota listener refused\n");return false;}
  ::setenv("TZ","MSK-3",1);::tzset();
  cgs1_direct_trial::peripheral.set_read_trh(false);
  // Normal cold/warm algorithm, never the warm-device engineering seed.
  const auto thermal_directory=durable_state.ready()?std::string(cgs1_full_state::Runtime::THERMAL):bootstrap.thermal_directory();
  // Both persistent stores receive the same admitted session identity. Planned
  // exec retains it; a recovered/new session has a fresh nonce even if Linux
  // reuses an old PID. No boot-time scan/removal of temporary files is needed.
  const bool thermal=cgs1_thermal::runtime.enable_normal_persistence(
    thermal_directory.c_str(),bootstrap.plan().nonce.c_str());
  ::dprintf(STDERR_FILENO,"CGS1_FULL thermal configured=%u\n",unsigned(thermal));
  return thermal;
}
inline void before_shutdown() {
  // exec does not call atexit. Persist the normal thermal model explicitly
  // before ordinary SDK restart/OTA exec, then obtain/suppress the exact
  // lifecycle transition through NativeSession (no duplicate OTA RESTART).
  if((durable_state.ready() && !durable_state.checkpoint()) || !cgs1_thermal::runtime.checkpoint_shutdown())std::_Exit(73);
  ota_listener.before_shutdown();
}
inline bool request_return() {
  if(return_requested_at || restart.pending() || session.state()!=cgs1_supervisor::NativeState::RUNNING)return false;
  return_requested_at=cgs1_supervisor::clock_ms();return return_requested_at!=0;
}
inline bool request_restart(){return !return_requested_at && restart.request();}
inline std::string self_digest() {
  // Fixed /proc/self link is deliberately followed: it identifies the actual
  // running old/new inode across OTA rename, not a caller-supplied pathname.
  const int fd=::open("/proc/self/exe",O_RDONLY|O_CLOEXEC);if(fd<0)return {};
  struct stat info{};cgs1_supervisor::Digest digest{};
  const bool verified=!::fstat(fd,&info) && S_ISREG(info.st_mode) && info.st_uid==0 &&
    info.st_size>=52 && info.st_size<=16*1024*1024 && cgs1_supervisor::image_hash(fd,info.st_size,digest);
  ::close(fd);return verified?cgs1_supervisor::digest_text(digest):"";
}
inline void report(JsonObject root,esphome::cgs1_panel::Panel &panel) {
  root["connected_guardians"]=bootstrap.connected();root["native_state"]=unsigned(session.state());
  root["panel_ready"]=panel.ready();root["normal_thermal_mode"]=cgs1_thermal::runtime.normal_startup_mode();
  root["pm_enabled"]=pm.enabled();root["pm_control_available"]=pm.available();
  root["pm_warming"]=pm.warming();root["native_sha256"]=self_digest();
  root["pm_acknowledged_stores"]=pm.acknowledged_stores();
  const auto generations=bootstrap.client().generations();
  auto peers=root["guardian_generations"].to<JsonArray>();for(auto value:generations)peers.add(value);
  root["restart_pending"]=restart.pending();
  root["durable_state"]=durable_state.ready();root["preferences_restored"]=durable_state.restored();
  root["preferences_checkpoints"]=durable_state.checkpoints();
  root["pm_choice_present"]=durable_state.pm_choice_present();
  if(durable_state.pm_choice_present())root["pm_choice_enabled"]=durable_state.pm_choice_enabled();
  root["native_age_ms"]=cgs1_supervisor::clock_ms()-started_at;
  struct stat executable{};
  if(!::stat("/proc/self/exe",&executable)) {
    root["native_image_device"]=uint64_t(executable.st_dev);root["native_image_inode"]=uint64_t(executable.st_ino);
  }
  rusage usage{};
  if(!::getrusage(RUSAGE_SELF,&usage)) {
    root["native_maxrss_kib"]=long(usage.ru_maxrss);
    root["native_cpu_us"]=uint64_t(usage.ru_utime.tv_sec+usage.ru_stime.tv_sec)*1000000+
      uint64_t(usage.ru_utime.tv_usec+usage.ru_stime.tv_usec);
  }
  root["native_pid"]=long(::getpid());root["primary_pid"]=long(::getppid());
  root["native_start_tick"]=cgs1_supervisor::process_stamp(::getpid()).start;
  root["boot_id"]=bootstrap.plan().stock.boot_id;root["nonce"]=bootstrap.plan().nonce;
  root["guardian_sha256"]=cgs1_supervisor::digest_text(bootstrap.plan().guardian_digest);
}
inline void loop(esphome::cgs1_panel::Panel &panel) {
  pm.loop();panel.set_pm_state(pm.enabled(),pm.warming());
  const bool ready=panel.ready() && std::isfinite(cgs1_thermal::runtime.temperature()) &&
    std::isfinite(cgs1_thermal::runtime.humidity());
  if(!session.loop(ready))std::_Exit(73);
  if(ready && durable_state.ready()) {
    const auto now=cgs1_supervisor::clock_ms();
    // The SDK cache is flushed only to RAM; Store skips unchanged durable
    // payloads. Settings are therefore committed at most once per 15 seconds,
    // plus an explicit shutdown, without periodic unchanged flash rewrites.
    if(!last_preferences_checkpoint || now-last_preferences_checkpoint>=15000) {
      if(!durable_state.checkpoint())std::_Exit(73);
      last_preferences_checkpoint=now;
    }
  }
  if(!restart.loop(bootstrap.native_program()))std::_Exit(73);
  if(return_requested_at && cgs1_supervisor::clock_ms()-return_requested_at>=500) {
    if((durable_state.ready() && !durable_state.checkpoint()) ||
       !cgs1_thermal::runtime.checkpoint_shutdown() || !session.exit_stock())std::_Exit(73);
    std::exit(0);
  }
}
}  // namespace cgs1_full
