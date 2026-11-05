#pragma once

// Numeric inherited transport coordinates are untrusted until the Linux
// bootstrap validates descriptors, parent births and the pinned executable.
// No command/path/key text is supported here. Parsing changes output only
// after the whole two-peer record passes; it never opens or signals anything.
#include <array>
#include <cstdint>
#include <climits>
#include <string>

namespace cgs1_supervisor {
struct InheritedPeer {int descriptor{-1},pid{0};uint64_t start{0};};
using InheritedPeers=std::array<InheritedPeer,2>;
inline bool bootstrap_number(const std::string &text,uint64_t maximum,uint64_t &result) {
  if(text.empty() || text.size()>20 || (text.size()>1 && text[0]=='0'))return false;
  uint64_t value=0;
  for(const char c:text) {
    if(c<'0' || c>'9')return false;
    const uint64_t digit=uint64_t(c-'0');
    if(digit>maximum || value>(maximum-digit)/10)return false;
    value=value*10+digit;
  }
  result=value;return true;
}
inline bool parse_inherited_peers(const std::array<std::string,6> &fields,InheritedPeers &result) {
  InheritedPeers candidate{};
  for(unsigned i=0;i<2;++i) {
    uint64_t fd=0,pid=0,start=0;
    if(!bootstrap_number(fields[3*i],INT_MAX,fd) || fd<3 ||
       !bootstrap_number(fields[3*i+1],INT_MAX,pid) || pid<2 ||
       !bootstrap_number(fields[3*i+2],UINT64_MAX,start) || !start)return false;
    candidate[i]={int(fd),int(pid),start};
  }
  if(candidate[0].descriptor==candidate[1].descriptor || candidate[0].pid==candidate[1].pid)return false;
  result=candidate;return true;
}
}  // namespace cgs1_supervisor
