#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <string_view>

// Receive-only foundation for the stock 4.2.1 MCU variant. This deliberately
// has no UART/GPIO/ESPHome dependency, transmitter or initialization command.
// A valid CG packet proves framing, not device identity or sensor freshness.
namespace qingping::mcu421 {
constexpr size_t MAX_FRAME = 1024;
constexpr size_t MAX_TLVS = 35;

struct Tlv {
  uint8_t key{0};
  uint16_t offset{0};
  uint16_t length{0};
};

struct Frame {
  // Own the bytes: slices remain valid after the caller reuses its UART buffer
  // or copies this object. Offsets, rather than pointers, also survive copies.
  std::array<uint8_t, MAX_FRAME> bytes{};
  std::array<Tlv, MAX_TLVS> tlvs{};
  size_t count{0};
  size_t length{0};
  uint8_t command{0};
};

enum class Error { NONE, SIZE, MAGIC, LENGTH, CHECKSUM, TLV_HEADER, TLV_LENGTH, TLV_COUNT, HEX };

inline uint16_t little16(const uint8_t *p) {
  // Byte reads avoid unaligned loads on the ESP32. Call only after bounds checks.
  return static_cast<uint16_t>(p[0] | (static_cast<uint16_t>(p[1]) << 8));
}

inline Error decode(const uint8_t *bytes, size_t length, Frame &out) {
  // A failed packet must not leave the previous packet looking like new data.
  // Validate into a separate candidate so partially decoded TLVs never escape.
  if (!bytes || length < 7 || length > MAX_FRAME) { out = {}; return Error::SIZE; }
  Frame candidate;
  for (size_t i = 0; i < length; ++i) candidate.bytes[i] = bytes[i];
  // Copy before clearing output so decode(out.bytes.data(), ..., out) is safe.
  bytes = candidate.bytes.data();
  out = {};
  if (bytes[0] != 0x43 || bytes[1] != 0x47) return Error::MAGIC;
  const size_t payload = little16(bytes + 3);
  if (payload != length - 7) return Error::LENGTH;
  uint16_t sum = 0;
  for (size_t i = 0; i < length - 2; ++i) sum = static_cast<uint16_t>(sum + bytes[i]);
  if (sum != little16(bytes + length - 2)) return Error::CHECKSUM;

  const size_t end = length - 2;
  for (size_t pos = 5; pos < end;) {
    if (end - pos < 3) return Error::TLV_HEADER;
    const uint8_t key = bytes[pos];
    const size_t size = little16(bytes + pos + 1);
    pos += 3;
    if (size > end - pos) return Error::TLV_LENGTH;
    if (candidate.count == MAX_TLVS) return Error::TLV_COUNT;
    candidate.tlvs[candidate.count++] = {key, static_cast<uint16_t>(pos), static_cast<uint16_t>(size)};
    pos += size;
  }
  candidate.command = bytes[2];
  candidate.length = length;
  out = candidate;
  return Error::NONE;
}

inline int nibble(char ch) {
  if (ch >= '0' && ch <= '9') return ch - '0';
  if (ch >= 'a' && ch <= 'f') return ch - 'a' + 10;
  if (ch >= 'A' && ch <= 'F') return ch - 'A' + 10;
  return -1;
}

inline Error decode_hex(std::string_view hex, Frame &out) {
  // This accepts the argument of hex_string, not a complete serial line.
  // Serial delimiters, ACKs and startup are still under investigation. Reject
  // whitespace/non-hex instead of silently altering a damaged command stream.
  out = {};
  if (hex.size() < 14 || hex.size() > MAX_FRAME * 2 || hex.size() % 2) return Error::SIZE;
  std::array<uint8_t, MAX_FRAME> bytes{};
  for (size_t i = 0; i < hex.size(); i += 2) {
    const int high = nibble(hex[i]), low = nibble(hex[i + 1]);
    if (high < 0 || low < 0) return Error::HEX;
    bytes[i / 2] = static_cast<uint8_t>((high << 4) | low);
  }
  return decode(bytes.data(), hex.size() / 2, out);
}
}  // namespace qingping::mcu421
