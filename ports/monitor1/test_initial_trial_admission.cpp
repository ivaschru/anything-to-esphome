// Linux/root read-only admission fixtures. All mutations below construct
// synthetic files in private /dev/shm directories. No ELF is executed.
#ifdef NDEBUG
#error "Admission fixtures require enabled assertions"
#endif
#include "initial_trial_admission.h"
#include <cassert>
#include <filesystem>
#include <vector>

using namespace cgs1_initial_trial;
using FixtureImage=BasicInitialBridgeImage<0x01021994>;

struct Fixture {
  std::string path;int root{-1};DirectoryIdentity identity{};
  std::vector<unsigned char> bytes;std::string sha;
  Fixture() {
    char name[]="/dev/shm/qingping-trial-admission-XXXXXX";
    const auto directory=::mkdtemp(name);assert(directory);path=directory;
    root=::open(path.c_str(),O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);assert(root>=0);
    struct stat value{};assert(!::fstat(root,&value));
    identity={uint64_t(value.st_dev),uint64_t(value.st_ino)};
    bytes.resize(68);bytes[0]=0x7f;bytes[1]='E';bytes[2]='L';bytes[3]='F';
    bytes[4]=1;bytes[5]=1;bytes[6]=1;bytes[16]=3;bytes[18]=40;bytes[20]=1;
    bytes[37]=4;bytes[40]=52;bytes[52]=0x21;
    write("program");sha=digest();
  }
  Fixture(const Fixture &)=delete;
  ~Fixture(){if(root>=0)::close(root);std::filesystem::remove_all(path);}
  void write(const char *name) {
    const auto fd=::openat(root,name,O_WRONLY|O_CREAT|O_TRUNC|O_NOFOLLOW|O_CLOEXEC,0700);assert(fd>=0);
    assert(::write(fd,bytes.data(),bytes.size())==ssize_t(bytes.size()));::close(fd);
  }
  std::string digest() const {
    const auto fd=::openat(root,"program",O_RDONLY|O_CLOEXEC);assert(fd>=0);
    Digest value{};assert(cgs1_supervisor::image_hash(fd,bytes.size(),value));::close(fd);
    return cgs1_supervisor::digest_text(value);
  }
  bool open(FixtureImage &image) const {return image.open(root,identity,bytes.size(),sha);}
  void capability() {
    // Valid revision-2 CAP_NET_RAW file capability. Content SHA/mode are
    // unchanged; the new reader must reject metadata that could alter exec.
    unsigned char capability[20]{};capability[0]=1;capability[3]=2;capability[5]=0x20;
    const auto fd=::openat(root,"program",O_RDONLY|O_CLOEXEC);assert(fd>=0);
    assert(!::fsetxattr(fd,"security.capability",capability,sizeof(capability),0));::close(fd);
  }
};

int main() {
  assert(::geteuid()==0);
  {
    Fixture fixture;FixtureImage image;struct stat before{},after{};
    assert(!::fstatat(fixture.root,"program",&before,AT_SYMLINK_NOFOLLOW));
    assert(fixture.open(image));assert(image.current());
    const auto copy=image.duplicate_verified_read_fd();assert(copy>=0);
    assert((::fcntl(copy,F_GETFL)&O_ACCMODE)==O_RDONLY);
    assert(::fcntl(copy,F_GETFD)&FD_CLOEXEC);::close(copy);
    assert(!::fstatat(fixture.root,"program",&after,AT_SYMLINK_NOFOLLOW));
    assert(same_file(before,after));assert(fixture.digest()==fixture.sha);
    InitialBridgeImage production;assert(!production.open(fixture.root,fixture.identity,fixture.bytes.size(),fixture.sha));
    assert(!fixture.open(image));assert(!image.current());  // No second admission attempt.
  }
  for(int kind=0;kind<11;++kind) {
    Fixture fixture;
    if(kind==0)assert(!::fchmodat(fixture.root,"program",0755,0));
    if(kind==1)assert(!::fchmodat(fixture.root,"program",04700,0));
    if(kind==2)assert(!::fchownat(fixture.root,"program",65534,65534,0));
    if(kind==3)assert(!::linkat(fixture.root,"program",fixture.root,"other",0));
    if(kind==4) {
      fixture.write("other");assert(!::unlinkat(fixture.root,"program",0));
      assert(!::symlinkat("other",fixture.root,"program"));
    }
    if(kind==5) {assert(!::unlinkat(fixture.root,"program",0));assert(!::mkdirat(fixture.root,"program",0700));}
    if(kind==6) {assert(!::unlinkat(fixture.root,"program",0));assert(!::mkfifoat(fixture.root,"program",0700));}
    if(kind==7)assert(!::unlinkat(fixture.root,"program",0));
    if(kind==8)fixture.capability();
    if(kind==9) {fixture.bytes[18]=62;fixture.write("program");fixture.sha=fixture.digest();}
    if(kind==10){fixture.bytes[37]=2;fixture.write("program");fixture.sha=fixture.digest();}
    FixtureImage image;assert(!fixture.open(image));assert(image.duplicate_verified_read_fd()<0);
  }
  for(int kind=0;kind<6;++kind) {
    Fixture fixture;FixtureImage image;
    if(kind==0)assert(!image.open(fixture.root,{fixture.identity.device,fixture.identity.inode+1},fixture.bytes.size(),fixture.sha));
    if(kind==1)assert(!image.open(fixture.root,fixture.identity,fixture.bytes.size()+1,fixture.sha));
    if(kind==2)assert(!image.open(fixture.root,fixture.identity,fixture.bytes.size(),std::string(64,'0')));
    if(kind==3)assert(!image.open(fixture.root,fixture.identity,fixture.bytes.size(),"bad"));
    if(kind==4) {assert(!::fchmod(fixture.root,0755));assert(!fixture.open(image));}
    if(kind==5)assert(!image.open(-1,fixture.identity,fixture.bytes.size(),fixture.sha));
    assert(!image.current());
  }
  for(int kind=0;kind<5;++kind) {
    Fixture fixture;FixtureImage image;assert(fixture.open(image));
    if(kind==0){fixture.bytes[52]^=1;fixture.write("program");}
    if(kind==1){fixture.write("replacement");assert(!::renameat(fixture.root,"replacement",fixture.root,"program"));}
    if(kind==2)fixture.capability();
    if(kind==3)assert(!::fchmodat(fixture.root,"program",0755,0));
    if(kind==4)assert(!::fchmod(fixture.root,0755));
    assert(!image.current());assert(image.duplicate_verified_read_fd()<0);
    if(kind==0){fixture.bytes[52]^=1;fixture.write("program");assert(!image.current());}
  }
  {
    Fixture fixture;assert(!::unlinkat(fixture.root,"program",0));
    InitialRamDirectory ram;assert(ram.open(fixture.root,fixture.identity));assert(ram.current());
    const auto copy=ram.duplicate_verified_read_fd();assert(copy>=0);
    assert((::fcntl(copy,F_GETFL)&O_ACCMODE)==O_RDONLY && (::fcntl(copy,F_GETFD)&FD_CLOEXEC));::close(copy);
    fixture.write("unexpected");assert(!ram.current());
    assert(!::unlinkat(fixture.root,"unexpected",0));assert(!ram.current());
    assert(ram.duplicate_verified_read_fd()<0);
  }
  {
    Fixture fixture;InitialRamDirectory ram;assert(!ram.open(fixture.root,fixture.identity));
    assert(!::unlinkat(fixture.root,"program",0));assert(!ram.open(fixture.root,fixture.identity));
  }
  {
    Fixture fixture;assert(!::unlinkat(fixture.root,"program",0));
    InitialRamDirectory ram;assert(!ram.open(fixture.root,{fixture.identity.device,fixture.identity.inode+1}));
  }
  std::puts("read-only initial image/RAM admission fixtures passed");
}
