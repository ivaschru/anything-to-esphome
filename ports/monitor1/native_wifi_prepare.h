#pragma once

// Fixed production join: the native runtime cannot select a fixture scope.
// Not yet called by UI; selection/DHCP/commit/boot replay remain independent.
#include "native_wifi_scope.h"
#include "wifi_prepare_authority.h"
namespace cgs1_supervisor {
using NativeWifiPrepareAuthority=cgs1_wifi_prepare::FilePreparationAuthority<NativeWifiScope>;
using NativeWifiPreparation=cgs1_wifi_prepare::Preparation<NativeWifiPrepareAuthority>;
} // namespace cgs1_supervisor
