#pragma once

// Bounded read-only LIST_NETWORKS parser. The native protocol uses TAB column
// separators; never tokenize SSIDs by whitespace or treat a daemon reply as a
// shell command. This catalog has no passphrase/configuration getter.
#include "wifi_control_inspect.h"
#include <vector>
#include <sstream>

namespace cgs1_wifi {
struct SavedProfile {
  int id{-1};
  std::string ssid_text,bssid,flags;
  bool current{false},disabled{false},temporarily_disabled{false},flags_known{true};
};
inline uint64_t control_socket_inode(const std::string &text,const std::string &path) {
  if(text.size()>65536 || text.find('\0')!=std::string::npos || text.compare(0,3,"Num"))return 0;
  std::istringstream lines(text);std::string line;uint64_t result=0;
  std::getline(lines,line); // Kernel header, not a socket row.
  while(std::getline(lines,line)) {
    std::istringstream row(line);std::string num,refs,protocol,flags,type,state,inode,name,extra;
    if(!(row>>num>>refs>>protocol>>flags>>type>>state>>inode>>name) || name!=path)continue;
    if((row>>extra) || type!="0002" || result || inode.empty() || inode.size()>20)return 0;
    uint64_t parsed=0;
    for(char c:inode) {
      if(c<'0' || c>'9' || parsed>(UINT64_MAX-uint64_t(c-'0'))/10)return 0;
      parsed=parsed*10+uint64_t(c-'0');
    }
    if(!parsed)return 0;
    result=parsed;
  }
  return result;
}
inline bool parse_profile_flags(SavedProfile &p) {
  size_t offset=0;unsigned seen=0;
  while(offset<p.flags.size()) {
    if(p.flags[offset]!='[')return false;
    const auto end=p.flags.find(']',offset+1);
    if(end==std::string::npos || end==offset+1)return false;
    const auto word=p.flags.substr(offset+1,end-offset-1);offset=end+1;
    unsigned bit=0;
    if(word=="CURRENT"){p.current=true;bit=1;}
    else if(word=="DISABLED"){p.disabled=true;bit=2;}
    else if(word=="TEMP-DISABLED"){p.temporarily_disabled=true;bit=4;}
    else if(word=="P2P-PERSISTENT"){p.flags_known=false;bit=8;}
    else p.flags_known=false;
    if(bit && (seen&bit))return false;
    seen|=bit;
  }
  return !(p.current && p.disabled);
}
inline bool parse_saved_profiles(const std::string &text,std::vector<SavedProfile> &result) {
  constexpr const char *HEADER="network id / ssid / bssid / flags\n";
  if(text.empty() || text.size()>4096 || text.find('\0')!=std::string::npos ||
      text.compare(0,std::strlen(HEADER),HEADER))return false;
  std::vector<SavedProfile> parsed;size_t offset=std::strlen(HEADER);unsigned currents=0;
  while(offset<text.size()) {
    const auto end=text.find('\n',offset);
    if(end==std::string::npos)return false; // Truncated rows never become a baseline.
    const auto line=text.substr(offset,end-offset);offset=end+1;
    if(line.empty())continue;
    if(line.size()>512 || parsed.size()>=32)return false;
    const auto a=line.find('\t'),b=a==std::string::npos?a:line.find('\t',a+1),
      c=b==std::string::npos?b:line.find('\t',b+1);
    if(a==std::string::npos || b==std::string::npos || c==std::string::npos ||
        line.find('\t',c+1)!=std::string::npos)return false;
    SavedProfile p;
    if(!decimal(line.substr(0,a),1000000,p.id))return false;
    p.ssid_text=line.substr(a+1,b-a-1);p.bssid=line.substr(b+1,c-b-1);p.flags=line.substr(c+1);
    if(p.ssid_text.size()>128 || (p.bssid!="any" && !mac_address(p.bssid)) ||
        p.flags.size()>256 || !parse_profile_flags(p))return false;
    // The escaped SSID may contain backslash sequences and spaces, but literal
    // controls/newlines must not leak into a report or shift the next row.
    for(unsigned char value:p.ssid_text)if(value<32 || value==127)return false;
    for(unsigned char value:p.flags)if(value<33 || value>126)return false;
    for(const auto &old:parsed)if(old.id==p.id)return false;
    if(p.current && ++currents>1)return false;
    parsed.push_back(p);
  }
  result=std::move(parsed);return true;
}
} // namespace cgs1_wifi
