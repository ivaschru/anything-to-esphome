#pragma once
#include <cstdlib>

// Independent last-resort process lifetime, in addition to the remote shell
// watchdog used during a hardware trial. This exits only this RAM executable;
// it never reboots Linux, writes flash or changes a sensor calibration setting.
namespace cgs1_direct_trial {
inline void finish() { std::exit(0); }
}
