#pragma once

// Fixed, bounded Bluetooth inventory. This never opens UART/HCI/rfkill device
// nodes, creates a Bluetooth socket, loads a module, scans, or changes power.
// Do not add config/argv/environment/key files here: they are not necessary
// to identify the available kernel/vendor stack. A fixture root is an offline
// C++ test seam only; the authenticated API always calls inspect("/").
#include <algorithm>
#include <cctype>
#include <cstdint>
#include <initializer_list>
#include <string>
#include <vector>
#if defined(__linux__)
#include <dirent.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>
#endif

namespace cgs1_bluetooth {
struct Item { std::string kind, node, value; };
struct Inventory {
  bool supported{false}, partial{false};
  std::vector<Item> items;
};
inline bool safe_name(const std::string &name) {
  return !name.empty() && name.size() <= 96 && name != "." && name != ".." &&
      std::all_of(name.begin(), name.end(), [](unsigned char c) {
        return std::isalnum(c) || c == '-' || c == '_' || c == '.' || c == ':' ||
            c == '@' || c == '#' || c == ',';
      });
}
inline bool numbered(const std::string &name, const std::string &prefix) {
  return name.size() > prefix.size() && name.compare(0, prefix.size(), prefix) == 0 &&
      name.find_first_not_of("0123456789", prefix.size()) == std::string::npos;
}
inline Inventory inspect(const std::string &fixture_root = "/") {
  Inventory result;
#if defined(__linux__)
  result.supported = true;
  const std::string base = fixture_root == "/" ? "" : fixture_root;
  auto add = [&](const char *kind, const std::string &node, std::string value) {
    if (result.items.size() >= 256) { result.partial = true; return; }
    // Kernel text is data. Keep printable ASCII only, with explicit length
    // bounds; JSON escaping is still performed by the API serializer.
    for (char &c : value) if (static_cast<unsigned char>(c) < 32 || static_cast<unsigned char>(c) > 126) c = ' ';
    if (value.size() > 192) { value.resize(192); result.partial = true; }
    result.items.push_back({kind, node, value});
  };
  auto read = [&](const std::string &path) {
    // Nonblocking regular/sysfs attributes only. Never read a character device
    // even if an unexpected filesystem entry appears at an allowed path.
    const int fd = ::open((base + path).c_str(), O_RDONLY | O_CLOEXEC | O_NONBLOCK);
    if (fd < 0) return std::string{};
    struct stat st{}; std::string value;
    if (::fstat(fd, &st) == 0 && S_ISREG(st.st_mode)) {
      char data[193]; const ssize_t size = ::read(fd, data, sizeof(data));
      if (size > 0) { value.assign(data, static_cast<size_t>(size)); if (size == ssize_t(sizeof(data))) result.partial = true; }
    }
    ::close(fd); return value;
  };
  auto list = [&](const std::string &path) {
    std::vector<std::string> names;
    DIR *directory = ::opendir((base + path).c_str());
    if (!directory) { add("directory", path, "unavailable"); return names; }
    unsigned seen = 0;
    while (const auto *entry = ::readdir(directory)) {
      const std::string name = entry->d_name;
      if (name == "." || name == "..") continue;
      if (++seen > 512) { result.partial = true; break; }
      if (safe_name(name)) names.push_back(name);
      else result.partial = true;
    }
    ::closedir(directory); std::sort(names.begin(), names.end());
    add("directory", path, "entries=" + std::to_string(names.size()));
    return names;
  };
  auto attrs = [&](const std::string &node, std::initializer_list<const char *> fields) {
    for (const char *field : fields) {
      const std::string value = read(node + "/" + field);
      if (!value.empty()) add("attribute", node + "/" + field, value);
    }
  };
  auto cells = [&](const std::string &path) {
    const auto raw = read(path);
    if (raw.empty()) return;
    if (raw.size() % 4) { result.partial = true; return; }
    std::string numbers;
    for (size_t at = 0; at < raw.size(); at += 4) {
      uint32_t value = 0;
      for (unsigned i = 0; i < 4; ++i) value = (value << 8) | static_cast<unsigned char>(raw[at+i]);
      if (!numbers.empty()) numbers += ',';
      numbers += std::to_string(value);
    }
    add("device_tree_cells", path, numbers);
  };
  for (const auto &name : list("/sys/class/bluetooth")) if (numbered(name, "hci"))
    attrs("/sys/class/bluetooth/" + name, {"name", "type", "address", "uevent"});
  for (const auto &name : list("/sys/class/rfkill")) if (numbered(name, "rfkill"))
    attrs("/sys/class/rfkill/" + name, {"name", "type", "state", "soft", "hard"});
  for (const auto &name : list("/sys/bus/sdio/devices"))
    attrs("/sys/bus/sdio/devices/" + name, {"vendor", "device", "class", "uevent"});
  // The vendor product page mentions USB whereas the published driver tree
  // documents UART. Observe the actual board's USB catalogue too; do not infer
  // the wiring from the shared chip name. Device serial numbers are excluded.
  for (const auto &name : list("/sys/bus/usb/devices"))
    attrs("/sys/bus/usb/devices/" + name, {"idVendor", "idProduct", "bDeviceClass", "product"});
  // Module names expose the installed stack, without copying kernel addresses
  // from /proc/modules or reading firmware/configuration contents.
  for (const auto &name : list("/sys/module")) {
    std::string lower = name;
    std::transform(lower.begin(), lower.end(), lower.begin(), [](unsigned char c) { return std::tolower(c); });
    if (lower.find("bluetooth") != std::string::npos || lower.find("hci") != std::string::npos ||
        lower.find("bt") != std::string::npos || lower.find("brcm") != std::string::npos ||
        lower.find("rtl") != std::string::npos || lower.find("8723") != std::string::npos ||
        lower.find("8189") != std::string::npos) add("module", name, "present");
  }
  for (const char *directory : {"/usr/bin", "/usr/sbin", "/bin", "/sbin", "/data/bin"}) {
    for (const char *name : {"bluetoothd", "btmgmt", "hciconfig", "hcitool", "hciattach", "btattach", "bsa_server", "brcm_patchram_plus", "rtk_hciattach", "hciattach_rtk"}) {
      const std::string path = std::string(directory) + "/" + name;
      struct stat st{};
      if (::lstat((base + path).c_str(), &st) == 0)
        add("tool", path, S_ISREG(st.st_mode) ? "regular" : S_ISLNK(st.st_mode) ? "symlink" : "other");
    }
  }
  for (const char *directory : {"/lib/firmware", "/lib/firmware/rtl_bt", "/lib/firmware/rtlbt"}) {
    for (const auto &name : list(directory)) {
      if (name.find("8723") != std::string::npos || name.find("rtlbt") != std::string::npos)
        add("firmware_entry", std::string(directory) + "/" + name, "present;contents_not_read");
    }
  }
  // Only two documented device-tree labels and non-secret identification
  // properties. No recursive dump of arbitrary firmware/device-tree values.
  for (const char *node : {"/proc/device-tree/wireless-bluetooth", "/proc/device-tree/wireless-wlan"})
    attrs(node, {"compatible", "status", "wifi_chip_type"});
  // Board wiring is separate from the chip's advertised Bluetooth capability.
  // List only relevant top-level DT node labels/properties, never a recursive
  // firmware dump. UART device links and current FD owners help prevent an
  // hciattach experiment from stealing a live CO2/PM/console serial port.
  std::vector<std::string> pinctrl_roots;
  for (const auto &name : list("/proc/device-tree")) {
    if (name == "pinctrl" || name.compare(0,8,"pinctrl@") == 0) {
      if (pinctrl_roots.size() < 3) pinctrl_roots.push_back("/proc/device-tree/" + name);
      else result.partial = true;
      add("device_tree_node", name, "pinctrl_root;read_only");
    }
    if (name.find("bluetooth") != std::string::npos || name.find("rfkill") != std::string::npos ||
        name.find("uart") != std::string::npos || name.find("serial") != std::string::npos ||
        name.find("fiq-debugger") != std::string::npos) {
      add("device_tree_node", name, "present");
      attrs("/proc/device-tree/" + name, {"compatible", "status"});
      if (name.find("fiq-debugger") != std::string::npos) {
        const auto raw = read("/proc/device-tree/" + name + "/rockchip,serial-id");
        if (raw.size() == 4) {
          uint32_t number = 0;
          for (unsigned char byte : raw) number = (number << 8) | byte;
          add("console_uart_id", name, std::to_string(number));
        }
      }
    }
  }
  // Resolve the board's actual UART pinctrl phandles and raw Rockchip cells.
  // This old vendor DT packs each pin into ONE cell (e.g. 0x1b22), unlike
  // modern four-cell tuples. Keep raw values: decoding never grants a write.
  // These are read-only device-tree properties, not memory/register access.
  // Keep the three observed controller paths fixed; no path arrives over API.
  for (const char *node : {"/proc/device-tree/serial@20060000", "/proc/device-tree/serial@20064000",
                           "/proc/device-tree/serial@20068000", "/proc/device-tree/fiq-debugger"}) {
    cells(std::string(node) + "/pinctrl-0");
    cells(std::string(node) + "/pinctrl-1");
  }
  for (const auto &pinctrl_root : pinctrl_roots) for (const auto &name : list(pinctrl_root)) {
    if (name.find("uart") == std::string::npos && name.find("bluetooth") == std::string::npos &&
        name.find("wireless") == std::string::npos) continue;
    const auto parent = pinctrl_root + "/" + name;
    for (const auto &group : list(parent)) {
      const auto node = parent + "/" + group;
      cells(node + "/phandle"); cells(node + "/linux,phandle"); cells(node + "/rockchip,pins");
    }
  }
  {
    // Debugfs only reports the board's GPIO ownership/direction/state. It does
    // not export pins or alter them. Fixed file, no generic register reader.
    const char *path = "/sys/kernel/debug/gpio";
    const int fd = ::open((base + path).c_str(), O_RDONLY | O_NONBLOCK | O_CLOEXEC);
    struct stat st{};
    if (fd >= 0 && ::fstat(fd, &st) == 0 && S_ISREG(st.st_mode)) {
      char bytes[8192]; const auto count = ::read(fd, bytes, sizeof(bytes));
      if (count == ssize_t(sizeof(bytes))) result.partial = true;
      if (count > 0) for (size_t at = 0; at < size_t(count); at += 160)
        add("gpio_ownership", std::string(path) + ":" + std::to_string(at), std::string(bytes+at,std::min(size_t(160),size_t(count)-at)));
    } else add("gpio_ownership", path, "unavailable");
    if (fd >= 0) ::close(fd);
  }
  auto link = [&](const std::string &path) {
    char data[256]; const ssize_t size = ::readlink((base + path).c_str(), data, sizeof(data));
    if (size <= 0) return std::string{};
    if (size == ssize_t(sizeof(data))) { result.partial = true; return std::string{}; }
    return std::string(data, static_cast<size_t>(size));
  };
  for (unsigned port = 0; port < 4; ++port) {
    const std::string node = "/sys/class/tty/ttyS" + std::to_string(port) + "/device/of_node";
    const auto target = link(node);
    if (!target.empty()) add("uart_device_tree", node, target);
    const auto alias = read("/proc/device-tree/aliases/serial" + std::to_string(port));
    if (!alias.empty()) add("uart_alias", "serial" + std::to_string(port), alias);
  }
  const auto consoles = read("/proc/consoles");
  if (!consoles.empty()) add("consoles", "/proc/consoles", consoles);
  // Inspect the console/serial driver without opening a TTY or writing even
  // a module parameter. The vendor source's console_enable is an initial
  // value copied at probe, not a demonstrated runtime UART-release control.
  for (const char *field : {"console_enable", "debug_enable", "no_sleep"}) {
    const auto path = std::string("/sys/module/fiq_debugger/parameters/") + field;
    const auto value = read(path);
    add("fiq_initial_parameter", path, value.empty() ? "unavailable" : value);
  }
  for (const char *driver : {"fiq_debugger", "rk_fiq_debugger", "serial8250", "dw-apb-uart"}) {
    const auto path = std::string("/sys/bus/platform/drivers/") + driver;
    for (const auto &entry : list(path)) {
      // Names only: never dereference bind/unbind or module attributes.
      if (entry != "module" && entry != "uevent") add("serial_driver_entry",path,entry);
    }
  }
  for (const char *name : {"ttyS0", "ttyS1", "ttyS2", "ttyS3", "ttyFIQ0"}) {
    const auto path = std::string("/dev/") + name;
    struct stat st{};
    if (::lstat((base + path).c_str(), &st) == 0) {
      add("tty_node_metadata",path,S_ISCHR(st.st_mode) ? "character;not_opened" :
          S_ISLNK(st.st_mode) ? "symlink;not_opened" : "other;not_opened");
      if (S_ISLNK(st.st_mode)) add("tty_node_link",path,link(path));
    } else add("tty_node_metadata",path,"missing_or_unavailable");
    const auto driver = link(std::string("/sys/class/tty/") + name + "/device/driver");
    if (!driver.empty()) add("tty_driver_link",name,driver);
  }
  {
    // This proc entry exposes UART type/resource/IRQ/counters, not bytes
    // received from the sensors. Bound the whole read before chunking so a
    // truncated first 193 bytes cannot conceal the later console UART row.
    const char *path = "/proc/tty/driver/serial";
    const int fd = ::open((base + path).c_str(), O_RDONLY | O_NONBLOCK | O_CLOEXEC);
    struct stat st{};
    if (fd >= 0 && ::fstat(fd,&st) == 0 && S_ISREG(st.st_mode)) {
      char bytes[4096]; const auto count = ::read(fd,bytes,sizeof(bytes));
      if (count == ssize_t(sizeof(bytes))) result.partial = true;
      if (count > 0) for (size_t at=0;at<size_t(count);at+=160)
        add("serial_driver_status",std::string(path)+":"+std::to_string(at),
            std::string(bytes+at,std::min(size_t(160),size_t(count)-at)));
    } else add("serial_driver_status",path,"unavailable");
    if (fd >= 0) ::close(fd);
  }
  // Board-specific boot provenance: only these fixed read-only vendor code
  // paths, never a caller-selected file, user config, argv or environment.
  // In particular, rkrtkbt may contain an rfkill sequence for a generic BSP;
  // observing it must never execute it or grant permission to reuse its GPIO.
  for (const char *path : {"/usr/bin/rkrtkbt", "/usr/sbin/rkrtkbt", "/bin/rkrtkbt", "/sbin/rkrtkbt",
                           "/etc/init.d/S50_px3se_init"}) {
    struct stat entry{};
    if (::lstat((base + path).c_str(), &entry) != 0) {
      add("stock_bt_code", path, errno == ENOENT ? "missing" : "metadata_unavailable"); continue;
    }
    if (!S_ISREG(entry.st_mode)) {
      add("stock_bt_code", path, S_ISLNK(entry.st_mode) ? "symlink;contents_not_read" : "non_regular;not_read"); continue;
    }
    const int fd = ::open((base + path).c_str(), O_RDONLY | O_CLOEXEC | O_NONBLOCK | O_NOFOLLOW);
    if (fd < 0) { add("stock_bt_code", path, "open_refused"); continue; }
    struct stat st{}; std::string code;
    if (::fstat(fd, &st) == 0 && S_ISREG(st.st_mode) && st.st_size > 0 && st.st_size <= 16384) {
      code.resize(size_t(st.st_size));
      const auto count = ::read(fd, code.data(), code.size());
      if (count != ssize_t(code.size())) { code.clear(); result.partial = true; }
    }
    ::close(fd);
    if (code.empty()) { add("stock_bt_code", path, "unavailable_or_size/type_refused"); continue; }
    if (code.size() >= 4 && code.compare(0,4,"\x7f" "ELF") == 0) {
      add("stock_bt_code",path,"ELF_bytes="+std::to_string(code.size())+";not_executed");
      // Static literals only, without invoking even --help on a vendor tool.
      // The allowlist keeps relevant transport/power/firmware clues and
      // redacts credential-looking literals. This is not disassembly or proof
      // that a particular branch is ever reached on this board.
      for (size_t at=0;at<code.size();) {
        while(at<code.size() && (static_cast<unsigned char>(code[at])<32 || static_cast<unsigned char>(code[at])>126))++at;
        const size_t begin=at;
        while(at<code.size() && static_cast<unsigned char>(code[at])>=32 && static_cast<unsigned char>(code[at])<=126)++at;
        if(at-begin<4)continue;
        const auto text=code.substr(begin,at-begin);auto lower=text;
        std::transform(lower.begin(),lower.end(),lower.begin(),[](unsigned char c){return std::tolower(c);});
        bool relevant=false,sensitive=false;
        for(const char *word:{"/sys/","/dev/","/lib/firmware","hci","rfkill","bluetooth","rtl8723","uart","rkwifi"})
          if(lower.find(word)!=std::string::npos)relevant=true;
        for(const char *word:{"password","passwd","psk","token","secret","private_key"})
          if(lower.find(word)!=std::string::npos)sensitive=true;
        if(relevant && !sensitive)for(size_t offset=0;offset<text.size();offset+=160)
          add("stock_bt_elf_literal",std::string(path)+":"+std::to_string(begin)+":"+std::to_string(offset),text.substr(offset,160));
      }
      continue;
    }
    if (code.compare(0, 2, "#!") != 0) { add("stock_bt_code", path, "non_script;not_executed"); continue; }
    auto lower = code;
    std::transform(lower.begin(), lower.end(), lower.begin(), [](unsigned char c) { return std::tolower(c); });
    bool sensitive = false;
    for (const char *marker : {"password", "passwd", "psk", "token", "secret", "private_key"})
      if (lower.find(marker) != std::string::npos) sensitive = true;
    if (sensitive) { add("stock_bt_code", path, "source_withheld_sensitive_marker"); continue; }
    add("stock_bt_code", path, "script_bytes=" + std::to_string(code.size()) + ";not_executed");
    size_t begin = 0; unsigned line = 1;
    while (begin < code.size()) {
      const auto end = code.find('\n', begin);
      const auto stop = end == std::string::npos ? code.size() : end;
      const auto text = code.substr(begin, stop - begin);
      // Chunk every line, including shell conditions, rather than returning
      // only keyword hits that could hide the meaning of the start sequence.
      for (size_t offset = 0; offset < text.size(); offset += 160)
        add("stock_bt_source", std::string(path) + ":" + std::to_string(line) + ":" + std::to_string(offset), text.substr(offset, 160));
      begin = stop + 1; ++line;
    }
  }
  unsigned descriptors = 0;
  for (const auto &pid : list("/proc")) {
    if (pid.find_first_not_of("0123456789") != std::string::npos) continue;
    DIR *directory = ::opendir((base + "/proc/" + pid + "/fd").c_str());
    if (!directory) continue;  // Process exit during this read is ordinary.
    while (const auto *entry = ::readdir(directory)) {
      const std::string fd = entry->d_name;
      if (fd.empty() || fd.find_first_not_of("0123456789") != std::string::npos) continue;
      if (++descriptors > 8192) { result.partial = true; break; }
      const auto target = link("/proc/" + pid + "/fd/" + fd);
      if (numbered(target, "/dev/ttyS")) {
        add("uart_owner", target, "pid=" + pid + ";comm=" + read("/proc/" + pid + "/comm"));
      }
    }
    ::closedir(directory);
    if (descriptors > 8192) break;
  }
#else
  (void)fixture_root;
#endif
  return result;
}
}  // namespace cgs1_bluetooth
