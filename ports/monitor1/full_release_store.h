#pragma once

// Durable storage for ONE compiler-approved native/guardian pair. The caller
// supplies a fenced FD for /data/.esphome-cgs1, never a pathname from an API.
// This class touches only full-releases/, does not execute either program,
// and never changes vendor init, bootloader, Wi-Fi, calibration or devices.
// Boot still uses the tested RAM staging/materialization/coordinator path.
#include "trial_staging.h"
#include "supervisor_image.h"
#include <sys/vfs.h>

namespace cgs1_supervisor {
// The production alias pins ext4. Synthetic Linux tests instantiate the same
// code for their isolated tmpfs; no runtime/API filesystem override exists.
template<long FilesystemMagic=0xef53> class BasicFullReleaseStore {
 public:
  using Manifest=std::array<cgs1_net_trial::FullStaging::Artifact,2>;
  explicit BasicFullReleaseStore(const Manifest &manifest):manifest_(manifest){}
  ~BasicFullReleaseStore(){for(int fd:{release_,root_,parent_})if(fd>=0)::close(fd);}
  BasicFullReleaseStore(const BasicFullReleaseStore&)=delete;
  BasicFullReleaseStore&operator=(const BasicFullReleaseStore&)=delete;
  const char *error()const{return error_;}

  bool open(int trusted_parent,bool create=false) {
    if(parent_>=0)return fail_("store_already_open");
    struct stat parent{};struct statfs fs{};
    if(!private_dir_(trusted_parent,parent) || ::fstatfs(trusted_parent,&fs) || fs.f_type!=FilesystemMagic)
      return fail_("private_ext4_parent_required");
    parent_=::fcntl(trusted_parent,F_DUPFD_CLOEXEC,3);
    if(parent_<0)return fail_("parent_fd_unavailable");
    parent_identity_=parent;
    for(const auto &a:manifest_) {
      Digest digest{};
      if(!a.size || a.size>16*1024*1024 || !parse_digest(a.sha256,digest))return fail_("compiled_manifest_invalid");
    }
    identity_=manifest_[0].sha256+"-"+manifest_[1].sha256;
    if(create && ::mkdirat(parent_,"full-releases",0700) && errno!=EEXIST)return fail_("store_directory_create_failed");
    root_=::openat(parent_,"full-releases",O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
    if(!private_dir_(root_,root_identity_) || root_identity_.st_dev!=parent.st_dev || !current_())
      return fail_("private_store_directory_required");
    return true;
  }

  // Installation is idempotent only for a completely verified existing pair.
  // A partial/unknown directory is preserved and refused. No recursive cleanup
  // or chmod can turn foreign or interrupted files into an approved release.
  bool install(const std::string &job,const ExecutableSpec &arch={}) {
    if(!job_(job) || !current_())return fail_("fixed_ram_job_and_store_required");
    const std::string ram="/tmp/qingping-full-"+job;
    std::array<ImageDirectory,2> source_dirs;
    std::array<ImageFile,2> source_images;
    std::array<int,2> sources{{-1,-1}};
    bool okay=true;
    for(unsigned i=0;i<2 && okay;++i) {
      Digest digest{};parse_digest(manifest_[i].sha256,digest);
      const auto path=ram+(i?"/guardian":"/native");
      okay=source_dirs[i].open_existing(path.c_str(),0) && source_dirs[i].inspect(source_images[i],arch,&digest);
      if(okay) {
        sources[i]=::open((path+"/program").c_str(),O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC);
        struct stat s{};
        okay=sources[i]>=0 && !::fstat(sources[i],&s) && source_images[i].matches_executable(s) &&
          s.st_size==off_t(manifest_[i].size) && s.st_nlink==1;
      }
    }
    if(!okay){close_sources_(sources);return fail_("exact_ram_pair_unavailable");}
    bool created=false;
    if(!::mkdirat(root_,identity_.c_str(),0700))created=true;
    else if(errno!=EEXIST){close_sources_(sources);return fail_("release_directory_create_failed");}
    if(!open_release_()){close_sources_(sources);return false;}
    if(created) {
      for(unsigned i=0;i<2 && okay;++i) {
        const char *role=i?"guardian":"native";
        okay=!::mkdirat(release_,role,0700);
        const int target=okay?::openat(release_,role,O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC):-1;
        okay=okay && target>=0 && copy_(sources[i],target,"program",manifest_[i].size,0700);
        if(target>=0)::close(target);
      }
      okay=okay && !::fsync(release_) && !::fsync(root_) && !::fsync(parent_);
    }
    close_sources_(sources);
    return okay && verify(arch);
  }

  bool verify(const ExecutableSpec &arch={}) {
    if(!current_() || !open_release_())return fail_("release_not_available");
    for(unsigned i=0;i<2;++i) {
      const int dir=::openat(release_,i?"guardian":"native",O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
      struct stat ds{};Digest digest{},actual{};parse_digest(manifest_[i].sha256,digest);
      const int image=dir>=0?::openat(dir,"program",O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC):-1;
      struct stat before{},after{},named{};unsigned char header[52]{};
      const bool good=private_dir_(dir,ds) && ds.st_dev==root_identity_.st_dev && image>=0 &&
        !::fstat(image,&before) && regular_(before,manifest_[i].size,0700) &&
        before.st_dev==ds.st_dev && ::pread(image,header,sizeof(header),0)==ssize_t(sizeof(header)) &&
        // ELF32 little endian ARM hard-float, identical architecture contract
        // to ImageDirectory. Tests can explicitly select a synthetic target.
        header[0]==0x7f && header[1]=='E' && header[2]=='L' && header[3]=='F' &&
        header[4]==1 && arch.elf_class==1 && header[5]==1 && header[6]==1 &&
        (header[16]==2 || header[16]==3) && header[17]==0 && header[20]==1 &&
        header[21]==0 && header[22]==0 && header[23]==0 && header[40]==52 && header[41]==0 && header[18]==(arch.machine&255) &&
        header[19]==(arch.machine>>8) && (!arch.arm_hard_float || (header[37]&6)==4) &&
        image_hash(image,before.st_size,actual) && actual==digest &&
        !::fstat(image,&after) && same_file_(before,after) &&
        !::fstatat(dir,"program",&named,AT_SYMLINK_NOFOLLOW) && same_file_(after,named);
      if(image>=0)::close(image);
      if(dir>=0)::close(dir);
      if(!good)return fail_("installed_release_verification_failed");
    }
    return current_();
  }

  // Mode names the exact approved pair. A new bridge with another manifest
  // cannot accidentally boot an old image. Enabling first verifies both ELFs;
  // disabling never needs to read/repair their contents.
  bool set_enabled(bool enabled,const ExecutableSpec &arch={}) {
    if(!current_() || (enabled && !verify(arch)))return false;
    return replace_("mode-v1",std::string("CGS1_FULL_MODE_V1\n")+identity_+"\n"+(enabled?"1\n":"0\n"));
  }
  bool enabled() {
    std::string text;
    return current_() && read_("mode-v1",text) && text=="CGS1_FULL_MODE_V1\n"+identity_+"\n1\n";
  }
  // The durable attempt is written BEFORE creating a RAM stage or requesting
  // takeover. A restart/OTA of this bridge in the same Linux boot cannot loop.
  // Ambiguous writes are reconciled by reading this marker, never replayed.
  bool consume_boot_attempt(const std::string &boot) {
    if(!boot_(boot) || !enabled())return fail_("enabled_release_and_boot_required");
    std::string prior;
    if(read_("boot-attempt-v1",prior)) {
      if(prior==boot+"\n")return fail_("boot_attempt_already_consumed");
      if(prior.size()!=37 || !boot_(prior.substr(0,36)) || prior.back()!='\n')return fail_("boot_attempt_record_invalid");
    }else if(errno!=ENOENT)return fail_("boot_attempt_record_unavailable");
    return replace_("boot-attempt-v1",boot+"\n");
  }

  // Incremental local transfer feeds the SAME bounded staging implementation
  // as the network uploader. Each invocation handles <=8 KiB. It cannot launch,
  // change a manifest, skip materialization, or lower the existing RAM gates.
  bool stream_tick(cgs1_net_trial::FullStaging &stage,const std::string &job,bool &done) {
    done=false;
    if(!job_(job) || !current_() || !open_release_())return fail_("boot_stream_store_required");
    for(unsigned i=0;i<2;++i) {
      if(stage.verified(i))continue;
      if(!stage.begin(job,int(i)))return fail_("boot_stage_begin_failed");
      const int role=::openat(release_,i?"guardian":"native",O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
      const int file=role>=0?::openat(role,"program",O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC):-1;
      struct stat s{};bool okay=file>=0 && !::fstat(file,&s) && regular_(s,manifest_[i].size,0700) && s.st_dev==root_identity_.st_dev;
      for(unsigned chunk=0;chunk<8 && okay && stage.offset(i)<manifest_[i].size;++chunk) {
        std::array<unsigned char,1024> bytes{};std::array<char,2048> hex{};
        const auto count=std::min<uint32_t>(1024,manifest_[i].size-stage.offset(i));
        const ssize_t got=::pread(file,bytes.data(),count,stage.offset(i));
        if(got!=ssize_t(count)){okay=false;break;}
        static constexpr char digits[]="0123456789abcdef";
        for(size_t at=0;at<count;++at){hex[at*2]=digits[bytes[at]>>4];hex[at*2+1]=digits[bytes[at]&15];}
        okay=stage.append(job,int(i),stage.offset(i),hex.data(),count*2);
      }
      if(file>=0)::close(file);
      if(role>=0)::close(role);
      if(!okay)return fail_("boot_stage_read_or_append_failed");
      if(stage.offset(i)==manifest_[i].size && !stage.seal(job,int(i)))return fail_("boot_stage_seal_failed");
      return true;
    }
    done=stage.ready();return done;
  }

 private:
  Manifest manifest_;int parent_{-1},root_{-1},release_{-1};
  struct stat parent_identity_{},root_identity_{},release_identity_{};
  std::string identity_;const char *error_{""};
  bool fail_(const char *value){error_=value;return false;}
  static bool job_(const std::string &s) {
    return s.size()==16 && s!=std::string(16,'0') && s.find_first_not_of("0123456789abcdef")==std::string::npos;
  }
  static bool boot_(const std::string &s) {
    if(s.size()!=36)return false;
    for(size_t i=0;i<s.size();++i) {
      if(i==8 || i==13 || i==18 || i==23){if(s[i]!='-')return false;}
      else if(std::string("0123456789abcdef").find(s[i])==std::string::npos)return false;
    }
    return true;
  }
  static bool private_dir_(int fd,struct stat &s) {
    return fd>=0 && !::fstat(fd,&s) && S_ISDIR(s.st_mode) && s.st_uid==0 && (s.st_mode&07777)==0700;
  }
  static bool same_(const struct stat&a,const struct stat&b){return a.st_dev==b.st_dev && a.st_ino==b.st_ino;}
  static bool same_file_(const struct stat&a,const struct stat&b) {
    return same_(a,b) && a.st_mode==b.st_mode && a.st_uid==b.st_uid && a.st_nlink==b.st_nlink && a.st_size==b.st_size && image_same_timestamp(a,b);
  }
  static bool regular_(const struct stat&s,off_t size,mode_t mode) {
    return S_ISREG(s.st_mode) && s.st_uid==0 && s.st_nlink==1 && s.st_size==size && (s.st_mode&07777)==mode;
  }
  bool current_()const {
    struct stat p{},r{},named{};
    return private_dir_(parent_,p) && same_(p,parent_identity_) && private_dir_(root_,r) && same_(r,root_identity_) &&
      !::fstatat(parent_,"full-releases",&named,AT_SYMLINK_NOFOLLOW) && same_(r,named) && S_ISDIR(named.st_mode);
  }
  bool open_release_() {
    if(!current_())return fail_("store_identity_changed");
    if(release_<0) {
      release_=::openat(root_,identity_.c_str(),O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
      if(!private_dir_(release_,release_identity_) || release_identity_.st_dev!=root_identity_.st_dev)return fail_("private_release_required");
    }
    struct stat held{},named{};
    return private_dir_(release_,held) && same_(held,release_identity_) &&
      !::fstatat(root_,identity_.c_str(),&named,AT_SYMLINK_NOFOLLOW) && same_(held,named) && S_ISDIR(named.st_mode);
  }
  static void close_sources_(const std::array<int,2>&fds){for(int fd:fds)if(fd>=0)::close(fd);}
  static bool copy_(int source,int directory,const char *name,uint32_t size,mode_t mode) {
    struct stat before{},after{};
    if(::fstat(source,&before) || !regular_(before,size,0700))return false;
    const int out=::openat(directory,name,O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,mode);
    if(out<0)return false;
    std::array<char,16384> bytes{};uint32_t offset=0;bool okay=true;
    while(okay && offset<size) {
      const ssize_t n=::pread(source,bytes.data(),std::min<uint32_t>(bytes.size(),size-offset),offset);
      if(n<0 && errno==EINTR)continue;
      if(n<=0){okay=false;break;}
      ssize_t written=0;
      while(written<n) {
        const ssize_t count=::write(out,bytes.data()+written,size_t(n-written));
        if(count<0 && errno==EINTR)continue;
        if(count<=0){okay=false;break;}
        written+=count;
      }
      offset+=uint32_t(n);
    }
    okay=okay && !::fstat(source,&after) && same_file_(before,after) && !::fsync(out) && !::fsync(directory);
    const bool closed=!::close(out);return okay && closed;
  }
  bool read_(const char *name,std::string &value) {
    value.clear();
    const int fd=::openat(root_,name,O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC);
    if(fd<0)return false;
    struct stat before{},after{},named{};std::array<char,256> bytes{};
    bool okay=!::fstat(fd,&before) && before.st_size>=0 && before.st_size<off_t(bytes.size()) && regular_(before,before.st_size,0600) && before.st_dev==root_identity_.st_dev;
    const ssize_t count=okay?::pread(fd,bytes.data(),size_t(before.st_size),0):-1;
    okay=okay && count==before.st_size && !::fstat(fd,&after) && same_file_(before,after) &&
      !::fstatat(root_,name,&named,AT_SYMLINK_NOFOLLOW) && same_file_(after,named) && current_();
    const int saved=errno;::close(fd);errno=saved;
    if(okay)value.assign(bytes.data(),size_t(count));
    else errno=EINVAL;
    return okay;
  }
  bool replace_(const char *name,const std::string &text) {
    if(!current_() || text.size()>255)return fail_("record_store_required");
    // Only an existing ordinary owned record can be replaced. A stale temp,
    // symlink or hardlink is left intact and blocks this operation.
    struct stat old{};
    if(!::fstatat(root_,name,&old,AT_SYMLINK_NOFOLLOW)) {
      if(!regular_(old,old.st_size,0600) || old.st_dev!=root_identity_.st_dev)return fail_("foreign_record_preserved");
    }else if(errno!=ENOENT)return fail_("record_metadata_unavailable");
    const std::string temporary=std::string(name)+".tmp";
    const int fd=::openat(root_,temporary.c_str(),O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);
    if(fd<0)return fail_("record_temporary_unavailable");
    bool okay=::write(fd,text.data(),text.size())==ssize_t(text.size()) && !::fsync(fd);
    okay=!::close(fd) && okay;
    if(!okay)return fail_("record_write_unverified");
    okay=current_() && !::renameat(root_,temporary.c_str(),root_,name) && !::fsync(root_);
    if(!okay)return fail_("record_activation_unverified");
    std::string checked;return read_(name,checked) && checked==text;
  }
};
using FullReleaseStore=BasicFullReleaseStore<>;
} // namespace cgs1_supervisor
