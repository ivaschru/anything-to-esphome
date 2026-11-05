#pragma once

// Fixed RAM-trial records. A process exec retains PID/start time; a different
// process/job cannot reuse the original screen brightness by copying a flag.
// No screen/register access lives here, allowing real POSIX regression tests.
#include <cstdint>
#include <cstdio>
#include <string>
#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>
#include <cerrno>

namespace cgs1_trial {
class RelativeDelay {
 public:
  void arm(uint32_t now) {start_=now;armed_=true;}
  bool due(uint32_t now) const {return armed_ && uint32_t(now-start_)>=25000;}
 private:
  uint32_t start_{0};bool armed_{false};
};
inline std::string restart_record(long pid,unsigned long long start) {
  return "CGS1_NORMAL_RESTART_V2 "+std::to_string(pid)+" "+std::to_string(start)+"\n";
}
inline bool restart_matches(const std::string &record,long pid,unsigned long long start) {
  return pid>1 && start && record==restart_record(pid,start);
}
inline std::string read_private(const std::string &path,size_t limit) {
  const int fd=::open(path.c_str(),O_RDONLY|O_NOFOLLOW|O_CLOEXEC|O_NONBLOCK);
  if(fd<0) return {};
  struct stat info{};
  if(::fstat(fd,&info) || !S_ISREG(info.st_mode) || info.st_uid!=::geteuid() ||
     info.st_nlink!=1 || (info.st_mode&0777)!=0600 || info.st_size<1 || uint64_t(info.st_size)>limit) {
    ::close(fd);return {};
  }
  std::string text(size_t(info.st_size),'\0');size_t used=0;
  while(used<text.size()) {
    const ssize_t count=::read(fd,&text[used],text.size()-used);
    if(count<0 && errno==EINTR) continue;
    if(count<=0) {::close(fd);return {};}
    used+=size_t(count);
  }
  ::close(fd);return text;
}
inline bool original_backlight(const std::string &directory,int current,long pid,
                               unsigned long long start,int &original) {
  struct stat parent{};
  if(current<0 || current>1000 || directory.compare(0,23,"/tmp/qingping-takeover-") ||
     directory.find('/',5)!=std::string::npos || ::lstat(directory.c_str(),&parent) ||
     !S_ISDIR(parent.st_mode) || parent.st_uid!=::geteuid() || (parent.st_mode&0777)!=0700) return false;
  const std::string path=directory+"/backlight-before";
  struct stat existing{};
  if(!::lstat(path.c_str(),&existing)) {
    if(!restart_matches(read_private(directory+"/normal-restart-done",128),pid,start)) return false;
    const std::string text=read_private(path,5);
    if(text.size()<2 || text.back()!='\n') return false;
    int value=0;
    for(size_t i=0;i+1<text.size();++i) {
      if(text[i]<'0' || text[i]>'9') return false;
      value=value*10+text[i]-'0';
    }
    if(value>1000) return false;
    original=value;return true;
  }
  if(errno!=ENOENT) return false;
  // Publish complete bytes without overwriting a raced destination. A failed
  // or partial write must never leave a shortened but plausible brightness
  // number for the guardian. This is private RAM, not a stock settings file.
  const std::string temporary=directory+"/backlight-before.partial";
  const int fd=::open(temporary.c_str(),O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);
  if(fd<0) return false;
  const std::string text=std::to_string(current)+"\n";
  const bool written=!::fchmod(fd,0600) && ::write(fd,text.data(),text.size())==ssize_t(text.size()) && !::fsync(fd);
  ::close(fd);
  const bool published=written && !::link(temporary.c_str(),path.c_str());
  ::unlink(temporary.c_str()); // This exact temporary inode was created here.
  if(!published) return false;
  original=current;return true;
}
} // namespace cgs1_trial
