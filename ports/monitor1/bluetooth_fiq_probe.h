#pragma once
// Experimental existing-TTY probe, NEVER a production Bluetooth transport.
// No ttyS*, baud/flow-control change, driver detach, GPIO/rfkill, firmware load,
// controller reset/radio command or scan. Only fixed H5 SYNC or H4 Read Local
// Version may be transmitted after a clean passive attempt on the same node.
// FIQ's debug RX parser remains
// a separate production blocker; do not attach HCI or pass arbitrary payloads.
#include <array>
#include <cerrno>
#include <cstdio>
#include <cstdlib>
#include <cstdint>
#include <cstring>
#if defined(__linux__)
#include <dirent.h>
#include <fcntl.h>
#include <poll.h>
#include <signal.h>
#include <sys/stat.h>
#include <sys/sysmacros.h>
#include <sys/wait.h>
#include <termios.h>
#include <unistd.h>
#endif

namespace cgs1_fiq_probe {
// A strict tiny SLIP decoder: count only a checksummed H5 link-control SYNC
// RESPONSE. An echoed request is NOT evidence of a controller. Console bytes,
// long frames, malformed escapes and CRC-bearing variants are never accepted.
class SyncResponse {
 public:
  void add(uint8_t byte) {
    if(byte==0xc0) {
      if(started_ && used_==6 && !bad_ && !escape_ &&
         uint8_t(frame_[0]+frame_[1]+frame_[2]+frame_[3])==0xff &&
         !(frame_[0]&0xc0) && (frame_[1]&15)==15 &&
         ((frame_[1]>>4)|(unsigned(frame_[2])<<4))==2 &&
         frame_[4]==2 && frame_[5]==0x7d)found=true;
      used_=0;bad_=false;escape_=false;started_=true;return;
    }
    // A closing delimiter alone cannot turn arbitrary console bytes into a
    // packet. Require an opening delimiter before accumulating any payload.
    if(!started_ || bad_)return;
    if(escape_) {
      escape_=false;
      if(byte==0xdc)byte=0xc0;
      else if(byte==0xdd)byte=0xdb;
      else if(byte==0xde)byte=0x11;
      else if(byte==0xdf)byte=0x13;
      else {bad_=true;return;}
    }else if(byte==0xdb) {escape_=true;return;}
    if(used_>=frame_.size()) {bad_=true;return;}
    frame_[used_++]=byte;
  }
  bool found=false;
 private:
  std::array<uint8_t,6>frame_{};unsigned used_=0;bool bad_=false,escape_=false,started_=false;
};
// H4's fixed Read Local Version response is fifteen bytes: one completed
// command for opcode0x1001, success, then the eight version bytes. Neither a
// four-byte request echo nor an unrelated command completion can qualify it.
class LocalVersionResponse {
 public:
  void add(uint8_t byte) {
    if(used_<frame_.size())frame_[used_++]=byte;
    else {
      for(unsigned i=1;i<frame_.size();++i)frame_[i-1]=frame_[i];
      frame_.back()=byte;
    }
    if(used_==frame_.size() && frame_[0]==4 && frame_[1]==0x0e && frame_[2]==12 &&
       frame_[3]>0 && frame_[4]==1 && frame_[5]==0x10 && frame_[6]==0 &&
       frame_[7]<=15 && frame_[10]<=15)found=true;
  }
  bool found=false;
 private:
  std::array<uint8_t,15>frame_{};unsigned used_=0;
};
struct Result {
  bool attempted=false,complete=false,driver=false,masked=false,backup=false;
  bool node=false,owners_free=false,opened=false,child_reaped=false,restored=false,sync_response=false;
  unsigned stage=0,error=0,owners=0,rx=0,tx_returned=0;
  uint64_t inode=0,node_device=0;unsigned device_major=0,device_minor=0;
  // At most four value-free FD identities. Kind 1 is the actual FIQ device,
  // kind 2 is fd0 through /dev/console. Process names are classified locally:
  // init=1, sh=2, getty=3, other/unknown=4. Never return argv or raw /proc text.
  std::array<unsigned,4>owner_pid{},owner_fd{},owner_kind{},owner_process{};
  bool init_console_exception=false;
  bool h4_version_response=false;
};
inline bool only_init_console(const Result &r) {
  // A deliberately narrow experiment exception, established by the separate
  // live metadata observation: PID1 init owns fd0 through /dev/console, with
  // NO direct FIQ FD and no shell/getty/second input owner. This does not claim
  // an unused UART or exclusive access to the kernel debugger. It is allowed
  // only for the fixed no-newline/no-debug-command packet below, never HCI.
  return r.owners==1 && r.owner_pid[0]==1 && r.owner_fd[0]==0 &&
    r.owner_kind[0]==2 && r.owner_process[0]==1;
}
#if defined(__linux__)
inline const char *node_name(bool backup) {return backup?"/dev/ttyFIQ0.bak":"/dev/ttyFIQ0";}
inline ssize_t small_read(const char *path,char *out,size_t cap) {
  const int fd=::open(path,O_RDONLY|O_NONBLOCK|O_CLOEXEC);
  if(fd<0)return -1;
  const auto n=::read(fd,out,cap-1);const int error=errno;::close(fd);errno=error;
  if(n<0 || size_t(n)>=cap-1)return -1;
  out[n]=0;return n;
}
inline bool numeric(const char *s) {
  if(!*s)return false;
  for(;*s;++s)if(*s<'0'||*s>'9')return false;
  return true;
}
inline Result metadata(bool allow_init_console=false) {
  Result r;r.attempted=true;r.stage=1;
  DIR *bluetooth=::opendir("/sys/class/bluetooth");
  if(!bluetooth) {r.error=ENODEV;return r;}
  bool controller=false;
  while(auto *entry=::readdir(bluetooth))if(!::strncmp(entry->d_name,"hci",3))controller=true;
  ::closedir(bluetooth);
  if(controller) {r.error=EBUSY;return r;}
  char text[1024]{};unsigned ma=0,mi=0;char tail=0;
  if(small_read("/sys/class/tty/ttyFIQ0/dev",text,sizeof(text))<0 ||
     ::sscanf(text,"%u:%u %c",&ma,&mi,&tail)!=2) {r.error=ENODEV;return r;}
  r.device_major=ma;r.device_minor=mi;
  auto count=::readlink("/sys/class/tty/ttyFIQ0/device/driver",text,sizeof(text)-1);
  if(count<0 || count>=ssize_t(sizeof(text)-1)) {r.error=ENODEV;return r;}
  text[count]=0;const char *base=::strrchr(text,'/');
  if(!base || ::strcmp(base+1,"fiq_debugger")) {r.error=ENODEV;return r;}
  r.driver=true;
  char serial[8]{};const auto length=small_read("/proc/device-tree/fiq-debugger/rockchip,serial-id",serial,sizeof(serial));
  if(length!=4 || serial[0] || serial[1] || serial[2] || serial[3]!=1) {r.error=ENODEV;return r;}
  for(bool backup:{false,true}) {
    struct stat node{};
    if(::lstat(node_name(backup),&node))continue;
    if(!backup && S_ISCHR(node.st_mode) && node.st_rdev==makedev(1,3))r.masked=true;
    if(S_ISCHR(node.st_mode) && node.st_uid==0 && node.st_rdev==makedev(ma,mi)) {
      r.node=true;r.backup=backup;r.inode=node.st_ino;r.node_device=node.st_dev;break;
    }
  }
  if(!r.node) {r.error=ENODEV;return r;}
  // Refuse concurrent users, including an input reader via /dev/console.
  // Only FD metadata is inspected: no argv, environment or stream data.
  DIR *proc=::opendir("/proc");if(!proc) {r.error=errno;return r;}
  unsigned processes=0,files=0;bool okay=true;
  while(auto *entry=::readdir(proc)) {
    if(!numeric(entry->d_name) || ::strtoul(entry->d_name,nullptr,10)==unsigned(::getpid()))continue;
    if(++processes>1024) {okay=false;break;}
    char directory[128]{};::snprintf(directory,sizeof(directory),"/proc/%.12s/fd",entry->d_name);
    DIR *fds=::opendir(directory);
    if(!fds) {if(errno!=ENOENT && errno!=ESRCH)okay=false;continue;}
    while(auto *fd=::readdir(fds)) {
      if(!numeric(fd->d_name))continue;
      if(++files>16384) {okay=false;break;}
      char path[256]{};::snprintf(path,sizeof(path),"%s/%.12s",directory,fd->d_name);
      struct stat st{};
      if(::stat(path,&st)) {if(errno!=ENOENT && errno!=ESRCH)okay=false;}
      unsigned kind=0;
      if(S_ISCHR(st.st_mode) && st.st_rdev==makedev(ma,mi))kind=1;
      if(!::strcmp(fd->d_name,"0")) {
        const auto n=::readlink(path,text,sizeof(text)-1);
        if(n>0) {text[n]=0;if(!::strcmp(text,"/dev/console"))kind=2;}
      }
      if(kind) {
        const unsigned at=r.owners++;
        if(at<r.owner_pid.size()) {
          r.owner_pid[at]=unsigned(::strtoul(entry->d_name,nullptr,10));
          r.owner_fd[at]=unsigned(::strtoul(fd->d_name,nullptr,10));r.owner_kind[at]=kind;
          char comm_path[128]{};::snprintf(comm_path,sizeof(comm_path),"/proc/%.12s/comm",entry->d_name);
          r.owner_process[at]=4;
          if(small_read(comm_path,text,32)>0) {
            if(!::strcmp(text,"init\n"))r.owner_process[at]=1;
            else if(!::strcmp(text,"sh\n"))r.owner_process[at]=2;
            else if(!::strcmp(text,"getty\n"))r.owner_process[at]=3;
          }
        }
      }
    }
    ::closedir(fds);if(!okay)break;
  }
  ::closedir(proc);
  if(!okay) {r.error=EBUSY;return r;}
  if(r.owners) {
    if(!allow_init_console || !only_init_console(r)) {r.error=EBUSY;return r;}
    r.init_console_exception=true;
  }else r.owners_free=true;
  r.stage=2;r.complete=true;return r;
}
inline bool same_settings(const termios &a,const termios &b) {
  return a.c_iflag==b.c_iflag && a.c_oflag==b.c_oflag && a.c_cflag==b.c_cflag &&
    a.c_lflag==b.c_lflag && a.c_line==b.c_line && !::memcmp(a.c_cc,b.c_cc,NCCS) &&
    ::cfgetispeed(&a)==::cfgetispeed(&b) && ::cfgetospeed(&a)==::cfgetospeed(&b);
}
inline Result run(unsigned transmit) {
  // 0=passive, 1=one H5 SYNC, 2=one H4 Read Local Version. This is not a
  // caller-supplied packet interface, and no reset/baud/download opcode exists.
  if(transmit>2) {Result refused;refused.attempted=true;refused.error=EINVAL;return refused;}
  Result r=metadata(true);r.complete=false;
  if(!r.owners_free && !r.init_console_exception)return r;
  r.stage=3;
  const int fd=::open(node_name(r.backup),O_RDWR|O_NONBLOCK|O_CLOEXEC|O_NOFOLLOW|O_NOCTTY);
  if(fd<0) {r.error=errno;return r;}
  struct Close {int fd;~Close(){::close(fd);}} close{fd};
  struct stat node{};termios before{};
  if(::fstat(fd,&node) || !S_ISCHR(node.st_mode) || node.st_ino!=r.inode || node.st_dev!=r.node_device ||
     node.st_rdev!=makedev(r.device_major,r.device_minor) || ::tcgetattr(fd,&before)) {
    r.error=errno?errno:ESTALE;return r;
  }
  r.opened=true;
  // Termios baud is a software description, not physical wiring evidence.
  // Refuse anything except the reference initial mode; NEVER request a speed.
  if(::cfgetispeed(&before)!=B115200 || ::cfgetospeed(&before)!=B115200) {
    r.error=EINVAL;return r;
  }
  int pipes[2]{};
  if(::pipe2(pipes,O_CLOEXEC|O_NONBLOCK)) {r.error=errno;return r;}
  const pid_t child=::fork();
  if(child<0) {r.error=errno;::close(pipes[0]);::close(pipes[1]);return r;}
  if(!child) {
    ::close(pipes[0]);std::array<uint32_t,8>answer{};answer[0]=0x46515031;
    termios raw=before;
    raw.c_iflag&=~(IGNBRK|BRKINT|PARMRK|ISTRIP|INLCR|IGNCR|ICRNL|IXON|IXOFF);
    raw.c_oflag&=~OPOST;raw.c_lflag&=~(ECHO|ECHONL|ICANON|ISIG|IEXTEN);
    raw.c_cc[VMIN]=0;raw.c_cc[VTIME]=0;
    // c_cflag and both speeds are copied verbatim. TCSANOW changes only the
    // software line-discipline flags. The reference FIQ driver has no
    // set_termios callback. No drain/flush or modem-control ioctl is requested.
    if(::tcsetattr(fd,TCSANOW,&raw))answer[1]=errno;
    else {
      if(transmit) {
        constexpr std::array<uint8_t,8>sync{{0xc0,0,0x2f,0,0xd0,1,0x7e,0xc0}};
        constexpr std::array<uint8_t,4>version{{1,1,0x10,0}};
        const auto n=transmit==1?::write(fd,sync.data(),sync.size()):
                                 ::write(fd,version.data(),version.size());
        if(n<0)answer[1]=errno;else answer[2]=unsigned(n);
      }
      SyncResponse parser;LocalVersionResponse h4;
      for(unsigned attempt=0;attempt<10 && answer[3]<512;++attempt) {
        pollfd poller{fd,POLLIN,0};const int ready=::poll(&poller,1,30);
        if(ready<0) {answer[1]=errno;break;}
        if(!ready)continue;
        std::array<uint8_t,64>bytes{};const size_t remaining=512-answer[3];
        const auto n=::read(fd,bytes.data(),remaining<bytes.size()?remaining:bytes.size());
        if(n<0) {if(errno!=EAGAIN)answer[1]=errno;continue;}
        for(ssize_t i=0;i<n;++i) {parser.add(bytes[size_t(i)]);h4.add(bytes[size_t(i)]);}
        answer[3]+=unsigned(n);answer[4]=parser.found;answer[6]=h4.found;
        if(parser.found || h4.found)break;
      }
    }
    termios checked{};
    answer[5]=!::tcsetattr(fd,TCSANOW,&before) && !::tcgetattr(fd,&checked) && same_settings(before,checked);
    // Only fixed counters/booleans leave the worker. Never return console
    // contents, credentials, arbitrary bytes or an uninitialized structure.
    (void)::write(pipes[1],answer.data(),sizeof(answer));::close(pipes[1]);::_exit(0);
  }
  ::close(pipes[1]);int status=0;pid_t done=0;
  for(unsigned wait=0;wait<200 && !done;++wait) {
    done=::waitpid(child,&status,WNOHANG);if(!done)::usleep(10000);
  }
  if(!done) {
    ::kill(child,SIGKILL);
    for(unsigned wait=0;wait<50 && !done;++wait) {done=::waitpid(child,&status,WNOHANG);if(!done)::usleep(10000);}
  }
  r.child_reaped=done==child;
  std::array<uint32_t,8>answer{};const auto n=::read(pipes[0],answer.data(),sizeof(answer));::close(pipes[0]);
  termios checked{};
  r.restored=!::tcsetattr(fd,TCSANOW,&before) && !::tcgetattr(fd,&checked) && same_settings(before,checked);
  if(!r.child_reaped || !WIFEXITED(status) || WEXITSTATUS(status) || n!=ssize_t(sizeof(answer)) || answer[0]!=0x46515031) {
    r.error=ETIMEDOUT;r.stage=4;return r;
  }
  r.error=answer[1];r.tx_returned=answer[2];r.rx=answer[3];r.sync_response=answer[4];
  r.h4_version_response=answer[6];
  r.complete=!r.error && r.restored && answer[5] && (!transmit || r.tx_returned==(transmit==1?8:4));
  r.stage=r.complete?20:5;return r;
}
#endif
inline Result passive_result{};inline Result sync_result{};inline Result h4_result{};
inline Result &passive() {
  if(!passive_result.attempted) {
#if defined(__linux__)
    passive_result=run(false);
#else
    passive_result.attempted=true;passive_result.error=ENOTSUP;
#endif
  }
  return passive_result;
}
inline Result &sync() {
  if(!sync_result.attempted) {
    sync_result.attempted=true;
#if defined(__linux__)
    if(!passive_result.complete || !passive_result.restored ||
       (passive_result.rx && !passive_result.sync_response)) {sync_result.error=EBUSY;return sync_result;}
    auto current=metadata(true);
    if(!current.complete || current.inode!=passive_result.inode || current.backup!=passive_result.backup ||
       current.node_device!=passive_result.node_device || current.device_major!=passive_result.device_major ||
       current.device_minor!=passive_result.device_minor) {
      sync_result.error=ESTALE;return sync_result;
    }
    sync_result=run(true);
#else
    sync_result.error=ENOTSUP;
#endif
  }
  return sync_result;
}
inline Result &h4_version() {
  if(!h4_result.attempted) {
    h4_result.attempted=true;
#if defined(__linux__)
    // Only the same admitted node after a fresh clean passive attempt. The
    // previous H5 attempt was already journaled in a separate completed cycle;
    // this process MUST NOT replay it just to unlock a different fixed read.
    // Unknown RX data is never followed with a protocol command.
    if(!passive_result.complete || !passive_result.restored || passive_result.rx) {
      h4_result.error=EBUSY;return h4_result;
    }
    auto current=metadata(true);
    if(!current.complete || current.inode!=passive_result.inode || current.backup!=passive_result.backup ||
       current.node_device!=passive_result.node_device || current.device_major!=passive_result.device_major ||
       current.device_minor!=passive_result.device_minor) {h4_result.error=ESTALE;return h4_result;}
    h4_result=run(2);
#else
    h4_result.error=ENOTSUP;
#endif
  }
  return h4_result;
}
template<class Json> inline void report(Json root,const Result &r) {
  root["attempted"]=r.attempted;root["complete"]=r.complete;root["stage"]=r.stage;root["errno"]=r.error;
  root["driver_verified"]=r.driver;root["normal_name_masked_to_null"]=r.masked;
  root["backup_node_selected"]=r.backup;root["node_verified"]=r.node;root["owners_free"]=r.owners_free;
  root["owners"]=r.owners;root["opened"]=r.opened;root["child_reaped"]=r.child_reaped;
  root["termios_restored"]=r.restored;root["write_returned_bytes"]=r.tx_returned;
  root["received_bytes"]=r.rx;root["h5_sync_response"]=r.sync_response;
  root["baud_change_requested"]=false;root["driver_detached"]=false;
  root["init_console_exception"]=r.init_console_exception;
  root["h4_local_version_response"]=r.h4_version_response;
  for(unsigned i=0;i<r.owner_pid.size();++i)if(r.owner_pid[i]) {
    // Fixed numbered fields avoid an unbounded process inventory or a new
    // arbitrary-path action. The ownership refusal remains unchanged.
    char key[48]{};
    ::snprintf(key,sizeof(key),"owner_%u_pid",i);root[key]=r.owner_pid[i];
    ::snprintf(key,sizeof(key),"owner_%u_fd",i);root[key]=r.owner_fd[i];
    ::snprintf(key,sizeof(key),"owner_%u_kind",i);root[key]=r.owner_kind[i];
    ::snprintf(key,sizeof(key),"owner_%u_process",i);root[key]=r.owner_process[i];
  }
}
} // namespace cgs1_fiq_probe
