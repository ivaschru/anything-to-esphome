#pragma once

#include <openssl/evp.h>
#include <array>
#include <cerrno>
#include <cstdint>
#include <cstring>
#include <cstdlib>
#include <fcntl.h>
#include <string>
#include <sys/stat.h>
#include <unistd.h>
#if defined(__linux__)
#include <sys/vfs.h>
#endif

namespace cgs1_net_trial {
struct TrialStagingLayout {
  static constexpr std::array<const char *,5> NAMES={"program","thermal-observer","guard.sh","pm-pinmux","wifi-rollback"};
  static bool accepts_job(const std::string &){return true;}
  static std::string create(const std::string &) {
    char pattern[]="/tmp/qingping-takeover-net-XXXXXX";
    char *created=::mkdtemp(pattern);return created?created:"";
  }
};
struct FullStagingLayout {
  static constexpr std::array<const char *,2> NAMES={"native-program","guardian-program"};
  static bool accepts_job(const std::string &job){return job.size()==16 && job!=std::string(16,'0');}
  static std::string create(const std::string &job) {
#if defined(__linux__)
    // No caller-controlled path component: the already validated lowercase
    // nonce is exactly 16 hex digits. An existing job is preserved/refused.
    if(::getuid()!=0 || ::geteuid()!=0)return {};
    const auto path="/tmp/qingping-full-"+job;
    if(::mkdir(path.c_str(),0700))return {};
    struct statfs fs{};
    if(::statfs(path.c_str(),&fs) || fs.f_type!=0x01021994)return {};
    return path;
#else
    (void)job;return {};  // No appliance full-layout staging on macOS.
#endif
  }
};
// An authenticated trial API can transport only FIVE pre-approved artifacts.
// Artifact names and exact hashes come from the locally generated build
// manifest, never from the uploader. This class stages bytes in private RAM;
// it has no process-launch, calibration, network-configuration or flash API.
template<class Layout> class BasicStaging {
 public:
  struct Artifact { uint32_t size; std::string sha256; };
  static constexpr size_t COUNT = Layout::NAMES.size();
  static constexpr auto NAMES=Layout::NAMES;
  static constexpr uint32_t MAX_ARTIFACT=16*1024*1024;
  static constexpr size_t MAX_CHUNK=1024;
  explicit BasicStaging(const std::array<Artifact,COUNT>& manifest):manifest_(manifest){}
  BasicStaging(const BasicStaging&)=delete;
  BasicStaging& operator=(const BasicStaging&)=delete;
  ~BasicStaging(){for(auto &s:slots_)close_slot(s);if(directory_fd_>=0)::close(directory_fd_);}
  const std::string &error() const{return error_;}
  const std::string &job() const{return job_;}
  const std::string &directory() const{return directory_;}
  uint32_t offset(int kind) const{return kind>=0 && kind<int(COUNT)?slots_[kind].offset:0;}
  bool verified(int kind) const{return kind>=0 && kind<int(COUNT) && slots_[kind].verified;}
  bool ready() const{for(size_t i=0;i<COUNT;++i)if(!verified(i))return false;return true;}
  Artifact approved(int kind) const{return kind>=0 && kind<int(COUNT)?manifest_[kind]:Artifact{};}
  // C++-only handoff to the fixed materializer; no descriptor/path is exposed
  // by an API action. Revalidation precedes duplication of the held directory.
  int duplicate_verified_directory() {
    return revalidate(job_)?::fcntl(directory_fd_,F_DUPFD_CLOEXEC,3):-1;
  }
  // A streamed digest proves receipt, not that a later file still contains
  // those bytes. Re-read all approved regular files immediately before a helper
  // or trial launch; also reject replacement inodes and changed private modes.
  bool revalidate(const std::string &job) {
    error_.clear();
    if(!same_job(job) || !ready())return fail("sealed_job_required");
    struct stat dir{};
    if(::lstat(directory_.c_str(),&dir) || dir.st_dev!=directory_identity_.st_dev ||
       dir.st_ino!=directory_identity_.st_ino || !S_ISDIR(dir.st_mode) ||
       dir.st_uid!=::geteuid() || (dir.st_mode&0777)!=0700)
      return fail("staging_directory_identity_changed");
    for(size_t i=0;i<COUNT;++i) {
      int fd=::openat(directory_fd_,NAMES[i],O_RDONLY|O_NOFOLLOW|O_CLOEXEC);
      struct stat before{},after{};
      if(fd<0)return fail("sealed_artifact_missing");
      const auto &original=slots_[i].identity;
      bool okay=!::fstat(fd,&before) && S_ISREG(before.st_mode) &&
        before.st_uid==::geteuid() && (before.st_mode&0777)==0700 &&
        before.st_size==off_t(manifest_[i].size) && before.st_ino==original.st_ino && before.st_dev==original.st_dev;
      EVP_MD_CTX *hash=EVP_MD_CTX_new();
      okay=okay && hash && EVP_DigestInit_ex(hash,EVP_sha256(),nullptr)==1;
      std::array<unsigned char,16384> buffer{};
      while(okay) {
        ssize_t count=::read(fd,buffer.data(),buffer.size());
        if(count<0 && errno==EINTR)continue;
        if(count<0){okay=false;break;}
        if(!count)break;
        okay=EVP_DigestUpdate(hash,buffer.data(),size_t(count))==1;
      }
      unsigned char digest[32]{};unsigned int count=0;
      okay=okay && EVP_DigestFinal_ex(hash,digest,&count)==1 && count==32 &&
        !::fstat(fd,&after) && after.st_size==before.st_size && after.st_ino==before.st_ino &&
        after.st_mtime==before.st_mtime && after.st_ctime==before.st_ctime;
      if(hash)EVP_MD_CTX_free(hash);
      ::close(fd);
      std::string actual;static constexpr char HEX[]="0123456789abcdef";
      for(auto value:digest){actual+=HEX[value>>4];actual+=HEX[value&15];}
      if(!okay || actual!=manifest_[i].sha256)return fail("sealed_artifact_changed");
    }
    return true;
  }
  static int kind(const std::string &value){for(size_t i=0;i<COUNT;++i)if(value==NAMES[i])return int(i);return -1;}

  bool begin(const std::string &job,int kind) {
    error_.clear();
    if(!valid_job(job))return fail("invalid_job_id");
    if(kind<0 || kind>=int(COUNT))return fail("unknown_artifact");
    const auto &allowed=manifest_[kind];
    if(!allowed.size || allowed.size>MAX_ARTIFACT || !valid_sha(allowed.sha256))return fail("artifact_not_approved");
    if(!job_.empty() && job_!=job)return fail("another_job_is_staged");
    if(job_.empty()) {
      directory_=Layout::create(job);if(directory_.empty())return fail("create_staging_directory_failed");
      directory_fd_=::open(directory_.c_str(),O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
      if(directory_fd_<0 || ::fchmod(directory_fd_,0700))return fail("open_staging_directory_failed");
      if(::fstat(directory_fd_,&directory_identity_))return fail("staging_directory_identity_failed");
      job_=job;
    }
    auto &s=slots_[kind];
    // Identical begin retries never truncate data. The caller resolves an
    // ambiguous network result by reading this actual offset before resuming.
    if(s.fd>=0 || s.verified)return true;
    if(s.owned)return fail("artifact_failed_discard_required");
    s.fd=::openat(directory_fd_,NAMES[kind],O_RDWR|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);
    if(s.fd<0)return fail("create_artifact_failed");
    s.owned=true;
    if(::fstat(s.fd,&s.identity)){close_slot(s);return fail("created_artifact_identity_unavailable");}
    s.hash=EVP_MD_CTX_new();
    if(!s.hash || EVP_DigestInit_ex(s.hash,EVP_sha256(),nullptr)!=1){close_slot(s);return fail("hash_initialization_failed");}
    return true;
  }
  bool append(const std::string &job,int kind,int64_t offset,const char *hex,size_t length) {
    error_.clear();
    if(!same_job(job) || kind<0 || kind>=int(COUNT))return fail("job_or_artifact_mismatch");
    auto &s=slots_[kind];
    if(s.fd<0 || s.verified || !s.hash)return fail("artifact_not_writable");
    if(offset<0 || length==0 || length>MAX_CHUNK*2 || length%2)return fail("invalid_chunk_bounds");
    const size_t bytes=length/2;
    if(uint64_t(offset)+bytes>manifest_[kind].size)return fail("chunk_exceeds_approved_size");
    std::array<uint8_t,MAX_CHUNK> decoded{};
    for(size_t i=0;i<bytes;++i){int a=nibble(hex[i*2]),b=nibble(hex[i*2+1]);if(a<0 || b<0)return fail("invalid_chunk_encoding");decoded[i]=uint8_t(a*16+b);}
    if(uint64_t(offset)<s.offset) {
      if(uint64_t(offset)+bytes>s.offset)return fail("partial_overlap_read_offset_first");
      std::array<uint8_t,MAX_CHUNK> previous{};
      ssize_t count;do{count=::pread(s.fd,previous.data(),bytes,offset);}while(count<0 && errno==EINTR);
      if(count!=ssize_t(bytes) || std::memcmp(previous.data(),decoded.data(),bytes))return fail("retry_content_mismatch");
      return true;
    }
    if(uint64_t(offset)!=s.offset)return fail("out_of_order_chunk");
    size_t done=0;
    while(done<bytes) {
      const ssize_t written=::pwrite(s.fd,decoded.data()+done,bytes-done,s.offset);
      if(written<0 && errno==EINTR)continue;
      if(written<=0)return fail("artifact_write_failed");
      // Advance the offset/hash only for bytes actually written. A short
      // write or later error cannot make the acknowledged prefix fictional.
      if(EVP_DigestUpdate(s.hash,decoded.data()+done,size_t(written))!=1){close_slot(s);return fail("hash_update_failed");}
      done+=size_t(written);s.offset+=uint32_t(written);
    }
    return true;
  }
  bool seal(const std::string &job,int kind) {
    error_.clear();
    if(!same_job(job) || kind<0 || kind>=int(COUNT))return fail("job_or_artifact_mismatch");
    auto &s=slots_[kind];if(s.verified)return true;
    if(s.fd<0 || !s.hash || s.offset!=manifest_[kind].size)return fail("artifact_incomplete");
    struct stat actual{},entry{};
    if(::fstat(s.fd,&actual) || ::fstatat(directory_fd_,NAMES[kind],&entry,AT_SYMLINK_NOFOLLOW) ||
       !S_ISREG(actual.st_mode) || !S_ISREG(entry.st_mode) || actual.st_dev!=entry.st_dev ||
       actual.st_ino!=entry.st_ino || actual.st_size!=off_t(s.offset) || actual.st_uid!=::geteuid())
      return fail("artifact_identity_changed");
    std::array<unsigned char,32> digest{};unsigned int bytes=0;
    if(EVP_DigestFinal_ex(s.hash,digest.data(),&bytes)!=1 || bytes!=digest.size()) {close_slot(s);return fail("hash_finalization_failed");}
    EVP_MD_CTX_free(s.hash);s.hash=nullptr;
    static constexpr char HEX[]="0123456789abcdef";std::string hash;
    for(unsigned char c:digest){hash+=HEX[c>>4];hash+=HEX[c&15];}
    if(hash!=manifest_[kind].sha256){close_slot(s);return fail("artifact_hash_mismatch");}
    if(::fsync(s.fd) || ::fchmod(s.fd,0700)){close_slot(s);return fail("artifact_seal_failed");}
    if(::fstat(s.fd,&s.identity)){close_slot(s);return fail("artifact_identity_unavailable");}
    ::close(s.fd);s.fd=-1;s.verified=true;return true;
  }
  bool discard(const std::string &job) {
    error_.clear();if(!same_job(job))return fail("job_mismatch");
    struct stat current{};
    if(::lstat(directory_.c_str(),&current) || !S_ISDIR(current.st_mode) ||
       current.st_dev!=directory_identity_.st_dev || current.st_ino!=directory_identity_.st_ino)
      return fail("staging_directory_identity_changed");
    // Review the entire group BEFORE deleting anything. A replaced/linked
    // path belongs to an unknown actor even inside our private directory;
    // owning the filename alone does not authorize deleting its new inode.
    for(size_t i=0;i<COUNT;++i) {
      const auto &s=slots_[i];if(!s.owned)continue;
      struct stat entry{};
      if(::fstatat(directory_fd_,NAMES[i],&entry,AT_SYMLINK_NOFOLLOW)) {
        if(errno==ENOENT)continue;
        return fail("artifact_cleanup_identity_unavailable");
      }
      if(!S_ISREG(entry.st_mode) || entry.st_dev!=s.identity.st_dev || entry.st_ino!=s.identity.st_ino ||
          entry.st_uid!=::geteuid() || entry.st_nlink!=1)
        return fail("artifact_cleanup_identity_changed");
    }
    for(size_t i=0;i<COUNT;++i) {
      auto &s=slots_[i];close_slot(s);
      if(s.owned && ::unlinkat(directory_fd_,NAMES[i],0) && errno!=ENOENT)return fail("artifact_cleanup_failed");
      s.owned=false;s.offset=0;s.verified=false;
    }
    // Never recursively delete an unexpected file. A non-empty directory is
    // a concrete recovery case, not permission to erase someone else's data.
    if(::rmdir(directory_.c_str()))return fail("unexpected_staging_files_preserved");
    ::close(directory_fd_);directory_fd_=-1;directory_.clear();job_.clear();return true;
  }
 private:
  struct Slot {int fd{-1};uint32_t offset{0};bool owned{false},verified{false};EVP_MD_CTX *hash{nullptr};struct stat identity{};};
  std::array<Artifact,COUNT> manifest_;
  std::array<Slot,COUNT> slots_{};
  std::string job_,directory_,error_;
  int directory_fd_{-1};struct stat directory_identity_{};
  bool fail(const char *message){error_=message;return false;}
  bool same_job(const std::string &job) const{return !job_.empty() && job==job_;}
  static void close_slot(Slot &s){if(s.fd>=0){::close(s.fd);s.fd=-1;}if(s.hash){EVP_MD_CTX_free(s.hash);s.hash=nullptr;}}
  static int nibble(char c){if(c>='0'&&c<='9')return c-'0';if(c>='a'&&c<='f')return c-'a'+10;if(c>='A'&&c<='F')return c-'A'+10;return -1;}
  static bool valid_sha(const std::string &value){if(value.size()!=64)return false;for(char c:value)if(nibble(c)<0 || (c>='A'&&c<='F'))return false;return true;}
  static bool valid_job(const std::string &value){if(value.size()<8 || value.size()>32 || !Layout::accepts_job(value))return false;for(char c:value)if(nibble(c)<0 || (c>='A'&&c<='F'))return false;return true;}
};
// Existing trial schema/manifest and API remain exactly five artifacts.
// Full mode is a separate C++ type and separate two-image release manifest.
using Staging=BasicStaging<TrialStagingLayout>;
using FullStaging=BasicStaging<FullStagingLayout>;
}  // namespace cgs1_net_trial
