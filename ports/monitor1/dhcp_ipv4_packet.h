#pragma once

// IPv4/UDP framing for a passive, non-relayed DHCP capture. No sockets or
// packets are created here. The future capture adapter supplies one complete
// IP datagram (SOCK_DGRAM AF_PACKET), not an Ethernet header or an arbitrary
// UDP fragment. Unsupported fragments, oversized packets and invalid checksums
// cannot become lease evidence. Hardware checksum-offload metadata is NOT
// handled by this v1 layer; the adapter must refuse unverified offload frames.
#include "dhcp_lease_proof.h"

namespace cgs1_dhcp_lease {
struct Wire {uint32_t source{0},destination{0};unsigned source_port{0},destination_port{0};};
inline unsigned be16(const unsigned char*p){return (unsigned(p[0])<<8)|p[1];}
inline uint32_t checksum_sum(const unsigned char*p,size_t size,uint32_t sum=0) {
  while(size>1){sum+=be16(p);p+=2;size-=2;}
  if(size)sum+=unsigned(*p)<<8;
  while(sum>>16)sum=(sum&0xffff)+(sum>>16);
  return sum;
}
inline bool decode_ipv4(const unsigned char*packet,size_t size,const Mac&mac,Message&message,Wire&wire,
    bool kernel_outgoing_checksum_deferred=false) {
  message={};wire={};
  if(!packet || size<20 || size>1500 || (packet[0]>>4)!=4)return false;
  const size_t header=size_t(packet[0]&15)*4;
  if(header<20 || header>60 || header>size || be16(packet+2)!=size || !packet[8] || packet[9]!=17 ||
      (be16(packet+6)&0xbfff) || checksum_sum(packet,header)!=0xffff)return false;
  if(size-header<8)return false;
  const auto*udp=packet+header;const size_t length=be16(udp+4);
  if(length!=size-header || length<8)return false;
  if(be16(udp+6) && !kernel_outgoing_checksum_deferred) {
    // IPv4 UDP permits an absent (zero) checksum. A provided checksum covers
    // the pseudoheader as well: changing only source/destination IP must not
    // leave an otherwise identical ACK acceptable. Odd payloads are padded
    // arithmetically; the parser never reads one byte beyond the capture.
    const auto pseudo=checksum_sum(packet+12,8)+17+uint32_t(length);
    if(checksum_sum(udp,length,pseudo)!=0xffff)return false;
  }
  Wire observed;observed.source=be32(packet+12);observed.destination=be32(packet+16);
  observed.source_port=be16(udp);observed.destination_port=be16(udp+2);Message value;
  if(!decode(udp+8,length-8,observed.source_port,observed.destination_port,mac,value))return false;
  // This flag is supplied ONLY from PACKET_AUXDATA CHECKSUM_PARTIAL together
  // with the kernel's PACKET_OUTGOING direction, never an API/client boolean.
  // ACK checksums cannot be bypassed by this TX-only exception. Linux v3.10
  // af_packet.c sets TP_STATUS_CSUMNOTREADY for that skb state before NIC work.
  if(kernel_outgoing_checksum_deferred && !value.from_client)return false;
  if(value.from_client) {
    if(value.type==3 && ((value.ciaddr && observed.source!=value.ciaddr) || (!value.ciaddr && observed.source)))return false;
  }else if(!cgs1_ipv4::unicast(observed.source))return false;
  message=std::move(value);wire=observed;return true;
}
} // namespace cgs1_dhcp_lease
