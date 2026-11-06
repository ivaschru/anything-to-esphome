#pragma once

// Read-only recovery inventory for the fixed CGS1 private directory. This is
// deliberately smaller than the full takeover coordinator: it can be built
// into a stock-preserving maintenance bridge when a normal OTA will not fit.
// The separate prune action below accepts only one audited release identity
// and its two exact inodes. Passwords, preferences, history and vendor files
// are never opened. No shell, arbitrary path or radio operation is exposed.
#include "network_preflight.h"
#include "storage_release_prune.h"
#include "esphome/components/json/json_util.h"
#include <sys/vfs.h>
#include <openssl/sha.h>

namespace cgs1_storage {
struct Fd {
  int value{-1};
  explicit Fd(int v):value(v){}
  ~Fd(){if(value>=0)::close(value);}
  Fd(const Fd&)=delete;Fd&operator=(const Fd&)=delete;
};
inline bool private_dir(int fd,struct stat &s) {
  return fd>=0 && !::fstat(fd,&s) && S_ISDIR(s.st_mode) && s.st_uid==0 && (s.st_mode&07777)==0700;
}
inline bool appliance() {
  return ::getuid()==0 && ::geteuid()==0 &&
    cgs1_net_trial::read_small("/sys/class/net/wlan0/address",32)==std::string(CGS1_EXPECTED_WLAN_MAC)+"\n" &&
    cgs1_net_trial::read_link("/proc/self/exe")=="/data/.esphome-cgs1/program";
}
inline void image(int dir,JsonObject out) {
  // Only the fixed executable basename is opened. Symlinks, hard links,
  // devices and unexpectedly large files are reported as unknown, not read.
  Fd fd(::openat(dir,"program",O_RDONLY|O_NOFOLLOW|O_CLOEXEC|O_NONBLOCK));
  struct stat before{},after{};
  bool okay=fd.value>=0 && !::fstat(fd.value,&before) && S_ISREG(before.st_mode) &&
    before.st_uid==0 && before.st_nlink==1 && before.st_size>0 && before.st_size<=16*1024*1024;
  out["regular_owned_image"]=okay;
  if(!okay)return;
  out["bytes"]=uint64_t(before.st_size);out["device"]=uint64_t(before.st_dev);out["inode"]=uint64_t(before.st_ino);
  SHA256_CTX hash{};
  okay=SHA256_Init(&hash)==1;
  std::array<unsigned char,16384> buf{};uint64_t total=0;
  while(okay) {
    const auto n=::read(fd.value,buf.data(),buf.size());
    if(n<0 && errno==EINTR)continue;
    if(n<0){okay=false;break;}
    if(!n)break;
    total+=uint64_t(n);
    okay=total<=uint64_t(before.st_size) && SHA256_Update(&hash,buf.data(),size_t(n))==1;
  }
  unsigned char bytes[32]{};unsigned size=0;
  okay=okay && total==uint64_t(before.st_size) && SHA256_Final(bytes,&hash)==1 &&
    !::fstat(fd.value,&after) && before.st_dev==after.st_dev && before.st_ino==after.st_ino &&
    before.st_size==after.st_size && before.st_mtime==after.st_mtime && before.st_ctime==after.st_ctime;

  out["hash_verified"]=okay;
  if(okay){std::string hex;for(auto b:bytes){hex+="0123456789abcdef"[b>>4];hex+="0123456789abcdef"[b&15];}out["sha256"]=hex;}
}
inline bool audit(JsonObject out) {
  out["ok"]=false;out["read_only"]=true;
  if(!appliance()) {
    out["error"]="exact_root_appliance_and_bridge_path_required";return false;
  }
  Fd parent(::open("/data/.esphome-cgs1",O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC));
  struct stat st{};struct statfs fs{};
  if(!private_dir(parent.value,st) || ::fstatfs(parent.value,&fs) || fs.f_type!=0xef53) {
    out["error"]="private_ext4_directory_required";return false;
  }
  out["block_bytes"]=uint64_t(fs.f_bsize);out["blocks_free"]=uint64_t(fs.f_bfree);
  out["blocks_available"]=uint64_t(fs.f_bavail);out["inodes_free"]=uint64_t(fs.f_ffree);
  image(parent.value,out["bridge"].to<JsonObject>());
  Fd store(::openat(parent.value,"full-releases",O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC));
  struct stat ss{};
  if(!private_dir(store.value,ss) || ss.st_dev!=st.st_dev){out["error"]="private_release_store_required";return false;}
  const int copy=::fcntl(store.value,F_DUPFD_CLOEXEC,3);
  DIR *dir=copy<0 ? nullptr : ::fdopendir(copy);
  if(!dir){if(copy>=0)::close(copy);out["error"]="release_inventory_unavailable";return false;}
  auto rows=out["releases"].to<JsonArray>();unsigned found=0,ignored=0;bool truncated=false;
  while(auto *entry=::readdir(dir)) {
    const std::string name=entry->d_name;
    if(name=="."||name=="..")continue;
    if(!release_name(name)){++ignored;continue;}
    if(found++>=32){truncated=true;break;}
    Fd release(::openat(store.value,name.c_str(),O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC));struct stat rs{};
    auto row=rows.add<JsonObject>();row["release"]=name;
    if(!private_dir(release.value,rs) || rs.st_dev!=st.st_dev){row["error"]="unknown_release_directory";continue;}
    for(const char *role:{"native","guardian"}) {
      Fd child(::openat(release.value,role,O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC));struct stat cs{};
      auto data=row[role].to<JsonObject>();
      if(private_dir(child.value,cs) && cs.st_dev==st.st_dev)image(child.value,data);
      else data["regular_owned_image"]=false;
    }
  }
  ::closedir(dir);out["ignored_entries"]=ignored;out["truncated"]=truncated;out["ok"]=!truncated;
  return !truncated;
}

inline void prune(const std::string &release,const std::string &native_inode,const std::string &guardian_inode,
                  const std::string &protected_pair,JsonObject out) {
  // Separate approved obsolete pairs may be removed in one recovery session.
  // Each identity is consumed before its own first unlink; a lost ACK never
  // permits replay of that pair or deletion of a replacement inode.
  static std::vector<std::string> consumed;
  out["ok"]=false;out["native_removed"]=false;out["guardian_removed"]=false;
  for(const auto &previous:consumed)if(previous==release){out["error"]="cleanup_intent_consumed_read_inventory";return;}
  if(consumed.size()>=8){out["error"]="bounded_recovery_session_limit";return;}
  if(!appliance()){out["error"]="exact_appliance_required";return;}
  Fd parent(::open("/data/.esphome-cgs1",O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC));
  struct stat st{};struct statfs fs{};
  if(!private_dir(parent.value,st)||::fstatfs(parent.value,&fs)||fs.f_type!=0xef53){out["error"]="private_ext4_required";return;}
  // Existing boot metadata must still name the protected working pair OFF.
  // A different/active mode is an external state change, not permission to
  // prune something that another process may now need for boot or rollback.
  const auto mode=cgs1_net_trial::read_small("/data/.esphome-cgs1/full-releases/mode-v1",256);
  if(mode!="CGS1_FULL_MODE_V1\n"+protected_pair+"\n0\n"){out["error"]="unchanged_protected_mode_off_required";return;}
  Prune<> action;
  if(!action.prepare(parent.value,release,protected_pair,{{native_inode,guardian_inode}})){out["error"]=action.error();return;}
  if(!action.inactive()){out["error"]="inactive_pair_proof_required";return;}
  consumed.push_back(release); // Before unlink; an uncertain response is never replayed.
  out["ok"]=action.remove_verified();out["error"]=action.error();
  out["native_removed"]=action.removed()[0];out["guardian_removed"]=action.removed()[1];
}
} // namespace cgs1_storage
