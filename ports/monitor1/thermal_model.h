#pragma once

// Numerical reconstruction of the thermal model in this unit's SnowApp
// 4.1.8_0287. This file does not access hardware, write preferences, or calibrate
// a sensor. A model requires the correct starting thermal state; reproducing
// its recurrence alone does NOT establish room-temperature accuracy.
#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>

namespace cgs1_thermal {

struct ThermalPart {
  std::array<int, 10> time_constants;
  int maximum_input;
  double amplitude;
  double current{0.0};

  // The stock algorithm divides the approach to the target into ten bands.
  // Heating and cooling use different progress fractions but the same table.
  // Preserve its small numerical overshoot instead of inventing a clamp: a
  // separate emulator test compares this implementation to the ARM routine.
  float adjust(int input, int ticks = 1) {
    if (maximum_input <= 0 || ticks < 0 || ticks > 3600 ||
        !std::isfinite(amplitude) || !std::isfinite(current)) return NAN;
    const double target = amplitude * std::clamp(input, 0, maximum_input) / maximum_input;
    if (std::abs(current) > std::abs(target)) {
      if (amplitude == target) return float(current);
      const double progress = (amplitude - current) / (amplitude - target);
      if (progress < 1.0) {
        const int band = progress < 0 ? 0 : int(progress * 10.0);
        if (band > 9 || time_constants[band] <= 0) return NAN;
        current -= (amplitude - target) * ticks / 10.0 / time_constants[band];
      }
    } else if (target != 0.0) {
      const double progress = current / target;
      if (progress < 1.0) {
        const int band = progress < 0 ? 0 : int(progress * 10.0);
        if (band > 9 || time_constants[band] <= 0) return NAN;
        current += target * ticks / 10.0 / time_constants[band];
      }
    }
    return float(current);
  }
};

// Units are explicit because stock cpuInfo and batteryInfo are intermediate
// structures, not the raw /proc or power_supply text. Callers must validate
// those conversions separately before using this for physical measurements.
struct Sample {
  float raw_temperature;
  // Nominal 0..1000 input. In this exact stock release SystemRunner computes
  // CPU load for diagnostics but then emits zero to TRHRunner. Feeding actual
  // CPU load here would change the vendor model and requires separate QA.
  int cpu_input;
  int brightness;                 // actual 0..1000 backlight, before stock +10
  bool screen_on;
  bool wifi_connected;
  bool external_power;            // stock Charging or Full battery status
  // Vendor BatteryRunner reads BATTERY_VOLTAGE_FILE for both float fields.
  // The thermal input is round(voltage_now / 1e6, 2) converted to float and
  // multiplied by 1000, e.g. 4.16 V -> 4160. It is NOT current_now in mA.
  float battery_signal;
};

class Model {
 public:
  static constexpr std::array<int, 10> BASIC{165,132,189,243,324,306,471,584,1016,3053};
  static constexpr std::array<int, 10> WIFI{154,208,310,221,270,293,422,562,1118,2376};
  static constexpr std::array<int, 10> SCREEN{20,84,112,124,148,241,323,375,658,2054};
  static constexpr std::array<int, 10> CPU{400,300,300,300,430,418,418,418,818,1481};
  static constexpr std::array<int, 10> BATTERY{88,134,874,1612,1770,1957,2481,2870,2746,4860};
  static constexpr std::array<int, 10> WARM{165,182,219,263,324,406,571,684,1016,3053};

  ThermalPart basic{BASIC,1,1.5};
  ThermalPart wifi{WIFI,1,0.1};
  ThermalPart screen_off{WIFI,1,-0.0};
  ThermalPart backlight{SCREEN,1000,1.1};
  ThermalPart cpu{CPU,1000,2.0};
  ThermalPart battery{BATTERY,1,-0.2};
  ThermalPart charging{WIFI,1200,0.7};

  // One call represents one successful stock sampling tick, not an arbitrary
  // duration since the previous call. Do not advance through failed reads.
  // Warm restart reconstruction/transfer and the optional warm-start residual
  // are intentionally not silently approximated here.
  float step(const Sample &s) {
    if (!std::isfinite(s.raw_temperature) || !std::isfinite(s.battery_signal)) return NAN;
    float temperature = s.raw_temperature;
    temperature -= basic.adjust(1);
    temperature -= wifi.adjust(s.wifi_connected ? 1 : 0);
    temperature -= screen_off.adjust(s.screen_on ? 0 : 1);
    temperature -= backlight.adjust(s.screen_on ? s.brightness + 10 : 0);
    temperature -= cpu.adjust(s.cpu_input);
    temperature -= battery.adjust(s.external_power ? 0 : 1);
    // Preserve the verified numerical branch without claiming physical units
    // for its intermediate battery scalar. The tracked maximum is used in
    // vendor diagnostics; the actual adjust call receives only 0 or 1200.
    if (s.battery_signal > maximum_battery_signal_) maximum_battery_signal_ = int(s.battery_signal);
    const int charging_input = s.battery_signal > 300.0f ? 1200 : 0;
    temperature -= charging.adjust(charging_input);
    if (warm_residual_enabled_) temperature -= warm_residual_.adjust(0);
    return average_.push(float(double(temperature) + 0.1));
  }

  // Import only a validated same-device snapshot immediately before handoff.
  // The caller owns version/hash/age validation; a stale/cross-device seed is
  // not a calibration. This carries individual heat terms and the real last
  // twenty results, rather than replacing the model with a fixed offset.
  bool seed(const std::array<double,7> &currents,const float *history,size_t count,
            const ThermalPart *warm_residual=nullptr) {
    if ((count && !history) || count>20) return false;
    for (double current:currents) if (!std::isfinite(current) || std::abs(current)>20) return false;
    for (size_t i=0;i<count;++i)
      if (!std::isfinite(history[i]) || history[i]<-40 || history[i]>100) return false;
    if (warm_residual && (!std::isfinite(warm_residual->amplitude) ||
        !std::isfinite(warm_residual->current) || std::abs(warm_residual->amplitude)>20 ||
        std::abs(warm_residual->current)>20 || warm_residual->maximum_input!=1)) return false;
    if (warm_residual)
      for (int value:warm_residual->time_constants) if (value<1 || value>1000000) return false;
    ThermalPart *parts[]={&basic,&wifi,&screen_off,&backlight,&cpu,&battery,&charging};
    for (size_t i=0;i<currents.size();++i) parts[i]->current=currents[i];
    average_=Average{};
    for (size_t i=0;i<count;++i) average_.push(history[i]);
    warm_residual_enabled_=warm_residual!=nullptr;
    if (warm_residual) warm_residual_=*warm_residual;
    return true;
  }

  // Stock initWarmStart restores terms only for abs(now-last_shutdown)<=1799
  // seconds, then replays that many successful-model ticks with the current
  // startup sample. The average starts empty on process restart. Preserve that
  // policy independently of optional engineering handoff/snapshot tooling.
  // Validate before assignment so a malformed record cannot partially change
  // an otherwise fresh cold-start model.
  bool warm_start(int64_t now,int64_t last_shutdown,const std::array<double,7> &currents,
                  const ThermalPart *warm_residual,const Sample &startup_sample) {
    if(now<=0 || last_shutdown<=0 || now>4102444800LL || last_shutdown>4102444800LL)return false;
    const int64_t elapsed=now>=last_shutdown?now-last_shutdown:last_shutdown-now;
    if(elapsed>1799)return false;
    Model restored;
    if(!restored.seed(currents,nullptr,0,warm_residual))return false;
    for(int64_t i=0;i<elapsed;++i)
      if(!std::isfinite(restored.step(startup_sample)))return false;
    *this=restored;
    return true;
  }

  // Ordinary stock persistence saves these terms, not the engineering
  // handoff's 20-sample average. Expose copies/read-only data so checkpoint
  // serialization cannot mutate the running model or silently carry an old
  // display average across a normal process restart.
  std::array<double,7> currents() const {
    return {basic.current, wifi.current, screen_off.current, backlight.current,
            cpu.current, battery.current, charging.current};
  }
  const ThermalPart *warm_residual() const {
    return warm_residual_enabled_ ? &warm_residual_ : nullptr;
  }

  // The original RH transform keeps water-vapour partial pressure constant
  // when replacing warm in-case temperature with the ambient estimate. This
  // does not add water or independently calibrate the humidity sensor.
  static float humidity(float raw_humidity, float raw_temperature, float ambient_temperature) {
    if (!std::isfinite(raw_humidity) || raw_humidity < 0 || raw_humidity > 100 ||
        !std::isfinite(raw_temperature) || !std::isfinite(ambient_temperature) ||
        raw_temperature < -40 || raw_temperature > 100 ||
        ambient_temperature < -40 || ambient_temperature > 100) return NAN;
    const double exponent = 4283.78 * double(raw_temperature - ambient_temperature) /
        ((double(ambient_temperature) + 243.12) * (double(raw_temperature) + 243.12));
    return float(std::clamp(double(raw_humidity) * std::exp(exponent), 0.0, 100.0));
  }

 private:
  class Average {
   public:
    float push(float value) {
      values_[next_] = value;
      next_ = (next_ + 1) % values_.size();
      if (count_ < values_.size()) ++count_;
      // Stock sums in float precision. A recomputed sum avoids an indefinitely
      // accumulating error; chronological order also matches its deque.
      float sum = 0;
      const size_t first = count_ == values_.size() ? next_ : 0;
      for (size_t i=0; i<count_; ++i) sum += values_[(first+i)%values_.size()];
      return sum / count_;
    }
   private:
    std::array<float,20> values_{};
    size_t next_{0}, count_{0};
  } average_;
  int maximum_battery_signal_{1200};
  bool warm_residual_enabled_{false};
  ThermalPart warm_residual_{BASIC,1,0.0};
};

}  // namespace cgs1_thermal
