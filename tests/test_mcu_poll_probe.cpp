#include "../ports/lite-mcu4x/components/cgdn1_mcu/poll_probe.h"
#include "../ports/lite-mcu4x/components/cgdn1_mcu/protocol.h"
#include <cassert>
#include <iostream>
#include <string_view>

using namespace qingping::mcu4x;

int main() {
  // Independently checked fixed frame: 43+47+31=BB, payload length/count zero.
  const std::string_view wire(EMPTY_POLL);
  assert(wire == "hex_string 4347310000bb00\r");
  Frame frame;
  assert(decode_hex(wire.substr(11,14),frame)==Error::NONE);
  assert(frame.command==0x31 && frame.count==0 && frame.length==7);
  assert(std::string_view(REPORT_ACK)=="ok\r");
  PollProbe probe;
  assert(!probe.poll_due(5000));
  probe.start(0xffffff00U);
  assert(!probe.poll_due(0xffffff00U+4999U));
  assert(probe.poll_due(0xffffff00U+5000U));
  assert(!probe.poll_due(0xffffff00U+5000U));
  assert(probe.poll_due(0xffffff00U+10000U));
  assert(probe.poll_due(0xffffff00U+15000U));
  assert(!probe.poll_due(0xffffff00U+20000U));
  probe.start(123);  // Cannot replenish a consumed one-boot budget.
  assert(!probe.poll_due(20000));
  assert(!probe.acknowledge_report(0xffffff00U+16000U,0x31));
  for(int i=0;i<8;++i) assert(probe.acknowledge_report(0xffffff00U+16000U,0x32));
  assert(!probe.acknowledge_report(0xffffff00U+16000U,0x32));
  assert(probe.polls()==3 && probe.acks()==8);
  PollProbe received;
  received.start(0);
  assert(received.acknowledge_report(1000,0x32));
  assert(!received.poll_due(5000));
  assert(!received.acknowledge_report(30000,0x32));
  PollProbe idle;
  idle.start(0);
  assert(!idle.poll_due(30000));
  assert(!idle.acknowledge_report(30000,0x32));
  // A long main-loop gap never permits a catch-up burst or extends the window.
  PollProbe delayed;
  delayed.start(0);
  assert(delayed.poll_due(20000));
  assert(!delayed.poll_due(20001));
  assert(delayed.poll_due(25000));
  assert(!delayed.poll_due(30000));
  PollSeries series;
  assert(!series.poll_due(5000));
  series.start(0xffffff00U);
  assert(!series.poll_due(0xffffff00U + 4999U));
  for (uint32_t elapsed : {5000U, 20000U, 35000U, 50000U, 65000U, 80000U}) {
    assert(series.poll_due(0xffffff00U + elapsed));
    assert(!series.poll_due(0xffffff00U + elapsed + 1U));
  }
  series.start(0);
  assert(series.polls() == 6 && !series.poll_due(100000));
  PollSeries late;
  late.start(0);
  assert(late.poll_due(70000));
  assert(!late.poll_due(70001));
  assert(late.poll_due(85000));
  assert(!late.poll_due(90000));
  PollLong long_probe;
  long_probe.start(0);
  for (uint32_t t = 5000; t <= 230000; t += 15000) {
    assert(long_probe.poll_due(t));
    assert(!long_probe.poll_due(t + 1));
  }
  long_probe.start(240000);
  assert(long_probe.polls() == 16 && !long_probe.poll_due(245000));
  std::cout << "Fixed empty CG poll, no setter TLVs, one-boot bounds and echo rejection passed\n";
}
