#include "../ports/monitor1/bluetooth_fiq_probe.h"
#include <array>
#include <cassert>
#include <iostream>
int main() {
  using cgs1_fiq_probe::SyncResponse;
  // The bounded experiment may tolerate only the independently observed PID1
  // console-input FD. An actual FIQ owner, shell/getty or second owner refuses.
  cgs1_fiq_probe::Result owner;
  owner.owners=1;owner.owner_pid[0]=1;owner.owner_kind[0]=2;owner.owner_process[0]=1;
  assert(cgs1_fiq_probe::only_init_console(owner));
  owner.owner_kind[0]=1;assert(!cgs1_fiq_probe::only_init_console(owner));
  owner.owner_kind[0]=2;owner.owner_process[0]=2;assert(!cgs1_fiq_probe::only_init_console(owner));
  owner.owner_process[0]=3;assert(!cgs1_fiq_probe::only_init_console(owner));
  owner.owner_process[0]=1;owner.owners=2;assert(!cgs1_fiq_probe::only_init_console(owner));
  owner.owners=1;owner.owner_pid[0]=100;assert(!cgs1_fiq_probe::only_init_console(owner));
  owner.owner_pid[0]=1;owner.owner_fd[0]=1;assert(!cgs1_fiq_probe::only_init_console(owner));
  constexpr std::array<uint8_t,15>version{{4,0x0e,12,1,1,0x10,0,6,0,0,6,0x5d,0,0,0}};
  cgs1_fiq_probe::LocalVersionResponse valid_h4;
  for(auto b:version)valid_h4.add(b);
  assert(valid_h4.found);
  auto bad_h4=version;bad_h4[4]=3;
  cgs1_fiq_probe::LocalVersionResponse wrong_opcode;
  for(auto b:bad_h4)wrong_opcode.add(b);
  assert(!wrong_opcode.found);
  bad_h4=version;bad_h4[6]=1;
  cgs1_fiq_probe::LocalVersionResponse failed_status;
  for(auto b:bad_h4)failed_status.add(b);
  assert(!failed_status.found);
  constexpr std::array<uint8_t,8>response{{0xc0,0,0x2f,0,0xd0,2,0x7d,0xc0}};
  SyncResponse good;for(auto b:response)good.add(b);assert(good.found);
  auto echo=response;echo[5]=1;echo[6]=0x7e;
  SyncResponse echoed;for(auto b:echo)echoed.add(b);assert(!echoed.found);
  auto bad=response;bad[4]^=1;
  SyncResponse corrupt;for(auto b:bad)corrupt.add(b);assert(!corrupt.found);
  SyncResponse no_opening;
  for(size_t n=1;n<response.size();++n)no_opening.add(response[n]);
  assert(!no_opening.found);
  SyncResponse noise;for(unsigned n=0;n<100;++n)noise.add('X');
  for(auto b:response)noise.add(b);
  assert(noise.found);
  SyncResponse long_frame;for(unsigned n=0;n<10;++n)long_frame.add(1);
  long_frame.add(0xc0);assert(!long_frame.found);
  SyncResponse malformed;malformed.add(0xc0);malformed.add(0xdb);malformed.add(0);
  for(auto b:response)malformed.add(b);
  assert(malformed.found);
  std::cout<<"H5/H4 response and PID1-exception classifiers PASS; no TTY opened\n";
}
