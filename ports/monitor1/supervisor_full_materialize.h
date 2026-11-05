#pragma once

// Fixed boot-local release materialization, after exact byte staging and
// before process creation/stock signals. It copies the two approved flat
// files into private native/program and guardian/program directories. Staged
// originals/evidence stay intact; no hardlinks, recursive cleanup or paths
// from a network caller. Failures preserve partial output for inspection.
#include "trial_staging.h"
#include "supervisor_image.h"
#include "supervisor_full_reclaim.h"
#include <sys/vfs.h>

namespace cgs1_supervisor {
class FullMaterialize {
 public:
  ~FullMaterialize(){if(directory_>=0)::close(directory_);}
  bool prepare(cgs1_net_trial::FullStaging &stage,const ExecutableSpec &architecture={}) {
    if(attempted_)return false;
    attempted_=true;
    const auto expected="/tmp/qingping-full-"+stage.job();
    if(stage.directory()!=expected || stage.job().size()!=16 || !stage.ready())return false;
    directory_=stage.duplicate_verified_directory();
    struct stat info{};struct statfs fs{};
    if(directory_<0 || ::fstat(directory_,&info) || !S_ISDIR(info.st_mode) ||
       info.st_uid!=0 || (info.st_mode&07777)!=0700 || ::fstatfs(directory_,&fs) || fs.f_type!=0x01021994)return false;
    root_=expected;
    // A native exec must never inherit the bridge's ESPHOME_PREFDIR. These
    // private RAM stores survive native OTA exec within this guarded session;
    // durable /data placement is a separately reviewed install step.
    for(const char *name:{"prefs","thermal"})if(::mkdirat(directory_,name,0700))return false;
    for(unsigned role=0;role<2;++role) {
      const auto approved=stage.approved(int(role));
      if(!parse_digest(approved.sha256,digests_[role]))return false;
      const char *name=role?"guardian":"native";
      if(::mkdirat(directory_,name,0700))return false;
      const int target_dir=::openat(directory_,name,O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
      if(target_dir<0)return false;
      const bool copied=copy_(cgs1_net_trial::FullStaging::NAMES[role],target_dir,approved.size);
      ::close(target_dir);
      ImageDirectory verified;ImageFile image;
      if(!copied || !verified.open_existing((root_+"/"+name).c_str(),0) ||
         !verified.inspect(image,architecture,&digests_[role],ImageSync::FILE_AND_DIRECTORY))return false;
    }
    const int lock=::openat(directory_,"recovery.lock",O_RDWR|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);
    if(lock<0)return false;
    const bool committed=!::fsync(lock) && !::fsync(directory_);::close(lock);
    ready_=committed;return ready_;
  }
  bool ready() const{return ready_;}
  // After BOTH retained ELFs and recovery.lock are fsynced, these two flat
  // files are redundant. Reuse the same hash/inode/no-live-process validator
  // as the explicit upload-only actor, before any coordinator can fork. The
  // materialized programs and all recovery metadata remain present. A saved
  // result makes a repeated local read return its outcome without unlinking
  // again; a failed operation is not retried or declared a complete prepare.
  bool release_uploads(const ExecutableSpec &architecture={}) {
    if(upload_release_attempted_)return uploads_released_;
    if(!ready_)return false;
    upload_release_attempted_=true;
    uploads_released_=upload_release_.deduplicate_uploads(root_.substr(root_.size()-16),
      digest_text(digests_[0]),digest_text(digests_[1]),architecture);
    return uploads_released_;
  }
  bool uploads_released()const{return uploads_released_;}
  uint64_t released_upload_bytes()const{return upload_release_.removed_bytes;}
  int runtime_fd() const{return ready_?directory_:-1;}
  const std::string &root() const{return root_;}
  const Digest &native_digest() const{return digests_[0];}
  const Digest &guardian_digest() const{return digests_[1];}
 private:
  int directory_{-1};bool attempted_{false},ready_{false};std::string root_;std::array<Digest,2> digests_{};
  bool upload_release_attempted_{false},uploads_released_{false};FullReclaim upload_release_;
  bool copy_(const char *source_name,int target_directory,uint32_t size) {
    const int source=::openat(directory_,source_name,O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC);
    struct stat before{},after{};
    if(source<0)return false;
    const bool valid=!::fstat(source,&before) && S_ISREG(before.st_mode) && before.st_uid==0 &&
      (before.st_mode&07777)==0700 && before.st_nlink==1 && before.st_size==off_t(size);
    const int target=valid?::openat(target_directory,"program",O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0700):-1;
    bool okay=valid && target>=0;std::array<char,16384> bytes{};uint32_t offset=0;
    while(okay && offset<size) {
      const auto count=::pread(source,bytes.data(),std::min<size_t>(bytes.size(),size-offset),offset);
      if(count<0 && errno==EINTR)continue;
      if(count<=0){okay=false;break;}
      ssize_t at=0;
      while(at<count) {
        const auto written=::write(target,bytes.data()+at,size_t(count-at));
        if(written<0 && errno==EINTR)continue;
        if(written<=0){okay=false;break;}
        at+=written;
      }
      offset+=uint32_t(count);
    }
    okay=okay && offset==size && !::fstat(source,&after) && before.st_ino==after.st_ino &&
      before.st_dev==after.st_dev && before.st_size==after.st_size && image_same_timestamp(before,after) &&
      !::fsync(target) && !::fsync(target_directory);
    if(target>=0)::close(target);
    ::close(source);return okay;
  }
};
}  // namespace cgs1_supervisor
