// Hosted Linux/root child-entry fixtures. Only a private copy of THIS test
// executable runs. No monitor, bridge, vendor program, stock path or network.
#ifdef NDEBUG
#error "Executable entry fixtures require enabled assertions"
#endif
#include "initial_trial_exec.h"
#include <cassert>
#include <filesystem>
#include <cstdio>

extern char **environ;
using namespace cgs1_initial_trial;

static int oom() {std::ifstream input("/proc/self/oom_score_adj");int value=-9999;input>>value;return value;}
struct Directory {
  std::string path;int fd{-1};DirectoryIdentity identity{};
  explicit Directory(bool ram) {
    char tmp[]="/tmp/qingping-exec-fixture-XXXXXX",shm[]="/dev/shm/qingping-exec-fixture-XXXXXX";
    const auto created=::mkdtemp(ram?shm:tmp);assert(created);path=created;
    fd=::open(path.c_str(),O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);assert(fd>=3);
    struct stat value{};assert(!::fstat(fd,&value));
    identity={uint64_t(value.st_dev),uint64_t(value.st_ino)};
  }
  Directory(const Directory &)=delete;
  ~Directory(){::close(fd);std::filesystem::remove_all(path);}
};
static int verify_exec() {
  assert(::getuid()==0 && ::geteuid()==0);
  assert(oom()==1000 && ::prctl(PR_GET_NO_NEW_PRIVS,0L,0L,0L,0L)==1);
  int death=0;assert(!::prctl(PR_GET_PDEATHSIG,&death) && death==SIGTERM);
  unsigned count=0;for(auto e=environ;*e;++e)++count;
  assert(count==3 && !std::strcmp(::getenv("ESPHOME_PREFDIR"),"./prefs"));
  assert(!std::strcmp(::getenv("LANG"),"C") && !std::strcmp(::getenv("LC_ALL"),"C"));
  assert(!::getenv("LD_PRELOAD") && !::getenv("CGS1_FIXTURE_INHERITED"));
  for(int fd=0;fd<3;++fd) {
    char name[64]{},target[64]{};std::snprintf(name,sizeof(name),"/proc/self/fd/%d",fd);
    const auto size=::readlink(name,target,sizeof(target)-1);
    assert(size==9 && !std::strcmp(target,"/dev/null") && ::fcntl(fd,F_GETFD)==0);
  }
  DIR *fds=::opendir("/proc/self/fd");assert(fds);const int scan=::dirfd(fds);
  while(const auto *entry=::readdir(fds)) {
    if(entry->d_name[0]=='.')continue;
    const int fd=std::atoi(entry->d_name);assert(fd<=2 || fd==scan);
  }
  assert(!::closedir(fds));
  struct stat cwd{};struct statfs fs{};
  assert(!::stat(".",&cwd) && cwd.st_uid==0 && (cwd.st_mode&07777)==0700);
  assert(!::statfs(".",&fs) && fs.f_type==0x01021994);
  // Prove relative preferences go to the actual RAM cwd; never accept an
  // inherited absolute directory or merely the expected environment string.
  assert(!::mkdir("./prefs",0700));
  const int fd=::open("./prefs/proof",O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW,0600);assert(fd>=3);
  assert(::write(fd,"RAM",3)==3 && !::close(fd));return 0;
}
struct Context {int image,ram,negative;DirectoryIdentity identity;cgs1_supervisor::ProcessStamp parent;};
static int fixture_entry(void *opaque) {
  auto &c=*static_cast<Context *>(opaque);
  if(c.negative==1)assert(!::prctl(PR_SET_PDEATHSIG,0));
  if(c.negative==2)c.parent.start++;
  if(c.negative==3)c.identity.inode++;
  if(c.negative==4)assert(!::fcntl(c.image,F_SETFD,0));
  return detail::exec_initial_fds(c.image,c.ram,c.identity,c.parent);
}
static void reap(OneShotChild &child) {
  const auto start=cgs1_supervisor::process_tree_clock_ms();
  while(child.step()!=Stage::REAPED) {
    assert(child.stage()!=Stage::RECONCILE);
    assert(cgs1_supervisor::process_tree_clock_ms()-start<4000);::usleep(1000);
  }
  assert(child.child_protection_acknowledged() && !child.term_sent() && !child.forced());
}

int main(int argc,char **argv) {
  if(argc==1 && !std::strcmp(argv[0],"cgs1-initial-bridge"))return verify_exec();
  assert(::getuid()==0 && ::geteuid()==0);
  const auto old_oom=oom(),old_nnp=::prctl(PR_GET_NO_NEW_PRIVS,0L,0L,0L,0L);
  const auto parent=cgs1_supervisor::process_stamp(::getpid());
  const int before=::open(".",O_RDONLY|O_DIRECTORY|O_CLOEXEC);assert(before>=3);
  struct stat old_cwd{};assert(!::fstat(before,&old_cwd));
  // Intentionally inheritable fd and environment must disappear ONLY in the
  // exec child. Parent descriptors, cwd, OOM and NNP stay unchanged.
  const int extra=::open("/dev/null",O_RDONLY);assert(extra>=3 && ::fcntl(extra,F_GETFD)==0);
  assert(!::setenv("CGS1_FIXTURE_INHERITED","synthetic-only",1));
  assert(!::setenv("LD_PRELOAD","/nonexistent/qingping-fixture.so",1));
  Directory source(false);
  std::filesystem::copy_file("/proc/self/exe",source.path+"/program");
  assert(!::fchmodat(source.fd,"program",0700,0));
  const int image=::openat(source.fd,"program",O_RDONLY|O_CLOEXEC|O_NOFOLLOW);assert(image>=3);
  for(int negative=0;negative<5;++negative) {
    Directory ram(true);Context context{image,ram.fd,negative,ram.identity,parent};
    assert(detail::exec_initial_fds(image,ram.fd,ram.identity,parent)==125); // Parent is inert.
    OneShotChild child;assert(child.spawn(fixture_entry,&context));reap(child);
    assert(WIFEXITED(child.wait_status()) && WEXITSTATUS(child.wait_status())==(negative?125:0));
    assert(std::filesystem::exists(ram.path+"/prefs/proof")==!negative);
    assert(::fcntl(image,F_GETFD)==FD_CLOEXEC && ::fcntl(extra,F_GETFD)==0);
  }
  {
    // No native-architecture production override. A synthetic ARM image can
    // prepare only the explicit tmpfs fixture type, and a parent call never
    // fchdirs/closes/execs. Repeated preparation invalidates readiness.
    Directory root(true),ramdir(true);
    unsigned char arm[68]{};arm[0]=0x7f;arm[1]='E';arm[2]='L';arm[3]='F';
    arm[4]=1;arm[5]=1;arm[6]=1;arm[16]=3;arm[18]=40;arm[20]=1;arm[37]=4;arm[40]=52;
    const int fd=::openat(root.fd,"program",O_RDWR|O_CREAT|O_EXCL|O_CLOEXEC,0700);assert(fd>=3);
    assert(::write(fd,arm,sizeof(arm))==ssize_t(sizeof(arm)));Digest digest{};
    assert(cgs1_supervisor::image_hash(fd,sizeof(arm),digest));::close(fd);
    BasicInitialBridgeImage<0x01021994> admitted;
    assert(admitted.open(root.fd,root.identity,sizeof(arm),cgs1_supervisor::digest_text(digest)));
    InitialRamDirectory ram;assert(ram.open(ramdir.fd,ramdir.identity));
    BasicInitialBridgeEntry<0x01021994> entry;assert(entry.prepare(admitted,ram));
    assert(decltype(entry)::child_entry(&entry)==125);
    assert(!entry.prepare(admitted,ram));assert(decltype(entry)::child_entry(&entry)==125);
    InitialBridgeImage production;assert(!production.open(root.fd,root.identity,sizeof(arm),cgs1_supervisor::digest_text(digest)));
  }
  struct stat now{};assert(!::stat(".",&now) && old_cwd.st_dev==now.st_dev && old_cwd.st_ino==now.st_ino);
  assert(oom()==old_oom && ::prctl(PR_GET_NO_NEW_PRIVS,0L,0L,0L,0L)==old_nnp);
  assert(!std::strcmp(::getenv("CGS1_FIXTURE_INHERITED"),"synthetic-only"));
  ::close(image);::close(extra);::close(before);std::puts("initial child exec fixtures passed");
}
