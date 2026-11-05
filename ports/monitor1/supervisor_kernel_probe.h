#pragma once
#if defined(__linux__)

// Bounded kernel capability probe, independent of ESPHome. Changes only its
// OWN forked descendants; no vendor PID, UART, display, GPIO, Wi-Fi, boot or
// configuration operation exists here. The executable is only read/hashed.
// Subreaper state is changed in a disposable worker, never in the caller.
#include "supervisor_image.h"
#include "supervisor_process_tree.h"
#include <poll.h>
#include <algorithm>
#include <array>

namespace cgs1_supervisor {
enum class ProbeCode : uint32_t {
  OK=0,ROOT_REQUIRED,REAPER_REQUIRED,PIPE_FAILED,FORK_FAILED,CHILD_UNVERIFIED,
  WORKER_TIMEOUT,WORKER_FAILED,INVALID_REPORT,SUBREAPER_FAILED,TREE_FAILED,IMAGE_FAILED
};
struct KernelProbeResult {
  uint32_t magic{0x43504b31},version{1},flags{0};ProbeCode code{ProbeCode::WORKER_FAILED};
  uint64_t bytes{0},hash_ms{0},running_verify_ms{0},elapsed_ms{0};Digest digest{};
  bool complete() const {return magic==0x43504b31 && version==1 && code==ProbeCode::OK && flags==31 && bytes>=52;}
};
static_assert(sizeof(KernelProbeResult)<=128,"Probe report must fit one atomic pipe write");

namespace kernel_probe_detail {
inline void close_except(int retained) {
  DIR *directory=::opendir("/proc/self/fd");if(!directory)::_exit(91);
  const int scan=::dirfd(directory);
  while(const auto *entry=::readdir(directory)) {
    char *end=nullptr;const long descriptor=std::strtol(entry->d_name,&end,10);
    if(end && !*end && descriptor>2 && descriptor!=retained && descriptor!=scan)::close(int(descriptor));
  }
  ::closedir(directory);
}
inline ProcessStamp await_stamp(pid_t pid) {
  const auto start=process_tree_clock_ms();
  while(process_tree_clock_ms()-start<300) {
    const auto stamp=process_stamp(pid);if(stamp.start)return stamp;::usleep(1000);
  }
  return {};
}
inline bool tree_probe(int report_fd,KernelProbeResult &result) {
  if(!prepare_backup_subreaper()){result.code=ProbeCode::SUBREAPER_FAILED;return false;}
  result.flags|=1;
  int birth[2];if(::pipe(birth)){result.code=ProbeCode::TREE_FAILED;return false;}
  const auto primary=::fork();
  if(primary<0){::close(birth[0]);::close(birth[1]);result.code=ProbeCode::TREE_FAILED;return false;}
  if(!primary) {
    ::close(report_fd);::close(birth[0]);::alarm(2);
    const auto native=::fork();if(native<0)::_exit(92);
    if(!native){::close(birth[1]);::alarm(2);for(;;)::pause();}
    const auto stamp=await_stamp(native);
    if(!stamp.start || ::write(birth[1],&stamp,sizeof(stamp))!=ssize_t(sizeof(stamp)))::_exit(93);
    ::close(birth[1]);for(;;)::pause();
  }
  ::close(birth[1]);OwnedChild primary_owner;
  if(!primary_owner.claim(await_stamp(primary))){::close(birth[0]);result.code=ProbeCode::TREE_FAILED;return false;}
  pollfd input{birth[0],POLLIN,0};ProcessStamp native;
  const bool read=::poll(&input,1,500)==1 && ::read(birth[0],&native,sizeof(native))==ssize_t(sizeof(native));
  ::close(birth[0]);
  if(!read || !native.start || native.parent!=primary){result.code=ProbeCode::TREE_FAILED;return false;}
  OwnedChild premature;
  if(premature.claim(native)){result.code=ProbeCode::TREE_FAILED;return false;}
  result.flags|=2;
  if(!primary_owner.kill_and_reap(700)){result.code=ProbeCode::TREE_FAILED;return false;}
  result.flags|=4;OwnedChild adopted;
  if(!adopted.claim(native) || !adopted.kill_and_reap(700)){result.code=ProbeCode::TREE_FAILED;return false;}
  result.flags|=8;return true;
}
inline KernelProbeResult worker(int report_fd,const char *directory,const ExecutableSpec &architecture,
                                const ProcessStamp &caller) {
  // Only the worker receives a deadline. Its two test descendants also have
  // their own two-second alarms if this worker disappears during a failure.
  // ESPHome installs INT/TERM handlers that may run application shutdown
  // hooks. A copied worker must never invoke those hooks or flush the
  // caller's preferences; all its exits use _exit or default fatal signals.
  for(int signal:{SIGINT,SIGTERM,SIGHUP,SIGALRM})
    if(::signal(signal,SIG_DFL)==SIG_ERR)::_exit(95);
  ::alarm(3);close_except(report_fd);
  KernelProbeResult result;const auto begin=process_tree_clock_ms();
  if(!tree_probe(report_fd,result))return result;
  ImageDirectory images;ImageFile image;const auto hashing=process_tree_clock_ms();
  if(!images.open_existing(directory,0) || !images.inspect(image,architecture)) {
    result.code=ProbeCode::IMAGE_FAILED;return result;
  }
  result.hash_ms=process_tree_clock_ms()-hashing;result.bytes=image.identity().bytes;result.digest=image.digest();
  const auto actual=process_stamp(caller.pid);struct stat executable{};const auto checking=process_tree_clock_ms();
  if(actual.start!=caller.start || actual.owner!=caller.owner ||
     ::stat(("/proc/"+std::to_string(caller.pid)+"/exe").c_str(),&executable) || !image.matches_executable(executable)) {
    result.code=ProbeCode::IMAGE_FAILED;return result;
  }
  result.running_verify_ms=process_tree_clock_ms()-checking;
  result.flags|=16;result.elapsed_ms=process_tree_clock_ms()-begin;result.code=ProbeCode::OK;return result;
}
}  // namespace kernel_probe_detail

inline KernelProbeResult run_kernel_probe(const char *private_directory,const ExecutableSpec &architecture={}) {
  KernelProbeResult result;
  if(::getuid()!=0 || ::geteuid()!=0){result.code=ProbeCode::ROOT_REQUIRED;return result;}
  if(!guardian_has_exclusive_reaper()){result.code=ProbeCode::REAPER_REQUIRED;return result;}
  const auto caller=process_stamp(::getpid());
  if(!caller.start){result.code=ProbeCode::CHILD_UNVERIFIED;return result;}
  int report[2];
  if(::pipe(report)){result.code=ProbeCode::PIPE_FAILED;return result;}
  // Caller/worker descriptors cannot leak into any future application exec.
  for(int fd:report)if(::fcntl(fd,F_SETFD,FD_CLOEXEC)) {
    ::close(report[0]);::close(report[1]);result.code=ProbeCode::PIPE_FAILED;return result;
  }
  const auto child=::fork();
  if(child<0){::close(report[0]);::close(report[1]);result.code=ProbeCode::FORK_FAILED;return result;}
  if(!child) {
    ::close(report[0]);const auto value=kernel_probe_detail::worker(report[1],private_directory,architecture,caller);
    const auto written=::write(report[1],&value,sizeof(value));::close(report[1]);
    ::_exit(written==ssize_t(sizeof(value))?0:94);
  }
  ::close(report[1]);OwnedChild owner;
  if(!owner.claim(kernel_probe_detail::await_stamp(child))) {
    ::close(report[0]);result.code=ProbeCode::CHILD_UNVERIFIED;return result;
  }
  // Synchronous, bounded call: an ESPHome action cannot concurrently start
  // OTA exec while this one-thread worker is still awaiting/reaping a child.
  const auto begin=process_tree_clock_ms();
  while(owner.poll()==ChildState::LIVE && process_tree_clock_ms()-begin<4000)::usleep(1000);
  if(owner.state()==ChildState::LIVE) {
    owner.kill_and_reap(700);::close(report[0]);result.code=ProbeCode::WORKER_TIMEOUT;return result;
  }
  if(owner.state()!=ChildState::REAPED || !WIFEXITED(owner.wait_status()) || WEXITSTATUS(owner.wait_status())!=0) {
    ::close(report[0]);result.code=ProbeCode::WORKER_FAILED;return result;
  }
  KernelProbeResult observed;
  const auto count=::read(report[0],&observed,sizeof(observed));char extra=0;
  const auto trailing=::read(report[0],&extra,1);::close(report[0]);
  if(count!=ssize_t(sizeof(observed)) || trailing || observed.magic!=result.magic || observed.version!=1 ||
     observed.flags>31 || observed.bytes>16*1024*1024 || observed.elapsed_ms>3000) {
    result.code=ProbeCode::INVALID_REPORT;return result;
  }
  return observed;
}
}  // namespace cgs1_supervisor
#endif  // __linux__: no capability or process actions in a macOS fixture
