// Actual Linux/root O_EXCL/fsync/readback fixtures in a private tmpfs only.
// No program is launched and no existing monitor directory is accessed.
#ifdef NDEBUG
#error "Intent fixtures require enabled assertions"
#endif
#include "initial_trial_intent.h"
#include <cassert>
#include <filesystem>
#include <fstream>

using namespace cgs1_initial_trial;
using FixtureIntent=BasicInitialTrialIntent<0x01021994>;
struct Fixture {
  std::string path;int root{-1};DirectoryIdentity identity{};IntentBinding binding{};
  Fixture() {
    char name[]="/dev/shm/qingping-initial-intent-XXXXXX";const auto created=::mkdtemp(name);
    assert(created);path=created;root=::open(path.c_str(),O_RDONLY|O_DIRECTORY|O_CLOEXEC);assert(root>=0);
    struct stat metadata{};assert(!::fstat(root,&metadata));
    identity={uint64_t(metadata.st_dev),uint64_t(metadata.st_ino)};
    binding.plan_id=std::string(32,'1');binding.plan_sha256=std::string(64,'2');
    binding.bridge_sha256=std::string(64,'a');binding.guardian_sha256=std::string(64,'b');
    binding.nonce=std::string(32,'e');binding.ram={42,43};
    std::ifstream boot("/proc/sys/kernel/random/boot_id");assert(std::getline(boot,binding.boot_id));
  }
  ~Fixture(){if(root>=0)::close(root);std::filesystem::remove_all(path);}
  bool missing() const {struct stat value{};return ::fstatat(root,FixtureIntent::NAME,&value,AT_SYMLINK_NOFOLLOW)<0 && errno==ENOENT;}
};
int main() {
  assert(::getuid()==0 && ::geteuid()==0);
  {
    Fixture fixture;FixtureIntent intent;
    assert(intent.open(fixture.root,fixture.identity,fixture.binding));assert(fixture.missing());
    assert(intent.claim());assert(intent.current());assert(intent.authorize_one_fork());
    assert(!intent.authorize_one_fork());assert(intent.current());
    FixtureIntent other;assert(other.open(fixture.root,fixture.identity,fixture.binding));
    assert(!other.claim());assert(!other.authorize_one_fork());
    fixture.binding.nonce=std::string(32,'f');
    FixtureIntent renamed;assert(renamed.open(fixture.root,fixture.identity,fixture.binding));assert(!renamed.claim());
  }
  for(int kind=0;kind<6;++kind) {
    Fixture fixture;FixtureIntent intent;auto binding=fixture.binding;
    if(kind==0)binding.plan_id="../bad";
    if(kind==1)binding.plan_sha256=std::string(64,'X');
    if(kind==2)binding.boot_id[8]='x';
    if(kind==3)binding.ram.inode=0;
    if(kind==4)binding.boot_id="00000000-0000-4000-8000-000000000001";
    if(kind==5)binding.nonce="";
    assert(!intent.open(fixture.root,fixture.identity,binding));assert(!intent.claim());
    assert(fixture.missing());assert(!intent.authorize_one_fork());
  }
  {
    Fixture fixture;FixtureIntent intent;
    assert(intent.open(fixture.root,fixture.identity,fixture.binding));
    assert(!intent.open(fixture.root,fixture.identity,fixture.binding));
    assert(!intent.claim());assert(fixture.missing());
  }
  {
    Fixture fixture;FixtureIntent intent;
    assert(intent.open(fixture.root,fixture.identity,fixture.binding));
    assert(!intent.authorize_one_fork());assert(!intent.claim());assert(fixture.missing());
  }
  {
    Fixture fixture;InitialTrialIntent production;
    assert(!production.open(fixture.root,fixture.identity,fixture.binding));assert(fixture.missing());
  }
  for(int kind=0;kind<4;++kind) {
    Fixture fixture;
    if(kind==0)assert(!::symlinkat("/never-follow-this-fixture",fixture.root,FixtureIntent::NAME));
    if(kind==1)assert(!::mkdirat(fixture.root,FixtureIntent::NAME,0700));
    if(kind==2 || kind==3) {
      int fd=::openat(fixture.root,FixtureIntent::NAME,O_WRONLY|O_CREAT|O_EXCL|O_CLOEXEC,0600);assert(fd>=0);
      if(kind==3)assert(::write(fd,"partial",7)==7);::close(fd);
    }
    FixtureIntent intent;assert(intent.open(fixture.root,fixture.identity,fixture.binding));
    assert(!intent.claim());assert(!intent.current());assert(!intent.authorize_one_fork());
    struct stat preserved{};assert(!::fstatat(fixture.root,FixtureIntent::NAME,&preserved,AT_SYMLINK_NOFOLLOW));
  }
  for(int kind=0;kind<4;++kind) {
    Fixture fixture;FixtureIntent intent;
    assert(intent.open(fixture.root,fixture.identity,fixture.binding));assert(intent.claim());
    if(kind==0)assert(!::fchmodat(fixture.root,FixtureIntent::NAME,0644,0));
    if(kind==1)assert(!::linkat(fixture.root,FixtureIntent::NAME,fixture.root,"other",0));
    if(kind==2) {
      int fd=::openat(fixture.root,FixtureIntent::NAME,O_WRONLY|O_CLOEXEC);assert(fd>=0);
      assert(::write(fd,"X",1)==1);::close(fd);
    }
    if(kind==3) {
      assert(!::unlinkat(fixture.root,FixtureIntent::NAME,0));
      int fd=::openat(fixture.root,FixtureIntent::NAME,O_WRONLY|O_CREAT|O_EXCL|O_CLOEXEC,0600);assert(fd>=0);::close(fd);
    }
    assert(!intent.current());assert(!intent.authorize_one_fork());
    assert(!intent.claim());  // No second write after unknown/tampered state.
  }
  {
    Fixture fixture;FixtureIntent intent;
    assert(intent.open(fixture.root,fixture.identity,fixture.binding));assert(intent.claim());
    const auto pid=::fork();assert(pid>=0);
    if(!pid){assert(!intent.current());assert(!intent.authorize_one_fork());::_exit(0);}
    int status=0;assert(::waitpid(pid,&status,0)==pid && WIFEXITED(status) && WEXITSTATUS(status)==0);
    assert(intent.current());assert(intent.authorize_one_fork());
  }
  {
    // Two actual processes race only for our private synthetic marker.
    Fixture fixture;int channel[2];assert(!::pipe(channel));
    const auto pid=::fork();assert(pid>=0);
    if(!pid) {
      ::close(channel[0]);FixtureIntent intent;
      const bool won=intent.open(fixture.root,fixture.identity,fixture.binding) && intent.claim();
      const char result=won?'1':'0';assert(::write(channel[1],&result,1)==1);::_exit(0);
    }
    ::close(channel[1]);FixtureIntent intent;
    const bool won=intent.open(fixture.root,fixture.identity,fixture.binding) && intent.claim();
    char other=0;assert(::read(channel[0],&other,1)==1);::close(channel[0]);
    int status=0;assert(::waitpid(pid,&status,0)==pid && WIFEXITED(status) && WEXITSTATUS(status)==0);
    assert(int(won)+(other=='1')==1);
  }
  std::puts("device-side one-shot intent fixtures passed");
}
