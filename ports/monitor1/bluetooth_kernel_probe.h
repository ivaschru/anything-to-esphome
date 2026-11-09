#pragma once
// Fixed software-capability probe. No tty, GPIO, rfkill, HCI-controller
// command, scan, firmware download, module loader or persistent write exists.
// Only three global MGMT READ requests are sent to an already loaded kernel
// Bluetooth stack. The caller separately applies the ordinary board checks.
#include <array>
#include <cerrno>
#include <chrono>
#include <cstddef>
#include <cstdint>
#if defined(__linux__)
#include <poll.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <unistd.h>
#endif

namespace cgs1_bt_probe {
struct Result {
  bool attempted=false, complete=false, loaded_stack=false;
  bool control_bound=false, version_read=false, commands_read=false, indexes_read=false;
  int error=0, stage=0, version=-1, revision=-1, commands=-1, events=-1, controllers=-1;
  unsigned sent=0, received=0;
};
inline uint16_t le16(const uint8_t *p) { return uint16_t(p[0]) | uint16_t(p[1])<<8; }

// Decode only a matching global command-complete frame. Ignore unrelated
// events, refuse length/count inconsistencies and never retain raw event data.
inline bool decode(uint16_t command,const uint8_t *p,size_t n,Result &r) {
  if(n<9 || le16(p)!=1 || le16(p+2)!=0xffff || le16(p+4)!=n-6 ||
     le16(p+6)!=command || p[8]!=0) return false;
  const auto *data=p+9; const size_t size=n-9;
  if(command==1 && size==3) {
    r.version=data[0];r.revision=le16(data+1);r.version_read=true;return true;
  }
  if(command==2 && size>=4) {
    const unsigned commands=le16(data),events=le16(data+2);
    if(commands+events>512 || size!=4+2*(commands+events))return false;
    r.commands=commands;r.events=events;r.commands_read=true;return true;
  }
  if(command==3 && size>=2) {
    const unsigned count=le16(data);
    if(count>64 || size!=2+2*count)return false;
    r.controllers=count;r.indexes_read=true;return true;
  }
  return false;
}

inline Result run() {
  Result r;r.attempted=true;
#if defined(__linux__)
  // Avoid socket-triggered Bluetooth module autoload when the base stack is
  // absent. This is a precondition, never a request to load/enable anything.
  struct stat st{};
  if(::lstat("/sys/module/bluetooth",&st)!=0 || !S_ISDIR(st.st_mode)) {
    r.stage=1;r.error=errno?errno:ENODEV;return r;
  }
  r.loaded_stack=true;
  const int fd=::socket(AF_BLUETOOTH,SOCK_RAW|SOCK_NONBLOCK|SOCK_CLOEXEC,1);
  if(fd<0) {r.stage=2;r.error=errno;return r;}
  struct Close {int fd;~Close(){::close(fd);}} close{fd};
  // Linux v3.10 HCI socket ABI: family, device=NONE, channel=CONTROL(3).
  // CONTROL binding itself does not power or open an HCI controller.
  struct Address {sa_family_t family;uint16_t device,channel;};
  static_assert(sizeof(Address)==6,"Unexpected Linux HCI sockaddr ABI");
  Address address{AF_BLUETOOTH,0xffff,3};
  if(::bind(fd,reinterpret_cast<const sockaddr*>(&address),sizeof(address))!=0) {
    r.stage=3;r.error=errno;return r;
  }
  r.control_bound=true;
  const auto deadline=std::chrono::steady_clock::now()+std::chrono::milliseconds(1200);
  // This immutable allowlist is the whole sender. No remotely supplied
  // opcode/index/payload, automatic retry or controller-specific command.
  for(const uint8_t command:{uint8_t(1),uint8_t(2),uint8_t(3)}) {
    r.stage=10+command;
    const std::array<uint8_t,6> request{{command,0,0xff,0xff,0,0}};
    const auto sent=::send(fd,request.data(),request.size(),MSG_NOSIGNAL|MSG_DONTWAIT);
    if(sent!=ssize_t(request.size())) {r.error=sent<0?errno:EIO;return r;}
    ++r.sent;bool matched=false;
    for(unsigned packet=0;packet<8 && !matched;++packet) {
      const auto remaining=std::chrono::duration_cast<std::chrono::milliseconds>(
          deadline-std::chrono::steady_clock::now()).count();
      if(remaining<=0) {r.error=ETIMEDOUT;return r;}
      pollfd wait{fd,POLLIN,0};
      const int ready=::poll(&wait,1,int(remaining));
      if(ready<=0 || !(wait.revents&POLLIN)) {r.error=ready<0?errno:ETIMEDOUT;return r;}
      std::array<uint8_t,2048> response{};
      const auto count=::recv(fd,response.data(),response.size(),MSG_DONTWAIT|MSG_TRUNC);
      if(count<=0 || count>ssize_t(response.size())) {r.error=count<0?errno:EMSGSIZE;return r;}
      ++r.received;matched=decode(command,response.data(),size_t(count),r);
    }
    if(!matched) {r.error=EPROTO;return r;}
  }
  r.stage=20;r.complete=r.version_read && r.commands_read && r.indexes_read;
#else
  r.stage=1;r.error=ENOTSUP;
#endif
  return r;
}

template<class Json> inline void report(Json root) {
  // Cache the single attempt for this process; reading a lost response does
  // not run the socket experiment again. No result is persisted on the device.
  static const Result r=run();
  root["attempted"]=r.attempted;root["complete"]=r.complete;
  root["loaded_stack"]=r.loaded_stack;root["control_bound"]=r.control_bound;
  root["version_read"]=r.version_read;root["commands_read"]=r.commands_read;
  root["indexes_read"]=r.indexes_read;root["stage"]=r.stage;root["errno"]=r.error;
  root["version"]=r.version;root["revision"]=r.revision;
  root["commands"]=r.commands;root["events"]=r.events;root["controllers"]=r.controllers;
  root["requests_sent"]=r.sent;root["responses_received"]=r.received;
  root["radio_commands_sent"]=0;root["uart_opened"]=false;
}
} // namespace cgs1_bt_probe
