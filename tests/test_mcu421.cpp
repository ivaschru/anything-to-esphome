#include "../ports/lite-mcu421/protocol.h"
#include <cassert>
#include <iostream>
#include <random>
#include <string>
#include <vector>

using namespace qingping::mcu421;

// Synthetic fixtures contain no device captures, MACs or vendor firmware. The
// independent builder is test-only: production code cannot send MCU commands.
std::vector<uint8_t> packet(std::vector<uint8_t> payload, uint8_t command = 0x31) {
  std::vector<uint8_t> bytes{0x43, 0x47, command, static_cast<uint8_t>(payload.size()),
                             static_cast<uint8_t>(payload.size() >> 8)};
  bytes.insert(bytes.end(), payload.begin(), payload.end());
  uint32_t sum = 0;
  for (auto b : bytes) sum += b;
  bytes.push_back(sum & 255); bytes.push_back((sum >> 8) & 255);
  return bytes;
}

std::string hex(const std::vector<uint8_t> &bytes) {
  std::string result;
  for (auto b : bytes) { result += "0123456789ABCDEF"[b >> 4]; result += "0123456789ABCDEF"[b & 15]; }
  return result;
}

int main() {
  Frame frame;
  // Explicit known-answer checksum: 43+47+31+7+8+4+20+3 = F1 hex.
  const std::vector<uint8_t> co2{0x43,0x47,0x31,7,0,8,4,0,0x20,3,0,0,0xf1,0};
  assert(decode(co2.data(), co2.size(), frame) == Error::NONE);
  assert(frame.command == 0x31 && frame.count == 1 && frame.tlvs[0].key == 8);
  assert(frame.tlvs[0].length == 4 && frame.bytes[frame.tlvs[0].offset] == 0x20);
  const Frame copy = frame;
  assert(decode(frame.bytes.data(), frame.length, frame) == Error::NONE);
  assert(decode_hex("434731070008040020030000f100", frame) == Error::NONE);
  assert(copy.bytes[copy.tlvs[0].offset + 1] == 3);

  // Every truncated prefix fails, including a plausible header/payload. It
  // also clears a previously valid output, rather than preserving stale data.
  for (size_t n = 0; n < co2.size(); ++n) {
    frame = copy;
    assert(decode(co2.data(), n, frame) != Error::NONE);
    assert(frame.length == 0 && frame.count == 0);
  }
  for (size_t i = 0; i < co2.size(); ++i) {
    auto damaged = co2; damaged[i] ^= 1;
    assert(decode(damaged.data(), damaged.size(), frame) != Error::NONE);
  }
  auto check = [&](const std::vector<uint8_t> &p, Error expected) {
    frame = copy;
    assert(decode(p.data(), p.size(), frame) == expected);
    if (expected != Error::NONE) assert(frame.count == 0 && frame.length == 0);
  };
  check(packet({}), Error::NONE);
  check(packet({8}), Error::TLV_HEADER);
  check(packet({8,4,0,1}), Error::TLV_LENGTH);
  // Unknown and duplicate keys are retained for research, never interpreted as
  // measurements. Zero-size values are structurally valid, not valid sensors.
  check(packet({0xfe,0,0,0xfe,0,0}), Error::NONE);
  assert(frame.count == 2);
  std::vector<uint8_t> many;
  for (size_t i = 0; i < MAX_TLVS; ++i) many.insert(many.end(), {1,0,0});
  check(packet(many), Error::NONE);
  many.insert(many.end(), {1,0,0}); check(packet(many), Error::TLV_COUNT);
  // Maximum-size packet also exercises a wrapping additive checksum.
  std::vector<uint8_t> large(MAX_FRAME - 7, 0xff);
  large[0] = 0xfe; large[1] = 0xf6; large[2] = 3;  // 1014-byte opaque TLV.
  check(packet(large), Error::NONE);
  assert(frame.length == MAX_FRAME);
  check(packet(std::vector<uint8_t>(MAX_FRAME, 0)), Error::SIZE);
  assert(decode(nullptr, 7, frame) == Error::SIZE);
  for (auto text : {"434731070008040020030000f100 ", "434731070008040020030000f10Z", "4347310"})
    assert(decode_hex(text, frame) != Error::NONE);

  // Bounded deterministic corpus: ASan/UBSan can catch boundary bugs without
  // connecting to hardware. No throughput/timing claims are made from this.
  std::mt19937 random(421);
  for (int i = 0; i < 20000; ++i) {
    std::vector<uint8_t> data(random() % 1100);
    for (auto &b : data) b = random() & 255;
    decode(data.data(), data.size(), frame);
    if (data.size() <= MAX_FRAME) decode_hex(hex(data), frame);
  }
  std::cout << "MCU421 bounds/checksum/TLV/hex and 20000 corpus cases passed\n";
}
