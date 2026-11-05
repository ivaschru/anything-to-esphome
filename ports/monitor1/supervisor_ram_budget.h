#pragma once

// Read-only admission budget for a 225 MiB/no-swap appliance. Linux 3.10 may
// lack MemAvailable; report the conservative free+buffers+cached-shmem
// estimate separately, never label it a measured guarantee against OOM.
#include "network_preflight.h"
#include <algorithm>
#include <map>

namespace cgs1_supervisor {
struct RamBudget {bool known{false};uint64_t reclaim_estimate_bytes{0},total_bytes{0};};
inline RamBudget parse_ram_budget(const std::string &text) {
  if(text.empty() || text.size()>8192)return {};
  std::map<std::string,uint64_t> values;std::istringstream all(text);std::string line;
  while(std::getline(all,line)) {
    std::istringstream fields(line);std::string key,unit,extra;uint64_t number=0;
    if(!(fields>>key))continue;
    if(key!="MemTotal:" && key!="MemFree:" && key!="Buffers:" && key!="Cached:" && key!="Shmem:" && key!="MemAvailable:")continue;
    if(values.count(key) || !(fields>>number>>unit) || fields>>extra || unit!="kB" || number>16ULL*1024*1024)return {};
    values[key]=number;
  }
  for(const char *key:{"MemTotal:","MemFree:","Buffers:","Cached:","Shmem:"})if(!values.count(key))return {};
  const auto total=values["MemTotal:"];if(!total)return {};
  for(const auto &item:values)if(item.second>total)return {};
  const auto cached=values["Cached:"]>values["Shmem:"]?values["Cached:"]-values["Shmem:"]:0;
  const auto estimate=values.count("MemAvailable:")?values["MemAvailable:"]:
    std::min(total,values["MemFree:"]+values["Buffers:"]+cached);
  return {true,estimate*1024,total*1024};
}
inline RamBudget read_ram_budget(){return parse_ram_budget(cgs1_net_trial::read_small("/proc/meminfo",8192));}
}  // namespace cgs1_supervisor
