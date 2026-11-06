# Qingping → ESPHome

**English** · [Русский](README.ru.md)

One project for **Air Monitor Lite, Air Monitor 1 and Air Monitor 2**: firmware
sources, hardware profiles and a shared Home Assistant installer.

**The wizard is experimental.** A complete browser installation was verified
on 6 November 2026 on Lite / CGDN1, stock `4.5.8`, HW `0001`: Bluetooth setup,
local image delivery, ESPHome startup, HA enrollment and live CO₂/T/RH.
This evidence applies to that profile. Monitor 1 ports were tested separately;
Monitor 2 has no verified firmware port yet.

## Compatibility

| Monitor | Platform | Available | Panel installation |
| --- | --- | --- | --- |
| **Lite / CGDN1**, stock 4.5.8, HW 0001 | ESP32 | UI25, display, sensors, settings, encrypted API | **Beta**, Bluetooth → local MQTT/HTTP |
| **Lite / CGDN1**, stock 4.2.1, HW 0001 | ESP32 + MCU | [CG/TLV parser and port research](ports/lite-mcu421/) | In development; no installation image |
| **Monitor 1 / CGS1**, S8, co2_type=2 | Linux ARMv7 | Stock bridge and full UI, hardware-tested | Sources only; separate USB/ADB process |
| **Monitor 1 / CGS1**, SCD40, co2_type=3 | Linux ARMv7 | Separate CO₂ backend, hardware-tested | Sources only; separate USB/ADB process |
| Monitor 1, SCD30 / unknown revision | Linux | Needs verification | Unavailable |
| **Monitor 2** | Not established | Reserved for a separate port | Unavailable |

Images are not interchangeable. Stock 4.2.1 needs its own MCU backend; the
4.5.8 image does not support it. Status checked on 6 November 2026. Monitor 1
software reboot was tested; cold boot and startup without the configured Wi-Fi
network are not claimed to be verified on every profile.

## Install through Marketplace / HACS

1. Open **⋮ → Custom repositories**, add
   `https://github.com/ivaschru/qingping-esphome`, category **Integration**.
2. Install the latest normal **Qingping ESPHome** release (`v0.1.1` or later).
   Showing prereleases is not required. Use the release ZIP: a source checkout
   does not include the compiled firmware template.
3. If already configured in **Settings → Devices & services**, open the panel;
   do not create a second entry. Otherwise choose **Add integration → Qingping
   ESPHome**. The LAN address and ports are selected automatically. Only failed
   address detection requires input. Overrides are available via **Configure**.
4. Open the installer over **HTTPS in Chrome** on Mac, Windows or Android.
   Select Lite, connect USB power and follow the instructions. Mi Home is not
   required. The browser must be near the monitor; HA must reach it on the LAN.

A restart is not mandatory after every new installation. Current Marketplace
can discover new components without one. Follow its restart notice when
present: already loaded Python code keeps running until restarted. See
[Home Assistant Marketplace 2026.11](https://github.com/home-assistant/core/blob/2026.11.0/homeassistant/components/marketplace/repositories/integration.py).

## Language and panel access

These interface changes are in `main` and are not part of the published `v0.1.1` ZIP yet.

Choose **English / Русский** in the wizard. English is the default; the choice
is remembered in this browser only. Changing language preserves the form and
current installation. HA's own configuration dialogs use your HA profile language.

Hide the sidebar item through **Settings → Devices & services → Qingping
ESPHome → Configure → Interface → Show in sidebar**. This does not stop the
installer or restart its MQTT/HTTP listeners.

With the item hidden, open **Settings → Devices & services → Qingping ESPHome
→ installer device → Visit**. The direct path on the same HA is
`/qingping_esphome`. Administrator access is still required.

The **Qingping ESPHome** service device is an installer shortcut, not a
physical monitor. Flashed monitors and their readings belong to the standard
**ESPHome** integration. Older installer versions showing “0 devices” are normal.

## Network and browser requirements

HA and the monitor must reach each other on the LAN. HA Container needs host
networking or an appropriate LAN address with both TCP ports exposed. If the
address belongs to the host outside the container, use host networking: the
HTTP listener binds to that exact address. Do not forward these ports to the
Internet. Defaults are MQTT `1886` and HTTP `1887`; change conflicting ports
in network options. Existing manual settings are preserved.

HTTPS is required by Web Bluetooth. The monitor uses a separate LAN HTTP
listener; HA's SSL configuration does not need to be weakened. Safari, Firefox
and iPhone browsers do not support this Web Bluetooth flow. No HA Bluetooth
adapter is needed: the wizard uses your computer/phone's adapter.

The picker filters names starting with `Qingping`, `CGDN1` or `Air Monitor`.
Other nearby devices are intentionally omitted. An empty picker can mean the
monitor is outside pairing mode or advertises another name; it is not the
operating system's paired-device list. See [Chrome name filters](https://developer.chrome.com/docs/capabilities/bluetooth#name_filter).

## How Lite installation works

The panel reads model, hardware revision, stock version and MAC over Bluetooth.
After your installation command it sends Wi-Fi and temporary installer settings.
HA independently verifies MAC/stock over MQTT and sends **one** OTA command.
The monitor downloads a personalized app over LAN HTTP.

ESPHome is compiled ahead of time in GitHub Actions. HA replaces only reserved
slots in the public template and rebuilds the ESP32 checksum, SHA-256 and
Qingping CRC. Each monitor gets its own name, Noise key, OTA password and
fallback AP. Wi-Fi credentials and keys are never sent to GitHub.

Success requires an encrypted ESPHome connection, matching MAC/name and live
CO₂, temperature and humidity. HA then starts standard ESPHome enrollment;
you can choose the room yourself.

Timeouts never resend OTA automatically. The consumed intent and recovery keys
are saved in private `.storage/qingping_esphome.installations` before sending.
HA restarts do not authorize a retry. Sessions last 15 minutes; personalized
images stay in memory. Keep the browser open during Bluetooth setup. Close a
session only before OTA; after sending, check the monitor and ESPHome first.

Replacing stock firmware can require opening the case after an early boot
failure. USB supplies power, not data. The stock bootloader is preserved, but
no full backup is created and later OTA may overwrite the remaining stock app.

## Development

Sources live in `custom_components/qingping_esphome/` and `ports/`.
`ports/lite/` is UI25, `ports/lite-mcu421/` is research rather than a flashable
image, `ports/monitor1/` contains the S8/SCD40 ports, and `ports/monitor2/` records
unverified status. Use Python 3.13 and the pinned ESPHome environment:

```sh
python -m venv .venv
.venv/bin/pip install -r ports/lite/requirements.txt
.venv/bin/python tools/build_lite.py
.venv/bin/python -m unittest discover -s tests -v
QINGPING_TEST_PYTHON=.venv/bin/python node tests/test_compatibility.mjs
QINGPING_TEST_PYTHON=.venv/bin/python node tests/test_i18n.mjs
.venv/bin/python tools/package_release.py
```

The ZIP is written to `.build/`. Never distribute personalized BIN/ELF,
`secrets.yaml`, backups, logs or private deployments. This unofficial project
is not affiliated with Qingping, Xiaomi or ESPHome.

## Credits

Lite is based on [nemethhh/esphome-qingping-cgdn1](https://github.com/nemethhh/esphome-qingping-cgdn1).
The stock BLE/MQTT flow is described by [bitrate16/qingping](https://github.com/bitrate16/qingping).
Component provenance and licenses are in [NOTICE](NOTICE.md).
