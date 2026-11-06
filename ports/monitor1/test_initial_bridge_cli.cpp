// Exercise the real executable's parser/report/owned-child integration on
// Linux. All children execute this synthetic callback only; no production
// path, staged ELF, USB transport or monitor is opened by this fixture.
#ifdef NDEBUG
#error "This fixture requires assertions"
#endif
#define CGS1_INITIAL_BRIDGE_NO_MAIN
#include "initial_bridge_trial_main.cpp"
#include <cassert>
#include <vector>

using namespace cgs1_initial_bridge_cli;
static int own_fixture(void *) { return 0; }
int main() {
  std::vector<std::string> fields={"fixture","--bounded-first-bridge-v1",
    std::string(32,'1'),std::string(64,'2'),std::string(32,'3'),
    "01234567-1234-4234-8234-123456789abc","02:00:00:00:00:01","3",
    "50","100","123","456","120","400",std::string(32,'4'),"60","200",
    std::string(32,'5'),"60","300","1000",std::string(64,'6'),std::string(32,'7')};
  for(int i=0;i<9;++i){fields.push_back("1000");fields.push_back(std::string(64,char('a'+i%6)));}
  auto parsed=[&](Configuration &out) {
    std::vector<char *> argv;for(auto &value:fields)argv.push_back(value.data());
    return parse(int(argv.size()),argv.data(),out);
  };
  Configuration config;assert(parsed(config));
  assert(config.scope.device.co2_type==3 && config.scope.filesystem.payload[8].bytes==1000);
  assert(config.scope.filesystem.payload[8].sha256==std::string(64,'c'));
  // Fixed framing has no path, clock, signal, filesystem or CPU overrides.
  for(size_t index:{size_t(1),size_t(2),size_t(5),size_t(6),size_t(7),size_t(10),size_t(20),size_t(24),size_t(40)}) {
    auto old=fields[index];fields[index]="../../invalid";assert(!parsed(config));
    assert(config.guardian_bytes==0);fields[index]=old;
  }
  fields.push_back("extra");assert(!parsed(config));fields.pop_back();
  auto old=fields[17];fields[17]=fields[14];assert(!parsed(config));fields[17]=old;
  fields[19]=fields[16];assert(!parsed(config));fields[19]="300";assert(parsed(config));
  ChildResult good;good.reaped=good.prepared=good.term_sent=true;good.elapsed_ms=60000;
  good.wait_status=SIGTERM;assert(normal_bounded_stop(good));
  good.wait_status=0;assert(normal_bounded_stop(good));
  for(int code:{SIGKILL,125<<8,0x7f}){good.wait_status=code;assert(!normal_bounded_stop(good));}
  good.wait_status=0;good.elapsed_ms=59999;assert(!normal_bounded_stop(good));
  good.elapsed_ms=71001;assert(!normal_bounded_stop(good));
  good.elapsed_ms=60000;good.forced=true;assert(!normal_bounded_stop(good));
  good.forced=false;good.prepared=false;assert(!normal_bounded_stop(good));

  assert(::geteuid()==0);assert(install_stop_handlers());
  const auto result=run_child(own_fixture,nullptr);
  assert(result.reaped && result.prepared && !result.term_sent && !result.forced);
  assert(WIFEXITED(result.wait_status) && WEXITSTATUS(result.wait_status)==0);
  assert(result.elapsed_ms<5000 && !normal_bounded_stop(result)); // Early clean exit is NOT trial success.

  int pipefd[2];assert(!::pipe2(pipefd,O_CLOEXEC|O_NONBLOCK));
  const int saved=::dup(STDOUT_FILENO);assert(saved>=0 && ::dup2(pipefd[1],STDOUT_FILENO)>=0);
  const int flags=::fcntl(STDOUT_FILENO,F_GETFL);assert(flags>=0);
  const auto stamp=cgs1_supervisor::process_stamp(::getpid());
  assert(announce_child(std::string(32,'7').c_str(),stamp));
  assert(::fcntl(STDOUT_FILENO,F_GETFL)==flags); // Transport flags restored.
  char buffer[512]{};const auto size=::read(pipefd[0],buffer,sizeof(buffer));assert(size>0);
  assert(std::string(buffer,size).find("CGS1_TRIAL_CHILD_V1 "+std::string(32,'7')+" ")==0);
  // A full output pipe refuses without releasing/starting a child and does
  // not block the device's timer. Only this fixture-owned pipe is filled.
  while(::write(pipefd[1],buffer,sizeof(buffer))>0){}
  assert(errno==EAGAIN);assert(!announce_child(std::string(32,'7').c_str(),stamp));
  assert(::dup2(saved,STDOUT_FILENO)>=0);::close(saved);::close(pipefd[0]);::close(pipefd[1]);
}
