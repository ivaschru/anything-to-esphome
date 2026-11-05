#pragma once

// Read-only, fixed version/logging queries. Upstream hostap_2_6 ctrl_iface.c
// returns metadata for bare LOG_LEVEL; adding an argument would CHANGE it.
// ReadOnlyControl therefore allows only the exact argument-free literal and
// exact GET version, never arbitrary GET/DUMP/GET_NETWORK/LOG_LEVEL arguments.
#include "wifi_daemon_inspect.h"

namespace cgs1_wifi {
struct VersionLogging {
  bool verified{false},cleanup_verified{true},timestamps{false};
  std::string version,level,error;
  bool reported_level_is_quiet()const {
    // This describes the returned threshold only. It is not proof that a
    // vendor fork cannot print credentials at INFO, nor a write capability.
    return verified && (level=="INFO" || level=="WARNING" || level=="ERROR");
  }
};
inline bool parse_version(const std::string &text,std::string &out) {
  std::string value=text;
  if(!value.empty() && value.back()=='\n')value.pop_back();
  if(value.size()<3 || value.size()>64 || value[0]<'0' || value[0]>'9')return false;
  const auto dot=value.find('.');
  if(dot==std::string::npos || dot+1>=value.size() || value[dot+1]<'0' || value[dot+1]>'9')return false;
  for(unsigned char c:value)
    if(!((c>='0' && c<='9') || (c>='a' && c<='z') || (c>='A' && c<='Z') ||
         c=='.' || c=='-' || c=='_' || c=='+'))return false;
  out=std::move(value);return true;
}
inline bool parse_log_level(const std::string &text,std::string &level,bool &timestamps) {
  constexpr const char *PREFIX="Current level: ";
  if(text.size()>128 || text.compare(0,std::strlen(PREFIX),PREFIX))return false;
  const auto end=text.find('\n',std::strlen(PREFIX));if(end==std::string::npos)return false;
  const auto selected=text.substr(std::strlen(PREFIX),end-std::strlen(PREFIX));
  if(selected!="EXCESSIVE" && selected!="MSGDUMP" && selected!="DEBUG" &&
      selected!="INFO" && selected!="WARNING" && selected!="ERROR")return false;
  const auto rest=text.substr(end+1);
  if(rest!="Timestamp: 0\n" && rest!="Timestamp: 1\n")return false;
  level=selected;timestamps=rest=="Timestamp: 1\n";return true;
}
template<class Transport> bool read_version_logging(Transport &transport,VersionLogging &out) {
  VersionLogging parsed;std::string reply;
  if(!transport.request("GET version",reply) || !parse_version(reply,parsed.version) ||
      !transport.request("LOG_LEVEL",reply) || !parse_log_level(reply,parsed.level,parsed.timestamps))return false;
  parsed.verified=true;out=parsed;return true;
  // Caller retires the dedicated connection on failure; never send another
  // request after a lost reply or treat an unknown format as a quiet logger.
}
inline VersionLogging inspect_version_logging(size_t selected) {
  VersionLogging result;
#if defined(__linux__)
  const auto before=inspect_daemon(selected);
  if(!before.verified){result.error="version_logging_verified_daemon_required";return result;}
  ReadOnlyControl control;VersionLogging parsed;
  const bool read=control.open(selected) && read_version_logging(control,parsed);
  result.cleanup_verified=control.close();
  const auto after=inspect_daemon(selected);
  if(!read || !after.verified || after.socket_inode!=before.socket_inode ||
      after.process.pid!=before.process.pid || after.process.start!=before.process.start ||
      after.process.executable!=before.process.executable) {
    result.error="version_logging_response_or_daemon_changed";return result;
  }
  parsed.cleanup_verified=result.cleanup_verified;return parsed;
#else
  (void)selected;result.error="version_logging_verified_linux_required";return result;
#endif
}
} // namespace cgs1_wifi
