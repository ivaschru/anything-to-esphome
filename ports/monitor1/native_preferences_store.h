#pragma once

// Durable COPY of the pinned little-endian host SDK preference payload.
// The SDK continues to use its ordinary RAM file; this store never replaces
// its concrete CRTP preferences manager or touches stock QSettings. A later
// native-only adapter will choose the fixed own /data directory and arrange
// sync-before-snapshot / restore-before-component-setup. No network path,
// secret value, command execution or automatic migration belongs here.
#include <array>
#include <cstdint>
#include <cstring>
#include <string>
#include <fcntl.h>
#include <sys/file.h>
#include <sys/stat.h>
#include <unistd.h>
#include <cerrno>
#include "checkpoint_epoch.h"

namespace cgs1_preferences {
inline constexpr size_t MAX_PAYLOAD=16384,MAX_KEYS=128,HEADER_BYTES=16;
inline uint32_t read_u32(const char *p) {
  return uint32_t(uint8_t(p[0])) | uint32_t(uint8_t(p[1]))<<8 |
         uint32_t(uint8_t(p[2]))<<16 | uint32_t(uint8_t(p[3]))<<24;
}
inline void append_u32(std::string &out,uint32_t value) {
  for(unsigned shift=0;shift<32;shift+=8)out+=char(value>>shift);
}
inline uint32_t crc32(const std::string &bytes) {
  // Corruption detection, not authentication against another root process.
  uint32_t crc=0xffffffffU;
  for(unsigned char byte:bytes) {
    crc^=byte;
    for(unsigned bit=0;bit<8;++bit)crc=(crc>>1)^(0xedb88320U & (0U-(crc&1)));
  }
  return ~crc;
}
inline bool valid_sdk_payload(const std::string &bytes) {
  if(bytes.size()>MAX_PAYLOAD)return false;
  size_t at=0,count=0;uint32_t previous=0;
  while(at<bytes.size()) {
    // The SDK std::map writes sorted unique 32-bit keys, one uint8 length,
    // then that many opaque bytes. Empty values are legal; partial records,
    // duplicate/reordered keys and unbounded key growth are not.
    if(bytes.size()-at<5 || ++count>MAX_KEYS)return false;
    const auto key=read_u32(bytes.data()+at);const auto length=uint8_t(bytes[at+4]);
    if((count>1 && key<=previous) || bytes.size()-at-5<length)return false;
    previous=key;at+=5+length;
  }
  return true;
}
inline std::string encode_record(const std::string &payload) {
  if(!valid_sdk_payload(payload))return {};
  std::string out="CGS1PF1\n";append_u32(out,uint32_t(payload.size()));
  append_u32(out,crc32(payload));out+=payload;return out;
}
inline bool decode_record(const std::string &record,std::string &payload) {
  if(record.size()<HEADER_BYTES || record.size()>HEADER_BYTES+MAX_PAYLOAD ||
     record.compare(0,8,"CGS1PF1\n") || read_u32(record.data()+8)!=record.size()-HEADER_BYTES)return false;
  auto selected=record.substr(HEADER_BYTES);
  if(read_u32(record.data()+12)!=crc32(selected) || !valid_sdk_payload(selected))return false;
  payload=std::move(selected);return true;
}

class Store {
 public:
  enum class Load {MISSING,LOADED,ERROR};
  Store()=default;Store(const Store &)=delete;Store &operator=(const Store &)=delete;
  ~Store(){if(lock_>=0)::close(lock_);if(directory_>=0)::close(directory_);}
  bool open_existing(const char *path,const char *epoch) {
    if(attempted_)return fail_("preferences_store_already_attempted");
    attempted_=true;
    // Reject an absent/malformed epoch before opening or creating any file.
    // Production passes only the nonce from the verified sealed bootstrap.
    if(!cgs1_checkpoint::valid_epoch(epoch))return fail_("preferences_checkpoint_epoch_required");
    epoch_=epoch;
    if(!path)return fail_("preferences_directory_required");
    directory_=::open(path,O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
    struct stat info{};
    if(directory_<0 || ::fstat(directory_,&info) || !S_ISDIR(info.st_mode) ||
       info.st_uid!=0 || (info.st_mode&07777)!=0700)return fail_("private_preferences_directory_required");
    device_=info.st_dev;
    lock_=::openat(directory_,"preferences.lock",O_RDWR|O_CREAT|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC,0600);
    if(lock_<0 || !private_file_(lock_,nullptr) || ::flock(lock_,LOCK_EX|LOCK_NB))
      return fail_("preferences_writer_lease_unavailable");
    // Hold an independently opened flock for this native process's lifetime.
    // CLOEXEC releases it during a planned SDK exec; the next generation must
    // reacquire it before reading. A second live native cannot write the same
    // store merely because it knows a job nonce or directory name.
    ready_=true;return true;
  }
  Load load(std::string &payload) {
    if(!ready_ || loaded_) {fail_("preferences_first_load_required");return Load::ERROR;}
    std::string record;struct stat identity{};const auto found=read_(record,identity);
    if(found<0){fail_("preferences_record_invalid_or_inaccessible");return Load::ERROR;}
    std::string selected;
    if(found && !decode_record(record,selected)){fail_("preferences_record_corrupt");return Load::ERROR;}
    // Missing and an empty valid record are different CAS states. An error
    // never sets loaded_, so defaults cannot silently overwrite bad evidence.
    loaded_=true;present_=found==1;last_record_=record;last_identity_=identity;
    payload=std::move(selected);error_.clear();return found?Load::LOADED:Load::MISSING;
  }
  bool save(const std::string &payload) {
    error_.clear();
    if(!ready_ || !loaded_ || uncertain_)return fail_("preferences_loaded_unambiguous_store_required");
    const auto record=encode_record(payload);
    if(record.empty())return fail_("preferences_sdk_payload_invalid");
    // Re-read the current complete record, including CRC and inode identity.
    // flock serializes our processes; this extra CAS refuses a path replaced
    // or corrupted by a writer that ignores that lock.
    std::string current;struct stat identity{};const auto found=read_(current,identity);
    if(found<0 || bool(found)!=present_ || current!=last_record_ ||
       (present_ && !same_(identity,last_identity_)))return fail_("preferences_record_changed");
    if(present_ && record==last_record_)return true; // No redundant flash write.
    const auto temporary=".preferences-"+epoch_+"-"+std::to_string(::getpid())+"-"+std::to_string(serial_++);
    const int fd=::openat(directory_,temporary.c_str(),O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);
    struct stat created{};
    if(fd<0)return fail_("preferences_new_inode_unavailable");
    bool okay=!::fchmod(fd,0600) && private_file_(fd,&created);
    size_t at=0;
    while(okay && at<record.size()) {
      const auto count=::write(fd,record.data()+at,record.size()-at);
      if(count<0 && errno==EINTR)continue; // Private new file, no hardware retry.
      if(count<=0)okay=false;else at+=size_t(count);
    }
    okay=okay && !::fsync(fd);::close(fd);
    struct stat destination{};const auto exists=::fstatat(directory_,NAME,&destination,AT_SYMLINK_NOFOLLOW);
    okay=okay && (present_ ? exists==0 && same_(destination,last_identity_) : exists<0 && errno==ENOENT);
    if(!okay || ::renameat(directory_,temporary.c_str(),directory_,NAME)) {
      // Remove only our exact new inode. Never sweep crash remnants, follow
      // a substituted link, unlink an existing record or repair a conflict.
      struct stat entry{};
      if(!::fstatat(directory_,temporary.c_str(),&entry,AT_SYMLINK_NOFOLLOW) &&
         entry.st_dev==created.st_dev && entry.st_ino==created.st_ino)::unlinkat(directory_,temporary.c_str(),0);
      return fail_("preferences_checkpoint_not_committed");
    }
    // After rename, a failed directory fsync is visible but not proven durable.
    // Do not repeat that ambiguous transaction or report a success. Recovery
    // requires a fresh process/read, not another blind save in this instance.
    if(::fsync(directory_)) {uncertain_=true;return fail_("preferences_visible_not_durable");}
    std::string installed;struct stat published{};
    if(read_(installed,published)!=1 || installed!=record || published.st_dev!=created.st_dev ||
       published.st_ino!=created.st_ino) {
      uncertain_=true;return fail_("preferences_committed_readback_failed");
    }
    // rename/write can change timestamps. Retain the actual published inode,
    // not the size-zero inode stat captured before writing the temporary file.
    present_=true;last_record_=record;last_identity_=published;return true;
  }
  const std::string &error() const{return error_;}
 private:
  inline static constexpr const char *NAME="preferences.v1";
  int directory_{-1},lock_{-1};dev_t device_{};unsigned serial_{0};
  bool attempted_{false},ready_{false},loaded_{false},present_{false},uncertain_{false};
  std::string last_record_,error_,epoch_;struct stat last_identity_{};
  bool fail_(const char *why){error_=why;return false;}
  static bool same_(const struct stat &a,const struct stat &b) {
    return a.st_dev==b.st_dev && a.st_ino==b.st_ino && a.st_size==b.st_size &&
      a.st_mtim.tv_sec==b.st_mtim.tv_sec && a.st_mtim.tv_nsec==b.st_mtim.tv_nsec &&
      a.st_ctim.tv_sec==b.st_ctim.tv_sec && a.st_ctim.tv_nsec==b.st_ctim.tv_nsec;
  }
  bool private_file_(int fd,struct stat *identity) const {
    struct stat info{};
    if(::fstat(fd,&info) || !S_ISREG(info.st_mode) || info.st_uid!=0 ||
       info.st_dev!=device_ || info.st_nlink!=1 || (info.st_mode&07777)!=0600)return false;
    if(identity)*identity=info;
    return true;
  }
  int read_(std::string &bytes,struct stat &identity) const {
    const int fd=::openat(directory_,NAME,O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC);
    if(fd<0)return errno==ENOENT?0:-1;
    struct stat before{},after{};
    if(!private_file_(fd,&before) || before.st_size<ssize_t(HEADER_BYTES) ||
       before.st_size>ssize_t(HEADER_BYTES+MAX_PAYLOAD)){::close(fd);return -1;}
    std::string selected(size_t(before.st_size),'\0');size_t at=0;bool okay=true;
    while(at<selected.size()) {
      const auto count=::read(fd,selected.data()+at,selected.size()-at);
      if(count<0 && errno==EINTR)continue;
      if(count<=0){okay=false;break;}at+=size_t(count);
    }
    okay=okay && !::fstat(fd,&after) && same_(before,after);::close(fd);
    if(!okay)return -1;
    bytes=std::move(selected);identity=after;return 1;
  }
};
}  // namespace cgs1_preferences
