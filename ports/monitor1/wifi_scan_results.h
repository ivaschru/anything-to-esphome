#pragma once

// Bounded discovery metadata, never a connection/commit baseline. The exact
// SCAN_RESULTS header exists in the captured SHA-pinned vendor ELF. SSID text
// is escaped by its protocol: decode to the original bytes before PBKDF2,
// while keeping unsafe binary/control names out of the font renderer.
#include "wifi_control_inspect.h"
#include <algorithm>
#include <vector>

namespace cgs1_wifi_scan {
struct Network {
  std::string ssid,label,bssid;int frequency{0},signal{-127};bool supported{false};
};
inline int hex_digit(unsigned char c) {
  return c>='0' && c<='9'?c-'0':c>='a' && c<='f'?c-'a'+10:c>='A' && c<='F'?c-'A'+10:-1;
}
inline bool decode_ssid(const std::string&text,std::string&out) {
  if(text.size()>128)return false;
  std::string decoded;
  for(size_t at=0;at<text.size();++at) {
    unsigned char c=text[at];
    if(c=='\\') {
      if(++at>=text.size())return false;
      c=text[at];
      if(c=='x') {
        if(at+2>=text.size())return false;
        const auto a=hex_digit(text[at+1]),b=hex_digit(text[at+2]);
        if(a<0 || b<0)return false;
        c=static_cast<unsigned char>(a*16+b);at+=2;
      }else if(c=='n')c='\n';else if(c=='r')c='\r';else if(c=='t')c='\t';
      else if(c=='e')c=27;else if(c!='\\' && c!='"')return false;
    }else if(c<32 || c==127)return false;
    if(decoded.size()>=32)return false;
    decoded+=static_cast<char>(c);
  }
  out=std::move(decoded);return true;
}
inline bool display_safe(const std::string&text) {
  // Strict UTF-8: reject controls, overlong encodings, surrogates and values
  // beyond Unicode. Valid raw SSID bytes remain untouched in Network::ssid.
  for(size_t at=0;at<text.size();) {
    const auto lead=static_cast<unsigned char>(text[at++]);
    if(lead<0x80){if(lead<32 || lead==127)return false;continue;}
    unsigned extra=0;uint32_t point=0,minimum=0;
    if(lead>=0xc2 && lead<=0xdf){extra=1;point=lead&31;minimum=0x80;}
    else if(lead>=0xe0 && lead<=0xef){extra=2;point=lead&15;minimum=0x800;}
    else if(lead>=0xf0 && lead<=0xf4){extra=3;point=lead&7;minimum=0x10000;}
    else return false;
    if(extra>text.size()-at)return false;
    for(unsigned n=0;n<extra;++n) {
      const auto c=static_cast<unsigned char>(text[at++]);if((c&0xc0)!=0x80)return false;
      point=(point<<6)|(c&63);
    }
    if(point<minimum || point>0x10ffff || (point>=0xd800 && point<=0xdfff) ||
        (point>=0x80 && point<=0x9f) || point==0x2028 || point==0x2029)return false;
  }
  return true;
}
inline bool flags_support_wpa2(const std::string&flags,bool&supported) {
  if(flags.empty() || flags.size()>256)return false;
  bool psk=false,ess=false,unsupported=false;size_t at=0;
  while(at<flags.size()) {
    if(flags[at]!='[')return false;
    const auto end=flags.find(']',at+1);if(end==std::string::npos || end==at+1)return false;
    const auto word=flags.substr(at+1,end-at-1);at=end+1;
    if(!cgs1_wifi::token(word,128) || word.find('[')!=std::string::npos)return false;
    if(word=="ESS")ess=true;
    else if(word=="WPA2-PSK-CCMP" || word=="WPA2-PSK-CCMP+TKIP")psk=true;
    else if(word=="WPS" || word=="WPS-PBC" || word=="WPS-PIN" || word=="WPA-PSK-TKIP" ||
        word=="WPA-PSK-CCMP" || word=="WPA-PSK-CCMP+TKIP"){}
    else unsupported=true; // Enterprise, WPA3-only, IBSS/P2P and unknown modes.
  }
  supported=psk && ess && !unsupported;return true;
}
inline bool parse(const std::string&text,std::vector<Network>&out) {
  constexpr const char*HEADER="bssid / frequency / signal level / flags / ssid\n";
  if(text.size()>4096 || text.find('\0')!=std::string::npos || text.compare(0,std::strlen(HEADER),HEADER))return false;
  std::vector<Network>rows;size_t offset=std::strlen(HEADER);unsigned count=0;
  while(offset<text.size()) {
    const auto end=text.find('\n',offset);if(end==std::string::npos)return false;
    const auto line=text.substr(offset,end-offset);offset=end+1;if(line.empty())continue;
    if(++count>64 || line.size()>512)return false;
    std::array<size_t,4>tabs{};size_t from=0;
    for(auto&tab:tabs){tab=line.find('\t',from);if(tab==std::string::npos)return false;from=tab+1;}
    if(line.find('\t',from)!=std::string::npos)return false;
    Network row;row.bssid=line.substr(0,tabs[0]);
    if(!cgs1_wifi::mac_address(row.bssid) ||
        !cgs1_wifi::decimal(line.substr(tabs[0]+1,tabs[1]-tabs[0]-1),7000,row.frequency))return false;
    const auto signal=line.substr(tabs[1]+1,tabs[2]-tabs[1]-1);int magnitude=0;
    const bool negative=!signal.empty() && signal[0]=='-';
    if(!cgs1_wifi::decimal(negative?signal.substr(1):signal,127,magnitude))return false;
    row.signal=negative?-magnitude:magnitude;
    if(!flags_support_wpa2(line.substr(tabs[2]+1,tabs[3]-tabs[2]-1),row.supported) ||
        !decode_ssid(line.substr(tabs[3]+1),row.ssid))return false;
    if(row.ssid.empty())continue; // Hidden networks require manual input.
    const bool safe=display_safe(row.ssid);
    row.label=safe?row.ssid:"Неподдерживаемое имя сети";
    row.supported=row.supported && safe && row.frequency>=2412 && row.frequency<=2484;
    // One row per exact SSID, prefer a usable WPA2 BSS over an unsupported
    // one with the same name, then strongest signal. This never pins a BSSID
    // for a later transaction or asserts that cached discovery is fresh.
    const auto old=std::find_if(rows.begin(),rows.end(),[&](const auto&r){return r.ssid==row.ssid;});
    if(old==rows.end())rows.push_back(row);
    else if((row.supported && !old->supported) || (row.supported==old->supported && row.signal>old->signal))*old=row;
  }
  std::stable_sort(rows.begin(),rows.end(),[](const auto&a,const auto&b){
    if(a.supported!=b.supported)return a.supported;
    return a.signal>b.signal;
  });
  if(rows.size()>4)rows.resize(4);
  out=std::move(rows);return true;
}
} // namespace cgs1_wifi_scan
