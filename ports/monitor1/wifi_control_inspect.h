#pragma once

// Read-only wpa_supplicant discovery for the fingerprinted CGS1. Protocol:
// https://w1.fi/wpa_supplicant/devel/ctrl_iface_page.html
// Only PING, STATUS, LIST_NETWORKS, exact GET version and argument-free
// LOG_LEVEL exist here. No configuration-file contents, passwords,
// GET_NETWORK, scan, reconnect, shell or network mutation are exposed.
#include <array>
#include <string>
#include <cstdint>
#include <cerrno>
#include <cstring>
#include <cstdlib>
#include <sys/stat.h>
#include <unistd.h>
#include <arpa/inet.h>
#if defined(__linux__)
#include <sys/socket.h>
#include <sys/un.h>
#include <poll.h>
#include <fcntl.h>
#endif

namespace cgs1_wifi {
struct Status {
  std::string state,ip_address,bssid,key_management;
  int network_id{-1},frequency{-1};
  int ssid_text_bytes{-1}; // Escaped STATUS text length, not decoded SSID octets.
};
inline bool decimal(const std::string &text,int maximum,int &result) {
  if(text.empty() || text.size()>7) return false;
  int value=0;
  for(char c:text) {if(c<'0' || c>'9')return false;value=value*10+c-'0';if(value>maximum)return false;}
  result=value;return true;
}
inline bool mac_address(const std::string &text) {
  if(text.size()!=17) return false;
  for(size_t i=0;i<text.size();++i) {
    if(i%3==2) {if(text[i]!=':')return false;}
    else if(!((text[i]>='0' && text[i]<='9') || (text[i]>='a' && text[i]<='f') || (text[i]>='A' && text[i]<='F'))) return false;
  }
  return true;
}
inline bool token(const std::string &text,size_t maximum) {
  if(text.empty() || text.size()>maximum)return false;
  for(unsigned char c:text)if(c<33 || c>126)return false;
  return true;
}
inline bool parse_status(const std::string &text,Status &result) {
  if(text.empty() || text.size()>4096 || text.find('\0')!=std::string::npos)return false;
  Status parsed;unsigned seen=0;size_t offset=0;
  while(offset<text.size()) {
    const auto end=text.find('\n',offset);const size_t stop=end==std::string::npos?text.size():end;
    const std::string line=text.substr(offset,stop-offset);offset=stop+1;
    if(line.empty())continue;
    const auto separator=line.find('=');if(separator==std::string::npos)continue;
    const auto name=line.substr(0,separator),value=line.substr(separator+1);
    unsigned bit=0;
    if(name=="wpa_state") {bit=1;if(!token(value,32))return false;parsed.state=value;}
    else if(name=="ip_address") {
      bit=2;unsigned char address[16];
      if(value.size()>45 || (!value.empty() && ::inet_pton(AF_INET,value.c_str(),address)!=1 &&
          ::inet_pton(AF_INET6,value.c_str(),address)!=1))return false;
      parsed.ip_address=value;
    } else if(name=="bssid") {bit=4;if(!mac_address(value))return false;parsed.bssid=value;}
    else if(name=="key_mgmt") {bit=8;if(!token(value,64))return false;parsed.key_management=value;}
    else if(name=="id") {bit=16;if(!decimal(value,1000000,parsed.network_id))return false;}
    else if(name=="freq") {bit=32;if(!decimal(value,7000,parsed.frequency))return false;}
    else if(name=="ssid") {bit=64;if(value.size()>128)return false;parsed.ssid_text_bytes=int(value.size());}
    // Unknown EAP/identity/credential fields never enter the result/report.
    if(bit && (seen&bit))return false;
    seen|=bit;
  }
  if(!(seen&1))return false;
  result=parsed;return true;
}
template<class Transport> bool read_status(Transport &transport,Status &result) {
  std::string reply;
  if(!transport.request("PING",reply) || (reply!="PONG" && reply!="PONG\n"))return false;
  if(!transport.request("STATUS",reply))return false;
  return parse_status(reply,result);
}

inline constexpr std::array<const char *,4> CONTROL_PATHS={
  "/var/run/wpa_supplicant/wlan0","/run/wpa_supplicant/wlan0",
  "/tmp/wpa_supplicant/wlan0","/data/etc/wifi/wpa_supplicant/wlan0"};
struct Node {int error{0},owner{-1},mode{-1};bool socket{false};};
struct Inspection {
  std::array<Node,CONTROL_PATHS.size()> nodes;
  Status status;int selected{-1};bool available{false},cleanup_verified{true};
  int config_error{0},config_owner{-1},config_mode{-1};bool config_regular{false};
  std::string error;
};

#if defined(__linux__)
class ReadOnlyControl {
 public:
  ~ReadOnlyControl(){close();}
  bool open(size_t index) {
    if(index>=CONTROL_PATHS.size() || fd_>=0 || ::geteuid()!=0)return false;
    server_=CONTROL_PATHS[index];struct stat before{};
    if(::lstat(server_.c_str(),&before) || !S_ISSOCK(before.st_mode) || before.st_uid!=0)return false;
    char pattern[]="/tmp/cgs1-wifi-inspect-XXXXXX";
    const char *created=::mkdtemp(pattern);if(!created)return false;
    directory_=created;local_=directory_+"/control";
    fd_=::socket(AF_UNIX,SOCK_DGRAM|SOCK_NONBLOCK|SOCK_CLOEXEC,0);
    if(fd_<0)return false;
    sockaddr_un local{},remote{};local.sun_family=remote.sun_family=AF_UNIX;
    if(local_.size()>=sizeof(local.sun_path) || server_.size()>=sizeof(remote.sun_path))return false;
    std::memcpy(local.sun_path,local_.c_str(),local_.size()+1);
    std::memcpy(remote.sun_path,server_.c_str(),server_.size()+1);
    if(::bind(fd_,reinterpret_cast<sockaddr *>(&local),sizeof(local)))return false;
    bound_=true;
    if(::connect(fd_,reinterpret_cast<sockaddr *>(&remote),sizeof(remote)))return false;
    struct stat after{};
    return !::lstat(server_.c_str(),&after) && after.st_ino==before.st_ino && after.st_dev==before.st_dev;
  }
  bool request(const char *command,std::string &reply) {
    // Even an internal caller cannot turn this inspector into a credential
    // getter or a write transport by passing another command.
    if(fd_<0 || (std::strcmp(command,"PING") && std::strcmp(command,"STATUS") &&
        std::strcmp(command,"LIST_NETWORKS") && std::strcmp(command,"GET version") &&
        std::strcmp(command,"LOG_LEVEL")))return false;
    return exchange_(command,reply,500);
  }
 private:
  // Only the separate, locally compiled RAM probe can issue its typed fixed
  // commands. Maintenance/API callers still have the read-only whitelist.
  // The RAM writer header is not included by the maintenance firmware.
  friend class RamTrialControl;
  // Native-only disabled candidate preparation has its own typed API and
  // independent guardian admission. This does not widen request()'s read-only
  // whitelist or add a writer to maintenance/remote actions.
  friend class NativeCandidateControl;
  // Guardian recovery has its own fixed SELECT/ENABLE-no-connect/REMOVE
  // vocabulary. It never widens request(), the read-only API whitelist.
  friend class GuardianRecoveryControl;
  // Native forward selection has a separate argument-free transaction API.
  // This friend does not widen request() or expose a remote writer.
  friend class ForwardCandidateControl;
  // The experimental native screen has a fixed SCAN/SCAN_RESULTS transport.
  // It cannot choose profiles or credentials, and does not widen request()'s
  // maintenance whitelist. Merely including this inspector never scans RF.
  friend class NativeScanControl;
  bool exchange_(const char *command,std::string &reply,int timeout) {
    const size_t length=std::strlen(command);
    if(fd_<0 || !length || length>512 || std::strchr(command,'\n') || std::strchr(command,'\r'))return false;
    if(::send(fd_,command,length,MSG_NOSIGNAL)!=ssize_t(length))return false;
    pollfd ready{fd_,POLLIN,0};
    if(::poll(&ready,1,timeout)!=1 || !(ready.revents&POLLIN))return false;
    char bytes[4097];const ssize_t count=::recv(fd_,bytes,sizeof(bytes),0);
    if(count<=0 || count>4096)return false;
    reply.assign(bytes,size_t(count));return true;
  }
 public:
  bool close() {
    bool okay=true;
    if(fd_>=0){::close(fd_);fd_=-1;}
    if(bound_ && !local_.empty() && ::unlink(local_.c_str()) && errno!=ENOENT)okay=false;
    if(!directory_.empty() && ::rmdir(directory_.c_str()))okay=false;
    bound_=false;local_.clear();directory_.clear();return okay;
  }
 private:
  int fd_{-1};bool bound_{false};std::string server_,directory_,local_;
};
#endif
inline Inspection inspect() {
  Inspection result;
#if defined(__linux__)
  if(::geteuid()!=0){result.error="root_metadata_required";return result;}
  for(size_t i=0;i<CONTROL_PATHS.size();++i) {
    struct stat info{};auto &node=result.nodes[i];
    if(::lstat(CONTROL_PATHS[i],&info)){node.error=errno;continue;}
    node.owner=int(info.st_uid);node.mode=int(info.st_mode&07777);node.socket=S_ISSOCK(info.st_mode);
    if(result.selected<0 && node.socket && node.owner==0)result.selected=int(i);
  }
  struct stat config{};
  if(::lstat("/data/etc/wifi/wpa_supplicant.conf",&config))result.config_error=errno;
  else {result.config_owner=int(config.st_uid);result.config_mode=int(config.st_mode&07777);result.config_regular=S_ISREG(config.st_mode);}
  if(result.selected<0){result.error="no_verified_control_socket";return result;}
  ReadOnlyControl control;
  result.available=control.open(size_t(result.selected)) && read_status(control,result.status);
  if(!result.available)result.error="read_only_control_query_failed";
  result.cleanup_verified=control.close();
#else
  result.error="verified_linux_required";
#endif
  return result;
}
} // namespace cgs1_wifi
