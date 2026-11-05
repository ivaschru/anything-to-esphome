#pragma once

// Private POSIX record storage; no hardware/stock INI, remote path or secret.
// Bootstrap chooses an existing own 0700 directory. Writes use a new 0600
// inode, file fsync, atomic rename and directory fsync. Readers see the last
// committed complete record, never a partially overwritten calibration state.
#include "thermal_state_codec.h"
#include "checkpoint_epoch.h"
#include <fcntl.h>
#include <sys/file.h>
#include <sys/stat.h>
#include <unistd.h>
#include <cerrno>
#include <cstdio>
#include <cstring>

namespace cgs1_thermal {
class StateStore {
 public:
  StateStore() = default;
  StateStore(const StateStore &) = delete;
  StateStore &operator=(const StateStore &) = delete;
  ~StateStore() {if (lock_>=0) ::close(lock_);if (directory_>=0) ::close(directory_);}
  bool open_existing(const char *path,const char *epoch=nullptr) {
    error_.clear();
    if (directory_>=0 || !path) return fail_("store_already_open_or_missing_directory");
    // Legacy engineering callers have boot-local disposable RAM directories.
    // Durable full mode MUST pass its admitted sealed nonce through Runtime;
    // a supplied invalid nonce is refused before touching the directory.
    if(epoch && !cgs1_checkpoint::valid_epoch(epoch))return fail_("thermal_checkpoint_epoch_invalid");
    if(epoch)epoch_=std::string(epoch)+"-";
    directory_=::open(path,O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
    struct stat dir{};
    if (directory_<0 || ::fstat(directory_,&dir) || !S_ISDIR(dir.st_mode) ||
        dir.st_uid!=::geteuid() || (dir.st_mode & 0777)!=0700)
      return fail_("private_directory_required");
    lock_=::openat(directory_,"thermal-state.lock",O_RDWR|O_CREAT|O_NONBLOCK|O_NOFOLLOW|O_CLOEXEC,0600);
    if (lock_<0 || !private_file_(lock_)) return fail_("private_lock_required");
    return ready_=true;
  }
  const std::string &error() const {return error_;}
  bool load(PersistentState &result) {
    error_.clear();
    if (!acquire_()) return false;
    PersistentState candidate;
    const int status=read_record_(NAME,candidate,nullptr);
    release_();
    if (status!=1) return fail_(status==0 ? "record_missing" : "record_invalid_or_inaccessible");
    result=candidate;return true;
  }
  bool save(const PersistentState &state) {
    error_.clear();
    const auto text=format_state(state);
    if (text.empty()) return fail_("state_not_valid");
    if (!acquire_()) return false;
    // Never overwrite an unrelated, linked, wrongly permissioned or corrupt
    // existing file. Normal startup can use a cold model while this error is
    // reported; it must not silently accept guessed warm coefficients.
    PersistentState old;struct stat previous{};
    const int present=read_record_(NAME,old,&previous);
    if (present<0) {release_();return fail_("existing_record_preserved");}
    const std::string temporary=".thermal-state-"+epoch_+std::to_string(::getpid())+"-"+std::to_string(serial_++);
    int fd=::openat(directory_,temporary.c_str(),O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);
    if (fd<0) {release_();return fail_("new_checkpoint_inode_unavailable");}
    struct stat created{};
    bool okay=!::fchmod(fd,0600) && !::fstat(fd,&created) && private_file_(fd);
    size_t offset=0;
    while (okay && offset<text.size()) {
      const ssize_t count=::write(fd,text.data()+offset,text.size()-offset);
      if (count<0 && errno==EINTR) continue; // Private new file only, not a hardware store.
      if (count<=0) okay=false;else offset+=size_t(count);
    }
    okay=okay && !::fsync(fd);
    ::close(fd);
    // The lock serializes our instances. Recheck the destination inode too:
    // another root program that ignores this lock must not be overwritten
    // after replacing the path during a checkpoint.
    struct stat current{};
    const int found=::fstatat(directory_,NAME,&current,AT_SYMLINK_NOFOLLOW);
    if (present==1) okay=okay && !found && current.st_dev==previous.st_dev && current.st_ino==previous.st_ino;
    else okay=okay && found<0 && errno==ENOENT;
    bool renamed=false;
    if (okay) renamed=::renameat(directory_,temporary.c_str(),directory_,NAME)==0;
    if (!renamed) {
      // Remove only the exact new inode created by this call. Crash remnants
      // or a substituted path are preserved; no directory scan/rm -rf exists.
      struct stat entry{};
      if (!::fstatat(directory_,temporary.c_str(),&entry,AT_SYMLINK_NOFOLLOW) &&
          entry.st_dev==created.st_dev && entry.st_ino==created.st_ino)
        ::unlinkat(directory_,temporary.c_str(),0);
      release_();return fail_("checkpoint_not_committed");
    }
    const bool durable=::fsync(directory_)==0;
    release_();
    // A failed directory fsync after rename is an explicitly visible but
    // unproven-durable result. Never report it as safely persisted or erase it.
    return durable || fail_("record_visible_directory_sync_failed");
  }
 private:
  inline static constexpr const char *NAME="thermal-state.v1";
  int directory_{-1},lock_{-1};unsigned serial_{0};bool ready_{false};std::string error_,epoch_;
  bool fail_(const char *text) {error_=text;return false;}
  bool acquire_() {
    if (!ready_) return fail_("store_not_ready");
    if (::flock(lock_,LOCK_EX|LOCK_NB)) return fail_("checkpoint_busy");
    return true;
  }
  void release_() {::flock(lock_,LOCK_UN);}
  static bool private_file_(int fd) {
    struct stat info{};
    return !::fstat(fd,&info) && S_ISREG(info.st_mode) && info.st_uid==::geteuid() &&
           info.st_nlink==1 && (info.st_mode & 0777)==0600;
  }
  int read_record_(const char *name,PersistentState &result,struct stat *identity) const {
    const int fd=::openat(directory_,name,O_RDONLY|O_NOFOLLOW|O_CLOEXEC|O_NONBLOCK);
    if (fd<0) return errno==ENOENT ? 0 : -1;
    struct stat info{};
    if (!private_file_(fd) || ::fstat(fd,&info) || info.st_size<1 || info.st_size>1024) {::close(fd);return -1;}
    std::string text(size_t(info.st_size),'\0');size_t offset=0;bool okay=true;
    while (offset<text.size()) {
      const ssize_t count=::read(fd,&text[offset],text.size()-offset);
      if (count<0 && errno==EINTR) continue;
      if (count<=0) {okay=false;break;}offset+=size_t(count);
    }
    struct stat after{};
    okay=okay && !::fstat(fd,&after) && after.st_size==info.st_size &&
         after.st_mtime==info.st_mtime && after.st_ctime==info.st_ctime;
    ::close(fd);
    if (!okay || !parse_state(text,result)) return -1;
    if (identity) *identity=info;
    return 1;
  }
};
} // namespace cgs1_thermal
