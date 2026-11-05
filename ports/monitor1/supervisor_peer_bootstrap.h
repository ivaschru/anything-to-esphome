#pragma once

// Validate the two inherited peers before the native app talks to them.
// The layout/hash MUST come from the compiled release, not network input or
// environment. This proves peer/process/image trust only, NOT hardware grant:
// a separate full-runtime bootstrap must verify the armed recovery plan and
// completed stock takeover before any UART/DRM/PM setup is allowed.
#include "supervisor_bootstrap_codec.h"
#include "supervisor_image.h"
#include "supervisor_twin_client.h"

namespace cgs1_supervisor {
struct GuardianRelease {
  const char *directory{nullptr};Digest digest{};ExecutableSpec architecture{};
};
class NativePeers {
 public:
  bool connect(const InheritedPeers &peers,const GuardianRelease &release) {
    if(attempted_)return false;
    attempted_=true;
    if(::geteuid()!=0 || ::getuid()!=0 || !release.directory ||
       std::all_of(release.digest.begin(),release.digest.end(),[](unsigned char x){return x==0;}) ||
       !directory_.open_existing(release.directory,0) ||
       !directory_.inspect(image_,release.architecture,&release.digest)) {
      ::dprintf(STDERR_FILENO,"CGS1_PEERS release refused errno=%d\n",errno);return false;
    }
    std::array<int,2> descriptors{};std::array<ProcessStamp,2> guardians{};
    for(unsigned i=0;i<2;++i) {
      if(peers[i].descriptor<3 || peers[i].pid<=1 || !peers[i].start)return false;
      guardians[i]=process_stamp(peers[i].pid);
      if(guardians[i].start!=peers[i].start || guardians[i].owner!=0) {
        ::dprintf(STDERR_FILENO,"CGS1_PEERS birth refused index=%u\n",i);return false;
      }
      struct stat actual{};
      if(::stat(("/proc/"+std::to_string(peers[i].pid)+"/exe").c_str(),&actual) || !image_.matches_executable(actual)) {
        ::dprintf(STDERR_FILENO,"CGS1_PEERS executable refused index=%u errno=%d\n",i,errno);return false;
      }
      descriptors[i]=peers[i].descriptor;
    }
    connected_=client_.connect(descriptors,guardians);
    return connected_;
  }
  // Only these six bounded numeric environment fields are read. Their mere
  // presence is never authority; connect still checks real kernel parents,
  // UID/start/ELF/SHA and SCM_CREDENTIALS on both private channel ACKs.
  bool connect_inherited(const GuardianRelease &release) {
    const char *names[]{"CGS1_PRIMARY_FD","CGS1_PRIMARY_PID","CGS1_PRIMARY_START",
                        "CGS1_BACKUP_FD","CGS1_BACKUP_PID","CGS1_BACKUP_START"};
    std::array<std::string,6> fields;
    for(unsigned i=0;i<6;++i) {
      const char *text=std::getenv(names[i]);
      if(!text || ::strnlen(text,21)>20)return false;
      fields[i]=text;
    }
    InheritedPeers peers;
    return parse_inherited_peers(fields,peers) && connect(peers,release);
  }
  bool connected() const {return connected_;}
  TwinClient &client(){return client_;}
 private:
  bool attempted_{false},connected_{false};ImageDirectory directory_;ImageFile image_;TwinClient client_;
};
}  // namespace cgs1_supervisor
