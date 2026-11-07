"""Compile the actual quiet adapter and SCD4x update, including all early returns.

Timed fake I2C checks rail sequencing, stale-source fallback, CRC/IO failure,
shutdown and timer wrap under ASan/UBSan. This is not an acoustic hardware test.
"""
from pathlib import Path
import subprocess
import tempfile
import unittest
ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / 'ports/lite/components'
HAL = '\n#pragma once\n#include <cstdint>\n#include <functional>\n#include <vector>\n#include <cmath>\nnamespace esphome {\ninline uint32_t clock_us=0;\ninline uint32_t millis(){return clock_us/1000U;}\ninline uint32_t micros(){return clock_us;}\ninline void delayMicroseconds(uint32_t n){clock_us+=n;}\nnamespace setup_priority {constexpr float DATA=600;}\nstruct Component {\n virtual ~Component()=default;\n virtual void setup(){}; virtual void loop(){}; virtual void dump_config(){};\n virtual void on_shutdown(){}; virtual float get_setup_priority()const{return 0;}\n template<class F> void set_timeout(const char*,uint32_t,F){}\n void cancel_timeout(const char*){}\n void status_set_warning(){}; void status_clear_warning(){};\n};\nstruct GPIOPin {\n bool high=true; std::vector<bool> writes;\n void setup(){}; void digital_write(bool v){high=v;writes.push_back(v);}\n};\nnamespace sensor {\nstruct Sensor {\n float state=0; unsigned count=0; std::function<void(float)> callback;\n void add_on_state_callback(std::function<void(float)> f){callback=f;}\n void publish_state(float v){state=v;++count;if(callback)callback(v);}\n};\n}\nnamespace pmsa003i {\nstruct PMSA003IComponent {\n void stop_poller(){};void start_poller(){};void update(){};\n bool is_failed(){return false;}void status_clear_warning(){};\n};\n}\n}\n'

DRIVER_STUB = '\nnamespace esphome::scd4x {\nstatic constexpr uint16_t SCD4X_CMD_GET_DATA_READY_STATUS=0xe4b8;\nstatic constexpr uint16_t SCD4X_CMD_READ_MEASUREMENT=0xec05;\nstatic constexpr unsigned SINGLE_SHOT=2, SINGLE_SHOT_RHT_ONLY=3;\nstruct SCD4XComponent {\n bool initialized_=true;\n unsigned measurement_mode_=0,warnings=0,clears=0;\n sensor::Sensor co2,t,h; sensor::Sensor *co2_sensor_=&co2,*temperature_sensor_=&t,*humidity_sensor_=&h;\n sensor::Sensor *ambient_pressure_source_=nullptr;\n cgdn1_pm::Cgdn1Pm *transaction_gate_=nullptr;\n GPIOPin *pin=nullptr;\n uint16_t ready=1,fail_write=0,command=0;\n bool fail_ready_read=false,fail_measurement_read=false;\n int last_error_=0;\n qingping_pm::ScdIoTrace io_trace_;\n uint32_t command_at=0,extra_us=0;\n std::vector<uint16_t> writes;\n void status_set_warning(){++warnings;}void status_clear_warning(){++clears;}\n void set_ambient_pressure_compensation(float){};void start_measurement_(){}\n template<class F>void set_timeout(uint32_t ms,F f){clock_us+=ms*1000;f();}\n bool write_command(uint16_t cmd){\n   assert(pin->high);command=cmd;command_at=clock_us;clock_us+=1350;\n   writes.push_back(cmd);last_error_=cmd==fail_write?2:0;return cmd!=fail_write;\n }\n bool read_data(uint16_t &value){\n   assert(pin->high);assert(uint32_t(clock_us-command_at)>=1000);\n   clock_us+=1800+extra_us;last_error_=0;\n   if(fail_ready_read)return false;value=ready;return true;\n }\n bool read_data(uint16_t *value,unsigned length){\n   assert(pin->high);assert(length==3);assert(uint32_t(clock_us-command_at)>=1000);\n   clock_us+=4500;last_error_=0;\n   if(fail_measurement_read)return false;value[0]=775;value[1]=25000;value[2]=30000;return true;\n }\n void update();\n};\n}\n'

TESTS = '\nstruct Rig {\n esphome::GPIOPin pin;\n esphome::pmsa003i::PMSA003IComponent reader;\n esphome::sensor::Sensor raw_t,raw_h;\n esphome::cgdn1_pm::Cgdn1Pm pm;\n esphome::scd4x::SCD4XComponent scd;\n Rig(){\n  esphome::clock_us=1000000;scd.pin=&pin;scd.transaction_gate_=&pm;\n  pm.set_enable_pin(&pin);pm.set_reader(&reader);\n  pm.set_source_sensors(&scd.co2,&raw_t,&raw_h);pm.set_enabled(false);pm.setup();\n }\n void cut(){scd.co2.publish_state(770);raw_t.publish_state(25);raw_h.publish_state(40);pm.loop();assert(!pin.high);}\n};\nint main(){\n // No LOW until all sources actually reported; boot-time reads stay ordinary.\n {Rig r;assert(r.pin.high);r.scd.update();assert(r.pin.high&&r.scd.co2.count==1);}\n // Success closes before publish_state; expensive callbacks cannot extend HIGH.\n {Rig r;r.cut();auto original=r.scd.co2.callback;\n  r.scd.co2.callback=[&](float v){assert(!r.pin.high);original(v);esphome::clock_us+=50000;};\n  r.scd.update();assert(!r.pin.high&&r.scd.co2.count==2);\n  assert(r.pm.window_detail().find("max_us=12000")!=std::string::npos);\n  assert(r.pm.window_detail().find("failed=0")!=std::string::npos);}\n // Every error path restores stable HIGH. A later successful poll cannot rearm.\n for(unsigned failure=0;failure<4;++failure){Rig r;r.cut();\n  if(failure==0)r.scd.fail_write=0xe4b8;\n  if(failure==1)r.scd.fail_ready_read=true;\n  if(failure==2)r.scd.fail_write=0xec05;\n  if(failure==3)r.scd.fail_measurement_read=true;\n  r.scd.update();assert(r.pin.high&&r.pm.rail_state()=="Transaction guard fallback");\n  r.scd.fail_write=0;r.scd.fail_ready_read=false;r.scd.fail_measurement_read=false;\n  r.scd.update();r.pm.loop();assert(r.pin.high);\n }\n {Rig r;r.cut();r.scd.ready=0;r.scd.update();assert(!r.pin.high);\n  assert(r.pm.window_detail().find("failed=0")!=std::string::npos);}\n {Rig r;r.cut();r.scd.extra_us=30000;r.scd.update();assert(r.pin.high);\n  assert(r.pm.rail_state()=="Transaction guard fallback");}\n {Rig r;r.cut();esphome::clock_us+=600000000U;\n  // Keep sources fresh so this checks the trial deadline independently of\n  // the earlier 90-second source guard.\n  r.scd.co2.publish_state(780);r.raw_t.publish_state(25);r.raw_h.publish_state(40);r.pm.loop();\n#if TX_PERMANENT\n  assert(!r.pin.high&&r.pm.rail_state()=="GPIO13 LOW + CO2 windows");\n#else\n  assert(r.pin.high&&r.pm.rail_state()=="Transaction trial complete");\n#endif\n }\n {Rig r;r.cut();r.pm.on_shutdown();assert(r.pin.high);r.pm.loop();assert(r.pin.high);}\n {Rig r;r.cut();esphome::clock_us+=90001000U;r.pm.loop();assert(r.pin.high);}\n {Rig r;r.cut();r.scd.initialized_=false;r.scd.update();assert(r.scd.writes.empty()&&!r.pin.high);}\n {qingping_pm::TransactionWindow w;assert(w.begin(0xfffff000U));\n  assert(!w.begin(0xfffff001U));w.end(uint32_t(0xfffff000U+12000U),true);\n  assert(w.last_us()==12000&&!w.failed()&&!w.active());}\n {qingping_pm::TransactionWindow w;w.observe_low(0xffff0000U);\n  w.observe_low(uint32_t(0xffff0000U+600000U));assert(w.completed()==!TX_PERMANENT);}\n std::cout<<"Actual PM adapter + SCD4x update: success, all error/CRC returns, not-ready, duration, shutdown, source/trial and wrap guards passed\\n";\n}\n'

class QuietPolicyTests(unittest.TestCase):
    def test_actual_driver_and_window_guards(self):
        source = (STAGE/'scd4x/scd4x.cpp').read_text()
        method = source[source.index('void SCD4XComponent::update() {'):source.index('bool SCD4XComponent::perform_forced_calibration')]
        with tempfile.TemporaryDirectory(prefix='qingping-tx-window-') as directory:
            root=Path(directory)
            for name in ('esphome/core/component.h','esphome/core/hal.h',
                         'esphome/components/pmsa003i/pmsa003i.h', 'esphome/components/sensor/sensor.h'):
                p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(HAL)
            # The same #pragma-once content at different paths would define the fake
            # SDK repeatedly. Keep a single real header and have all facades include it.
            (root/'fake.h').write_text(HAL)
            for p in root.rglob('*.h'):
                if p.name!='fake.h':p.write_text('#pragma once\n#include "fake.h"\n')
            (root/'esphome/core/log.h').write_text('''#pragma once
        #define ESP_LOGI(...) ((void)0)
        #define ESP_LOGW(...) ((void)0)
        #define ESP_LOGCONFIG(...) ((void)0)
        #define LOG_PIN(...) ((void)0)
        ''')
            code='#include <cassert>\n#include <iostream>\n#include <string>\n'
            code+=f'#include "{STAGE}/cgdn1_pm/cgdn1_pm.h"\n'
            code+=f'#include "{STAGE}/scd4x/scd4x_io_trace.h"\n'
            code+=DRIVER_STUB+'\nnamespace esphome::scd4x {\n'+method+'}\n'+TESTS
            (root/'test.cpp').write_text(code)
            subprocess.run(['clang++','-std=c++17','-Wall','-Wextra','-Werror',f'-DTX_PERMANENT={1}',
                            '-fsanitize=address,undefined','-I',str(root),str(root/'test.cpp'),
                            '-o',str(root/'test')],check=True)
            subprocess.run([str(root/'test')],check=True)
