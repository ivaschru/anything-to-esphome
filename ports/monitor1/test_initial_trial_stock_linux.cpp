// Real Linux/root fd reads against private synthetic tmpfs files only.
// Fake proc entries are data, not running processes; no fork/signal/firmware.
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
int main() {
  assert(::getuid()==0 && ::geteuid()==0);
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
  for(int kind=0;kind<19;++kind) {
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
    if(kind==15)f.write("bin/busybox","abcd");
    if(kind==16)f.task(102,100,456,f.stock_path);
    if(kind==17)f.stat(100,1,1001);
    if(kind==18)f.stat(101,100,1234,"T");
    assert(!f.open(reader) && !reader.current() && !reader.observed_at_ms());
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
  std::puts("initial stock session fd fixtures passed");
}
