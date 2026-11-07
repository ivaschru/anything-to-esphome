#pragma once
#include "common.h"
namespace esphome::api {
struct FixtureServer { noise::NoiseContext ctx; noise::NoiseContext &get_noise_ctx(){return ctx;} };
inline FixtureServer server;
inline FixtureServer *global_api_server=&server;
}
