#pragma once

// Fixed native-only persistent placement. This header is used only by the
// explicitly selected durable full profile. The stock-preserving bridge and
// bounded RAM profile never call begin(); no vendor settings are migrated.
#include "native_preferences_snapshot.h"
#include "native_pm_choice.h"
#include "esphome/core/preferences.h"
#include <sys/vfs.h>

#ifdef USE_CGS1_CHECKED_RAM_PREFERENCES
namespace esphome::host {bool cgs1_checked_ram_preferences_active();}
#endif

namespace cgs1_full_state {
class Runtime {
 public:
  inline static constexpr const char *PARENT="/data/.esphome-cgs1";
  inline static constexpr const char *ROOT="/data/.esphome-cgs1/full-state";
  inline static constexpr const char *PREFERENCES="/data/.esphome-cgs1/full-state/prefs";
  inline static constexpr const char *THERMAL="/data/.esphome-cgs1/full-state/thermal";
  bool begin(const std::string &ram_preferences,const std::string &epoch) {
    if(attempted_)return fail_("durable_state_already_attempted");
    attempted_=true;
#ifndef USE_CGS1_CHECKED_RAM_PREFERENCES
    (void)ram_preferences;(void)epoch;
    return fail_("checked_preferences_profile_required");
#else
    if(!esphome::host::cgs1_checked_ram_preferences_active())return fail_("checked_sdk_required");
    if(!cgs1_checkpoint::valid_epoch(epoch.c_str()))return fail_("durable_checkpoint_epoch_required");
    const int parent=::open(PARENT,O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
    struct stat info{};struct statfs filesystem{};
    // /data is the independently verified ext4 volume on this CGS1. Refuse a
    // silently substituted RAM/overlay filesystem rather than claiming that
    // preferences will survive loss of power. No mount or permission repair.
    if(parent<0)return fail_("durable_parent_missing");
    const bool admitted=private_directory_(parent,info) && !::fstatfs(parent,&filesystem) && filesystem.f_type==0xef53;
    const int root=admitted?child_(parent,"full-state",info.st_dev):-1;
    ::close(parent);
    if(root<0)return fail_("private_ext4_state_root_required");
    const int preferences=child_(root,"prefs",info.st_dev),thermal=child_(root,"thermal",info.st_dev);
    if(preferences>=0)::close(preferences);
    if(thermal>=0)::close(thermal);
    ::close(root);
    if(preferences<0 || thermal<0)return fail_("private_state_subdirectories_required");
    if(!snapshot_.begin(PREFERENCES,ram_preferences.c_str(),epoch.c_str()))return fail_(snapshot_.error());
    ready_=true;return true;
#endif
  }
  bool checkpoint() {
    if(!ready_ || !esphome::global_preferences)return fail_("durable_state_not_ready");
    if(!snapshot_.checkpoint(*esphome::global_preferences))return fail_(snapshot_.error());
    error_.clear();return true;
  }
  bool ready() const{return ready_;}
  cgs1_pm_choice::Read read_pm_choice(bool &enabled) {
    bool present=false;size_t size=0;
    if(!ready_ || !snapshot_.setting_size(cgs1_pm_choice::KEY,present,size)) {
      fail_("pm_choice_presence_unavailable");return cgs1_pm_choice::Read::ERROR;
    }
    // Old durable snapshots have no PM key. Their first startup keeps the
    // freshly validated current stock state; it does not invent an OFF/ON.
    if(!present)return cgs1_pm_choice::Read::ABSENT;
    cgs1_pm_choice::Record record{};
    if(size!=record.size() || !pm_preference_() || !pm_preference_value_.load(&record) ||
       !cgs1_pm_choice::decode(record,enabled)) {
      fail_("pm_choice_incompatible_or_corrupt");return cgs1_pm_choice::Read::ERROR;
    }
    pm_choice_present_=true;pm_choice_enabled_=enabled;
    return cgs1_pm_choice::Read::LOADED;
  }
  bool write_pm_choice(bool enabled) {
    const auto record=cgs1_pm_choice::encode(enabled);
    // Called only after the guarded controller acknowledged the requested
    // state. A failed save/checkpoint ends the native session; no success is
    // published and no old durable choice is silently declared updated.
    if(!ready_ || !pm_preference_() || !pm_preference_value_.save(&record))return fail_("pm_choice_cache_save_failed");
    if(!checkpoint())return false;
    pm_choice_present_=true;pm_choice_enabled_=enabled;return true;
  }
  bool pm_choice_present() const{return pm_choice_present_;}
  bool pm_choice_enabled() const{return pm_choice_enabled_;}
  bool restored() const{return snapshot_.restored();}
  uint64_t checkpoints() const{return snapshot_.checkpoints();}
  const std::string &error() const{return error_;}
 private:
  cgs1_preferences::Snapshot snapshot_;bool attempted_{false},ready_{false};std::string error_;
  esphome::ESPPreferenceObject pm_preference_value_;bool pm_preference_ready_{false};
  bool pm_choice_present_{false},pm_choice_enabled_{false};
  bool pm_preference_() {
    if(!pm_preference_ready_) {
      if(!esphome::global_preferences)return false;
      pm_preference_value_=esphome::global_preferences->make_preference<cgs1_pm_choice::Record>(cgs1_pm_choice::KEY);
      pm_preference_ready_=true;
    }
    return true;
  }
  bool fail_(const std::string &why){error_=why;return false;}
  static bool private_directory_(int fd,struct stat &info) {
    return !::fstat(fd,&info) && S_ISDIR(info.st_mode) && info.st_uid==0 && (info.st_mode&07777)==0700;
  }
  static int child_(int parent,const char *name,dev_t device) {
    // mkdir is the only creation primitive, for three compiled names. Existing
    // wrong-mode directories/symlinks are refused. Failed sync leaves evidence
    // intact; no chmod, recursive deletion, parent replacement or shell.
    if(::mkdirat(parent,name,0700) && errno!=EEXIST)return -1;
    const int child=::openat(parent,name,O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
    struct stat info{};
    if(child<0)return -1;
    if(!private_directory_(child,info) || info.st_dev!=device || ::fsync(child) || ::fsync(parent)) {
      ::close(child);return -1;
    }
    return child;
  }
};
}  // namespace cgs1_full_state
