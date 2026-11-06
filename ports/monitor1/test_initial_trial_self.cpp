// Linux/root only: execute private copies of THIS fixture, not firmware.
// NativeFixture changes only the admitted test path/filesystem/ELF boundary;
// /proc identity, actual exec inode, byte hashes and drift checks remain real.
#ifdef NDEBUG
#error "Guardian self fixtures require enabled assertions"
#endif
#include "initial_trial_self.h"
#include <cassert>
#include <filesystem>
#include <cstdio>
#include <utility>
using namespace cgs1_initial_trial;
using FixtureSelf=BasicInitialGuardianSelf<true>;
// Force the real ARM/tmpfs branch through the strict cross-compiler too;
// runtime tests below never invoke it against host production paths.
template class cgs1_initial_trial::BasicInitialGuardianSelf<false>;
template<class T,class=void> struct HasNativeFixture:std::false_type {};
template<class T> struct HasNativeFixture<T,std::void_t<decltype(std::declval<T&>().open_native_fixture(
  "path",std::declval<const DirectoryIdentity&>(),52,"sha"))>>:std::true_type {};
static_assert(!HasNativeFixture<InitialGuardianSelf>::value,"Production cannot accept a native fixture or arbitrary path");
static_assert(HasNativeFixture<FixtureSelf>::value,"Native fixture type has an explicit separate entry");

static void put(const std::string &path,const char *bytes) {
  const int fd=::open(path.c_str(),O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);assert(fd>=3);
  assert(::write(fd,bytes,std::strlen(bytes))==ssize_t(std::strlen(bytes)));assert(!::close(fd));
}
static int check(const std::string &path,int kind) {
  struct stat root{},program{},before{},after{};
  assert(!::stat(path.c_str(),&root) && !::stat((path+"/program").c_str(),&program));
  const DirectoryIdentity identity{uint64_t(root.st_dev),uint64_t(root.st_ino)};
  const int image=::open("/proc/self/exe",O_RDONLY|O_CLOEXEC);assert(image>=3);
  Digest digest{};assert(cgs1_supervisor::image_hash(image,program.st_size,digest));
  const auto sha=cgs1_supervisor::digest_text(digest);
  FixtureSelf reader;
  if(kind==1) {
    assert(!reader.open_native_fixture(path,identity,program.st_size+1,sha));return 0;
  }
  if(kind==2) {
    assert(!reader.open_native_fixture(path,identity,program.st_size,std::string(64,'0')));return 0;
  }
  if(kind==3) {
    auto wrong=identity;++wrong.inode;
    assert(!reader.open_native_fixture(path,wrong,program.st_size,sha));return 0;
  }
  if(kind==4) {
    assert(!::chmod((path+"/program").c_str(),0755));
    assert(!reader.open_native_fixture(path,identity,program.st_size,sha));return 0;
  }
  if(kind==5) {
    // An identical copy is not the running image. Even a correct SHA and
    // 0700 mode must not mint a relationship to this process's real image.
    assert(!::rename((path+"/program").c_str(),(path+"-previous").c_str()));
    std::filesystem::copy_file("/proc/self/exe",path+"/program");
    assert(!::chmod((path+"/program").c_str(),0700));
    assert(!reader.open_native_fixture(path,identity,program.st_size,sha));return 0;
  }
  assert(!::stat((path+"/program").c_str(),&before));
  assert(reader.open_native_fixture(path,identity,program.st_size,sha) && reader.current());
  const auto actor=cgs1_supervisor::process_stamp(::getpid());
  assert(reader.matches_actual_process(actor.pid,actor.start,image));
  assert(!::stat((path+"/program").c_str(),&after) && same_file(before,after));
  assert(!::stat(path.c_str(),&after) && same_file(root,after));
  if(kind==6) {
    assert(!reader.matches_actual_process(actor.pid,actor.start+1,image));
  } else if(kind==7) {
    assert(!reader.matches_actual_process(actor.pid+1,actor.start,image));
  } else if(kind==8) {
    put(path+"/unknown-history","preserve");assert(!reader.current());
    assert(std::filesystem::exists(path+"/unknown-history"));
    assert(!::unlink((path+"/unknown-history").c_str()));assert(!reader.current());
  } else if(kind==9) {
    assert(!::chmod((path+"/program").c_str(),0755));assert(!reader.current());
    assert(!::chmod((path+"/program").c_str(),0700));assert(!reader.current());
  } else if(kind==10) {
    assert(!::rename(path.c_str(),(path+"-moved").c_str()));assert(!reader.current());
    assert(!::rename((path+"-moved").c_str(),path.c_str()));assert(!reader.current());
  } else if(kind==11) {
    // A fork inherits a copy of the object, not the creator relationship.
    // No signal/firmware exec occurs here; only our fixture child is reaped.
    const auto child=::fork();assert(child>=0);
    if(!child)_exit(reader.current()?99:0);
    int status=0;assert(::waitpid(child,&status,0)==child && WIFEXITED(status) && WEXITSTATUS(status)==0);
    assert(reader.current());
  } else if(kind==12) {
    assert(!reader.open_native_fixture(path,identity,program.st_size,sha));assert(!reader.current());
  } else if(kind==13) {
    assert(!::rename((path+"/program").c_str(),(path+"/previous").c_str()));
    std::filesystem::copy_file("/proc/self/exe",path+"/program");
    assert(!::chmod((path+"/program").c_str(),0700));assert(!reader.current());
  } else if(kind==14) {
    const int other=::open("/bin/sh",O_RDONLY|O_CLOEXEC);assert(other>=3);
    assert(!reader.matches_actual_process(actor.pid,actor.start,other));assert(!::close(other));
  } else assert(kind==0);
  assert(!::close(image));return 0;
}
int main(int argc,char **argv) {
  assert(::getuid()==0 && ::geteuid()==0);
  if(argc==4 && !std::strcmp(argv[1],"--fixture-self"))return check(argv[2],std::atoi(argv[3]));
  assert(argc==1);
  for(int kind=0;kind<15;++kind) {
    char directory[]="/tmp/qingping-self-fixture-XXXXXX";
    const auto created=::mkdtemp(directory);assert(created);const std::string path=created;
    std::filesystem::copy_file("/proc/self/exe",path+"/program");assert(!::chmod((path+"/program").c_str(),0700));
    const auto child=::fork();assert(child>=0);
    if(!child) {
      const auto value=std::to_string(kind);
      ::execl((path+"/program").c_str(),"guardian-self-fixture","--fixture-self",path.c_str(),value.c_str(),nullptr);
      _exit(98);
    }
    int status=0;assert(::waitpid(child,&status,0)==child);
    if(!WIFEXITED(status) || WEXITSTATUS(status))std::fprintf(stderr,"self fixture %d failed: %d\n",kind,status);
    assert(WIFEXITED(status) && WEXITSTATUS(status)==0);
    std::filesystem::remove_all(path);
    std::filesystem::remove(path+"-previous");
  }
  std::puts("actual guardian self image fixtures passed");
}
