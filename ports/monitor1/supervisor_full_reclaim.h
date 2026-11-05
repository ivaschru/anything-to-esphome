#pragma once

// Reclaim only the TWO redundant upload copies of a recovered full session
// or a materialized orphan that provably never reached guardian spawn.
// Ordinary reclaim preserves materialized programs. Separate explicit retire
// accepts their exact archived SHA values; receipts/logs always survive.
// No recursive deletion, supplied pathname, shell, process signal or hardware
// operation exists here. The bridge additionally rejects its current job.
#include "supervisor_image.h"
#include <sys/vfs.h>
#include <dirent.h>

namespace cgs1_supervisor {
struct FullReclaim {
  std::string error;uint64_t removed_bytes{0};unsigned removed_files{0};bool unlaunched{false};
  uint64_t retired_bytes{0};unsigned retired_files{0};
  std::array<std::string,2> retired_sha256{};
  // Explicit retirement is distinct from ordinary flat-copy reclaim. The
  // caller must already hold the frozen local release/evidence and supplies
  // its two exact SHA values as CAS. Only a historical inactive RAM bundle
  // can lose these last executable copies; all logs/receipts/directories stay.
  // Results are retained by FullRuntime's read-only status after a lost reply.
  bool retire(const std::string &nonce,const std::string &native_sha,const std::string &guardian_sha,
              const ExecutableSpec &architecture={}) {
    if(nonce.size()!=16 || nonce=="0000000000000000" ||
       nonce.find_first_not_of("0123456789abcdef")!=std::string::npos)return fail_("invalid_full_nonce");
    std::array<Digest,2> expected{};
    if(!parse_digest(native_sha,expected[0]) || !parse_digest(guardian_sha,expected[1]))return fail_("exact_release_hashes_required");
    const auto path="/tmp/qingping-full-"+nonce;
    const int root=::open(path.c_str(),O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
    if(root<0)return fail_("private_full_root_missing");
    struct stat dir{};struct statfs fs{};
    bool okay=!::fstat(root,&dir) && S_ISDIR(dir.st_mode) && dir.st_uid==0 &&
      (dir.st_mode&07777)==0700 && !::fstatfs(root,&fs) && fs.f_type==0x01021994;
    if(!okay){::close(root);return fail_("private_full_tmpfs_root_required");}
    okay=receipt_(root,dir.st_dev) && no_process_(path);
    constexpr const char *DIRS[]{"native","guardian"};
    std::array<ImageDirectory,2> directories;std::array<ImageFile,2> images;
    for(unsigned i=0;okay && i<2;++i) {
      okay=directories[i].open_existing((path+"/"+DIRS[i]).c_str(),0) &&
        directories[i].inspect(images[i],architecture,&expected[i]);
      if(!okay)error="retirement_release_changed";
      else retired_sha256[i]=digest_text(images[i].digest());
    }
    // Check requested reference hashes BEFORE the ordinary reclaim can remove
    // even a redundant upload. A changed user/developer image is preserved.
    if(okay)okay=run(nonce,architecture);
    if(okay)okay=no_process_(path);
    for(unsigned i=0;okay && i<2;++i) {
      const int target=::openat(root,DIRS[i],O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
      struct stat folder{},program{};
      okay=target>=0 && !::fstat(target,&folder) && S_ISDIR(folder.st_mode) &&
        folder.st_uid==0 && folder.st_dev==dir.st_dev && (folder.st_mode&07777)==0700 &&
        !::fstatat(target,"program",&program,AT_SYMLINK_NOFOLLOW) &&
        images[i].matches_executable(program) && !::unlinkat(target,"program",0);
      if(okay){++retired_files;retired_bytes+=uint64_t(program.st_size);}
      if(okay && ::fsync(target))okay=false;
      if(target>=0)::close(target);
      if(!okay)error="retirement_changed_or_unlink_sync_failed";
    }
    if(okay && ::fsync(root))okay=fail_("retirement_directory_sync_failed");
    ::close(root);return okay;
  }
  bool run(const std::string &nonce,const ExecutableSpec &architecture={}) {
    return reclaim_uploads_(nonce,architecture,nullptr);
  }
  // This operation removes ONLY upload duplicates, never materialized ELFs.
  // Unlike completed-session reclaim, it proves a different invariant: both
  // retained executable copies match caller-pinned release hashes, every
  // removable upload matches its retained copy, and no process from this
  // session exists. A recovery receipt is neither manufactured nor inferred.
  // FullRuntime additionally requires a historical job, idle coordinator and
  // fresh fixed-board stock capture before admitting this narrow operation.
  // Logs, plans, preferences, Wi-Fi records and unknown recovery evidence stay.
  bool deduplicate_uploads(const std::string &nonce,const std::string &native_sha,
                           const std::string &guardian_sha,const ExecutableSpec &architecture={}) {
    std::array<Digest,2> expected{};
    if(!parse_digest(native_sha,expected[0]) || !parse_digest(guardian_sha,expected[1]))
      return fail_("exact_retained_release_hashes_required");
    return reclaim_uploads_(nonce,architecture,&expected);
  }
  // Separate CACHE-ONLY release for an inactive pre-effect bundle. It does
  // NOT infer that a failed native recovered hardware, and cannot produce a
  // recovery receipt. Every transaction/effect marker must be absent; all
  // evidence/logs/preferences remain. FullRuntime additionally requires idle
  // state, a historical job, compiled exact hashes and fresh healthy stock.
  // Thus a no-acquire diagnostic may release reproducible executable bytes
  // without relabelling its result or retaining 8 MB forever after each refusal.
  bool purge_inactive_cache(const std::string&nonce,const std::string&native_sha,
                            const std::string&guardian_sha,const ExecutableSpec&architecture={}) {
    if(nonce.size()!=16 || nonce=="0000000000000000" ||
        nonce.find_first_not_of("0123456789abcdef")!=std::string::npos)return fail_("invalid_full_nonce");
    std::array<Digest,2>expected{};
    if(!parse_digest(native_sha,expected[0]) || !parse_digest(guardian_sha,expected[1]))
      return fail_("exact_cache_release_hashes_required");
    const auto path="/tmp/qingping-full-"+nonce;
    const int root=::open(path.c_str(),O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
    if(root<0)return fail_("private_full_root_missing");
    struct stat dir{};struct statfs fs{};
    bool okay=!::fstat(root,&dir) && S_ISDIR(dir.st_mode) && dir.st_uid==0 &&
      (dir.st_mode&07777)==0700 && !::fstatfs(root,&fs) && fs.f_type==0x01021994;
    if(!okay)error="private_full_tmpfs_root_required";
    const auto no_effects=[&]() {
      for(const char*name:{"effects-result","pm-power-armed","brightness-armed",
          "vendor-relaunch-prepared","wifi-transaction.v1"}) {
        struct stat entry{};
        if(!::fstatat(root,name,&entry,AT_SYMLINK_NOFOLLOW) || errno!=ENOENT)
          return fail_("pre_effect_cache_only_required");
      }
      return true;
    };
    okay=okay && no_effects() && no_process_(path);
    constexpr const char*DIRS[]{"native","guardian"};
    std::array<ImageDirectory,2>directories;std::array<ImageFile,2>images;
    for(unsigned i=0;okay && i<2;++i) {
      okay=directories[i].open_existing((path+"/"+DIRS[i]).c_str(),0) &&
        directories[i].inspect(images[i],architecture,&expected[i]);
      if(!okay)error="cache_release_changed";
      else retired_sha256[i]=digest_text(images[i].digest());
    }
    // Existing upload-only validation verifies retained ELF inodes/hashes and
    // redundant copies before any unlink. It manufactures no recovery proof.
    if(okay)okay=deduplicate_uploads(nonce,native_sha,guardian_sha,architecture);
    if(okay)okay=no_effects() && no_process_(path);
    for(unsigned i=0;okay && i<2;++i) {
      const int folder=::openat(root,DIRS[i],O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
      struct stat parent{},program{};
      okay=folder>=0 && !::fstat(folder,&parent) && S_ISDIR(parent.st_mode) &&
        parent.st_uid==0 && parent.st_dev==dir.st_dev && (parent.st_mode&07777)==0700 &&
        !::fstatat(folder,"program",&program,AT_SYMLINK_NOFOLLOW) &&
        images[i].matches_executable(program) && no_effects() && no_process_(path) &&
        !::unlinkat(folder,"program",0);
      if(okay){++retired_files;retired_bytes+=uint64_t(program.st_size);}
      if(okay && ::fsync(folder))okay=false;
      if(folder>=0)::close(folder);
      if(!okay && error.empty())error="cache_changed_or_unlink_sync_failed";
    }
    if(okay && ::fsync(root))okay=fail_("cache_directory_sync_failed");
    ::close(root);return okay;
  }
 private:
  bool reclaim_uploads_(const std::string &nonce,const ExecutableSpec &architecture,
                        const std::array<Digest,2> *retained_release) {
    if(nonce.size()!=16 || nonce=="0000000000000000" ||
       nonce.find_first_not_of("0123456789abcdef")!=std::string::npos)return fail_("invalid_full_nonce");
    const auto path="/tmp/qingping-full-"+nonce;
    const int root=::open(path.c_str(),O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
    if(root<0)return fail_("private_full_root_missing");
    struct stat dir{};struct statfs fs{};
    bool okay=!::fstat(root,&dir) && S_ISDIR(dir.st_mode) && dir.st_uid==0 &&
      (dir.st_mode&07777)==0700 && !::fstatfs(root,&fs) && fs.f_type==0x01021994;
    if(!okay){::close(root);return fail_("private_full_tmpfs_root_required");}
    // A non-null release is available ONLY through deduplicate_uploads. It
    // does not let run()/retire() relax their existing recovery-receipt gate.
    okay=(retained_release || receipt_(root,dir.st_dev)) && no_process_(path);
    // Validate BOTH copies and their retained references before deleting any.
    // The retained image FD pins its inode; ELF/owner/mode/hash validation is
    // the same production implementation used during full materialization.
    std::array<ImageDirectory,2> directories;std::array<ImageFile,2> images;
    std::array<int,2> flat{{-1,-1}};std::array<struct stat,2> metadata{};
    constexpr const char *NAMES[]{"native-program","guardian-program"};
    constexpr const char *DIRS[]{"native","guardian"};
    for(unsigned i=0;okay && i<2;++i) {
      okay=directories[i].open_existing((path+"/"+DIRS[i]).c_str(),0) &&
        directories[i].inspect(images[i],architecture,retained_release?&(*retained_release)[i]:nullptr);
      if(!okay){error="retained_private_elf_required";break;}
      flat[i]=::openat(root,NAMES[i],O_RDONLY|O_NONBLOCK|O_NOFOLLOW|O_CLOEXEC);
      if(flat[i]<0) {
        if(errno==ENOENT)continue; // A prior exact reclaim already removed it.
        okay=fail_("flat_copy_open_refused");break;
      }
      Digest digest{};const auto &m=metadata[i];
      okay=!::fstat(flat[i],&metadata[i]) && S_ISREG(m.st_mode) && m.st_uid==0 &&
        (m.st_mode&07777)==0700 && m.st_nlink==1 && m.st_dev==dir.st_dev &&
        uint64_t(m.st_size)==images[i].identity().bytes && image_hash(flat[i],m.st_size,digest) &&
        digest==images[i].digest();
      if(!okay)error="exact_redundant_private_copy_required";
    }
    if(okay)okay=no_process_(path); // No stale pre-hash liveness conclusion.
    for(unsigned i=0;okay && i<2;++i)if(flat[i]>=0) {
      struct stat actual{};const auto &held=metadata[i];
      okay=!::fstatat(root,NAMES[i],&actual,AT_SYMLINK_NOFOLLOW) &&
        actual.st_ino==held.st_ino && actual.st_dev==held.st_dev && actual.st_mode==held.st_mode &&
        actual.st_uid==held.st_uid && actual.st_nlink==1 && actual.st_size==held.st_size &&
        image_same_timestamp(held,actual) && !::unlinkat(root,NAMES[i],0);
      if(okay){++removed_files;removed_bytes+=uint64_t(held.st_size);}
      else error="flat_copy_changed_or_unlink_failed";
    }
    if(okay && ::fsync(root))okay=fail_("reclaim_directory_sync_failed");
    for(int fd:flat)if(fd>=0)::close(fd);
    ::close(root);return okay;
  }
 private:
  bool fail_(const char *why){error=why;return false;}
  bool receipt_(int root,dev_t device) {
    const int fd=::openat(root,"effects-result",O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC);
    if(fd<0) {
      if(errno!=ENOENT)return fail_("completed_recovery_receipt_required");
      // FullCoordinator creates coordinator.log with O_EXCL BEFORE fork.
      // Its absence plus all fixed side-effect/return markers being absent
      // proves this release never reached guardian/native execution through
      // this port. A failed/active run with a missing receipt is NOT an orphan.
      // Retained private ELF matching and no-process checks still apply.
      for(const char *name:{"coordinator.log","pm-power-armed","brightness-armed","vendor-relaunch-prepared"}) {
        struct stat entry{};
        if(!::fstatat(root,name,&entry,AT_SYMLINK_NOFOLLOW) || errno!=ENOENT)
          return fail_("unlaunched_or_recovered_session_required");
      }
      unlaunched=true;return true;
    }
    constexpr char EXPECTED[]="CGS1_EFFECTS_OK_V1\n";struct stat s{};char text[sizeof(EXPECTED)]{};
    const bool okay=!::fstat(fd,&s) && S_ISREG(s.st_mode) && s.st_uid==0 &&
      s.st_dev==device && s.st_nlink==1 && (s.st_mode&07777)==0600 &&
      s.st_size==ssize_t(sizeof(EXPECTED)-1) && ::read(fd,text,sizeof(text))==ssize_t(sizeof(EXPECTED)-1) &&
      !std::memcmp(text,EXPECTED,sizeof(EXPECTED)-1);
    ::close(fd);return okay || fail_("completed_recovery_receipt_required");
  }
  bool no_process_(const std::string &path) {
    DIR *proc=::opendir("/proc");if(!proc)return fail_("process_inventory_required");
    bool absent=true;unsigned count=0;
    while(const auto *entry=::readdir(proc)) {
      const std::string name=entry->d_name;
      if(name.empty() || name.find_first_not_of("0123456789")!=std::string::npos)continue;
      if(++count>1024){absent=false;break;}
      char value[PATH_MAX]{};const auto n=::readlink(("/proc/"+name+"/exe").c_str(),value,sizeof(value));
      if(n<0){if(errno!=ENOENT && errno!=ESRCH){absent=false;break;}continue;}
      if(n==ssize_t(sizeof(value))){absent=false;break;}
      const std::string executable(value,size_t(n));
      for(const char *suffix:{"/native/program","/guardian/program"})
        if(executable==path+suffix || executable==path+suffix+" (deleted)")absent=false;
      if(!absent)break;
    }
    ::closedir(proc);return absent || fail_("full_session_process_still_present");
  }
};
}  // namespace cgs1_supervisor
