#pragma once

// Full-runtime adapter for the SAME already tested PM controller/decoder.
// It uses the sealed plan + live dual guardians, not the bounded trial shell
// fingerprint, and retains acknowledged native state across OTA exec.
#include "supervisor_native_bootstrap.h"
#include "supervisor_pm_current.h"
#include "independent_pm_power.h"
#include "direct_peripheral_probe.h"
#include "pm_choice_commit.h"

namespace cgs1_pm {
class FullAdapter {
 public:
  explicit FullAdapter(cgs1_supervisor::NativeFullBootstrap &bootstrap):bootstrap_(bootstrap){}
  ~FullAdapter(){for(int fd:pins_)if(fd>=0)::close(fd);}
  bool initialize(esphome::uart::UARTComponent *uart,bool current) {
    uart_=uart;
    if(!exclusive() || !cgs1_pm::inspect().write_only_supported() || !bootstrap_.arm_pm())return false;
    unsigned i=0;
    for(const char *path:{POWER,RESET}) {
      pins_[i]=::open(path,O_WRONLY|O_NOFOLLOW|O_CLOEXEC|O_NONBLOCK);
      if(!valid_pin_(pins_[i++]))return false;
    }
    return mux_.open(true) && (mux_.read()&pinmux::MASK)==(current?pinmux::UART:pinmux::GPIO);
  }
  bool exclusive() const {
    if(!bootstrap_.connected() || bootstrap_.client().faulted() || bootstrap_.client().waiting())return false;
    const auto &stock=bootstrap_.plan().stock;
    if(cgs1_net_trial::unique_process("/data/bin/SnowApp").pid)return false;
    for(unsigned role:{1U,2U,3U}) {
      const auto &identity=stock.processes[role];
      if(!cgs1_net_trial::same_process(identity))return false;
      const auto actual=cgs1_net_trial::process_identity(identity.pid);
      if(role==3?!actual.running():(actual.state!='T' && actual.state!='t'))return false;
    }
    return true;
  }
  bool recovery_armed() {return exclusive() && bootstrap_.arm_pm();}
  bool metadata_verified() const{return valid_pin_(pins_[0]) && valid_pin_(pins_[1]) && mux_.available();}
  bool invalidate_reader(unsigned){return uart_ && cgs1_direct_trial::peripheral.restart_pm_reader(uart_);}
  bool write_power(bool enabled){return store_(pins_[0],enabled);}
  bool write_reset(bool enabled){return store_(pins_[1],enabled);}
  bool write_pinmux(bool enabled) {
    if(!exclusive() || !recovery_armed() || !mux_.store(enabled))return false;
    ++stores_;return true;
  }
  unsigned acknowledged_stores() const{return stores_;}
 private:
  cgs1_supervisor::NativeFullBootstrap &bootstrap_;std::array<int,2> pins_{{-1,-1}};
  esphome::uart::UARTComponent *uart_{nullptr};pinmux::Register mux_;unsigned stores_{0};
  static bool valid_pin_(int fd) {
    struct stat info{};struct statfs fs{};
    return fd>=0 && !::fstat(fd,&info) && S_ISREG(info.st_mode) && info.st_uid==0 &&
      (info.st_mode&07777)==0200 && !::fstatfs(fd,&fs) && fs.f_type==0x62656572;
  }
  bool store_(int fd,bool enabled) {
    if(!exclusive() || !recovery_armed() || !valid_pin_(fd) || ::lseek(fd,0,SEEK_SET)<0)return false;
    const char text[]{enabled?'1':'0','\n'};
    // One sysfs store only. An uncertain acknowledgement ends the native
    // process; the independent guardian restores the ORIGINAL stock state.
    if(::write(fd,text,sizeof(text))!=ssize_t(sizeof(text)))return false;
    ++stores_;return true;
  }
};
class FullPmRuntime {
 public:
  explicit FullPmRuntime(cgs1_supervisor::NativeFullBootstrap &bootstrap):bootstrap_(bootstrap),adapter_(bootstrap){}
  bool setup(esphome::uart::UARTComponent *uart) {
    bool current=false;
    if(!bootstrap_.connected() || !state_.open(bootstrap_.runtime_fd()) ||
       !state_.load(bootstrap_.plan().effects.pm_enabled,current) || !adapter_.initialize(uart,current) ||
       !controller_.start(current,esphome::millis()) || !state_.save(current))return false;
    cgs1_direct_trial::peripheral.set_pm_enabled(controller_.enabled());initialized_=true;return true;
  }
  void request(bool enabled) {
    if(!choice_.change(enabled,[this](bool value){return apply_(value);}))std::_Exit(73);
  }
  bool restore_desired(bool enabled){return apply_(enabled);}
  bool set_choice_writer(bool (*writer)(bool)) {
    // Attach only after actual hardware setup and any saved startup desire.
    // RAM-only profiles leave this null and keep their existing behavior.
    return initialized_ && choice_.attach(writer);
  }
  void loop(){if(cgs1_direct_trial::peripheral.fresh_pm_frame())controller_.valid_frame(controller_.generation());}
  bool enabled() const{return controller_.enabled();}
  bool available(){return initialized_ && !controller_.faulted() && adapter_.exclusive() && adapter_.recovery_armed() && adapter_.metadata_verified();}
  bool warming() const{return controller_.warming(esphome::millis());}
  bool fresh_ready() const{return controller_.ready() && cgs1_direct_trial::peripheral.fresh_pm_frame();}
  unsigned acknowledged_stores() const{return adapter_.acknowledged_stores();}
 private:
  cgs1_supervisor::NativeFullBootstrap &bootstrap_;cgs1_supervisor::CurrentPmStore state_;
  FullAdapter adapter_;Controller<FullAdapter> controller_{adapter_};bool initialized_{false};
  ChoiceCommit choice_;
  bool apply_(bool enabled) {
    if(!initialized_ || !controller_.request(enabled,esphome::millis()) || !state_.save(controller_.enabled()))return false;
    cgs1_direct_trial::peripheral.set_pm_enabled(controller_.enabled());return true;
  }
};
}  // namespace cgs1_pm
