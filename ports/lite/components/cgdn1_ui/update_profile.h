#pragma once

// Read-only, requesting-client-only update metadata for a new Home Assistant.
// api.respond routes by the SDK's server-generated call context. The extra
// AES-GCM envelope keeps Wi-Fi/OTA credentials opaque in HA action traces too;
// it is not an entity, broadcast, HTTP endpoint or secret-rotation operation.
#include "esphome/components/api/api_server.h"
#include "esphome/components/json/json_util.h"
#include "esphome/components/wifi/wifi_component.h"
#include "esphome/core/application.h"
#include <esp_random.h>
#include <mbedtls/gcm.h>
#include <mbedtls/md.h>
#include <mbedtls/platform_util.h>
#include <array>
#include <algorithm>
#include <string>
#include <vector>

namespace esphome::qf_update_profile {
static constexpr char KEY_DOMAIN[] = "qingping-esphome/update-profile/v1";
static constexpr char PROFILE[] = "qingping-device-update-profile-v1";

inline std::string hex(const uint8_t *bytes, size_t length) {
  static constexpr char DIGITS[] = "0123456789abcdef";
  std::string out(length * 2, '0');
  for (size_t i = 0; i < length; ++i) {
    out[2 * i] = DIGITS[bytes[i] >> 4]; out[2 * i + 1] = DIGITS[bytes[i] & 15];
  }
  return out;
}

inline void respond(JsonObject root, const std::string &challenge, const std::string &ota_password,
                    const char *ui_version, unsigned firmware_revision, unsigned public_version,
                    const std::string &source_stock_version, const std::string &display_feed_entity) {
  // A bounded challenge is carried in the GCM AAD and plaintext. Failures
  // return a fixed, value-free object; never log a JSON body or password.
  root["error"] = "device_profile_unavailable";
  if (source_stock_version != "4.3.4" && source_stock_version != "4.5.8") return;
  if (challenge.size() != 32 || ota_password.empty() || ota_password.size() > 63) return;
  for (const char c : challenge) if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) return;
  auto *server = api::global_api_server;
  auto *wifi = esphome::wifi::global_wifi_component;
  if (server == nullptr || wifi == nullptr || !server->get_noise_ctx().has_psk()) return;
  noise::psk_t psk{};
  server->get_noise_ctx().load_psk(psk);
  if (noise::NoiseContext::is_all_zeros(psk)) return;
  std::array<uint8_t, 32> key{};
  const auto *md = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  const int derived = md == nullptr ? -1 : mbedtls_md_hmac(md, psk.data(), psk.size(),
      reinterpret_cast<const uint8_t *>(KEY_DOMAIN), sizeof(KEY_DOMAIN) - 1, key.data());
  mbedtls_platform_zeroize(psk.data(), psk.size());
  if (derived != 0) { mbedtls_platform_zeroize(key.data(), key.size()); return; }

  char mac_buffer[MAC_ADDRESS_BUFFER_SIZE];
  get_mac_address_into_buffer(mac_buffer);
  std::string mac(mac_buffer);
  for (auto &c : mac) if (c >= 'a' && c <= 'f') c -= 'a' - 'A';
  const std::string aad = std::string(PROFILE) + "|" + mac + "|" + challenge;
  const auto sta = wifi->get_sta();
  const auto ap = wifi->get_ap();
  JsonDocument document;
  auto body = document.to<JsonObject>();
  body["format"] = PROFILE; body["challenge"] = challenge;
  body["mac"] = mac; body["name"] = App.get_name().str();
  body["profile"] = "lite"; body["hardware"] = "0001";
  body["source_stock_version"] = source_stock_version;
  body["version"] = ui_version; body["revision"] = firmware_revision;
  body["public_version"] = public_version;
  auto values = body["personalization"].to<JsonObject>();
  // Read the active network, including changes made on the touch UI, rather
  // than a factory/build-time SSID. The public wrapper supplies the same
  // volatile-loaded OTA password it sets before OTA setup at boot.
  values["ssid"] = sta.get_ssid().str(); values["wifi_password"] = sta.get_password().str();
  values["ap_ssid"] = ap.get_ssid().str(); values["ap_password"] = ap.get_password().str();
  values["ota_password"] = ota_password;
  values["display_feed_entity"] = display_feed_entity;
  std::string plain;
  serializeJson(document, plain);
  document.clear();
  if (plain.empty() || plain.size() > 2048) {
    mbedtls_platform_zeroize(key.data(), key.size());
    if (!plain.empty()) mbedtls_platform_zeroize(plain.data(), plain.size());
    return;
  }
  std::array<uint8_t, 12> nonce{};
  std::array<uint8_t, 16> tag{};
  esp_fill_random(nonce.data(), nonce.size());
  std::vector<uint8_t> sealed(plain.size() + tag.size());
  mbedtls_gcm_context context;
  mbedtls_gcm_init(&context);
  int rc = mbedtls_gcm_setkey(&context, MBEDTLS_CIPHER_ID_AES, key.data(), 256);
  if (rc == 0) rc = mbedtls_gcm_crypt_and_tag(&context, MBEDTLS_GCM_ENCRYPT, plain.size(),
      nonce.data(), nonce.size(), reinterpret_cast<const uint8_t *>(aad.data()), aad.size(),
      reinterpret_cast<const uint8_t *>(plain.data()), sealed.data(), tag.size(), tag.data());
  mbedtls_gcm_free(&context);
  mbedtls_platform_zeroize(key.data(), key.size());
  mbedtls_platform_zeroize(plain.data(), plain.size());
  if (rc != 0) return;
  std::copy(tag.begin(), tag.end(), sealed.end() - tag.size());
  root.remove("error");
  root["format"] = "qingping-update-profile-envelope-v1";
  root["nonce"] = hex(nonce.data(), nonce.size());
  root["ciphertext"] = hex(sealed.data(), sealed.size());
}
}  // namespace esphome::qf_update_profile
