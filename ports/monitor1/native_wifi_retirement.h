#pragma once

// Production cannot select a fixture authority or alternate IO at runtime.
// The forward/UI binder will own this alongside its admitted native bootstrap.
// Do not expose an API route that supplies paths, profiles or success flags.
#include "native_wifi_scope.h"
#include "wifi_guard_retirement_files.h"
namespace cgs1_supervisor {
using NativeWifiRetirement=cgs1_wifi_retirement::FileRetirement<NativeWifiScope>;
} // namespace cgs1_supervisor
