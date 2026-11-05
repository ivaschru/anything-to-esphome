#pragma once

// One ICMP Echo to the currently verified, directly connected wlan0 gateway.
// No remote address/interface/payload/retry input, shell, DNS or configuration
// writes. RAW avoids changing ping_group_range (even root can be denied a
// Linux 3.10 ping socket). A fresh random nonce prevents old replies satisfying
// this observation; ICMP still does not authenticate the gateway's identity.
#include "dhcp_ipv4_packet.h"
#include <openssl/rand.h>
#if defined(__linux__)
#include <linux/filter.h>
#include <time.h>
#endif

namespace cgs1_gateway {
using Nonce=std::array<unsigned char,16>;
inline uint64_t now_ms(){struct timespec t{};return ::clock_gettime(CLOCK_MONOTONIC,&t)?0:uint64_t(t.tv_sec)*1000+uint64_t(t.tv_nsec)/1000000;}
inline bool same_view(const cgs1_ipv4::View&a,const cgs1_ipv4::View&b) {
  return a.verified && b.verified && a.route_bound && b.route_bound && a.up && b.up && a.running && b.running &&
    a.index==b.index && a.address==b.address && a.netmask==b.netmask && a.route.gateway==b.route.gateway && a.route.metric==b.route.metric;
}
inline void word(unsigned char*p,unsigned n){p[0]=n>>8;p[1]=n;}
inline std::array<unsigned char,24> request(const Nonce&nonce) {
  std::array<unsigned char,24>out{};out[0]=8;out[4]=nonce[0];out[5]=nonce[1];out[7]=1;
  std::copy(nonce.begin(),nonce.end(),out.begin()+8);
  word(out.data()+2,unsigned(~cgs1_dhcp_lease::checksum_sum(out.data(),out.size()))&0xffff);return out;
}
inline bool reply(const unsigned char*data,size_t size,const cgs1_ipv4::View&view,const Nonce&nonce,int ttl) {
  if(!data || size<44 || size>84 || data[0]>>4!=4)return false;
  const size_t ihl=(data[0]&15)*4;
  if(ihl<20 || ihl>60 || size!=ihl+24 || cgs1_dhcp_lease::be16(data+2)!=size ||
      (cgs1_dhcp_lease::be16(data+6)&0xbfff) || data[9]!=1 || !data[8] || ttl!=data[8] ||
      cgs1_dhcp_lease::be32(data+12)!=view.route.gateway || cgs1_dhcp_lease::be32(data+16)!=view.address ||
      cgs1_dhcp_lease::checksum_sum(data,ihl)!=0xffff)return false;
  const auto*p=data+ihl;
  return !p[0] && !p[1] && p[4]==nonce[0] && p[5]==nonce[1] && !p[6] && p[7]==1 &&
    !std::memcmp(p+8,nonce.data(),nonce.size()) && cgs1_dhcp_lease::checksum_sum(p,24)==0xffff;
}
struct FixedKernel {
  static const char*interface(){return "wlan0";}
  static cgs1_ipv4::View view(){return cgs1_ipv4::inspect();}
  static bool allowed(const cgs1_ipv4::View&v){return v.verified && v.route_bound && v.up && v.running && v.index>0 && cgs1_ipv4::connected(v.address,v.netmask,v.route);}
};
#if defined(__linux__)
inline std::vector<sock_filter> echo_filter(const cgs1_ipv4::View&v,const Nonce&nonce) {
  std::vector<sock_filter>out;std::vector<size_t>fail;
  const auto load=[&](unsigned short code,unsigned k){out.push_back({code,0,0,k});};
  const auto equal=[&](unsigned k){out.push_back({BPF_JMP|BPF_JEQ|BPF_K,0,0,k});fail.push_back(out.size()-1);};
  load(BPF_LD|BPF_B|BPF_ABS,9);equal(1);
  load(BPF_LD|BPF_W|BPF_ABS,12);equal(v.route.gateway);
  load(BPF_LD|BPF_W|BPF_ABS,16);equal(v.address);
  load(BPF_LDX|BPF_B|BPF_MSH,0);
  load(BPF_LD|BPF_H|BPF_IND,0);equal(0);
  load(BPF_LD|BPF_W|BPF_IND,4);equal((uint32_t(nonce[0])<<24)|(uint32_t(nonce[1])<<16)|1);
  for(unsigned n=0;n<16;n+=4){load(BPF_LD|BPF_W|BPF_IND,8+n);equal(cgs1_dhcp_lease::be32(nonce.data()+n));}
  load(BPF_RET|BPF_K,84);const auto reject=out.size();load(BPF_RET|BPF_K,0);
  for(const auto at:fail)out[at].jf=static_cast<unsigned char>(reject-at-1);
  return out;
}
#endif
enum class EchoResult {WAITING,REACHABLE,FAILED};
template<class Kernel=FixedKernel>class Echo {
 public:
  Echo()=default;Echo(const Echo&)=delete;Echo&operator=(const Echo&)=delete;~Echo(){close();}
  bool start() {
#if defined(__linux__)
    if(attempted_ || ::geteuid()!=0)return fail_("echo_single_root_attempt_required");
    attempted_=true;view_=Kernel::view();started_ms_=now_ms();deadline_=started_ms_+2000;
    if(!started_ms_ || !Kernel::allowed(view_) || ::RAND_bytes(nonce_.data(),nonce_.size())!=1)return fail_("echo_kernel_view_or_nonce_unavailable");
    fd_=::socket(AF_INET,SOCK_RAW|SOCK_CLOEXEC|SOCK_NONBLOCK,IPPROTO_ICMP);
    if(fd_<0)return fail_("echo_raw_socket_unavailable");
    auto code=echo_filter(view_,nonce_);struct sock_fprog filter{static_cast<unsigned short>(code.size()),code.data()};
    const int one=1,ttl=64,buffer=4096;
    if(::setsockopt(fd_,SOL_SOCKET,SO_ATTACH_FILTER,&filter,sizeof(filter)) ||
        ::setsockopt(fd_,SOL_SOCKET,SO_LOCK_FILTER,&one,sizeof(one)) ||
        ::setsockopt(fd_,SOL_SOCKET,SO_BINDTODEVICE,Kernel::interface(),std::strlen(Kernel::interface())+1) ||
        ::setsockopt(fd_,SOL_SOCKET,SO_DONTROUTE,&one,sizeof(one)) ||
        ::setsockopt(fd_,SOL_SOCKET,SO_RCVBUF,&buffer,sizeof(buffer)) ||
        ::setsockopt(fd_,IPPROTO_IP,IP_PKTINFO,&one,sizeof(one)) ||
        ::setsockopt(fd_,IPPROTO_IP,IP_RECVTTL,&one,sizeof(one)) ||
        ::setsockopt(fd_,IPPROTO_IP,IP_TTL,&ttl,sizeof(ttl)))return fail_("echo_socket_options_unavailable");
    struct sockaddr_in local{};local.sin_family=AF_INET;local.sin_addr.s_addr=htonl(view_.address);
    struct sockaddr_in to{};to.sin_family=AF_INET;to.sin_addr.s_addr=htonl(view_.route.gateway);
    if(::bind(fd_,reinterpret_cast<sockaddr*>(&local),sizeof(local)) ||
        ::connect(fd_,reinterpret_cast<sockaddr*>(&to),sizeof(to)))return fail_("echo_fixed_binding_failed");
    // Queues predating the send never establish reachability. Drain a bounded
    // number without interpretation/export; the fresh nonce is not sent yet.
    unsigned char discard[128];unsigned n=0;
    for(;n<16;++n){const auto r=::recv(fd_,discard,sizeof(discard),MSG_DONTWAIT|MSG_TRUNC);if(r<0 && (errno==EAGAIN || errno==EWOULDBLOCK))break;if(r<0)return fail_("echo_initial_queue_failed");}
    if(n==16 || !same_view(view_,Kernel::view()))return fail_("echo_view_or_initial_queue_changed");
    const auto packet=request(nonce_);const auto before_send=now_ms();
    if(before_send<started_ms_ || before_send>=deadline_)return fail_("echo_pre_send_deadline");
    // Consume the send before syscall: an error/short result is ambiguous and
    // cannot grant a retry through this object or a repeated API START.
    sent_=true;
    if(::send(fd_,packet.data(),packet.size(),MSG_DONTWAIT)!=ssize_t(packet.size()))return fail_("echo_send_unconfirmed");
    return true;
#else
    return fail_("verified_linux_required");
#endif
  }
  EchoResult poll() {
#if defined(__linux__)
    if(reachable_)return EchoResult::REACHABLE;
    if(fd_<0 || failed_ || !sent_)return EchoResult::FAILED;
    const auto before=now_ms();
    if(before<started_ms_ || before>=deadline_ || !same_view(view_,Kernel::view())){fail_("echo_deadline_or_kernel_view_changed");return EchoResult::FAILED;}
    unsigned char bytes[128]{};alignas(cmsghdr) unsigned char control[256]{};sockaddr_in source{};
    iovec iov{bytes,sizeof(bytes)};msghdr msg{};msg.msg_name=&source;msg.msg_namelen=sizeof(source);
    msg.msg_iov=&iov;msg.msg_iovlen=1;msg.msg_control=control;msg.msg_controllen=sizeof(control);
    const auto size=::recvmsg(fd_,&msg,MSG_DONTWAIT|MSG_TRUNC);
    if(size<0 && (errno==EAGAIN || errno==EWOULDBLOCK))return EchoResult::WAITING;
    if(size<0 || size>ssize_t(sizeof(bytes)) || (msg.msg_flags&(MSG_TRUNC|MSG_CTRUNC)) ||
        msg.msg_namelen!=sizeof(source) || source.sin_family!=AF_INET || source.sin_addr.s_addr!=htonl(view_.route.gateway)){
      fail_("echo_receive_metadata_invalid");return EchoResult::FAILED;
    }
    bool info=false,ttl_seen=false;int ttl=0;
    for(auto*c=CMSG_FIRSTHDR(&msg);c;c=CMSG_NXTHDR(&msg,c)) {
      if(c->cmsg_level==IPPROTO_IP && c->cmsg_type==IP_PKTINFO) {
        in_pktinfo p{};
        if(info || c->cmsg_len!=CMSG_LEN(sizeof(p))){fail_("echo_pktinfo_shape");return EchoResult::FAILED;}
        std::memcpy(&p,CMSG_DATA(c),sizeof(p));info=p.ipi_ifindex==view_.index &&
          p.ipi_addr.s_addr==htonl(view_.address) && p.ipi_spec_dst.s_addr==htonl(view_.address);
        if(!info){fail_("echo_wrong_interface_or_destination");return EchoResult::FAILED;}
      }else if(c->cmsg_level==IPPROTO_IP && c->cmsg_type==IP_TTL) {
        if(ttl_seen || c->cmsg_len!=CMSG_LEN(sizeof(ttl))){fail_("echo_ttl_shape");return EchoResult::FAILED;}
        std::memcpy(&ttl,CMSG_DATA(c),sizeof(ttl));ttl_seen=true;
      }
    }
    const auto observed=now_ms();
    if(!info || !ttl_seen || !reply(bytes,size_t(size),view_,nonce_,ttl) || !same_view(view_,Kernel::view()) ||
        observed<before || now_ms()<observed || now_ms()>=deadline_){fail_("echo_reply_or_final_fence_invalid");return EchoResult::FAILED;}
    reachable_=true;observed_ms_=observed;close();return EchoResult::REACHABLE;
#else
    return EchoResult::FAILED;
#endif
  }
  void close(){if(fd_>=0){::close(fd_);fd_=-1;}}
  bool attempted()const{return attempted_;}bool sent()const{return sent_;}bool reachable()const{return reachable_;}
  bool failed()const{return failed_;}uint64_t observed_ms()const{return observed_ms_;}
  const cgs1_ipv4::View&view()const{return view_;}const std::string&error()const{return error_;}int system_error()const{return system_error_;}
 private:
  int fd_{-1},system_error_{0};bool attempted_{false},sent_{false},failed_{false},reachable_{false};
  Nonce nonce_{};cgs1_ipv4::View view_;uint64_t started_ms_{0},deadline_{0},observed_ms_{0};std::string error_;
  bool fail_(const char*error){failed_=true;error_=error;system_error_=errno;close();return false;}
};
} // namespace cgs1_gateway
