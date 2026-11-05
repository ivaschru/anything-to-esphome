#pragma once

// One reserved SDK preference key, used only by the opt-in durable full
// runtime. It is the user's desired PM setting, not the guardian's original
// stock state or the RAM hardware journal. Those remain separate recovery
// authorities. Never make the template switch restore itself before PM setup.
#include <array>
#include <cstdint>

namespace cgs1_pm_choice {
inline constexpr uint32_t KEY=0xc651504dU;
using Record=std::array<uint8_t,4>;
enum class Read {ABSENT,LOADED,ERROR};
inline Record encode(bool enabled) {
  const auto value=uint8_t(enabled?1:0);
  return {{0x51,1,value,uint8_t(value^0xffU)}};
}
inline bool decode(const Record &record,bool &enabled) {
  // Version and complement distinguish a committed choice from a coincidental
  // key collision or a future schema. The outer snapshot has its own CRC.
  if(record[0]!=0x51 || record[1]!=1 || record[2]>1 || record[3]!=uint8_t(record[2]^0xffU))return false;
  enabled=record[2]!=0;return true;
}
}  // namespace cgs1_pm_choice
