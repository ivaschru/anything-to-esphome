#pragma once
#if defined(__linux__)

// Child-entry building block for a FUTURE standalone first-trial guardian.
// This is not a launcher, CLI, durable intent or full device-scope collector.
// prepare() returns only an inert entry: the parent must independently join
// the live stock/flags/boot/plan scope, consume its host+device intent and use
// OneShotChild exactly once. Nothing in this file creates that authority.
#include "initial_trial_admission.h"
#include "initial_trial_child.h"
#include <sys/sysmacros.h>
#include <vector>
#include <climits>

namespace cgs1_initial_trial {
namespace detail {
inline bool protected_exec_child(const cgs1_supervisor::ProcessStamp &parent) {
  if(::getuid()!=0 || ::geteuid()!=0 || parent.pid<=1 || !parent.start ||
     parent.owner!=0 || ::getppid()!=parent.pid || ::getpid()==parent.pid)return false;
  const auto actual=cgs1_supervisor::process_stamp(parent.pid);
  if(actual.pid!=parent.pid || actual.start!=parent.start || actual.owner!=0 ||
     actual.state=='Z' || actual.state=='X')return false;
  int death=0;struct sigaction term{};sigset_t blocked;
  if(::prctl(PR_GET_PDEATHSIG,&death) || death!=SIGTERM ||
     ::prctl(PR_GET_NO_NEW_PRIVS,0L,0L,0L,0L)!=1 ||
     ::sigaction(SIGTERM,nullptr,&term) || term.sa_handler!=SIG_DFL ||
     ::sigprocmask(SIG_SETMASK,nullptr,&blocked) || ::sigismember(&blocked,SIGTERM)!=0)return false;
  const int fd=::open("/proc/self/oom_score_adj",O_RDONLY|O_NOFOLLOW|O_CLOEXEC);
  if(fd<0)return false;
  char bytes[16]{};const auto size=::read(fd,bytes,sizeof(bytes));::close(fd);
  return size==5 && !std::memcmp(bytes,"1000\n",5) && ::getppid()==parent.pid;
}

inline bool close_inherited_fds(int executable) {
  // Linux 3.10 has neither close_range nor pidfd. Enumerate this single-threaded
  // fork child only; never scan another process or close a guardian's handles.
  // The bounded complete snapshot must succeed before any descriptor is closed.
  DIR *directory=::opendir("/proc/self/fd");if(!directory)return false;
  const int scan=::dirfd(directory);std::vector<int> descriptors;bool valid=scan>=0;
  errno=0;
  while(const auto *entry=::readdir(directory)) {
    if(!std::strcmp(entry->d_name,".") || !std::strcmp(entry->d_name,".."))continue;
    char *end=nullptr;errno=0;const auto fd=std::strtol(entry->d_name,&end,10);
    if(errno || !end || *end || fd<0 || fd>INT_MAX || descriptors.size()>=4096){valid=false;break;}
    if(fd>2 && fd!=executable && fd!=scan)descriptors.push_back(int(fd));
    errno=0;
  }
  valid=valid && errno==0;
  if(::closedir(directory))valid=false;
  if(!valid)return false;
  // A close error, including EINTR, is uncertain: do not retry a possibly
  // recycled number and do not exec with a partly unknown descriptor table.
  for(const auto fd:descriptors)if(::close(fd))return false;
  return true;
}

inline int exec_initial_fds(int executable,int ram,const DirectoryIdentity &identity,
                            const cgs1_supervisor::ProcessStamp &parent) {
  // Internal effectful primitive, exercised only with the fixture's own ELF
  // on CI. Production callers enter through BasicInitialBridgeEntry below,
  // which rechecks the separately admitted ARM image and empty RAM directory.
  // There is no caller-supplied argv, env, loader path, cwd path or shell.
  if(executable<3 || ram<3 || executable==ram || !protected_exec_child(parent) ||
     (::fcntl(executable,F_GETFL)&O_ACCMODE)!=O_RDONLY ||
     ::fcntl(executable,F_GETFD)!=FD_CLOEXEC || !private_directory(ram,identity))return 125;
  struct stat image{};unsigned char magic[4]{};
  if(::fstat(executable,&image) || !S_ISREG(image.st_mode) || image.st_uid!=0 ||
     (image.st_mode&07777)!=0700 || image.st_nlink!=1 ||
     ::pread(executable,magic,4,0)!=4 || std::memcmp(magic,"\177ELF",4) ||
     !no_reported_file_capability(executable) || ::fchdir(ram))return 125;
  // Discard transport pipes, logs, terminals and credentials before exec.
  // /dev/null must be the kernel character device, not a symlink/replaced file.
  int nullfd=::open("/dev/null",O_RDWR|O_CLOEXEC|O_NOFOLLOW);struct stat sink{};
  if(nullfd<0 || ::fstat(nullfd,&sink) || !S_ISCHR(sink.st_mode) ||
     sink.st_rdev!=::makedev(1,3))return 125;
  if(nullfd<3){const auto copy=::fcntl(nullfd,F_DUPFD_CLOEXEC,3);::close(nullfd);nullfd=copy;}
  if(nullfd<3)return 125;
  for(int fd=0;fd<3;++fd)if(::dup2(nullfd,fd)!=fd)return 125;
  if(!close_inherited_fds(executable) || !protected_exec_child(parent))return 125;
  char name[]="cgs1-initial-bridge",preferences[]="ESPHOME_PREFDIR=./prefs";
  char language[]="LANG=C",locale[]="LC_ALL=C";
  char *arguments[]={name,nullptr},*environment[]={preferences,language,locale,nullptr};
  // glibc 2.23 implements this via /proc; the read fd stays open until exec,
  // then CLOEXEC removes it. A failure returns to _exit(125), never a shell,
  // named-path fallback, second exec attempt or automatic retry.
  ::fexecve(executable,arguments,environment);return 125;
}
}  // namespace detail

template<long FilesystemMagic=0xef53> class BasicInitialBridgeEntry {
 public:
  BasicInitialBridgeEntry()=default;
  BasicInitialBridgeEntry(const BasicInitialBridgeEntry &)=delete;
  BasicInitialBridgeEntry &operator=(const BasicInitialBridgeEntry &)=delete;
  ~BasicInitialBridgeEntry(){if(image_fd_>=0)::close(image_fd_);if(ram_fd_>=0)::close(ram_fd_);}
  bool prepare(BasicInitialBridgeImage<FilesystemMagic> &image,InitialRamDirectory &ram) {
    if(attempted_){ready_=false;return false;}
    attempted_=true;parent_=cgs1_supervisor::process_stamp(::getpid());
    if(::getuid()!=0 || ::geteuid()!=0 || parent_.pid<=1 || !parent_.start ||
       parent_.owner!=0 || !cgs1_supervisor::guardian_has_exclusive_reaper())return false;
    image_=&image;ram_=&ram;
    image_fd_=image.duplicate_verified_read_fd();ram_fd_=ram.duplicate_verified_read_fd();
    struct stat directory{};
    if(image_fd_<3 || ram_fd_<3 || ::fstat(ram_fd_,&directory))return false;
    identity_={uint64_t(directory.st_dev),uint64_t(directory.st_ino)};
    ready_=image.current() && ram.current();return ready_;
  }
  static int child_entry(void *context) {
    if(!context)return 125;
    auto &entry=*static_cast<BasicInitialBridgeEntry *>(context);
    const bool ready=entry.ready_;entry.ready_=false;
    // A normal parent call is refused before fchdir/dup2/close. The image/RAM
    // readers must outlive this entry, and the caller must join the full named
    // stock/flags/boot scope before releasing OneShotChild's preparation gate.
    if(!ready || !detail::protected_exec_child(entry.parent_) ||
       !entry.image_->current() || !entry.ram_->current())return 125;
    return detail::exec_initial_fds(entry.image_fd_,entry.ram_fd_,entry.identity_,entry.parent_);
  }
 private:
  BasicInitialBridgeImage<FilesystemMagic> *image_{nullptr};InitialRamDirectory *ram_{nullptr};
  int image_fd_{-1},ram_fd_{-1};DirectoryIdentity identity_{};
  cgs1_supervisor::ProcessStamp parent_{};bool attempted_{false},ready_{false};
};
using InitialBridgeEntry=BasicInitialBridgeEntry<>;
// These references/fds and a source-level entry are not a transferable plan
// or fork authorization. No runtime filesystem/architecture override exists.
}  // namespace cgs1_initial_trial
#endif
