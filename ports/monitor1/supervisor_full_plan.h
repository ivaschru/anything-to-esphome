#pragma once

// Immutable boot-local plan passed by inherited READ-ONLY FD. Linux 3.10 has
// no memfd sealing; the trusted coordinator instead closes its writer, opens
// a 0400 reader and unlinks the temporary inode before starting guardians.
// No mutable filename survives. Guardians still recheck the live board and
// processes: a parsed plan is evidence/coordinates, not hardware authority.
#include "supervisor_bootstrap_codec.h"
#include "supervisor_image.h"
#include "supervisor_recovery_effects.h"
#include <algorithm>

namespace cgs1_supervisor {
struct FullPlan {
  cgs1_net_trial::StockInspection stock;
  OriginalEffects effects;
  Digest native_digest{},guardian_digest{};
  std::string nonce;
  uint64_t created_ms{0};
};
inline bool plan_hex(const std::string &text,size_t size) {
  return text.size()==size && text.find_first_not_of("0123456789abcdef")==std::string::npos;
}
inline bool plan_boot(const std::string &text) {
  if(text.size()!=36)return false;
  for(size_t i=0;i<text.size();++i) {
    if(i==8 || i==13 || i==18 || i==23){if(text[i]!='-')return false;}
    else if(std::string("0123456789abcdef").find(text[i])==std::string::npos)return false;
  }
  return true;
}
inline bool plan_shape(const FullPlan &p) {
  Digest bridge{};
  if(!p.stock.verified || !plan_boot(p.stock.boot_id) || p.effects.boot_id!=p.stock.boot_id ||
     !plan_hex(p.nonce,16) || p.nonce==std::string(16,'0') || !p.created_ms ||
     !parse_digest(p.stock.bridge_sha,bridge) || p.effects.brightness>1000 ||
     p.effects.pm_mux!=(p.effects.pm_enabled?cgs1_pm::pinmux::UART:cgs1_pm::pinmux::GPIO))return false;
  for(const auto &digest:{bridge,p.native_digest,p.guardian_digest})
    if(std::all_of(digest.begin(),digest.end(),[](uint8_t b){return b==0;}))return false;
  const char *paths[]{"/data/bin/SnowApp","/bin/busybox","/bin/busybox","/data/.esphome-cgs1/program"};
  for(unsigned i=0;i<4;++i) {
    const auto &process=p.stock.processes[i];
    if(process.pid<=1 || process.pid>INT_MAX || process.parent<0 || process.parent>INT_MAX ||
       !process.start || process.executable!=paths[i])return false;
    for(unsigned j=0;j<i;++j)if(process.pid==p.stock.processes[j].pid)return false;
  }
  return p.stock.processes[0].parent==p.stock.processes[1].pid;
}
inline std::string encode_full_plan(const FullPlan &p) {
  if(!plan_shape(p))return {};
  std::string text="CGS1_FULL_PLAN_V1\n"+p.nonce+"\n"+p.stock.boot_id+"\n"+std::to_string(p.created_ms)+"\n";
  text+=p.stock.bridge_sha+"\n"+digest_text(p.native_digest)+"\n"+digest_text(p.guardian_digest)+"\n";
  text+=std::to_string(p.effects.pm_enabled?1:0)+" "+std::to_string(p.effects.pm_mux)+" "+std::to_string(p.effects.brightness)+"\n";
  for(const auto &process:p.stock.processes)
    text+=std::to_string(process.pid)+" "+std::to_string(process.parent)+" "+std::to_string(process.start)+"\n";
  return text;
}
inline bool decode_full_plan(const std::string &text,FullPlan &out) {
  if(text.empty() || text.size()>2048 || text.back()!='\n')return false;
  std::istringstream input(text);std::string magic,created,native,guardian,pm,mux,brightness;
  FullPlan candidate;
  if(!(input>>magic>>candidate.nonce>>candidate.stock.boot_id>>created>>candidate.stock.bridge_sha>>native>>guardian>>pm>>mux>>brightness) ||
     magic!="CGS1_FULL_PLAN_V1")return false;
  uint64_t pm_value=0,mux_value=0,brightness_value=0;
  if(!bootstrap_number(created,UINT64_MAX,candidate.created_ms) ||
     !bootstrap_number(pm,1,pm_value) || !bootstrap_number(mux,160,mux_value) ||
     !bootstrap_number(brightness,1000,brightness_value) ||
     !parse_digest(native,candidate.native_digest) || !parse_digest(guardian,candidate.guardian_digest))return false;
  candidate.effects={candidate.stock.boot_id,pm_value!=0,uint32_t(mux_value),unsigned(brightness_value)};
  const char *paths[]{"/data/bin/SnowApp","/bin/busybox","/bin/busybox","/data/.esphome-cgs1/program"};
  for(unsigned i=0;i<4;++i) {
    std::string pid,parent,start;uint64_t p=0,pp=0,at=0;
    if(!(input>>pid>>parent>>start) || !bootstrap_number(pid,INT_MAX,p) || p<2 ||
       !bootstrap_number(parent,INT_MAX,pp) || !bootstrap_number(start,UINT64_MAX,at) || !at)return false;
    candidate.stock.processes[i]={long(p),long(pp),at,'?',paths[i]};
  }
  std::string extra;if(input>>extra)return false;
  // This claim is accepted only after the production BoardPolicy redoes all
  // live validation. Canonical re-encoding rejects whitespace/number variants
  // so the same bytes unambiguously identify one plan across both guardians.
  candidate.stock.verified=true;
  if(!plan_shape(candidate) || encode_full_plan(candidate)!=text)return false;
  out=std::move(candidate);return true;
}
inline bool full_plan_fresh_for_takeover(const FullPlan &p,uint64_t now) {
  // Used before the FIRST stock signal only. OTA re-exec hours later uses the
  // already-acquired plan + current guardian lease, not a renewed takeover.
  return plan_shape(p) && now>=p.created_ms && now-p.created_ms<=30000;
}

inline bool read_full_plan_fd(int descriptor,FullPlan &out) {
  struct stat before{},after{};struct statfs fs{};
  const int flags=::fcntl(descriptor,F_GETFL);
  if(descriptor<3 || flags<0 || (flags&O_ACCMODE)!=O_RDONLY || ::fstat(descriptor,&before) ||
     !S_ISREG(before.st_mode) || before.st_uid!=0 || (before.st_mode&07777)!=0400 || before.st_nlink!=0 ||
     before.st_size<1 || before.st_size>2048 || ::fstatfs(descriptor,&fs) || fs.f_type!=0x01021994)return false;
  std::string text(size_t(before.st_size),'\0');
  // pread avoids shared-offset races between inherited descriptions after fork.
  const auto count=::pread(descriptor,text.data(),text.size(),0);
  if(count!=ssize_t(text.size()) || ::fstat(descriptor,&after) || after.st_dev!=before.st_dev ||
     after.st_ino!=before.st_ino || after.st_size!=before.st_size || after.st_mtime!=before.st_mtime ||
     after.st_ctime!=before.st_ctime || after.st_nlink!=0)return false;
  return decode_full_plan(text,out);
}
inline int seal_full_plan_fd(int directory,const FullPlan &plan) {
  const auto text=encode_full_plan(plan);struct stat dir{};struct statfs fs{};
  if(text.empty() || ::fstat(directory,&dir) || !S_ISDIR(dir.st_mode) || dir.st_uid!=0 ||
     (dir.st_mode&07777)!=0700 || ::fstatfs(directory,&fs) || fs.f_type!=0x01021994)return -1;
  const auto name="full-plan."+plan.nonce;
  const int writer=::openat(directory,name.c_str(),O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);
  if(writer<0)return -1;
  const bool written=::write(writer,text.data(),text.size())==ssize_t(text.size()) &&
                     !::fsync(writer) && !::fchmod(writer,0400);
  struct stat original{};const bool inspected=written && !::fstat(writer,&original);
  ::close(writer);if(!inspected)return -1;
  const int reader=::openat(directory,name.c_str(),O_RDONLY|O_NOFOLLOW|O_CLOEXEC);
  struct stat opened{};
  if(reader<0 || ::fstat(reader,&opened) || opened.st_dev!=original.st_dev || opened.st_ino!=original.st_ino ||
     ::unlinkat(directory,name.c_str(),0) || ::fsync(directory)) {
    if(reader>=0)::close(reader);
    return -1;
  }
  FullPlan checked;
  if(!read_full_plan_fd(reader,checked) || encode_full_plan(checked)!=text){::close(reader);return -1;}
  return reader;
}
}  // namespace cgs1_supervisor
