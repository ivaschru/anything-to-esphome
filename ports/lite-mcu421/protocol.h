#pragma once

// Retain the original research API while the transport and ESPHome adapter
// share one framing implementation. The alias does not qualify another board
// or permit installation; hardware admission stays outside this parser.
#include "../lite-mcu4x/components/cgdn1_mcu/protocol.h"

namespace qingping {
namespace mcu421 = mcu4x;
}  // namespace qingping
