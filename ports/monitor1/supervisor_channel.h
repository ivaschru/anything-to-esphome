#pragma once

// Private Linux parent/child IPC for the forthcoming permanent supervisor.
// No listener/pathname, credentials, shell text or arbitrary command payload.
// A connected socketpair is inherited only by our child. SCM_CREDENTIALS
// checks the actual sender of EACH message; SO_PEERCRED would describe the
// socketpair creator and would not identify the later fork/exec child.
#if !defined(__linux__)
#error "Permanent supervisor IPC is Linux-only"
#endif
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/un.h>
#include <fcntl.h>
#include <unistd.h>
#include <array>
#include <cerrno>
#include <cstdint>
#include <cstring>

namespace cgs1_supervisor {
enum class Kind : uint8_t {
  HELLO=1, PULSE=2, READY=3, OTA_BEGIN=4, OTA_PROGRESS=5, OTA_END=6,
  EXIT_STOCK=7, RESTART=8, OTA_ABORT=9, ACK=100
};
struct Frame {
  Kind kind{Kind::HELLO};
  uint64_t generation{0}, sequence{0}, monotonic_ms{0}, argument{0};
};
inline bool known_kind(uint8_t kind) { return (kind>=1 && kind<=9) || kind==100; }
using Wire = std::array<uint8_t,40>;

inline Wire encode(const Frame &frame) {
  Wire data{{'C','S','L','1',1,uint8_t(frame.kind),0,0}};
  const uint64_t fields[]{frame.generation,frame.sequence,frame.monotonic_ms,frame.argument};
  for(unsigned field=0;field<4;++field)
    for(unsigned byte=0;byte<8;++byte) data[8+field*8+byte]=uint8_t(fields[field]>>(byte*8));
  return data;
}
inline bool decode(const Wire &data,Frame &result) {
  if (data[0]!='C' || data[1]!='S' || data[2]!='L' || data[3]!='1' ||
      data[4]!=1 || !known_kind(data[5]) || data[6] || data[7]) return false;
  uint64_t fields[4]{};
  for(unsigned field=0;field<4;++field)
    for(unsigned byte=0;byte<8;++byte) fields[field]|=uint64_t(data[8+field*8+byte])<<(byte*8);
  result={Kind(data[5]),fields[0],fields[1],fields[2],fields[3]};
  return true;
}

inline bool supported_pair_address(const sockaddr_un &address,socklen_t size,bool passcred_already_enabled) {
  if(address.sun_family!=AF_UNIX)return false;
  if(size==sizeof(sa_family_t))return true;
  // Linux can autobind even a connected socketpair on its first credential-
  // carrying send. The inherited FD then reports NUL + five lowercase hex
  // digits after exec. This is not a new listener/discovery route. Accept
  // only that kernel format on an already credential-enabled endpoint;
  // per-message PID/UID and the external guardian identity remain required.
  if(!passcred_already_enabled || size!=sizeof(sa_family_t)+6 || address.sun_path[0])return false;
  for(unsigned i=1;i<=5;++i)
    if(!((address.sun_path[i]>='0' && address.sun_path[i]<='9') ||
         (address.sun_path[i]>='a' && address.sun_path[i]<='f')))return false;
  return true;
}

inline bool configure_channel(int fd,bool inherit_across_exec=false) {
  struct stat status{};int type=0; socklen_t size=sizeof(type);
  int passcred=0;socklen_t passcred_size=sizeof(passcred);
  sockaddr_un local{},peer{};socklen_t local_size=sizeof(local),peer_size=sizeof(peer);
  if(fd<3 || ::fstat(fd,&status) || !S_ISSOCK(status.st_mode) ||
     ::getsockopt(fd,SOL_SOCKET,SO_TYPE,&type,&size) || type!=SOCK_SEQPACKET ||
     ::getsockopt(fd,SOL_SOCKET,SO_PASSCRED,&passcred,&passcred_size) ||
     ::getsockname(fd,reinterpret_cast<sockaddr *>(&local),&local_size) ||
     ::getpeername(fd,reinterpret_cast<sockaddr *>(&peer),&peer_size) ||
     !supported_pair_address(local,local_size,passcred==1) ||
     !supported_pair_address(peer,peer_size,passcred==1)) return false;
  const int flags=::fcntl(fd,F_GETFL),descriptor=::fcntl(fd,F_GETFD);
  const int enabled=1;
  return flags>=0 && descriptor>=0 &&
      !::fcntl(fd,F_SETFL,flags|O_NONBLOCK) &&
      !::fcntl(fd,F_SETFD,inherit_across_exec ? descriptor & ~FD_CLOEXEC : descriptor | FD_CLOEXEC) &&
      !::setsockopt(fd,SOL_SOCKET,SO_PASSCRED,&enabled,sizeof(enabled));
}

enum class Send { SENT, BLOCKED, FAILED };
// Shared private packet transport. Typed protocols below supply their own
// distinct magic/decoder; this helper is not exposed through an API.
inline Send send_wire(int fd,const Wire &data) {
  const ssize_t sent=::send(fd,data.data(),data.size(),MSG_DONTWAIT|MSG_NOSIGNAL);
  if(sent==ssize_t(data.size())) return Send::SENT;
  // SOCK_SEQPACKET writes are atomic. EAGAIN has sent no packet; all other
  // errors are failures, never an automatic command replay or blocking loop.
  if(sent<0 && (errno==EAGAIN || errno==EWOULDBLOCK)) return Send::BLOCKED;
  return Send::FAILED;
}
inline Send send_frame(int fd,const Frame &frame) {
  return known_kind(uint8_t(frame.kind)) ? send_wire(fd,encode(frame)) : Send::FAILED;
}

enum class Receive { FRAME, EMPTY, CLOSED, INVALID, FAILED };
inline Receive receive_wire(int fd,pid_t expected_pid,uid_t expected_uid,Wire &result) {
  if(expected_pid<=1) return Receive::INVALID;
  Wire data{};iovec buffer{data.data(),data.size()};
  // Credentials plus a bounded unexpected-rights buffer. ALL received FDs
  // are closed before rejecting an SCM_RIGHTS packet, including truncation.
  // The kernel closes rights that cannot fit in this control buffer.
  alignas(cmsghdr) char control[CMSG_SPACE(sizeof(ucred))+CMSG_SPACE(8*sizeof(int))]{};
  msghdr message{};message.msg_iov=&buffer;message.msg_iovlen=1;
  message.msg_control=control;message.msg_controllen=sizeof(control);
  const ssize_t count=::recvmsg(fd,&message,MSG_DONTWAIT|MSG_CMSG_CLOEXEC);
  if(count<0) return errno==EAGAIN || errno==EWOULDBLOCK ? Receive::EMPTY : Receive::FAILED;
  unsigned credentials=0;bool unexpected=false,identity=false;
  for(cmsghdr *item=CMSG_FIRSTHDR(&message);item;item=CMSG_NXTHDR(&message,item)) {
    if(item->cmsg_len<CMSG_LEN(0)) {unexpected=true;continue;}
    if(item->cmsg_level==SOL_SOCKET && item->cmsg_type==SCM_RIGHTS) {
      const size_t bytes=item->cmsg_len-CMSG_LEN(0);
      for(size_t offset=0;offset+sizeof(int)<=bytes;offset+=sizeof(int)) {
        int received=-1;std::memcpy(&received,CMSG_DATA(item)+offset,sizeof(received));
        if(received>=0) ::close(received);
      }
      unexpected=true;
    } else if(item->cmsg_level==SOL_SOCKET && item->cmsg_type==SCM_CREDENTIALS &&
              item->cmsg_len==CMSG_LEN(sizeof(ucred))) {
      ucred sender{};std::memcpy(&sender,CMSG_DATA(item),sizeof(sender));++credentials;
      identity=sender.pid==expected_pid && sender.uid==expected_uid;
    } else unexpected=true;
  }
  if(count==0 && !message.msg_controllen && !(message.msg_flags&(MSG_TRUNC|MSG_CTRUNC)))
    return Receive::CLOSED;
  if(count!=ssize_t(data.size()) || (message.msg_flags&(MSG_TRUNC|MSG_CTRUNC)) ||
     unexpected || credentials!=1 || !identity) return Receive::INVALID;
  result=data;return Receive::FRAME;
}
inline Receive receive_frame(int fd,pid_t expected_pid,uid_t expected_uid,Frame &result) {
  Wire wire{};const auto received=receive_wire(fd,expected_pid,expected_uid,wire);
  if(received!=Receive::FRAME)return received;
  Frame candidate;if(!decode(wire,candidate))return Receive::INVALID;
  result=candidate;return Receive::FRAME;
}
}  // namespace cgs1_supervisor
