#pragma once

// Local touchscreen input -> bounded binary WPA2 request. The passphrase
// never becomes command text, a log field, API entity or persistent UI setting.
// The caller owns/erases the input buffer; Network erases its binary PSK on
// destruction. The existing typed WPA transport later renders ONLY 64 hex
// digits, behind independently checked native/guardian/privacy authority.
#include "wifi_private_store.h"
#include <openssl/evp.h>

namespace cgs1_wifi_request {
enum class Error {NONE,SSID_LENGTH,PASSWORD_LENGTH,PASSWORD_CHARACTER,DERIVATION};
inline bool derive(const std::string&ssid,const char*password,size_t size,
    cgs1_wifi_private::Network&out,Error&error) {
  out=cgs1_wifi_private::Network{};error=Error::NONE;
  if(ssid.empty() || ssid.size()>32){error=Error::SSID_LENGTH;return false;}
  if(!password || size<8 || size>63){error=Error::PASSWORD_LENGTH;return false;}
  // This first keypad supports printable ASCII passphrases. SSIDs are raw
  // 1..32 bytes (including UTF-8 from scan results), never shell text. Reject
  // unsupported input explicitly instead of truncating or changing its bytes.
  for(size_t i=0;i<size;++i)if(static_cast<unsigned char>(password[i])<32 ||
      static_cast<unsigned char>(password[i])>126){error=Error::PASSWORD_CHARACTER;return false;}
  out.ssid_size=static_cast<uint8_t>(ssid.size());std::memcpy(out.ssid.data(),ssid.data(),ssid.size());
  if(::PKCS5_PBKDF2_HMAC_SHA1(password,int(size),out.ssid.data(),int(ssid.size()),4096,
      int(out.psk.size()),out.psk.data())!=1) {
    cgs1_wifi_private::erase_bytes(out.psk.data(),out.psk.size());out.ssid_size=0;
    error=Error::DERIVATION;return false;
  }
  return true;
}
} // namespace cgs1_wifi_request
