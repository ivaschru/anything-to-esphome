// Real Linux fork/prctl/waitpid tests. Only synthetic callbacks execute;
// no stock paths, monitor processes, network, ELF or firmware are used.
#ifdef NDEBUG
#error "This executable fixture requires enabled assertions; never compile it with NDEBUG"
#endif
#include "initial_trial_child.h"
#include <cassert>
#include <cstdio>
#include <fstream>

using namespace cgs1_initial_trial;

static int read_oom() {
  std::ifstream input("/proc/self/oom_score_adj");int value=-9999;input>>value;return value;
}
static int protected_entry(void *) {
  int signal=0;
  if(::prctl(PR_GET_PDEATHSIG,&signal) || signal!=SIGTERM || read_oom()!=1000)return 99;
  return 0;
}
static int wait_entry(void *) {while(true)::pause();return 0;}
static int ignore_term_entry(void *) {
  struct sigaction ignore{};ignore.sa_handler=SIG_IGN;::sigemptyset(&ignore.sa_mask);
  assert(!::sigaction(SIGTERM,&ignore,nullptr));
  while(true)::pause();return 0;
}
static void reap(OneShotChild &child,bool abort=false) {
  const auto start=cgs1_supervisor::process_tree_clock_ms();
  while(child.step(abort)!=Stage::REAPED) {
    assert(child.stage()!=Stage::RECONCILE);
    assert(cgs1_supervisor::process_tree_clock_ms()-start<12000);
    ::usleep(1000);
  }
}
static void running(OneShotChild &child) {
  const auto start=cgs1_supervisor::process_tree_clock_ms();
  while(child.step()!=Stage::RUNNING) {
    assert(child.stage()==Stage::PREPARING);
    assert(cgs1_supervisor::process_tree_clock_ms()-start<2000);
    ::usleep(1000);
  }
}

int main() {
  assert(::geteuid()==0);
  const auto before=read_oom();assert(before>=-1000 && before<=1000);
  {
    OneShotChild child;assert(child.spawn(protected_entry,nullptr));
    const auto pid=child.stamp().pid;assert(pid>1 && pid!=::getpid());
    reap(child);assert(child.child_protection_acknowledged());
    assert(WIFEXITED(child.wait_status()) && WEXITSTATUS(child.wait_status())==0);
    assert(!child.spawn(protected_entry,nullptr));  // No second fork after reap.
    assert(!child.term_sent() && !child.forced());
  }
  {
    OneShotChild child;assert(child.spawn(wait_entry,nullptr));running(child);
    assert(child.step(true)==Stage::TERM_SENT);reap(child,true);
    assert(child.term_sent() && !child.forced());
    assert(WIFSIGNALED(child.wait_status()) && WTERMSIG(child.wait_status())==SIGTERM);
    assert(child.step(true)==Stage::REAPED);
  }
  {
    OneShotChild child;assert(child.spawn(ignore_term_entry,nullptr));running(child);
    // The entry installs SIG_IGN after its preparation ACK. Wait for that
    // actual disposition rather than assuming a scheduling delay is proof.
    const auto start=cgs1_supervisor::process_tree_clock_ms();
    while(true) {
      std::ifstream input("/proc/"+std::to_string(child.stamp().pid)+"/status");
      std::string line;unsigned long long ignored=0;
      while(std::getline(input,line))if(line.rfind("SigIgn:",0)==0)ignored=std::strtoull(line.c_str()+7,nullptr,16);
      if(ignored & (1ULL<<(SIGTERM-1)))break;
      assert(cgs1_supervisor::process_tree_clock_ms()-start<2000);::usleep(1000);
    }
    reap(child,true);assert(child.forced());
    assert(WIFSIGNALED(child.wait_status()) && WTERMSIG(child.wait_status())==SIGKILL);
  }
  {
    // SIGCHLD auto-reap would reopen the PID-reuse race. Refuse rather than
    // silently replacing a process-wide handler or weakening ownership.
    struct sigaction old{},ignore{};ignore.sa_handler=SIG_IGN;::sigemptyset(&ignore.sa_mask);
    assert(!::sigaction(SIGCHLD,&ignore,&old));
    OneShotChild child;assert(!child.spawn(wait_entry,nullptr));
    assert(!::sigaction(SIGCHLD,&old,nullptr));
    assert(!child.spawn(wait_entry,nullptr));
  }
  {
    // A real parent dies after the child ACK. A dedicated subreaper receives
    // only our orphan fixture child; no waitpid(-1) or other process is used.
    assert(cgs1_supervisor::prepare_backup_subreaper());
    int channel[2];assert(!::socketpair(AF_UNIX,SOCK_STREAM|SOCK_CLOEXEC,0,channel));
    const auto guardian=::fork();assert(guardian>=0);
    if(!guardian) {
      ::close(channel[0]);OneShotChild child;
      if(!child.spawn(wait_entry,nullptr))::_exit(90);
      running(child);const auto pid=child.stamp().pid;
      if(::send(channel[1],&pid,sizeof(pid),MSG_NOSIGNAL)!=sizeof(pid))::_exit(91);
      // _exit bypasses the C++ destructor; kernel parent-death delivery must
      // still end the child, independently of a host/transport cleanup path.
      ::_exit(0);
    }
    ::close(channel[1]);pid_t orphan=0;
    assert(::recv(channel[0],&orphan,sizeof(orphan),MSG_WAITALL)==sizeof(orphan));::close(channel[0]);
    int status=0;assert(::waitpid(guardian,&status,0)==guardian && WIFEXITED(status) && WEXITSTATUS(status)==0);
    const auto start=cgs1_supervisor::process_tree_clock_ms();
    while(::waitpid(orphan,&status,WNOHANG)==0) {
      assert(cgs1_supervisor::process_tree_clock_ms()-start<2000);::usleep(1000);
    }
    assert(WIFSIGNALED(status) && WTERMSIG(status)==SIGTERM);
  }
  assert(read_oom()==before);  // The guardian/test process was never modified.
  std::puts("one-shot child kernel fixtures passed");
}
