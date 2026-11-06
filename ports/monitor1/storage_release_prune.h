#pragma once
// POSIX-only implementation shared by the appliance wrapper and local
// filesystem tests. There is no remote path/UID/filesystem override here;
// callers must first admit their fixed parent FD and protect the live pair.
#include <openssl/sha.h>
#include <array>
#include <string>
#include <cerrno>
#include <cstdint>
#include <dirent.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>
namespace cgs1_storage {
inline bool digest(const std::string &s) {
  if(s.size()!=64)return false;
  for(char c:s)if(!((c>='0'&&c<='9')||(c>='a'&&c<='f')))return false;
  return true;
}
inline bool release_name(const std::string &s) {
  return s.size()==129 && s[64]=='-' && digest(s.substr(0,64)) && digest(s.substr(65));
}
// The only deletion primitive is separately testable on an already trusted
// directory FD. The production wrapper below supplies the exact ext4 root;
// an API caller cannot replace that FD, filesystem, UID or protected pair.
// Preparation verifies BOTH artifacts before touching either. Directory
// entries are compared with held FDs again immediately before each unlink.
// Only the two program files are removed: logs/settings/extra entries and
// even the now-empty role directories remain untouched.
template<unsigned Owner=0> class Prune {
 public:
  bool prepare(int parent,const std::string &release,const std::string &keep,
               const std::array<std::string,2>&inodes) {
    if(attempted_ || !release_name(release) || !release_name(keep) || release==keep)return fail("protected_or_invalid_release");
    attempted_=true;struct stat parent_stat{};
    if(!dir_(parent,parent_stat))return fail("private_parent_required");
    parent_=::fcntl(parent,F_DUPFD_CLOEXEC,3);
    store_=::openat(parent_,"full-releases",O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
    struct stat st{};if(!dir_(store_,st) || st.st_dev!=parent_stat.st_dev)return fail("private_store_required");
    release_=::openat(store_,release.c_str(),O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
    if(!dir_(release_,st) || st.st_dev!=parent_stat.st_dev)return fail("private_release_required");
    identity_=release;
    for(unsigned i=0;i<2;++i) {
      roles_[i]=::openat(release_,i?"guardian":"native",O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
      if(!dir_(roles_[i],st) || st.st_dev!=parent_stat.st_dev)return fail("private_role_required");
      images_[i]=::openat(roles_[i],"program",O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC);
      auto &s=stats_[i];
      if(images_[i]<0 || ::fstat(images_[i],&s) || !S_ISREG(s.st_mode) || s.st_uid!=Owner ||
         (s.st_mode&07777)!=0700 || s.st_nlink!=1 || s.st_dev!=parent_stat.st_dev ||
         s.st_size<=0 || s.st_size>16*1024*1024 || std::to_string(uint64_t(s.st_ino))!=inodes[i])
        return fail("audited_regular_image_required");
      SHA256_CTX hash{};bool okay=SHA256_Init(&hash)==1;
      std::array<unsigned char,16384> buffer{};uint64_t total=0;
      while(okay){const auto n=::read(images_[i],buffer.data(),buffer.size());if(n<0&&errno==EINTR)continue;
        if(n<0){okay=false;break;}if(!n)break;total+=uint64_t(n);
        okay=total<=uint64_t(s.st_size) && SHA256_Update(&hash,buffer.data(),size_t(n))==1;}
      unsigned char bytes[32]{};unsigned size=0;
      okay=okay && total==uint64_t(s.st_size) && SHA256_Final(bytes,&hash)==1;
      std::string actual;
      if(okay)for(auto b:bytes){actual+="0123456789abcdef"[b>>4];actual+="0123456789abcdef"[b&15];}
      if(!okay || actual!=release.substr(i?65:0,64) || !current_(i))return fail("audited_hash_or_inode_changed");
    }
    return prepared_=true;
  }
  // The wrapper independently checks /proc before calling this method. Tests
  // exercise the filesystem primitive without pretending to inspect a CGS1.
  bool remove_verified() {
    if(!prepared_ || removed_attempted_)return fail("prepared_unconsumed_pair_required");
    removed_attempted_=true;
    if(!current_(0)||!current_(1))return fail("pair_changed_before_removal");
    for(unsigned i=0;i<2;++i) {
      if(!current_(i)||::unlinkat(roles_[i],"program",0))return fail("image_removal_incomplete");
      removed_[i]=true;
      if(::fsync(roles_[i]))return fail("directory_sync_failed");
    }
    return true;
  }
  bool inactive() const {
#if defined(__linux__)
    DIR *proc=::opendir("/proc");if(!proc)return false;
    bool okay=true;unsigned count=0;
    while(auto *entry=::readdir(proc)) {
      const std::string name=entry->d_name;
      if(name.empty() || name.find_first_not_of("0123456789")!=std::string::npos)continue;
      if(++count>16384){okay=false;break;}
      struct stat s{};const auto path="/proc/"+name+"/exe";
      if(::stat(path.c_str(),&s)) {if(errno==ENOENT||errno==ESRCH)continue;okay=false;break;}
      for(const auto &image:stats_)if(s.st_dev==image.st_dev && s.st_ino==image.st_ino)okay=false;
      if(!okay)break;
    }
    ::closedir(proc);return okay;
#else
    return false;
#endif
  }
  const std::array<bool,2>&removed()const{return removed_;}
  const char *error()const{return error_;}
  ~Prune(){for(int fd:{images_[0],images_[1],roles_[0],roles_[1],release_,store_,parent_})if(fd>=0)::close(fd);}
  Prune()=default;Prune(const Prune&)=delete;Prune&operator=(const Prune&)=delete;
 private:
  int parent_{-1},store_{-1},release_{-1};std::array<int,2>roles_{{-1,-1}},images_{{-1,-1}};
  std::array<struct stat,2>stats_{};std::array<bool,2>removed_{{false,false}};
  std::string identity_;bool attempted_{false},prepared_{false},removed_attempted_{false};const char *error_{""};
  bool fail(const char *s){error_=s;return false;}
  static bool dir_(int fd,struct stat &s){return fd>=0&&!::fstat(fd,&s)&&S_ISDIR(s.st_mode)&&s.st_uid==Owner&&(s.st_mode&07777)==0700;}
  bool current_(unsigned i)const {
    struct stat held{},named{},rd{},rn{},sd{},sn{},role{},role_named{};
    const auto &old=stats_[i];
    return !::fstat(store_,&sd) && !::fstatat(parent_,"full-releases",&sn,AT_SYMLINK_NOFOLLOW) &&
      sd.st_dev==sn.st_dev && sd.st_ino==sn.st_ino && S_ISDIR(sn.st_mode) &&
      !::fstat(release_,&rd) && !::fstatat(store_,identity_.c_str(),&rn,AT_SYMLINK_NOFOLLOW) &&
      rd.st_dev==rn.st_dev && rd.st_ino==rn.st_ino && S_ISDIR(rn.st_mode) &&
      !::fstat(roles_[i],&role) && !::fstatat(release_,i?"guardian":"native",&role_named,AT_SYMLINK_NOFOLLOW) &&
      role.st_dev==role_named.st_dev && role.st_ino==role_named.st_ino && S_ISDIR(role_named.st_mode) &&
      !::fstat(images_[i],&held) && !::fstatat(roles_[i],"program",&named,AT_SYMLINK_NOFOLLOW) &&
      S_ISREG(named.st_mode) && named.st_dev==old.st_dev && named.st_ino==old.st_ino &&
      held.st_dev==old.st_dev && held.st_ino==old.st_ino && held.st_size==old.st_size &&
      held.st_mtime==old.st_mtime && held.st_ctime==old.st_ctime && held.st_nlink==1;
  }
};
} // namespace cgs1_storage
