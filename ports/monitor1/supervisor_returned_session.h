#pragma once

// Narrow post-return scope, issued only by an actual FullCoordinator after
// its backup was reaped, native absence/stock return checked, and listeners
// reopened. It proves that lifecycle boundary, NOT DHCP, a restored WPA
// profile, or permission to send a signal. A post-return network adapter must
// independently verify those facts before any operation of its own.
//
// The coordinator owns the anchor; consumers get a weak handle. Destruction,
// fork, directory replacement, bridge-birth change, clock reversal or the
// fixed 60-second window revokes it. A later read never refreshes that window.
#include "supervisor_full_plan.h"
#include "supervisor_client.h"
#include <memory>

namespace cgs1_supervisor {
template<class BridgePolicy>class FullCoordinator;
inline bool returned_session_window(uint64_t returned,uint64_t now) {
  // Pure arithmetic only, not a lifecycle capability. Keeping it separate
  // permits overflow/reversal/boundary tests without forging an Anchor.
  return returned && returned<=UINT64_MAX-60000 && now>=returned && now<returned+60000;
}
class ReturnedFullSession final {
 public:
  ReturnedFullSession()=default;
  ReturnedFullSession(const ReturnedFullSession&)=delete;
  ReturnedFullSession&operator=(const ReturnedFullSession&)=delete;
  ReturnedFullSession(ReturnedFullSession&&)=default;
  ReturnedFullSession&operator=(ReturnedFullSession&&)=default;
  bool valid()const {
    const auto held=anchor_.lock();return held && held->current();
  }
  bool copy_plan(FullPlan&out)const {
    const auto held=anchor_.lock();if(!held || !held->current())return false;
    FullPlan copy=held->plan;if(!held->current())return false;
    out=std::move(copy);return true;
  }
  int duplicate_runtime()const {
    const auto held=anchor_.lock();
    if(!held || !held->current())return -1;
    const int fd=::fcntl(held->runtime,F_DUPFD_CLOEXEC,3);
    if(fd>=0 && !held->current()){::close(fd);return -1;}
    return fd;
  }
 private:
  template<class BridgePolicy>friend class FullCoordinator;
  struct Anchor final {
    Anchor(int directory,const FullPlan&value,uint64_t when):plan(value),returned_at(when),owner(::getpid()) {
      runtime=::fcntl(directory,F_DUPFD_CLOEXEC,3);
      if(runtime>=0 && ::fstat(runtime,&identity)){::close(runtime);runtime=-1;}
    }
    ~Anchor(){if(runtime>=0)::close(runtime);}
    Anchor(const Anchor&)=delete;Anchor&operator=(const Anchor&)=delete;
    const FullPlan plan;const uint64_t returned_at;const pid_t owner;
    int runtime{-1};struct stat identity{};
    bool current()const {
      const auto now=clock_ms();
      if(owner!=::getpid() || ::geteuid()!=0 || runtime<0 || !returned_session_window(returned_at,now) ||
          plan.stock.processes[3].pid!=owner || !cgs1_net_trial::same_process(plan.stock.processes[3]))return false;
      const auto path="/tmp/qingping-full-"+plan.nonce;
      struct stat held{},named{};struct statfs fs{};
      return !::fstat(runtime,&held) && S_ISDIR(held.st_mode) && held.st_uid==0 &&
        (held.st_mode&07777)==0700 && held.st_dev==identity.st_dev && held.st_ino==identity.st_ino &&
        !::fstatfs(runtime,&fs) && fs.f_type==0x01021994 &&
        !::lstat(path.c_str(),&named) && S_ISDIR(named.st_mode) && named.st_uid==0 &&
        (named.st_mode&07777)==0700 && named.st_dev==held.st_dev && named.st_ino==held.st_ino &&
        cgs1_net_trial::read_link("/proc/self/fd/"+std::to_string(runtime))==path;
    }
  };
  explicit ReturnedFullSession(const std::shared_ptr<Anchor>&anchor):anchor_(anchor){}
  std::weak_ptr<Anchor>anchor_;
};
} // namespace cgs1_supervisor
