#pragma once

// One stock-preserving, passive, 60-second diagnostic session. Repeated START
// reconciles the SAME session and never opens another socket/extends its time.
// This is not a Wi-Fi transaction writer: even an observed lease grants no
// commit/recovery authority. Production forward switching needs its own frozen
// writers, transaction/guardian binding and gateway proof.
#include "dhcp_packet_capture.h"
#include "dhcp_owner_inspect.h"
#include "wifi_daemon_inspect.h"
#include "wifi_boot_baseline.h"

namespace cgs1_dhcp_lease {
inline bool parse_probe_boot_id(const std::string&text,std::string&out) {
  // procfs includes exactly one newline; sealed transaction plans store the
  // canonical 36-byte UUID. Retaining the newline makes a genuine same-boot
  // production observation differ from its plan, although synthetic fixtures
  // using a ready-made UUID would pass. Validate before removing that suffix.
  if(text.size()!=37 || text.back()!='\n')return false;
  for(size_t i=0;i<36;++i) {
    if(i==8 || i==13 || i==18 || i==23){if(text[i]!='-')return false;}
    else if(!((text[i]>='0' && text[i]<='9') || (text[i]>='a' && text[i]<='f')))return false;
  }
  out.assign(text.data(),36);return true;
}
struct ProbeFence {
  std::string boot;
  cgs1_wifi::DaemonInspection daemon;cgs1_wifi::Status association;
  std::vector<cgs1_wifi::SavedProfile>profiles;
};
inline bool same_probe_fence(const ProbeFence&a,const ProbeFence&b) {
  if(a.boot!=b.boot || a.daemon.socket_inode!=b.daemon.socket_inode ||
      a.daemon.process.pid!=b.daemon.process.pid || a.daemon.process.start!=b.daemon.process.start ||
      a.daemon.process.executable!=b.daemon.process.executable ||
      a.association.state!=b.association.state || a.association.network_id!=b.association.network_id ||
      a.association.bssid!=b.association.bssid || a.association.key_management!=b.association.key_management ||
      a.association.frequency!=b.association.frequency || a.profiles.size()!=b.profiles.size())return false;
  for(const auto&old:a.profiles) {
    const auto at=std::find_if(b.profiles.begin(),b.profiles.end(),[&](const auto&v){return v.id==old.id;});
    if(at==b.profiles.end() || old.ssid_text!=at->ssid_text || old.bssid!=at->bssid ||
        old.flags!=at->flags || old.current!=at->current || old.disabled!=at->disabled ||
        !at->flags_known || at->temporarily_disabled)return false;
  }
  // DHCP may legitimately replace the IP during this same association.
  // Do not bind to WPA STATUS's potentially stale ip_address string.
  return true;
}
class ProbeBackend {
 public:
  uint64_t now()const{return capture_now_ms();}
  bool prepare() {
    const auto inventory=cgs1_dhcp::inspect();
    if(!inventory.scan_complete || inventory.clients.size()!=1 || !inventory.executable.verified ||
        !inventory.executable.filesystem_read_only || !inventory.vendor_launcher_matches)return false;
    dhcp_=inventory.clients[0].process;return true;
  }
  bool read(ProbeFence&out)const {
#if defined(__linux__)
    if(!cgs1_net_trial::same_process(dhcp_))return false;
    const auto before=cgs1_wifi::inspect_daemon(0);if(!before.verified)return false;
    cgs1_wifi::ReadOnlyControl control;cgs1_wifi::Status status;std::vector<cgs1_wifi::SavedProfile>profiles;std::string reply;
    const bool okay=control.open(0) && cgs1_wifi::read_status(control,status) &&
      control.request("LIST_NETWORKS",reply) && cgs1_wifi::parse_saved_profiles(reply,profiles);
    const bool cleanup=control.close();const auto after=cgs1_wifi::inspect_daemon(0);
    if(!okay || !cleanup || !after.verified || before.socket_inode!=after.socket_inode ||
        before.process.pid!=after.process.pid || before.process.start!=after.process.start ||
        before.process.executable!=after.process.executable || !cgs1_net_trial::same_process(dhcp_) ||
        status.state!="COMPLETED" || status.network_id<0 || !cgs1_wifi::mac_address(status.bssid))return false;
    unsigned current=0;
    for(const auto&p:profiles) {
      if(!p.flags_known || p.temporarily_disabled)return false;
      if(p.current){if(p.id!=status.network_id || p.disabled)return false;++current;}
    }
    if(current!=1)return false;
    std::string boot;
    if(!parse_probe_boot_id(cgs1_net_trial::read_small("/proc/sys/kernel/random/boot_id",64),boot))return false;
    out={boot,after,status,std::move(profiles)};return true;
#else
    (void)out;return false;
#endif
  }
  bool read_unassociated(ProbeFence&out)const {
    // Separate boot-only observation; read() above remains the connected
    // lease/commit reader. No failure of read() is converted into this mode
    // and this method sends no DISCONNECT/SELECT/renew or fabricated lease.
    ProbeFence observed;
    if(!read_boot(observed) || cgs1_wifi_boot::classify(observed.association,observed.profiles)!=
        cgs1_wifi_boot::Baseline::UNASSOCIATED)return false;
    out=std::move(observed);return true;
  }
  bool read_boot(ProbeFence&out)const {
    // One read-only capture explicitly classifies a boot baseline. This is
    // not a retry/fallback after connected read() failed: invalid/ambiguous
    // states refuse before any caller can choose a recovery policy.
#if defined(__linux__)
    if(!cgs1_net_trial::same_process(dhcp_))return false;
    const auto before=cgs1_wifi::inspect_daemon(0);if(!before.verified)return false;
    cgs1_wifi::ReadOnlyControl control;cgs1_wifi::Status status;
    std::vector<cgs1_wifi::SavedProfile>profiles;std::string reply;
    const bool okay=control.open(0) && cgs1_wifi::read_status(control,status) &&
      control.request("LIST_NETWORKS",reply) && cgs1_wifi::parse_saved_profiles(reply,profiles);
    const bool cleanup=control.close();const auto after=cgs1_wifi::inspect_daemon(0);
    if(!okay || !cleanup || !after.verified || before.socket_inode!=after.socket_inode ||
        before.process.pid!=after.process.pid || before.process.start!=after.process.start ||
        before.process.executable!=after.process.executable || !cgs1_net_trial::same_process(dhcp_) ||
        cgs1_wifi_boot::classify(status,profiles)==cgs1_wifi_boot::Baseline::UNSUPPORTED)return false;
    std::string boot;
    if(!parse_probe_boot_id(cgs1_net_trial::read_small("/proc/sys/kernel/random/boot_id",64),boot))return false;
    out={boot,after,status,std::move(profiles)};return true;
#else
    (void)out;return false;
#endif
  }
  cgs1_ipv4::View ipv4()const{return cgs1_ipv4::inspect();}
  bool owner_matches(const cgs1_net_trial::ProcessIdentity&owner)const {
    return owner.pid==dhcp_.pid && owner.start==dhcp_.start && owner.executable==dhcp_.executable &&
      cgs1_net_trial::same_process(dhcp_);
  }
 private:
  cgs1_net_trial::ProcessIdentity dhcp_;
};

template<class Backend=ProbeBackend,class Capture=PacketCapture<>> class CaptureProbe {
 public:
  bool start() {
    if(attempted_)return opened_ && !failed_; // Lost START ACK: read back, never re-arm.
    attempted_=true;
    if(!backend_.prepare() || !backend_.read(baseline_))return fail_("probe_initial_owner_or_association_unavailable");
    const auto now=backend_.now();const auto kernel=backend_.ipv4();
    if(!now || !kernel.verified || !kernel.up || !kernel.running || kernel.index<=0)return fail_("probe_initial_ipv4_unavailable");
    generation_=now;deadline_=now+60000;
    if(!witness_.arm(generation_,kernel.index,now,deadline_) || !capture_.open(generation_,deadline_))return fail_("probe_packet_open_refused");
    ProbeFence after;
    if(!backend_.read(after) || !same_probe_fence(baseline_,after))return fail_("probe_association_changed_during_open");
    const auto admitted=backend_.now();
    // Control-socket reads can block. A valid fence obtained after the fixed
    // deadline must never make an already expired capture active again.
    if(!admitted || admitted<now || admitted>=deadline_)return fail_("probe_open_clock_or_deadline");
    opened_=true;active_=true;last_fence_ms_=admitted;last_poll_ms_=admitted;return true;
  }
  void poll() {
    if(!active_)return;
    const auto now=backend_.now();
    if(!now || now<last_poll_ms_){fail_("probe_clock_invalid");return;}
    last_poll_ms_=now;
    if(now>=deadline_){stop();return;}
    if(now-last_fence_ms_>=1000) {
      ProbeFence current;
      if(!backend_.read(current) || !same_probe_fence(baseline_,current)) {fail_("probe_owner_or_association_changed");return;}
      const auto checked=backend_.now();
      if(!checked || checked<now){fail_("probe_clock_invalid");return;}
      if(checked>=deadline_){stop();return;}
      last_fence_ms_=checked;last_poll_ms_=checked;
    }
    bool saw=false;
    for(unsigned n=0;n<8;++n) {
      Captured frame;const auto result=capture_.next(frame);
      if(result==CaptureResult::FAILED){fail_("probe_capture_loss_or_metadata_failure");return;}
      if(result==CaptureResult::EMPTY)break;
      if(result==CaptureResult::FILTERED)continue;
      ++messages_;requests_+=frame.message.from_client && frame.message.type==3;acks_+=!frame.message.from_client && frame.message.type==5;
      witness_.observe(frame.message,frame.generation,frame.interface_index,frame.observed_ms,frame.request_earliest_ms);saw=true;
    }
    if(saw) {
      // A lease observation is historical metadata for THIS passive session,
      // not a stale boolean to be fed into a later transaction commit.
      ProbeFence current;
      if(!backend_.read(current) || !same_probe_fence(baseline_,current)) {fail_("probe_post_packet_fence_changed");return;}
      const auto kernel=backend_.ipv4();const auto observed=backend_.now();
      if(!observed || observed<last_poll_ms_){fail_("probe_clock_invalid");return;}
      if(observed>=deadline_){stop();return;}
      last_fence_ms_=observed;last_poll_ms_=observed;
      if(witness_.matches(kernel,generation_,observed)){lease_observed_=true;lease_observed_ms_=observed;}
    }
  }
  void stop(){attempted_=true;active_=false;finished_=true;witness_.invalidate();capture_.close();}
  bool attempted()const{return attempted_;}bool opened()const{return opened_;}bool active()const{return active_;}
  bool finished()const{return finished_;}bool failed()const{return failed_;}bool lease_observed()const{return lease_observed_;}
  uint64_t generation()const{return generation_;}uint64_t deadline()const{return deadline_;}
  uint64_t lease_observed_ms()const{return lease_observed_ms_;}
  unsigned messages()const{return messages_;}unsigned requests()const{return requests_;}unsigned acks()const{return acks_;}
  const std::string&error()const{return error_;}const std::string&capture_error()const{return capture_.error();}
  const CaptureCounters&counters()const{return capture_.counters();}
  bool current_binding(const cgs1_net_trial::ProcessIdentity&owner)const {
    // Read-only join for a separately authorized one-shot renewal. The
    // original capture deadline is never extended, including control reads.
    const auto before=backend_.now();ProbeFence current;
    if(!active_ || failed_ || !before || before<last_poll_ms_ || before>=deadline_ ||
        !backend_.owner_matches(owner) || !backend_.read(current) ||
        !same_probe_fence(baseline_,current))return false;
    const auto after=backend_.now();return after>=before && after<deadline_;
  }
  bool current_lease(const cgs1_net_trial::ProcessIdentity&owner)const {
    // lease_observed() is deliberately historical. A recovery observer must
    // also revalidate the live owner/association, the current kernel route,
    // and the original packet witness's generation/deadline. A later NAK,
    // address change, loss, stop or clock reversal therefore revokes this
    // snapshot without erasing useful historical diagnostic evidence.
    if(!lease_observed_ || !current_binding(owner))return false;
    const auto kernel=backend_.ipv4();const auto now=backend_.now();
    return active_ && !failed_ && now>=last_poll_ms_ && now<deadline_ &&
      witness_.matches(kernel,generation_,now);
  }
 private:
  Backend backend_;Capture capture_;Witness witness_;ProbeFence baseline_;
  bool attempted_{false},opened_{false},active_{false},finished_{false},failed_{false},lease_observed_{false};
  uint64_t generation_{0},deadline_{0},last_fence_ms_{0},last_poll_ms_{0},lease_observed_ms_{0};unsigned messages_{0},requests_{0},acks_{0};
  std::string error_;
  bool fail_(const char*error){failed_=true;error_=error;stop();return false;}
};
} // namespace cgs1_dhcp_lease
