#!/usr/bin/env python3
"""Build only the public, non-operational Lite template.

The generated secrets file contains documented placeholders, not user input.
No network provisioning or firmware upload is performed. Build output remains
ignored; only the audited template and hash are copied into the release ZIP.
Run with the pinned ESPHome interpreter: python tools/build_lite.py.
"""
from pathlib import Path
import base64
import hashlib
import importlib.util
import json
import shutil
import subprocess
import sys

_source_spec = importlib.util.spec_from_file_location("qf_firmware_source", Path(__file__).with_name("firmware_source.py"))
_source_module = importlib.util.module_from_spec(_source_spec)
_source_spec.loader.exec_module(_source_module)
source_digest = _source_module.source_digest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("template_image", ROOT / "custom_components/qingping_esphome/image.py")
image = importlib.util.module_from_spec(spec)
spec.loader.exec_module(image)


def main():
    work = ROOT / ".build/lite-source"
    shutil.copytree(ROOT / "ports/lite", work, dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns("__pycache__", ".esphome", "secrets.yaml"))
    values = {key: value.decode() for key, value in image.SLOTS.items() if key != "noise_psk"}
    release = json.loads((ROOT / "firmware/releases.json").read_text())["lite"]
    values["api_key"] = base64.b64encode(image.SLOTS["noise_psk"]).decode()
    values["wifi_ssid"] = values.pop("ssid")
    # A C++ optimizer can fold strlen("literal") into its ORIGINAL length.
    # Replacing that literal with NUL padding is therefore unsafe for Wi-Fi
    # and OTA strings. Read those dedicated slots through volatile loads and
    # construct new std::strings before Wi-Fi setup. The fixed-size Noise key
    # and exactly 31-byte node name do not have variable-length semantics.
    slots = {key: value for key, value in image.SLOTS.items() if key not in ("name", "noise_psk")}
    header = '#pragma once\n#include <string>\n#include <cstddef>\nnamespace qf_template {\n'
    for key, marker in slots.items():
        header += f'inline const volatile char {key}[] = {json.dumps(marker.decode())};\n'
    header += '''template<std::size_t N> std::string read(const volatile char (&slot)[N]) {
  std::string value;
  for (std::size_t i = 0; i < N - 1; ++i) {
    const char next = slot[i];
    if (!next) break;
    value.push_back(next);
  }
  return value;
}
}  // namespace qf_template
'''
    header += '#include "esphome/components/cgdn1_ui/update_profile.h"\n'
    (work / "public_template_slots.h").write_text(header)
    secrets_values = dict(values)
    for key in ("wifi_ssid", "wifi_password", "ap_password", "ota_password"):
        secrets_values[key] = "public-template-unused"
    (work / "secrets.yaml").write_text("\n".join(key + ": " + json.dumps(value) for key, value in secrets_values.items()) + "\n")
    base_config = work / "cgdn1.yaml"
    text = base_config.read_text()
    assert text.count('  - platform: esphome\n    password:') == 1
    base_config.write_text(text.replace('  - platform: esphome\n    password:', '  - platform: esphome\n    id: template_ota\n    password:'))
    config = f'''# Public placeholders only. Never boot or install this unpersonalized image.
substitutions:
  name: {json.dumps(values['name'])}
  trial_mode: "false"
  ha_display: "false"
packages:
  lite: !include cgdn1.yaml
esphome:
  build_path: {json.dumps(str(ROOT / '.build/lite-app'))}
  compile_process_limit: 2
  includes:
    - public_template_slots.h
  on_boot:
    - priority: 1000
      then:
        - lambda: |-
            wifi::WiFiAP station;
            station.set_ssid(qf_template::read(qf_template::ssid));
            station.set_password(qf_template::read(qf_template::wifi_password));
            id(template_wifi).set_sta(station);
            wifi::WiFiAP access_point;
            access_point.set_ssid(qf_template::read(qf_template::ap_ssid));
            access_point.set_password(qf_template::read(qf_template::ap_password));
            id(template_wifi).set_ap(access_point);
            id(template_ota).set_auth_password(qf_template::read(qf_template::ota_password));
wifi:
  id: template_wifi
  ap:
    ssid: public-template-unused
captive_portal: !remove
api:
  actions:
    - action: qingping_update_profile_v1
      supports_response: only
      variables:
        challenge: string
      then:
        - api.respond:
            data: !lambda |-
              qf_update_profile::respond(root, challenge, qf_template::read(qf_template::ota_password), cgdn1_ui::UI_VERSION, {release["revision"]});
esp32:
  framework:
    sdkconfig_options:
      CONFIG_MBEDTLS_GCM_C: "y"
      CONFIG_MBEDTLS_AES_C: "y"
'''
    (work / "template.yaml").write_text(config)
    subprocess.run([sys.executable, "-m", "esphome", "compile", str(work / "template.yaml")], check=True)
    binary = (ROOT / ".build/lite-app/build/firmware.ota.bin").read_bytes()
    image.layout(binary)
    if release["version"].encode() not in binary:
        raise ValueError("Compiled UI version does not match release metadata")
    counts = {key: binary.count(marker) for key, marker in image.SLOTS.items()}
    if not all(counts.values()):
        raise ValueError("Compiler changed the placeholder contract: " + str(counts))
    # Exercise the exact release personalizer before exporting any template.
    digest = hashlib.sha256(binary).hexdigest()
    test_values = {key: (b"x" * 32 if key == "noise_psk" else "q" * 31 if key == "name" else "example") for key in image.SLOTS}
    image.personalize(binary, test_values, digest)
    output = ROOT / "custom_components/qingping_esphome/firmware"
    output.mkdir(exist_ok=True)
    (output / "lite-template.bin").write_bytes(binary)
    (output / "lite-template.json").write_text(json.dumps({
        "pm_policy": "polling-only-gpio13-high-v1",
        "pm_source_sha256": hashlib.sha256((ROOT / "ports/lite/components/cgdn1_pm/cgdn1_pm.h").read_bytes()).hexdigest(),
        "model": "CGDN1", "ui": release["version"], "font": "Inter (OFL)",
        "esphome": "2026.9.1", "size": len(binary), "sha256": digest,
        "release_source_sha256": source_digest(ROOT),
        "slots": counts, "format": "esp32-app-fixed-slots-v1",
    }, indent=2) + "\n")
    print("Public template validated:", len(binary), "bytes, sha256", digest)


if __name__ == "__main__":
    main()
