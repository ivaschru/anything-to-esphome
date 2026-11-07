#pragma once
// Host-only synthetic device data. Never included by an ESPHome YAML/build.
#include <array>
#include <cstring>
#include <string>
namespace esphome {
struct FixtureText { std::string value; std::string str() const { return value; } };
inline constexpr size_t MAC_ADDRESS_BUFFER_SIZE = 13;
template<size_t N> void get_mac_address_into_buffer(char (&out)[N]) { static_assert(N >= 13); std::memcpy(out,"00aabbccddee",13); }
struct FixtureApp { FixtureText get_name() const { return {"qingping-00aabbccddee-000000000"}; } };
inline FixtureApp App;
namespace noise {
using psk_t=std::array<uint8_t,32>;
struct NoiseContext {
 bool has_psk() const { return true; }
 void load_psk(psk_t &out) const { out.fill('K'); }
 static bool is_all_zeros(const psk_t &p) { for(auto b:p) if(b) return false; return true; }
};
}
}
