"""Compile the actual YAML diagnostic lambdas against changing cached values.

Only measurement providers are substituted. No SDK, Qt, device, socket or
private profile is loaded; host results do not qualify a firmware deployment.
"""
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest

PORT = Path(__file__).resolve().parents[1] / "ports/monitor1"


def readiness_lambda(name):
    # This is a deliberately narrow extraction of one literal YAML block,
    # not a second YAML loader or a reimplementation of its boolean policy.
    text = (PORT / name).read_text()
    if text.count("    id: core_sensors_ready\n") != 1:
        raise AssertionError("One stable readiness identity is required")
    block = text.split("    id: core_sensors_ready\n", 1)[1]
    match = re.search(r"^    lambda: \|-\n((?:      [^\n]*\n)+)", block, re.M)
    if match is None:
        raise AssertionError("Expected the production cached-value lambda")
    return match[1]


class RuntimeDiagnosticTests(unittest.TestCase):
    def test_native_status_reuses_physical_readiness_for_first_ui_observation(self):
        text = (PORT / "native-ui-full.yaml").read_text()
        status = text.split("    - action: full_native_status\n", 1)[1].split("    - action:", 1)[0]
        self.assertIn("cgs1_full::report(root, *id(panel));", status)
        self.assertIn('root["core_sensors_ready"] = id(core_sensors_ready).state;', status)
        self.assertNotIn("display_feed", status)

    def test_actual_lambdas_reject_missing_core_values_but_ignore_optional_pm(self):
        compiler = shutil.which("c++")
        self.assertIsNotNone(compiler, "Monitor 1 tests require a C++17 compiler")
        stock = readiness_lambda("stock-bridge.yaml")
        native = readiness_lambda("native-ha-identity.yaml")
        # The fake getters model the existing source expiry by returning NaN.
        # Native CO2 is intentionally a Sensor state, matching BOTH profiles'
        # real SDK timeout output rather than a guessed stock-response age.
        source = r'''
#include <cassert>
#include <cmath>
#include <initializer_list>
#include <limits>
float values[4];
struct Sensor { float state=NAN; } ui_co2, ui_pm25;
#define id(name) name
namespace cgs1 {
struct Stock {
  float co2() const { return values[0]; }
  float temperature() const { return values[1]; }
  float humidity() const { return values[2]; }
  float tvoc_ppm() const { return values[3]; }
  float pm25() const { return ui_pm25.state; }
} stock;
}
namespace cgs1_thermal {
struct Thermal {
  float temperature() const { return values[1]; }
  float humidity() const { return values[2]; }
} runtime;
}
namespace cgs1_direct_trial {
struct VOC { float estimate() const { return values[3]; } } voc;
}
bool stock_ready() { STOCK_LAMBDA }
bool native_ready() { NATIVE_LAMBDA }
void set_co2() { ui_co2.state=values[0]; }
int main() {
  const float good[]={420,0,0,0};  // Zero T/RH/TVOC are valid, not bool false.
  for (int n=0;n<4;++n) values[n]=good[n];
  set_co2();
  // PM OFF has no measurement; an enabled but warming/failed PM can also be
  // unavailable. Neither case turns fresh core sources into a device fault.
  for(float pm : {NAN, 0.0f, 12.0f}) {
    ui_pm25.state=pm;
    assert(stock_ready() && native_ready());
  }
  for (int missing=0;missing<4;++missing) {
    for(float bad : {NAN, std::numeric_limits<float>::infinity(),
                          -std::numeric_limits<float>::infinity()}) {
      values[missing]=bad;set_co2();
      assert(!stock_ready() && !native_ready());
    }
    values[missing]=good[missing];set_co2();
    assert(stock_ready() && native_ready());
  }
}
'''.replace("STOCK_LAMBDA", stock).replace("NATIVE_LAMBDA", native)
        with tempfile.TemporaryDirectory(prefix="cgs1-diagnostic-fixture-") as temp:
            root = Path(temp); cpp = root / "test.cpp"; binary = root / "test"
            cpp.write_text(source)
            result = subprocess.run([compiler, "-std=c++17", "-Wall", "-Wextra", "-Werror",
                                     str(cpp), "-o", str(binary)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            result = subprocess.run([str(binary)], capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_mode_and_historical_age_keep_their_distinct_contracts(self):
        for name, mode in (("stock-bridge.yaml", "stock_bridge"),
                           ("native-ha-identity.yaml", "full")):
            with self.subTest(name=name):
                text = (PORT / name).read_text()
                self.assertEqual(text.count("    name: Runtime mode\n"), 1)
                self.assertEqual(text.count("    id: runtime_mode\n"), 1)
                self.assertIn('lambda: return {"' + mode + '"};', text)
                self.assertEqual(text.count("    name: Stock response age\n"), 1)
        native = (PORT / "native-ha-identity.yaml").read_text()
        self.assertIn("lambda: return NAN;", native)
        # The kernel-backed hardware override must keep the same output ID:
        # removing the nested S8 driver cannot strand the readiness export.
        scd40 = (PORT / "profiles/co2-scd40.yaml").read_text()
        self.assertIn("    id: ui_co2\n", scd40)
        self.assertIn("      - timeout: 15s\n", scd40)
