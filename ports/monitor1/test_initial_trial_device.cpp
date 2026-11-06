// Portable identity/INI fixtures. No actual INI, device or credential read.
#ifdef NDEBUG
#error "Device identity fixtures require enabled assertions"
#endif
#include "initial_trial_device.h"
#include <cassert>
#include <cstdio>
using namespace cgs1_initial_trial;
int main() {
  int type=99;
  for(const auto &entry:std::array<std::pair<std::string,int>,4>{{
      {"[sensors]\nco2_type=2\n",2},{"[sensors]\r\n co2_type = 3\r\n",3},
      {"[unrelated]\nco2_type=7\n[sensors]\nco2_type=2\n[other]\nco2_type=0\n",2},
      {"; comment\n[sensors]\n# co2_type=1\nco2_type=3",3}}}) {
    assert(initial_co2_setting(entry.first,type) && type==entry.second);
  }
  for(const auto &text:std::array<std::string,10>{"","[sensors]\n","[sensors]\nco2_type=1\n",
      "[sensors]\nco2_type=02\n","[sensors]\nco2_type=2\nco2_type=2\n",
      "[sensors]\nco2_type=2\n[sensors]\n","[sensors]\nco2_type=3 # comment\n",
      "[sensors]\nco2_type=2=3\n",std::string(65537,'a'),std::string("[sensors]\nco2_type=2\0",22)}) {
    type=99;assert(!initial_co2_setting(text,type) && type==0);
  }
  InitialDeviceIdentity identity{"02:00:00:00:00:01","12345678-1234-1234-1234-123456789abc",2};
  assert(identity.valid());
  for(const auto *mac:{"", "00:00:00:00:00:00", "03:00:00:00:00:01", "02:00:00:00:00:0A", "02:00:00:00:00:01\n"})
    assert(!initial_physical_wlan_identity(mac));
  for(const auto *boot:{"", "00000000-0000-0000-0000-000000000000", "12345678-1234-1234-1234-123456789abC", "1234567811234-1234-1234-123456789abc"})
    assert(!initial_boot_identity(boot));
  identity.co2_type=1;assert(!identity.valid());
  std::puts("initial device identity parser fixtures passed");
}
