#pragma once

// Guarded RAM-trial thermal collector for the verified CGS1 4.1.8_0287.
// Stock's numerical model (thermal_model.h) is independent of this collector.
// No kernel calibration/baseline, GPIO, network or stock settings are written.
// A fresh, same-boot, numeric seed is required for this already-warm device's
// engineering handoff. Normal cold/warm-start persistence is a separate layer.
#include "thermal_model.h"
#include "thermal_seed_codec.h"
#include "thermal_lifecycle.h"
#include "monotonic_cadence.h"
#include "esphome/core/hal.h"
#include "esphome/core/log.h"
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <string>

namespace cgs1_thermal {
inline float decimal_round(float value,int decimals) {
  char text[48];std::snprintf(text,sizeof(text),"%.*f",decimals,double(value));
  return std::strtof(text,nullptr);
}
class Runtime {
 public:
  void set_screen(bool on,int brightness){screen_on_=on;brightness_=std::clamp(brightness,0,1000);}
  bool enable_normal_persistence(const char *directory,const char *epoch=nullptr) {
    // Opt-in before the first sample only. Existing engineering trials keep
    // their strict same-boot seed requirement and perform NO state writes.
    if (attempted_ || normal_mode_ || shutdown_runtime_ || !normal_.configure(directory,epoch)) return false;
    if (std::atexit(shutdown_checkpoint_)!=0) return false;
    shutdown_runtime_=this;normal_mode_=true;return true;
  }
  bool checkpoint_shutdown() {
    return normal_mode_ && normal_.checkpoint(model_,int64_t(std::time(nullptr)));
  }
  int normal_startup_mode() const {return int(normal_.startup());}
  void loop() {
    const uint32_t now=esphome::millis();
    if(!attempted_){
      attempted_=true;seeded_=normal_mode_ || load_seed_();
      ESP_LOGI("cgs1.thermal","Normal startup enabled=%d, engineering seed accepted=%d",normal_mode_,!normal_mode_ && seeded_);
    }
    // AirRunner's actual timer is 2000 ms. Advancing every second would warm
    // this recurrence twice as quickly as stock despite identical equations.
    if(!cadence_.due(now))return;
    char text[128];
    if(!read_(SHT,text,sizeof(text)))return;
    float milli_t,milli_h;int used=0;
    if(std::sscanf(text,"%f,%f %n",&milli_t,&milli_h,&used)!=2 || used<=0 || text[used] ||
       !std::isfinite(milli_t) || !std::isfinite(milli_h) || milli_t< -40000 ||
       milli_t>125000 || milli_h<0 || milli_h>100000)return;
    raw_temperature_=milli_t/1000.0f;raw_humidity_=milli_h/1000.0f;raw_seen_=now;raw_valid_=true;
    if(!seeded_)return;
    if(!read_("/sys/class/power_supply/battery/voltage_now",text,sizeof(text)))return;
    char *end;float microvolts=std::strtof(text,&end);
    while(*end==' ' || *end=='\n' || *end=='\r')++end;
    if(*end || !std::isfinite(microvolts) || microvolts<2000000 || microvolts>5000000)return;
    // BatteryRunner uses a double division, decimal formatting to 2 places,
    // then float parsing. TRHRunner multiplies that field by float1000.
    char voltage[32];std::snprintf(voltage,sizeof(voltage),"%.2f",double(microvolts)/1000000.0);
    const float battery_signal=std::strtof(voltage,nullptr)*1000.0f;
    if(!read_("/sys/class/power_supply/battery/status",text,sizeof(text)))return;
    const bool external=!std::strncmp(text,"Charging",8) || !std::strncmp(text,"Full",4);
    if(!read_("/sys/class/net/wlan0/carrier",text,sizeof(text)) || (text[0]!='0' && text[0]!='1'))return;
    Sample sample{std::clamp(decimal_round(raw_temperature_,1),-20.0f,60.0f),
                  0,brightness_,screen_on_,text[0]=='1',external,battery_signal};
    const float raw_h=std::clamp(decimal_round(raw_humidity_,1),0.0f,100.0f);
    if (normal_mode_ && !normal_.started()) {
      if (!normal_.begin(model_,sample,int64_t(std::time(nullptr)))) return;
      ESP_LOGI("cgs1.thermal","Normal startup mode=%d",normal_startup_mode());
    }
    const float model_temperature=model_.step(sample);
    // Stock computes RH using the model temperature BEFORE clipping the final
    // ambient display range, and rounds both final measurements to 1 decimal.
    const float corrected_humidity=Model::humidity(raw_h,sample.raw_temperature,model_temperature);
    if(!std::isfinite(model_temperature) || !std::isfinite(corrected_humidity))return;
    temperature_=decimal_round(std::clamp(model_temperature,-20.0f,50.0f),1);
    humidity_=decimal_round(corrected_humidity,1);seen_=now;valid_=true;
    if (normal_mode_) {
      const auto saved=normal_.successful_tick(model_,int64_t(std::time(nullptr)));
      if (saved==NormalLifecycle::Save::FAILED)
        ESP_LOGW("cgs1.thermal","Thermal checkpoint not durable: %s",normal_.storage_error().c_str());
    }
  }
  float temperature() const{return fresh_(valid_,seen_)?temperature_:NAN;}
  float humidity() const{return fresh_(valid_,seen_)?humidity_:NAN;}
  float raw_temperature() const{return fresh_(raw_valid_,raw_seen_)?raw_temperature_:NAN;}
  float raw_humidity() const{return fresh_(raw_valid_,raw_seen_)?raw_humidity_:NAN;}
 private:
  static constexpr const char *SHT="/sys/devices/2005e000.i2c/i2c-3/3-0044/temper_humidy";
  Model model_;
  NormalLifecycle normal_;bool normal_mode_{false};
  inline static Runtime *shutdown_runtime_{nullptr};
  static void shutdown_checkpoint_() {
    if (shutdown_runtime_ && !shutdown_runtime_->checkpoint_shutdown())
      ESP_LOGW("cgs1.thermal","Clean-exit thermal checkpoint was not saved");
  }
  bool attempted_{false},seeded_{false},valid_{false},raw_valid_{false},screen_on_{true};
  cgs1_time::Cadence<2000> cadence_;
  int brightness_{100};uint32_t seen_{0},raw_seen_{0};
  float temperature_{NAN},humidity_{NAN},raw_temperature_{NAN},raw_humidity_{NAN};
  static bool fresh_(bool valid,uint32_t seen){return valid && uint32_t(esphome::millis()-seen)<=5000;}
  static bool read_(const char *path,char *text,size_t length) {
    int fd=::open(path,O_RDONLY|O_CLOEXEC|O_NONBLOCK);if(fd<0)return false;
    ssize_t n=::read(fd,text,length-1);::close(fd);
    if(n<=0 || n>=ssize_t(length-1))return false;text[n]=0;return true;
  }
  bool load_seed_() {
    const char *prefs=std::getenv("ESPHOME_PREFDIR");
    if(!prefs || std::strncmp(prefs,"/tmp/qingping-takeover-",23))return false;
    const std::string path=std::string(prefs)+"/../thermal-seed";
    int fd=::open(path.c_str(),O_RDONLY|O_NOFOLLOW|O_CLOEXEC);if(fd<0)return false;
    struct stat status{};
    if(fstat(fd,&status) || !S_ISREG(status.st_mode) || status.st_uid!=0 ||
       (status.st_mode&077)!=0 || status.st_size>2048){::close(fd);return false;}
    std::string seed(size_t(status.st_size),'\0');
    size_t done=0;
    while(done<seed.size()) {
      const ssize_t count=::read(fd,seed.data()+done,seed.size()-done);
      if(count<0 && errno==EINTR)continue;
      if(count<=0){::close(fd);return false;}
      done+=size_t(count);
    }
    ::close(fd);
    char boot[64],text[128];double uptime;
    if(!read_("/proc/sys/kernel/random/boot_id",boot,sizeof(boot)) ||
       !read_("/proc/uptime",text,sizeof(text)) || std::sscanf(text,"%lf",&uptime)!=1)return false;
    boot[std::strcspn(boot,"\r\n")]=0;
    HandoffState state;
    return parse_handoff(seed,boot,uptime,state) &&
        model_.seed(state.currents,state.average.data(),state.average.size(),state.has_warm?&state.warm:nullptr);
  }
};
inline Runtime runtime;
}  // namespace cgs1_thermal
