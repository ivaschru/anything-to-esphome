#pragma once

// Metadata-only sealed retirement intent. The seven old ACK/binding inode
// identities survive native failure, so a new actor can distinguish an
// already absent file from a substituted inode instead of blindly deleting.
// No credentials, SSID, key hash, arbitrary path or command enter this record.
// A valid codec record alone is NOT authority: the later concrete adapter must
// verify its private root, live peers, exact Store decision/lock and scope.
#include "wifi_guard_records.h"

namespace cgs1_wifi_retirement {
inline constexpr size_t INTENT_BYTES=556,OLD_FILES=7;
enum class OldFile {CANDIDATE,PRIMARY_ARMED,BACKUP_ARMED,PRIMARY_BOUND,BACKUP_BOUND,PRIMARY_COMMITTED,BACKUP_COMMITTED};
inline const char*old_name(OldFile file) {
  switch(file) {
    case OldFile::CANDIDATE:return "wifi-candidate.v1";
    case OldFile::PRIMARY_ARMED:return "wifi-primary-armed.v1";
    case OldFile::BACKUP_ARMED:return "wifi-backup-armed.v1";
    case OldFile::PRIMARY_BOUND:return "wifi-primary-bound.v1";
    case OldFile::BACKUP_BOUND:return "wifi-backup-bound.v1";
    case OldFile::PRIMARY_COMMITTED:return "wifi-primary-committed.v1";
    case OldFile::BACKUP_COMMITTED:return "wifi-backup-committed.v1";
  }
  return nullptr;
}
struct Peer {uint32_t pid{0};uint64_t start{0};};
struct Intent {
  std::string full_session,transaction,boot_id;
  cgs1_wifi_guard::Stamp plan;
  int candidate{-1};std::array<Peer,2>peers;
  std::array<cgs1_wifi_guard::Stamp,OLD_FILES>old_files;
};
inline bool valid(const Intent&i) {
  if(!cgs1_checkpoint::valid_epoch(i.full_session.c_str()) || i.full_session.size()!=16 ||
      !cgs1_checkpoint::valid_epoch(i.transaction.c_str()) || i.transaction.size()!=16 ||
      !cgs1_wifi_guard::valid_boot(i.boot_id) || !cgs1_wifi_guard::valid(i.plan) ||
      i.candidate<0 || i.candidate>1000000 || i.peers[0].pid==i.peers[1].pid)return false;
  for(const auto&p:i.peers)if(p.pid<2 || p.pid>2147483647 || !p.start)return false;
  for(size_t n=0;n<i.old_files.size();++n) {
    const auto&s=i.old_files[n];
    if(s.device!=i.plan.device || !s.inode || s.inode==i.plan.inode || s.size!=118 ||
        s.mtime_nsec>=1000000000 || s.ctime_nsec>=1000000000)return false;
    for(size_t before=0;before<n;++before)if(i.old_files[before].inode==s.inode)return false;
  }
  return true;
}
inline bool for_plan(const Intent&i,const cgs1_wifi_guard::Plan&p,const cgs1_wifi_guard::Stamp&stamp,
    int candidate,const std::array<Peer,2>&peers) {
  if(!valid(i) || !cgs1_wifi_guard::valid(p) || i.full_session!=p.full_session ||
      i.transaction!=p.decision.transaction || i.boot_id!=p.boot_id || !(i.plan==stamp) || i.candidate!=candidate)return false;
  for(const auto&old:p.original)if(old.id==candidate)return false;
  for(size_t n=0;n<2;++n)if(i.peers[n].pid!=peers[n].pid || i.peers[n].start!=peers[n].start)return false;
  return true;
}
inline void encode_stamp(std::string&out,const cgs1_wifi_guard::Stamp&s) {
  for(const auto n:{s.device,s.inode,s.size,s.mtime_sec,s.mtime_nsec,s.ctime_sec,s.ctime_nsec})cgs1_wifi_guard::detail::number(out,n,8);
}
inline bool decode_stamp(cgs1_wifi_guard::detail::Cursor&in,cgs1_wifi_guard::Stamp&s) {
  for(auto*n:{&s.device,&s.inode,&s.size,&s.mtime_sec,&s.mtime_nsec,&s.ctime_sec,&s.ctime_nsec})if(!in.number(8,*n))return false;
  return true;
}
inline bool encode(const Intent&i,cgs1_wifi_private::detail::Bytes&out) {
  if(!valid(i))return false;
  auto&s=out.value;s.clear();s.reserve(INTENT_BYTES);s="CGS1WR1\n";s+=i.full_session;s+=i.transaction;s+=i.boot_id;
  encode_stamp(s,i.plan);cgs1_wifi_guard::detail::number(s,uint32_t(i.candidate),4);
  for(const auto&p:i.peers){cgs1_wifi_guard::detail::number(s,p.pid,4);cgs1_wifi_guard::detail::number(s,p.start,8);}
  for(const auto&file:i.old_files)encode_stamp(s,file);
  cgs1_wifi_guard::detail::number(s,cgs1_wifi_private::detail::crc32(s,s.size()),4);
  return s.size()==INTENT_BYTES;
}
inline bool decode(const cgs1_wifi_private::detail::Bytes&bytes,Intent&out) {
  const auto&s=bytes.value;
  if(s.size()!=INTENT_BYTES || s.compare(0,8,"CGS1WR1\n"))return false;
  cgs1_wifi_guard::detail::Cursor crc{s,s.size()-4};uint64_t expected=0;
  if(!crc.number(4,expected) || expected!=cgs1_wifi_private::detail::crc32(s,s.size()-4))return false;
  Intent i;cgs1_wifi_guard::detail::Cursor in{s,8};uint64_t candidate=0;
  if(!in.text(16,i.full_session) || !in.text(16,i.transaction) || !in.text(36,i.boot_id) ||
      !decode_stamp(in,i.plan) || !in.number(4,candidate) || candidate>1000000)return false;
  i.candidate=int(candidate);
  for(auto&p:i.peers){uint64_t pid=0;if(!in.number(4,pid) || !in.number(8,p.start))return false;p.pid=uint32_t(pid);}
  for(auto&file:i.old_files)if(!decode_stamp(in,file))return false;
  if(in.at!=s.size()-4 || !valid(i))return false;
  out=std::move(i);return true;
}
} // namespace cgs1_wifi_retirement
