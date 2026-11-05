#pragma once

// A read-only kernel view of wlan0. WPA STATUS may retain an old ip_address;
// these observations instead bind the actual interface address/netmask/index
// to one unique kernel default route. This is deliberately NOT a DHCP lease
// receipt or a gateway reachability test: no packet is sent and no ioctl writes.
#include "network_preflight.h"
#if defined(__linux__)
#include <arpa/inet.h>
#include <net/if.h>
#include <sys/ioctl.h>
#endif

namespace cgs1_ipv4 {
struct Route {uint32_t gateway{0};unsigned metric{0};};
struct View {
  bool verified{false},up{false},running{false},route_bound{false};
  int index{0};uint32_t address{0},netmask{0};Route route;std::string error;
};
inline bool hex_word(const std::string&s,uint32_t&out) {
  if(s.size()!=8)return false;
  out=0;for(unsigned char c:s) {
    const unsigned digit=c>='0' && c<='9'?c-'0':c>='a' && c<='f'?c-'a'+10:c>='A' && c<='F'?c-'A'+10:16;
    if(digit>15)return false;
    out=(out<<4)|digit;
  }
  return true;
}
inline uint32_t proc_address(uint32_t n) {
  // The deployed CGS1 kernel is little-endian ARM. Keep the parsed public
  // value in network significance order on EVERY test/compiler architecture.
  return ((n&255)<<24)|((n&0xff00)<<8)|((n>>8)&0xff00)|(n>>24);
}
inline bool decimal(const std::string&s,unsigned&out) {
  if(s.empty() || s.size()>10)return false;
  uint64_t value=0;for(char c:s){if(c<'0' || c>'9')return false;value=value*10+unsigned(c-'0');}
  if(value>UINT_MAX)return false;
  out=unsigned(value);return true;
}
inline bool default_route(const std::string&text,Route&out) {
  if(text.empty() || text.size()>16384 || text.back()!='\n')return false;
  std::istringstream input(text);std::string line;unsigned count=0;bool found=false;
  if(!std::getline(input,line))return false;
  std::istringstream header(line);std::vector<std::string>names;std::string name;
  while(header>>name)names.push_back(name);
  if(names!=std::vector<std::string>{"Iface","Destination","Gateway","Flags","RefCnt","Use","Metric","Mask","MTU","Window","IRTT"})return false;
  while(std::getline(input,line)) {
    if(++count>128 || line.empty())return false;
    std::istringstream row(line);std::array<std::string,11>fields;std::string extra;
    for(auto&field:fields)if(!(row>>field))return false;
    if(row>>extra)return false;
    if(fields[0]!="wlan0")continue; // Never export unrelated interface routes.
    uint32_t destination=0,gateway=0,mask=0,flags=0;unsigned metric=0;
    if(!hex_word(fields[1],destination) || !hex_word(fields[2],gateway) || !hex_word(fields[7],mask) ||
        fields[3].empty() || fields[3].size()>8 || !hex_word(std::string(8-fields[3].size(),'0')+fields[3],flags) ||
        !decimal(fields[6],metric))return false;
    if(destination || mask)continue;
    // A second default is ambiguous, even when its metric is worse: do not
    // silently claim policy-routing/multipath semantics from this proc view.
    if(found || (flags&3)!=3 || (flags&0x200) || !gateway)return false;
    out.gateway=proc_address(gateway);out.metric=metric;found=true;
  }
  return found;
}
inline bool unicast(uint32_t ip) {
  const auto first=ip>>24;return first>0 && first<224 && first!=127 && ip!=UINT32_MAX;
}
inline bool connected(uint32_t ip,uint32_t mask,const Route&route) {
  const uint32_t inverse=~mask;
  return mask && (inverse&(inverse+1))==0 && unicast(ip) && unicast(route.gateway) &&
    ip!=route.gateway && (ip&mask)==(route.gateway&mask) &&
    (ip&inverse)!=0 && (ip&inverse)!=inverse &&
    (route.gateway&inverse)!=0 && (route.gateway&inverse)!=inverse;
}
inline std::string address_text(uint32_t ip) {
  return std::to_string(ip>>24)+"."+std::to_string((ip>>16)&255)+"."+
    std::to_string((ip>>8)&255)+"."+std::to_string(ip&255);
}
inline View inspect() {
  View out;
#if defined(__linux__)
  const int fd=::socket(AF_INET,SOCK_DGRAM|SOCK_CLOEXEC,0);
  if(fd<0){out.error="ipv4_read_socket_unavailable";return out;}
  const auto read=[&](View&v) {
    struct ifreq request{};std::strcpy(request.ifr_name,"wlan0");
    if(::ioctl(fd,SIOCGIFINDEX,&request) || request.ifr_ifindex<=0)return false;
    v.index=request.ifr_ifindex;
    if(::ioctl(fd,SIOCGIFFLAGS,&request))return false;
    v.up=(request.ifr_flags&IFF_UP)!=0;v.running=(request.ifr_flags&IFF_RUNNING)!=0;
    if(::ioctl(fd,SIOCGIFADDR,&request) || request.ifr_addr.sa_family!=AF_INET)return false;
    v.address=ntohl(reinterpret_cast<const struct sockaddr_in*>(&request.ifr_addr)->sin_addr.s_addr);
    if(::ioctl(fd,SIOCGIFNETMASK,&request) || request.ifr_netmask.sa_family!=AF_INET)return false;
    v.netmask=ntohl(reinterpret_cast<const struct sockaddr_in*>(&request.ifr_netmask)->sin_addr.s_addr);return true;
  };
  const auto before=cgs1_net_trial::read_small("/proc/net/route",16384);View second;
  const bool read_ok=read(out) && read(second);
  const auto after=cgs1_net_trial::read_small("/proc/net/route",16384);::close(fd);
  if(!read_ok){out.error="wlan0_ipv4_read_unavailable";return out;}
  if(before!=after || out.index!=second.index || out.address!=second.address || out.netmask!=second.netmask ||
      out.up!=second.up || out.running!=second.running){out.error="ipv4_snapshot_changed";return out;}
  out.verified=true;
  out.route_bound=out.up && out.running && default_route(after,out.route) && connected(out.address,out.netmask,out.route);
  if(!out.route_bound)out.error="unique_connected_wlan0_default_unproven";
#else
  out.error="verified_linux_required";
#endif
  return out;
}
} // namespace cgs1_ipv4
