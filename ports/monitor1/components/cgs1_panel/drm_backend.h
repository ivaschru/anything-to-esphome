#pragma once

// Exact Linux UAPI backend proven by the earlier CGS1 DRM probe. It does not
// choose arbitrary outputs, replace an OS driver or touch boot partitions.
// Ownership is acquired only after the external guard has retired vendor Qt.
namespace esphome::cgs1_panel {
// Bound only by compiled native bootstrap BEFORE component setup. No network
// action/user preference can supply a callback or turn a path into authority.
struct FullDisplayAuthority {
  bool (*valid)(){nullptr};
  bool (*arm_brightness)(){nullptr};
  int (*original_brightness)(){nullptr};
};
}
#if defined(__linux__)
#include <drm/drm.h>
#include <drm/drm_mode.h>
#include <linux/input.h>
#include <sys/ioctl.h>
#include <sys/mman.h>
#include <fcntl.h>
#include <unistd.h>
#include <signal.h>
#include <cerrno>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <algorithm>
#include <string>
#include "touch_tracker.h"
#include "trial_restart_record.h"

namespace esphome::cgs1_panel {

class DrmBackend {
 public:
  void set_full_display_authority(FullDisplayAuthority value){full_=value;}
  bool open_panel(bool headless=false) {
    const char *prefs=std::getenv("ESPHOME_PREFDIR");
    // A separately compiled render fixture has no UART/I2C/API components.
    // It exercises the production fonts/layout without opening DRM/input,
    // changing brightness or interfering with the running vendor application.
    if(headless) {
      static constexpr const char PREFIX[]="/tmp/qingping-ui-render-";
      return prefs && !std::strncmp(prefs,PREFIX,sizeof(PREFIX)-1);
    }
    const bool full=full_.valid!=nullptr;
    if(full) {
      if(!full_.arm_brightness || !full_.original_brightness || !full_.valid() || !full_.arm_brightness())return false;
    } else if(!prefs || std::strncmp(prefs,"/tmp/qingping-takeover-",23)) return false;
    if(!prefs)return false;
    prefs_=prefs;
    // Full runner already refused any remaining DRM owner. Only legacy
    // bounded trials use their separately snapshotted publisher retirement.
    if(!full)retire_publishers_();
    fd_=::open("/dev/dri/card0",O_RDWR|O_CLOEXEC);
    if(fd_<0)return false;
    drm_get_cap capability{};capability.capability=DRM_CAP_DUMB_BUFFER;
    if(ioctl(fd_,DRM_IOCTL_GET_CAP,&capability) || capability.value!=1)return false;
    bool acquired=false;
    // Reopening matters on Linux3.10: a failed master attempt can retain a
    // reference to departing Qt's master group. Never allocate before success.
    for(int attempt=0;attempt<=80;++attempt) {
      if(!ioctl(fd_,DRM_IOCTL_SET_MASTER,0)){acquired=true;break;}
      if(errno!=EINVAL && errno!=EBUSY)return false;
      ::close(fd_);usleep(100000);fd_=::open("/dev/dri/card0",O_RDWR|O_CLOEXEC);
      if(fd_<0)return false;
    }
    if(!acquired)return false;
    drm_mode_crtc old{};old.crtc_id=4;
    drm_mode_modeinfo modes[8]{};
    drm_mode_get_connector connector{};
    connector.connector_id=11;connector.count_modes=8;connector.modes_ptr=(uintptr_t)modes;
    if(ioctl(fd_,DRM_IOCTL_MODE_GETCRTC,&old) ||
       ioctl(fd_,DRM_IOCTL_MODE_GETCONNECTOR,&connector) || connector.connection!=1 ||
       connector.count_modes!=1 || modes[0].hdisplay!=720 || modes[0].vdisplay!=720)return false;
    drm_mode_create_dumb buffer{};buffer.width=720;buffer.height=720;buffer.bpp=32;
    if(ioctl(fd_,DRM_IOCTL_MODE_CREATE_DUMB,&buffer) || buffer.pitch<2880 ||
       buffer.pitch>8192 || buffer.size<buffer.pitch*720ULL || buffer.size>16*1024*1024)return false;
    pitch_=buffer.pitch;size_=buffer.size;
    drm_mode_fb_cmd framebuffer{};framebuffer.width=720;framebuffer.height=720;
    framebuffer.pitch=buffer.pitch;framebuffer.bpp=32;framebuffer.depth=24;framebuffer.handle=buffer.handle;
    if(ioctl(fd_,DRM_IOCTL_MODE_ADDFB,&framebuffer))return false;
    drm_mode_map_dumb map{};map.handle=buffer.handle;
    if(ioctl(fd_,DRM_IOCTL_MODE_MAP_DUMB,&map))return false;
    mapped_=static_cast<uint8_t *>(mmap(nullptr,size_,PROT_READ|PROT_WRITE,MAP_SHARED,fd_,map.offset));
    if(mapped_==MAP_FAILED){mapped_=nullptr;return false;}
    std::memset(mapped_,0,size_);
    uint32_t selected=11;
    drm_mode_crtc next{};next.set_connectors_ptr=(uintptr_t)&selected;
    next.count_connectors=1;next.crtc_id=4;next.fb_id=framebuffer.fb_id;
    next.mode_valid=1;next.mode=modes[0];
    if(ioctl(fd_,DRM_IOCTL_MODE_SETCRTC,&next))return false;
    input_=::open("/dev/input/event0",O_RDONLY|O_NONBLOCK|O_CLOEXEC);
    if(input_<0)return false;
    if(full)original_brightness_=full_.original_brightness();
    else {
      FILE *file=std::fopen(BRIGHTNESS,"r");
      if(file){if(std::fscanf(file,"%d",&original_brightness_)!=1)original_brightness_=-1;std::fclose(file);}
    }
    if(original_brightness_<0 || original_brightness_>1000)return false;
    // Preserve the first stock brightness across a deliberately fenced exec.
    // Ordinary trials still refuse an unexplained existing recovery record.
    const std::string directory=prefs_.substr(0,prefs_.find_last_of('/'));
    if(!full && !cgs1_trial::original_backlight(directory,original_brightness_,::getpid(),
                                     start_time_(::getpid()),original_brightness_)) return false;
    set_brightness(100);
    std::puts("CGS1_UI panel_ready width=720 height=720 trial_only=1");std::fflush(stdout);
    return true;
  }

  void present(const uint32_t *frame) {
    if(!mapped_)return;
    for(int row=0;row<720;++row)std::memcpy(mapped_+row*pitch_,frame+row*720,2880);
  }

  // Preserve every ordered down/move/up in a kernel batch. Returning only
  // the last coordinates can turn one tap into a drag or lose a release.
  // Read one event at a time; the UI bounds its drain loop per iteration.
  bool poll_touch(TouchTracker::Event &event) {
    input_event raw{};
    for(int count=0;count<64;++count) {
      if(::read(input_,&raw,sizeof(raw))!=sizeof(raw))return false;
      event=touch_.feed_event(raw.type,raw.code,raw.value);
      if(event.phase!=TouchTracker::Phase::NONE)return true;
    }
    return false;
  }

  void set_brightness(int value) {
    value=std::clamp(value,0,1000);
    if(value==brightness_ || original_brightness_<0)return;
    if(full_.valid && (!full_.valid() || !full_.arm_brightness()))std::_Exit(73);
    FILE *file=std::fopen(BRIGHTNESS,"w");
    if(file){std::fprintf(file,"%d\n",value);std::fclose(file);brightness_=value;}
  }
  void close_panel() {
    // Full recovery owns original brightness AFTER native death and under
    // its sole-recovery lock. A native destructor must not race that owner.
    if(!full_.valid && original_brightness_>=0)set_brightness(original_brightness_);
    if(input_>=0){::close(input_);input_=-1;}
    if(mapped_){munmap(mapped_,size_);mapped_=nullptr;}
    if(fd_>=0){ioctl(fd_,DRM_IOCTL_DROP_MASTER,0);::close(fd_);fd_=-1;}
  }
  ~DrmBackend(){close_panel();}

 private:
  static constexpr const char *BRIGHTNESS="/sys/class/backlight/rk28_bl/brightness";
  int fd_{-1},input_{-1},original_brightness_{-1},brightness_{-1};
  uint8_t *mapped_{nullptr};uint32_t pitch_{0};uint64_t size_{0};std::string prefs_;
  TouchTracker touch_;
  FullDisplayAuthority full_{};
  static unsigned long long start_time_(long pid) {
    char path[64],text[2048];std::snprintf(path,sizeof(path),"/proc/%ld/stat",pid);
    FILE *file=std::fopen(path,"r");if(!file)return 0;
    char *read=std::fgets(text,sizeof(text),file);std::fclose(file);if(!read)return 0;
    char *last=std::strrchr(text,')');if(!last || last[1]!=' ')return 0;
    char *save=nullptr,*token=strtok_r(last+2," ",&save);
    for(int field=3;token;++field,token=strtok_r(nullptr," ",&save))
      if(field==22)return std::strtoull(token,nullptr,10);
    return 0;
  }
  static bool same_publisher_(long pid,unsigned long long start) {
    char path[64],exe[512];std::snprintf(path,sizeof(path),"/proc/%ld/exe",pid);
    ssize_t n=readlink(path,exe,sizeof(exe)-1);if(n<0)return false;exe[n]=0;
    return pid>1 && start && !std::strcmp(exe,"/usr/bin/avahi-publish") && start_time_(pid)==start;
  }
  void retire_publishers_() {
    // Only the exact port6868 publishers snapshotted by the guarded host
    // harness may be retired. Qt has already exited; never kill by name.
    FILE *file=std::fopen((prefs_+"/../drm-publishers").c_str(),"r");if(!file)return;
    long pid;unsigned long long start;
    for(int i=0;i<8 && std::fscanf(file,"%ld %llu",&pid,&start)==2;++i) {
      if(!same_publisher_(pid,start))continue;
      kill(pid,SIGTERM);usleep(200000);
      if(same_publisher_(pid,start))kill(pid,SIGKILL);
    }
    std::fclose(file);
  }
};
}  // namespace esphome::cgs1_panel

#else
// macOS can render exactly the same Panel/ESPHome/font code for design QA.
// This backend has no screen, input or brightness implementation and refuses
// non-headless setup. It cannot be used to exercise real CGS1 hardware.
#include <cstdlib>
#include <cstring>
#include <cstdint>
#include <string>
#include <unistd.h>
#include <algorithm>
#include "touch_tracker.h"
namespace esphome::cgs1_panel {
class DrmBackend {
 public:
  void set_full_display_authority(FullDisplayAuthority){}
  bool open_panel(bool headless=false) {
    const char *path=std::getenv("ESPHOME_PREFDIR");
    return headless && path && std::strncmp(path,"/tmp/qingping-ui-render-",23)==0;
  }
  void present(const uint32_t *){}
  bool poll_touch(TouchTracker::Event &){return false;}
  void set_brightness(int){}
  void close_panel(){}
};
}
#endif
