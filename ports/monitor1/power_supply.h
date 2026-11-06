#pragma once

// CGS1 Linux power telemetry only. These fixed read-only sysfs nodes belong
// to the kernel fuel gauge; no charger setting, GPIO, battery calibration or
// thermal-model input is changed here. Missing/invalid data never becomes an
// invented percentage or a cached "not charging" state.
#include <cmath>
#include <cstdint>
#include <cstring>
#include <string>
#if defined(__linux__)
#include <fcntl.h>
#include <unistd.h>
#endif

namespace cgs1_power {
enum class Status {UNKNOWN,CHARGING,DISCHARGING,FULL,NOT_CHARGING};
struct Sample {
  float capacity{NAN},voltage{NAN};Status status{Status::UNKNOWN};
  bool status_valid()const{return status!=Status::UNKNOWN;}
  bool charging()const{return status==Status::CHARGING;}
  // "Not charging" alone does not establish the physical power source.
  bool external_known()const{return status==Status::CHARGING || status==Status::FULL || status==Status::DISCHARGING;}
  bool external()const{return status==Status::CHARGING || status==Status::FULL;}
  bool complete()const{return std::isfinite(capacity) && std::isfinite(voltage) && status_valid();}
};
inline bool space(char c){return c==' ' || c=='\t' || c=='\r' || c=='\n';}
inline std::string trimmed(const std::string&text) {
  size_t first=0,last=text.size();
  while(first<last && space(text[first]))++first;
  while(last>first && space(text[last-1]))--last;
  return text.substr(first,last-first);
}
inline bool integer(const std::string&text,uint32_t maximum,uint32_t&out) {
  const auto value=trimmed(text);if(value.empty() || value.size()>10)return false;
  uint64_t parsed=0;
  for(unsigned char c:value) {
    if(c<'0' || c>'9')return false;
    parsed=parsed*10+(c-'0');if(parsed>maximum)return false;
  }
  out=uint32_t(parsed);return true;
}
inline Status status(const std::string&text) {
  const auto value=trimmed(text);
  if(value=="Charging")return Status::CHARGING;
  if(value=="Discharging")return Status::DISCHARGING;
  if(value=="Full")return Status::FULL;
  if(value=="Not charging")return Status::NOT_CHARGING;
  return Status::UNKNOWN;
}
inline const char*label(Status value) {
  switch(value) {
    case Status::CHARGING:return "Charging";
    case Status::DISCHARGING:return "Discharging";
    case Status::FULL:return "Full";
    case Status::NOT_CHARGING:return "Not charging";
    default:return "Unknown";
  }
}
// Pure parsing is separate from Linux I/O so range, malformed input and state
// transitions can be checked without battery hardware or production secrets.
inline Sample parse(const std::string&capacity,const std::string&voltage,
    const std::string&before,const std::string&after) {
  Sample sample;
  if(status(before)!=status(after) || trimmed(before)!=trimmed(after))return sample;
  sample.status=status(after);uint32_t number=0;
  if(integer(capacity,100,number))sample.capacity=float(number);
  if(integer(voltage,5000000,number) && number>=2000000)sample.voltage=float(number)/1000000.0f;
  return sample;
}
inline bool read_node(const char*path,std::string&out) {
#if defined(__linux__)
  // The final node must not be a symlink. The class directory itself is the
  // normal sysfs device link. Bound reads also reject truncated or NUL data.
  const int fd=::open(path,O_RDONLY|O_CLOEXEC|O_NOFOLLOW|O_NONBLOCK);
  if(fd<0)return false;
  char buffer[65];const auto size=::read(fd,buffer,sizeof(buffer));::close(fd);
  if(size<=0 || size>=ssize_t(sizeof(buffer)) || std::memchr(buffer,0,size_t(size)))return false;
  out.assign(buffer,size_t(size));return true;
#else
  (void)path;(void)out;return false;
#endif
}
inline Sample read() {
  std::string capacity,voltage,before,after;
  // Read status on both sides: a charging transition must not combine old
  // source/status metadata with a later sample. The next interval will retry
  // this observation; there is no effect to replay and no persistent cache.
  if(!read_node("/sys/class/power_supply/battery/status",before))return {};
  (void)read_node("/sys/class/power_supply/battery/capacity",capacity);
  (void)read_node("/sys/class/power_supply/battery/voltage_now",voltage);
  if(!read_node("/sys/class/power_supply/battery/status",after))return {};
  return parse(capacity,voltage,before,after);
}
} // namespace cgs1_power
