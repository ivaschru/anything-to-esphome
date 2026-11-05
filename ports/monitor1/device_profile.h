#pragma once

// A firmware image belongs to one physical monitor. A build may override these
// public constants with a reviewed, force-included profile header; neither an
// API request nor an environment variable can broaden the hardware admission.
// Public builds require an explicit physical-device profile.
#ifndef CGS1_EXPECTED_WLAN_MAC
#error "Define CGS1_EXPECTED_WLAN_MAC in a private force-included profile"
#endif
#ifndef CGS1_ESPHOME_NODE_NAME
#error "Define CGS1_ESPHOME_NODE_NAME in a private force-included profile"
#endif
#ifndef CGS1_EXPECTED_PM_HELPER_SHA
#error "Define CGS1_EXPECTED_PM_HELPER_SHA in a private force-included profile"
#endif

namespace cgs1_device_profile {
inline constexpr char WLAN_MAC[] = CGS1_EXPECTED_WLAN_MAC;
inline constexpr char WLAN_MAC_LINE[] = CGS1_EXPECTED_WLAN_MAC "\n";
inline constexpr char NODE_NAME[] = CGS1_ESPHOME_NODE_NAME;
inline constexpr char SDK_PREFS_FILE[] = CGS1_ESPHOME_NODE_NAME ".prefs";
inline constexpr char PM_HELPER_SHA[] = CGS1_EXPECTED_PM_HELPER_SHA;

constexpr bool valid_mac(const char *value, unsigned length) {
  if (length != 17) return false;
  for (unsigned i = 0; i < length; ++i) {
    if (i % 3 == 2) {
      if (value[i] != ':') return false;
    } else if (!((value[i] >= '0' && value[i] <= '9') ||
                 (value[i] >= 'a' && value[i] <= 'f'))) return false;
  }
  return true;
}
constexpr bool valid_node(const char *value, unsigned length) {
  if (!length || length > 63 || value[0] == '-' || value[length - 1] == '-') return false;
  for (unsigned i = 0; i < length; ++i)
    if (!((value[i] >= 'a' && value[i] <= 'z') ||
          (value[i] >= '0' && value[i] <= '9') || value[i] == '-')) return false;
  return true;
}
static_assert(valid_mac(WLAN_MAC, sizeof(WLAN_MAC) - 1), "Expected one lowercase physical WLAN MAC");
static_assert(valid_node(NODE_NAME, sizeof(NODE_NAME) - 1), "Expected one safe ESPHome node name");
static_assert(sizeof(PM_HELPER_SHA) == 65, "Expected one pinned PM helper SHA-256");
}  // namespace cgs1_device_profile
