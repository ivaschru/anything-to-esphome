// Portable parser tests: synthetic strings only, no filesystem/network/device.
#ifdef NDEBUG
#error "Resource parser fixtures require enabled assertions"
#endif
#include "initial_trial_resources.h"
#include <cassert>
#include <cstdio>

using namespace cgs1_initial_trial;
static std::string memory(const std::string &free="65536") {
  return "MemTotal: 131072 kB\nMemFree: "+free+" kB\nCached: 999999999 kB\nSwapFree: 999999999 kB\n";
}
static std::string table(bool ipv6,const std::string &port="1234",const std::string &state="0A") {
  const std::string address(ipv6?32:8,'0');
  return "  sl local_address "+std::string(ipv6?"remote_address":"rem_address")+" st tx_queue\n"+
    "  0: "+address+":"+port+" "+address+":0000 "+state+" 00000000:00000000\n";
}
int main() {
  uint64_t bytes=99;
  assert(initial_memory_floor(memory(),bytes) && bytes==64ULL*1024*1024);
  assert(initial_memory_floor(memory("32768"),bytes) && bytes==32ULL*1024*1024);
  for(const auto &text:{memory("32767"),memory("-1"),memory("+65536"),memory("131073"),
      memory("999999999999999999999999"),std::string("MemFree: 65536 kB\n"),
      std::string("MemTotal: 131072 kB\nMemAvailable: 99999999 kB\nMemFree: 0 kB\n"),
      memory()+"MemFree: 65536 kB\n",memory()+"MemTotal: 131072 kB\n",
      std::string("MemTotal: 131072 kB\nMemFree: 65536 MB\n"),
      std::string("MemTotal: 131072 kB\nMemFree: 65536 kB extra\n"),
      std::string("MemTotal: 131072 kB\nMemFree: 65536 kB"),memory()+std::string(17000,'x')+"\n"}) {
    bytes=99;assert(!initial_memory_floor(text,bytes) && bytes==0);
  }
  std::string nul=memory();nul[3]='\0';assert(!initial_memory_floor(nul,bytes));
  uint64_t value=99;assert(resource_decimal("1024",1024,value) && value==1024);
  assert(!resource_decimal("1025",1024,value) && value==0);
  assert(!resource_decimal("x",1024,value) && value==0);
  for(const bool ipv6:{false,true}) {
    assert(initial_tcp_ports_free(table(ipv6),ipv6));
    assert(initial_tcp_ports_free("sl local_address rem_address st\n",ipv6));
    for(const auto &port:{"17A5","17a5","0CA0","0ca0"})
      for(const auto &state:{"01","04","06","0A"})assert(!initial_tcp_ports_free(table(ipv6,port,state),ipv6));
    assert(!initial_tcp_ports_free(table(!ipv6),ipv6));
    assert(!initial_tcp_ports_free(table(ipv6,"1234","QQ"),ipv6));
    assert(!initial_tcp_ports_free(table(ipv6,"xyz1"),ipv6));
    assert(!initial_tcp_ports_free("unexpected header\n",ipv6));
    auto text=table(ipv6);text.pop_back();assert(!initial_tcp_ports_free(text,ipv6));
    text=table(ipv6);text[0]='\0';assert(!initial_tcp_ports_free(text,ipv6));
    text=table(ipv6);text.replace(text.find("  0:"),4,"  x:");assert(!initial_tcp_ports_free(text,ipv6));
    assert(!initial_tcp_ports_free(table(ipv6)+"\n",ipv6));
    assert(!initial_tcp_ports_free(table(ipv6)+std::string(1030,'x')+"\n",ipv6));
    assert(!initial_tcp_ports_free(std::string(262145,'x')+"\n",ipv6));
  }
  std::puts("portable initial resource parser fixtures passed");
}
