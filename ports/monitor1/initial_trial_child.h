#pragma once
#if defined(__linux__)

// Kernel-child primitive for a FUTURE standalone first-trial guardian. There
// is deliberately no CLI, path-based exec, PID adoption, device admission or
// production integration here. A caller must first validate the exact plan,
// ELF fd/SHA, stock scope, private RAM/env and durable single-use intent.
// The entry callback must exec that admitted ELF or return; it is not a shell.
// It must not change credentials or exec set-id/file-capability binaries:
// Linux clears PDEATHSIG for those transitions. This primitive does not
// implement ELF/xattr admission or prove protections survive arbitrary entry.
//
// Linux 3.10 has no pidfd. Reuse the existing exclusive-reaper primitive so a
// dead child remains our unreaped zombie until waitpid; its PID cannot be
// recycled between an ownership check and our signal. Never signal a group.
#include "supervisor_process_tree.h"
#include <sys/socket.h>
#include <fcntl.h>
#include <cstring>

namespace cgs1_initial_trial {
using cgs1_supervisor::ChildState;

inline bool protect_current_child(pid_t expected_parent) {
  // Only the new child writes its own OOM preference. Never protect the
  // experimental process at the expense of stock by changing another PID.
  // +1000 is a preference, not an OOM isolation or memory-cap guarantee.
  if(expected_parent<=1 || ::getppid()!=expected_parent)return false;
  struct sigaction normal{};normal.sa_handler=SIG_DFL;::sigemptyset(&normal.sa_mask);
  sigset_t term;::sigemptyset(&term);::sigaddset(&term,SIGTERM);
  if(::sigaction(SIGTERM,&normal,nullptr) || ::sigprocmask(SIG_UNBLOCK,&term,nullptr) ||
     ::prctl(PR_SET_PDEATHSIG,SIGTERM))return false;
  // Plain root exec can otherwise regain privileges not effective in the
  // caller. NNP is supported since Linux 3.5 and is set ONLY in this child;
  // it prevents exec privilege gains without changing the guardian/stock.
  // It is not a sandbox or permission to change credentials after exec.
  if(::prctl(PR_SET_NO_NEW_PRIVS,1L,0L,0L,0L) ||
     ::prctl(PR_GET_NO_NEW_PRIVS,0L,0L,0L,0L)!=1)return false;
  int signal=0;
  if(::prctl(PR_GET_PDEATHSIG,&signal) || signal!=SIGTERM)return false;
  int fd=::open("/proc/self/oom_score_adj",O_WRONLY|O_CLOEXEC|O_NOFOLLOW);
  if(fd<0)return false;
  const bool wrote=::write(fd,"1000\n",5)==5;::close(fd);if(!wrote)return false;
  fd=::open("/proc/self/oom_score_adj",O_RDONLY|O_CLOEXEC|O_NOFOLLOW);
  if(fd<0)return false;
  char value[16]{};const auto count=::read(fd,value,sizeof(value)-1);::close(fd);
  // Parent death before prctl does not retroactively deliver the signal.
  // Recheck after arming it and after all child-only setup, before entry.
  return count==5 && !std::memcmp(value,"1000\n",5) && ::getppid()==expected_parent;
}

enum class Stage {FRESH,PREPARING,RUNNING,TERM_SENT,KILL_SENT,REAPED,RECONCILE};
using ChildEntry=int (*)(void *);

class OneShotChild {
 public:
  OneShotChild()=default;
  OneShotChild(const OneShotChild &)=delete;
  OneShotChild &operator=(const OneShotChild &)=delete;
  ~OneShotChild() {
    // Closing a preparation gate makes a waiting child exit without entry.
    // A destructor must not secretly signal a PID. After RUNNING the owning
    // standalone guardian MUST keep stepping, or exit so PDEATHSIG applies.
    close_gate_();
  }
  bool spawn(ChildEntry entry,void *context) {
    if(stage_!=Stage::FRESH)return false;
    stage_=Stage::RECONCILE;  // Even a refused/failing fork is never retried.
    if(!entry || ::geteuid()!=0 || !cgs1_supervisor::guardian_has_exclusive_reaper())return false;
    start_=cgs1_supervisor::process_tree_clock_ms();if(!start_)return false;
    int channels[2];if(::socketpair(AF_UNIX,SOCK_STREAM|SOCK_CLOEXEC,0,channels))return false;
    const auto parent=::getpid();const auto pid=::fork();
    if(pid<0){::close(channels[0]);::close(channels[1]);return false;}
    if(!pid) {
      ::close(channels[0]);
      if(!protect_current_child(parent))::_exit(125);
      // The parent must first claim this exact kernel child. An ACK from a
      // different PID or a closed/timed-out gate can never start the entry.
      if(::send(channels[1],"P",1,MSG_NOSIGNAL)!=1)::_exit(125);
      char go=0;ssize_t count;
      do {count=::recv(channels[1],&go,1,0);}while(count<0 && errno==EINTR);
      ::close(channels[1]);
      if(count!=1 || go!='G' || ::getppid()!=parent)::_exit(125);
      ::_exit(entry(context));
    }
    ::close(channels[1]);gate_=channels[0];
    const auto actual=cgs1_supervisor::process_stamp(pid);
    if(!owned_.claim(actual)){close_gate_();return false;}
    stage_=Stage::PREPARING;
    return true;
  }
  Stage stage() const {return stage_;}
  const cgs1_supervisor::ProcessStamp &stamp() const {return owned_.stamp();}
  bool child_protection_acknowledged() const {return prepared_;}
  bool forced() const {return kill_sent_;}
  int wait_status() const {return owned_.wait_status();}
  bool term_sent() const {return term_sent_;}

  Stage step(bool abort=false) {
    if(stage_==Stage::FRESH || stage_==Stage::REAPED || stage_==Stage::RECONCILE)return stage_;
    const auto state=owned_.poll();
    if(state==ChildState::REAPED){close_gate_();stage_=Stage::REAPED;return stage_;}
    if(state!=ChildState::LIVE){close_gate_();stage_=Stage::RECONCILE;return stage_;}
    const auto now=cgs1_supervisor::process_tree_clock_ms();
    if(!now || now<start_ || (last_ && now<last_)) {
      // No usable clock means no new deadline claims. Close the preparation
      // gate; the caller must retire the guardian, not attempt another fork.
      close_gate_();stage_=Stage::RECONCILE;return stage_;
    }
    last_=now;
    if(!term_sent_ && (abort || now-start_>=60000))return terminate_(now);
    if(stage_==Stage::PREPARING) {
      char ready=0;const auto count=::recv(gate_,&ready,1,MSG_DONTWAIT);
      if(count==1 && ready=='P') {
        prepared_=true;
        if(::send(gate_,"G",1,MSG_NOSIGNAL)!=1)return terminate_(now);
        close_gate_();stage_=Stage::RUNNING;
      } else if(count==0 || count>0 || (errno!=EAGAIN && errno!=EWOULDBLOCK && errno!=EINTR)) {
        return terminate_(now);
      }
    } else if(stage_==Stage::TERM_SENT && now-term_at_>=5000) {
      // One escalation only. poll() above proves the actual child is still
      // unreaped under the same exclusive waiter; no /proc-only PID claim.
      kill_sent_=true;kill_at_=now;stage_=Stage::KILL_SENT;
      if(::kill(owned_.stamp().pid,SIGKILL) && errno!=ESRCH)stage_=Stage::RECONCILE;
    } else if(stage_==Stage::KILL_SENT && now-kill_at_>=5000) {
      stage_=Stage::RECONCILE;
    }
    return stage_;
  }
 private:
  cgs1_supervisor::OwnedChild owned_;
  Stage stage_{Stage::FRESH};int gate_{-1};
  uint64_t start_{0},last_{0},term_at_{0},kill_at_{0};
  bool prepared_{false},term_sent_{false},kill_sent_{false};
  void close_gate_(){if(gate_>=0){::close(gate_);gate_=-1;}}
  Stage terminate_(uint64_t now) {
    if(term_sent_)return stage_;
    // Consume before send, including a failed/ambiguous syscall result.
    term_sent_=true;term_at_=now;close_gate_();stage_=Stage::TERM_SENT;
    if(::kill(owned_.stamp().pid,SIGTERM) && errno!=ESRCH)stage_=Stage::RECONCILE;
    return stage_;
  }
};
}  // namespace cgs1_initial_trial
#endif
