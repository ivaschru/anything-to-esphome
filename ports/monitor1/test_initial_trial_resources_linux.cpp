// Actual Linux/root fd IO against private synthetic tmpfs files only. No real
// /proc resource collection, network socket, monitor or firmware execution.
#ifdef NDEBUG
#error "Kernel resource fd fixtures require enabled assertions"
#endif
#include "initial_trial_resources.h"
#include <cassert>
#include <filesystem>
#include <cstdio>

using namespace cgs1_initial_trial;
using Reader=BasicInitialKernelResources<0x01021994>;
struct Fixture {
  std::string path;int root{-1};
  Fixture() {
    char name[]="/dev/shm/qingping-initial-resources-XXXXXX";
    const auto created=::mkdtemp(name);assert(created);path=created;
    root=::open(path.c_str(),O_RDONLY|O_DIRECTORY|O_CLOEXEC);assert(root>=3);
    assert(!::mkdirat(root,"net",0700));
    write("meminfo","MemTotal: 131072 kB\nMemFree: 65536 kB\n");
    write("net/tcp","sl local_address rem_address st\n");
    write("net/tcp6","sl local_address remote_address st\n");
  }
  Fixture(const Fixture &)=delete;
  ~Fixture(){::close(root);std::filesystem::remove_all(path);}
  void write(const char *name,const std::string &text) {
    const int fd=::openat(root,name,O_WRONLY|O_CREAT|O_TRUNC|O_NOFOLLOW|O_CLOEXEC,0600);assert(fd>=3);
    assert(::write(fd,text.data(),text.size())==ssize_t(text.size()));assert(!::close(fd));
  }
};
int main() {
  assert(::getuid()==0 && ::geteuid()==0);Reader reader;
  {
    Fixture f;struct stat before{},after{};assert(!::fstatat(f.root,"meminfo",&before,0));
    auto result=reader.read_fixture_root(f.root);
    assert(result.verified && result.conservative_free_bytes==64ULL*1024*1024 && result.observed_at_ms);
    assert(result.observed_at_ms<=cgs1_supervisor::process_tree_clock_ms());
    assert(!::fstatat(f.root,"meminfo",&after,0) && before.st_ino==after.st_ino &&
      before.st_size==after.st_size && before.st_mode==after.st_mode);
    f.write("meminfo","MemTotal: 131072 kB\nMemFree: 49152 kB\n");
    result=reader.read_fixture_root(f.root);assert(result.verified && result.conservative_free_bytes==48ULL*1024*1024);
    f.write("meminfo","MemTotal: 131072 kB\nMemFree: 0 kB\nMemAvailable: 99999999 kB\n");
    result=reader.read_fixture_root(f.root);assert(!result.verified && !result.conservative_free_bytes && !result.observed_at_ms);
  }
  for(int kind=0;kind<10;++kind) {
    Fixture f;
    if(kind==0)assert(!::unlinkat(f.root,"net/tcp6",0));
    if(kind==1)f.write("net/tcp","truncated");
    if(kind==2)f.write("net/tcp","sl local_address rem_address st\n0: 00000000:0CA0 00000000:0000 06\n");
    if(kind==3)f.write("net/tcp6","sl local_address remote_address st\n0: "+std::string(32,'0')+":17a5 "+std::string(32,'0')+":0000 01\n");
    if(kind==4)f.write("meminfo",std::string(17000,'x')+"\n");
    if(kind==5)f.write("net/tcp6",std::string(262145,'x')+"\n");
    if(kind==6){assert(!::unlinkat(f.root,"net/tcp6",0));assert(!::symlinkat("tcp",f.root,"net/tcp6"));}
    if(kind==7){assert(!::unlinkat(f.root,"meminfo",0));assert(!::mkfifoat(f.root,"meminfo",0600));}
    if(kind==8)assert(!::fchownat(f.root,"net/tcp",65534,65534,0));
    if(kind==9)f.write("net/tcp","sl local_address rem_address st\n0: 00000000:1234 malformed 01\n");
    const auto result=reader.read_fixture_root(f.root);
    assert(!result.verified && !result.conservative_free_bytes && !result.observed_at_ms);
  }
  {
    Fixture f;BasicInitialKernelResources<0xef53> wrong_filesystem;
    assert(!wrong_filesystem.read_fixture_root(f.root).verified);
    assert(!reader.read_fixture_root(-1).verified);
  }
  std::puts("initial kernel resource fd fixtures passed");
}
