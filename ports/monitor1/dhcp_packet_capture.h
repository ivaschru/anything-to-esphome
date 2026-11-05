#pragma once

// Fixed wlan0 passive capture, with the client's MAC filtered IN THE KERNEL
// before binding any protocol. No promiscuous membership, packet transmission,
// DHCP signal, WPA operation, raw payload getter or configurable interface.
// The forward transaction adapter must independently fence WPA association,
// DHCP owner and generation before/after open/poll; this class alone is not
// permission to commit a Wi-Fi profile or claim a physical fresh lease.
#include "dhcp_ipv4_packet.h"
#include <cstddef>
#if defined(__linux__)
#include <linux/filter.h>
#include <linux/if_packet.h>
#include <net/ethernet.h>
#include <time.h>
#endif

namespace cgs1_dhcp_lease {
inline uint64_t capture_now_ms() {
  struct timespec ts{};return ::clock_gettime(CLOCK_MONOTONIC,&ts)?0:uint64_t(ts.tv_sec)*1000+uint64_t(ts.tv_nsec)/1000000;
}
struct CaptureKernel {
  static bool identity(int&index,Mac&mac) {
#if defined(__linux__)
    const int fd=::socket(AF_INET,SOCK_DGRAM|SOCK_CLOEXEC,0);if(fd<0)return false;
    struct ifreq request{};std::strcpy(request.ifr_name,"wlan0");
    bool okay=!::ioctl(fd,SIOCGIFINDEX,&request) && request.ifr_ifindex>0;index=request.ifr_ifindex;
    okay=okay && !::ioctl(fd,SIOCGIFHWADDR,&request) && request.ifr_hwaddr.sa_family==1;
    if(okay)std::memcpy(mac.data(),request.ifr_hwaddr.sa_data,mac.size());
    ::close(fd);bool nonzero=false;for(auto c:mac)nonzero|=c!=0;
    return okay && nonzero && !(mac[0]&1);
#else
    (void)index;(void)mac;return false;
#endif
  }
};
#if defined(__linux__)
inline bool packet_address_valid(const struct sockaddr_ll&source,socklen_t returned,int index) {
  // Linux 3.10 packet_recvmsg returns offsetof(sll_addr)+sll_halen, not
  // sizeof(sockaddr_ll). For Ethernet this is 18 bytes; current kernels may
  // return the padded 20-byte structure. Require the complete fixed prefix
  // BEFORE inspecting its length field, then all six address bytes. Never
  // accept truncated/oversized names or infer missing fields from zero fill.
  constexpr size_t prefix=offsetof(struct sockaddr_ll,sll_addr);
  if(returned<prefix || returned>sizeof(source))return false;
  return source.sll_halen==6 && returned>=prefix+source.sll_halen &&
    source.sll_family==AF_PACKET && source.sll_ifindex==index && index>0 &&
    source.sll_protocol==htons(ETH_P_IP);
}
inline std::vector<struct sock_filter> client_filter(const Mac&mac) {
  // Named local labels avoid handwritten jump-distance mistakes. The filter
  // admits only IPv4 UDP 67<->68 with this BOOTP chaddr, never other DHCP
  // clients' options, DNS, HTTPS or arbitrary LAN traffic into userspace.
  enum Label {CLIENT,SERVER,MAC,REJECT,COUNT};
  struct Fix {size_t at;bool yes;Label label;};std::vector<sock_filter>out;std::vector<Fix>fix;
  std::array<size_t,COUNT>labels{};
  const auto stmt=[&](unsigned short op,uint32_t k){out.push_back({op,0,0,k});};
  const auto branch=[&](unsigned short op,uint32_t k,Label target,bool yes) {
    out.push_back({op,0,0,k});fix.push_back({out.size()-1,yes,target});
  };
  // ETH_P_ALL is necessary for the kernel's outgoing packet tap. The very
  // first BPF predicate rejects every non-IPv4 skb by its KERNEL protocol,
  // before inspecting any payload. Binding ETH_P_IP alone missed REQUEST TX
  // in the isolated kernel fixture and cannot support REQUEST -> ACK proof.
  stmt(BPF_LD|BPF_H|BPF_ABS,uint32_t(SKF_AD_OFF)+SKF_AD_PROTOCOL);
  branch(BPF_JMP|BPF_JEQ|BPF_K,ETH_P_IP,REJECT,false);
  stmt(BPF_LD|BPF_B|BPF_ABS,9);branch(BPF_JMP|BPF_JEQ|BPF_K,17,REJECT,false);
  stmt(BPF_LD|BPF_H|BPF_ABS,6);branch(BPF_JMP|BPF_JSET|BPF_K,0xbfff,REJECT,true);
  stmt(BPF_LDX|BPF_B|BPF_MSH,0);stmt(BPF_LD|BPF_H|BPF_IND,0);
  branch(BPF_JMP|BPF_JEQ|BPF_K,68,CLIENT,true);
  branch(BPF_JMP|BPF_JEQ|BPF_K,67,SERVER,true);
  stmt(BPF_RET|BPF_K,0);
  labels[CLIENT]=out.size();stmt(BPF_LD|BPF_H|BPF_IND,2);
  branch(BPF_JMP|BPF_JEQ|BPF_K,67,MAC,true);stmt(BPF_RET|BPF_K,0);
  labels[SERVER]=out.size();stmt(BPF_LD|BPF_H|BPF_IND,2);
  branch(BPF_JMP|BPF_JEQ|BPF_K,68,REJECT,false);
  labels[MAC]=out.size();stmt(BPF_LD|BPF_W|BPF_IND,36);
  branch(BPF_JMP|BPF_JEQ|BPF_K,be32(mac.data()),REJECT,false);
  stmt(BPF_LD|BPF_H|BPF_IND,40);
  branch(BPF_JMP|BPF_JEQ|BPF_K,be16(mac.data()+4),REJECT,false);
  stmt(BPF_RET|BPF_K,1500);labels[REJECT]=out.size();stmt(BPF_RET|BPF_K,0);
  for(const auto&f:fix) {
    const auto distance=labels[f.label]-f.at-1;
    if(distance>255)return {};
    if(f.yes)out[f.at].jt=static_cast<unsigned char>(distance);else out[f.at].jf=static_cast<unsigned char>(distance);
  }
  return out;
}
#endif
struct Captured {
  Message message;Wire wire;int interface_index{0};uint64_t generation{0},observed_ms{0},request_earliest_ms{0};
  bool outgoing{false},udp_checksum_deferred{false};
};
struct CaptureCounters {unsigned received{0},wrong_direction{0},decode_refused{0},last_packet_type{0},deferred_tx{0};};
enum class CaptureResult {EMPTY,MESSAGE,FILTERED,FAILED};
template<class Kernel=CaptureKernel> class PacketCapture {
 public:
  PacketCapture()=default;PacketCapture(const PacketCapture&)=delete;PacketCapture&operator=(const PacketCapture&)=delete;
  ~PacketCapture(){close();}
  bool open(uint64_t generation,uint64_t deadline_ms) {
#if defined(__linux__)
    const auto now=capture_now_ms();
    if(attempted_ || ::geteuid()!=0 || !now || !generation || deadline_ms<=now || deadline_ms-now>120000)return fail_("capture_window_invalid");
    attempted_=true;generation_=generation;deadline_=deadline_ms;
    if(!Kernel::identity(index_,mac_))return fail_("fixed_interface_unavailable");
    // Protocol zero keeps the socket deaf until the filter is installed.
    fd_=::socket(AF_PACKET,SOCK_DGRAM|SOCK_NONBLOCK|SOCK_CLOEXEC,0);
    if(fd_<0)return fail_("packet_socket_unavailable");
    const int one=1,buffer=65536;auto code=client_filter(mac_);
    struct sock_fprog filter{static_cast<unsigned short>(code.size()),code.data()};
    if(code.empty() || ::setsockopt(fd_,SOL_SOCKET,SO_ATTACH_FILTER,&filter,sizeof(filter)) ||
        ::setsockopt(fd_,SOL_SOCKET,SO_LOCK_FILTER,&one,sizeof(one)) ||
        ::setsockopt(fd_,SOL_PACKET,PACKET_AUXDATA,&one,sizeof(one)) ||
        ::setsockopt(fd_,SOL_SOCKET,SO_RXQ_OVFL,&one,sizeof(one)) ||
        ::setsockopt(fd_,SOL_SOCKET,SO_RCVBUF,&buffer,sizeof(buffer)))return fail_("capture_options_unavailable");
    struct sockaddr_ll address{};address.sll_family=AF_PACKET;address.sll_protocol=htons(ETH_P_ALL);address.sll_ifindex=index_;
    earliest_ms_=capture_now_ms(); // Before the first possible enqueue, not after recvmsg.
    if(!earliest_ms_ || ::bind(fd_,reinterpret_cast<struct sockaddr*>(&address),sizeof(address)))return fail_("fixed_packet_bind_failed");
    return identity_() && no_loss_()?true:fail_("capture_admission_changed");
#else
    (void)generation;(void)deadline_ms;return fail_("linux_capture_required");
#endif
  }
  CaptureResult next(Captured&out) {
    out={};
#if defined(__linux__)
    const auto now=capture_now_ms();
    if(fd_<0 || failed_ || now<earliest_ms_ || now>=deadline_ || !identity_() || !no_loss_()) {
      fail_("capture_window_identity_or_loss");return CaptureResult::FAILED;
    }
    unsigned char bytes[1500]{};alignas(struct cmsghdr) unsigned char control[256]{};struct sockaddr_ll source{};
    struct iovec vector{bytes,sizeof(bytes)};struct msghdr msg{};msg.msg_name=&source;msg.msg_namelen=sizeof(source);
    msg.msg_iov=&vector;msg.msg_iovlen=1;msg.msg_control=control;msg.msg_controllen=sizeof(control);
    const auto size=::recvmsg(fd_,&msg,MSG_DONTWAIT|MSG_TRUNC);
    if(size<0 && (errno==EAGAIN || errno==EWOULDBLOCK))return CaptureResult::EMPTY;
    if(size<0 || size>ssize_t(sizeof(bytes)) || (msg.msg_flags&(MSG_TRUNC|MSG_CTRUNC))) {
      fail_("packet_payload_or_control_truncated");return CaptureResult::FAILED;
    }
    if(!packet_address_valid(source,msg.msg_namelen,index_)) {
      fail_("packet_address_metadata_invalid");return CaptureResult::FAILED;
    }
    ++counters_.received;counters_.last_packet_type=source.sll_pkttype;
    bool auxiliary=false,deferred=false;
    for(auto*c=CMSG_FIRSTHDR(&msg);c;c=CMSG_NXTHDR(&msg,c)) {
      if(c->cmsg_level==SOL_PACKET && c->cmsg_type==PACKET_AUXDATA) {
        struct tpacket_auxdata aux{};
        if(auxiliary || c->cmsg_len!=CMSG_LEN(sizeof(aux))){fail_("auxdata_shape_invalid");return CaptureResult::FAILED;}
        std::memcpy(&aux,CMSG_DATA(c),sizeof(aux));auxiliary=true;deferred=(aux.tp_status&TP_STATUS_CSUMNOTREADY)!=0;
        if(aux.tp_len!=unsigned(size) || aux.tp_snaplen!=unsigned(size)) {fail_("packet_snapshot_truncated");return CaptureResult::FAILED;}
      }else if(c->cmsg_level==SOL_SOCKET && c->cmsg_type==SO_RXQ_OVFL) {
        uint32_t drops=1;if(c->cmsg_len==CMSG_LEN(sizeof(drops)))std::memcpy(&drops,CMSG_DATA(c),sizeof(drops));
        if(drops){fail_("packet_queue_loss");return CaptureResult::FAILED;}
      }
    }
    if(!auxiliary || !identity_() || !no_loss_()){fail_("capture_aux_identity_or_loss");return CaptureResult::FAILED;}
    const bool outgoing=source.sll_pkttype==PACKET_OUTGOING;
    if((!outgoing && source.sll_pkttype!=PACKET_HOST && source.sll_pkttype!=PACKET_BROADCAST) ||
        (deferred && !outgoing)){++counters_.wrong_direction;return CaptureResult::FILTERED;}
    Message message;Wire wire;
    if(!decode_ipv4(bytes,size_t(size),mac_,message,wire,deferred) || message.from_client!=outgoing) {
      ++counters_.decode_refused;return CaptureResult::FILTERED;
    }
    out.message=std::move(message);out.wire=wire;out.interface_index=index_;out.generation=generation_;
    out.observed_ms=capture_now_ms();out.request_earliest_ms=earliest_ms_;out.outgoing=outgoing;out.udp_checksum_deferred=deferred;
    if(outgoing && deferred)++counters_.deferred_tx;
    if(out.observed_ms<now || out.observed_ms>=deadline_){fail_("capture_clock_invalid");out={};return CaptureResult::FAILED;}
    return CaptureResult::MESSAGE;
#else
    return CaptureResult::FAILED;
#endif
  }
  void close(){if(fd_>=0){::close(fd_);fd_=-1;}}
  const std::string&error()const{return error_;}
  const CaptureCounters&counters()const{return counters_;}
 private:
  int fd_{-1},index_{0};Mac mac_{};bool attempted_{false},failed_{false};
  uint64_t generation_{0},deadline_{0},earliest_ms_{0};std::string error_;
  CaptureCounters counters_;
  bool fail_(const char*error){failed_=true;error_=error;close();return false;}
  bool identity_()const{int index=0;Mac mac{};return Kernel::identity(index,mac) && index==index_ && mac==mac_;}
  bool no_loss_()const {
#if defined(__linux__)
    struct tpacket_stats stats{};socklen_t size=sizeof(stats);
    return !::getsockopt(fd_,SOL_PACKET,PACKET_STATISTICS,&stats,&size) && size==sizeof(stats) && !stats.tp_drops;
#else
    return false;
#endif
  }
};
} // namespace cgs1_dhcp_lease
