#pragma once
// Fixed native pre-commit evidence join. Not yet called from touchscreen or
// SELECT_NETWORK; no diagnostic lease flag or runtime fixture can substitute.
#include "native_wifi_prepare.h"
#include "wifi_forward_connectivity.h"
#include "wifi_forward_select.h"
#include "wifi_forward_refresh.h"
#include "wifi_forward_restore.h"
#include "native_wifi_retirement.h"
#include "wifi_forward_flow.h"
namespace cgs1_supervisor {
using NativeWifiConnectivity=cgs1_wifi_forward::Connectivity<NativeWifiPrepareAuthority,NativeWifiPreparation>;
using NativeWifiSelection=cgs1_wifi_forward::Selection<NativeWifiPrepareAuthority,NativeWifiPreparation>;
using NativeWifiRefresh=cgs1_wifi_forward::Refresh<NativeWifiPrepareAuthority,NativeWifiSelection,NativeWifiConnectivity>;
using NativeWifiRestoration=cgs1_wifi_forward::Restoration<NativeWifiPrepareAuthority,NativeWifiPreparation,NativeWifiConnectivity>;
using NativeWifiAssociation=cgs1_wifi_forward::Association<NativeWifiPrepareAuthority,NativeWifiPreparation>;
using NativeWifiFlow=cgs1_wifi_forward::Flow<NativeWifiPrepareAuthority,NativeWifiPreparation,
  NativeWifiSelection,NativeWifiConnectivity,NativeWifiRefresh,NativeWifiRestoration,
  NativeWifiRetirement,NativeWifiAssociation>;
} // namespace cgs1_supervisor
