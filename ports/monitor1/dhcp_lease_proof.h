#pragma once

// A passive, bounded REQUEST -> ACK witness. It never runs/signals udhcpc,
// changes WPA, writes addresses/routes, or publishes packet/option payloads.
// RFC 2131 sections 4.3.2/4.4 and RFC 2132 define the fields below.
//
// This layer consumes a transport-validated UDP payload, interface identity,
// capture generation and monotonic receive time. It is NOT production capture
// admission: a future AF_PACKET adapter must bind the current association,
// discard pre-arm packets, filter only this client's DHCP, check IP/UDP framing
// and invalidate evidence on loss/overflow. Calling this parser alone cannot
// establish a physical lease. DHCP also provides no server authentication.
#include "network_ipv4_inspect.h"
#include <algorithm>

namespace cgs1_dhcp_lease {
using Mac=std::array<unsigned char,6>;
inline uint32_t be32(const unsigned char*p) {
  return (uint32_t(p[0])<<24)|(uint32_t(p[1])<<16)|(uint32_t(p[2])<<8)|uint32_t(p[3]);
}
struct Message {
  unsigned type{0};bool from_client{false};uint32_t xid{0},ciaddr{0},yiaddr{0};
  uint32_t requested{0},server{0},lease_seconds{0},netmask{0};
  bool has_requested{false},has_server{false},has_lease{false},has_mask{false};
  std::vector<uint32_t>routers;
};
inline bool decode(const unsigned char*data,size_t size,unsigned source_port,
    unsigned destination_port,const Mac&mac,Message&out) {
  out={};
  if(!data || size<241 || size>1472 || data[1]!=1 || data[2]!=6 || data[3] ||
      std::memcmp(data+28,mac.data(),mac.size()) || be32(data+24) || be32(data+236)!=0x63825363)return false;
  const bool client=source_port==68 && destination_port==67;
  const bool server=source_port==67 && destination_port==68;
  if((!client && !server) || data[0]!=(client?1:2))return false;
  Message value;value.from_client=client;value.xid=be32(data+4);value.ciaddr=be32(data+12);value.yiaddr=be32(data+16);
  std::array<bool,256>seen{};bool ended=false;
  for(size_t at=240;at<size;) {
    const unsigned code=data[at++];if(!code)continue;
    if(code==255){ended=true;break;}
    if(at==size)return false;
    const unsigned count=data[at++];if(!count || count>size-at)return false;
    // Overloaded/concatenated critical options are unsupported rather than
    // partially interpreted. No hostname, DNS/search/client-id value is kept.
    if(code==52)return false;
    const bool critical=code==1 || code==3 || code==50 || code==51 || code==53 || code==54;
    if(critical && seen[code])return false;
    seen[code]=true;const auto*p=data+at;
    if(code==53){if(count!=1 || p[0]<1 || p[0]>8)return false;value.type=p[0];}
    else if(code==3) {
      if(count%4 || count>32)return false;
      for(unsigned n=0;n<count;n+=4){const auto ip=be32(p+n);if(!cgs1_ipv4::unicast(ip))return false;value.routers.push_back(ip);}
    }else if(code==1 || code==50 || code==51 || code==54) {
      if(count!=4)return false;
      const auto word=be32(p);
      if(code==1){value.netmask=word;value.has_mask=true;}
      else if(code==50){value.requested=word;value.has_requested=true;}
      else if(code==51){value.lease_seconds=word;value.has_lease=true;}
      else {value.server=word;value.has_server=true;}
    }
    at+=count;
  }
  if(!ended || !value.type || (client?(value.type==2 || value.type==5 || value.type==6):
      (value.type!=2 && value.type!=5 && value.type!=6)))return false;
  out=std::move(value);return true;
}

class Witness {
 public:
  bool arm(uint64_t generation,int interface_index,uint64_t now_ms,uint64_t deadline_ms) {
    if(armed_ || !generation || interface_index<=0 || !now_ms || deadline_ms<=now_ms || deadline_ms-now_ms>120000)return false;
    generation_=generation;interface_=interface_index;armed_ms_=now_ms;deadline_=deadline_ms;armed_=true;return true;
  }
  void invalidate(){invalid_=true;ready_=false;waiting_=false;}
  bool observe(const Message&m,uint64_t generation,int interface_index,uint64_t received_ms,
      uint64_t request_earliest_ms=0) {
    if(!current_(generation,interface_index,received_ms) || received_ms<last_observed_ms_)return false;
    // A socket adapter cannot date an already queued outgoing REQUEST by its
    // later userspace read. It supplies the socket's pre-bind monotonic time
    // as a conservative lower bound instead. This shortens, never extends,
    // the granted lease. The default is for an exactly dated synthetic input.
    if(request_earliest_ms && (request_earliest_ms<armed_ms_ || request_earliest_ms>received_ms))return false;
    last_observed_ms_=received_ms;
    if(m.from_client) {
      // A new discovery, decline, release or INFORM invalidates an earlier
      // lease result. In particular an INFORM ACK never becomes lease proof.
      if(m.type!=3){ready_=false;waiting_=false;return true;}
      const auto requested=m.ciaddr?m.ciaddr:m.has_requested?m.requested:0;
      if(!cgs1_ipv4::unicast(requested) || (m.ciaddr && (m.has_requested || m.has_server)) ||
          (m.has_server && !cgs1_ipv4::unicast(m.server)) || m.yiaddr) {
        ready_=false;waiting_=false;return false;
      }
      // Retransmitting a pending request cannot move its original send time
      // forward and extend lease validity. A request after ACK starts anew.
      const bool repeat=waiting_ && !ready_ && xid_==m.xid && requested_==requested && server_==m.server;
      if(!repeat)request_ms_=request_earliest_ms?request_earliest_ms:received_ms;
      xid_=m.xid;requested_=requested;server_=m.has_server?m.server:0;
      waiting_=true;ready_=false;return true;
    }
    if(!waiting_ || m.xid!=xid_ || received_ms<request_ms_)return false;
    if(m.type==6){waiting_=false;ready_=false;return true;}
    if(m.type!=5 || m.yiaddr!=requested_ || !m.has_server || !cgs1_ipv4::unicast(m.server) ||
        (server_ && server_!=m.server) || !m.has_lease || !m.lease_seconds || !m.has_mask || m.routers.empty())return false;
    for(const auto router:m.routers) {
      cgs1_ipv4::Route route;route.gateway=router;
      if(!cgs1_ipv4::connected(m.yiaddr,m.netmask,route))return false;
    }
    if(ready_) {
      // An identical duplicated ACK is idempotent, never a fresh time anchor.
      // Conflicting ACK data under one xid is not silently accepted.
      if(m.server!=ack_.server || m.lease_seconds!=ack_.lease_seconds || m.netmask!=ack_.netmask || m.routers!=ack_.routers) {
        invalidate();return false;
      }
      return true;
    }
    ack_=m;ack_ms_=received_ms;ready_=true;return true;
  }
  bool matches(const cgs1_ipv4::View&kernel,uint64_t generation,uint64_t now_ms)const {
    if(!ready_ || !current_(generation,kernel.index,now_ms) || !kernel.verified || !kernel.up || !kernel.running ||
        !kernel.route_bound || kernel.address!=ack_.yiaddr || kernel.netmask!=ack_.netmask || now_ms<request_ms_ ||
        now_ms<ack_ms_ || now_ms<last_observed_ms_)return false;
    const uint64_t lifetime_ms=uint64_t(ack_.lease_seconds)*1000;
    return now_ms-request_ms_<lifetime_ms &&
      std::find(ack_.routers.begin(),ack_.routers.end(),kernel.route.gateway)!=ack_.routers.end();
  }
 private:
  bool armed_{false},invalid_{false},waiting_{false},ready_{false};int interface_{0};
  uint64_t generation_{0},armed_ms_{0},deadline_{0},request_ms_{0},ack_ms_{0},last_observed_ms_{0};
  uint32_t xid_{0},requested_{0},server_{0};Message ack_;
  bool current_(uint64_t generation,int index,uint64_t now)const {
    return armed_ && !invalid_ && generation==generation_ && index==interface_ && now>=armed_ms_ && now<deadline_;
  }
};
} // namespace cgs1_dhcp_lease
