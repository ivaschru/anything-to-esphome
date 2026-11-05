#pragma once
#if defined(__linux__)

// Linux 3.10 has no pidfd. A PID/start check followed by kill() alone still
// leaves a reuse race. Recovery therefore signals only an unreaped OWN child.
// The backup is a child subreaper: after terminating/reaping its own primary,
// it can adopt the native grandchild and obtain the same kernel ownership.
// This is a process primitive, not stock/PM ownership or executable approval.
#include <sys/prctl.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <signal.h>
#include <unistd.h>
#include <dirent.h>
#include <time.h>
#include <cerrno>
#include <cstdint>
#include <cstdlib>
#include <fstream>
#include <sstream>
#include <string>

namespace cgs1_supervisor {
struct ProcessStamp {pid_t pid{0},parent{0};uint64_t start{0};uid_t owner{0};char state{0};};
inline ProcessStamp process_stamp(pid_t pid) {
  if(pid<=1)return {};
  const auto root="/proc/"+std::to_string(pid);struct stat directory{};
  if(::stat(root.c_str(),&directory) || !S_ISDIR(directory.st_mode))return {};
  std::ifstream input(root+"/stat");std::string text;
  if(!std::getline(input,text) || text.size()>4096)return {};
  // comm may contain spaces and parentheses; fields begin after its LAST ).
  const auto end=text.rfind(')');if(end==std::string::npos)return {};
  std::istringstream fields(text.substr(end+1));ProcessStamp result;
  result.pid=pid;result.owner=directory.st_uid;std::string token;
  for(unsigned field=3;field<=22;++field) {
    if(!(fields>>token))return {};
    if(field==3) {if(token.size()!=1)return {};result.state=token[0];}
    if(field==4) {
      char *last=nullptr;errno=0;const long value=std::strtol(token.c_str(),&last,10);
      if(errno || !last || *last || value<0 || value>INT32_MAX)return {};
      result.parent=pid_t(value);
    }
    if(field==22) {
      char *last=nullptr;errno=0;const auto value=std::strtoull(token.c_str(),&last,10);
      if(errno || !last || *last || !value || token[0]=='-')return {};
      result.start=value;
    }
  }
  return result;
}
inline bool guardian_has_exclusive_reaper() {
  // The standalone guardian must not share waitpid with another thread,
  // handler, ignored SIGCHLD or SA_NOCLDWAIT. No handler is silently replaced.
  struct sigaction action{};
  if(::sigaction(SIGCHLD,nullptr,&action) || action.sa_handler!=SIG_DFL ||
     (action.sa_flags&SA_NOCLDWAIT))return false;
  DIR *tasks=::opendir("/proc/self/task");if(!tasks)return false;
  unsigned count=0;
  while(const auto *entry=::readdir(tasks))if(entry->d_name[0]!='.')++count;
  ::closedir(tasks);return count==1;
}
inline bool prepare_backup_subreaper() {
  if(::getpid()<=1 || !guardian_has_exclusive_reaper() || ::prctl(PR_SET_CHILD_SUBREAPER,1))return false;
  int enabled=0;return !::prctl(PR_GET_CHILD_SUBREAPER,&enabled) && enabled==1;
}
inline uint64_t process_tree_clock_ms() {
  timespec now{};if(::clock_gettime(CLOCK_MONOTONIC,&now))return 0;
  return uint64_t(now.tv_sec)*1000+uint64_t(now.tv_nsec/1000000);
}
enum class ChildState {UNCLAIMED,LIVE,REAPED,REFUSED};
class OwnedChild {
 public:
  bool claim(const ProcessStamp &expected) {
    if(attempted_)return false;
    attempted_=true;
    if(!guardian_has_exclusive_reaper() || expected.pid<=1 || !expected.start)return refused_();
    const auto actual=process_stamp(expected.pid);
    if(actual.pid!=expected.pid || actual.start!=expected.start || actual.owner!=expected.owner ||
       actual.parent!=::getpid())return refused_();
    stamp_=actual;state_=ChildState::LIVE;
    return poll()!=ChildState::REFUSED;
  }
  ChildState state() const {return state_;}
  int wait_status() const {return status_;}
  const ProcessStamp &stamp() const {return stamp_;}
  ChildState poll() {
    if(state_!=ChildState::LIVE)return state_;
    if(!guardian_has_exclusive_reaper()){refused_();return state_;}
    const auto waited=::waitpid(stamp_.pid,&status_,WNOHANG);
    if(waited==stamp_.pid){state_=ChildState::REAPED;return state_;}
    if(waited<0 && errno==EINTR)return state_;
    if(waited!=0){refused_();return state_;}
    const auto actual=process_stamp(stamp_.pid);
    if(actual.start!=stamp_.start || actual.owner!=stamp_.owner || actual.parent!=::getpid())refused_();
    return state_;
  }
  bool kill_and_reap(uint64_t timeout_ms) {
    if(!timeout_ms || timeout_ms>30000)return false;
    if(poll()==ChildState::REAPED)return true;
    if(state_!=ChildState::LIVE)return false;
    // Between this waitpid and kill, an exited child remains OUR zombie.
    // It cannot be reused until this sole reaper waits for it. Never signal
    // a grandchild, a PID loaded from disk, a negative PID or a process group.
    if(::kill(stamp_.pid,SIGKILL) && errno!=ESRCH)return refused_();
    const auto start=process_tree_clock_ms();if(!start)return false;
    while(true) {
      const auto now=process_tree_clock_ms();
      if(!now || now<start || now-start>=timeout_ms)break;
      if(poll()==ChildState::REAPED)return true;
      if(state_!=ChildState::LIVE)return false;
      ::usleep(1000);
    }
    // D-state or another unresolved wait is not proof of death. Hardware
    // recovery MUST NOT resume a competing reader after this false result.
    return false;
  }
 private:
  ProcessStamp stamp_;ChildState state_{ChildState::UNCLAIMED};bool attempted_{false};int status_{0};
  bool refused_(){state_=ChildState::REFUSED;return false;}
};
}  // namespace cgs1_supervisor
#endif  // __linux__: macOS metadata fixtures have no process-tree backend
