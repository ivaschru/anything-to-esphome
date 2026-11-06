// Real private Store + synthetic identity sources. The test wrapper sets cwd
// to its own temporary directory. No container-specific /work path, network,
// device, vendor process or production credential mount is required.
#include "native_wifi_plan.h"
#include <cassert>
#include <filesystem>
#include <iostream>
#include <functional>

using namespace cgs1_wifi_request;
using namespace cgs1_wifi_private;
static unsigned checks=0;
static void check(bool value){if(!value)std::cerr<<"failed check "<<checks+1<<"\n";assert(value);++checks;}
constexpr const char*OLD="0123456789abcdef",*NEXT="1123456789abcdef";
struct Source {
  inline static uint64_t clock=1000,delay=0;
  inline static bool available=true,unchanged_ok=true,random_ok=true;
  inline static unsigned nonce_calls=0;
  inline static std::string nonce_value=NEXT;
  inline static cgs1_dhcp_lease::ProbeFence snapshot;
  inline static std::function<void()>during_final_read;
  uint64_t now()const{return clock;}
  bool begin(cgs1_dhcp_lease::ProbeFence&out){clock+=delay;out=snapshot;return available;}
  bool unchanged(const cgs1_dhcp_lease::ProbeFence&)const{if(during_final_read)during_final_read();return unchanged_ok;}
  bool nonce(std::string&out)const{++nonce_calls;out=nonce_value;return random_ok;}
};
struct Scope {
  int parent;bool identify=true,allowed=true,duplicate=true;
  bool identify_plan(cgs1_wifi_guard::Plan&out)const {
    out.full_session="2123456789abcdef";out.boot_id="11111111-2222-3333-4444-555555555555";return identify;
  }
  int duplicate_private_parent()const{return duplicate?::fcntl(parent,F_DUPFD_CLOEXEC,3):-1;}
  bool current(const cgs1_wifi_guard::Plan&)const{return allowed;}
};
struct Fixture {
  std::string path;int parent=-1;
  Fixture(){char name[]="plan-XXXXXX";assert(::mkdtemp(name));path=name;
    assert(!::mkdir((path+"/wifi").c_str(),0700));parent=::open(path.c_str(),O_RDONLY|O_DIRECTORY|O_CLOEXEC);assert(parent>=0);}
  ~Fixture(){::close(parent);assert(std::filesystem::remove_all(path)>=2);}
  void seed(const Networks&networks){Store<>store;Networks before;assert(store.open_existing(parent,OLD));
    assert(store.load(before)==Load::MISSING);assert(store.commit(networks)==Commit::COMMITTED);}
  bool missing()const{struct stat s{};return ::fstatat(parent,"wifi/networks.v1",&s,AT_SYMLINK_NOFOLLOW)<0 && errno==ENOENT;}
  bool unchanged(const Networks&expected)const{Store<>store;Networks actual;
    return store.open_existing(parent,NEXT) && store.load(actual)==Load::LOADED && store.matches_loaded(OLD,expected);}
};
static Network network(const std::string&ssid,unsigned salt=0) {
  Network out;out.ssid_size=uint8_t(ssid.size());assert(ssid.size()<=32);
  std::memcpy(out.ssid.data(),ssid.data(),ssid.size());out.psk.fill(uint8_t(0x40+salt));return out;
}
static void reset(){Source::clock=1000;Source::delay=0;Source::available=Source::unchanged_ok=Source::random_ok=true;
  Source::nonce_calls=0;Source::nonce_value=NEXT;Source::during_final_read={};auto&f=Source::snapshot;f={};
  assert(cgs1_dhcp_lease::parse_probe_boot_id("11111111-2222-3333-4444-555555555555\n",f.boot));
  f.daemon.verified=true;f.daemon.process.pid=7;f.daemon.process.start=8;f.daemon.socket_inode=9;
  f.association.state="COMPLETED";f.association.network_id=0;
  f.association.bssid="02:00:00:00:00:01";
  cgs1_wifi::SavedProfile p;p.id=0;p.ssid_text="original";p.bssid="any";p.current=true;p.flags="[CURRENT]";f.profiles={p};}
using Builder=PlanBuilder<Scope,Source>;
// Force the fixed production instantiation to compile/link without executing
// its root paths, daemon inspection or random generator on the fixture host.
bool production_plan_compile(cgs1_supervisor::NativeWifiPlanBuilder&builder,const Network&network,cgs1_wifi_guard::Plan&plan){return builder.build(network,plan);}
bool production_boot_plan_compile(cgs1_supervisor::NativeUnassociatedWifiPlanBuilder&builder,const Network&network,cgs1_wifi_guard::Plan&plan){return builder.build(network,plan);}
bool production_saved_plan_compile(cgs1_supervisor::NativeWifiPlanBuilder&builder,cgs1_wifi_guard::Plan&plan){return builder.build_saved(plan);}
bool production_unassociated_saved_plan_compile(cgs1_supervisor::NativeUnassociatedWifiPlanBuilder&builder,cgs1_wifi_guard::Plan&plan){return builder.build_saved(plan);}
bool production_auto_saved_plan_compile(cgs1_supervisor::NativeBootWifiPlanBuilder&builder,cgs1_wifi_guard::Plan&plan){return builder.build_saved(plan);}
int main(){assert(::geteuid()==0);
  reset();{Fixture f;Scope scope{f.parent};Builder builder(scope);cgs1_wifi_guard::Plan out;
    check(builder.build(network("new"),out) && cgs1_wifi_guard::valid(out));
    check(!out.decision.before.present && out.decision.desired.size()==1 && out.created_ms==1000 && out.deadline_ms==121000);
    check(f.missing());check(!builder.build(network("other"),out) && builder.error()==PlanError::CONSUMED && Source::nonce_calls==1);}
  reset();{Fixture f;Networks old{network("old"),network("target")};f.seed(old);Scope scope{f.parent};Builder builder(scope);cgs1_wifi_guard::Plan out;
    check(builder.build(network("target",7),out));
    check(out.decision.before.present && out.decision.before.decision_epoch==OLD && out.decision.desired.size()==2);
    check(out.decision.desired[0].psk[0]==0x47 && out.decision.desired[1].psk==old[0].psk && out.decision.before.networks[1].psk==old[1].psk);
    check(out.decision.desired[0].ssid_size==6 && !std::memcmp(out.decision.desired[0].ssid.data(),"target",6));
    check(f.unchanged(old));}
  reset();{Fixture f;Networks old;for(unsigned n=0;n<16;++n)old.push_back(network(std::to_string(n)));f.seed(old);Scope scope{f.parent};
    Builder denied(scope);cgs1_wifi_guard::Plan out;check(!denied.build(network("17"),out) && denied.error()==PlanError::CAPACITY);
    Builder update(scope);check(update.build(network("15",9),out) && out.decision.desired.size()==16 && out.decision.desired[0].psk[0]==0x49);
    // Moving the chosen last entry to the front must not reorder or drop the
    // fifteen other fallbacks, and must leave the actual old Store untouched.
    for(size_t n=0;n<15;++n)check(out.decision.desired[n+1].ssid_size==old[n].ssid_size &&
      !std::memcmp(out.decision.desired[n+1].ssid.data(),old[n].ssid.data(),old[n].ssid_size) &&
      out.decision.desired[n+1].psk==old[n].psk);
    check(f.unchanged(old));}
  reset();{Fixture f;Scope scope{f.parent};Builder builder(scope);cgs1_wifi_guard::Plan out;
    const auto bytes=std::string("\0\n\"\\",4)+"Кухня";
    check(builder.build(network(bytes),out) && out.decision.desired[0].ssid_size==bytes.size() &&
      !std::memcmp(out.decision.desired[0].ssid.data(),bytes.data(),bytes.size()));check(f.missing());}
  for(unsigned fault=0;fault<14;++fault){reset();Fixture f;Scope scope{f.parent};cgs1_wifi_guard::Plan out;out.full_session="sentinel";
    auto request=network("new");
    if(fault==0)request.ssid_size=0;
    if(fault==1)request.ssid_size=33;
    if(fault==2)scope.identify=false;
    if(fault==3)Source::clock=0;
    if(fault==4)Source::clock=UINT64_MAX-100;
    if(fault==5)Source::available=false;
    if(fault==6)Source::snapshot.boot="foreign";
    if(fault==7)Source::random_ok=false;
    if(fault==8)Source::nonce_value="0000000000000000";
    if(fault==9)scope.duplicate=false;
    if(fault==10)scope.allowed=false;
    if(fault==11)Source::unchanged_ok=false;
    if(fault==12)Source::delay=120000;
    if(fault==13)Source::snapshot.profiles[0].temporarily_disabled=true;
    Builder builder(scope);check(!builder.build(request,out));check(out.full_session=="sentinel" && f.missing());
    const auto attempts=Source::nonce_calls;Source::clock=1000;Source::available=true;scope.allowed=true;
    check(!builder.build(network("valid"),out) && Source::nonce_calls==attempts);
  }
  reset();{Fixture f;Networks old{network("old")};f.seed(old);Source::nonce_value=OLD;Scope scope{f.parent};Builder builder(scope);cgs1_wifi_guard::Plan out;
    check(!builder.build(network("new"),out) && builder.error()==PlanError::NONCE);check(f.unchanged(old));}
  reset();{Fixture f;check(!::chmod((f.path+"/wifi").c_str(),0755));Scope scope{f.parent};Builder builder(scope);cgs1_wifi_guard::Plan out;
    check(!builder.build(network("new"),out) && builder.error()==PlanError::STORE && f.missing());}
  reset();{Fixture f;Store<>busy;Networks before;check(busy.open_existing(f.parent,OLD) && busy.load(before)==Load::MISSING);
    Scope scope{f.parent};Builder builder(scope);cgs1_wifi_guard::Plan out;check(!builder.build(network("new"),out) && builder.error()==PlanError::STORE && f.missing());}
  using BootBuilder=PlanBuilder<Scope,Source,cgs1_wifi_prepare::CatalogMode::UNASSOCIATED>;
  for(unsigned shape=0;shape<3;++shape){reset();Fixture f;Scope scope{f.parent};
    auto&s=Source::snapshot;s.association={};s.association.state="SCANNING";
    if(shape==0)s.profiles.clear();
    if(shape==1){s.profiles[0].current=false;s.profiles[0].flags.clear();}
    Builder ordinary(scope);cgs1_wifi_guard::Plan out;
    check(!ordinary.build(network("saved"),out) && ordinary.error()==PlanError::SNAPSHOT);
    BootBuilder boot(scope);check(boot.build(network("saved"),out));
    check(out.catalog_mode==cgs1_wifi_prepare::CatalogMode::UNASSOCIATED && out.original.size()==s.profiles.size());
    check(f.missing()); // Planning did not publish/commit or select a network.
  }
  reset();{Fixture f;Scope scope{f.parent};BootBuilder boot(scope);cgs1_wifi_guard::Plan out;
    check(!boot.build(network("saved"),out) && boot.error()==PlanError::SNAPSHOT && f.missing());}
  // Boot must select from an actual accepted record, preserving every byte
  // and its order under the same loaded epoch. Test connected and all three
  // unassociated shapes with binary SSID/key data and maximum capacity.
  for(unsigned shape=0;shape<4;++shape){reset();Fixture f;Networks old;
    old.push_back(network(std::string("\0\n\"\\",4),9));
    for(unsigned n=1;n<16;++n)old.push_back(network(std::to_string(n),n));
    f.seed(old);Scope scope{f.parent};cgs1_wifi_guard::Plan out;
    if(shape){auto&s=Source::snapshot;s.association={};s.association.state="DISCONNECTED";
      if(shape==1)s.profiles.clear();
      if(shape==2){s.profiles[0].current=false;s.profiles[0].flags.clear();}}
    const auto build=[&](){if(shape){BootBuilder b(scope);return b.build_saved(out);}Builder b(scope);return b.build_saved(out);};
    check(build() && cgs1_wifi_guard::valid(out));
    check(out.decision.before.present && out.decision.before.decision_epoch==OLD && out.decision.transaction==NEXT);
    for(size_t n=0;n<old.size();++n)check(out.decision.desired[n].ssid_size==old[n].ssid_size &&
      out.decision.desired[n].ssid==old[n].ssid && out.decision.desired[n].psk==old[n].psk);
    check(f.unchanged(old));
  }
  for(unsigned fault=0;fault<7;++fault){reset();Fixture f;Scope scope{f.parent};
    Networks old{network("saved")};if(fault)f.seed(fault==1?Networks{}:old);
    if(fault==2)Source::nonce_value=OLD;
    if(fault==3)scope.allowed=false;
    if(fault==4)Source::unchanged_ok=false;
    if(fault==5)assert(!::chmod((f.path+"/wifi/networks.v1").c_str(),0644));
    if(fault==6)Source::during_final_read=[&](){assert(!::unlinkat(f.parent,"wifi/networks.v1",0));};
    Builder b(scope);cgs1_wifi_guard::Plan out;out.full_session="sentinel";
    check(!b.build_saved(out) && out.full_session=="sentinel");
    check(b.error()==(fault<2?PlanError::SAVED_RECORD:fault==2?PlanError::NONCE:
      fault==5?PlanError::STORE:PlanError::CHANGED));
    check(!b.build_saved(out) && b.error()==PlanError::CONSUMED);
  }
  // The interactive source classifies one stable capture; it may introduce
  // a new locally entered key without changing the saved-replay capability.
  using Interactive=PlanBuilder<Scope,Source,cgs1_wifi_prepare::CatalogMode::CONNECTED,false,true>;
  for(unsigned shape=0;shape<4;++shape){reset();Fixture f;Networks old{network("old"),network("fallback",7)};
    f.seed(old);Scope scope{f.parent};auto&capture=Source::snapshot;
    if(shape){capture.association={};capture.association.state="DISCONNECTED";
      if(shape==1)capture.profiles.clear();
      if(shape==2){capture.profiles[0].current=false;capture.profiles[0].flags.clear();}}
    Interactive b(scope);cgs1_wifi_guard::Plan out;check(b.build(network("new",8),out));
    check(out.catalog_mode==(shape?cgs1_wifi_prepare::CatalogMode::UNASSOCIATED_MANUAL:cgs1_wifi_prepare::CatalogMode::CONNECTED));
    check(cgs1_wifi_decision::manual_update(out.decision) && f.unchanged(old));
    auto dropped=out.decision;dropped.desired.pop_back();check(!cgs1_wifi_decision::manual_update(dropped));
    auto rekeyed=out.decision;rekeyed.desired.back().psk[0]^=1;check(!cgs1_wifi_decision::manual_update(rekeyed));
    auto reordered=out.decision;std::swap(reordered.desired[1],reordered.desired[2]);check(!cgs1_wifi_decision::manual_update(reordered));}
  reset();{Fixture f;Scope scope{f.parent};Interactive b(scope);cgs1_wifi_guard::Plan out;
    check(!b.build_saved(out) && b.error()==PlanError::REQUEST && Source::nonce_calls==0);check(f.missing());}
  reset();{Fixture f;Scope scope{f.parent};Interactive b(scope);cgs1_wifi_guard::Plan out;
    Source::snapshot.association.state="AUTHENTICATING";
    check(!b.build(network("new"),out) && b.error()==PlanError::SNAPSHOT && Source::nonce_calls==0);check(f.missing());}
  using AutoBuilder=PlanBuilder<Scope,Source,cgs1_wifi_prepare::CatalogMode::CONNECTED,true>;
  for(unsigned shape=0;shape<4;++shape){reset();Fixture f;Networks old{network("original"),network("fallback",7)};
    f.seed(old);Scope scope{f.parent};auto&s=Source::snapshot;
    if(shape){s.association={};s.association.state="SCANNING";
      if(shape==1)s.profiles.clear();
      if(shape==2){s.profiles[0].current=false;s.profiles[0].flags.clear();}}
    AutoBuilder b(scope);cgs1_wifi_guard::Plan out;check(b.build_saved(out));
    check(out.catalog_mode==(shape?cgs1_wifi_prepare::CatalogMode::UNASSOCIATED:cgs1_wifi_prepare::CatalogMode::CONNECTED));
    check(b.saved_preferred_connected()==(shape==0));check(f.unchanged(old));
  }
  for(const auto&text:{std::string("\\x00\\n\\\"\\\\"),std::string("other"),std::string("\\q")}){
    reset();Fixture f;Networks old{network(std::string("\0\n\"\\",4))};f.seed(old);
    Source::snapshot.profiles[0].ssid_text=text;Scope scope{f.parent};AutoBuilder b(scope);cgs1_wifi_guard::Plan out;
    check(b.build_saved(out));check(b.saved_preferred_connected()==(text!="other" && text!="\\q"));check(f.unchanged(old));
  }
  reset();{Fixture f;Scope scope{f.parent};AutoBuilder b(scope);cgs1_wifi_guard::Plan out;
    check(!b.build(network("caller"),out) && b.error()==PlanError::REQUEST && Source::nonce_calls==0);check(f.missing());}
  reset();{Fixture f;Networks old{network("original")};f.seed(old);Scope scope{f.parent};AutoBuilder b(scope);cgs1_wifi_guard::Plan out;
    Source::snapshot.association.state="AUTHENTICATING";
    check(!b.build_saved(out) && b.error()==PlanError::SNAPSHOT && Source::nonce_calls==0);check(f.unchanged(old));}
  std::cout<<"{\"checks\":"<<checks<<",\"hardware_contacted\":false,\"network_writes\":false}\n";
}
