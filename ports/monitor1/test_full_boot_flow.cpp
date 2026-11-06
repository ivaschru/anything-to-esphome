// Pure lifecycle tests: counters prove that failures/repeated polls cannot
// retry durable consumption or enqueue a second automatic hardware takeover.
#include "full_boot_flow.h"
#include <cassert>
#include <iostream>
using namespace cgs1_supervisor;
struct Backend {
  bool is_ready=true,consumed=true,queued=true;
  FullBootStage progress=FullBootStage::MORE;
  FullBootQueue queue_progress=FullBootQueue::QUEUED;
  unsigned reads=0,claims=0,stages=0,launches=0;
  bool ready(){++reads;return is_ready;}
  bool consume(){++claims;return consumed;}
  FullBootStage stage(){++stages;return progress;}
  FullBootQueue prepare_and_launch(){++launches;return queued?queue_progress:FullBootQueue::FAILED;}
};
static unsigned checks=0;
static void check(bool v){assert(v);++checks;}
int main(){
  {Backend b;b.progress=FullBootStage::READY;FullBootFlow<Backend> f(b,60000);f.start(true,100);
    // A ready-looking stock process at 15s must not consume the boot before
    // the known late vendor child at 46s has had its startup window.
    for(auto t:{15100,46100,60099}){f.poll(t);check(!b.reads&&!b.claims&&!b.launches);}
    f.poll(60100);check(f.state()==FullBootState::QUEUED&&b.reads==1&&b.claims==1&&b.launches==1);
    f.poll(70000);check(b.claims==1&&b.launches==1);}
  {Backend b;FullBootFlow<Backend> f(b);f.start(false,100);f.start(true,100);f.poll(16000);
    check(f.state()==FullBootState::DISABLED && !b.reads && !b.claims && !b.launches);}
  {Backend b;FullBootFlow<Backend> f(b);f.start(true,100);f.poll(15099);check(!b.reads);
    b.is_ready=false;f.poll(15100);check(b.reads==1 && !b.claims);f.poll(16099);check(b.reads==1);
    b.is_ready=true;f.poll(16100);check(b.reads==2 && b.claims==1 && b.stages==1 && !b.launches);
    f.poll(16101);check(b.claims==1 && b.stages==2);b.progress=FullBootStage::READY;f.poll(16102);
    check(f.state()==FullBootState::QUEUED && b.launches==1);
    for(unsigned n=0;n<1000;++n)f.poll(17000+n);
    check(b.claims==1 && b.launches==1 && b.stages==3);}
  {Backend b;b.consumed=false;FullBootFlow<Backend> f(b);f.start(true,1);f.poll(15001);f.poll(16001);
    check(f.state()==FullBootState::REFUSED && b.claims==1 && !b.stages && !b.launches);}
  {Backend b;b.progress=FullBootStage::FAILED;FullBootFlow<Backend> f(b);f.start(true,1);f.poll(15001);f.poll(16001);
    check(f.state()==FullBootState::REFUSED && b.claims==1 && b.stages==1 && !b.launches);}
  {Backend b;b.progress=FullBootStage::READY;b.queued=false;FullBootFlow<Backend> f(b);f.start(true,1);f.poll(15001);f.poll(16001);
    check(f.state()==FullBootState::REFUSED && b.claims==1 && b.launches==1);}
  {Backend b;b.is_ready=false;FullBootFlow<Backend> f(b);f.start(true,1);f.poll(180002);f.poll(181002);
    check(f.state()==FullBootState::REFUSED && !b.reads && !b.claims && !b.launches);}
  {Backend b;FullBootFlow<Backend> f(b);f.start(true,100);f.poll(99);f.poll(16000);
    check(f.state()==FullBootState::REFUSED && !b.claims);}
  {Backend b;FullBootFlow<Backend> f(b);f.start(true,0);f.poll(16000);check(f.state()==FullBootState::DISABLED);}
  {Backend b;b.progress=FullBootStage::READY;b.queue_progress=FullBootQueue::WAIT_FOR_STOCK;
    FullBootFlow<Backend> f(b);f.start(true,1);f.poll(15001);
    check(f.state()==FullBootState::STAGING && b.claims==1 && b.launches==1);
    f.poll(15002);f.poll(16000);check(b.launches==1);
    f.poll(16001);check(b.launches==2 && b.claims==1);
    b.queue_progress=FullBootQueue::QUEUED;f.poll(17001);
    check(f.state()==FullBootState::QUEUED && b.launches==3 && b.claims==1);
    f.poll(18001);check(b.launches==3);}
  {Backend b;b.progress=FullBootStage::READY;b.queue_progress=FullBootQueue::WAIT_FOR_STOCK;
    FullBootFlow<Backend> f(b);f.start(true,1);f.poll(15001);f.poll(180002);
    check(f.state()==FullBootState::REFUSED && b.launches==1 && b.claims==1);}
  {Backend b;b.progress=FullBootStage::READY;b.queue_progress=FullBootQueue::WAIT_FOR_DISPLAY;
    FullBootFlow<Backend> f(b);f.start(true,1);f.poll(15001);
    check(f.state()==FullBootState::STAGING && b.claims==1 && b.launches==1);
    f.poll(15002);f.poll(16000);check(b.launches==1);
    f.poll(16001);check(b.launches==2 && b.claims==1);
    b.queue_progress=FullBootQueue::QUEUED;f.poll(17001);
    check(f.state()==FullBootState::QUEUED && b.claims==1 && b.launches==3);
    f.poll(18001);check(b.launches==3);}
  {Backend b;b.progress=FullBootStage::READY;b.queue_progress=FullBootQueue::WAIT_FOR_DISPLAY;
    FullBootFlow<Backend> f(b);f.start(true,1);f.poll(15001);f.poll(180002);
    check(f.state()==FullBootState::REFUSED && b.claims==1 && b.launches==1);}
  std::cout<<"{\"checks\":"<<checks<<",\"hardware_contacted\":false}\n";
}
