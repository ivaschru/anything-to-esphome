// Portable stock-session parser tests; no real process, argv or maps read.
#ifdef NDEBUG
#error "Stock session fixtures require enabled assertions"
#endif
#include "initial_trial_stock.h"
#include <cassert>
#include <array>
#include <cstdio>
#include <vector>
using namespace cgs1_initial_trial;
static std::string stat_text(uint32_t pid,const std::string &comm="Snow App ) worker",const std::string &state="S",
    const std::string &parent="100",const std::string &flags="4194304",const std::string &start="1234") {
  std::array<std::string,20> fields;fields.fill("0");
  fields[0]=state;fields[1]=parent;fields[6]=flags;fields[19]=start;
  std::string text=std::to_string(pid)+" ("+comm+")";
  for(const auto &field:fields)text+=" "+field;
  return text+"\n";
}
int main() {
  InitialProcessIdentity stamp;
  assert(initial_process_stat(stat_text(101),101,stamp) && stamp.pid==101 && stamp.parent==100 &&
    stamp.start==1234 && stamp.flags==4194304 && stamp.alive());
  assert(initial_process_stat(stat_text(101,"line\nbreak ( )"),101,stamp) && stamp.start==1234);
  assert(initial_process_stat(stat_text(1,"init","S","0"),1,stamp) && stamp.parent==0);
  for(const auto &text:std::vector<std::string>{stat_text(102),stat_text(101,"x","Q"),stat_text(101,"x","S","-1"),
      stat_text(101,"x","S","2147483648"),stat_text(101,"x","S","100","-1"),
      stat_text(101,"x","S","100","1","0"),stat_text(101,"x","S","100","1","18446744073709551616"),
      "101 (x) S 100\n",stat_text(101)+std::string(8193,'x'),"101 (x) S 100\0"}) {
    assert(!initial_process_stat(text,101,stamp) && !stamp.pid && !stamp.start);
  }
  static constexpr char command[]="/bin/sh\0/data/bin/watchdog.sh\0";
  const std::string correct(command,sizeof(command)-1);assert(initial_watchdog_command(correct));
  for(const auto &text:{correct.substr(0,correct.size()-1),correct+"extra",std::string("/bin/sh /data/bin/watchdog.sh"),
      std::string("/bin/sh\n/data/bin/watchdog.sh\n"),std::string()})assert(!initial_watchdog_command(text));
  const std::string maps="00008000-0000c000 r-xp 00000000 00:01 42 /data/bin/SnowApp\n"
    "0000c000-0000d000 rw-p 00004000 00:00 0\n";
  assert(initial_stock_maps(maps));
  for(const auto &text:std::vector<std::string>{"",maps.substr(0,maps.size()-1),maps+"\n",
      "00008000-0000c000 r-xp 0 00:01 42 /data/.esphome-cgs1/pm_qt_bridge.so (deleted)\n",
      "0000c000-00008000 r-xp 0 00:01 42\n","00008000-0000c000 r-qp 0 00:01 42\n",
      "00008000-0000c000 r-xp 0 malformed 42\n","00008000-0000c000 r-xp 0 00:01 -1\n",
      "not a map\n",std::string(1048577,'x')+"\n"})assert(!initial_stock_maps(text));
  uint64_t number=0;assert(!stock_unsigned("1",0,number));
  assert(stock_unsigned("18446744073709551615",UINT64_MAX,number) && number==UINT64_MAX);
  assert(!stock_unsigned("18446744073709551616",UINT64_MAX,number));
  InitialStockIdentity expected{101,100,1234,1000};assert(expected.valid());
  expected.watchdog_pid=101;assert(!expected.valid());
  std::puts("initial stock session parser fixtures passed");
}
