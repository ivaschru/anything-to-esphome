// Compile the actual production component against a small deterministic HAL.
// The fake records every rail write and reader call: it checks the interaction
// of restored settings, warmup cancellation and sensor failure, without a board.
#ifndef PM_HEADER
#define PM_HEADER "../ports/lite/components/cgdn1_pm/cgdn1_pm.h"
#endif
#include PM_HEADER
#include <cassert>
#include <iostream>

using namespace esphome;

struct Rig {
  GPIOPin pin;
  pmsa003i::PMSA003IComponent reader;
  sensor::Sensor a, b, c;
  cgdn1_pm::Cgdn1Pm pm;
  Rig() {
    pm.set_enable_pin(&pin);
    pm.set_reader(&reader);
    pm.set_sensors(&a, &b, &c);
    pm.set_warmup_time(30000);
  }
  void rail_preserved() {
    assert(pin.configured && pin.high_before_setup && !pin.writes.empty());
    for (bool level : pin.writes) assert(level);
  }
  void unavailable() {
    assert(std::isnan(a.state) && std::isnan(b.state) && std::isnan(c.state));
    assert(!pm.ready());
  }
};

int main() {
  // Restore OFF before setup, while another sensor may still be starting.
  {
    Rig r;
    r.pm.set_enabled(false);
    assert(r.pin.writes.empty());
    r.pm.setup();
    r.rail_preserved();
    r.unavailable();
    assert(!r.reader.polling && r.reader.updates == 0);
    r.pm.advance(60000);
    assert(r.reader.updates == 0);
  }
  // A stale warmup must not resume polling after OFF. A later ON gets its
  // own complete warmup, and an identical setting must not reschedule it.
  {
    Rig r;
    r.pm.setup();
    r.pm.advance(10000);
    assert(r.pm.warmup_remaining_ms() == 20000);
    r.pm.set_enabled(false);
    r.pm.advance(30000);
    r.unavailable();
    assert(!r.reader.polling && r.reader.updates == 0);
    r.pm.set_enabled(true);
    r.pm.advance(29999);
    r.pm.set_enabled(true);
    assert(!r.pm.ready() && r.reader.updates == 0);
    r.pm.advance(1);
    assert(r.pm.ready() && r.reader.polling && r.reader.updates == 1);
    r.pm.set_enabled(false);
    assert(!r.reader.polling);
    r.unavailable();
    r.rail_preserved();
  }
  // A failed reader must remain unavailable, not report a ready/zero result.
  {
    Rig r;
    r.reader.failed = true;
    r.pm.setup();
    r.pm.advance(30000);
    r.unavailable();
    assert(r.pm.warning && r.reader.updates == 0 && !r.reader.polling);
    r.rail_preserved();
  }
  std::cout << "restored OFF, cancelled/restarted warmup, failed reader: pass\n";
}
