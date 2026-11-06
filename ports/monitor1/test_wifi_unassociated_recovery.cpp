// Pure synthetic policy. Deliberately NO select_original member: accidental
// reuse of the connected SELECT policy would not even compile with this type.
#include "wifi_unassociated_recovery.h"
#include <cassert>
#include <cstdio>
#include <functional>
using namespace cgs1_wifi_recovery;
using Plan=cgs1_wifi_guard::Plan;
namespace {
unsigned cases=0;
Profile profile(int id,bool enabled,bool current=false) {
  Profile p;p.id=id;p.ssid_text="fixture-"+std::to_string(id);p.bssid="any";
  p.disabled=!enabled;p.current=current;p.flags=current?"[CURRENT]":enabled?"":"[DISABLED]";return p;
}
Plan plan() {
  Plan p;p.full_session="0123456789abcdef";p.boot_id="11111111-2222-3333-4444-555555555555";
  p.created_ms=1000;p.deadline_ms=61000;p.daemon_pid=44;p.daemon_start=100;p.socket_inode=99;
  p.catalog_mode=cgs1_wifi_prepare::CatalogMode::UNASSOCIATED;
  p.original={profile(0,true,true),profile(1,true),profile(2,false)};
  p.decision.transaction="1123456789abcdef";
  cgs1_wifi_private::Network n;n.ssid_size=4;n.ssid={0,10,34,92};n.psk.fill(0x31);p.decision.desired={n};
  assert(cgs1_wifi_guard::valid(p));return p;
}
struct Backend {
  std::vector<Profile>rows{profile(0,false),profile(1,false),profile(2,false),profile(9,true,true)};
  std::vector<std::string>actions;
  bool fence=true,no_connect=true,read_ok=true,apply=true;
  unsigned decisions=0,catalogs=0,fences=0;int commit_after=-1;
  Decision disk=Decision::UNCOMMITTED;std::string lost;
  std::function<void(Backend&)>hook;
  bool recovery_exclusive(const Plan&){++fences;return fence;}
  Decision decision(const cgs1_wifi_decision::Plan&){++decisions;return commit_after>=0 && decisions>unsigned(commit_after)?Decision::COMMITTED:disk;}
  bool catalog(std::vector<Profile>&out){++catalogs;if(hook)hook(*this);if(!read_ok)return false;out=rows;return true;}
  bool verified_no_connect()const{return no_connect;}
  Reply remove_candidate(int id) {
    assert(fence && id==9);actions.push_back("remove9");
    if(apply)rows.erase(std::remove_if(rows.begin(),rows.end(),[&](const auto&p){return p.id==id;}),rows.end());
    return lost=="remove"?Reply::AMBIGUOUS:Reply::ACK;
  }
  Reply enable_original_no_connect(int id) {
    assert(fence && no_connect && (id==0 || id==1));actions.push_back("enable"+std::to_string(id));
    if(apply)for(auto&p:rows)if(p.id==id)p=profile(id,true);
    return lost=="enable"+std::to_string(id)?Reply::AMBIGUOUS:Reply::ACK;
  }
};
}
int main() {
  const auto p=plan();
  {auto manual=p;manual.catalog_mode=cgs1_wifi_prepare::CatalogMode::UNASSOCIATED_MANUAL;
    Backend b;UnassociatedRecovery r(b);assert(r.attempt(manual,9)==Result::CONFIGURATION_RESTORED);
    assert((b.actions==std::vector<std::string>{"remove9","enable0","enable1"}));++cases;}
  {auto manual=p;manual.catalog_mode=cgs1_wifi_prepare::CatalogMode::UNASSOCIATED_MANUAL;
    Backend b;b.disk=Decision::COMMITTED;UnassociatedRecovery r(b);
    assert(r.attempt(manual,9)==Result::KEEP_COMMITTED && b.actions.empty());++cases;}
  {Backend b;UnassociatedRecovery r(b);assert(r.attempt(p,9)==Result::CONFIGURATION_RESTORED);
    assert((b.actions==std::vector<std::string>{"remove9","enable0","enable1"}));
    assert(unassociated_flags_restored(p,b.rows));assert(r.attempt(p,9)==Result::CONSUMED);++cases;}
  {auto q=p;q.original[0]=profile(0,true);Backend b;UnassociatedRecovery r(b);
    assert(r.attempt(q,9)==Result::CONFIGURATION_RESTORED);++cases;}
  {auto q=p;q.original.clear();Backend b;b.rows={profile(9,true,true)};b.no_connect=false;
    UnassociatedRecovery r(b);assert(r.attempt(q,9)==Result::CONFIGURATION_RESTORED && b.rows.empty() && b.actions.size()==1);++cases;}
  {Backend b;b.rows=p.original;b.no_connect=false;UnassociatedRecovery r(b);
    assert(r.attempt(p,9)==Result::CONFIGURATION_RESTORED && b.actions.empty());++cases;}
  {Backend b;b.rows={profile(0,false),profile(1,false),profile(2,false)};
    UnassociatedRecovery r(b);assert(r.attempt(p,9)==Result::CONFIGURATION_RESTORED);
    assert((b.actions==std::vector<std::string>{"enable0","enable1"}));++cases;}
  {Backend b;b.rows=p.original;auto empty=profile(9,false);empty.ssid_text.clear();b.rows.push_back(empty);b.no_connect=false;
    UnassociatedRecovery r(b);assert(r.attempt(p)==Result::CONFIGURATION_RESTORED && b.actions==std::vector<std::string>{"remove9"});++cases;}
  {Backend b;b.rows=p.original;b.rows.push_back(profile(9,false));UnassociatedRecovery r(b);
    assert(r.attempt(p)==Result::REFUSED && b.actions.empty());++cases;}
  {Backend b;b.rows=p.original;b.rows[0]=profile(0,false);UnassociatedRecovery r(b);
    assert(r.attempt(p)==Result::REFUSED && b.actions.empty());++cases;}
  for(auto disk:{Decision::COMMITTED,Decision::UNKNOWN}) {
    Backend b;b.disk=disk;UnassociatedRecovery r(b);
    assert(r.attempt(p,9)==(disk==Decision::COMMITTED?Result::KEEP_COMMITTED:Result::DECISION_UNKNOWN));
    assert(b.actions.empty() && !b.catalogs);++cases;
  }
  for(unsigned fault=0;fault<8;++fault) {
    auto q=p;Backend b;int id=9;
    if(fault==0)q.catalog_mode=cgs1_wifi_prepare::CatalogMode::CONNECTED;
    if(fault==1)b.fence=false;
    if(fault==2)b.no_connect=false;
    if(fault==3)id=0;
    if(fault==4)id=-2;
    if(fault==5)id=1000001;
    if(fault==6)b.rows[2]=profile(2,true);
    if(fault==7)b.rows.push_back(profile(10,false));
    UnassociatedRecovery r(b);assert(r.attempt(q,id)==Result::REFUSED && b.actions.empty());++cases;
  }
  {Backend b;b.read_ok=false;UnassociatedRecovery r(b);assert(r.attempt(p,9)==Result::READ_UNAVAILABLE && b.actions.empty());++cases;}
  {Backend b;b.apply=false;UnassociatedRecovery r(b);assert(r.attempt(p,9)==Result::REFUSED && b.actions==std::vector<std::string>{"remove9"});++cases;}
  for(const char*lost:{"remove","enable0","enable1"}) {
    Backend b;b.lost=lost;UnassociatedRecovery first(b);
    assert(first.attempt(p,9)==(b.lost=="remove"?Result::REMOVE_UNCERTAIN:Result::ENABLE_UNCERTAIN));
    assert(first.attempt(p,9)==Result::CONSUMED);b.lost.clear();UnassociatedRecovery next(b);
    assert(next.attempt(p,9)==Result::CONFIGURATION_RESTORED);
    for(const char*action:{"remove9","enable0","enable1"})
      assert(std::count(b.actions.begin(),b.actions.end(),action)==1);
    ++cases;
  }
  for(int n=0;n<=3;++n) {
    Backend b;b.commit_after=n+1;UnassociatedRecovery r(b);
    assert(r.attempt(p,9)==Result::KEEP_COMMITTED && b.actions.size()==size_t(n));++cases;
  }
  for(unsigned fault=0;fault<5;++fault) {
    Backend b;
    if(fault==0)b.rows[0].ssid_text="foreign";
    if(fault==1)b.rows[0].bssid="02:00:00:00:00:01";
    if(fault==2)b.rows[1].flags_known=false;
    if(fault==3)b.rows[1].flags="[DISABLED][UNKNOWN]";
    if(fault==4)b.rows.push_back(b.rows[0]);
    UnassociatedRecovery r(b);assert(r.attempt(p,9)==Result::REFUSED && b.actions.empty());++cases;
  }
  {Backend b;b.hook=[](Backend&x){if(x.catalogs==2)x.rows[0].ssid_text="changed";};
    UnassociatedRecovery r(b);assert(r.attempt(p,9)==Result::REFUSED && b.actions.empty());++cases;}
  {Backend b;b.hook=[](Backend&x){if(x.catalogs>=5 && !x.rows[0].disabled){x.rows[0].current=true;x.rows[0].flags="[CURRENT]";}};
    UnassociatedRecovery r(b);assert(r.attempt(p,9)==Result::CONFIGURATION_RESTORED);++cases;}
  std::printf("{\"cases\":%u,\"hardware_contacted\":false,\"select_method_available\":false,\"policy_only\":true}\n",cases);
}
