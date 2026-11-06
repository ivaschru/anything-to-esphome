// Real fd IO on tiny synthetic tmpfs files only. This does not contact a
// monitor, inspect the host INI/sysfs, or impersonate an installed guardian.
#ifdef NDEBUG
#error "Device identity fd fixtures require enabled assertions"
#endif
#include "initial_trial_device.h"
#include <cassert>
#include <filesystem>
#include <cstdio>
#include <utility>
using namespace cgs1_initial_trial;
using Reader=BasicInitialDeviceIdentity<0x01021994,0x01021994,0x01021994>;

template<class T,class=void> struct HasFixture:std::false_type {};
template<class T> struct HasFixture<T,std::void_t<decltype(std::declval<T&>().open_fixture_root(
  3,std::declval<const InitialDeviceIdentity&>(),"armv7l"))>>:std::true_type {};
static_assert(!HasFixture<InitialDeviceReader>::value,"Production must not expose synthetic root/CPU admission");
static_assert(HasFixture<Reader>::value,"The tmpfs fixture has an explicit isolated entry");

struct Fixture {
  std::string path;int root{-1};
  InitialDeviceIdentity expected{"02:00:00:00:00:01","12345678-1234-1234-1234-123456789abc",2};
  Fixture() {
    char name[]="/dev/shm/qingping-initial-device-XXXXXX";
    const auto created=::mkdtemp(name);assert(created);path=created;
    root=::open(path.c_str(),O_RDONLY|O_DIRECTORY|O_CLOEXEC);assert(root>=3);
    for(const auto *part:{"data","data/etc","proc","proc/sys","proc/sys/kernel","proc/sys/kernel/random",
                         "sys","sys/class","sys/class/net","sys/devices","sys/devices/wlan0"})
      assert(!::mkdirat(root,part,0700));
    // Reproduce the required kernel sysfs class link without granting data
    // or proc ancestors the same symlink allowance.
    assert(!::symlinkat("../../devices/wlan0",root,"sys/class/net/wlan0"));
    write("data/etc/os-release","CLEARGRASS_VERSION=4.1.8_0287\n");
    write("data/etc/setting.ini","[private]\nopaque=synthetic-fixture\n[sensors]\nco2_type=2\n");
    write("proc/sys/kernel/random/boot_id",expected.boot_id+"\n");
    write("sys/devices/wlan0/address",expected.wlan_mac+"\n");
  }
  ~Fixture(){assert(!::close(root));std::filesystem::remove_all(path);}
  void write(const char *name,const std::string &text) {
    const int fd=::openat(root,name,O_WRONLY|O_CREAT|O_TRUNC|O_NOFOLLOW|O_CLOEXEC,0600);assert(fd>=3);
    assert(::write(fd,text.data(),text.size())==ssize_t(text.size()));assert(!::close(fd));
  }
};
int main() {
  assert(::getuid()==0 && ::geteuid()==0);
  {
    Fixture f;Reader reader;struct stat before{},after{};
    assert(!::fstatat(f.root,"data/etc/setting.ini",&before,0));
    assert(reader.open_fixture_root(f.root,f.expected,"armv7l") && reader.current());
    assert(!::fstatat(f.root,"data/etc/setting.ini",&after,0) && same_file(before,after));
    assert(!std::string(reader.error()).size());
    assert(!reader.open_fixture_root(f.root,f.expected,"armv7l") && !reader.current());
  }
  for(int kind=0;kind<14;++kind) {
    Fixture f;Reader reader;
    if(kind==0)f.write("data/etc/setting.ini","[sensors]\nco2_type=3\n");
    if(kind==1)f.write("data/etc/os-release","CLEARGRASS_VERSION=unknown\n");
    if(kind==2)f.write("sys/devices/wlan0/address","02:00:00:00:00:02\n");
    if(kind==3)f.write("proc/sys/kernel/random/boot_id","12345678-1234-1234-1234-123456789abd\n");
    if(kind==4){assert(!::unlinkat(f.root,"data/etc/setting.ini",0));assert(!::symlinkat("os-release",f.root,"data/etc/setting.ini"));}
    if(kind==5){assert(!::unlinkat(f.root,"data/etc/setting.ini",0));assert(!::mkfifoat(f.root,"data/etc/setting.ini",0600));}
    if(kind==6)assert(!::fchmodat(f.root,"data/etc/setting.ini",0666,0));
    if(kind==7)assert(!::fchownat(f.root,"data/etc/setting.ini",65534,65534,0));
    if(kind==8)assert(!::linkat(f.root,"data/etc/setting.ini",f.root,"data/etc/extra.ini",0));
    if(kind==9)f.write("data/etc/setting.ini",std::string(65537,'x'));
    if(kind==10)f.write("data/etc/setting.ini","[sensors]\nco2_type=2\nco2_type=2\n");
    if(kind==11)assert(!::fchmodat(f.root,"data/etc",0777,0));
    if(kind==12)assert(!::unlinkat(f.root,"proc/sys/kernel/random/boot_id",0));
    assert(!reader.open_fixture_root(f.root,f.expected,kind==13?"aarch64":"armv7l"));
    assert(!reader.current() && std::string(reader.error()).find("synthetic-fixture")==std::string::npos);
  }
  for(int kind=0;kind<4;++kind) {
    Fixture f;Reader reader;assert(reader.open_fixture_root(f.root,f.expected,"armv7l"));
    if(kind==0) {
      assert(!::renameat(f.root,"data/etc/setting.ini",f.root,"data/etc/previous.ini"));
      f.write("data/etc/setting.ini","[private]\nopaque=synthetic-fixture\n[sensors]\nco2_type=2\n");
    }
    if(kind==1) {
      assert(!::renameat(f.root,"data",f.root,"data-old"));
      assert(!::mkdirat(f.root,"data",0700));
    }
    if(kind==2) {
      assert(!::renameat(f.root,"sys/devices/wlan0",f.root,"sys/devices/previous"));
      assert(!::mkdirat(f.root,"sys/devices/wlan0",0700));
      f.write("sys/devices/wlan0/address",f.expected.wlan_mac+"\n");
    }
    if(kind==3)f.write("data/etc/setting.ini","[sensors]\nco2_type=3\n");
    assert(!reader.current());
    // Restoring a once-refused value must not revive the reader or clear
    // history. A new process/receipt review is an independent operation.
    if(kind==3)f.write("data/etc/setting.ini","[sensors]\nco2_type=2\n");
    assert(!reader.current());
  }
  {
    Fixture f;
    // Production ext4 type has no fixture entry, including mixed-magic types.
    static_assert(!HasFixture<BasicInitialDeviceIdentity<0xef53,0x01021994,0x01021994>>::value);
    BasicInitialDeviceIdentity<0x9fa0,0x01021994,0x01021994> wrong_data;
    assert(!wrong_data.open_fixture_root(f.root,f.expected,"armv7l"));
    BasicInitialDeviceIdentity<0x01021994,0xef53,0x01021994> wrong_proc;
    assert(!wrong_proc.open_fixture_root(f.root,f.expected,"armv7l"));
    BasicInitialDeviceIdentity<0x01021994,0x01021994,0xef53> wrong_sys;
    assert(!wrong_sys.open_fixture_root(f.root,f.expected,"armv7l"));
    Reader bad;f.expected.co2_type=1;
    assert(!bad.open_fixture_root(f.root,f.expected,"armv7l"));
  }
  std::puts("initial device identity fd fixtures passed");
}
