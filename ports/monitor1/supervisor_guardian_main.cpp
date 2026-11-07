// Fixed production guardian entry point. No shell, runtime executable path,
// password, vendor PID or original register value is accepted as an argument.
// The three numeric FD coordinates refer to already inherited private objects.
#include "supervisor_runner.h"
#include "supervisor_runner_board.h"

// Release builder may compile a first RAM-only proof with 90000. A network
// caller cannot select/extend this deadline; zero is the permanent profile.
#ifndef CGS1_FULL_HARD_RUNTIME_MS
#define CGS1_FULL_HARD_RUNTIME_MS 0
#endif
static_assert(CGS1_FULL_HARD_RUNTIME_MS==0 ||
              (CGS1_FULL_HARD_RUNTIME_MS>=1000 && CGS1_FULL_HARD_RUNTIME_MS<=600000),
              "Full runtime bound must be zero or 1..600 seconds");

int main(int argc,char **argv) {
  using namespace cgs1_supervisor;
  if(argc!=4 || ::geteuid()!=0 || ::getuid()!=0)return 73;
  std::array<int,3> fd{};
  for(unsigned i=0;i<3;++i) {
    uint64_t value=0;
    if(!bootstrap_number(argv[i+1],INT_MAX,value) || value<3)return 73;
    fd[i]=int(value);
    for(unsigned j=0;j<i;++j)if(fd[j]==fd[i])return 73;
  }
  RunnerInput input;input.plan_fd=fd[0];input.runtime_fd=fd[1];input.coordinator_fd=fd[2];
  if(!read_full_plan_fd(input.plan_fd,input.plan))return 73;
  // Both backup and its primary child inherit this ceiling. The API client
  // cannot renew it; the original stop/reap/stock-recovery path enforces it.
  input.hard_runtime_ms=effective_full_runtime_limit(input.plan.hard_runtime_ms,CGS1_FULL_HARD_RUNTIME_MS);
  const auto root="/tmp/qingping-full-"+input.plan.nonce;
  struct stat held{},path{};struct statfs fs{};
  if(::fstat(input.runtime_fd,&held) || !S_ISDIR(held.st_mode) || held.st_uid!=0 ||
     (held.st_mode&07777)!=0700 || ::lstat(root.c_str(),&path) || !S_ISDIR(path.st_mode) ||
     held.st_ino!=path.st_ino || held.st_dev!=path.st_dev || path.st_uid!=0 ||
     (path.st_mode&07777)!=0700 || ::fstatfs(input.runtime_fd,&fs) || fs.f_type!=0x01021994)return 73;
  {
    ImageDirectory guardian;ImageFile own;struct stat actual{};
    if(!guardian.open_existing((root+"/guardian").c_str(),0) ||
       !guardian.inspect(own,input.architecture,&input.plan.guardian_digest) ||
       ::stat("/proc/self/exe",&actual) || !own.matches_executable(actual))return 73;
  }
  input.native_directory=root+"/native";
  if(!runner_close_except({fd[0],fd[1],fd[2]}))return 73;
  return run_guardian_backup<Cgs1RunnerBoard>(input);
}
