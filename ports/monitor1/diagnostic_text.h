#pragma once
#include <string>

namespace cgs1_net_trial {
// ArduinoJson can retain raw ANSI ESC in string output. Strip terminal control
// sequences before serialization, so ordinary strict JSON readers can consume
// fixed native logs. Text, UTF-8 and useful whitespace stay unchanged.
inline std::string plain_diagnostic(const std::string& input) {
  std::string output;
  output.reserve(input.size());
  for(size_t i=0;i<input.size();++i) {
    const auto value=static_cast<unsigned char>(input[i]);
    if(value==0x1b && i+1<input.size() && input[i+1]=='[') {
      i+=2;
      while(i<input.size() && !(static_cast<unsigned char>(input[i])>=0x40 && static_cast<unsigned char>(input[i])<=0x7e))++i;
      continue;
    }
    if((value<0x20 && value!='\n' && value!='\r' && value!='\t') || value==0x7f)output+='?';
    else output+=input[i];
  }
  return output;
}
} // namespace cgs1_net_trial
