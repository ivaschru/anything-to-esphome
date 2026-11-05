#pragma once

// Stock-preserving CGS1 bridge. This client can only issue get_value; it never
// changes calibration, networking, PM power, display settings or vendor files.
// Credentials are read on the device, not embedded into distributable sources.
#include "esphome/core/hal.h"
#include "esphome/core/log.h"
#include "esphome/components/json/json_util.h"
#include <openssl/crypto.h>
#include <openssl/evp.h>
#include <openssl/md5.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <sys/ioctl.h>
#include <net/if.h>
#include <fcntl.h>
#include <unistd.h>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <cerrno>
#include <cstdint>
#include <cstdlib>
#include <limits>

namespace cgs1 {

class StockMiio {
 public:
  // A nonblocking state machine keeps ESPHome's API/OTA loop responsive even
  // if the vendor daemon stops replying. No background thread or second sensor
  // reader is started. One fixed query every ten seconds is sufficient here.
  void loop() {
    const uint32_t now = esphome::millis();
    if (phase_ == 0) {
      if (started_ && now - last_attempt_ < 10000) return;
      started_ = true;
      last_attempt_ = now;
      if (!credentials_loaded_ && !load_credentials_()) return;
      if (!open_socket_()) return;
      uint8_t hello[32];
      std::memset(hello, 0xff, sizeof(hello));
      hello[0] = 0x21; hello[1] = 0x31; hello[2] = 0; hello[3] = 32;
      if (::send(fd_, hello, sizeof(hello), 0) != sizeof(hello)) { fail_(); return; }
      phase_ = 1;
      deadline_ = now;
      return;
    }
    if (now - deadline_ > 1200) { fail_(); return; }
    uint8_t packet[8192];
    const ssize_t length = ::recv(fd_, packet, sizeof(packet), MSG_DONTWAIT);
    if (length < 0 && (errno == EAGAIN || errno == EWOULDBLOCK)) return;
    if (length < 32 || packet[0] != 0x21 || packet[1] != 0x31 ||
        read16_(packet + 2) != length || read32_(packet + 8) != did_) { fail_(); return; }
    if (phase_ == 1) {
      if (length != 32 || !send_query_(read32_(packet + 12))) { fail_(); return; }
      phase_ = 2;
      deadline_ = now;
      return;
    }
    // Authenticate the complete datagram before decryption or JSON parsing.
    // Connected UDP also pins the peer endpoint. A wrong key never yields data.
    const size_t cipher_size = length - 32;
    uint8_t digest[16];
    checksum_(packet, cipher_size, digest);
    if (cipher_size < 16 || cipher_size % 16 ||
        CRYPTO_memcmp(digest, packet + 16, sizeof(digest)) != 0) { fail_(); return; }
    uint8_t plain[8192];
    EVP_CIPHER_CTX *context = EVP_CIPHER_CTX_new();
    int count = 0, final_count = 0;
    const bool decrypted = context &&
        EVP_DecryptInit_ex(context, EVP_aes_128_cbc(), nullptr, aes_key_, aes_iv_) == 1 &&
        EVP_DecryptUpdate(context, plain, &count, packet + 32, cipher_size) == 1 &&
        EVP_DecryptFinal_ex(context, plain + count, &final_count) == 1;
    EVP_CIPHER_CTX_free(context);
    if (!decrypted) { fail_(); return; }
    JsonDocument document;
    const auto error = deserializeJson(document, plain, count + final_count,
                                       DeserializationOption::NestingLimit(8));
    if (error || !document["id"].is<uint32_t>() ||
        document["id"].as<uint32_t>() != request_id_ ||
        !document["result"].is<JsonObject>()) { fail_(); return; }
    const JsonObjectConst result = document["result"].as<JsonObjectConst>();
    temperature_ = number_(result["temperature"], -40, 185);
    const char *temperature_unit = result["temperature_unit"] | "";
    if (std::strcmp(temperature_unit, "f") == 0) temperature_ = (temperature_ - 32) / 1.8f;
    else if (std::strcmp(temperature_unit, "c") != 0) temperature_ = NAN;
    humidity_ = number_(result["humidity"], 0, 100);
    co2_ = number_(result["co2"], 0, 20000);
    pm25_ = number_(result["pm25"], 0, 999);
    // Empirically verified on CGS1 4.1.8_0287: API raw ~145 with tvoc_unit
    // "ppm" corresponds to the owner's stock screen 0.145 ppm. This is a
    // vendor estimate, not a laboratory TVOC mass concentration or health norm.
    // An untested unit mode fails closed instead of guessing a conversion.
    const char *tvoc_unit = result["tvoc_unit"] | "";
    tvoc_ppm_ = std::strcmp(tvoc_unit, "ppm") == 0
        ? number_(result["tvoc"], 0, 60000) / 1000.0f : NAN;
    last_success_ = now;
    have_result_ = true;
    close_socket_();
  }

  float temperature() const { return fresh_(temperature_); }
  float humidity() const { return fresh_(humidity_); }
  float co2() const { return fresh_(co2_); }
  float pm25() const { return fresh_(pm25_); }
  float tvoc_ppm() const { return fresh_(tvoc_ppm_); }
  float response_age() const {
    return have_result_ ? (esphome::millis() - last_success_) / 1000.0f : NAN;
  }

 private:
  int fd_{-1};
  uint8_t phase_{0};
  bool started_{false}, credentials_loaded_{false}, have_result_{false};
  uint32_t last_attempt_{0}, deadline_{0}, last_success_{0}, did_{0}, request_id_{0};
  uint8_t token_[16]{}, aes_key_[16]{}, aes_iv_[16]{};
  float temperature_{NAN}, humidity_{NAN}, co2_{NAN}, pm25_{NAN}, tvoc_ppm_{NAN};

  static uint16_t read16_(const uint8_t *p) { return (uint16_t(p[0]) << 8) | p[1]; }
  static uint32_t read32_(const uint8_t *p) {
    return (uint32_t(p[0]) << 24) | (uint32_t(p[1]) << 16) | (uint32_t(p[2]) << 8) | p[3];
  }
  static void write32_(uint8_t *p, uint32_t value) {
    for (int i = 3; i >= 0; --i) { p[i] = value & 0xff; value >>= 8; }
  }
  static float number_(JsonVariantConst value, float low, float high) {
    if (!value.is<float>() && !value.is<long>()) return NAN;
    const float number = value.as<float>();
    return std::isfinite(number) && number >= low && number <= high ? number : NAN;
  }
  float fresh_(float value) const {
    return have_result_ && esphome::millis() - last_success_ <= 35000 ? value : NAN;
  }
  void close_socket_() { if (fd_ >= 0) ::close(fd_); fd_ = -1; phase_ = 0; }
  void fail_() {
    // No packet, credential, private JSON body or authentication material in logs.
    ESP_LOGW("cgs1.stock", "Read-only stock query unavailable (stage %u); freshness limits apply", phase_);
    close_socket_();
  }
  bool open_socket_() {
    fd_ = ::socket(AF_INET, SOCK_DGRAM, 0);
    if (fd_ < 0) return false;
    const int flags = ::fcntl(fd_, F_GETFL, 0);
    if (flags < 0 || ::fcntl(fd_, F_SETFL, flags | O_NONBLOCK) < 0) { close_socket_(); return false; }
    sockaddr_in address{};
    address.sin_family = AF_INET;
    address.sin_port = htons(54321);
    // Stock miio_client did not answer requests from loopback in the first
    // runtime test. Address the device's own current WLAN IP instead: Linux's
    // local route still keeps traffic on-device. Never hard-code the owner's
    // LAN address or send keys/requests to a discovered third-party endpoint.
    ifreq interface{};
    std::strncpy(interface.ifr_name, "wlan0", IFNAMSIZ - 1);
    if (::ioctl(fd_, SIOCGIFADDR, &interface) != 0) { close_socket_(); return false; }
    address.sin_addr = reinterpret_cast<sockaddr_in *>(&interface.ifr_addr)->sin_addr;
    if (::connect(fd_, reinterpret_cast<sockaddr *>(&address), sizeof(address)) < 0) {
      close_socket_(); return false;
    }
    return true;
  }
  bool load_credentials_() {
    // Bound all reads; do not accept arbitrary paths or credentials from YAML.
    FILE *file = std::fopen("/data/etc/miio/device.token", "rb");
    if (!file) return false;
    uint8_t bytes[64];
    size_t size = std::fread(bytes, 1, sizeof(bytes), file);
    std::fclose(file);
    if (size > 16) while (size && (bytes[size - 1] == '\r' || bytes[size - 1] == '\n')) --size;
    if (size != 16) { OPENSSL_cleanse(bytes, sizeof(bytes)); return false; }
    std::memcpy(token_, bytes, 16);
    OPENSSL_cleanse(bytes, sizeof(bytes));
    file = std::fopen("/data/etc/miio/device.conf", "r");
    if (!file) return false;
    char line[256];
    while (std::fgets(line, sizeof(line), file)) {
      if (std::strncmp(line, "did=", 4) != 0) continue;
      char *end;
      const unsigned long value = std::strtoul(line + 4, &end, 10);
      while (*end == ' ' || *end == '\r' || *end == '\n') ++end;
      if (*end == '\0' && value > 0 && value <= UINT32_MAX) did_ = value;
    }
    std::fclose(file);
    OPENSSL_cleanse(line, sizeof(line));
    if (!did_) return false;
    MD5(token_, sizeof(token_), aes_key_);
    uint8_t material[32];
    std::memcpy(material, aes_key_, 16); std::memcpy(material + 16, token_, 16);
    MD5(material, sizeof(material), aes_iv_);
    OPENSSL_cleanse(material, sizeof(material));
    credentials_loaded_ = true;
    return true;
  }
  void checksum_(const uint8_t *packet, size_t cipher_size, uint8_t *digest) const {
    MD5_CTX context;
    MD5_Init(&context); MD5_Update(&context, packet, 16);
    MD5_Update(&context, token_, 16); MD5_Update(&context, packet + 32, cipher_size);
    MD5_Final(digest, &context);
  }
  bool send_query_(uint32_t stamp) {
    if (++request_id_ == 0) ++request_id_;
    char request[256];
    const int size = std::snprintf(request, sizeof(request),
        "{\"id\":%u,\"method\":\"get_value\",\"params\":[\"pm25\",\"co2\",\"tvoc\","
        "\"humidity\",\"temperature\",\"tvoc_unit\",\"temperature_unit\"]}", request_id_);
    if (size < 0 || size >= sizeof(request)) return false;
    uint8_t packet[512]{};
    EVP_CIPHER_CTX *context = EVP_CIPHER_CTX_new();
    int count = 0, final_count = 0;
    const bool encrypted = context &&
        EVP_EncryptInit_ex(context, EVP_aes_128_cbc(), nullptr, aes_key_, aes_iv_) == 1 &&
        EVP_EncryptUpdate(context, packet + 32, &count,
                          reinterpret_cast<const uint8_t *>(request), size) == 1 &&
        EVP_EncryptFinal_ex(context, packet + 32 + count, &final_count) == 1;
    EVP_CIPHER_CTX_free(context);
    if (!encrypted) return false;
    const size_t cipher_size = count + final_count, length = cipher_size + 32;
    packet[0] = 0x21; packet[1] = 0x31;
    packet[2] = length >> 8; packet[3] = length & 0xff;
    write32_(packet + 8, did_); write32_(packet + 12, stamp);
    checksum_(packet, cipher_size, packet + 16);
    return ::send(fd_, packet, length, 0) == length;
  }
};

inline StockMiio stock;
}  // namespace cgs1
