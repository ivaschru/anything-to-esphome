// Local filesystem tests for the exact deletion primitive. The production
// appliance wrapper remains fixed to UID 0/ext4 and its compiled working pair.
// This fixture uses only a newly created temporary directory and its own UID;
// it cannot reach an actual CGS1 or invoke the ESPHome API.
#include "storage_release_prune.h"
#include <openssl/evp.h>
#include <cassert>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <vector>
namespace fs=std::filesystem;
using Action=cgs1_storage::Prune<CGS1_TEST_UID>;
static std::string hash(const std::string &s){unsigned char bytes[32]{};unsigned n=0;auto*c=EVP_MD_CTX_new();assert(c);assert(EVP_DigestInit_ex(c,EVP_sha256(),nullptr)==1);assert(EVP_DigestUpdate(c,s.data(),s.size())==1);assert(EVP_DigestFinal_ex(c,bytes,&n)==1&&n==32);EVP_MD_CTX_free(c);std::string out;for(auto b:bytes){out+="0123456789abcdef"[b>>4];out+="0123456789abcdef"[b&15];}return out;}
struct Fixture {
  fs::path root,release;std::string id,keep;int fd{-1};std::array<std::string,2>inodes;
  Fixture(){char path[]="/tmp/cgs1-storage-prune-XXXXXX";auto*p=::mkdtemp(path);assert(p);root=p;
    id=hash("owned-native")+"-"+hash("owned-guardian");keep=hash("keep-native")+"-"+hash("keep-guardian");
    release=root/"full-releases"/id;fs::create_directories(release/"native");fs::create_directories(release/"guardian");
    for(auto p:{root,root/"full-releases",release,release/"native",release/"guardian"})assert(!::chmod(p.c_str(),0700));
    unsigned i=0;for(const char *role:{"native","guardian"}){auto p=release/role/"program";std::ofstream(p)<<std::string("owned-")+role;assert(!::chmod(p.c_str(),0700));struct stat s{};assert(!::stat(p.c_str(),&s));inodes[i++]=std::to_string(uint64_t(s.st_ino));}
    fd=::open(root.c_str(),O_RDONLY|O_DIRECTORY|O_CLOEXEC);assert(fd>=0);
  }
  ~Fixture(){if(fd>=0)::close(fd);fs::remove_all(root);}
  bool intact()const{return fs::exists(release/"native/program")&&fs::exists(release/"guardian/program");}
};
int main(){unsigned checks=0;
  {Fixture f;Action a;assert(!a.prepare(f.fd,f.id,f.id,f.inodes));assert(f.intact());++checks;}
  {Fixture f;Action a;assert(!a.prepare(f.fd,"../unexpected",f.keep,f.inodes));assert(f.intact());++checks;}
  {Fixture f;Action a;f.inodes[0]="0";assert(!a.prepare(f.fd,f.id,f.keep,f.inodes));assert(f.intact());++checks;}
  {Fixture f;Action a;std::ofstream(f.release/"guardian/program",std::ios::trunc)<<"not-approved";assert(!a.prepare(f.fd,f.id,f.keep,f.inodes));assert(f.intact());++checks;}
  {Fixture f;Action a;fs::create_hard_link(f.release/"native/program",f.root/"extra-link");assert(!a.prepare(f.fd,f.id,f.keep,f.inodes));assert(f.intact());++checks;}
  {Fixture f;Action a;auto original=f.release/"native/program";fs::rename(original,f.root/"original");fs::create_symlink(f.root/"original",original);assert(!a.prepare(f.fd,f.id,f.keep,f.inodes));assert(f.intact());++checks;}
  {Fixture f;Action a;assert(a.prepare(f.fd,f.id,f.keep,f.inodes));fs::rename(f.release/"guardian/program",f.root/"old");std::ofstream(f.release/"guardian/program")<<"replacement";assert(!a.remove_verified());assert(f.intact());++checks;}
  {Fixture f;Action a;assert(a.prepare(f.fd,f.id,f.keep,f.inodes));fs::rename(f.release/"native",f.release/"native-old");fs::create_directory(f.release/"native");std::ofstream(f.release/"native/program")<<"replacement";assert(!a.remove_verified());assert(f.intact());++checks;}
  {Fixture f;Action a;std::ofstream(f.release/"owner-note")<<"keep";std::ofstream(f.root/"settings")<<"keep";assert(a.prepare(f.fd,f.id,f.keep,f.inodes));assert(a.remove_verified());assert(a.removed()[0]&&a.removed()[1]);assert(!fs::exists(f.release/"native/program")&&!fs::exists(f.release/"guardian/program"));assert(fs::exists(f.release/"owner-note")&&fs::exists(f.root/"settings"));assert(fs::is_directory(f.release/"native"));std::ofstream(f.release/"native/program")<<"later actor";assert(!a.remove_verified());assert(fs::exists(f.release/"native/program"));++checks;}
  std::cout<<"storage prune filesystem checks "<<checks<<" passed\n";
}
