#include "../ports/monitor1/bluetooth_kernel_probe.h"
#include <cassert>
#include <iostream>
#include <vector>
int main() {
  using namespace cgs1_bt_probe;
  Result r;
  std::vector<uint8_t> version{1,0,255,255,6,0,1,0,0,1,3,0};
  assert(decode(1,version.data(),version.size(),r));
  assert(r.version==1 && r.revision==3 && r.version_read);
  auto wrong=version;wrong[2]=0;
  assert(!decode(1,wrong.data(),wrong.size(),r));
  wrong=version;wrong[8]=1;
  assert(!decode(1,wrong.data(),wrong.size(),r));
  assert(!decode(1,version.data(),version.size()-1,r));
  assert(!decode(3,version.data(),version.size(),r));
  std::vector<uint8_t> commands{1,0,255,255,7,0,2,0,0,0,0,0,0};
  assert(decode(2,commands.data(),commands.size(),r));
  assert(r.commands==0 && r.events==0 && r.commands_read);
  commands[9]=255;commands[10]=255;
  assert(!decode(2,commands.data(),commands.size(),r));
  std::vector<uint8_t> indexes{1,0,255,255,5,0,3,0,0,0,0};
  assert(decode(3,indexes.data(),indexes.size(),r) && r.controllers==0);
  indexes[9]=1;
  assert(!decode(3,indexes.data(),indexes.size(),r));
  // No socket experiment is available on the Mac host. This verifies refusal,
  // not Linux behavior; the actual target run remains a separate qualification.
#if !defined(__linux__)
  auto refused=run();assert(!refused.complete && refused.sent==0 && refused.error==ENOTSUP);
  std::cout<<"Non-Linux socket refusal PASS\n";
#endif
  std::cout<<"MGMT parser positive/refusal cases PASS (no host Bluetooth socket opened)\n";
}
