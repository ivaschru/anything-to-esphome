#pragma once

// Main-loop coordinator: a queued API decision is acted on only AFTER its
// response stack returned. BridgePolicy binds the actual SDK transport and
// stock PM adapter; the isolated fixture binds the same engine to dummy
// listeners/vendor processes. No process name, path, deadline or image hash
// comes from an API request. This class never signals vendor/native processes.
#include "supervisor_full_materialize.h"
#include "supervisor_full_plan.h"
#include "supervisor_control_channel.h"
#include "supervisor_returned_session.h"
#include <sys/wait.h>
#include <memory>

namespace cgs1_supervisor {
enum class CoordinatorPhase {IDLE,QUEUED,WAIT_PREPARED,WAIT_ACQUIRED,NATIVE,WAIT_STOCK,REOPEN,RETURNED,REFUSED};
template<class BridgePolicy> class FullCoordinator {
 public:
  explicit FullCoordinator(BridgePolicy &policy):policy_(policy){}
  CoordinatorPhase phase() const{return phase_;}
  const char *error() const{return error_;}
  pid_t backup_pid() const{return backup_.pid;}
  const FullPlan &plan() const{return plan_;}
  bool acquired() const{return acquired_;}
  bool quiescent_for_new_session()const {
    // This is a local lifecycle fact, not a remote success flag. After a real
    // return the owned backup has been reaped, native absence proved, PM
    // released and transport reopened. A pre-fork refusal owns no child.
    // Recheck native absence instead of clearing an active session's state.
    const bool terminal=(phase_==CoordinatorPhase::RETURNED && reaped_) ||
      (phase_==CoordinatorPhase::REFUSED && !backup_.pid);
    return terminal && materialized_ && !peer_ && !pm_suspended_ && native_absent_();
  }
  ReturnedFullSession returned_session() {
    // A refused/pre-acquire run or a historical directory is not this fact.
    // Timestamp comes from the actual RETURNED transition, never this read.
    if(phase_!=CoordinatorPhase::RETURNED || !acquired_ || !reaped_ || !returned_at_ || !materialized_)
      return {};
    if(!returned_anchor_)returned_anchor_=std::shared_ptr<ReturnedFullSession::Anchor>(
      new ReturnedFullSession::Anchor(materialized_->runtime_fd(),plan_,returned_at_));
    return ReturnedFullSession(returned_anchor_);
  }
  bool request(FullMaterialize &materialized,const std::string &nonce,const ExecutableSpec &architecture={}) {
    if(phase_!=CoordinatorPhase::IDLE || !materialized.ready() || !control_nonce(nonce,nonce_)) {
      error_="ready_unlaunched_full_release_required";return false;
    }
    if(materialized.root()!="/tmp/qingping-full-"+nonce) {error_="fixed_full_release_layout_required";return false;}
    materialized_=&materialized;architecture_=architecture;plan_.nonce=nonce;
    queued_=clock_ms();if(!queued_)return refuse_("monotonic_clock_required");
    phase_=CoordinatorPhase::QUEUED;return true;
  }
  // A lost request/ACK is not replayable. Inspect this phase/actual native
  // connection after reconnect, rather than queueing another launch.
  bool request_return() {
    if(phase_!=CoordinatorPhase::NATIVE || return_requested_)return false;
    return_requested_=true;
    if(!peer_ || !peer_->send(Control::RECOVER))error_="return_channel_failed_guardian_deadline_applies";
    phase_=CoordinatorPhase::WAIT_STOCK;return true;
  }
  void poll() {
    auto now=clock_ms();if(!now){error_="monotonic_clock_failed";return;}
    if(phase_==CoordinatorPhase::QUEUED) {
      if(now<queued_){refuse_("monotonic_clock_reversed");return;}
      if(now-queued_<500)return;
      spawn_();return;
    }
    if(!backup_.pid || phase_==CoordinatorPhase::RETURNED || phase_==CoordinatorPhase::REFUSED)return;
    if(!reaped_) {
      // This component is the sole waitpid owner of this EXACT child. Other
      // SDK helpers may own other children; no waitpid(-1), SIGCHLD handler or
      // global reaper is installed in the multithreaded bridge.
      int status=0;const auto waited=::waitpid(backup_.pid,&status,WNOHANG);
      if(waited==backup_.pid) {reaped_=true;phase_=CoordinatorPhase::WAIT_STOCK;}
      else if(waited<0 && errno!=EINTR) {error_="guardian_wait_ownership_lost";return;}
    }
    if(!reaped_ && phase_!=CoordinatorPhase::WAIT_STOCK) {
      ControlFrame frame;const auto got=peer_->receive(frame);
      if(got==Receive::FRAME) {
        last_peer_=frame.monotonic_ms;
        if(frame.command==Control::ALIVE && !frame.argument) {}
        else if(frame.command==Control::PREPARED && !frame.argument && phase_==CoordinatorPhase::WAIT_PREPARED) {
          if(!guardian_current_() || !policy_.pause_transport()) {
            request_fallback_("bridge_transport_pause_failed");return;
          }
          // Mark before send: an ambiguous command cannot be replayed.
          phase_=CoordinatorPhase::WAIT_ACQUIRED;transition_=now;
          if(!peer_->send(Control::ACQUIRE))request_fallback_("acquire_channel_failed");
        } else if(frame.command==Control::ACQUIRED && !frame.argument && phase_==CoordinatorPhase::WAIT_ACQUIRED) {
          acquired_=true;phase_=CoordinatorPhase::NATIVE;
        } else if(frame.command==Control::RECOVERED && frame.argument<=1) {
          if(frame.argument)error_="guardian_reported_restore_error";
          phase_=CoordinatorPhase::WAIT_STOCK;
        } else {request_fallback_("guardian_control_transition_invalid");return;}
      } else if(got!=Receive::EMPTY) {request_fallback_("guardian_control_lost");return;}
      now=clock_ms();
      if(now<last_peer_ || now-last_peer_>=15000 ||
         ((phase_==CoordinatorPhase::WAIT_PREPARED || phase_==CoordinatorPhase::WAIT_ACQUIRED) &&
          (now<transition_ || now-transition_>=20000))) {
        request_fallback_("guardian_preparation_or_control_deadline");return;
      }
      if(!last_sent_ || now-last_sent_>=200) {
        if(!peer_->send(Control::ALIVE)){request_fallback_("guardian_heartbeat_failed");return;}
        last_sent_=now;
      }
    }
    if(phase_==CoordinatorPhase::WAIT_STOCK) {
      // If channel recovery was ambiguous, withholding heartbeats forces the
      // independent backup's finite deadline. Do not bind legacy ports while
      // a native descendant could still own them or a sensor/display FD.
      if(!reaped_ || (last_stock_check_ && now-last_stock_check_<1000))return;
      last_stock_check_=now;
      if(!native_absent_() || !policy_.stock_recovered(plan_))return;
      phase_=CoordinatorPhase::REOPEN;
    }
    if(phase_==CoordinatorPhase::REOPEN) {
      // Failed binds remain paused/retryable in the SDK gate. No setup()
      // rerun, identity/key replacement, mark_failed(), or port fallback.
      if(!policy_.resume_transport()) {error_="bridge_listener_reopen_pending";return;}
      if(pm_suspended_) {policy_.release_pm();pm_suspended_=false;}
      // The backup has been reaped, native absence and stock recovery were
      // verified, and the SDK listeners are open again. This endpoint has no
      // remaining owner or recovery role. Close it now: a later SDK exec
      // bypasses C++ destructors and would otherwise inherit the dead channel.
      // Keep it during REOPEN retries so return verification stays unchanged.
      peer_.reset();
      returned_at_=clock_ms();
      phase_=CoordinatorPhase::RETURNED;
    }
  }
 private:
  BridgePolicy &policy_;FullMaterialize *materialized_{nullptr};FullPlan plan_;
  ExecutableSpec architecture_;ImageDirectory guardian_directory_;ImageFile guardian_image_;
  std::unique_ptr<ControlPeer> peer_;ProcessStamp backup_{};
  std::shared_ptr<ReturnedFullSession::Anchor>returned_anchor_;
  CoordinatorPhase phase_{CoordinatorPhase::IDLE};const char *error_{""};
  uint64_t nonce_{0},queued_{0},transition_{0},last_peer_{0},last_sent_{0},last_stock_check_{0};
  uint64_t returned_at_{0};
  bool pm_suspended_{false},acquired_{false},reaped_{false},return_requested_{false};
  bool refuse_(const char *why) {
    error_=why;
    // An accidental repeated request must never hide/abandon an active run.
    if(!backup_.pid && phase_!=CoordinatorPhase::NATIVE)phase_=CoordinatorPhase::REFUSED;
    return false;
  }
  void request_fallback_(const char *why) {
    error_=why;phase_=CoordinatorPhase::WAIT_STOCK;
    // Closing the parent's channel is an unambiguous loss of coordinator.
    // No repeated command and no signal to a possibly adopted descendant.
    peer_.reset();
  }
  bool guardian_current_() const {
    const auto current=process_stamp(backup_.pid);struct stat executable{};
    return current.start==backup_.start && current.parent==::getpid() && current.owner==0 &&
      !::stat(("/proc/"+std::to_string(backup_.pid)+"/exe").c_str(),&executable) &&
      guardian_image_.matches_executable(executable);
  }
  void spawn_() {
    error_="";
    if(!policy_.capture(plan_.stock,plan_.effects) || plan_.stock.processes[3].pid!=::getpid()) {
      refuse_("fresh_fixed_board_capture_required");return;
    }
    plan_.native_digest=materialized_->native_digest();plan_.guardian_digest=materialized_->guardian_digest();
    plan_.created_ms=clock_ms();
    const auto guardian_path=materialized_->root()+"/guardian";
    if(!full_plan_fresh_for_takeover(plan_,plan_.created_ms) ||
       !guardian_directory_.open_existing(guardian_path.c_str(),0) ||
       !guardian_directory_.inspect(guardian_image_,architecture_,&plan_.guardian_digest,ImageSync::FILE_AND_DIRECTORY) ||
       !policy_.suspend_pm(plan_.effects.pm_enabled)) {refuse_("release_or_pm_state_changed");return;}
    pm_suspended_=true;
    struct sigaction child_action{};
    if(::sigaction(SIGCHLD,nullptr,&child_action) || child_action.sa_handler!=SIG_DFL || (child_action.sa_flags&SA_NOCLDWAIT)) {
      policy_.release_pm();pm_suspended_=false;refuse_("exclusive_child_wait_owner_required");return;
    }
    const int plan_fd=seal_full_plan_fd(materialized_->runtime_fd(),plan_);
    int pair[2]{-1,-1};
    if(plan_fd<0 || ::socketpair(AF_UNIX,SOCK_SEQPACKET|SOCK_CLOEXEC,0,pair) ||
       !configure_channel(pair[0]) || !configure_channel(pair[1])) {
      if(plan_fd>=0)::close(plan_fd);
      for(int fd:pair)if(fd>=0)::close(fd);
      policy_.release_pm();pm_suspended_=false;refuse_("guardian_objects_creation_failed");return;
    }
    // Both ends need SO_PASSCRED BEFORE either process sends. Linux may
    // autobind the first sender; enabling only the parent's end would make
    // the child's strict inherited-pair validator correctly reject its
    // already-autobound peer as an untrusted endpoint after exec.
    // Allocate strings, argv storage and the FD ceiling BEFORE threaded fork.
    // Child executes only fd/session syscalls and execv, no C++/SDK/allocator.
    const int runtime=materialized_->runtime_fd();
    const auto executable=guardian_path+"/program",a=std::to_string(plan_fd),b=std::to_string(runtime),c=std::to_string(pair[1]);
    char *const arguments[]{const_cast<char *>(executable.c_str()),const_cast<char *>(a.c_str()),
                           const_cast<char *>(b.c_str()),const_cast<char *>(c.c_str()),nullptr};
    const long limit=std::clamp(::sysconf(_SC_OPEN_MAX),256L,65536L);
    const int log=::openat(runtime,"coordinator.log",O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);
    if(log<0) {
      ::close(plan_fd);::close(pair[0]);::close(pair[1]);
      policy_.release_pm();pm_suspended_=false;refuse_("private_guardian_log_creation_failed");return;
    }
    const pid_t child=::fork();
    if(!child) {
      ::setsid();::dup2(log,STDOUT_FILENO);::dup2(log,STDERR_FILENO);
      const int null=::open("/dev/null",O_RDONLY);if(null>=0)::dup2(null,STDIN_FILENO);
      for(int fd=3;fd<limit;++fd)if(fd!=plan_fd && fd!=runtime && fd!=pair[1])::close(fd);
      if(::fcntl(plan_fd,F_SETFD,0) || ::fcntl(runtime,F_SETFD,0) || ::fcntl(pair[1],F_SETFD,0))::_exit(73);
      ::execv(arguments[0],arguments);::_exit(127);
    }
    ::close(log);::close(plan_fd);::close(pair[1]);
    if(child<0) {
      ::close(pair[0]);policy_.release_pm();pm_suspended_=false;refuse_("guardian_fork_failed");return;
    }
    backup_=process_stamp(child);
    // /proc is available for an unreaped fork child even before exec. A
    // missing birth is not permission to signal it; close control and wait.
    if(!backup_.start) {backup_.pid=child;::close(pair[0]);phase_=CoordinatorPhase::WAIT_STOCK;return;}
    peer_=std::make_unique<ControlPeer>();
    if(!peer_->open(pair[0],backup_,nonce_)) {request_fallback_("guardian_private_channel_failed");return;}
    transition_=last_peer_=clock_ms();phase_=CoordinatorPhase::WAIT_PREPARED;
  }
  bool native_absent_() const {
    DIR *directory=::opendir("/proc");if(!directory)return false;
    const auto path=materialized_->root()+"/native/program";bool absent=true;unsigned count=0;
    while(const auto *entry=::readdir(directory)) {
      const std::string name=entry->d_name;
      if(name.empty() || name.find_first_not_of("0123456789")!=std::string::npos)continue;
      if(++count>1024){absent=false;break;}
      const auto target="/proc/"+name+"/exe";
      char bytes[PATH_MAX]{};const auto size=::readlink(target.c_str(),bytes,sizeof(bytes));
      if(size<0) {if(errno!=ENOENT && errno!=ESRCH){absent=false;break;}continue;}
      if(size==ssize_t(sizeof(bytes))){absent=false;break;}
      const std::string executable(bytes,size_t(size));
      if(executable==path || executable==path+" (deleted)"){absent=false;break;}
    }
    ::closedir(directory);return absent;
  }
};
}  // namespace cgs1_supervisor
