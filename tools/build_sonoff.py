#!/usr/bin/env python3
"""Compile a public S60TPF template, never a household's private configuration.

Use ports/sonoff_s60/requirements.txt. Public fixed slots are personalized
inside the private installation job and again on-device during native OTA.
The source/recipe closure, exact chip/slot, SHA and marker table are retained
in the matching manifest. No upload or firmware publication occurs here.
"""
from pathlib import Path
import base64
import hashlib
import importlib.util
import json
import shutil
import subprocess
import sys
from urllib.error import HTTPError
from urllib.request import build_opener, HTTPRedirectHandler

ROOT = Path(__file__).resolve().parents[1]


def image_module():
    spec = importlib.util.spec_from_file_location("s60_public_image", ROOT / "custom_components/qingping_esphome/sonoff_image.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def source_digest():
    paths = list((ROOT / "ports/sonoff_s60").rglob("*")) + [
        ROOT / "tools/build_sonoff.py", ROOT / "firmware/sonoff-release.json",
        ROOT / "custom_components/qingping_esphome/sonoff_image.py"]
    digest = hashlib.sha256()
    for path in sorted(paths):
        if path.is_symlink():
            raise ValueError("Symlink in public Sonoff source")
        if not path.is_file() or any(part in {".esphome", "__pycache__"} for part in path.parts):
            continue
        if path.name == "secrets.yaml" or path.suffix == ".pyc":
            continue
        name, value = path.relative_to(ROOT).as_posix().encode(), path.read_bytes()
        digest.update(len(name).to_bytes(4, "big") + name)
        digest.update(len(value).to_bytes(8, "big") + value)
    return digest.hexdigest()


def prepare():
    image = image_module()
    release = json.loads((ROOT / "firmware/sonoff-release.json").read_text())
    work = ROOT / ".build/sonoff-source"
    shutil.copytree(ROOT / "ports/sonoff_s60", work, dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns(".esphome", "__pycache__", "secrets.yaml"))
    header = "#pragma once\n#include <string>\n#include <cstdint>\n#include \"esphome/components/time/posix_tz.h\"\nnamespace s60_template {\n"
    for key, marker in image.SLOTS.items():
        if key not in {"name", "noise_psk"}:
            header += f"inline const volatile char {key}[] = {json.dumps(marker.decode())};\n"
    header += """template<std::size_t N> std::string read(const volatile char (&slot)[N]) {
  std::string result;
  for (std::size_t i = 0; i + 1 < N; ++i) { const char c = slot[i]; if (!c) break; result.push_back(c); }
  return result;
}
// WebServerBase retains a pointer, so keep this runtime string alive rather
// than passing the c_str() of a temporary or a constant-folded placeholder.
inline std::string web_password;
// Version-one calendar slot: 32 explicit little-endian bytes, encoded as
// 64 lowercase hex characters. ESPHome 2026.10 uses its parsed global TZ,
// not libc setenv/TZ; preserve future DST transitions across native updates.
inline void configure_timezone() {
  const auto text = read(display_feed_entity);
  if (text.size() != 64) return;
  uint8_t bytes[32]{};
  auto hex = [](char c) -> int { return c >= '0' && c <= '9' ? c - '0' : c >= 'a' && c <= 'f' ? c - 'a' + 10 : -1; };
  for (size_t i = 0; i < 32; ++i) {
    int high = hex(text[i*2]), low = hex(text[i*2+1]);
    if (high < 0 || low < 0) return;
    bytes[i] = uint8_t(high*16 + low);
  }
  auto i32 = [&](size_t i) -> int32_t { return int32_t(uint32_t(bytes[i]) | uint32_t(bytes[i+1])<<8 | uint32_t(bytes[i+2])<<16 | uint32_t(bytes[i+3])<<24); };
  auto rule = [&](size_t i) -> esphome::time::DSTRule {
    return {i32(i), uint16_t(bytes[i+4] | uint16_t(bytes[i+5])<<8),
      esphome::time::DSTRuleType(bytes[i+6]), bytes[i+7], bytes[i+8], bytes[i+9]};
  };
  if (bytes[14] > 3 || bytes[26] > 3) return;
  esphome::time::set_global_tz({i32(0), i32(4), rule(8), rule(20)});
}
}  // namespace s60_template
"""
    (work / "public_template_slots.h").write_text(header)
    secrets = {"api_key": base64.b64encode(image.SLOTS["noise_psk"]).decode(),
               "ota_password": "unused-public-template", "ap_password": "unused-public-template",
               "timezone": "UTC"}
    (work / "secrets.yaml").write_text("\n".join(f"{key}: {json.dumps(value)}" for key, value in secrets.items()) + "\n")
    config = f"""# Public placeholders. Do not boot an unpersonalized template.
substitutions:
  name: {json.dumps(image.SLOTS['name'].decode())}
packages:
  sonoff: !include sonoff_s60.yaml
esphome:
  comment: "Public S60TPF source {source_digest()}"
  build_path: {json.dumps(str(ROOT / '.build/sonoff-app'))}
  compile_process_limit: 2
  includes:
    - public_template_slots.h
  build_flags:
    - {json.dumps('-ffile-prefix-map=' + str(ROOT) + '=/source')}
    - {json.dumps('-fmacro-prefix-map=' + str(ROOT) + '=/source')}
  on_boot:
    - priority: 1001
      then:
        - lambda: |-
            id(imprinted_ssid) = s60_template::read(s60_template::ssid);
            id(imprinted_password) = s60_template::read(s60_template::wifi_password);
            s60_template::configure_timezone();
            wifi::WiFiAP sta;
            sta.set_ssid(id(imprinted_ssid)); sta.set_password(id(imprinted_password));
            id(template_wifi).set_sta(sta);
            wifi::WiFiAP ap;
            ap.set_ssid(s60_template::read(s60_template::ap_ssid));
            ap.set_password(s60_template::read(s60_template::ap_password));
            id(template_wifi).set_ap(ap);
            s60_template::web_password = s60_template::read(s60_template::ota_password);
            web_server_base::global_web_server_base->set_auth_password(s60_template::web_password.c_str());
            id(native_firmware).set_credentials(s60_template::web_password,
              s60_template::read(s60_template::source_stock_version),
              s60_template::read(s60_template::display_feed_entity));
            id(native_firmware).set_ui([]() {{ return true; }}, []() {{}}, [](float) {{}}, [](bool) {{}});
external_components:
  - source:
      type: local
      path: components
    components: [s60_native_update]
http_request:
  id: firmware_http
  verify_ssl: true
  follow_redirects: false
  timeout: 15s
update:
  - platform: s60_native_update
    id: native_firmware
    name: Firmware
    entity_category: config
    http_request_id: firmware_http
    profile: sonoff-s60tpf
    revision: {release['revision']}
    public_version: {release['public_version']}
    update_interval: 6h
wifi:
  id: template_wifi
esp32:
  framework:
    sdkconfig_options:
      CONFIG_MBEDTLS_DYNAMIC_BUFFER: "y"
      CONFIG_MBEDTLS_SSL_OUT_CONTENT_LEN: "1024"
esp32_ble:
  id: ble_runtime
  enable_on_boot: false
esp32_ble_tracker:
  id: ble_scanner
  scan_parameters:
    continuous: false
    interval: 320ms
    window: 30ms
bluetooth_proxy:
  active: true
  connection_slots: 1
switch:
  - platform: template
    id: bluetooth_enabled
    name: Bluetooth Proxy
    optimistic: true
    restore_mode: RESTORE_DEFAULT_OFF
    entity_category: config
    turn_on_action:
      - lambda: id(ble_runtime).enable();
      - esp32_ble_tracker.start_scan:
          continuous: true
    turn_off_action:
      - esp32_ble_tracker.stop_scan:
      - lambda: id(ble_runtime).disable();
text_sensor:
  - platform: template
    name: Firmware update status
    entity_category: diagnostic
    update_interval: 30s
    lambda: return id(native_firmware).diagnostic();
"""
    target = work / "template.yaml"
    target.write_text(config)
    return target


def main():
    config = prepare()
    if "--prepare-only" in sys.argv:
        print(config)
        return
    if "--reuse-published" in sys.argv and reuse_published():
        return
    subprocess.run([sys.executable, "-m", "esphome", "compile", str(config)], check=True)
    binary = (ROOT / ".build/sonoff-app/build/firmware.ota.bin").read_bytes()
    image_module().layout(binary)
    release = json.loads((ROOT / "firmware/sonoff-release.json").read_text())
    manifest = {**release, "sha256": hashlib.sha256(binary).hexdigest(), "size": len(binary),
                "chip": "ESP32-C3", "slot_size": 0x1F0000, "source_sha256": source_digest(),
                "native_update": {"format": "anything-native-update-v1", "patches": image_module().patch_table(binary)}}
    output = ROOT / "custom_components/qingping_esphome/firmware"
    output.mkdir(exist_ok=True)
    (output / "sonoff-s60tpf-template.bin").write_bytes(binary)
    (output / "sonoff-s60tpf-template.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print("Validated public ESP32-C3 S60TPF template:", manifest["size"], manifest["sha256"])


def reuse_published():
    """Reuse an immutable source-matched pair instead of changing build time.

    A positively absent *current* tag permits the first build. Network errors,
    another source closure under an existing counter, or damaged artifacts
    never choose another version or overwrite its bytes.
    """
    release = json.loads((ROOT / "firmware/sonoff-release.json").read_text())
    prefix = ("https://raw.githubusercontent.com/ivaschru/anything-to-esphome/"
              f"firmware-sonoff-s60tpf-v{release['public_version']}/sonoff-s60tpf-template.")
    class NoRedirect(HTTPRedirectHandler):
        def redirect_request(self, *args):
            return None
    opener = build_opener(NoRedirect)
    try:
        with opener.open(prefix + "json", timeout=45) as response:
            manifest_bytes = response.read(65537)
    except HTTPError as error:
        if error.code == 404:
            return False
        raise
    if len(manifest_bytes) > 65536:
        raise ValueError("Oversized S60TPF manifest")
    manifest = json.loads(manifest_bytes)
    if (manifest.get("source_sha256") != source_digest()
            or any(manifest.get(key) != value for key, value in release.items())):
        raise ValueError("Changed S60TPF source needs a new firmware counter")
    with opener.open(prefix + "bin", timeout=45) as response:
        binary = response.read(0x1F0001)
    image = image_module()
    if (len(binary) != manifest["size"] or hashlib.sha256(binary).hexdigest() != manifest["sha256"]
            or manifest.get("native_update", {}).get("patches") != image.patch_table(binary)):
        raise ValueError("S60TPF immutable app mismatch")
    output = ROOT / "custom_components/qingping_esphome/firmware"
    output.mkdir(exist_ok=True)
    (output / "sonoff-s60tpf-template.bin").write_bytes(binary)
    (output / "sonoff-s60tpf-template.json").write_bytes(manifest_bytes)
    print("Reused exact source-matched S60TPF firmware and manifest")
    return True


if __name__ == "__main__":
    main()
