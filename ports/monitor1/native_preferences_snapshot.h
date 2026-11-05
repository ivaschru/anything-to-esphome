#pragma once

// Bridge between the SDK's private RAM file and our durable record. It must
// run before any component loads preferences. The production caller chooses
// fixed admitted directories; no API parameter can select a file or path.
// checkpoint() requires the pinned checked-I/O SDK sync path: the upstream
// host writer ignores fwrite/fclose errors and cannot attest a full snapshot.
#include "native_preferences_store.h"
#include "device_profile.h"

namespace cgs1_preferences {
class Snapshot {
 public:
  inline static constexpr const char *SDK_FILE=cgs1_device_profile::SDK_PREFS_FILE;
  Snapshot()=default;Snapshot(const Snapshot &)=delete;Snapshot &operator=(const Snapshot &)=delete;
  ~Snapshot(){if(ram_>=0)::close(ram_);}
  bool begin(const char *durable_directory,const char *ram_directory,const char *epoch) {
    if(attempted_)return fail_("preferences_snapshot_already_attempted");
    attempted_=true;
    if(!store_.open_existing(durable_directory,epoch))return fail_(store_.error());
    std::string committed;const auto state=store_.load(committed);
    if(state==Store::Load::ERROR)return fail_(store_.error());
    ram_=::open(ram_directory,O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
    struct stat directory{};
    if(ram_<0 || ::fstat(ram_,&directory) || !S_ISDIR(directory.st_mode) ||
       directory.st_uid!=0 || (directory.st_mode&07777)!=0700)return fail_("private_ram_preferences_directory_required");
    ram_device_=directory.st_dev;
    std::string current;const auto found=read_ram_(current);
    if(found<0)return fail_("ram_preferences_invalid_or_inaccessible");
    if(found) {
      // Planned exec reuses its RAM file. Its last checked shutdown snapshot
      // must agree with the committed copy; do not overwrite newer unknown
      // data or silently promote an uncommitted file from another profile.
      if(state!=Store::Load::LOADED || current!=committed)return fail_("ram_and_durable_preferences_conflict");
    } else if(state==Store::Load::LOADED) {
      // A fresh materialized session lost all RAM state. Restore only its
      // absent fixed filename, before the concrete SDK manager's first load.
      const int fd=::openat(ram_,SDK_FILE,O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);
      if(fd<0)return fail_("ram_preferences_restore_inode_unavailable");
      bool okay=!::fchmod(fd,0600);size_t at=0;
      while(okay && at<committed.size()) {
        const auto count=::write(fd,committed.data()+at,committed.size()-at);
        if(count<0 && errno==EINTR)continue;
        if(count<=0)okay=false;else at+=size_t(count);
      }
      okay=okay && !::fsync(fd);::close(fd);
      // A partial restore is left in this obsolete private RAM session for
      // diagnosis. It never damages or replaces the durable record.
      if(!okay || ::fsync(ram_))return fail_("ram_preferences_restore_not_committed");
      restored_=true;
    }
    ready_=true;return true;
  }
  template<class CheckedSdkPreferences> bool checkpoint(CheckedSdkPreferences &sdk) {
    error_.clear();
    if(!ready_)return fail_("preferences_snapshot_not_ready");
    // The checked SDK path confirms every header/value write and fclose.
    // Never treat a valid-looking prefix of a failed SDK write as a complete
    // preference map. CRC protects a complete snapshot only after that check.
    if(!sdk.sync())return fail_("sdk_ram_preferences_sync_failed");
    std::string payload;
    if(read_ram_(payload)!=1)return fail_("sdk_ram_preferences_snapshot_invalid");
    if(!store_.save(payload))return fail_(store_.error());
    ++checkpoints_;return true;
  }
  bool ready() const{return ready_;}
  bool setting_size(uint32_t key,bool &present,size_t &size) {
    // Startup-only presence/length check for a compiled own key. The SDK's
    // typed load() conflates absence and a wrong-length value. Do not silently
    // replace an incompatible existing PM choice with a guessed default.
    // No enumeration, caller path, value export or network API is introduced.
    if(!ready_)return fail_("preferences_snapshot_not_ready");
    std::string payload;const auto found=read_ram_(payload);
    if(found<0)return fail_("sdk_ram_preferences_snapshot_invalid");
    present=false;size=0;
    for(size_t at=0;at<payload.size();) {
      const auto length=uint8_t(payload[at+4]);
      if(read_u32(payload.data()+at)==key){present=true;size=length;break;}
      at+=5+length;
    }
    return true;
  }
  bool restored() const{return restored_;}
  uint64_t checkpoints() const{return checkpoints_;}
  const std::string &error() const{return error_;}
 private:
  Store store_;int ram_{-1};dev_t ram_device_{};uint64_t checkpoints_{0};
  bool attempted_{false},ready_{false},restored_{false};std::string error_;
  bool fail_(const std::string &why){error_=why;return false;}
  int read_ram_(std::string &payload) const {
    const int fd=::openat(ram_,SDK_FILE,O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC);
    if(fd<0)return errno==ENOENT?0:-1;
    struct stat before{},after{},path{};
    bool okay=!::fstat(fd,&before) && S_ISREG(before.st_mode) && before.st_uid==0 &&
      (before.st_mode&07777)==0600 && before.st_dev==ram_device_ && before.st_nlink==1 &&
      before.st_size>=0 && before.st_size<=ssize_t(MAX_PAYLOAD);
    std::string bytes(okay?size_t(before.st_size):0,'\0');size_t at=0;
    while(okay && at<bytes.size()) {
      const auto count=::read(fd,bytes.data()+at,bytes.size()-at);
      if(count<0 && errno==EINTR)continue;
      if(count<=0){okay=false;break;}at+=size_t(count);
    }
    okay=okay && !::fstat(fd,&after) && !::fstatat(ram_,SDK_FILE,&path,AT_SYMLINK_NOFOLLOW) &&
      path.st_dev==before.st_dev && path.st_ino==before.st_ino &&
      before.st_size==after.st_size && before.st_mtim.tv_sec==after.st_mtim.tv_sec &&
      before.st_mtim.tv_nsec==after.st_mtim.tv_nsec && before.st_ctim.tv_sec==after.st_ctim.tv_sec &&
      before.st_ctim.tv_nsec==after.st_ctim.tv_nsec;
    ::close(fd);
    if(!okay || !valid_sdk_payload(bytes))return -1;
    payload=std::move(bytes);return 1;
  }
};
}  // namespace cgs1_preferences
