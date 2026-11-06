// Real Linux/root fd reads against private synthetic tmpfs files only.
// Fake proc entries are data. The explicit guardian-join subcase executes
// only private native copies of THIS fixture, never firmware or a monitor.
#ifdef NDEBUG
#error "Stock session fd fixtures require enabled assertions"
#endif
#include "initial_trial_stock.h"
#include <cassert>
#include <filesystem>
#include <cstdio>
#include <utility>
using namespace cgs1_initial_trial;
using Vendor=BasicInitialVendorFiles<0x01021994>;
using Reader=BasicInitialStockSession<0x01021994,0x01021994>;
template<class T,class V,class=void> struct HasFixture:std::false_type {};
template<class T,class V> struct HasFixture<T,V,std::void_t<decltype(std::declval<T&>().open_fixture_root(
  3,4,std::declval<const InitialStockIdentity&>(),std::declval<V&>(),"stock","watchdog"))>>:std::true_type {};
static_assert(!HasFixture<InitialStockSession,InitialVendorFiles>::value,"Production cannot accept a synthetic proc/root/path");
static_assert(HasFixture<Reader,Vendor>::value,"Synthetic tmpfs type has a fixture-only fd entry");

struct Fixture {
  std::string path,stock_path,watchdog_path;int root{-1},proc{-1},watchdog{-1};
  std::array<InitialVendorPin,9> pins{};InitialStockIdentity expected{101,100,1234,1000};
  Vendor vendor;
  Fixture() {
    char name[]="/dev/shm/qingping-initial-stock-XXXXXX";
    const auto created=::mkdtemp(name);assert(created);path=created;
    root=::open(path.c_str(),O_RDONLY|O_DIRECTORY|O_CLOEXEC);assert(root>=3);
    for(size_t i=0;i<Vendor::PATHS.size();++i) {
      const auto file=std::filesystem::path(path)/Vendor::PATHS[i];
      std::filesystem::create_directories(file.parent_path());write(Vendor::PATHS[i],"abc");
      pins[i]={3,"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"};
    }
    std::filesystem::create_directories(std::filesystem::path(path)/"bin");write("bin/busybox","abc");
    stock_path=path+"/data/bin/SnowApp";watchdog_path=path+"/bin/busybox";
    task(100,1,1000,watchdog_path);task(101,100,1234,stock_path);
    write("proc/101/maps","00008000-0000c000 r-xp 0 00:01 42 /data/bin/SnowApp\n");
    static constexpr char command[]="/bin/sh\0/data/bin/watchdog.sh\0";
    write("proc/100/cmdline",std::string(command,sizeof(command)-1));
    proc=::openat(root,"proc",O_RDONLY|O_DIRECTORY|O_CLOEXEC);
    watchdog=::openat(root,"bin/busybox",O_RDONLY|O_CLOEXEC);
    assert(proc>=3 && watchdog>=3 && vendor.open_fixture_root(root,pins));
  }
  ~Fixture(){assert(!::close(watchdog));assert(!::close(proc));assert(!::close(root));std::filesystem::remove_all(path);}
  void write(const std::string &name,const std::string &text) {
    const int fd=::openat(root,name.c_str(),O_WRONLY|O_CREAT|O_TRUNC|O_NOFOLLOW|O_CLOEXEC,0600);
    assert(fd>=3 && ::write(fd,text.data(),text.size())==ssize_t(text.size()));assert(!::close(fd));
  }
  void stat(uint32_t pid,uint32_t parent,uint64_t start,const std::string &state="S",uint64_t flags=4194304) {
    std::array<std::string,20> fields;fields.fill("0");
    fields[0]=state;fields[1]=std::to_string(parent);fields[6]=std::to_string(flags);fields[19]=std::to_string(start);
    std::string text=std::to_string(pid)+" (fixture ) worker)";
    for(const auto &field:fields)text+=" "+field;
    write("proc/"+std::to_string(pid)+"/stat",text+"\n");
  }
  void task(uint32_t pid,uint32_t parent,uint64_t start,const std::string &executable) {
    const auto name="proc/"+std::to_string(pid);
    std::filesystem::create_directories(std::filesystem::path(path)/name);stat(pid,parent,start);
    if(!executable.empty())assert(!::symlinkat(executable.c_str(),root,(name+"/exe").c_str()));
  }
  bool open(Reader &reader) {return reader.open_fixture_root(proc,watchdog,expected,vendor,stock_path,watchdog_path);}
};
static int guardian_join(const std::string &path,int kind) {
  Fixture f;Reader::SelfReader self;
  const auto actor=cgs1_supervisor::process_stamp(::getpid());
  assert(actor.pid!=int(f.expected.stock_pid) && actor.pid!=int(f.expected.watchdog_pid));
  struct stat root{},program{};assert(!::stat(path.c_str(),&root));
  const int image=::open("/proc/self/exe",O_RDONLY|O_CLOEXEC);assert(image>=3);
  assert(!::fstat(image,&program));Digest digest{};
  assert(cgs1_supervisor::image_hash(image,program.st_size,digest));
  assert(self.open_native_fixture(path,{uint64_t(root.st_dev),uint64_t(root.st_ino)},
    program.st_size,cgs1_supervisor::digest_text(digest)));
  f.task(actor.pid,actor.parent,actor.start,path+"/program");
  {Reader strict;assert(!f.open(strict));} // Default never acquires an exemption.
  Reader reader;
  assert(reader.open_fixture_root(f.proc,f.watchdog,f.expected,f.vendor,f.stock_path,f.watchdog_path,&self));
  assert(reader.current() && self.current());
  if(kind==1) {
    f.stat(actor.pid,actor.parent,actor.start+1);
    assert(!reader.current());f.stat(actor.pid,actor.parent,actor.start);assert(!reader.current());
  } else if(kind==2) {
    // Even the same actual image inode at another reported PID is not self.
    f.task(actor.pid+1,actor.parent,actor.start,path+"/program");
    assert(!reader.current());
  } else if(kind==3) {
    f.write("proc/101/maps","00008000-0000c000 r-xp 0 00:01 42 /tmp/qingping-initial-guardian-other/program\n");
    assert(!reader.current()); // Self evidence never exempts a stock mapping.
  } else if(kind==4) {
    assert(!::chmod((path+"/program").c_str(),0755));assert(!reader.current());
    assert(!::chmod((path+"/program").c_str(),0700));assert(!reader.current());
  } else assert(kind==0);
  assert(!::close(image));return 0;
}
int main(int argc,char **argv) {
  assert(::getuid()==0 && ::geteuid()==0);
  if(argc==4 && !std::strcmp(argv[1],"--fixture-guardian"))return guardian_join(argv[2],std::atoi(argv[3]));
  assert(argc==1);
  {
    Fixture f;Reader reader;struct stat before{},after{};
    // Missing exe is accepted only for positively observed dead/kernel tasks.
    f.task(102,1,456,"");f.stat(102,1,456,"S",0x00200000);
    f.task(103,1,789,"");f.stat(103,1,789,"Z",0);
    assert(!::fstatat(f.root,"data/bin/SnowApp",&before,0));
    assert(f.open(reader) && reader.current() && reader.observed_at_ms());
    assert(!::fstatat(f.root,"data/bin/SnowApp",&after,0) && same_file(before,after));
    assert(!f.open(reader) && !reader.current() && !reader.observed_at_ms());
  }
  for(int kind=0;kind<22;++kind) {
    Fixture f;Reader reader;
    if(kind==0)assert(!::unlinkat(f.root,"proc/101/stat",0));
    if(kind==1)f.stat(101,100,1235);
    if(kind==2)f.stat(101,99,1234);
    if(kind==3)f.write("proc/100/cmdline","/bin/sh /data/bin/watchdog.sh");
    if(kind==4){assert(!::unlinkat(f.root,"proc/101/exe",0));assert(!::symlinkat(f.watchdog_path.c_str(),f.root,"proc/101/exe"));}
    if(kind==5)f.task(102,1,456,"/data/.esphome-cgs1/program (deleted)");
    if(kind==6)f.write("proc/101/maps","00008000-0000c000 r-xp 0 00:01 42 /data/.esphome-cgs1/pm_qt_bridge.so\n");
    if(kind==7)f.write("proc/101/maps","unreadable-like malformed data\n");
    if(kind==8)assert(!::unlinkat(f.root,"proc/101/maps",0));
    if(kind==9)f.write("proc/101/maps",std::string(1048577,'x'));
    if(kind==10){assert(!::unlinkat(f.root,"proc/101/maps",0));assert(!::symlinkat("stat",f.root,"proc/101/maps"));}
    if(kind==11)assert(!::fchownat(f.root,"proc/101",65534,65534,0));
    if(kind==12)f.task(102,1,456,""); // Live userspace with unreadable exe is NEVER absent.
    if(kind==13){assert(!::unlinkat(f.root,"proc/101/maps",0));assert(!::mkfifoat(f.root,"proc/101/maps",0600));}
    if(kind==14)f.write("data/bin/SnowApp","abcd");
    // BusyBox is bound by the newly captured named inode and production RO
    // mount, not a fabricated vendor digest. Before admission test its
    // required non-writable mode; post-baseline replacement is tested below.
    if(kind==15)assert(!::fchmodat(f.root,"bin/busybox",0666,0));
    if(kind==16)f.task(102,100,456,f.stock_path);
    if(kind==17)f.stat(100,1,1001);
    if(kind==18)f.stat(101,100,1234,"T");
    if(kind==19)f.task(102,1,456,"/tmp/qingping-full-previous/native-program (deleted)");
    if(kind==20)f.task(102,1,456,"/tmp/qingping-initial-trial-previous/program");
    if(kind==21)f.write("proc/101/maps","00008000-0000c000 r-xp 0 00:01 42 /tmp/qingping-full-old/extension.so\n");
    const bool opened=f.open(reader);
    if(opened)std::fprintf(stderr,"stock negative fixture %d unexpectedly admitted\n",kind);
    assert(!opened && !reader.current() && !reader.observed_at_ms());
  }
  for(int kind=0;kind<6;++kind) {
    Fixture f;Reader reader;assert(f.open(reader));
    if(kind==0)f.stat(101,100,1235);
    if(kind==1) {
      assert(!::renameat(f.root,"bin/busybox",f.root,"bin/previous"));f.write("bin/busybox","abc");
    }
    if(kind==2)f.task(102,1,456,"");
    if(kind==3)f.write("proc/101/maps","00008000-0000c000 r-xp 0 00:01 42 /data/.esphome-cgs1/new.so\n");
    if(kind==4)assert(!::fchown(f.proc,65534,65534));
    if(kind==5)assert(!::fchmod(f.proc,0777));
    assert(!reader.current() && !reader.observed_at_ms());
    if(kind==0)f.stat(101,100,1234);
    assert(!reader.current()); // No restoration, reopening or adoption after a refusal.
  }
  {
    Fixture f;BasicInitialStockSession<0xef53,0x01021994> wrong;
    assert(!wrong.open_fixture_root(f.proc,f.watchdog,f.expected,f.vendor,f.stock_path,f.watchdog_path));
    Reader reader;assert(!reader.open_fixture_root(-1,f.watchdog,f.expected,f.vendor,f.stock_path,f.watchdog_path));
  }
  for(int kind=0;kind<5;++kind) {
    char name[]="/tmp/qingping-initial-guardian-fixture-XXXXXX";
    const auto created=::mkdtemp(name);assert(created);const std::string path=created;
    std::filesystem::copy_file("/proc/self/exe",path+"/program");assert(!::chmod((path+"/program").c_str(),0700));
    const auto child=::fork();assert(child>=0);
    if(!child) {
      const auto value=std::to_string(kind);
      ::execl((path+"/program").c_str(),"stock-guardian-fixture","--fixture-guardian",path.c_str(),value.c_str(),nullptr);
      _exit(98);
    }
    int status=0;assert(::waitpid(child,&status,0)==child);
    if(!WIFEXITED(status) || WEXITSTATUS(status))std::fprintf(stderr,"stock guardian fixture %d failed: %d\n",kind,status);
    assert(WIFEXITED(status) && WEXITSTATUS(status)==0);std::filesystem::remove_all(path);
  }
  std::puts("initial stock session fd fixtures passed");
}
