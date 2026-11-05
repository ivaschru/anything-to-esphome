#pragma once

// Fixed immutable vendor glibc executable for OFFLINE code review only. Diagnostic code-file reader only. No
// configuration, process memory, PSK getter, execution, --help or log setter.
// Production always uses /lib/libc-2.23.so on a verified read-only mount;
// fixture_root is used only by isolated synthetic filesystem tests, never API.
// 1792-byte pages keep hex plus metadata below the SDK 5120-byte JSON ceiling.
#include <algorithm>
#include <cstdint>
#include <string>
#include <vector>
#if defined(__linux__)
#include <cerrno>
#include <fcntl.h>
#include <openssl/evp.h>
#include <sys/stat.h>
#include <sys/statvfs.h>
#include <sys/vfs.h>
#include <unistd.h>
#endif

namespace cgs1_libc_vendor {
struct VendorProgram {
  bool verified{false};
  std::vector<unsigned char> bytes;
  std::string sha256,error;
  uint64_t filesystem_type{0},filesystem_flags{0};
  int statfs_error{0},statvfs_error{0};
  uint64_t file_device{0},file_inode{0};
  static constexpr size_t PAGE_BYTES=1792,MAX_BYTES=4*1024*1024;
  size_t pages()const{return verified?(bytes.size()+PAGE_BYTES-1)/PAGE_BYTES:0;}
  std::string page_hex(size_t index)const {
    if(index>=pages())return {};
    const size_t start=index*PAGE_BYTES,stop=std::min(start+PAGE_BYTES,bytes.size());
    static constexpr char HEX[]="0123456789abcdef";std::string result;
    result.reserve((stop-start)*2);
    for(size_t at=start;at<stop;++at){result+=HEX[bytes[at]>>4];result+=HEX[bytes[at]&15];}
    return result;
  }
};

inline bool vendor_readonly_filesystem(bool statfs_ok,uint64_t type,bool statvfs_ok,uint64_t flags) {
  // SquashFS is intrinsically read-only. Linux v3.10 fs/squashfs/super.c
  // explicitly ORs MS_RDONLY in fill_super/remount and reports its magic.
  // Treating its verified type as evidence does not remount or relax a writer.
  // Unknown/writable filesystems still require a successful read-only flag.
  return (statfs_ok && type==0x73717368u) || (statvfs_ok && (flags&1u));
}

inline VendorProgram read_libc(const std::string &fixture_root="/") {
  VendorProgram result;
#if defined(__linux__)
  struct Descriptor {
    int fd{-1};
    explicit Descriptor(int value):fd(value){}
    ~Descriptor(){if(fd>=0)::close(fd);}
    Descriptor(const Descriptor&)=delete;
    Descriptor& operator=(const Descriptor&)=delete;
  };
  const bool fixture=fixture_root!="/";
  auto directory_ok=[](int fd){
    struct stat st{};
    return fd>=0 && !::fstat(fd,&st) && S_ISDIR(st.st_mode) && st.st_uid==0 && !(st.st_mode&0022);
  };
  Descriptor root(::open(fixture_root.c_str(),O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC));
  if(!directory_ok(root.fd)){result.error="vendor_root_refused";return result;}
  Descriptor bin(::openat(root.fd,"lib",O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC));
  if(!directory_ok(bin.fd)){result.error="vendor_bin_refused";return result;}
  Descriptor file(::openat(bin.fd,"libc-2.23.so",O_RDONLY|O_NONBLOCK|O_NOFOLLOW|O_CLOEXEC));
  struct stat before{},after{},entry{},parent{};struct statvfs filesystem{};struct statfs kernel_fs{};
  if(file.fd<0 || ::fstat(file.fd,&before) || ::fstat(bin.fd,&parent) ||
      !S_ISREG(before.st_mode) || before.st_uid!=0 || (before.st_mode&0022) ||
      before.st_nlink!=1 || before.st_dev!=parent.st_dev || before.st_size<52 ||
      before.st_size>ssize_t(VendorProgram::MAX_BYTES)) {
    result.error="vendor_private_regular_elf_required";return result;
  }
  // The fixture skips only the mount's read-only flag. All path/type/owner/
  // mode/inode/ELF checks still run inside its isolated synthetic tree.
  errno=0;const bool vfs_ok=::fstatvfs(file.fd,&filesystem)==0;
  result.statvfs_error=vfs_ok?0:errno;result.filesystem_flags=vfs_ok?uint64_t(filesystem.f_flag):0;
  errno=0;const bool fs_ok=::fstatfs(file.fd,&kernel_fs)==0;
  result.statfs_error=fs_ok?0:errno;result.filesystem_type=fs_ok?uint64_t(uint32_t(kernel_fs.f_type)):0;
  if(!fixture && !vendor_readonly_filesystem(fs_ok,result.filesystem_type,vfs_ok,result.filesystem_flags)) {
    result.error="vendor_read_only_mount_required";return result;
  }
  std::vector<unsigned char> data(size_t(before.st_size));size_t done=0;
  while(done<data.size()) {
    const auto count=::read(file.fd,data.data()+done,data.size()-done);
    if(count<0 && errno==EINTR)continue;
    if(count<=0){result.error="vendor_short_read";return result;}
    done+=size_t(count);
  }
  auto same=[](const struct stat&a,const struct stat&b){
    return a.st_dev==b.st_dev && a.st_ino==b.st_ino && a.st_mode==b.st_mode &&
      a.st_uid==b.st_uid && a.st_gid==b.st_gid && a.st_nlink==b.st_nlink && a.st_size==b.st_size &&
      a.st_mtim.tv_sec==b.st_mtim.tv_sec && a.st_mtim.tv_nsec==b.st_mtim.tv_nsec &&
      a.st_ctim.tv_sec==b.st_ctim.tv_sec && a.st_ctim.tv_nsec==b.st_ctim.tv_nsec;
  };
  if(::fstat(file.fd,&after) || ::fstatat(bin.fd,"libc-2.23.so",&entry,AT_SYMLINK_NOFOLLOW) ||
      !same(before,after) || !same(after,entry)) {
    result.error="vendor_inode_changed";return result;
  }
  // Linux ARMv7 little-endian ELF32, ET_EXEC/ET_DYN only. An arbitrary script
  // or a replaced data/configuration file never becomes a downloadable blob.
  const auto u16=[&](size_t at){return unsigned(data[at])|(unsigned(data[at+1])<<8);};
  if(data[0]!=0x7f || data[1]!='E' || data[2]!='L' || data[3]!='F' ||
      data[4]!=1 || data[5]!=1 || data[6]!=1 || (u16(16)!=2 && u16(16)!=3) || u16(18)!=40) {
    result.error="vendor_arm32_elf_required";return result;
  }
  unsigned char digest[32]{};unsigned length=0;
  if(EVP_Digest(data.data(),data.size(),digest,&length,EVP_sha256(),nullptr)!=1 || length!=32) {
    result.error="vendor_digest_failed";return result;
  }
  static constexpr char HEX[]="0123456789abcdef";
  for(auto byte:digest){result.sha256+=HEX[byte>>4];result.sha256+=HEX[byte&15];}
  result.file_device=uint64_t(before.st_dev);result.file_inode=uint64_t(before.st_ino);
  result.bytes=std::move(data);result.verified=true;
#else
  (void)fixture_root;result.error="vendor_verified_linux_required";
#endif
  return result;
}
} // namespace cgs1_libc_vendor
