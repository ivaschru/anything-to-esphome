#pragma once

// One guardian's actual child-facing channel + image + lease adapter. It may
// observe a known grandchild for backup supervision, but never signals it.
// Process tree ownership and hardware recovery remain separate, mandatory
// responsibilities of the standalone guardian runner.
#include "supervisor_client.h"
#include "supervisor_image.h"
#include "supervisor_lease.h"
#include "supervisor_process_tree.h"
#include <memory>

namespace cgs1_supervisor {
class GuardianEndpoint {
 public:
  GuardianEndpoint() = default;
  GuardianEndpoint(const GuardianEndpoint &) = delete;
  GuardianEndpoint &operator=(const GuardianEndpoint &) = delete;
  ~GuardianEndpoint(){if(fd_>=0)::close(fd_);}
  bool open(int fd,const ProcessStamp &native,ImageDirectory &directory,
            const ExecutableSpec &spec={},const Timing &timing={},const Digest *initial_digest=nullptr) {
    if(attempted_)return false;
    attempted_=true;
    images_[0]=std::make_unique<ImageFile>();
    if(native.pid<=1 || !native.start || !configure_channel(fd) ||
       !directory.inspect(*images_[0],spec,initial_digest,ImageSync::FILE_AND_DIRECTORY))return false;
    fd_=fd;native_=native;directory_=&directory;spec_=spec;used_=1;
    return lease_.begin(clock_ms(),images_[0]->identity(),timing);
  }
  const Lease &lease() const {return lease_;}
  unsigned held_image_count() const {return used_;}
  // Processes at most one packet so old queues cannot starve an independent
  // deadline/primary heartbeat check in the runner's outer loop.
  bool step() {
    if(fd_<0){lease_.fail(Fault::CONFIG);return false;}
    lease_.tick(clock_ms());
    if(lease_.phase()==Phase::FAULT || lease_.phase()==Phase::STOP_REQUESTED)return false;
    Frame frame;const auto received=receive_frame(fd_,native_.pid,native_.owner,frame);
    if(received==Receive::EMPTY)return true;
    if(received!=Receive::FRAME){lease_.fail(Fault::CHANNEL);return false;}
    const auto actual=process_stamp(native_.pid);
    if(actual.start!=native_.start || actual.owner!=native_.owner){lease_.fail(Fault::IMAGE);return false;}
    struct stat executable{};Image running{},path{};ImageFile aborted_path;unsigned matched=used_;
    if(!::stat(("/proc/"+std::to_string(native_.pid)+"/exe").c_str(),&executable))
      for(unsigned i=0;i<used_;++i)if(images_[i] && images_[i]->matches_executable(executable)) {
        running=images_[i]->identity();matched=i;break;
      }
    if(frame.kind==Kind::OTA_END) {
      if(used_>=images_.size()) {lease_.fail(Fault::IMAGE);return false;}
      images_[used_]=std::make_unique<ImageFile>();
      if(!directory_->inspect(*images_[used_],spec_,nullptr,ImageSync::FILE_AND_DIRECTORY)) {
        lease_.fail(Fault::IMAGE);return false;
      }
      path=images_[used_++]->identity();
    }
    if(frame.kind==Kind::OTA_ABORT) {
      if(!directory_->inspect(aborted_path,spec_)){lease_.fail(Fault::IMAGE);return false;}
      path=aborted_path.identity();
    }
    // Keep BOTH current and pending image descriptors across rename/exec and
    // HELLO. Only a verified READY in the new RUNNING generation retires old
    // inodes. Keeping every historical image would permanently exhaust four
    // slots after three updates, despite the healthy restart-budget reset.
    const auto reply=lease_.receive(frame,clock_ms(),running,path);
    if(reply.accepted && frame.kind==Kind::READY && lease_.phase()==Phase::RUNNING) {
      if(matched>=used_){lease_.fail(Fault::IMAGE);return false;}
      auto current=std::move(images_[matched]);
      for(auto &image:images_)image.reset();
      images_[0]=std::move(current);used_=1;
    }
    if(reply.has_ack && send_frame(fd_,reply.ack)!=Send::SENT){lease_.fail(Fault::CHANNEL);return false;}
    return reply.accepted && lease_.phase()!=Phase::STOP_REQUESTED;
  }
 private:
  int fd_{-1};bool attempted_{false};ProcessStamp native_;
  ImageDirectory *directory_{nullptr};ExecutableSpec spec_;Lease lease_;
  std::array<std::unique_ptr<ImageFile>,2> images_;unsigned used_{0};
};
}  // namespace cgs1_supervisor
