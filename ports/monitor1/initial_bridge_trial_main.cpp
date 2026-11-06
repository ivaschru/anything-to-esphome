// Engineering USB first-bridge executable. Compose the existing fixed readers,
// creator-owned intent, fd entry and kernel-child timer; never use the retrying
// boot launcher. Both persistent opt-outs stay set. This is not activation.
#if !defined(__linux__)
#error "The initial bridge trial requires Linux"
#endif
#include "initial_trial_scope.h"
#include <cstdio>

namespace cgs1_initial_bridge_cli {
using namespace cgs1_initial_trial;
struct Configuration {
  InitialScopeBinding scope;
  std::string guardian_job,guardian_sha,nonce;
  DirectoryIdentity guardian_root;
  uint64_t guardian_bytes{0};
};
bool parse(int argc,char **argv,Configuration &result) {
  result={};
  if(argc!=41 || !argv || !argv[1] || std::strcmp(argv[1],"--bounded-first-bridge-v1"))return false;
  for(int i=1;i<argc;++i)if(!argv[i] || std::strlen(argv[i])>128)return false;
  Configuration value;
  auto &f=value.scope.filesystem;auto &d=value.scope.device;auto &s=value.scope.stock;
  f.plan_id=argv[2];f.plan_sha256=argv[3];f.commit_nonce=argv[4];d.boot_id=argv[5];d.wlan_mac=argv[6];
  uint64_t co2=0,stock_pid=0,watchdog_pid=0;
  auto number=[&](int i,uint64_t maximum,uint64_t &out){return stock_unsigned(argv[i],maximum,out) && out;};
  if(!number(7,3,co2) || !number(8,UINT64_MAX,f.root.device) || !number(9,UINT64_MAX,f.root.inode) ||
     !number(10,INT32_MAX,stock_pid) || !number(11,UINT64_MAX,s.stock_start) ||
     !number(12,INT32_MAX,watchdog_pid) || !number(13,UINT64_MAX,s.watchdog_start) ||
     !number(15,UINT64_MAX,value.scope.ram.device) || !number(16,UINT64_MAX,value.scope.ram.inode) ||
     !number(18,UINT64_MAX,value.guardian_root.device) || !number(19,UINT64_MAX,value.guardian_root.inode) ||
     !number(20,16*1024*1024,value.guardian_bytes) || value.guardian_bytes<52)return false;
  d.co2_type=int(co2);s.stock_pid=uint32_t(stock_pid);s.watchdog_pid=uint32_t(watchdog_pid);
  value.scope.ram_job_id=argv[14];value.guardian_job=argv[17];value.guardian_sha=argv[21];value.nonce=argv[22];
  if(!d.valid() || !s.valid() || !lower_hex(f.plan_id,32) || !lower_hex(f.plan_sha256,64) ||
     !lower_hex(f.commit_nonce,32) || !lower_hex(value.scope.ram_job_id,32) ||
     !lower_hex(value.guardian_job,32) || !lower_hex(value.guardian_sha,64) || !lower_hex(value.nonce,32) ||
     value.guardian_job==value.scope.ram_job_id ||
     (value.guardian_root.device==value.scope.ram.device && value.guardian_root.inode==value.scope.ram.inode))return false;
  for(size_t i=0;i<f.payload.size();++i) {
    auto &pin=f.payload[i];pin.sha256=argv[24+2*i];
    if(!number(23+2*i,16*1024*1024,pin.bytes) || !lower_hex(pin.sha256,64))return false;
  }
  result=value;return true;
}

volatile sig_atomic_t interrupted=0;
void request_stop(int){interrupted=1;}
bool install_stop_handlers() {
  struct sigaction action{};action.sa_handler=request_stop;::sigemptyset(&action.sa_mask);
  // SIGCHLD remains untouched: OneShotChild is the only waiter, and its
  // protected child can never become a recycled, report-supplied PID.
  for(int signal:{SIGTERM,SIGINT,SIGHUP})if(::sigaction(signal,&action,nullptr))return false;
  return true;
}
struct ChildResult {
  bool reaped{false},prepared{false},term_sent{false},forced{false};
  cgs1_supervisor::ProcessStamp child{};uint64_t elapsed_ms{0};int wait_status{0};
};
bool announce_child(const char *nonce,const cgs1_supervisor::ProcessStamp &child) {
  char line[128]{};
  const auto size=std::snprintf(line,sizeof(line),"CGS1_TRIAL_CHILD_V1 %s %d %llu\n",nonce,int(child.pid),
    static_cast<unsigned long long>(child.start));
  if(size<=0 || size>=int(sizeof(line)))return false;
  const int original=::fcntl(STDOUT_FILENO,F_GETFL);
  if(original<0 || ::fcntl(STDOUT_FILENO,F_SETFL,original|O_NONBLOCK))return false;
  // One bounded nonblocking write BEFORE release of the preparation gate.
  // A full/disconnected transport aborts; it cannot block a running bridge.
  const bool sent=::write(STDOUT_FILENO,line,size)==size;
  const bool restored=::fcntl(STDOUT_FILENO,F_SETFL,original)==0;
  return sent && restored;
}
ChildResult run_child(ChildEntry entry,void *context,const char *nonce=nullptr) {
  ChildResult result;OneShotChild child;
  const auto started=cgs1_supervisor::process_tree_clock_ms();
  if(!started || interrupted || !child.spawn(entry,context))return result;
  result.child=child.stamp();
  if(nonce && !announce_child(nonce,result.child))interrupted=1;
  // No hash, ADB, API, stdout, stock scan or remote IO in this loop. The host
  // independently observes the authenticated API/endpoint ownership. Its
  // absence cannot extend the device's existing fixed 60/5/5-second timer.
  while(true) {
    const auto stage=child.step(interrupted!=0);
    if(stage==Stage::REAPED){result.reaped=true;break;}
    if(stage==Stage::RECONCILE)break;
    ::usleep(10000);
  }
  const auto ended=cgs1_supervisor::process_tree_clock_ms();
  result.elapsed_ms=ended>=started?ended-started:0;
  result.prepared=child.child_protection_acknowledged();result.term_sent=child.term_sent();
  result.forced=child.forced();result.wait_status=child.wait_status();return result;
}
bool normal_bounded_stop(const ChildResult &value) {
  return value.reaped && value.prepared && value.term_sent && !value.forced &&
    value.elapsed_ms>=60000 && value.elapsed_ms<=71000 &&
    ((WIFEXITED(value.wait_status) && WEXITSTATUS(value.wait_status)==0) ||
     (WIFSIGNALED(value.wait_status) && WTERMSIG(value.wait_status)==SIGTERM));
}
int run(const Configuration &config) {
  ::umask(0077); // Only this process and its child's private files, never stock.
  // Declaration order keeps the actual self-reader and creator-owned intent
  // alive until every joined collector/entry that refers to them is retired.
  InitialGuardianSelf self;InitialTrialIntent intent;InitialPrestartScope scope;InitialBridgeEntry entry;
  if(!self.open(config.guardian_job,config.guardian_root,config.guardian_bytes,config.guardian_sha) ||
     !scope.open(config.scope,&self) || !scope.prepare_entry(entry))return 125;
  const int root=scope.duplicate_verified_root_fd();
  IntentBinding binding{config.scope.filesystem.plan_id,config.scope.filesystem.plan_sha256,
    config.scope.device.boot_id,config.scope.filesystem.payload[0].sha256,
    config.guardian_sha,config.nonce,config.scope.ram};
  const bool opened=root>=0 && intent.open(root,config.scope.filesystem.root,binding);
  bool closed=true;if(root>=0 && ::close(root))closed=false;
  if(!opened || !closed || !scope.current() || !self.current() || !install_stop_handlers())return 125;
  const auto guardian=cgs1_supervisor::process_stamp(::getpid());
  // Flush this one bounded identity line BEFORE claim/fork. A stalled host
  // cannot block a running child's timer. No output occurs again until reap.
  if(std::printf("CGS1_TRIAL_START_V1 %s %d %llu\n",config.nonce.c_str(),int(guardian.pid),
       static_cast<unsigned long long>(guardian.start))<0 || std::fflush(stdout))return 125;
  if(interrupted || !scope.current() || !self.current() || !intent.claim() ||
     !scope.acknowledge_intent(intent) || !scope.current() || !self.current() ||
     !intent.authorize_one_fork())return 125;
  const auto result=run_child(&InitialBridgeEntry::child_entry,&entry,config.nonce.c_str());
  // This is a kernel-child result, not an installation/sample success claim.
  // The host still needs fresh endpoint/API and unchanged stock/flag evidence.
  if(std::printf("CGS1_TRIAL_END_V1 %s %d %llu %d %llu %llu %d %d %d %d %d\n",
       config.nonce.c_str(),int(guardian.pid),static_cast<unsigned long long>(guardian.start),
       int(result.child.pid),static_cast<unsigned long long>(result.child.start),
       static_cast<unsigned long long>(result.elapsed_ms),int(result.reaped),int(result.prepared),
       int(result.term_sent),int(result.forced),result.wait_status)<0 || std::fflush(stdout))return 125;
  return normal_bounded_stop(result)?0:2;
}
}  // namespace cgs1_initial_bridge_cli

#ifndef CGS1_INITIAL_BRIDGE_NO_MAIN
int main(int argc,char **argv) {
  cgs1_initial_bridge_cli::Configuration config;
  if(!cgs1_initial_bridge_cli::parse(argc,argv,config))return 64;
  return cgs1_initial_bridge_cli::run(config);
}
#endif
