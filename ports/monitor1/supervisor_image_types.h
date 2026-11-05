#pragma once
#include <cstdint>

namespace cgs1_supervisor {
// A verified adapter observation, not an authorization supplied over IPC.
// Policy tests may use synthetic images; production must verify real bytes,
// metadata and the fixed private path before constructing this observation.
struct Image {
  uint64_t device{0},inode{0},bytes{0};bool verified{false};
};
inline bool same_image(const Image &a,const Image &b) {
  return a.verified && b.verified && a.inode && a.bytes &&
         a.device==b.device && a.inode==b.inode && a.bytes==b.bytes;
}
}  // namespace cgs1_supervisor
