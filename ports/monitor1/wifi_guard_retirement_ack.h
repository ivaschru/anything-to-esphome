#pragma once

// These public metadata receipts bind a guardian birth to BOTH immutable
// transaction and retirement-intent inodes. They carry no network secrets.
// The CRC detects damaged bytes; root process isolation is a separate boundary.
#include "wifi_guard_retirement_record.h"

namespace cgs1_wifi_retirement {
inline constexpr size_t ACK_BYTES=174;
enum class AckStage:uint8_t {RETIRING=1,RETIRED=2};
struct Ack {
  std::string full_session,transaction;cgs1_wifi_guard::Stamp plan,intent;
  int candidate{-1};uint8_t role{0},stage{0};uint32_t pid{0};uint64_t start{0};
};
inline bool valid(const Ack&a) {
  return a.full_session.size()==16 && cgs1_checkpoint::valid_epoch(a.full_session.c_str()) &&
    a.transaction.size()==16 && cgs1_checkpoint::valid_epoch(a.transaction.c_str()) &&
    cgs1_wifi_guard::valid(a.plan) && a.intent.device==a.plan.device && a.intent.inode &&
    a.intent.inode!=a.plan.inode && a.intent.size==INTENT_BYTES &&
    a.intent.mtime_nsec<1000000000 && a.intent.ctime_nsec<1000000000 &&
    a.candidate>=0 && a.candidate<=1000000 && (a.role==1 || a.role==2) &&
    (a.stage==1 || a.stage==2) && a.pid>=2 && a.pid<=2147483647 && a.start;
}
inline bool acknowledgement_for(const Ack&a,const Intent&i,const cgs1_wifi_guard::Stamp&intent,
    cgs1_wifi_guard::Role role,AckStage stage) {
  const unsigned r=unsigned(role);if(r<1 || r>2 || !valid(i) || !valid(a))return false;
  return a.full_session==i.full_session && a.transaction==i.transaction && a.plan==i.plan && a.intent==intent &&
    a.candidate==i.candidate && a.role==r && a.stage==uint8_t(stage) &&
    a.pid==i.peers[r-1].pid && a.start==i.peers[r-1].start;
}
inline bool encode(const Ack&a,cgs1_wifi_private::detail::Bytes&out) {
  if(!valid(a))return false;
  auto&s=out.value;s="CGS1WA1\n";s+=a.full_session;s+=a.transaction;
  encode_stamp(s,a.plan);encode_stamp(s,a.intent);
  cgs1_wifi_guard::detail::number(s,uint32_t(a.candidate),4);
  cgs1_wifi_guard::detail::number(s,a.role,1);cgs1_wifi_guard::detail::number(s,a.stage,1);
  cgs1_wifi_guard::detail::number(s,a.pid,4);cgs1_wifi_guard::detail::number(s,a.start,8);
  cgs1_wifi_guard::detail::number(s,cgs1_wifi_private::detail::crc32(s,s.size()),4);
  return s.size()==ACK_BYTES;
}
inline bool decode(const cgs1_wifi_private::detail::Bytes&bytes,Ack&out) {
  const auto&s=bytes.value;if(s.size()!=ACK_BYTES || s.compare(0,8,"CGS1WA1\n"))return false;
  cgs1_wifi_guard::detail::Cursor crc{s,s.size()-4};uint64_t expected=0;
  if(!crc.number(4,expected) || expected!=cgs1_wifi_private::detail::crc32(s,s.size()-4))return false;
  cgs1_wifi_guard::detail::Cursor in{s,8};Ack a;uint64_t candidate=0,role=0,stage=0,pid=0;
  if(!in.text(16,a.full_session) || !in.text(16,a.transaction) || !decode_stamp(in,a.plan) || !decode_stamp(in,a.intent) ||
      !in.number(4,candidate) || candidate>1000000 || !in.number(1,role) || !in.number(1,stage) ||
      !in.number(4,pid) || !in.number(8,a.start) || in.at!=s.size()-4)return false;
  a.candidate=int(candidate);a.role=uint8_t(role);a.stage=uint8_t(stage);a.pid=uint32_t(pid);
  if(!valid(a))return false;
  out=std::move(a);return true;
}
} // namespace cgs1_wifi_retirement
