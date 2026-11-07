// Actual immutable-plan codec, with synthetic identities only. No proc/sysfs,
// process creation, appliance filesystem or device service is touched here.
#include "supervisor_full_plan.h"
#include <cassert>

using namespace cgs1_supervisor;

FullPlan fixture() {
  FullPlan p;
  p.stock.verified=true;
  p.stock.boot_id="11111111-2222-4333-8444-555555555555";
  p.stock.bridge_sha=std::string(64,'a');
  p.effects={p.stock.boot_id,false,cgs1_pm::pinmux::GPIO,20};
  assert(parse_digest(std::string(64,'b'),p.native_digest));
  assert(parse_digest(std::string(64,'c'),p.guardian_digest));
  p.nonce="0123456789abcdef";p.created_ms=1234;
  const char *paths[]{"/data/bin/SnowApp","/bin/busybox","/bin/busybox","/data/.esphome-cgs1/program"};
  for(unsigned i=0;i<4;++i)p.stock.processes[i]={long(20+i),1,100+i,'S',paths[i]};
  p.stock.processes[0].parent=21;
  return p;
}

int main() {
  auto permanent=fixture();FullPlan decoded;
  const auto old=encode_full_plan(permanent);
  // Literal pre-trial wire layout, independent of the current decoder. A
  // round trip alone would miss an encoder+decoder change that broke V1.
  const auto legacy=std::string("CGS1_FULL_PLAN_V1\n0123456789abcdef\n")+
    "11111111-2222-4333-8444-555555555555\n1234\n"+
    std::string(64,'a')+"\n"+std::string(64,'b')+"\n"+std::string(64,'c')+"\n"+
    "0 0 20\n20 21 100\n21 1 101\n22 1 102\n23 1 103\n";
  assert(old==legacy);
  assert(old.rfind("CGS1_FULL_PLAN_V1\n",0)==0);
  assert(decode_full_plan(old,decoded) && decoded.hard_runtime_ms==0);
  assert(encode_full_plan(decoded)==old);

  auto trial=fixture();trial.hard_runtime_ms=INITIAL_UI_TRIAL_MS;
  const auto bounded=encode_full_plan(trial);
  const auto prefix="CGS1_FULL_PLAN_V2\n"+trial.nonce+"\n"+trial.stock.boot_id+"\n1234\n";
  assert(bounded.rfind(prefix+"60000\n",0)==0);
  assert(decode_full_plan(bounded,decoded) && decoded.hard_runtime_ms==60000);
  assert(encode_full_plan(decoded)==bounded);

  // A trial can neither become permanent via a zero limit nor select an
  // arbitrary/larger timeout. Canonical bytes reject alternate spellings.
  for(const auto *limit:{"0","1","59999","60001","90000","060000","+60000","18446744073709551616"}) {
    auto changed=bounded;
    changed.replace(prefix.size(),5,limit);
    assert(!decode_full_plan(changed,decoded));
  }
  auto downgrade=bounded;downgrade.replace(0,17,"CGS1_FULL_PLAN_V1");
  assert(!decode_full_plan(downgrade,decoded));
  for(uint64_t value:{uint64_t(1),uint64_t(59999),uint64_t(60001),UINT64_MAX}) {
    trial.hard_runtime_ms=value;
    assert(!plan_shape(trial) && encode_full_plan(trial).empty());
  }
  // Preserve old permanent behavior and any stricter diagnostic build limit.
  assert(effective_full_runtime_limit(0,0)==0);
  assert(effective_full_runtime_limit(0,90000)==90000);
  assert(effective_full_runtime_limit(60000,0)==60000);
  assert(effective_full_runtime_limit(60000,30000)==30000);
  assert(effective_full_runtime_limit(60000,90000)==60000);
}
