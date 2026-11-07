#pragma once
#include <cstdint>
#include <cstddef>
// Deterministic test nonce only. Production includes the real ESP-IDF header.
inline void esp_fill_random(void *out,size_t n){for(size_t i=0;i<n;i++)static_cast<uint8_t *>(out)[i]=static_cast<uint8_t>(i);}
