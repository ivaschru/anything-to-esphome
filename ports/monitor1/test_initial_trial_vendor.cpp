// Linux/root fixture reads only synthetic files below its own /dev/shm tree.
// No actual vendor bytes, production paths, firmware or monitor are involved.
#ifdef NDEBUG
#error "Vendor fd fixtures require enabled assertions"
#endif
#include "initial_trial_vendor.h"
#include <cassert>
#include <filesystem>
#include <cstdio>
#include <utility>

using namespace cgs1_initial_trial;
using Reader=BasicInitialVendorFiles<0x01021994>;
template<class T,class=void> struct HasFixtureRoot:std::false_type {};
template<class T> struct HasFixtureRoot<T,std::void_t<decltype(std::declval<T &>().open_fixture_root(
  0,std::declval<const std::array<InitialVendorPin,9> &>()))>>:std::true_type {};
static_assert(!HasFixtureRoot<InitialVendorFiles>::value,"Production cannot override paths or vendor pins");
static_assert(HasFixtureRoot<Reader>::value,"Only the compile-time fixture type accepts synthetic pins");
struct Fixture {
  std::string path;int root{-1};
  std::array<std::string,9> hashes{};std::array<InitialVendorPin,9> pins{};
  Fixture() {
    char name[]="/dev/shm/qingping-initial-vendors-XXXXXX";
    const auto created=::mkdtemp(name);assert(created);path=created;
    root=::open(path.c_str(),O_RDONLY|O_DIRECTORY|O_CLOEXEC);assert(root>=3);
    for(size_t i=0;i<Reader::PATHS.size();++i) {
      const auto file=std::filesystem::path(path)/Reader::PATHS[i];
      std::filesystem::create_directories(file.parent_path());
      write(i,"abc");
      hashes[i]="ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
      pins[i]={3,hashes[i].c_str()};
    }
  }
  Fixture(const Fixture &)=delete;
  ~Fixture(){::close(root);std::filesystem::remove_all(path);}
  void write(size_t i,const std::string &text) {
    const int fd=::openat(root,Reader::PATHS[i],O_WRONLY|O_CREAT|O_TRUNC|O_NOFOLLOW|O_CLOEXEC,0600);
    assert(fd>=3 && ::write(fd,text.data(),text.size())==ssize_t(text.size()));assert(!::close(fd));
  }
};
int main() {
  assert(::getuid()==0 && ::geteuid()==0);
  {
    Fixture f;Reader reader;struct stat before{},after{};
    assert(!::fstatat(f.root,Reader::PATHS[0],&before,0));
    assert(reader.open_fixture_root(f.root,f.pins) && reader.current());
    // Reader owns its digest copies, rather than retaining mutable pointers.
    for(auto &hash:f.hashes)hash.assign(64,'0');
    assert(reader.current());
    assert(!::fstatat(f.root,Reader::PATHS[0],&after,0) && same_file(before,after));
    f.write(8,"abd");assert(!reader.current());
    f.write(8,"abc");assert(!reader.current()); // Failure permanently seals this observation.
    assert(!reader.open_fixture_root(f.root,f.pins));
  }
  for(int kind=0;kind<10;++kind) {
    Fixture f;Reader reader;
    if(kind==0)f.write(0,"abd");
    if(kind==1)f.write(0,"abcd");
    if(kind==2)assert(!::unlinkat(f.root,Reader::PATHS[8],0));
    if(kind==3){assert(!::unlinkat(f.root,Reader::PATHS[0],0));assert(!::mkfifoat(f.root,Reader::PATHS[0],0600));}
    if(kind==4){assert(!::unlinkat(f.root,Reader::PATHS[8],0));assert(!::symlinkat("../../lib/libc-2.23.so",f.root,Reader::PATHS[8]));}
    if(kind==5)assert(!::linkat(f.root,Reader::PATHS[0],f.root,"extra-link",0));
    if(kind==6)assert(!::fchownat(f.root,Reader::PATHS[0],65534,65534,0));
    if(kind==7)assert(!::fchmodat(f.root,Reader::PATHS[0],0620,0));
    if(kind==8){assert(!::renameat(f.root,"data/bin",f.root,"data/saved"));assert(!::symlinkat("saved",f.root,"data/bin"));}
    if(kind==9)assert(!::fchmodat(f.root,"lib",0777,0));
    assert(!reader.open_fixture_root(f.root,f.pins));assert(!reader.current());
  }
  {
    Fixture f;Reader reader;assert(reader.open_fixture_root(f.root,f.pins));
    assert(!::unlinkat(f.root,Reader::PATHS[0],0));f.write(0,"abc");
    assert(!reader.current()); // Identical replacement bytes do not preserve the inode baseline.
  }
  {
    Fixture f;Reader reader;assert(reader.open_fixture_root(f.root,f.pins));
    assert(!::renameat(f.root,"data",f.root,"data-old"));
    std::filesystem::create_directories(std::filesystem::path(f.path)/"data/bin");
    assert(!reader.current());
  }
  {
    Fixture f;BasicInitialVendorFiles<0x1234> wrong;
    assert(!wrong.open_fixture_root(f.root,f.pins));Reader reader;
    assert(!reader.open_fixture_root(-1,f.pins));
  }
  std::puts("initial fixed vendor fd fixtures passed");
}
