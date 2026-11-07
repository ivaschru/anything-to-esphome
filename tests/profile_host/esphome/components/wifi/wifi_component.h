#pragma once
#include "common.h"
namespace esphome::wifi {
struct FixtureAP {
 FixtureText ssid,password;
 FixtureText get_ssid()const{return ssid;}
 FixtureText get_password()const{return password;}
};
struct FixtureWifi {
 FixtureAP get_sta()const{return {{"test-сеть"},{"test-quote\"-backslash\\-password"}};}
 FixtureAP get_ap()const{return {{"test-ap"},{"test-ap-password"}};}
};
inline FixtureWifi wifi;
inline FixtureWifi *global_wifi_component=&wifi;
}
