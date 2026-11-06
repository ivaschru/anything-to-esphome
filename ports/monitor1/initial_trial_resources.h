#pragma once

// Read-only pre-start resource observations for a FUTURE initial guardian.
// Pure parsers are portable; the fixed /proc reader is Linux-only. Neither
// parser nor reader reserves a port, allocates a RAM job or authorizes exec.
// MemFree is a conservative lower bound, NOT MemAvailable/RSS/OOM isolation.
#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <initializer_list>
#include <sstream>
#include <string>

namespace cgs1_initial_trial {
inline bool resource_decimal(const std::string &text,uint64_t maximum,uint64_t &value) {
  value=0;if(text.empty())return false;
  for(const auto c:text) {
    if(c<'0' || c>'9' || value>maximum/10 ||
       (value==maximum/10 && uint64_t(c-'0')>maximum%10)){value=0;return false;}
    value=value*10+uint64_t(c-'0');
  }
  return true;
}
inline bool initial_memory_floor(const std::string &text,uint64_t &free_bytes) {
  free_bytes=0;
  if(text.empty() || text.size()>16384 || text.back()!='\n' || text.find('\0')!=std::string::npos)return false;
  std::istringstream input(text);std::string line;uint64_t total=0,free=0;bool have_total=false,have_free=false;
  while(std::getline(input,line)) {
    std::istringstream fields(line);std::string key,number,unit,extra;fields>>key;
    if(key!="MemTotal:" && key!="MemFree:")continue;
    uint64_t kib=0;
    if(!(fields>>number>>unit) || (fields>>extra) || unit!="kB" ||
       !resource_decimal(number,1ULL<<30,kib))return false;
    if(key=="MemTotal:"){if(have_total)return false;have_total=true;total=kib*1024;}
    else {if(have_free)return false;have_free=true;free=kib*1024;}
  }
  // Linux 3.10 predates MemAvailable. Do not add cached/buffered/swap pages
  // or turn a missing/duplicate/incorrectly unit-labelled field into a floor.
  if(!have_total || !have_free || free>total || free<32ULL*1024*1024)return false;
  free_bytes=free;return true;
}
inline bool resource_hex(const std::string &text,size_t size) {
  return text.size()==size && text.find_first_not_of("0123456789abcdefABCDEF")==std::string::npos;
}
inline bool initial_tcp_ports_free(const std::string &text,bool ipv6) {
  if(text.empty() || text.size()>262144 || text.back()!='\n' || text.find('\0')!=std::string::npos)return false;
  std::istringstream input(text);std::string line,slot,local,remote,state;
  if(!std::getline(input,line) || line.size()>1024)return false;
  std::istringstream header(line);
  if(!(header>>slot>>local>>remote>>state) || slot!="sl" || local!="local_address" ||
     (remote!="rem_address" && remote!="remote_address") || state!="st")return false;
  const size_t address_size=ipv6?32:8;
  while(std::getline(input,line)) {
    if(line.empty() || line.size()>1024)return false;
    std::istringstream fields(line);
    if(!(fields>>slot>>local>>remote>>state) || slot.size()<2 || slot.back()!=':' ||
       slot.substr(0,slot.size()-1).find_first_not_of("0123456789")!=std::string::npos ||
       !resource_hex(state,2))return false;
    for(const auto *address:{&local,&remote})
      if(address->size()!=address_size+5 || (*address)[address_size]!=':' ||
         !resource_hex(address->substr(0,address_size),address_size) ||
         !resource_hex(address->substr(address_size+1),4))return false;
    // Any local use/state is refused, not just LISTEN. Nothing decodes,
    // exports or logs peer addresses from these transient kernel strings.
    auto port=local.substr(address_size+1);
    for(auto &c:port)if(c>='a' && c<='f')c=char(c-'a'+'A');
    if(port=="17A5" || port=="0CA0")return false; // API 6053 / OTA 3232.
  }
  return true;
}
}  // namespace cgs1_initial_trial

#if defined(__linux__)
#include "supervisor_process_tree.h"
#include <fcntl.h>
#include <sys/vfs.h>
#include <type_traits>

namespace cgs1_initial_trial {
struct InitialResourceObservation {
  bool verified{false};uint64_t conservative_free_bytes{0},observed_at_ms{0};
  const char *error{"unobserved"};
};
template<long FilesystemMagic=0x9fa0> class BasicInitialKernelResources {
 public:
  InitialResourceObservation read() const {
    const auto root=::open("/proc",O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
    const auto result=read_(root);
    if(root>=0 && ::close(root))return fail_("kernel_root_close_uncertain");
    return result;
  }
  template<long Magic=FilesystemMagic,std::enable_if_t<Magic!=0x9fa0 && Magic==FilesystemMagic,int> =0>
  InitialResourceObservation read_fixture_root(int root) const {return read_(root);}
 private:
  static InitialResourceObservation fail_(const char *error){return {false,0,0,error};}
  static bool file_(int root,const char *name,size_t limit,std::string &text) {
    text.clear();const int fd=::openat(root,name,O_RDONLY|O_NONBLOCK|O_NOFOLLOW|O_CLOEXEC);
    if(fd<0)return false;
    struct stat before{},after{},named{};struct statfs fs{};
    bool okay=!::fstat(fd,&before) && S_ISREG(before.st_mode) && before.st_uid==0 &&
      !::fstatfs(fd,&fs) && fs.f_type==FilesystemMagic;
    char bytes[1024];
    while(okay) {
      const auto n=::read(fd,bytes,sizeof(bytes));
      if(n<0 && errno==EINTR)continue;
      if(n<0 || size_t(n)>limit-text.size()){okay=false;break;}
      if(!n)break;
      text.append(bytes,size_t(n));
    }
    okay=okay && !::fstat(fd,&after) && !::fstatat(root,name,&named,AT_SYMLINK_NOFOLLOW) &&
      S_ISREG(named.st_mode) && before.st_dev==after.st_dev && before.st_ino==after.st_ino &&
      before.st_dev==named.st_dev && before.st_ino==named.st_ino &&
      after.st_uid==0 && named.st_uid==0 && before.st_mode==after.st_mode && after.st_mode==named.st_mode;
    if(::close(fd))okay=false;
    if(!okay)text.clear();return okay;
  }
  InitialResourceObservation read_(int root) const {
    struct stat directory{};struct statfs fs{};
    if(::getuid()!=0 || ::geteuid()!=0 || root<0 || ::fstat(root,&directory) ||
       !S_ISDIR(directory.st_mode) || directory.st_uid!=0 || ::fstatfs(root,&fs) ||
       fs.f_type!=FilesystemMagic)return fail_("verified_kernel_filesystem_required");
    const auto started=cgs1_supervisor::process_tree_clock_ms();
    if(!started)return fail_("monotonic_clock_unavailable");
    std::string text;uint64_t before=0,after=0;
    if(!file_(root,"meminfo",16384,text) || !initial_memory_floor(text,before))return fail_("initial_memory_unverified");
    // /proc/net is the kernel's per-caller namespace symlink. Fixed children
    // are read only from the admitted procfs; no socket/controller is opened.
    if(!file_(root,"net/tcp",262144,text) || !initial_tcp_ports_free(text,false))return fail_("ipv4_ports_unverified");
    if(!file_(root,"net/tcp6",262144,text) || !initial_tcp_ports_free(text,true))return fail_("ipv6_ports_unverified");
    if(!file_(root,"meminfo",16384,text) || !initial_memory_floor(text,after))return fail_("final_memory_unverified");
    const auto finished=cgs1_supervisor::process_tree_clock_ms();
    // This rejects a slow observation AFTER reads return; it is not a hard
    // kernel-I/O timeout or a measured monitor performance guarantee.
    if(!finished || finished<started || finished-started>1000)return fail_("resource_observation_stale");
    return {true,std::min(before,after),finished,""};
  }
};
using InitialKernelResources=BasicInitialKernelResources<>;
// Pre-start only: after the bridge starts its API port is expected to be in
// use. Running-child memory/endpoint ownership needs its separate live scope.
}  // namespace cgs1_initial_trial
#endif
