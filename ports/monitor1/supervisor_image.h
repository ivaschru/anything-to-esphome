#pragma once

// Read/verify a fixed `program` file under an already existing private root.
// Never creates, replaces, chmods or removes an application. Optional fsync
// covers the inspected file and parent directory; ACK alone still does not
// prove behavior after a physical power loss. No credential/config file read.
#include "supervisor_image_types.h"
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <limits.h>
#include <openssl/sha.h>
#include <algorithm>
#include <array>
#include <cerrno>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>

namespace cgs1_supervisor {
using Digest = std::array<unsigned char,32>;
struct ExecutableSpec {
  uint8_t elf_class{1};uint16_t machine{40};bool arm_hard_float{true};
};
enum class ImageSync {READ_ONLY,FILE_AND_DIRECTORY};

inline bool image_same_timestamp(const struct stat &a,const struct stat &b,bool changed_link=false) {
#if defined(__APPLE__)
  const auto am=a.st_mtimespec,bm=b.st_mtimespec,ac=a.st_ctimespec,bc=b.st_ctimespec;
#else
  const auto am=a.st_mtim,bm=b.st_mtim,ac=a.st_ctim,bc=b.st_ctim;
#endif
  return am.tv_sec==bm.tv_sec && am.tv_nsec==bm.tv_nsec &&
    (changed_link || (ac.tv_sec==bc.tv_sec && ac.tv_nsec==bc.tv_nsec));
}

inline bool parse_digest(const std::string &text,Digest &result) {
  if(text.size()!=64)return false;
  Digest candidate{};
  for(size_t i=0;i<64;++i) {
    const char c=text[i];const int digit=c>='0' && c<='9'?c-'0':c>='a' && c<='f'?c-'a'+10:-1;
    if(digit<0)return false;
    candidate[i/2]|=uint8_t(digit<<((i%2)?0:4));
  }
  result=candidate;return true;
}
inline std::string digest_text(const Digest &digest) {
  char text[65];for(size_t i=0;i<32;++i)std::snprintf(text+2*i,3,"%02x",digest[i]);
  return text;
}

// Metadata alone cannot prove unchanged bytes: some filesystems coalesce
// timestamps for fast same-size writes. Rehash when attesting an executable,
// including a held old inode after OTA. The runtime adapter must bound how
// often it requests this relatively expensive attestation on the ARM host.
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wdeprecated-declarations"
inline bool image_hash(int fd,off_t size,Digest &result) {
  SHA256_CTX context{};if(SHA256_Init(&context)!=1)return false;
  std::array<unsigned char,16384> chunk{};off_t offset=0;
  while(offset<size) {
    const size_t bytes=std::min<uint64_t>(chunk.size(),uint64_t(size-offset));
    const ssize_t got=::pread(fd,chunk.data(),bytes,offset);
    if(got<0 && errno==EINTR)continue;
    if(got<=0 || SHA256_Update(&context,chunk.data(),size_t(got))!=1)return false;
    offset+=got;
  }
  return SHA256_Final(result.data(),&context)==1;
}
#pragma GCC diagnostic pop

class ImageDirectory;
class ImageFile {
 public:
  ImageFile() = default;
  ImageFile(const ImageFile &) = delete;
  ImageFile &operator=(const ImageFile &) = delete;
  ~ImageFile() {if(fd_>=0)::close(fd_);}
  Image identity() const {return identity_;}
  const Digest &digest() const {return digest_;}
  bool synced() const {return synced_;}
  bool matches_executable(const struct stat &actual) const {
    // A known running image may have nlink=0 after atomic OTA replacement.
    // Its held descriptor prevents inode reuse. This does not fence PID/start;
    // the process adapter must independently check those before any signal.
    struct stat held{},after{};Digest digest{};
    return fd_>=0 && !::fstat(fd_,&held) && identity_.verified &&
      (held.st_nlink==0 || held.st_nlink==1) && held.st_mode==snapshot_.st_mode &&
      held.st_uid==owner_ && image_same_timestamp(snapshot_,held,held.st_nlink==0) &&
      image_same_timestamp(held,actual) && S_ISREG(actual.st_mode) && actual.st_uid==owner_ &&
      uint64_t(actual.st_dev)==identity_.device && uint64_t(actual.st_ino)==identity_.inode &&
      uint64_t(actual.st_size)==identity_.bytes && held.st_size==actual.st_size &&
      actual.st_mode==held.st_mode && actual.st_nlink==held.st_nlink &&
      image_hash(fd_,held.st_size,digest) && digest==digest_ && !::fstat(fd_,&after) &&
      after.st_size==held.st_size && after.st_mode==held.st_mode && after.st_uid==held.st_uid &&
      after.st_nlink==held.st_nlink && image_same_timestamp(held,after);
  }
 private:
  friend class ImageDirectory;
  int fd_{-1};uid_t owner_{0};Image identity_;Digest digest_{};bool synced_{false};
  struct stat snapshot_{};
};

class ImageDirectory {
 public:
  ImageDirectory() = default;
  ImageDirectory(const ImageDirectory &) = delete;
  ImageDirectory &operator=(const ImageDirectory &) = delete;
  ~ImageDirectory() {if(fd_>=0)::close(fd_);}
  bool open_existing(const char *path,uid_t owner) {
    if(attempted_)return false;
    attempted_=true;
    if(!path || path[0]!='/')return fail_("absolute_private_directory_required");
    char canonical[PATH_MAX];
    if(!::realpath(path,canonical) || std::strcmp(path,canonical))return fail_("canonical_directory_required");
    const int opened=::open(path,O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
    struct stat info{};
    if(opened<0 || ::fstat(opened,&info) || !S_ISDIR(info.st_mode) ||
       info.st_uid!=owner || (info.st_mode&07777)!=0700) {
      if(opened>=0)::close(opened);
      return fail_("private_directory_required");
    }
    fd_=opened;owner_=owner;path_=path;directory_=info;
    return true;
  }
  const std::string &error() const {return error_;}
  bool inspect(ImageFile &result,const ExecutableSpec &spec={},const Digest *expected=nullptr,
               ImageSync sync=ImageSync::READ_ONLY) {
    error_.clear();
    if(!directory_current_())return fail_("directory_identity_changed");
    const int opened=::openat(fd_,"program",O_RDONLY|O_NONBLOCK|O_NOFOLLOW|O_CLOEXEC);
    if(opened<0)return fail_("program_unavailable");
    struct stat before{};Digest digest{};
    bool okay=!::fstat(opened,&before) && private_program_(before) && executable_header_(opened,before.st_size,spec);
    if(okay)okay=image_hash(opened,before.st_size,digest) && (!expected || digest==*expected);
    if(okay && sync==ImageSync::FILE_AND_DIRECTORY)okay= !::fsync(opened) && !::fsync(fd_);
    struct stat after{},entry{};
    okay=okay && !::fstat(opened,&after) && same_snapshot_(before,after) &&
      !::fstatat(fd_,"program",&entry,AT_SYMLINK_NOFOLLOW) && same_snapshot_(after,entry) && directory_current_();
    if(!okay){::close(opened);return fail_("program_verification_failed");}
    // Commit the observation only after ALL checks. A failed inspection does
    // not destroy a previous known-good held image needed for fallback/exec.
    if(result.fd_>=0)::close(result.fd_);
    result.fd_=opened;result.owner_=owner_;result.digest_=digest;
    result.snapshot_=before;
    result.identity_={uint64_t(before.st_dev),uint64_t(before.st_ino),uint64_t(before.st_size),true};
    result.synced_=sync==ImageSync::FILE_AND_DIRECTORY;
    return true;
  }
 private:
  int fd_{-1};uid_t owner_{0};bool attempted_{false};struct stat directory_{};
  std::string path_,error_;
  bool fail_(const char *error){error_=error;return false;}
  bool directory_current_() const {
    struct stat held{},path{};
    return fd_>=0 && !::fstat(fd_,&held) && !::lstat(path_.c_str(),&path) &&
      S_ISDIR(path.st_mode) && path.st_dev==directory_.st_dev && path.st_ino==directory_.st_ino &&
      held.st_dev==path.st_dev && held.st_ino==path.st_ino && path.st_uid==owner_ &&
      held.st_uid==owner_ && (path.st_mode&07777)==0700 && (held.st_mode&07777)==0700;
  }
  bool private_program_(const struct stat &s) const {
    const mode_t mode=s.st_mode&07777;
    // ESPHome host OTA changes the new image to 0755. Its required 0700
    // ancestor still protects embedded keys; never widen the parent directory.
    return S_ISREG(s.st_mode) && s.st_uid==owner_ && s.st_nlink==1 &&
      (mode==0700 || mode==0755) && s.st_size>=52 && s.st_size<=16*1024*1024;
  }
  static bool same_snapshot_(const struct stat &a,const struct stat &b) {
    return a.st_dev==b.st_dev && a.st_ino==b.st_ino && a.st_uid==b.st_uid &&
      a.st_mode==b.st_mode && a.st_nlink==b.st_nlink && a.st_size==b.st_size &&
      image_same_timestamp(a,b);
  }
  static bool executable_header_(int fd,off_t size,const ExecutableSpec &spec) {
    if((spec.elf_class!=1 && spec.elf_class!=2) || (spec.arm_hard_float &&
       (spec.elf_class!=1 || spec.machine!=40)))return false;
    std::array<unsigned char,64> h{};
    const size_t count=spec.elf_class==1?52:64;
    if(size<off_t(count) || ::pread(fd,h.data(),count,0)!=ssize_t(count) ||
       h[0]!=0x7f || h[1]!='E' || h[2]!='L' || h[3]!='F' || h[4]!=spec.elf_class || h[5]!=1 || h[6]!=1)return false;
    const auto u16=[&h](size_t at){return unsigned(h[at]) | unsigned(h[at+1])<<8;};
    const auto u32=[&h](size_t at){uint32_t result=0;for(unsigned i=0;i<4;++i)result|=uint32_t(h[at+i])<<(8*i);return result;};
    const unsigned type=u16(16);
    if((type!=2 && type!=3) || u16(18)!=spec.machine || u32(20)!=1 ||
       u16(spec.elf_class==1?40:52)!=count)return false;
    return !spec.arm_hard_float || (u32(36)&0x600)==0x400;
  }
};
}  // namespace cgs1_supervisor
