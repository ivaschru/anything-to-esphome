#pragma once

// Standalone, SINGLE-THREADED guardian process engine. The coordinator execs
// the backup; only this engine forks primary -> native. Board is a compile-time
// adapter, never an API-selected implementation. Production must construct
// RunnerInput from a verified FullPlan FD and a fixed release layout first.
// A test Board can exercise the SAME process engine without hardware access.
#include "supervisor_control_channel.h"
#include "supervisor_endpoint.h"
#include "supervisor_full_plan.h"
#include "supervisor_vendor_takeover.h"
#include "supervisor_network_recovery_witness.h"
#include <sys/file.h>
#include <poll.h>
#include <functional>
#include <type_traits>
#include <utility>

namespace cgs1_supervisor {
struct RunnerInput {
  FullPlan plan;
  std::string native_directory;
  int plan_fd{-1},runtime_fd{-1},coordinator_fd{-1};
  ExecutableSpec architecture{};
  Timing timing{};
  // Zero is a permanent session. A first hardware trial can compile a hard
  // bound independently of native pulses/OTA. It is not a network parameter.
  uint64_t hard_runtime_ms{0};
};

inline ProcessStamp runner_birth(pid_t pid) {
  for(unsigned i=0;i<1000;++i) {
    auto value=process_stamp(pid);if(value.start)return value;
    ::usleep(1000);
  }
  return {};
}
inline bool runner_pair(int (&fd)[2]) {
  if(::socketpair(AF_UNIX,SOCK_SEQPACKET|SOCK_CLOEXEC,0,fd))return false;
  return configure_channel(fd[0]) && configure_channel(fd[1]);
}
inline bool runner_write(int fd,const void *data,size_t size) {
  // The only pipe records are <= PIPE_BUF and have exactly one writer. A
  // short write is terminal; retrying an uncertain command is forbidden.
  return ::write(fd,data,size)==ssize_t(size);
}
inline bool runner_read(int fd,void *data,size_t size,int timeout_ms=10000) {
  pollfd item{fd,POLLIN,0};
  return ::poll(&item,1,timeout_ms)==1 && (item.revents&POLLIN) &&
         ::read(fd,data,size)==ssize_t(size);
}
inline bool runner_close_except(const std::vector<int> &keep) {
  DIR *directory=::opendir("/proc/self/fd");if(!directory)return false;
  const int scanning=::dirfd(directory);bool okay=true;
  while(const auto *entry=::readdir(directory)) {
    char *end=nullptr;const long fd=std::strtol(entry->d_name,&end,10);
    if(end && !*end && fd>2 && fd!=scanning &&
       std::find(keep.begin(),keep.end(),fd)==keep.end() && ::close(int(fd)))okay=false;
  }
  ::closedir(directory);return okay;
}

// Pump only ALIVE while VendorTakeover waits for STOP/death. Both actors
// send reciprocal heartbeats. This also keeps a partial takeover recoverable
// when the coordinator or either guardian disappears between two signals.
class RunnerFence {
 public:
  RunnerFence(ControlPeer &peer,ControlPeer *coordinator=nullptr)
      :peer_(peer),coordinator_(coordinator),last_peer_(clock_ms()){}
  RunnerFence(const RunnerFence&)=delete;
  RunnerFence&operator=(const RunnerFence&)=delete;
  bool both_guardians_armed() {
    if(!armed_ || !pump())return false;
    const auto now=clock_ms();return now && now>=last_peer_ && now-last_peer_<5000;
  }
  bool native_dead_and_recovery_owned() const {return dead_ && recovery_->owned();}
  NetworkRecoveryWitness network_recovery_witness()const {
    return native_dead_and_recovery_owned()?NetworkRecoveryWitness(recovery_):NetworkRecoveryWitness{};
  }
  bool pump() {
    const auto now=clock_ms();if(!now)return false;
    if(!sent_ || now-sent_>=200) {
      if(!peer_.send(Control::ALIVE))return false;
      if(coordinator_ && !coordinator_->send(Control::ALIVE))return false;
      sent_=now;
    }
    // One frame per call: an unbounded queue cannot postpone lease checks.
    ControlFrame message;
    const auto received=peer_.receive(message);
    if(received==Receive::FRAME) {
      if(message.command!=Control::ALIVE || message.argument)return false;
      last_peer_=message.monotonic_ms;
    } else if(received!=Receive::EMPTY)return false;
    return true;
  }
  void note_peer(uint64_t sent){last_peer_=sent;}
  void arm(){armed_=true;last_peer_=clock_ms();}
  bool own_recovery(int runtime,const OwnedChild&native) {
    // A caller cannot replace kernel waitpid evidence with an unconditional
    // true. Only this exact terminal OWN child grants the primary a witness.
    dead_=reaped_(native);
    return dead_ && recovery_->acquire(runtime);
  }
  bool own_recovery_after_primary(int runtime,const OwnedChild&primary,const ProcessStamp&native) {
    // Backup first reaps its primary. An original native still in /proc must
    // then be adopted by this verified subreaper before it can be signalled.
    int subreaper=0;
    if(!reaped_(primary) || native.pid<=1 || !native.start || native.owner!=0 ||
       native.parent!=primary.stamp().pid || ::prctl(PR_GET_CHILD_SUBREAPER,&subreaper) || subreaper!=1)return false;
    const auto observed=process_stamp(native.pid);
    if(observed.start==native.start) {
      OwnedChild adopted;
      if(!adopted.claim(native) || !adopted.kill_and_reap(3000) || !reaped_(adopted))return false;
    } else if(!observed.start) {
      // process_stamp returns empty on a READ ERROR too. Only an actual ENOENT
      // from the verified procfs permits the already-reaped-by-primary path.
      // Permission, parse, I/O and mount errors must leave stock suspended.
      const int proc=::open("/proc",O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
      struct statfs fs{};struct stat entry{};
      const bool procfs=proc>=0 && !::fstatfs(proc,&fs) && fs.f_type==0x9fa0;
      errno=0;
      const bool absent=procfs && ::fstatat(proc,std::to_string(native.pid).c_str(),&entry,AT_SYMLINK_NOFOLLOW)<0 && errno==ENOENT;
      if(proc>=0)::close(proc);
      if(!absent)return false;
    }
    // A fully parsed DIFFERENT start time also proves the original birth is
    // gone. Never signal that replacement process. The primary's reaped state
    // and the original fork/birth record are still mandatory in both paths.
    dead_=true;return recovery_->acquire(runtime);
  }
 private:
  static bool reaped_(const OwnedChild&child) {
    return guardian_has_exclusive_reaper() && child.state()==ChildState::REAPED &&
      child.stamp().pid>1 && child.stamp().start && child.stamp().owner==0 && child.stamp().parent==::getpid();
  }
  ControlPeer &peer_;ControlPeer *coordinator_;
  std::shared_ptr<RunnerRecoveryLock> recovery_{std::make_shared<RunnerRecoveryLock>()};
  bool armed_{false},dead_{false};uint64_t sent_{0},last_peer_{0};
};

// Compile-time adapter only. Non-network fixture boards need no callback;
// production Cgs1RunnerBoard stores the move-only witness for its authority.
template<class Board,class=void>struct RunnerNetworkRecoveryBinder {
  static void bind(Board&,NetworkRecoveryWitness&&){}
};
template<class Board>struct RunnerNetworkRecoveryBinder<Board,std::void_t<decltype(
    std::declval<Board&>().bind_network_recovery(std::declval<NetworkRecoveryWitness&&>()))>> {
  static void bind(Board&board,NetworkRecoveryWitness&&witness){board.bind_network_recovery(std::move(witness));}
};
template<class Board,class=void>struct RunnerNetworkJournalHook {
  static bool configure(Board&,RunnerRole){return true;}
  static bool step(Board&){return true;}
};
template<class Board>struct RunnerNetworkJournalHook<Board,std::void_t<decltype(
    std::declval<Board&>().configure_network_guardian(RunnerRole::PRIMARY)),decltype(
    std::declval<Board&>().poll_network_guardian())>> {
  static bool configure(Board&board,RunnerRole role){return board.configure_network_guardian(role);}
  static bool step(Board&board){return board.poll_network_guardian();}
};

inline bool runner_checked_native(ImageDirectory &directory,const RunnerInput &input) {
  ImageFile image;
  return directory.open_existing(input.native_directory.c_str(),0) &&
         directory.inspect(image,input.architecture,&input.plan.native_digest,ImageSync::FILE_AND_DIRECTORY);
}

// The native child is forked by a SINGLE-THREADED primary, so preparing the
// six numeric environment values here cannot inherit a locked SDK allocator.
// No caller-provided shell/argv is executed. The one executable path is built
// by the trusted layout binder. All unrelated guardian/bridge FDs are closed.
inline void runner_exec_native(const RunnerInput &input,const ProcessStamp &primary,
                               const ProcessStamp &backup,int primary_fd,int backup_fd,int go) {
  if(!runner_close_except({primary_fd,backup_fd,go,input.plan_fd,input.runtime_fd}))::_exit(73);
  char granted=0;
  if(!runner_read(go,&granted,1,30000) || granted!='G')::_exit(73);
  ::close(go);
  const char *names[]{"CGS1_PRIMARY_FD","CGS1_PRIMARY_PID","CGS1_PRIMARY_START",
                      "CGS1_BACKUP_FD","CGS1_BACKUP_PID","CGS1_BACKUP_START",
                      "CGS1_FULL_PLAN_FD","CGS1_RUNTIME_FD"};
  const std::string values[]{std::to_string(primary_fd),std::to_string(primary.pid),std::to_string(primary.start),
      std::to_string(backup_fd),std::to_string(backup.pid),std::to_string(backup.start),
      std::to_string(input.plan_fd),std::to_string(input.runtime_fd)};
  for(unsigned i=0;i<8;++i)if(::setenv(names[i],values[i].c_str(),1))::_exit(73);
  const auto root="/tmp/qingping-full-"+input.plan.nonce;
  if(input.native_directory!=root+"/native" || ::setenv("ESPHOME_PREFDIR",(root+"/prefs").c_str(),1))::_exit(73);
  for(int fd:{primary_fd,backup_fd,input.plan_fd,input.runtime_fd}) {
    const int flags=::fcntl(fd,F_GETFD);
    if(flags<0 || ::fcntl(fd,F_SETFD,flags&~FD_CLOEXEC))::_exit(73);
  }
  const auto path=input.native_directory+"/program";
  char *const argv[]{const_cast<char *>(path.c_str()),nullptr};
  // Direct, numeric/fixed diagnostics survive early _Exit and do not expose
  // argv/environment/credentials. They do not alter admission or deadlines.
  ::dprintf(STDERR_FILENO,"CGS1_NATIVE exec begin\n");
  ::execv(path.c_str(),argv);
  ::dprintf(STDERR_FILENO,"CGS1_NATIVE exec failed errno=%d\n",errno);::_exit(127);
}

// Waiting commands may be interleaved with ALIVE, but must otherwise match
// the one exact phase transition. Every wait has a hard monotonic deadline.
inline bool runner_wait(ControlPeer &peer,Control expected,RunnerFence *fence,
                        uint64_t timeout_ms=15000) {
  const auto start=clock_ms();if(!start)return false;
  while(true) {
    const auto now=clock_ms();if(!now || now<start || now-start>=timeout_ms)return false;
    ControlFrame message;const auto received=peer.receive(message);
    if(received==Receive::FRAME) {
      if(message.argument)return false;
      if(message.command==expected) {if(fence)fence->note_peer(message.monotonic_ms);return true;}
      if(message.command!=Control::ALIVE)return false;
      if(fence)fence->note_peer(message.monotonic_ms);
    } else if(received!=Receive::EMPTY)return false;
    // Do not call fence.pump here: it would consume the expected command as
    // a forbidden heartbeat. Send ALIVE directly at the bounded wait cadence.
    if(!peer.send(Control::ALIVE))return false;
    ::usleep(100000);
  }
}

struct RunnerBirth {ProcessStamp primary,native;};

// An optional compile-time diagnostic interface keeps fixture/other board
// adapters valid. Reading the stored failure does not repeat board inspection:
// a later successful snapshot must not erase the cause of an earlier refusal.
template<class Board,class=void>struct RunnerBoardValidationLog {
  static void write(const Board&){}
};
template<class Board>struct RunnerBoardValidationLog<Board,std::void_t<decltype(
    std::declval<const Board&>().validation_error())>> {
  static void write(const Board&board) {
    ::dprintf(STDERR_FILENO,"CGS1_BOARD validation=%s\n",board.validation_error().c_str());
  }
};

template<class Board> int runner_primary(const RunnerInput &input,const ProcessStamp &backup,
                                        int control_fd,int backup_native_fd,int birth_fd) {
  ControlPeer control;uint64_t nonce=0;
  if(!control_nonce(input.plan.nonce,nonce) || !control.open(control_fd,backup,nonce))return 73;
  RunnerFence fence(control);Board board(input.runtime_fd,input.plan);
  VendorTakeover<Board,RunnerFence> vendor(board,fence);
  // Admission can fail before a native child exists, so the later stop log
  // will never execute. Preserve that exact stored refusal here instead of
  // leaving only the backup's generic lost-control observation. These reads
  // neither rerun admission nor expose argv, file contents or credentials.
  if(!board.ready()) {::dprintf(STDERR_FILENO,"CGS1_ADMISSION role=primary stage=board\n");return 73;}
  if(!RunnerNetworkJournalHook<Board>::configure(board,RunnerRole::PRIMARY)) {
    ::dprintf(STDERR_FILENO,"CGS1_ADMISSION role=primary stage=network\n");return 73;
  }
  if(!vendor.admit(input.plan.stock)) {
    ::dprintf(STDERR_FILENO,"CGS1_ADMISSION role=primary stage=vendor error=%s\n",vendor.error());
    RunnerBoardValidationLog<Board>::write(board);return 73;
  }
  int native_pair[2],go[2];if(!runner_pair(native_pair) || ::pipe2(go,O_CLOEXEC))return 73;
  const auto own=runner_birth(::getpid());const auto pid=::fork();if(pid<0)return 73;
  if(!pid)runner_exec_native(input,own,backup,native_pair[1],backup_native_fd,go[0]);
  ::close(native_pair[1]);::close(backup_native_fd);::close(go[0]);
  const auto child=runner_birth(pid);OwnedChild native;
  if(!native.claim(child))return 73;
  RunnerBirth born{own,child};
  const bool announced=runner_write(birth_fd,&born,sizeof(born));::close(birth_fd);
  bool acquired=false;ImageDirectory directory;GuardianEndpoint endpoint;
  if(announced && control.send(Control::PREPARED) && runner_wait(control,Control::PREPARED,&fence) &&
     runner_wait(control,Control::ACQUIRE,&fence)) {
    fence.arm();
    if(full_plan_fresh_for_takeover(input.plan,clock_ms()) && vendor.take_over() &&
       control.send(Control::ACQUIRED) && runner_wait(control,Control::RELEASE_NATIVE,&fence) &&
       runner_checked_native(directory,input) && endpoint.open(native_pair[0],child,directory,input.architecture,input.timing,&input.plan.native_digest)) {
      acquired=runner_write(go[1],"G",1) && control.send(Control::ACK);
    }
  }
  ::close(go[1]);
  const auto began=clock_ms();
  unsigned stop_reason=0;
  while(acquired) {
    if(native.poll()!=ChildState::LIVE){stop_reason=1;break;}
    if(!fence.both_guardians_armed()){stop_reason=2;break;}
    if(!endpoint.step()){stop_reason=3;break;}
    if(!RunnerNetworkJournalHook<Board>::step(board)){stop_reason=5;break;}
    const auto now=clock_ms();
    if(input.hard_runtime_ms && (now<began || now-began>=input.hard_runtime_ms)){stop_reason=4;break;}
    ::usleep(2000);
  }
  ::dprintf(STDERR_FILENO,"CGS1_NATIVE stop acquired=%u reason=%u child=%u wait=%d phase=%u control_fault=%u vendor=%s\n",
    unsigned(acquired),stop_reason,unsigned(native.state()),native.wait_status(),unsigned(endpoint.lease().phase()),
    control.diagnostic_failure(),vendor.error());
  if(!acquired)RunnerBoardValidationLog<Board>::write(board);
  if(endpoint.lease().phase()==Phase::STOP_REQUESTED) {
    // Let EXIT_STOCK reach both peers and native finish its bounded clean
    // shutdown. A stalled shutdown still becomes a killed/reaped own child.
    const auto until=clock_ms()+1000;
    while(native.poll()==ChildState::LIVE && clock_ms()<until)::usleep(1000);
  }
  if(!native.kill_and_reap(3000) || !fence.own_recovery(input.runtime_fd,native))return 74;
  RunnerNetworkRecoveryBinder<Board>::bind(board,fence.network_recovery_witness());
  const bool recovered=vendor.recover();
  // Receipt lives in Board's journal, not this best-effort acknowledgement.
  // Backup may kill us after a lost ACK and safely reconcile that journal.
  control.send(Control::RECOVERED,recovered?0:1);
  return recovered?0:75;
}

template<class Board> int run_guardian_backup(const RunnerInput &input) {
  if(::getuid()!=0 || ::geteuid()!=0 || !guardian_has_exclusive_reaper() ||
     !full_plan_fresh_for_takeover(input.plan,clock_ms()) || !prepare_backup_subreaper())return 73;
  uint64_t nonce=0;const auto bridge=process_stamp(pid_t(input.plan.stock.processes[3].pid));
  if(!control_nonce(input.plan.nonce,nonce) || bridge.start!=input.plan.stock.processes[3].start ||
     bridge.owner!=0 || ::getppid()!=bridge.pid)return 73;
  ControlPeer coordinator;
  if(!coordinator.open(input.coordinator_fd,bridge,nonce))return 73;
  int controls[2],backup_native[2],birth[2];
  if(!runner_pair(controls) || !runner_pair(backup_native) || ::pipe2(birth,O_CLOEXEC))return 73;
  const auto own=runner_birth(::getpid());const auto pid=::fork();if(pid<0)return 73;
  if(!pid) {
    ::close(controls[0]);::close(backup_native[0]);::close(birth[0]);::close(input.coordinator_fd);
    const int result=runner_primary<Board>(input,own,controls[1],backup_native[1],birth[1]);
    // Do not unwind a copied coordinator/entry-point object graph after
    // fork. Its inherited descriptors may have been retired/reused here.
    ::_exit(result);
  }
  ::close(controls[1]);::close(backup_native[1]);::close(birth[1]);
  OwnedChild primary;
  if(!primary.claim(runner_birth(pid)))return 74;
  RunnerBirth born{};const bool birth_read=runner_read(birth[0],&born,sizeof(born));::close(birth[0]);
  ControlPeer control;
  // Even startup failure must terminate/reap our OWN primary. It has not
  // been authorised to signal stock before the ACQUIRE handshake below.
  if(!birth_read || born.primary.pid!=pid || born.primary.start!=primary.stamp().start ||
     !control.open(controls[0],primary.stamp(),nonce)) {
    primary.kill_and_reap(3000);return 74;
  }
  RunnerFence fence(control,&coordinator);Board board(input.runtime_fd,input.plan);
  VendorTakeover<Board,RunnerFence> vendor(board,fence);
  bool admitted=board.ready() && RunnerNetworkJournalHook<Board>::configure(board,RunnerRole::BACKUP) &&
    vendor.admit(input.plan.stock);
  if(!admitted) {
    ::dprintf(STDERR_FILENO,"CGS1_ADMISSION role=backup error=%s\n",vendor.error());
    RunnerBoardValidationLog<Board>::write(board);
  }
  bool acquired=false,primary_acknowledged=false;ImageDirectory directory;GuardianEndpoint endpoint;
  if(admitted && runner_wait(control,Control::PREPARED,&fence) && control.send(Control::PREPARED) &&
     coordinator.send(Control::PREPARED) && runner_wait(coordinator,Control::ACQUIRE,nullptr) &&
     control.send(Control::ACQUIRE)) {
    fence.arm();
    if(runner_wait(control,Control::ACQUIRED,&fence) && runner_checked_native(directory,input) &&
       endpoint.open(backup_native[0],born.native,directory,input.architecture,input.timing,&input.plan.native_digest) &&
       control.send(Control::RELEASE_NATIVE) && runner_wait(control,Control::ACK,&fence)) {
      acquired=coordinator.send(Control::ACQUIRED);
    }
  }
  const auto began=clock_ms();uint64_t last_coordinator=began;unsigned stop_reason=0;
  while(acquired) {
    if(primary.poll()!=ChildState::LIVE){stop_reason=1;break;}
    if(!endpoint.step()){stop_reason=2;break;}
    if(!RunnerNetworkJournalHook<Board>::step(board)){stop_reason=12;break;}
    // Primary may announce durable recovery after EXIT_STOCK. Consume this
    // outside RunnerFence, which intentionally accepts ALIVE only.
    ControlFrame message;auto received=control.receive(message);
    if(received==Receive::FRAME) {
      if(message.command==Control::RECOVERED && message.argument<=1) {primary_acknowledged=true;stop_reason=3;break;}
      if(message.command!=Control::ALIVE || message.argument){stop_reason=4;break;}
      fence.note_peer(message.monotonic_ms);
    } else if(received!=Receive::EMPTY){stop_reason=5;break;}
    received=coordinator.receive(message);
    if(received==Receive::FRAME) {
      if(message.command==Control::RECOVER && !message.argument){stop_reason=6;break;}
      if(message.command!=Control::ALIVE || message.argument){stop_reason=7;break;}
      last_coordinator=message.monotonic_ms;
    } else if(received!=Receive::EMPTY){stop_reason=8;break;}
    const auto now=clock_ms();
    // pump() receives another heartbeat only; a terminal recovery message
    // arriving there can trigger takeover by backup, which is still safe.
    if(!fence.both_guardians_armed()){stop_reason=9;break;}
    if(now<last_coordinator || now-last_coordinator>=5000){stop_reason=10;break;}
    if(input.hard_runtime_ms && (now<began || now-began>=input.hard_runtime_ms)){stop_reason=11;break;}
    ::usleep(2000);
  }
  // Backup is the last independent recovery actor. Its decision is logged
  // BEFORE killing primary, whose own buffered/late message may never run.
  ::dprintf(STDERR_FILENO,"CGS1_BACKUP stop acquired=%u reason=%u primary=%u wait=%d phase=%u fault=%u elapsed=%llu stale_coord=%llu stale_primary=%llu coord_failure=%u primary_failure=%u\n",
    unsigned(acquired),stop_reason,unsigned(primary.state()),primary.wait_status(),unsigned(endpoint.lease().phase()),
    unsigned(endpoint.lease().fault()),static_cast<unsigned long long>(clock_ms()-began),
    static_cast<unsigned long long>(coordinator.discarded_heartbeats()),
    static_cast<unsigned long long>(control.discarded_heartbeats()),coordinator.diagnostic_failure(),control.diagnostic_failure());
  if(primary_acknowledged || endpoint.lease().phase()==Phase::STOP_REQUESTED) {
    const auto until=clock_ms()+1500;
    while(primary.poll()==ChildState::LIVE && clock_ms()<until)::usleep(1000);
  }
  // Killing/reaping PRIMARY first is mandatory. Subreaper adoption then
  // gives backup kernel ownership of native, even when primary was stalled.
  if(!primary.kill_and_reap(3000))return 74;
  if(!fence.own_recovery_after_primary(input.runtime_fd,primary,born.native))return 74;
  RunnerNetworkRecoveryBinder<Board>::bind(board,fence.network_recovery_witness());
  const bool recovered=admitted && vendor.recover();
  coordinator.send(Control::RECOVERED,recovered?0:1);
  return recovered?0:75;
}
}  // namespace cgs1_supervisor
