// Linux/root named RAM scope against one private synthetic tmpfs tree.
// No real /tmp listing, monitor, firmware execution or production write.
#ifdef NDEBUG
#error "Named RAM fixtures require enabled assertions"
#endif
#include "initial_trial_ram_scope.h"
#include <cassert>
#include <filesystem>
#include <cstdio>
#include <utility>
using namespace cgs1_initial_trial;
using Reader=BasicInitialRamScope<0x01021994>;
template<class T,class=void> struct HasFixture:std::false_type {};
template<class T> struct HasFixture<T,std::void_t<decltype(std::declval<T&>().open_fixture_root(
  3,"job",std::declval<const DirectoryIdentity&>()))>>:std::true_type {};
static_assert(!HasFixture<InitialRamScope>::value,"Production must not expose a substitute root");
static_assert(HasFixture<Reader>::value,"Only the synthetic-root type exposes fixture admission");
struct Fixture {
  std::string path;const std::string id=std::string(32,'a'),leaf="qingping-initial-trial-"+id;
  int root{-1},tmp{-1},job{-1};DirectoryIdentity expected{};
  Fixture() {
    char name[]="/dev/shm/qingping-initial-ram-scope-XXXXXX";
    const auto made=::mkdtemp(name);assert(made);path=made;
    root=::open(path.c_str(),O_RDONLY|O_DIRECTORY|O_CLOEXEC);assert(root>=3);
    assert(!::mkdirat(root,"tmp",0700));tmp=::openat(root,"tmp",O_RDONLY|O_DIRECTORY|O_CLOEXEC);assert(tmp>=3);
    assert(!::fchmod(tmp,01777));assert(!::mkdirat(tmp,leaf.c_str(),0700));
    job=::openat(tmp,leaf.c_str(),O_RDONLY|O_DIRECTORY|O_CLOEXEC);assert(job>=3);
    struct stat value{};assert(!::fstat(job,&value));expected={uint64_t(value.st_dev),uint64_t(value.st_ino)};
  }
  ~Fixture(){for(int fd:{job,tmp,root})assert(!::close(fd));std::filesystem::remove_all(path);}
  void empty(int directory,const char *name) {
    const int fd=::openat(directory,name,O_WRONLY|O_CREAT|O_EXCL|O_CLOEXEC,0600);assert(fd>=3);assert(!::close(fd));
  }
  bool open(Reader &reader){return reader.open_fixture_root(root,id,expected);}
};
int main() {
  assert(::getuid()==0 && ::geteuid()==0);
  {
    Fixture f;Reader reader;struct stat before{},after{};assert(!::fstat(f.job,&before));
    f.empty(f.tmp,"unrelated-user-file");
    assert(f.open(reader) && reader.current());
    const int fd=reader.duplicate_verified_read_fd();assert(fd>=3);
    assert((::fcntl(fd,F_GETFL)&O_ACCMODE)==O_RDONLY && ::fcntl(fd,F_GETFD)==FD_CLOEXEC);
    assert(!::fstat(fd,&after) && same_file(before,after));assert(!::close(fd));
    assert(!::fstatat(f.tmp,"unrelated-user-file",&after,AT_SYMLINK_NOFOLLOW));
    assert(!f.open(reader) && !reader.current());
  }
  for(int kind=0;kind<9;++kind) {
    Fixture f;Reader reader;
    if(kind==0)f.empty(f.tmp,"qingping-cgs1-esphome.lock");
    if(kind==1)assert(!::symlinkat("missing",f.tmp,"qingping-cgs1-esphome.lock"));
    if(kind==2)f.empty(f.job,"unknown-history");
    if(kind==3)assert(!::fchmod(f.tmp,0777));
    if(kind==4)assert(!::fchown(f.job,65534,65534));
    if(kind==5)assert(!::fchmod(f.job,0755));
    if(kind==6)++f.expected.inode;
    if(kind==7) {
      assert(!::renameat(f.tmp,f.leaf.c_str(),f.tmp,"previous"));
      assert(!::symlinkat("previous",f.tmp,f.leaf.c_str()));
    }
    if(kind==8)assert(!::fchown(f.tmp,65534,65534));
    assert(!f.open(reader) && !reader.current() && reader.duplicate_verified_read_fd()<0);
  }
  for(int kind=0;kind<4;++kind) {
    Fixture f;Reader reader;assert(f.open(reader));
    if(kind==0)f.empty(f.tmp,"qingping-cgs1-esphome.lock");
    if(kind==1)f.empty(f.job,"prefs");
    if(kind==2) {
      assert(!::renameat(f.tmp,f.leaf.c_str(),f.tmp,"previous"));
      assert(!::mkdirat(f.tmp,f.leaf.c_str(),0700));
    }
    if(kind==3) {
      assert(!::renameat(f.root,"tmp",f.root,"old-tmp"));
      assert(!::mkdirat(f.root,"tmp",01777));
    }
    assert(!reader.current());
    if(kind==0)assert(!::unlinkat(f.tmp,"qingping-cgs1-esphome.lock",0));
    assert(!reader.current()); // Removing the cause never revives a refused scope.
  }
  {
    Fixture f;Reader reader;assert(!reader.open_fixture_root(f.root,"../other",f.expected));
    BasicInitialRamScope<0xef53> wrong;
    assert(!wrong.open_fixture_root(f.root,f.id,f.expected));
  }
  std::puts("initial named RAM and absent boot-lock fixtures passed");
}
