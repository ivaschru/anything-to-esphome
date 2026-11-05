#pragma once

// Native screen discovery only. One explicit screen request may send one
// argument-free SCAN, then read cached SCAN_RESULTS. No SELECT/ENABLE, settings
// file, credentials getter, caller command or remote action is available.
#include "wifi_daemon_inspect.h"
#include "wifi_scan_results.h"

namespace cgs1_wifi {
class NativeScanControl final {
 public:
  NativeScanControl()=default;
  NativeScanControl(const NativeScanControl&)=delete;
  NativeScanControl&operator=(const NativeScanControl&)=delete;
  bool open() {
    if(open_attempted_)return false;
    open_attempted_=true;
#if defined(__linux__)
    daemon_=inspect_daemon(0);
    return daemon_.verified && control_.open(0) && current_();
#else
    return false;
#endif
  }
  bool scan() {
    if(scan_attempted_)return false;
    scan_attempted_=true;
#if defined(__linux__)
    std::string reply;
    return current_() && control_.exchange_("SCAN",reply,500) &&
      (reply=="OK" || reply=="OK\n") && current_();
#else
    return false;
#endif
  }
  bool read(std::vector<cgs1_wifi_scan::Network>&networks) {
#if defined(__linux__)
    std::string reply;std::vector<cgs1_wifi_scan::Network>parsed;
    if(!current_() || !control_.exchange_("SCAN_RESULTS",reply,500) || !current_() ||
        !cgs1_wifi_scan::parse(reply,parsed))return false;
    networks=std::move(parsed);return true;
#else
    (void)networks;return false;
#endif
  }
  bool close() {
#if defined(__linux__)
    return control_.close();
#else
    return true;
#endif
  }
 private:
  bool open_attempted_{false},scan_attempted_{false};
#if defined(__linux__)
  DaemonInspection daemon_;ReadOnlyControl control_;
  bool current_()const {
    const auto now=inspect_daemon(0);
    return daemon_.verified && now.verified && now.socket_inode==daemon_.socket_inode &&
      now.process.pid==daemon_.process.pid && now.process.start==daemon_.process.start &&
      now.process.executable==daemon_.process.executable;
  }
#endif
};
} // namespace cgs1_wifi

namespace cgs1_wifi_scan {
enum class State {IDLE,WAITING,COMPLETE,FAILED};
// Clock and Transport are compile-time test collaborators only; production
// runtime instantiates NativeScanControl and the existing monotonic clock.
template<class Transport,class Clock>class Session final {
 public:
  Session(Transport&transport,Clock&clock):transport_(transport),clock_(clock){}
  Session(const Session&)=delete;Session&operator=(const Session&)=delete;
  ~Session(){transport_.close();}
  bool start() {
    if(state_!=State::IDLE)return false;
    state_=State::FAILED;const auto now=clock_.now();
    if(!now || now>UINT64_MAX-8000 || !transport_.open() || !transport_.scan()) {transport_.close();return false;}
    last_=now;deadline_=now+8000;next_=now+1000;
    // A lost SCAN acknowledgement is consumed. No automatic retry is made;
    // otherwise a late reply could be mistaken for SCAN_RESULTS below.
    const auto after=clock_.now();
    if(after<now || after>=deadline_){transport_.close();return false;}
    last_=after;state_=State::WAITING;return true;
  }
  void poll() {
    if(state_!=State::WAITING)return;
    const auto now=clock_.now();
    if(!now || now<last_){fail_();return;}last_=now;
    // A delayed loop does not reopen/extend the discovery window or issue a
    // late query. Publish only a snapshot already read inside this session.
    if(now>=deadline_){finish_();return;}
    if(now<next_)return;
    std::vector<Network>result;
    if(!transport_.read(result)){fail_();return;}
    const auto after=clock_.now();
    if(after<now){fail_();return;}last_=after;pending_=std::move(result);have_result_=true;
    if(after>=deadline_) {
      // Finishing an eight-second observation does not prove these cached
      // rows were scanned within it. The transaction independently proves
      // association/DHCP and never accepts this session as authority.
      finish_();return;
    }
    next_=after+std::min<uint64_t>(1000,deadline_-after);
  }
  State state()const{return state_;}
  const std::vector<Network>&networks()const{return networks_;}
 private:
  Transport&transport_;Clock&clock_;State state_{State::IDLE};
  uint64_t last_{0},deadline_{0},next_{0};std::vector<Network>networks_,pending_;bool have_result_{false};
  void fail_(){transport_.close();state_=State::FAILED;networks_.clear();}
  void finish_() {
    if(!transport_.close() || !have_result_){state_=State::FAILED;return;}
    networks_=std::move(pending_);state_=State::COMPLETE;
  }
};
} // namespace cgs1_wifi_scan
