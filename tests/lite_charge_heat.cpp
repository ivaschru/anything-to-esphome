#include "ports/lite/components/cgdn1_tcomp/tcomp.h"

#include <cassert>
#include <cmath>
#include <limits>

int main() {
  tcomp::Inputs in;
  in.usb = true;
  in.t_raw = 30.0f;
  in.rh_raw = 40.0f;
  in.vbat_mv = 4200.0f;
  in.ichg_ma = 0.0f;
  in.measured = true;
  const tcomp::Saved warm_board{tcomp::SAVED_MAGIC, 8000, 0, 3000, 0};

  tcomp::Engine measured;
  assert(measured.tick(in, warm_board));
  const float idle_temperature = measured.out().t;
  const float idle_humidity = measured.out().rh;
  assert(measured.charge_heat() == 0.0f);

  // A top-up at 4.2 V must take effect even though the stock gate calls it done.
  // The same current at low voltage must not subtract the stock curve as well.
  in.ichg_ma = 460.0f;
  auto lower_voltage = in;
  lower_voltage.vbat_mv = 3850.0f;
  tcomp::Engine low;
  for (int second = 0; second < 1800; ++second) {
    assert(measured.tick(in, warm_board));
    assert(low.tick(lower_voltage, warm_board));
  }
  assert(measured.cstate() == 2 && low.cstate() == 1);
  const float warm_charge = measured.charge_heat();
  assert(warm_charge > 3.8f && warm_charge < 3.9f);
  assert(std::abs(measured.out().t - low.out().t) < 0.01f);
  assert(std::abs(idle_temperature - measured.out().t - warm_charge) < 0.01f);
  assert(measured.out().rh > idle_humidity);

  // A warm reboot should keep the correction. A colder boot removes the heat
  // that the raw sensor has already shed. Missing records are a safe cold start.
  tcomp::Engine restarted;
  assert(restarted.tick(in, measured.snapshot(), nullptr, measured.charge_snapshot()));
  assert(std::abs(restarted.charge_heat() - warm_charge) < 0.02f);
  assert(tcomp::heat::restore_charge(390, 3300, 2800) == 0.0f);
  assert(tcomp::heat::restore_charge(32000, 3300, 3300) == tcomp::heat::CHARGE_MAX_HEAT_C);
  assert(tcomp::heat::restore_charge(0, 3300, 3300) == 0.0f);

  // The legacy Stock mode keeps its own result while the new model tracks heat
  // in the background. Loss of sampling or USB removes the drive, not the tail.
  tcomp::Engine stock, stock_without_charge_history;
  in.measured = false;
  assert(stock.tick(in, measured.snapshot(), nullptr, measured.charge_snapshot()));
  assert(stock_without_charge_history.tick(in, measured.snapshot()));
  assert(stock.out().t == stock_without_charge_history.out().t);
  assert(stock.out().rh == stock_without_charge_history.out().rh);
  assert(stock.charge_heat() > 3.8f);
  in.measured = true;
  in.ichg_fresh = false;
  assert(measured.tick(in, warm_board));
  assert(measured.charge_heat() < warm_charge && measured.charge_heat() > 3.7f);
  in.ichg_fresh = true;
  in.usb = false;
  for (int second = 0; second < 810; ++second)
    assert(measured.tick(in, warm_board));
  assert(measured.charge_heat() > 1.3f && measured.charge_heat() < 1.5f);
  const auto invalid = std::numeric_limits<float>::quiet_NaN();
  assert(tcomp::heat::step_charge(0.0f, true, invalid) == 0.0f);
  assert(tcomp::heat::step_charge(0.0f, true, 19.0f) == 0.0f);
  assert(tcomp::heat::step_charge(0.0f, true, 2000.0f) ==
         tcomp::heat::step_charge(0.0f, true, tcomp::heat::CHARGE_MAX_MA));
}
