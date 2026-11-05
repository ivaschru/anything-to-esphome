#pragma once

// Boot-local, root-private recovery journal. The permanent runner supplies a
// HELD directory FD and original values from its sealed, verified plan. No
// path, GPIO address, original value or command arrives through an API here.
// Native must arm the corresponding fixed marker BEFORE its first mutation.
// Recovery is called only after native death + exclusive recovery lock.
#include "independent_pm_power.h"
#include "network_preflight.h"
#include "supervisor_network_receipt.h"
#include <sys/vfs.h>

namespace cgs1_supervisor {
struct OriginalEffects {
  std::string boot_id;
  bool pm_enabled{false};
  uint32_t pm_mux{0xffffffffU};
  unsigned brightness{1001};
};

class Cgs1EffectHardware {
 public:
  bool restore_pm(bool enabled,uint32_t original_mux) {
    if(!cgs1_pm::inspect().write_only_supported() ||
       original_mux!=(enabled?cgs1_pm::pinmux::UART:cgs1_pm::pinmux::GPIO))return false;
    // Each fixed sysfs store is attempted once. A short/interrupted write is
    // uncertain, never retried here. Still attempt the other restore fields;
    // the original state is known and native no longer owns these resources.
    const bool power=store_sysfs_bit_(cgs1_pm::POWER,enabled);
    const bool reset=store_sysfs_bit_(cgs1_pm::RESET,enabled);
    cgs1_pm::pinmux::Register mux;
    const bool restored=mux.open(true) && mux.store(enabled) &&
                        (mux.read()&cgs1_pm::pinmux::MASK)==original_mux;
    return power && reset && restored;
  }
  bool restore_brightness(unsigned original) {
    if(original>1000 || cgs1_net_trial::read_small("/sys/class/backlight/rk28_bl/max_brightness",16)!="1000\n")return false;
    return store_sysfs_("/sys/class/backlight/rk28_bl/brightness",std::to_string(original)+"\n",false);
  }
 private:
  static bool store_sysfs_bit_(const char *path,bool value) {
    return store_sysfs_(path,value?"1\n":"0\n",true);
  }
  static bool store_sysfs_(const char *path,const std::string &value,bool write_only) {
    const int fd=::open(path,O_WRONLY|O_NOFOLLOW|O_CLOEXEC|O_NONBLOCK);
    if(fd<0)return false;
    struct stat info{};struct statfs fs{};
    const bool valid=!::fstat(fd,&info) && S_ISREG(info.st_mode) && info.st_uid==0 &&
                     (!write_only || (info.st_mode&07777)==0200) &&
                     !::fstatfs(fd,&fs) && fs.f_type==0x62656572;
    const bool written=valid && ::write(fd,value.data(),value.size())==ssize_t(value.size());
    ::close(fd);return written;
  }
};

template<class Hardware=Cgs1EffectHardware> class RecoveryEffects {
 public:
  explicit RecoveryEffects(Hardware &hardware):hardware_(hardware){}
  ~RecoveryEffects(){if(directory_>=0)::close(directory_);}
  RecoveryEffects(const RecoveryEffects &)=delete;
  RecoveryEffects &operator=(const RecoveryEffects &)=delete;
  bool open(int held_directory,const OriginalEffects &original) {
    if(attempted_)return false;
    attempted_=true;
    struct stat info{};struct statfs fs{};
    if(original.boot_id.size()!=36 || original.brightness>1000 ||
       original.pm_mux!=(original.pm_enabled?cgs1_pm::pinmux::UART:cgs1_pm::pinmux::GPIO) ||
       ::fstat(held_directory,&info) || !S_ISDIR(info.st_mode) || info.st_uid!=0 ||
       (info.st_mode&07777)!=0700 || ::fstatfs(held_directory,&fs) || fs.f_type!=0x01021994)return false;
    directory_=::fcntl(held_directory,F_DUPFD_CLOEXEC,3);
    if(directory_<0)return false;
    original_=original;device_=info.st_dev;return true;
  }
  bool restore_before_vendor_start(const cgs1_net_trial::StockInspection &plan,const NetworkRecoveryReceipt*network=nullptr) {
    if(restore_attempted_ && !recovered_)return false;
    if(directory_<0 || !plan.verified || plan.boot_id!=original_.boot_id)return false;
    recovery_plan_=plan;
    // Check the network journal BEFORE honoring an old generic receipt. A
    // previous effects-result can never conceal a newly armed Wi-Fi change.
    // Legacy RAM Wi-Fi remains unsupported. The new journal needs a concrete
    // live production receipt; its keys never enter this generic adapter.
    if(!network_gate_(plan,network))return false;
    if(recovered_)return result_;
    const auto previous=read_("effects-result");
    if(previous.first==Read::ERROR)return false;
    if(previous.first==Read::PRESENT) {
      if(previous.second!="CGS1_EFFECTS_OK_V1\n" && previous.second!="CGS1_EFFECTS_ERROR_V1\n")return false;
      recovered_=true;result_=previous.second=="CGS1_EFFECTS_OK_V1\n";return result_;
    }
    const auto pm=marker_("pm-power-armed","CGS1_PM_V2\n");
    const auto brightness=marker_("brightness-armed","CGS1_BL_V1\n");
    if(pm==Read::ERROR || brightness==Read::ERROR)return false;
    restore_attempted_=true;
    bool okay=true;
    if(pm==Read::PRESENT)okay=hardware_.restore_pm(original_.pm_enabled,original_.pm_mux);
    if(brightness==Read::PRESENT)okay=hardware_.restore_brightness(original_.brightness) && okay;
    // Commit before any vendor CONT. A later backup after a lost ACK reads
    // the same success/error and never reapplies old settings to a fresh GUI.
    if(!commit_(okay))return false;
    recovered_=true;result_=okay;return result_;
  }
  // A hardware store can fail yet produce a durable ERROR receipt: vendor
  // fallback may resume in that case. Missing/invalid/uncertain receipt must
  // block CONT, or a late backup could reapply old values to a new GUI.
  bool safe_to_resume_vendor(const NetworkRecoveryReceipt*network=nullptr) const {
    // A former OK/ERROR record is not timeless permission for CONT. Recheck
    // the network gate at this final boundary as well as during restoration.
    return recovered_ && network_gate_(recovery_plan_,network);
  }
 private:
  enum class Read {ABSENT,PRESENT,ERROR};
  Hardware &hardware_;int directory_{-1};dev_t device_{};OriginalEffects original_;
  cgs1_net_trial::StockInspection recovery_plan_;
  bool attempted_{false},restore_attempted_{false},recovered_{false},result_{false};
  bool network_gate_(const cgs1_net_trial::StockInspection&plan,const NetworkRecoveryReceipt*network)const {
    if(read_("wifi-ram-armed").first!=Read::ABSENT)return false;
    struct stat entry{};
    if(::fstatat(directory_,"wifi-transaction.v1",&entry,AT_SYMLINK_NOFOLLOW))return errno==ENOENT;
    return network && network->verify_for(directory_,plan);
  }
  std::pair<Read,std::string> read_(const char *name) const {
    const int fd=::openat(directory_,name,O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC);
    if(fd<0)return {errno==ENOENT?Read::ABSENT:Read::ERROR,{}};
    struct stat before{},after{},entry{};char bytes[65]{};
    const bool valid=!::fstat(fd,&before) && S_ISREG(before.st_mode) && before.st_uid==0 &&
      (before.st_mode&07777)==0600 && before.st_nlink==1 && before.st_dev==device_ &&
      before.st_size>0 && before.st_size<=64;
    const auto n=valid?::read(fd,bytes,sizeof(bytes)):-1;
    const bool stable=n==before.st_size && n>0 && !::fstat(fd,&after) &&
      after.st_size==before.st_size && after.st_mtime==before.st_mtime && after.st_ctime==before.st_ctime &&
      !::fstatat(directory_,name,&entry,AT_SYMLINK_NOFOLLOW) && entry.st_dev==before.st_dev &&
      entry.st_ino==before.st_ino && entry.st_uid==0 && entry.st_nlink==1 && (entry.st_mode&07777)==0600;
    ::close(fd);
    return stable?std::make_pair(Read::PRESENT,std::string(bytes,size_t(n))):std::make_pair(Read::ERROR,std::string{});
  }
  Read marker_(const char *name,const char *expected) const {
    const auto value=read_(name);
    return value.first==Read::PRESENT && value.second!=expected?Read::ERROR:value.first;
  }
  bool commit_(bool okay) {
    const auto temporary="effects-result.tmp."+std::to_string(::getpid());
    const char *text=okay?"CGS1_EFFECTS_OK_V1\n":"CGS1_EFFECTS_ERROR_V1\n";
    const size_t size=std::strlen(text);
    const int fd=::openat(directory_,temporary.c_str(),O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);
    if(fd<0)return false;
    const bool written=::write(fd,text,size)==ssize_t(size) && !::fsync(fd);
    ::close(fd);
    struct stat entry{};
    // The runner holds its recovery lock. Refuse an unexpected committed
    // record rather than overwrite it; old partial temp files are preserved.
    if(!written || !::fstatat(directory_,"effects-result",&entry,AT_SYMLINK_NOFOLLOW) || errno!=ENOENT)return false;
    return !::renameat(directory_,temporary.c_str(),directory_,"effects-result") && !::fsync(directory_);
  }
};
}  // namespace cgs1_supervisor
