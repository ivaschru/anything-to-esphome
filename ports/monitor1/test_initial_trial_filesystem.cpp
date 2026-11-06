// Read-only collector tests against an isolated tmpfs tree. All writes build
// synthetic fixtures; no production /data path, monitor or executable is used.
#ifdef NDEBUG
#error "Filesystem admission fixtures require enabled assertions"
#endif
#include "initial_trial_filesystem.h"
#include <cassert>
#include <filesystem>
#include <cstdio>

using namespace cgs1_initial_trial;
using Collector=BasicInitialFilesystem<0x01021994>;
struct Fixture {
  std::string path;int anchor{-1},data{-1},root{-1},lock{-1};InitialFilesystemBinding binding;
  Fixture() {
    char name[]="/dev/shm/qingping-initial-filesystem-XXXXXX";
    const auto created=::mkdtemp(name);assert(created);path=created;
    anchor=::open(path.c_str(),O_RDONLY|O_DIRECTORY|O_CLOEXEC);assert(anchor>=3);
    assert(!::mkdirat(anchor,"data",0700));data=::openat(anchor,"data",O_RDONLY|O_DIRECTORY|O_CLOEXEC);assert(data>=3);
    assert(!::mkdirat(data,".esphome-cgs1",0700));root=::openat(data,".esphome-cgs1",O_RDONLY|O_DIRECTORY|O_CLOEXEC);assert(root>=3);
    assert(!::mkdirat(root,".commit-disabled.lock",0700));lock=::openat(root,".commit-disabled.lock",O_RDONLY|O_DIRECTORY|O_CLOEXEC);assert(lock>=3);
    struct stat st{};assert(!::fstat(root,&st));binding.root={uint64_t(st.st_dev),uint64_t(st.st_ino)};
    binding.plan_id=std::string(32,'1');binding.plan_sha256=std::string(64,'2');binding.commit_nonce=std::string(32,'3');
    for(size_t i=0;i<Collector::PAYLOAD.size();++i) {
      const std::string text="synthetic-source-"+std::to_string(i)+"\n";
      write(Collector::PAYLOAD[i],text,i==0 || i==2 || i==3?0700:0600);
      const int fd=::openat(root,Collector::PAYLOAD[i],O_RDONLY|O_CLOEXEC);assert(fd>=3);Digest digest{};
      assert(cgs1_supervisor::image_hash(fd,text.size(),digest));::close(fd);
      binding.payload[i]={text.size(),cgs1_supervisor::digest_text(digest)};
    }
    write("install.intent",binding.plan_id+" "+binding.plan_sha256+"\n");
    write("disabled","");write("pm-helper.disabled","");
    write("owner","commit-disabled "+binding.commit_nonce+" "+binding.plan_id+"\n",0600,lock);
  }
  Fixture(const Fixture &)=delete;
  ~Fixture(){for(int fd:{lock,root,data,anchor})if(fd>=0)::close(fd);std::filesystem::remove_all(path);}
  void write(const char *name,const std::string &text,mode_t mode=0600,int directory=-1) {
    if(directory<0)directory=root;
    const int fd=::openat(directory,name,O_WRONLY|O_CREAT|O_TRUNC|O_NOFOLLOW|O_CLOEXEC,mode);assert(fd>=3);
    assert(::write(fd,text.data(),text.size())==ssize_t(text.size()));assert(!::fchmod(fd,mode));assert(!::close(fd));
  }
  bool open(Collector &scope) const{return scope.open_fixture_root(anchor,binding);}
};

int main() {
  assert(::getuid()==0 && ::geteuid()==0);
  {
    Fixture f;Collector scope;struct stat before{},after{};
    assert(!::fstatat(f.root,"program",&before,AT_SYMLINK_NOFOLLOW));
    assert(f.open(scope) && scope.current());
    const auto copy=scope.duplicate_verified_root_fd();assert(copy>=3);
    assert(private_directory(copy,f.binding.root) && ::fcntl(copy,F_GETFD)==FD_CLOEXEC);
    assert((::fcntl(copy,F_GETFL)&O_ACCMODE)==O_RDONLY);::close(copy);
    assert(!::fstatat(f.root,"program",&after,AT_SYMLINK_NOFOLLOW) && same_file(before,after));
    assert(!f.open(scope) && !scope.current() && scope.duplicate_verified_root_fd()<0);
  }
  for(int kind=0;kind<13;++kind) {
    Fixture f;Collector scope;
    if(kind==0)f.binding.plan_id="not-a-plan";
    if(kind==1)f.binding.plan_sha256[0]='G';
    if(kind==2)f.binding.commit_nonce.clear();
    if(kind==3)f.binding.root.inode++;
    if(kind==4)f.binding.payload[0].bytes++;
    if(kind==5)f.binding.payload[1].sha256=std::string(64,'0');
    if(kind==6)f.binding.payload[2].bytes=0;
    if(kind==7)f.binding.payload[3].bytes=16*1024*1024+1;
    if(kind==8)f.write("install.intent",std::string(98,'x'));
    if(kind==9)f.write("owner","wrong-owner\n",0600,f.lock);
    if(kind==10)assert(!::fchmod(f.root,0755));
    if(kind==11)assert(!::fchmod(f.lock,0755));
    if(kind==12)assert(!::fchownat(f.root,"program",65534,65534,0));
    assert(!f.open(scope));assert(!scope.current() && scope.duplicate_verified_root_fd()<0);
  }
  for(int kind=0;kind<15;++kind) {
    Fixture f;Collector scope;assert(f.open(scope));
    if(kind==0)f.write("program","tampered",0700);
    if(kind==1){f.write("next","synthetic-source-0\n",0700);assert(!::renameat(f.root,"next",f.root,"program"));}
    if(kind==2)assert(!::fchmodat(f.root,"program",0755,0));
    if(kind==3)assert(!::linkat(f.root,"program",f.root,"hardlink",0));
    if(kind==4){assert(!::unlinkat(f.root,"program",0));assert(!::symlinkat("launch.sh",f.root,"program"));}
    if(kind==5){assert(!::unlinkat(f.root,"pm-helper.disabled",0));assert(!::mkfifoat(f.root,"pm-helper.disabled",0600));}
    if(kind==6)f.write("disabled","x");
    if(kind==7)assert(!::fchmodat(f.root,"disabled",0644,0));
    if(kind==8)f.write("initial-trial.intent","partial");
    if(kind==9)assert(!::mkdirat(f.root,"wifi",0700));
    if(kind==10)assert(!::mkdirat(f.root,"full-releases",0700));
    if(kind==11)f.write("unexpected","preserve-me");
    if(kind==12)f.write("extra","preserve-owner-debris",0600,f.lock);
    if(kind==13)assert(!::renameat(f.data,".esphome-cgs1",f.data,"old-root"));
    if(kind==14)assert(!::renameat(f.anchor,"data",f.anchor,"old-data"));
    assert(!scope.current() && scope.duplicate_verified_root_fd()<0);
    // Known absence/tamper observations seal this reader permanently. Even
    // undoing an external change does not revive its previous admission.
    if(kind==6){f.write("disabled","");assert(!scope.current());}
    if(kind==8){assert(std::filesystem::exists(f.path+"/data/.esphome-cgs1/initial-trial.intent"));}
  }
  {
    Fixture f;assert(!::renameat(f.anchor,"data",f.anchor,"old-data"));
    assert(!::symlinkat("old-data",f.anchor,"data"));Collector scope;assert(!f.open(scope));
  }
  {
    Fixture f;assert(!::renameat(f.data,".esphome-cgs1",f.data,"old-root"));
    assert(!::symlinkat("old-root",f.data,".esphome-cgs1"));Collector scope;assert(!f.open(scope));
  }
  {
    Fixture f;Collector scope;assert(f.open(scope));
    assert(!::renameat(f.root,".commit-disabled.lock",f.root,"old-lock"));
    assert(!::symlinkat("old-lock",f.root,".commit-disabled.lock"));assert(!scope.current());
  }
  std::puts("initial named filesystem scope fixtures passed");
}
