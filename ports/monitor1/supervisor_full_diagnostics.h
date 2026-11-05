#pragma once

// Post-mortem reads only: a strict nonce selects our fixed private tmpfs root.
// No path/file selector, command execution, directory scan or recovery write
// is exposed. This also works after a maintenance-bridge OTA, when the old
// coordinator C++ object is gone but its RAM evidence must remain readable.
#include <array>
#include <cstdint>
#include <string>
#include <sys/stat.h>
#include <sys/vfs.h>
#include <fcntl.h>
#include <unistd.h>
#include <cerrno>
#include <algorithm>

namespace cgs1_supervisor {
struct FullDiagnosticFile {
  const char *name;std::string text;std::string error;
  uint64_t bytes{0};bool present{false},truncated{false};
  uint64_t inode{0},device{0};
  int64_t mtime_seconds{0},mtime_nanoseconds{0},ctime_seconds{0},ctime_nanoseconds{0};
};
struct FullDiagnosticPage {
  unsigned file_index{0},page_index{0},page_count{0};uint64_t tail_offset{0};
  // Hex has a fixed 2:1 expansion and no JSON control/UTF-8 ambiguity. One
  // 1024-byte page stays safely below the pinned SDK's 5119-byte JSON ceiling.
  std::string hex_data;
};
struct FullDiagnostics {
  static constexpr size_t TAIL_BYTES=8192,PAGE_BYTES=1024;
  std::string error;
  std::array<FullDiagnosticFile,5> files{{{"coordinator.log",{},{}},
    {"effects-result",{},{}},{"pm-power-armed",{},{}},
    {"brightness-armed",{},{}},{"vendor-relaunch-prepared",{},{}}}};
  bool read(const std::string &nonce) {
    // Enforce the exact staging grammar before constructing any pathname.
    if(nonce.size()!=16 || nonce=="0000000000000000" ||
       nonce.find_first_not_of("0123456789abcdef")!=std::string::npos)
      return fail_("invalid_full_nonce");
    const auto path="/tmp/qingping-full-"+nonce;
    const int root=::open(path.c_str(),O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
    struct stat dir{};struct statfs fs{};
    if(root<0)return fail_("private_full_root_missing");
    const bool private_root=!::fstat(root,&dir) && S_ISDIR(dir.st_mode) && dir.st_uid==0 &&
      (dir.st_mode&07777)==0700 && !::fstatfs(root,&fs) && fs.f_type==0x01021994;
    if(!private_root){::close(root);return fail_("private_full_tmpfs_root_required");}
    for(auto &item:files)read_file_(root,dir.st_dev,item);
    ::close(root);return true;
  }
  bool page(int file_index,int page_index,FullDiagnosticPage &result) const {
    if(file_index<0 || file_index>=int(files.size()) || page_index<0)return false;
    const auto &file=files[size_t(file_index)];
    if(!file.present || !file.error.empty())return false;
    const auto count=(file.text.size()+PAGE_BYTES-1)/PAGE_BYTES;
    if(size_t(page_index)>=count)return false;
    FullDiagnosticPage selected;
    selected.file_index=unsigned(file_index);selected.page_index=unsigned(page_index);
    selected.page_count=unsigned(count);selected.tail_offset=file.bytes-file.text.size();
    const auto begin=size_t(page_index)*PAGE_BYTES,end=std::min(file.text.size(),begin+PAGE_BYTES);
    constexpr char digits[]="0123456789abcdef";
    selected.hex_data.reserve((end-begin)*2);
    for(size_t i=begin;i<end;++i) {
      const auto byte=static_cast<unsigned char>(file.text[i]);
      selected.hex_data+=digits[byte>>4];selected.hex_data+=digits[byte&15];
    }
    result=std::move(selected);return true;
  }
 private:
  bool fail_(const char *why){error=why;return false;}
  static void read_file_(int root,dev_t device,FullDiagnosticFile &item) {
    const int fd=::openat(root,item.name,O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC);
    if(fd<0){if(errno!=ENOENT)item.error="diagnostic_open_refused";return;}
    struct stat before{},after{};
    if(::fstat(fd,&before) || !S_ISREG(before.st_mode) || before.st_uid!=0 ||
       before.st_nlink!=1 || before.st_dev!=device || (before.st_mode&07777)!=0600 ||
       before.st_size<0){item.error="private_regular_diagnostic_required";::close(fd);return;}
    item.present=true;item.bytes=uint64_t(before.st_size);
    item.inode=uint64_t(before.st_ino);item.device=uint64_t(before.st_dev);
    item.mtime_seconds=before.st_mtim.tv_sec;item.mtime_nanoseconds=before.st_mtim.tv_nsec;
    item.ctime_seconds=before.st_ctim.tv_sec;item.ctime_nanoseconds=before.st_ctim.tv_nsec;
    // Read the bounded tail, without changing a shared file offset. An active
    // writer is reported as unstable rather than mixed into a false snapshot.
    const size_t length=size_t(std::min<uint64_t>(item.bytes,TAIL_BYTES));
    item.truncated=item.bytes>TAIL_BYTES;item.text.resize(length);
    size_t done=0;
    while(done<length) {
      const auto count=::pread(fd,&item.text[done],length-done,off_t(item.bytes-length+done));
      if(count<0 && errno==EINTR)continue;
      if(count<=0){item.error="diagnostic_read_incomplete";break;}
      done+=size_t(count);
    }
    if(::fstat(fd,&after) || after.st_size!=before.st_size || after.st_mtime!=before.st_mtime ||
       after.st_ctime!=before.st_ctime || after.st_mtim.tv_nsec!=before.st_mtim.tv_nsec ||
       after.st_ctim.tv_nsec!=before.st_ctim.tv_nsec)item.error="diagnostic_changed_during_read";
    ::close(fd);
    if(!item.error.empty())item.text.clear();
  }
};
}  // namespace cgs1_supervisor
