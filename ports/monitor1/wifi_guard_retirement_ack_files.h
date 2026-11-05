#pragma once

// Only a transport: the production guardian must independently hold its cached
// plan and read the exact canonical COMMITTED Store decision before entering
// either stage. Native still needs its own live lease/Store lock before unlink.
// RETIRED receipts remain readable after a later journal generation appears;
// requiring the OLD filenames to remain absent during that read would race
// native legitimately beginning its next independently admitted transaction.
#include "wifi_guard_retirement_ack.h"
#include "wifi_guard_retirement_intent_file.h"

namespace cgs1_wifi_retirement {
enum class OldState {PRESENT,CLEAR,CONFLICT,UNREADABLE};
enum class PlanState {PRESENT,MISSING,CONFLICT,UNREADABLE};
template<class IO=IntentPosix>class AckFiles {
 public:
  AckFiles()=default;AckFiles(const AckFiles&)=delete;AckFiles&operator=(const AckFiles&)=delete;
  ~AckFiles(){if(runtime_>=0)::close(runtime_);}
  bool open(int runtime,const Intent&intent,const cgs1_wifi_guard::Stamp&stamp) {
    if(attempted_)return false;
    attempted_=true;expected_=intent;intent_stamp_=stamp;
    runtime_=::fcntl(runtime,F_DUPFD_CLOEXEC,3);
    return runtime_>=0 && intent_.open(runtime_,intent,&stamp) && current_();
  }
  OldState old_state()const {
    if(!current_())return OldState::UNREADABLE;
    bool any=false;
    for(size_t n=0;n<OLD_FILES;++n) {
      struct stat s{};
      if(::fstatat(runtime_,old_name(OldFile(n)),&s,AT_SYMLINK_NOFOLLOW)) {
        if(errno==ENOENT)continue;
        return OldState::UNREADABLE;
      }
      if(!regular_(s,118) || !(stamp_(s)==expected_.old_files[n]))return OldState::CONFLICT;
      any=true;
    }
    return current_()?(any?OldState::PRESENT:OldState::CLEAR):OldState::UNREADABLE;
  }
  PlanState plan_state()const {
    if(!current_())return PlanState::UNREADABLE;
    struct stat s{};
    if(::fstatat(runtime_,"wifi-transaction.v1",&s,AT_SYMLINK_NOFOLLOW))return errno==ENOENT?PlanState::MISSING:PlanState::UNREADABLE;
    return regular_(s,expected_.plan.size) && stamp_(s)==expected_.plan?PlanState::PRESENT:PlanState::CONFLICT;
  }
  bool both(AckStage stage)const {
    if(!current_() || !peers_())return false;
    for(unsigned r=1;r<=2;++r) {
      Ack ack;
      if(read_(cgs1_wifi_guard::Role(r),stage,ack)!=IntentState::MATCH)return false;
    }
    return current_() && peers_();
  }
  IntentWrite acknowledge(cgs1_wifi_guard::Role role,AckStage stage,const cgs1_wifi_guard::Plan&snapshot) {
    const unsigned r=unsigned(role),st=unsigned(stage);
    if(r<1 || r>2 || st<1 || st>2)return IntentWrite::REFUSED;
    const unsigned index=(st-1)*2+r-1;
    if(writes_[index])return IntentWrite::CONSUMED;
    writes_[index]=true;
    const auto self=cgs1_net_trial::process_identity(::getpid());
    if(!current_() || !peers_() || self.pid!=long(expected_.peers[r-1].pid) || self.start!=expected_.peers[r-1].start ||
        self.executable!="/tmp/qingping-full-"+expected_.full_session+"/guardian/program" ||
        !for_plan(expected_,snapshot,expected_.plan,expected_.candidate,expected_.peers))return IntentWrite::REFUSED;
    Ack existing;const auto previous=read_(role,stage,existing);
    if(previous!=IntentState::MATCH && previous!=IntentState::MISSING)return IntentWrite::REFUSED;
    // An already visible ACK can be reconciled after a lost local fsync reply.
    // No old-file assertion is repeated: native may have legally pruned them.
    if(previous==IntentState::MATCH)return flush_ack_(role,stage)?IntentWrite::ACK:IntentWrite::UNCERTAIN;
    if(!intent_.flush_verified())return IntentWrite::UNCERTAIN;
    if(stage==AckStage::RETIRING) {
      if(!intent_.verify_baseline(snapshot))return IntentWrite::REFUSED;
    }else if(!both(AckStage::RETIRING) || old_state()!=OldState::CLEAR || plan_state()!=PlanState::MISSING)return IntentWrite::REFUSED;
    Ack ack;ack.full_session=expected_.full_session;ack.transaction=expected_.transaction;
    ack.plan=expected_.plan;ack.intent=intent_stamp_;ack.candidate=expected_.candidate;
    ack.role=uint8_t(role);ack.stage=uint8_t(stage);ack.pid=uint32_t(self.pid);ack.start=self.start;
    cgs1_wifi_private::detail::Bytes bytes;if(!encode(ack,bytes))return IntentWrite::REFUSED;
    const auto name=name_(role,stage),temporary="."+name+"-"+std::to_string(self.pid);
    const int fd=::openat(runtime_,temporary.c_str(),O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);
    if(fd<0)return IntentWrite::REFUSED;
    struct stat before{};bool okay=!::fstat(fd,&before) && S_ISREG(before.st_mode) && before.st_uid==0 &&
      before.st_nlink==1 && (before.st_mode&07777)==0600 && !before.st_size && uint64_t(before.st_dev)==intent_stamp_.device;
    size_t at=0;
    while(okay && at<bytes.value.size()) {
      const auto n=IO::write(fd,bytes.value.data()+at,bytes.value.size()-at);
      if(n<0 && errno==EINTR)continue;
      if(n<=0 || size_t(n)>bytes.value.size()-at)okay=false;else at+=size_t(n);
    }
    okay=okay && !::fchmod(fd,0400) && !IO::sync(fd);const bool closed=!::close(fd);
    if(!okay || !closed)return IntentWrite::UNCERTAIN;
    // Recheck immediately before publication. Fixed role ownership avoids a
    // competing writer; no overwrite/cleanup/retry is used on uncertainty.
    if(!current_() || !peers_() || read_(role,stage,existing)!=IntentState::MISSING)return IntentWrite::REFUSED;
    if(stage==AckStage::RETIRING && !intent_.verify_baseline(snapshot))return IntentWrite::REFUSED;
    if(stage==AckStage::RETIRED && (!both(AckStage::RETIRING) || old_state()!=OldState::CLEAR || plan_state()!=PlanState::MISSING))return IntentWrite::REFUSED;
    if(IO::rename(runtime_,temporary.c_str(),name.c_str()) || IO::sync(runtime_))return IntentWrite::UNCERTAIN;
    return read_(role,stage,existing)==IntentState::MATCH &&
      stamps_[index].inode==uint64_t(before.st_ino)?IntentWrite::ACK:IntentWrite::UNCERTAIN;
  }
 private:
  int runtime_{-1};bool attempted_{false};Intent expected_;cgs1_wifi_guard::Stamp intent_stamp_;
  IntentFile<IO>intent_;std::array<bool,4>writes_{};
  mutable std::array<bool,4>pinned_{};mutable std::array<cgs1_wifi_guard::Stamp,4>stamps_{};
  static cgs1_wifi_guard::Stamp stamp_(const struct stat&s) {
    return {uint64_t(s.st_dev),uint64_t(s.st_ino),uint64_t(s.st_size),uint64_t(s.st_mtim.tv_sec),uint64_t(s.st_mtim.tv_nsec),uint64_t(s.st_ctim.tv_sec),uint64_t(s.st_ctim.tv_nsec)};
  }
  bool regular_(const struct stat&s,size_t bytes)const {
    return S_ISREG(s.st_mode) && s.st_uid==0 && (s.st_mode&07777)==0400 && s.st_nlink==1 &&
      uint64_t(s.st_dev)==intent_stamp_.device && s.st_size==ssize_t(bytes);
  }
  bool current_()const {return intent_.inspect()==IntentState::MATCH;}
  bool peers_()const {
    for(const auto&p:expected_.peers) {
      const auto now=cgs1_net_trial::process_identity(p.pid);
      if(!now.running() || now.start!=p.start || now.executable!="/tmp/qingping-full-"+expected_.full_session+"/guardian/program")return false;
    }
    return true;
  }
  std::string name_(cgs1_wifi_guard::Role role,AckStage stage)const {
    return std::string(stage==AckStage::RETIRING?"wifi-retiring-":"wifi-retired-")+
      (role==cgs1_wifi_guard::Role::PRIMARY?"primary-":"backup-")+expected_.transaction+".v1";
  }
  IntentState read_(cgs1_wifi_guard::Role role,AckStage stage,Ack&out)const {
    if(!current_())return IntentState::UNREADABLE;
    const auto name=name_(role,stage);const int fd=::openat(runtime_,name.c_str(),O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC);
    if(fd<0)return errno==ENOENT?IntentState::MISSING:IntentState::UNREADABLE;
    struct stat before{},after{},named{};cgs1_wifi_private::detail::Bytes bytes;bytes.value.resize(ACK_BYTES);
    bool okay=!::fstat(fd,&before) && regular_(before,ACK_BYTES);size_t at=0;
    while(okay && at<bytes.value.size()) {
      const auto n=::read(fd,&bytes.value[at],bytes.value.size()-at);
      if(n<0 && errno==EINTR)continue;
      if(n<=0)okay=false;else at+=size_t(n);
    }
    okay=okay && !::fstat(fd,&after) && stamp_(before)==stamp_(after) && regular_(after,ACK_BYTES);const bool closed=!::close(fd);
    if(!okay || !closed || !current_() || ::fstatat(runtime_,name.c_str(),&named,AT_SYMLINK_NOFOLLOW) ||
        !regular_(named,ACK_BYTES) || !(stamp_(named)==stamp_(before)))return IntentState::UNREADABLE;
    if(!decode(bytes,out) || !acknowledgement_for(out,expected_,intent_stamp_,role,stage))return IntentState::CONFLICT;
    const auto index=(unsigned(stage)-1)*2+unsigned(role)-1;const auto current=stamp_(named);
    if(pinned_[index] && !(stamps_[index]==current))return IntentState::CONFLICT;
    pinned_[index]=true;stamps_[index]=current;return IntentState::MATCH;
  }
  bool flush_ack_(cgs1_wifi_guard::Role role,AckStage stage)const {
    Ack ack;if(!intent_.flush_verified() || read_(role,stage,ack)!=IntentState::MATCH)return false;
    const unsigned index=(unsigned(stage)-1)*2+unsigned(role)-1;const auto before=stamps_[index];const auto name=name_(role,stage);
    const int fd=::openat(runtime_,name.c_str(),O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC);
    if(fd<0)return false;
    struct stat held{};const bool okay=!::fstat(fd,&held) && regular_(held,ACK_BYTES) && stamp_(held)==before && !IO::sync(fd);
    const bool closed=!::close(fd);
    return okay && closed && !IO::sync(runtime_) && read_(role,stage,ack)==IntentState::MATCH && stamps_[index]==before;
  }
};
} // namespace cgs1_wifi_retirement
