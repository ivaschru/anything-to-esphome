#pragma once

// CGS1 co2_type=3 uses the vendor Linux driver, not the SenseAir UART.
// SnowApp a3901653, CO2SCD40::refreshValue (0x140bb4), reads this exact
// attribute with cat and extracts co2_ppm from its three comma-separated
// fields. Reuse only that measurement interface: never write co2_init,
// scd40_recalibration, ASC, temperature offset or any persistent setting.
#include <cerrno>
#include <cmath>
#include <cstddef>
#include <cstring>
#include <fcntl.h>
#include <string>
#include <sys/stat.h>
#include <unistd.h>
#ifdef __linux__
#include <sys/vfs.h>
#endif

namespace cgs1_scd40 {
struct Reading {
  bool ok{false};
  float co2{NAN};
  std::string error;
  std::string raw;
};

// Strict, bounded grammar. A missing/duplicate field, overflow, error message
// or vendor invalid sentinel must produce unavailable, never a fresh cached
// concentration. T/RH here are SCD40 internals and deliberately do not replace
// the already reviewed external temperature/humidity compensation algorithm.
inline Reading parse(const std::string &raw) {
  Reading out;
  out.raw = raw;
  auto fail = [&](const char *why) { out.error = why; return out; };
  if (raw.empty() || raw.size() > 256) return fail("size");
  for (unsigned char c : raw)
    if ((c < 32 && c != '\n' && c != '\r' && c != '\t') || c > 126)
      return fail("non_ascii");
  const char *keys[] = {"co2_ppm=", "temperature=", "humidity="};
  bool seen[3] = {false, false, false};
  size_t pos = 0;
  for (int part = 0; part < 3; ++part) {
    const auto comma = raw.find(',', pos);
    if ((part < 2) != (comma != std::string::npos)) return fail("fields");
    const size_t end = comma == std::string::npos ? raw.size() : comma;
    size_t start = pos, stop = end;
    while (start < stop && (raw[start] == ' ' || raw[start] == '\t')) ++start;
    while (stop > start && (raw[stop-1] == ' ' || raw[stop-1] == '\n' ||
                           raw[stop-1] == '\r' || raw[stop-1] == '\t')) --stop;
    int field = -1;
    for (int k = 0; k < 3; ++k)
      if (raw.compare(start, std::strlen(keys[k]), keys[k]) == 0) field = k;
    if (field < 0 || seen[field]) return fail("key");
    seen[field] = true;
    start += std::strlen(keys[field]);
    if (start == stop) return fail("empty_value");
    // Vendor's CO2 conversion is decimal QString::toInt. Only decimal digits
    // are accepted here; T/RH may be signed/fractional but must be numeric.
    unsigned value = 0;
    bool digit = false, dot = false;
    for (size_t i = start; i < stop; ++i) {
      const char c = raw[i];
      if (c >= '0' && c <= '9') {
        digit = true;
        if (field == 0) {
          value = value * 10u + unsigned(c - '0');
          if (value > 40000) return fail("co2_range");
        }
      } else if (field != 0 && c == '-' && i == start) {
      } else if (field != 0 && c == '.' && !dot) {
        dot = true;
      } else return fail("number");
    }
    if (!digit) return fail("number");
    if (field == 0) {
      if (value == 0) return fail("co2_not_ready");
      out.co2 = float(value);
    }
    pos = comma == std::string::npos ? raw.size() : comma + 1;
  }
  if (!seen[0] || !seen[1] || !seen[2]) return fail("fields");
  out.ok = true;
  return out;
}

inline Reading read() {
  Reading out;
#ifdef __linux__
  // A fixed read-only sysfs file, with no caller path, shell or arbitrary I2C
  // transaction. Validate filesystem/ownership/type before the first read.
  // O_NOFOLLOW prevents replacement of the final attribute with a symlink.
  const int fd = ::open("/sys/devices/gpio-i2c-co2.30/scd40_read",
                        O_RDONLY | O_CLOEXEC | O_NOFOLLOW | O_NONBLOCK);
  if (fd < 0) { out.error = "open"; return out; }
  struct stat st{};
  struct statfs fs{};
  if (::fstat(fd, &st) || ::fstatfs(fd, &fs) || !S_ISREG(st.st_mode) ||
      st.st_uid != 0 || fs.f_type != 0x62656572) {
    ::close(fd); out.error = "not_root_sysfs_attribute"; return out;
  }
  char buffer[258];
  ssize_t n;
  do { n = ::read(fd, buffer, sizeof(buffer)); } while (n < 0 && errno == EINTR);
  ::close(fd);
  if (n < 1 || n > 256) { out.error = "read"; return out; }
  return parse(std::string(buffer, size_t(n)));
#else
  out.error = "linux_only";
  return out;
#endif
}
}  // namespace cgs1_scd40
