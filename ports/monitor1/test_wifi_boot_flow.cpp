// Pure boot sequencing faults. Synthetic actors cannot contact a radio or
// satisfy the production scope/lease/Store proofs tested in other suites.
#include "wifi_boot_flow.h"
#include "native_wifi_transaction.h"
#include <cassert>
#include <iostream>
using F=cgs1_wifi_forward::FlowStage;
using P=cgs1_wifi_request::PlanError;
using B=cgs1_wifi_boot::Stage;
static unsigned checks=0;
static void check(bool value){assert(value);++checks;}
struct Clock {inline static uint64_t time=1000;uint64_t now()const{return time;}};
struct Behavior {
  bool begin=true,skip=false,deferred=false,confirmation=true,cancellation=true,recovery=false;
  P error=P::NONE;F stage=F::PREPARING;
  unsigned creates=0,begins=0,polls=0,confirms=0,cancels=0;
};
struct Transaction {
  Behavior&b;
  bool begin_saved(){++b.begins;return b.begin;}
  bool saved_skipped()const{return b.skip;}
  bool saved_deferred()const{return b.deferred;}
  P plan_error()const{return b.error;}
  void poll(){++b.polls;}
  F stage()const{return b.stage;}
  bool recovery_required()const{return b.recovery;}
  bool confirm(){++b.confirms;return b.confirmation;}
  bool cancel(){++b.cancels;return b.cancellation;}
};
struct Factory {
  using Transaction=::Transaction;
  Behavior&b;bool available=true;
  std::unique_ptr<Transaction>make(){++b.creates;return available?std::make_unique<Transaction>(Transaction{b}):nullptr;}
};
using Controller=cgs1_wifi_boot::Controller<Factory,Clock>;
// Compile the real boot transaction join and public methods without invoking
// its fixed root files/process/socket inspection in a pure sequence fixture.
bool production_boot_transaction_compile(cgs1_supervisor::NativeWifiTransaction&tx){return tx.begin_saved() && tx.saved_skipped();}
int main(){
  {Clock::time=1000;Behavior b;b.deferred=true;Factory f{b};Controller c(f);c.poll();
    check(c.stage()==B::DEFERRED && c.finished() && !c.return_required());
    check(b.polls==0 && b.confirms==0 && b.begins==1);c.poll();check(b.creates==1);}

  {Clock::time=1000;Behavior b;Factory f{b};Controller c(f);check(!c.finished());c.poll();
    check(c.stage()==B::APPLYING && b.creates==1 && b.begins==1 && b.polls==1);
    for(auto stage:{F::PREPARING,F::SELECTING,F::ASSOCIATING,F::DHCP,F::VERIFYING}){
      b.stage=stage;Clock::time+=100;c.poll();check(!c.finished() && !c.return_required() && b.confirms==0);}
    b.stage=F::READY;c.poll();check(b.confirms==1 && c.stage()==B::APPLYING);
    c.poll();check(b.confirms==1 && !c.cancel());
    for(auto stage:{F::RESTORING,F::COMMITTING,F::RECONCILING,F::RETIRING}){
      b.stage=stage;c.poll();check(!c.finished() && b.confirms==1);}
    b.stage=F::SAVED;c.poll();check(c.stage()==B::SAVED && c.finished());
    const auto polls=b.polls;for(unsigned n=0;n<20;++n)c.poll();check(b.polls==polls && b.begins==1 && b.creates==1);}
  for(auto error:{P::SAVED_RECORD,P::STORE,P::NONCE,P::SCOPE,P::CHANGED}){
    Clock::time=1000;Behavior b;b.begin=false;b.error=error;Factory f{b};Controller c(f);c.poll();
    check(c.stage()==(error==P::SAVED_RECORD?B::NO_RECORD:B::UNAVAILABLE) && c.finished());
    for(unsigned n=0;n<20;++n){Clock::time+=1000;c.poll();}check(b.creates==1 && b.polls==0 && b.confirms==0);}
  {Clock::time=1000;Behavior b;b.skip=true;Factory f{b};Controller c(f);c.poll();
    check(c.stage()==B::ALREADY_CONNECTED && b.polls==0 && b.confirms==0);c.poll();check(b.creates==1);}
  {Clock::time=1000;Behavior b;b.begin=false;b.error=P::SNAPSHOT;Factory f{b};Controller c(f);
    for(unsigned n=0;n<200;++n){c.poll();Clock::time+=100;}
    check(c.stage()==B::WAITING && b.creates==20 && b.polls==0);c.poll();
    check(c.stage()==B::UNAVAILABLE && c.observations()==20 && b.creates==20);}
  {Clock::time=1000;Behavior b;b.begin=false;b.error=P::SNAPSHOT;Factory f{b};Controller c(f);c.poll();
    b.begin=true;b.error=P::NONE;Clock::time=2000;c.poll();check(c.stage()==B::APPLYING && b.creates==2 && b.polls==1);
    b.recovery=true;c.poll();check(c.return_required());Clock::time+=1000;c.poll();check(b.creates==2);}
  for(unsigned fault=0;fault<4;++fault){Clock::time=1000;Behavior b;Factory f{b};Controller c(f);c.poll();
    if(fault==0){b.stage=F::READY;b.confirmation=false;}
    if(fault==1)b.stage=F::RECOVERY_REQUIRED;
    if(fault==2)b.stage=F::IDLE;
    if(fault==3)Clock::time=999;
    c.poll();check(c.return_required() && !c.finished());const auto polls=b.polls;
    for(unsigned n=0;n<20;++n)c.poll();
    check(b.polls==polls && b.creates==1 && b.confirms<2);}
  {Clock::time=1000;Behavior b;Factory f{b};Controller c(f);check(c.cancel() && c.finished());c.poll();check(b.creates==0);}
  {Clock::time=1000;Behavior b;Factory f{b};Controller c(f);c.poll();check(c.cancel() && c.return_required() && b.cancels==1);check(!c.cancel());}
  for(unsigned fault=0;fault<3;++fault){Clock::time=fault==0?0:fault==1?UINT64_MAX-1:1000;Behavior b;Factory f{b};f.available=fault!=2;Controller c(f);c.poll();
    check(c.stage()==B::UNAVAILABLE && b.begins==0 && b.polls==0);}
  std::cout<<"{\"checks\":"<<checks<<",\"hardware_contacted\":false,\"policy_only\":true}\n";
}
