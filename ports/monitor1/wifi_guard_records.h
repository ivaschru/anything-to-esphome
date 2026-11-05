#pragma once

// Metadata-only candidate binding and per-guardian acknowledgements. A valid
// codec record is not itself live authority: the actor must read it from its
// fixed private journal, compare the current plan inode/transaction and verify
// the expected guardian PID/start/executable before acting. No key or key hash
// crosses the numeric supervisor channel or appears in these records.
#include "wifi_guard_plan.h"

namespace cgs1_wifi_guard {
enum class Role:uint8_t {PRIMARY=1,BACKUP=2};
enum class Stage:uint8_t {ARMED=1,BOUND=2,COMMITTED=3};
struct Record {
  std::string full_session,transaction;
  Stamp plan;
  int candidate{-1};
  // Zero role/stage/pid/start identifies a candidate BINDING record. ACKs
  // carry exactly one of the two roles and the real sender birth identity.
  uint8_t role{0},stage{0};uint32_t pid{0};uint64_t start{0};
};
inline bool valid(const Record &r) {
  if(r.full_session.size()!=16 || r.transaction.size()!=16 ||
      !cgs1_checkpoint::valid_epoch(r.full_session.c_str()) ||
      !cgs1_checkpoint::valid_epoch(r.transaction.c_str()) || !valid(r.plan))return false;
  if(!r.role && !r.stage && !r.pid && !r.start)return r.candidate>=0 && r.candidate<=1000000;
  if((r.role!=uint8_t(Role::PRIMARY) && r.role!=uint8_t(Role::BACKUP)) ||
      r.pid<2 || r.pid>2147483647 || !r.start)return false;
  if(r.stage==uint8_t(Stage::ARMED))return r.candidate==-1;
  return (r.stage==uint8_t(Stage::BOUND) || r.stage==uint8_t(Stage::COMMITTED)) && r.candidate>=0 && r.candidate<=1000000;
}
inline bool binding_for(const Record &r,const Plan &p,const Stamp &stamp) {
  if(!valid(p) || !valid(r) || r.role || r.full_session!=p.full_session || r.transaction!=p.decision.transaction ||
      !(r.plan==stamp))return false;
  for(const auto &old:p.original)if(old.id==r.candidate)return false;
  return true;
}
inline bool acknowledgement_for(const Record &r,const Plan &p,const Stamp &stamp,Role role,Stage stage,
    uint32_t expected_pid,uint64_t expected_start,int candidate=-1) {
  if(!valid(p))return false;
  if(stage==Stage::BOUND || stage==Stage::COMMITTED)for(const auto &old:p.original)if(old.id==candidate)return false;
  return valid(r) && r.role==uint8_t(role) && r.stage==uint8_t(stage) &&
    r.full_session==p.full_session && r.transaction==p.decision.transaction && r.plan==stamp &&
    r.pid==expected_pid && r.start==expected_start && r.candidate==candidate;
  // Caller still performs a fresh live-process/executable check. An old ACK
  // from an exited guardian, another role or previous native session cannot
  // extend a deadline or authorize a current network change by itself.
}
inline bool encode(const Record &r,cgs1_wifi_private::detail::Bytes &out) {
  if(!valid(r))return false;
  auto &s=out.value;cgs1_wifi_private::erase_bytes(s.empty()?nullptr:&s[0],s.size());
  s.clear();s.reserve(118);s="CGS1WA1\n";s+=r.full_session;s+=r.transaction;
  for(auto value:{r.plan.device,r.plan.inode,r.plan.size,r.plan.mtime_sec,r.plan.mtime_nsec,
      r.plan.ctime_sec,r.plan.ctime_nsec})detail::number(s,value,8);
  detail::number(s,r.candidate<0?0xffffffffU:uint32_t(r.candidate),4);
  detail::number(s,r.role,1);detail::number(s,r.stage,1);detail::number(s,r.pid,4);detail::number(s,r.start,8);
  detail::number(s,cgs1_wifi_private::detail::crc32(s,s.size()),4);return true;
}
inline bool decode(const cgs1_wifi_private::detail::Bytes &bytes,Record &out) {
  const auto &s=bytes.value;if(s.size()!=118 || s.compare(0,8,"CGS1WA1\n"))return false;
  detail::Cursor checksum{s,s.size()-4};uint64_t crc=0;
  if(!checksum.number(4,crc) || crc!=cgs1_wifi_private::detail::crc32(s,s.size()-4))return false;
  Record r;detail::Cursor input{s,8};uint64_t candidate=0,role=0,stage=0,pid=0;
  if(!input.text(16,r.full_session) || !input.text(16,r.transaction))return false;
  for(auto *value:{&r.plan.device,&r.plan.inode,&r.plan.size,&r.plan.mtime_sec,&r.plan.mtime_nsec,
      &r.plan.ctime_sec,&r.plan.ctime_nsec})if(!input.number(8,*value))return false;
  if(!input.number(4,candidate) || !input.number(1,role) || !input.number(1,stage) ||
      !input.number(4,pid) || !input.number(8,r.start) || input.at!=s.size()-4 ||
      (candidate!=0xffffffffU && candidate>1000000))return false;
  r.candidate=candidate==0xffffffffU?-1:int(candidate);r.role=uint8_t(role);r.stage=uint8_t(stage);r.pid=uint32_t(pid);
  if(!valid(r))return false;
  out=r;return true;
}
} // namespace cgs1_wifi_guard
