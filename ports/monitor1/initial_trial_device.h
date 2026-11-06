#pragma once

// Device identity evidence for the first disabled bridge trial. Parsers do
// not expose the credential-bearing INI; the Linux reader returns only a
// match/refusal. Neither a match nor a held fd authorizes process execution.
#include <array>
#include <cstdint>
#include <sstream>
#include <string>

namespace cgs1_initial_trial {
inline std::string initial_identity_trim(const std::string &text) {
  const auto first=text.find_first_not_of(" \t\r");
  if(first==std::string::npos)return {};
  return text.substr(first,text.find_last_not_of(" \t\r")-first+1);
}
inline bool initial_boot_identity(const std::string &text) {
  if(text.size()!=36)return false;
  for(size_t i=0;i<text.size();++i) {
    if(i==8 || i==13 || i==18 || i==23){if(text[i]!='-')return false;}
    else if(std::string("0123456789abcdef").find(text[i])==std::string::npos)return false;
  }
  return text!="00000000-0000-0000-0000-000000000000";
}
inline bool initial_physical_wlan_identity(const std::string &text) {
  if(text.size()!=17 || text=="00:00:00:00:00:00")return false;
  for(size_t i=0;i<text.size();++i) {
    if(i%3==2){if(text[i]!=':')return false;}
    else if(std::string("0123456789abcdef").find(text[i])==std::string::npos)return false;
  }
  // The host capture admits unicast WLAN addresses, including locally
  // administered ones. Do not confuse the separate Noise API MAC with it.
  return (std::string("02468ace").find(text[1])!=std::string::npos);
}
inline bool initial_co2_setting(const std::string &text,int &type) {
  type=0;
  if(text.empty() || text.size()>65536 || text.find('\0')!=std::string::npos)return false;
  std::istringstream input(text);std::string line;bool sensors=false,seen=false;
  unsigned sections=0;int found=0;
  while(std::getline(input,line)) {
    line=initial_identity_trim(line);
    if(line.empty() || line[0]=='#' || line[0]==';')continue;
    if(line[0]=='[') {
      sensors=line=="[sensors]";
      // Duplicated target sections are ambiguous even if only one happens
      // to hold co2_type. Other settings and credentials are never returned.
      if(sensors && ++sections!=1)return false;
      continue;
    }
    if(!sensors)continue;
    const auto equals=line.find('=');
    if(equals==std::string::npos || initial_identity_trim(line.substr(0,equals))!="co2_type")continue;
    const auto value=initial_identity_trim(line.substr(equals+1));
    if(seen || (value!="2" && value!="3"))return false;
    seen=true;found=value[0]-'0';
  }
  if(!seen)return false;
  type=found;return true;
}
struct InitialDeviceIdentity {
  std::string wlan_mac,boot_id;int co2_type{0};
  bool valid() const {
    return initial_physical_wlan_identity(wlan_mac) && initial_boot_identity(boot_id) &&
      (co2_type==2 || co2_type==3);
  }
};
}  // namespace cgs1_initial_trial

#if defined(__linux__)
#include "initial_trial_admission.h"
#include <sys/utsname.h>
#include <type_traits>

namespace cgs1_initial_trial {
template<long DataFilesystem=0xef53,long ProcFilesystem=0x9fa0,long SysFilesystem=0x62656572>
class BasicInitialDeviceIdentity {
 public:
  BasicInitialDeviceIdentity()=default;
  BasicInitialDeviceIdentity(const BasicInitialDeviceIdentity &)=delete;
  BasicInitialDeviceIdentity &operator=(const BasicInitialDeviceIdentity &)=delete;
  ~BasicInitialDeviceIdentity(){if(root_>=0)::close(root_);}
  const char *error() const{return error_;}
  bool open(const InitialDeviceIdentity &expected) {
    const int root=::open("/",DIRECTORY_FLAGS);
    const bool okay=open_(root,expected,"");
    if(root>=0 && ::close(root))return refuse_("identity_root_close_uncertain");
    return okay;
  }
  template<long Magic=DataFilesystem,
    std::enable_if_t<Magic!=0xef53 && Magic==DataFilesystem,int> =0>
  bool open_fixture_root(int root,const InitialDeviceIdentity &expected,const std::string &machine) {
    // Synthetic roots and CPU strings exist only in a compile-time
    // non-production type. There is no runtime path/platform override.
    return open_(root,expected,machine);
  }
  bool current() {
    if(!verified_)return false;
    if(!machine_())return refuse_("identity_cpu_changed_or_unverified");
    for(size_t i=0;i<PATHS.size();++i)
      if(!file_(i,false))return refuse_("identity_changed_or_unreadable");
    return true;
  }
 private:
  inline static constexpr int DIRECTORY_FLAGS=O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_NOATIME|O_CLOEXEC;
  inline static constexpr std::array<const char *,4> PATHS={
    "data/etc/os-release","data/etc/setting.ini",
    "proc/sys/kernel/random/boot_id","sys/class/net/wlan0/address"};
  int root_{-1};bool attempted_{false},verified_{false};
  InitialDeviceIdentity expected_{};std::string fixture_machine_;
  DirectoryIdentity data_identity_{};
  std::array<DirectoryIdentity,4> parents_{};
  std::array<struct stat,4> files_{};
  const char *error_{"unobserved"};
  bool refuse_(const char *reason){verified_=false;error_=reason;return false;}
  static bool directory_(int fd,long magic,DirectoryIdentity *identity=nullptr) {
    struct stat value{};struct statfs fs{};
    if(fd<0 || ::fstat(fd,&value) || !S_ISDIR(value.st_mode) || value.st_uid!=0 ||
       (value.st_mode&0022) || (magic && (::fstatfs(fd,&fs) || fs.f_type!=magic)))return false;
    if(identity)*identity={uint64_t(value.st_dev),uint64_t(value.st_ino)};
    return true;
  }
  bool machine_() const {
    if constexpr(DataFilesystem!=0xef53)return fixture_machine_=="armv7l";
    struct utsname value{};
    return !::uname(&value) && !std::strcmp(value.machine,"armv7l");
  }
  long filesystem_(size_t i) const {return i<2?DataFilesystem:(i==2?ProcFilesystem:SysFilesystem);}
  int parent_(size_t i,DirectoryIdentity &identity) const {
    int fd=::fcntl(root_,F_DUPFD_CLOEXEC,3);std::string remaining(PATHS[i]);size_t slash;
    while(fd>=0 && (slash=remaining.find('/'))!=std::string::npos) {
      const auto component=remaining.substr(0,slash);remaining.erase(0,slash+1);
      // /sys/class/net/wlan0 contains kernel-created sysfs symlinks. Follow
      // only these FIXED sysfs ancestors, verify every resulting mount/owner,
      // then compare the final directory again through an independent walk.
      // Data/proc ancestors and all final files never follow a symlink.
      const int flags=i==3 && component!="sys"?(DIRECTORY_FLAGS&~O_NOFOLLOW):DIRECTORY_FLAGS;
      const int next=::openat(fd,component.c_str(),flags);
      DirectoryIdentity observed{};
      bool okay=directory_(next,filesystem_(i),&observed);
      if(component=="data")okay=okay && observed.device==data_identity_.device && observed.inode==data_identity_.inode;
      if(::close(fd))okay=false;
      if(!okay){if(next>=0)::close(next);return -1;}
      fd=next;
    }
    if(fd>=0 && !directory_(fd,filesystem_(i),&identity)){::close(fd);return -1;}
    return fd;
  }
  bool value_(size_t i,const std::string &text) const {
    if(i==0)return text=="CLEARGRASS_VERSION=4.1.8_0287\n";
    if(i==1){int type=0;return initial_co2_setting(text,type) && type==expected_.co2_type;}
    if(i==2)return text==expected_.boot_id+"\n";
    return text==expected_.wlan_mac+"\n";
  }
  bool file_(size_t i,bool capture) {
    DirectoryIdentity parent_id{},again_id{};const int parent=parent_(i,parent_id);
    if(parent<0)return false;
    const auto leaf=std::strrchr(PATHS[i],'/')+1;
    const int fd=::openat(parent,leaf,O_RDONLY|O_NONBLOCK|O_NOFOLLOW|O_NOATIME|O_CLOEXEC);
    struct stat before{},after{},named{};struct statfs fs{};
    bool okay=fd>=0 && !::fstat(fd,&before) && S_ISREG(before.st_mode) && before.st_uid==0 &&
      !(before.st_mode&0022) && before.st_nlink==1 && !::fstatfs(fd,&fs) && fs.f_type==filesystem_(i) &&
      (capture || (parent_id.device==parents_[i].device && parent_id.inode==parents_[i].inode && same_file(files_[i],before)));
    std::string text;const size_t limit=i==1?65536:256;char bytes[1024];
    while(okay) {
      const auto count=::read(fd,bytes,sizeof(bytes));
      if(count<0 && errno==EINTR)continue;
      if(count<0 || size_t(count)>limit-text.size()){okay=false;break;}
      if(!count)break;
      text.append(bytes,size_t(count));
    }
    okay=okay && value_(i,text) && !::fstat(fd,&after) && same_file(before,after) &&
      !::fstatat(parent,leaf,&named,AT_SYMLINK_NOFOLLOW) && same_file(after,named);
    const int again=okay?parent_(i,again_id):-1;
    okay=okay && again>=0 && parent_id.device==again_id.device && parent_id.inode==again_id.inode &&
      !::fstatat(again,leaf,&named,AT_SYMLINK_NOFOLLOW) && same_file(after,named);
    for(int owned:{again,fd,parent})if(owned>=0 && ::close(owned))okay=false;
    // The transient setting.ini string is never retained in the reader,
    // returned, logged, hashed into a public report or used as an error.
    if(okay && capture){parents_[i]=parent_id;files_[i]=after;}
    return okay;
  }
  bool open_(int root,const InitialDeviceIdentity &expected,const std::string &machine) {
    if(attempted_)return refuse_("identity_open_consumed_no_retry");
    attempted_=true;
    if(::getuid()!=0 || ::geteuid()!=0 || !expected.valid() || !directory_(root,0))
      return refuse_("exact_root_owned_device_identity_required");
    expected_=expected;fixture_machine_=machine;
    if(!machine_())return refuse_("identity_armv7_required");
    root_=::fcntl(root,F_DUPFD_CLOEXEC,3);
    const int data=::openat(root_,"data",DIRECTORY_FLAGS);
    bool okay=directory_(data,DataFilesystem,&data_identity_);
    if(data>=0 && ::close(data))okay=false;
    if(!okay)return refuse_("identity_fixed_ext4_data_required");
    for(size_t i=0;i<PATHS.size();++i)if(!file_(i,true))return refuse_("initial_device_identity_unverified");
    verified_=true;error_="";return current();
  }
};
using InitialDeviceReader=BasicInitialDeviceIdentity<>;
// Host USB/serial admission remains a separate fresh transport observation.
// This reader does not inspect stock/watchdog processes, grant a trial,
// reserve resources, change an INI, or touch a controller/UART/GPIO.
}  // namespace cgs1_initial_trial
#endif
