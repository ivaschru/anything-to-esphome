#pragma once

// RK3128 ONLY, fingerprinted CGS1 board. Sources: Rockchip TRM Rev1.0,
// GRF pp182–183 and Linux rk3128.dtsi uart2_xfer. GPIO1C2/3 use function2
// for UART2. Stock PM25API writes 00f000a0 on and 00f00000 off. Highword
// write-enable protects all neighbouring NAND/MMC/JTAG fields: NEVER perform
// an ordinary read/modify/write of the whole register or accept an API address.
#include <cstdint>
#include <cerrno>
#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>
#if defined(__linux__)
#include <sys/mman.h>
#include <sys/sysmacros.h>
#endif

namespace cgs1_pm::pinmux {
inline constexpr uint32_t BASE = 0x20008000, OFFSET = 0xc0;
inline constexpr uint32_t MASK = 0x00f0, UART = 0x00a0, GPIO = 0;
inline constexpr uint32_t command(bool on) { return (MASK << 16) | (on ? UART : GPIO); }
inline bool known(uint32_t value) { return (value & MASK) == GPIO || (value & MASK) == UART; }

class Register {
 public:
  Register() = default;
  Register(const Register &) = delete;
  Register &operator=(const Register &) = delete;
  ~Register() {
#if defined(__linux__)
    if (mapping_ != MAP_FAILED) ::munmap(mapping_, 4096);
    if (fd_ >= 0) ::close(fd_);
#endif
  }
  bool open(bool writable = false) {
#if defined(__linux__)
    if (fd_ >= 0 || ::geteuid() != 0 || ::sysconf(_SC_PAGESIZE) != 4096) return false;
    fd_ = ::open("/dev/mem", (writable ? O_RDWR : O_RDONLY) | O_SYNC | O_NOFOLLOW | O_CLOEXEC);
    struct stat info{};
    if (fd_ < 0 || ::fstat(fd_, &info) || !S_ISCHR(info.st_mode) || info.st_uid != 0 ||
        major(info.st_rdev) != 1 || minor(info.st_rdev) != 1) return false;
    // Mapping a page is required by mmap; only ONE aligned volatile word at
    // offset c0 is accessed. Read-only inspection never maps PROT_WRITE.
    mapping_ = ::mmap(nullptr, 4096, PROT_READ | (writable ? PROT_WRITE : 0), MAP_SHARED, fd_, BASE);
    if (mapping_ == MAP_FAILED) return false;
    word_ = reinterpret_cast<volatile uint32_t *>(static_cast<unsigned char *>(mapping_) + OFFSET);
    writable_ = writable;
    return true;
#else
    (void) writable; return false;
#endif
  }
  bool available() const { return word_ != nullptr; }
  uint32_t read() const { return word_ ? *word_ : 0xffffffffU; }
  bool store(bool on) {
    if (!word_ || !writable_ || !known(read())) return false;
    const uint32_t before = read() & 0xffff;
    *word_ = command(on); // One 32-bit MMIO store, no retry after uncertainty.
    __sync_synchronize();
    const uint32_t after = read() & 0xffff;
    return (after & MASK) == (on ? UART : GPIO) && (after & ~MASK) == (before & ~MASK);
  }
 private:
  int fd_{-1}; bool writable_{false}; volatile uint32_t *word_{nullptr};
#if defined(__linux__)
  void *mapping_{MAP_FAILED};
#endif
};
} // namespace cgs1_pm::pinmux
