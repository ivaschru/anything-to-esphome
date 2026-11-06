// Linux/root end-to-end READ-ONLY join over a private synthetic tmpfs tree.
// The fake ARM header is never executed. Actual host boot/self metadata are
// read only for the creator-owned temporary intent/inert-entry cases; there
// is no monitor, USB, production path write, signal, fork or firmware start.
#ifdef NDEBUG
#error "Joined pre-start fixtures require enabled assertions"
#endif
#include "initial_trial_scope.h"
#include <cassert>
#include <filesystem>
#include <cstdio>
#include <utility>
using namespace cgs1_initial_trial;
using Vendor=BasicInitialVendorFiles<0x01021994>;
using Files=BasicInitialFilesystem<0x01021994>;
using Scope=BasicInitialPrestartScope<0x01021994,0x01021994,0x01021994,0x01021994>;
using Intent=BasicInitialTrialIntent<0x01021994>;
template<class T,class=void> struct HasFixture:std::false_type {};
template<class T> struct HasFixture<T,std::void_t<decltype(std::declval<T&>().open_fixture_root(
  3,4,5,std::declval<const InitialScopeBinding&>(),std::declval<const std::array<InitialVendorPin,9>&>(),
  "stock","watchdog"))>>:std::true_type {};
static_assert(!HasFixture<InitialPrestartScope>::value,"Production must not expose fixture roots/pins");
static_assert(HasFixture<Scope>::value,"Only explicit all-synthetic filesystem types admit fixtures");

struct Fixture {
  std::string path,stock_path,watchdog_path,ram_leaf;int root{-1},proc{-1},watchdog{-1};
  InitialScopeBinding binding;std::array<InitialVendorPin,9> pins{};
  Fixture() {
    char name[]="/dev/shm/qingping-initial-scope-XXXXXX";
    const auto made=::mkdtemp(name);assert(made);path=made;
    root=::open(path.c_str(),O_RDONLY|O_DIRECTORY|O_CLOEXEC);assert(root>=3);
    binding.device.wlan_mac="02:00:00:00:00:01";binding.device.co2_type=2;
    std::ifstream boot("/proc/sys/kernel/random/boot_id");assert(std::getline(boot,binding.device.boot_id));
    binding.stock={101,100,1234,1000};binding.ram_job_id=std::string(32,'a');
    binding.filesystem.plan_id=std::string(32,'1');binding.filesystem.plan_sha256=std::string(64,'2');
    binding.filesystem.commit_nonce=std::string(32,'3');
    for(size_t i=0;i<Vendor::PATHS.size();++i) {
      write(Vendor::PATHS[i],"abc");
      pins[i]={3,"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"};
    }
    write("data/etc/os-release","CLEARGRASS_VERSION=4.1.8_0287\n");
    write("data/etc/setting.ini","[private]\nopaque=synthetic-only\n[sensors]\nco2_type=2\n");
    write("proc/sys/kernel/random/boot_id",binding.device.boot_id+"\n");
    write("sys/devices/wlan0/address",binding.device.wlan_mac+"\n");
    directories("sys/class/net");assert(!::symlinkat("../../devices/wlan0",root,"sys/class/net/wlan0"));
    directories("data/.esphome-cgs1");assert(!::fchmodat(root,"data/.esphome-cgs1",0700,0));
    directories("data/.esphome-cgs1/.commit-disabled.lock");
    assert(!::fchmodat(root,"data/.esphome-cgs1/.commit-disabled.lock",0700,0));
    struct stat st{};assert(!::fstatat(root,"data/.esphome-cgs1",&st,0));
    binding.filesystem.root={uint64_t(st.st_dev),uint64_t(st.st_ino)};
    for(size_t i=0;i<Files::PAYLOAD.size();++i) {
      std::string bytes="synthetic-payload-"+std::to_string(i)+"\n";
      if(i==0) {
        bytes.assign(52,'\0');bytes[0]=0x7f;bytes[1]='E';bytes[2]='L';bytes[3]='F';
        bytes[4]=1;bytes[5]=1;bytes[6]=1;bytes[16]=2;bytes[18]=40;bytes[20]=1;bytes[37]=4;bytes[40]=52;
      }
      const auto file=std::string("data/.esphome-cgs1/")+Files::PAYLOAD[i];
      write(file,bytes,i==0 || i==2 || i==3?0700:0600);
      const int fd=::openat(root,file.c_str(),O_RDONLY|O_CLOEXEC);assert(fd>=3);Digest sha{};
      assert(cgs1_supervisor::image_hash(fd,bytes.size(),sha));assert(!::close(fd));
      binding.filesystem.payload[i]={bytes.size(),cgs1_supervisor::digest_text(sha)};
    }
    const auto &b=binding.filesystem;
    write("data/.esphome-cgs1/install.intent",b.plan_id+" "+b.plan_sha256+"\n");
    write("data/.esphome-cgs1/disabled","");write("data/.esphome-cgs1/pm-helper.disabled","");
    write("data/.esphome-cgs1/.commit-disabled.lock/owner","commit-disabled "+b.commit_nonce+" "+b.plan_id+"\n");
    ram_leaf="tmp/qingping-initial-trial-"+binding.ram_job_id;directories(ram_leaf);
    assert(!::fchmodat(root,"tmp",01777,0));assert(!::fchmodat(root,ram_leaf.c_str(),0700,0));
    assert(!::fstatat(root,ram_leaf.c_str(),&st,0));binding.ram={uint64_t(st.st_dev),uint64_t(st.st_ino)};
    write("proc/meminfo","MemTotal: 131072 kB\nMemFree: 65536 kB\n");
    write("proc/net/tcp","sl local_address rem_address st\n");
    write("proc/net/tcp6","sl local_address remote_address st\n");
    write("bin/busybox","mock-busybox\n");stock_path=path+"/data/bin/SnowApp";watchdog_path=path+"/bin/busybox";
    task(100,1,1000,watchdog_path);task(101,100,1234,stock_path);
    static constexpr char args[]="/bin/sh\0/data/bin/watchdog.sh\0";
    write("proc/100/cmdline",std::string(args,sizeof(args)-1));
    write("proc/101/maps","00008000-0000c000 r-xp 0 00:01 42 /data/bin/SnowApp\n");
    proc=::openat(root,"proc",O_RDONLY|O_DIRECTORY|O_CLOEXEC);
    watchdog=::openat(root,"bin/busybox",O_RDONLY|O_CLOEXEC);assert(proc>=3 && watchdog>=3);
  }
  ~Fixture(){for(int fd:{watchdog,proc,root})assert(!::close(fd));std::filesystem::remove_all(path);}
  void directories(const std::string &name){std::filesystem::create_directories(std::filesystem::path(path)/name);}
  void write(const std::string &name,const std::string &bytes,mode_t mode=0600) {
    directories(std::filesystem::path(name).parent_path().string());
    const int fd=::openat(root,name.c_str(),O_WRONLY|O_CREAT|O_TRUNC|O_NOFOLLOW|O_CLOEXEC,mode);assert(fd>=3);
    assert(::write(fd,bytes.data(),bytes.size())==ssize_t(bytes.size()));assert(!::fchmod(fd,mode));assert(!::close(fd));
  }
  void task(uint32_t pid,uint32_t parent,uint64_t start,const std::string &exe) {
    std::array<std::string,20> fields;fields.fill("0");
    fields[0]="S";fields[1]=std::to_string(parent);fields[6]="4194304";fields[19]=std::to_string(start);
    std::string text=std::to_string(pid)+" (synthetic worker)";
    for(const auto &field:fields)text+=" "+field;
    const auto base="proc/"+std::to_string(pid);write(base+"/stat",text+"\n");
    assert(!::symlinkat(exe.c_str(),root,(base+"/exe").c_str()));
  }
  bool open(Scope &scope) {
    const bool okay=scope.open_fixture_root(root,proc,watchdog,binding,pins,stock_path,watchdog_path);
    return okay;
  }
  IntentBinding intent() const {
    IntentBinding value;value.plan_id=binding.filesystem.plan_id;value.plan_sha256=binding.filesystem.plan_sha256;
    value.boot_id=binding.device.boot_id;value.bridge_sha256=binding.filesystem.payload[0].sha256;
    value.guardian_sha256=std::string(64,'4');value.nonce=std::string(32,'5');value.ram=binding.ram;return value;
  }
};
int main() {
  assert(::getuid()==0 && ::geteuid()==0);
  {
    Fixture f;Scope scope;struct stat before{},after{};
    assert(!::fstatat(f.root,"data/.esphome-cgs1/program",&before,0));
    const bool opened=f.open(scope);if(!opened)std::fprintf(stderr,"joined open: %s\n",scope.error());assert(opened);
    const auto value=scope.read();assert(value.verified && value.conservative_free_bytes==64ULL*1024*1024 && value.observed_at_ms);
    const int fd=scope.duplicate_verified_root_fd();assert(fd>=3 && private_directory(fd,f.binding.filesystem.root));
    assert(::fcntl(fd,F_GETFD)==FD_CLOEXEC && (::fcntl(fd,F_GETFL)&O_ACCMODE)==O_RDONLY);assert(!::close(fd));
    assert(!::fstatat(f.root,"data/.esphome-cgs1/program",&after,0) && same_file(before,after));
    assert(!f.open(scope) && !scope.read().verified);
  }
  for(int kind=0;kind<8;++kind) {
    Fixture f;Scope scope;
    if(kind==0)f.binding.device.co2_type=3;
    if(kind==1)++f.binding.stock.stock_start;
    if(kind==2)++f.binding.ram.inode;
    if(kind==3)++f.binding.filesystem.root.inode;
    if(kind==4)f.binding.filesystem.payload[0].sha256=std::string(64,'0');
    if(kind==5)f.write("tmp/qingping-cgs1-esphome.lock","");
    if(kind==6)f.write("proc/net/tcp6","partial");
    if(kind==7)f.write("data/.esphome-cgs1/unknown","preserve-me");
    assert(!f.open(scope) && !scope.current() && !scope.read().verified && scope.duplicate_verified_root_fd()<0);
  }
  for(int kind=0;kind<10;++kind) {
    Fixture f;Scope scope;assert(f.open(scope));
    if(kind==0)f.write("data/etc/setting.ini","[sensors]\nco2_type=3\n");
    if(kind==1)f.write("usr/lib/libQt5Core.so.5.9.4","abd");
    if(kind==2)f.write("tmp/qingping-cgs1-esphome.lock","");
    if(kind==3)f.write("data/.esphome-cgs1/program","changed",0700);
    if(kind==4)f.write("proc/101/maps","00008000-0000c000 r-xp 0 00:01 42 /tmp/qingping-full-old/extension.so\n");
    if(kind==5)f.write("proc/meminfo","MemTotal: 131072 kB\nMemFree: 0 kB\n");
    if(kind==6)f.task(102,1,567,"/tmp/qingping-initial-old/program (deleted)");
    if(kind==7)f.write(f.ram_leaf+"/prefs","history");
    if(kind==8)assert(!::unlinkat(f.root,"data/.esphome-cgs1/pm-helper.disabled",0));
    if(kind==9)f.write("proc/net/tcp","sl local_address rem_address st\n0: 00000000:17A5 00000000:0000 0A\n");
    assert(!scope.current());const auto value=scope.read();
    assert(!value.verified && !value.conservative_free_bytes && !value.observed_at_ms);
    if(kind==5)f.write("proc/meminfo","MemTotal: 131072 kB\nMemFree: 65536 kB\n");
    assert(!scope.current()); // No restoration or reusing a prior positive join.
  }
  {
    Fixture f;Intent intent;Scope scope;assert(f.open(scope));
    const int fd=scope.duplicate_verified_root_fd();assert(fd>=3);
    assert(intent.open(fd,f.binding.filesystem.root,f.intent()));assert(!::close(fd));assert(intent.claim());
    assert(scope.acknowledge_intent(intent) && scope.current() && intent.current());
    BasicInitialBridgeEntry<0x01021994> entry;
    assert(scope.prepare_entry(entry)); // Inert only: fake ARM header is NEVER exec'd or forked.
    assert(!scope.prepare_entry(entry) && !scope.current());
  }
  for(int kind=0;kind<3;++kind) {
    Fixture f;Intent intent;Scope scope;assert(f.open(scope));
    const int fd=scope.duplicate_verified_root_fd();assert(fd>=3);auto binding=f.intent();
    if(kind==0)++binding.ram.inode;
    if(kind==1)binding.plan_id=std::string(32,'9');
    assert(intent.open(fd,f.binding.filesystem.root,binding));assert(!::close(fd));
    if(kind!=2)assert(intent.claim());
    assert(!scope.acknowledge_intent(intent) && !scope.current());
    if(kind!=2)assert(intent.current()); // Refusal preserves the synthetic record; no cleanup.
  }
  std::puts("joined initial pre-start scope fixtures passed");
}
