#pragma once

// Read-only stock-session evidence before an initial bridge trial. The pure
// parsers do not export cmdline/maps. The Linux collector never signals,
// adopts or starts a process and cannot authorize a trial by itself.
#include <cstdint>
#include <limits>
#include <sstream>
#include <string>

namespace cgs1_initial_trial {
inline bool stock_unsigned(const std::string &text,uint64_t maximum,uint64_t &result,unsigned base=10) {
  result=0;if(text.empty() || (base!=10 && base!=16))return false;
  for(const auto c:text) {
    unsigned digit=base;
    if(c>='0' && c<='9')digit=unsigned(c-'0');
    else if(base==16 && c>='a' && c<='f')digit=unsigned(c-'a'+10);
    else if(base==16 && c>='A' && c<='F')digit=unsigned(c-'A'+10);
    if(digit>=base || digit>maximum || result>(maximum-digit)/base)return false;
    result=result*base+digit;
  }
  return true;
}
struct InitialProcessIdentity {
  uint32_t pid{0},parent{0};uint64_t start{0},flags{0};char state{0};
  bool alive() const {return state=='R' || state=='S' || state=='D' || state=='I';}
};
inline bool initial_owned_program_path(const std::string &path) {
  if(path.rfind("/data/.esphome-cgs1/",0)==0)return true;
  // Match the host initial-review scanner's known RAM release families as
  // well as NAND. A suffix such as " (deleted)" cannot turn an old program
  // into absence. An unrelated /tmp basename is not silently adopted.
  for(const auto *prefix:{"/tmp/qingping-full-","/tmp/qingping-initial-"})
    if(path.rfind(prefix,0)==0 && path.find('/',std::char_traits<char>::length(prefix))!=std::string::npos)return true;
  return false;
}
inline bool initial_process_stat(const std::string &text,uint32_t pid,InitialProcessIdentity &result) {
  result={};
  if(!pid || pid>INT32_MAX || text.empty() || text.size()>8192 || text.back()!='\n' ||
     text.find('\0')!=std::string::npos)return false;
  const auto left=text.find('('),right=text.rfind(") ");
  if(left==std::string::npos || !left || right==std::string::npos || right<=left ||
     text.substr(0,left)!=std::to_string(pid)+" ")return false;
  std::istringstream fields(text.substr(right+2));std::string token;
  InitialProcessIdentity parsed;parsed.pid=pid;uint64_t value=0;
  for(unsigned field=3;field<=22;++field) {
    if(!(fields>>token))return false;
    if(field==3) {
      if(token.size()!=1 || std::string("RSDZTtXxKWPI").find(token[0])==std::string::npos)return false;
      parsed.state=token[0];
    }
    if(field==4) {if(!stock_unsigned(token,INT32_MAX,value))return false;parsed.parent=uint32_t(value);}
    if(field==9) {if(!stock_unsigned(token,UINT64_MAX,value))return false;parsed.flags=value;}
    if(field==22) {if(!stock_unsigned(token,UINT64_MAX,value) || !value)return false;parsed.start=value;}
  }
  result=parsed;return true;
}
inline bool initial_watchdog_command(const std::string &text) {
  static constexpr char expected[]="/bin/sh\0/data/bin/watchdog.sh\0";
  // Include the final argv NUL, exclude only the extra C literal terminator.
  // No shell parsing, prefix match or whitespace normalization is allowed.
  return text==std::string(expected,sizeof(expected)-1);
}
inline bool initial_stock_maps(const std::string &text) {
  if(text.empty() || text.size()>1048576 || text.back()!='\n' ||
     text.find('\0')!=std::string::npos)return false;
  std::istringstream input(text);std::string line;unsigned count=0;
  while(std::getline(input,line)) {
    if(line.empty() || line.size()>4096 || ++count>4096)return false;
    std::istringstream fields(line);std::string range,permissions,offset,device,inode;
    if(!(fields>>range>>permissions>>offset>>device>>inode))return false;
    const auto dash=range.find('-'),colon=device.find(':');uint64_t first=0,last=0,value=0;
    if(dash==std::string::npos || colon==std::string::npos ||
       range.find('-',dash+1)!=std::string::npos || device.find(':',colon+1)!=std::string::npos ||
       !stock_unsigned(range.substr(0,dash),UINT64_MAX,first,16) ||
       !stock_unsigned(range.substr(dash+1),UINT64_MAX,last,16) || first>=last ||
       permissions.size()!=4 || (permissions[0]!='r' && permissions[0]!='-') ||
       (permissions[1]!='w' && permissions[1]!='-') || (permissions[2]!='x' && permissions[2]!='-') ||
       (permissions[3]!='p' && permissions[3]!='s') ||
       !stock_unsigned(offset,UINT64_MAX,value,16) ||
       !stock_unsigned(device.substr(0,colon),UINT32_MAX,value,16) ||
       !stock_unsigned(device.substr(colon+1),UINT32_MAX,value,16) ||
       !stock_unsigned(inode,UINT64_MAX,value))return false;
    // Reject ANY mapping from the own installation root, including deleted
    // extensions. Unknown/malformed maps are not evidence that PM is absent.
    std::string path;std::getline(fields,path);const auto first_path=path.find_first_not_of(" \t");
    if(first_path!=std::string::npos && initial_owned_program_path(path.substr(first_path)))return false;
  }
  return count!=0;
}
struct InitialStockIdentity {
  uint32_t stock_pid{0},watchdog_pid{0};uint64_t stock_start{0},watchdog_start{0};
  bool valid() const {
    return stock_pid>1 && stock_pid<=INT32_MAX && watchdog_pid>1 && watchdog_pid<=INT32_MAX &&
      stock_pid!=watchdog_pid && stock_start && watchdog_start;
  }
};
}  // namespace cgs1_initial_trial

#if defined(__linux__)
#include "initial_trial_vendor.h"
#include "initial_trial_self.h"
#include "supervisor_process_tree.h"
#include <sys/statvfs.h>

namespace cgs1_initial_trial {
template<long ProcFilesystem=0x9fa0,long DataFilesystem=0xef53> class BasicInitialStockSession {
 public:
  // A synthetic procfs type may join only the explicit native fixture type.
  // The production reader cannot receive that fixture or a serialized PID.
  using SelfReader=BasicInitialGuardianSelf<ProcFilesystem!=0x9fa0>;
  BasicInitialStockSession()=default;
  BasicInitialStockSession(const BasicInitialStockSession &)=delete;
  BasicInitialStockSession &operator=(const BasicInitialStockSession &)=delete;
  ~BasicInitialStockSession(){for(int fd:{proc_,stock_,watchdog_})if(fd>=0)::close(fd);}
  const char *error() const{return error_;}
  bool open(const InitialStockIdentity &expected,BasicInitialVendorFiles<DataFilesystem> &vendor,SelfReader *self=nullptr) {
    const int proc=::open("/proc",DIRECTORY_FLAGS);
    // /bin and BusyBox are on the stock read-only root, not the writable
    // staging directory. Require that actual mount flag, never chmod/repair.
    const int bin=::open("/bin",DIRECTORY_FLAGS);
    const int watchdog=bin>=0?::openat(bin,"busybox",FILE_FLAGS):-1;
    struct stat directory{};struct statvfs mount{};
    const bool readonly=bin>=0 && !::fstat(bin,&directory) && S_ISDIR(directory.st_mode) &&
      directory.st_uid==0 && !(directory.st_mode&0022) && watchdog>=0 &&
      !::fstatvfs(watchdog,&mount) && (mount.f_flag&ST_RDONLY);
    const bool okay=open_(proc,watchdog,expected,vendor,"/data/bin/SnowApp","/bin/busybox",readonly,self);
    bool closed=true;for(int fd:{watchdog,bin,proc})if(fd>=0 && ::close(fd))closed=false;
    return closed?okay:refuse_("stock_open_close_uncertain");
  }
  template<long Magic=ProcFilesystem,std::enable_if_t<Magic!=0x9fa0 && Magic==ProcFilesystem,int> =0>
  bool open_fixture_root(int proc,int watchdog,const InitialStockIdentity &expected,
      BasicInitialVendorFiles<DataFilesystem> &vendor,const std::string &stock_path,const std::string &watchdog_path,
      SelfReader *self=nullptr) {
    // Only this compile-time non-procfs type can observe a synthetic /proc,
    // fake exe links and a writable mock root. No production path override.
    return open_(proc,watchdog,expected,vendor,stock_path,watchdog_path,true,self);
  }
  bool current() {
    if(!verified_)return false;
    DirectoryIdentity root{};struct stat anchor{},stock{},watchdog{};
    if((self_ && !self_->current()) || !directory_(proc_,&root) || root.device!=proc_identity_.device || root.inode!=proc_identity_.inode ||
       ::fstat(proc_,&anchor) || anchor.st_uid!=0 || (anchor.st_mode&0022) ||
       !proc_named_current_() || !watchdog_named_current_() ||
       !vendor_->current() || ::fstat(stock_,&stock) || !same_file(stock_file_,stock) ||
       ::fstat(watchdog_,&watchdog) || !same_file(watchdog_file_,watchdog))return refuse_("stock_anchor_or_vendor_changed");
    const auto started=cgs1_supervisor::process_tree_clock_ms();
    if(!started || !scan_() || !selected_(expected_.watchdog_pid,expected_.watchdog_start,false) ||
       !selected_(expected_.stock_pid,expected_.stock_start,true) || !scan_() ||
       !vendor_->current() || !watchdog_named_current_() || !proc_named_current_() ||
       (self_ && !self_->current()))return refuse_("stock_session_incomplete_or_changed");
    const auto finished=cgs1_supervisor::process_tree_clock_ms();
    // Freshness only, measured after IO returns. This is not a hard syscall
    // timeout and must not block a future guardian's independent deadline loop.
    if(!finished || finished<started || finished-started>1000)return refuse_("stock_observation_stale");
    observed_at_ms_=finished;return true;
  }
  uint64_t observed_at_ms() const{return verified_?observed_at_ms_:0;}
 private:
  inline static constexpr int DIRECTORY_FLAGS=O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_NOATIME|O_CLOEXEC;
  inline static constexpr int FILE_FLAGS=O_RDONLY|O_NONBLOCK|O_NOFOLLOW|O_NOATIME|O_CLOEXEC;
  int proc_{-1},stock_{-1},watchdog_{-1};bool attempted_{false},verified_{false};
  BasicInitialVendorFiles<DataFilesystem> *vendor_{nullptr};
  SelfReader *self_{nullptr}; // Actual live reader must outlive this session.
  DirectoryIdentity proc_identity_{};InitialStockIdentity expected_{};
  struct stat stock_file_{},watchdog_file_{};
  std::string stock_path_,watchdog_path_;const char *error_{"unobserved"};uint64_t observed_at_ms_{0};
  bool refuse_(const char *reason){verified_=false;observed_at_ms_=0;error_=reason;return false;}
  bool proc_named_current_() const {
    if constexpr(ProcFilesystem!=0x9fa0)return true; // The fixture's explicit fd is not a named /proc proof.
    const int fd=::open("/proc",DIRECTORY_FLAGS);DirectoryIdentity actual{};
    bool okay=directory_(fd,&actual) && actual.device==proc_identity_.device && actual.inode==proc_identity_.inode;
    if(fd>=0 && ::close(fd))okay=false;
    return okay;
  }
  bool watchdog_named_current_() const {
    int parent=-1,fd=-1;bool okay=true;
    if constexpr(ProcFilesystem==0x9fa0) {
      parent=::open("/bin",DIRECTORY_FLAGS);struct stat directory{};
      okay=parent>=0 && !::fstat(parent,&directory) && S_ISDIR(directory.st_mode) &&
        directory.st_uid==0 && !(directory.st_mode&0022);
      if(okay)fd=::openat(parent,"busybox",FILE_FLAGS);
    } else fd=::open(watchdog_path_.c_str(),FILE_FLAGS);
    struct stat actual{};
    okay=okay && fd>=0 && !::fstat(fd,&actual) && same_file(watchdog_file_,actual);
    if constexpr(ProcFilesystem==0x9fa0) {
      struct statvfs mount{};okay=okay && !::fstatvfs(fd,&mount) && (mount.f_flag&ST_RDONLY);
    }
    for(int owned:{fd,parent})if(owned>=0 && ::close(owned))okay=false;
    return okay;
  }
  static bool directory_(int fd,DirectoryIdentity *identity=nullptr) {
    struct stat value{};struct statfs fs{};
    if(fd<0 || ::fstat(fd,&value) || !S_ISDIR(value.st_mode) || (value.st_mode&0022) || ::fstatfs(fd,&fs) ||
       fs.f_type!=ProcFilesystem)return false;
    if(identity)*identity={uint64_t(value.st_dev),uint64_t(value.st_ino)};
    return true;
  }
  static bool read_(int directory,const char *name,size_t limit,std::string &text) {
    text.clear();const int fd=::openat(directory,name,FILE_FLAGS);struct stat before{},after{},parent{},named{};struct statfs fs{};
    bool okay=fd>=0 && !::fstat(fd,&before) && S_ISREG(before.st_mode) &&
      !::fstat(directory,&parent) && before.st_uid==parent.st_uid && !(before.st_mode&0022) &&
      !::fstatfs(fd,&fs) && fs.f_type==ProcFilesystem;
    char bytes[1024];
    while(okay) {
      const auto count=::read(fd,bytes,sizeof(bytes));
      if(count<0 && errno==EINTR)continue;
      if(count<0 || size_t(count)>limit-text.size()){okay=false;break;}
      if(!count)break;
      text.append(bytes,size_t(count));
    }
    okay=okay && !::fstat(fd,&after) && before.st_dev==after.st_dev && before.st_ino==after.st_ino &&
      before.st_uid==after.st_uid && before.st_mode==after.st_mode &&
      !::fstatat(directory,name,&named,AT_SYMLINK_NOFOLLOW) && named.st_ino==after.st_ino &&
      named.st_dev==after.st_dev && named.st_uid==after.st_uid && named.st_mode==after.st_mode;
    if(fd>=0 && ::close(fd))okay=false;
    if(!okay)text.clear();return okay;
  }
  static bool stamp_(int directory,uint32_t pid,InitialProcessIdentity &stamp) {
    std::string text;return read_(directory,"stat",8192,text) && initial_process_stat(text,pid,stamp);
  }
  static bool same_stamp_(const InitialProcessIdentity &a,const InitialProcessIdentity &b) {
    return a.pid==b.pid && a.parent==b.parent && a.start==b.start && a.flags==b.flags;
  }
  static bool link_(int directory,std::string &text) {
    char bytes[4096];const auto size=::readlinkat(directory,"exe",bytes,sizeof(bytes));
    if(size<=0 || size>=ssize_t(sizeof(bytes)))return false;
    text.assign(bytes,size_t(size));return text.find('\0')==std::string::npos;
  }
  bool disappeared_(const char *pid) const {
    struct stat value{};errno=0;
    return ::fstatat(proc_,pid,&value,AT_SYMLINK_NOFOLLOW)<0 && errno==ENOENT;
  }
  bool scan_() {
    const int fd=::openat(proc_,".",DIRECTORY_FLAGS);
    DIR *directory=fd>=0?::fdopendir(fd):nullptr;
    if(!directory){if(fd>=0)::close(fd);return false;}
    bool okay=true;unsigned count=0,stocks=0,guardians=0;
    while(okay) {
      errno=0;const auto *entry=::readdir(directory);
      if(!entry){okay=errno==0;break;}
      const std::string name(entry->d_name);
      if(name.empty() || name.find_first_not_of("0123456789")!=std::string::npos)continue;
      uint64_t pid=0;
      if(++count>4096 || !stock_unsigned(name,INT32_MAX,pid) || !pid || name!=std::to_string(pid)){okay=false;break;}
      const int task=::openat(proc_,name.c_str(),DIRECTORY_FLAGS);
      if(task<0){okay=disappeared_(name.c_str());continue;}
      InitialProcessIdentity before{},after{};std::string executable;
      bool observed=directory_(task) && stamp_(task,uint32_t(pid),before);
      if(!observed)okay=disappeared_(name.c_str());
      else if(!link_(task,executable)) {
        // Linux v3.10 PF_KTHREAD=0x00200000. Only a positively observed
        // kernel thread/zombie/exited task (or a now-absent named PID) can
        // lack exe. Permission/IO failure on a live userspace task refuses.
        okay=before.state=='Z' || before.state=='X' || before.state=='x' ||
          (before.flags&0x00200000) || disappeared_(name.c_str());
      } else {
        if(initial_owned_program_path(executable)) {
          // The only pre-start own process allowed is the actual caller with
          // a live named-image reader. PID/start text alone cannot permit it;
          // open this task's kernel image and join its inode to real self.
          const int image=self_ && pid==uint64_t(::getpid()) && before.alive()?
            ::openat(task,"exe",O_RDONLY|O_NONBLOCK|O_NOATIME|O_CLOEXEC):-1;
          okay=image>=0 && self_->matches_actual_process(uint32_t(pid),before.start,image) && ++guardians==1;
          if(image>=0 && ::close(image))okay=false;
        }
        if(executable==stock_path_)okay=okay && ++stocks==1 && pid==expected_.stock_pid &&
          before.start==expected_.stock_start && before.parent==expected_.watchdog_pid && before.alive();
        okay=okay && stamp_(task,uint32_t(pid),after) && same_stamp_(before,after);
      }
      if(::close(task))okay=false;
    }
    if(::closedir(directory))okay=false;
    return okay && stocks==1 && (!self_ || guardians==1);
  }
  bool selected_(uint32_t pid,uint64_t start,bool stock) {
    const auto name=std::to_string(pid);const int task=::openat(proc_,name.c_str(),DIRECTORY_FLAGS);
    struct stat directory{},exe{},after_exe{},named{};InitialProcessIdentity before{},after{};
    std::string text,link;const auto &expected_file=stock?stock_file_:watchdog_file_;
    bool okay=task>=0 && directory_(task) && !::fstat(task,&directory) && directory.st_uid==0 &&
      stamp_(task,pid,before) && before.alive() && before.start==start &&
      !(before.flags&0x00200000) && (stock?before.parent==expected_.watchdog_pid:before.parent>=1) &&
      link_(task,link) && link==(stock?stock_path_:watchdog_path_);
    // /proc/PID/exe is a kernel magic link, intentionally followed only for
    // this already selected task. Compare the actual opened image inode to
    // the admitted named SnowApp or fixed read-only BusyBox file.
    const int image=okay?::openat(task,"exe",O_RDONLY|O_NONBLOCK|O_NOATIME|O_CLOEXEC):-1;
    okay=okay && image>=0 && !::fstat(image,&exe) && same_file(expected_file,exe);
    if(stock)okay=okay && read_(task,"maps",1048576,text) && initial_stock_maps(text);
    else okay=okay && read_(task,"cmdline",256,text) && initial_watchdog_command(text);
    okay=okay && stamp_(task,pid,after) && after.alive() && same_stamp_(before,after) &&
      link_(task,text) && text==link && !::fstat(image,&after_exe) && same_file(exe,after_exe) &&
      !::fstatat(proc_,name.c_str(),&named,AT_SYMLINK_NOFOLLOW) &&
      directory.st_dev==named.st_dev && directory.st_ino==named.st_ino && named.st_uid==0;
    for(int owned:{image,task})if(owned>=0 && ::close(owned))okay=false;
    return okay;
  }
  bool open_(int proc,int watchdog,const InitialStockIdentity &expected,
      BasicInitialVendorFiles<DataFilesystem> &vendor,const std::string &stock_path,
      const std::string &watchdog_path,bool readonly,SelfReader *self) {
    if(attempted_)return refuse_("stock_open_consumed_no_retry");
    attempted_=true;struct stat root{};
    if(::getuid()!=0 || ::geteuid()!=0 || !expected.valid() || !readonly ||
       (self && (!self->current() || expected.stock_pid==uint32_t(::getpid()) || expected.watchdog_pid==uint32_t(::getpid()))) ||
       !directory_(proc,&proc_identity_) || ::fstat(proc,&root) || root.st_uid!=0 || (root.st_mode&0022))
      return refuse_("fixed_root_owned_procfs_and_readonly_watchdog_required");
    proc_=::fcntl(proc,F_DUPFD_CLOEXEC,3);stock_=vendor.duplicate_verified_stock_read_fd();
    watchdog_=::fcntl(watchdog,F_DUPFD_CLOEXEC,3);
    if(proc_<0 || stock_<0 || watchdog_<0 || (::fcntl(watchdog_,F_GETFL)&O_ACCMODE)!=O_RDONLY ||
       ::fstat(stock_,&stock_file_) || ::fstat(watchdog_,&watchdog_file_) ||
       !S_ISREG(watchdog_file_.st_mode) || watchdog_file_.st_uid!=0 ||
       (watchdog_file_.st_mode&0022) || !watchdog_file_.st_size)return refuse_("admitted_stock_and_watchdog_files_required");
    expected_=expected;vendor_=&vendor;self_=self;stock_path_=stock_path;watchdog_path_=watchdog_path;
    verified_=true;error_="";return current();
  }
};
using InitialStockSession=BasicInitialStockSession<>;
// Pre-start only: default refuses every own installation process. An explicit
// live self-reader admits only its actual caller, never its future child.
// Running checks must admit only an independently held kernel child; never
// whitelist a PID supplied by a report. USB/device/file/intent/RAM/endpoint
// admission and an independent deadline loop remain separate requirements.
}  // namespace cgs1_initial_trial
#endif
