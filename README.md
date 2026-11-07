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

Monitor 1 also has a separate experimental [USB app](apps/monitor1_usb/):
choose computer WebUSB or server USB for private capture/profile/builds.
Server USB additionally offers a reviewed stock-bridge installation and a
separate post-boot check. A private computer ADB installer can be downloaded
after building; it runs on macOS/Linux without a local compiler or VM. First
installation on a physical factory CGS1 is still unverified; browser-only
WebUSB writing and full native UI installation remain unfinished. This does
not change ordinary HACS admission in the table below.

See the [Monitor 1 USB instructions](apps/monitor1_usb/README.md)
([Russian walkthrough](apps/monitor1_usb/README.ru.md)) for both cable locations.

| Monitor | Platform | Available | Panel installation |
| --- | --- | --- | --- |
| **Lite / CGDN1**, stock 4.5.8, HW 0001 | ESP32 | UI25, display, sensors, settings, encrypted API | **Beta**, Bluetooth → local MQTT/HTTP |
| **Lite / CGDN1**, stock 4.2.1, HW 0001 | ESP32 + MCU | [CG/TLV parser and port research](ports/lite-mcu421/) | In development; no installation image |
| **Monitor 1 / CGS1**, S8, co2_type=2 | Linux ARMv7 | Stock bridge and full UI, hardware-tested | [Runtime 1 source kit](docs/MONITOR1_RELEASES.md); private local build, no automatic installer |
| **Monitor 1 / CGS1**, SCD40, co2_type=3 | Linux ARMv7 | Separate CO₂ backend, hardware-tested | [Runtime 1 source kit](docs/MONITOR1_RELEASES.md); private local build, no automatic installer |
| Monitor 1, SCD30 / unknown revision | Linux | Needs verification | Unavailable |
| **Monitor 2** | Not established | Reserved for a separate port | Unavailable |

Images are not interchangeable. Stock 4.2.1 needs its own MCU backend; the
4.5.8 image does not support it. Status checked on 6 November 2026. Monitor 1
software reboot was tested; cold boot and startup without the configured Wi-Fi
network are not claimed to be verified on every profile.

## Install through Marketplace / HACS

1. Open **⋮ → Custom repositories**, add
   `https://github.com/ivaschru/qingping-esphome`, category **Integration**.
2. Install the latest normal **Qingping ESPHome** release (`v0.1.2` or later).
   Showing prereleases is not required. Use the release ZIP: a source checkout
   does not include the compiled firmware template.
3. If already configured in **Settings → Devices & services**, open the panel;
   do not create a second entry. Otherwise choose **Add integration → Qingping
   ESPHome**. The LAN address and ports are selected automatically. Only failed
   address detection requires input. Overrides are available via **Configure**.
4. Open the installer, select Lite, connect USB power and choose **Use Bluetooth
   from → This computer / phone** or **Home Assistant**. Mi Home is not required.
   The first route needs Chrome over HTTPS near the monitor; the HA route needs
   HA's adapter or an active Bluetooth proxy near it. HA must reach it on the LAN.

Bluetooth-source selection is available in **v0.1.2**. The Home Assistant route
has SDK/protocol tests; a complete hardware installation through it is still
pending. The previously verified installation used the browser route.

A restart is not mandatory after every new installation. Current Marketplace
can discover new components without one. Follow its restart notice when
present: already loaded Python code keeps running until restarted. See
[Home Assistant Marketplace 2026.11](https://github.com/home-assistant/core/blob/2026.11.0/homeassistant/components/marketplace/repositories/integration.py).

## Language and panel access

These interface options are available in **v0.1.2** and later.

Choose **English / Русский** in the wizard. English is the default; the choice
is remembered in this browser only. Changing language preserves the form and
current installation. HA's own configuration dialogs use your HA profile language.

Use **Page settings** beside the language picker → **Show in sidebar**, or open
**Settings → Devices & services → Qingping
ESPHome → Configure → Interface → Show in sidebar**. This does not stop the
installer or restart its MQTT/HTTP listeners. Both controls change the same
HA setting; it takes effect immediately and is retained after restart.

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

**This computer / phone** uses Web Bluetooth: Chrome over HTTPS on Mac, Windows
or Android, with this device near the monitor. Safari, Firefox and iPhone do
not support this route. No HA Bluetooth adapter is required for it.

**Home Assistant** uses HA's shared Bluetooth integration. It can connect through
a local adapter or a compatible proxy with **active GATT connections**, such as
an ESPHome Bluetooth proxy with active connections enabled. HA chooses the
reachable connectable adapter; a passive advertisement-only proxy cannot provision
the monitor. The browser needs no Bluetooth or Web Bluetooth, so this mode can
also be used from Safari, Firefox, iPhone or a computer without Bluetooth. The
monitor must be near HA's adapter/proxy, not the browser. See the
[HA Bluetooth API](https://developers.home-assistant.io/docs/core/bluetooth/api/).

HTTPS is a Web Bluetooth requirement only for the browser route; HA mode uses
the normal authenticated HA connection. Keep the usual secure remote access.
The monitor uses a separate LAN HTTP listener; HA's SSL configuration does not
need to be weakened.

The picker filters names starting with `Qingping`, `CGDN1` or `Air Monitor`.
Other nearby devices are intentionally omitted. An empty picker can mean the
monitor is outside pairing mode or advertises another name; it is not the
operating system's paired-device list. See [Chrome name filters](https://developer.chrome.com/docs/capabilities/bluetooth#name_filter).

## How Lite installation works

The chosen Bluetooth route reads model, hardware revision, stock version and MAC.
HA selection releases the connection after reading; installation reconnects and
checks the complete identity again before writing. Selections expire after five
minutes and belong to the selecting HA administrator. HA uses the same three
advertised-name prefixes as the browser picker.
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
images stay in memory. Keep the browser open during setup. HA-side setup is
bounded and never automatically repeated after a lost browser connection. It
does not arm OTA by itself; check session status before continuing. Close a
session only before OTA; after sending, check the monitor and ESPHome first.

Replacing stock firmware can require opening the case after an early boot
failure. USB supplies power, not data. The stock bootloader is preserved, but
no full backup is created and later OTA may overwrite the remaining stock app.

## Independent firmware releases

From integration **0.2.2**, firmware checks use a separate [live catalog](https://raw.githubusercontent.com/ivaschru/qingping-esphome/firmware-catalog/firmware-catalog.json).
Firmware-only publication creates a profile tag such as `firmware-lite-v2`;
it does not create a GitHub Release or change the HACS plugin version. Standard
HA update entities still select the exact hardware profile and enforce the
minimum integration version. Installation remains an explicit user action.
The bundled first-install template is the qualified version packaged with the
plugin; newer compatible device firmware is delivered through the live catalog.
See [publishing and recovery](docs/FIRMWARE_CHANNEL.md). Old combined releases
remain immutable; the commands below describing them are historical.

## Firmware updates in Home Assistant

The integration now provides one standard **Firmware** update entity per
verified installer-managed Lite. New releases appear in **Settings → System
→ Updates**, alongside other Home Assistant updates. This requires integration 0.2.2 or later and publication to the independent
firmware catalog; source changes alone do not publish a device version. The catalog is checked every six hours;
refresh the update entity to check sooner. Installation starts only when an
administrator presses **Update**.

Firmware has its own version and a revision for each hardware profile. Updating
the HACS integration alone does not create a firmware update. The first backend
is for **Lite / CGDN1, direct-I2C, HW 0001, originally stock 4.5.8**. MCU Lite,
Monitor 1 S8/SCD40 and Monitor 2 require separate qualified image and update
backends. A shared model name does not make their images interchangeable.

For new installations, HA retains the original Wi-Fi, fallback AP and API/OTA
keys in its private, atomic installer journal. Keep HA backups private: they
can include this journal. An update downloads only a public template from an
immutable profile tag (or an older combined release), checks its SHA-256 and manifest, then personalizes it
inside HA. Private images and credentials never go to GitHub. The native API
must confirm the exact MAC/name, the managed firmware version, USB power and
the saved settings before one encrypted app-only transfer. After reboot, HA
checks settings and repeated real CO₂/raw T/raw RH readings. Bootloader,
partition layout and NVS are not rewritten; there is no automatic rollback or
claim of a complete firmware backup.

Older installer records do not contain Wi-Fi/AP values. Use **Qingping ESPHome
→ Configure → Prepare an older installation for updates** before installation
is enabled. Enter the current Wi-Fi and explicitly choose the fallback AP
credentials for the next update: the old random AP password cannot be recovered
through the normal API. API and OTA keys are retained. Saving this profile does
not change the device. Private/manual firmware is not silently adopted.

A consumed update attempt survives an HA restart. After a lost acknowledgement,
another press of **Update** only verifies that same attempt; it never resends
the image. Keep the device powered. If the old firmware remains, inspect the
attempt before any separate, explicitly authorized recovery. Repeated button
presses cannot clear this guard.

### Automatic adoption when moving between HA servers

Starting with integration **0.2.0** and Lite firmware **1**
(build identity **2026.11.07-ui25-profile1**), no installer-profile file needs to be moved.
Add the monitor to the new HA's standard ESPHome integration with its existing
API encryption key. Once connected, Qingping ESPHome recognizes the supported
firmware and automatically adds its update entity, normally within one minute.
It reuses HA's connection and key, with no pairing reset or automatic flash.

The firmware provides current Wi-Fi, fallback AP and OTA credentials in a
requesting-client-only encrypted profile. They stay in HA's private journal,
never in sensor states, plain action responses, browser storage or GitHub.
Before an update the profile is read again to preserve local Wi-Fi changes.
The administrator still presses **Update**; USB/identity/settings checks remain
in force. A new HA cannot discover an encryption key it does not already have:
standard ESPHome onboarding/authentication is separate.

Older firmware has no profile action. Upgrade it once while the original HA
still has its update profile, or prepare the legacy installation as described
above, before moving it. Updating HACS alone cannot recover secrets from an
old device. Private quiet builds, external-MCU Lite and other hardware families
are not silently converted to public Lite firmware. One direct-I2C unit passed a battery APP upgrade, live sensor/settings checks
and automatic HA adoption. A physical move between two HA servers is not claimed.

### Simple firmware versions

Firmware product versions are independent integers **1, 2, 3…** for each
compatible hardware profile. The repository/HACS version is separate. Exact
UI/build identifiers and a monotonic OTA revision remain internal verification
metadata; an old device is not relabelled or reflashed merely to change a label.
Lite 1 has passed one physical upgrade and automatic HA adoption check.
Monitor 1 S8/SCD40 each have an independent [version 1 source-built runtime kit](docs/MONITOR1_RELEASES.md), requiring local private compilation; generic ELF downloads and automatic HA updates are not available. See [the release contract](docs/FIRMWARE_VERSIONING.md) for
qualification, unsupported boards and current preparation limits.

The product direction is full ESPHome only for Lite, Monitor 1 and Monitor 2.
Monitor 1's bridge remains internal installation/recovery infrastructure, not
a separate reduced edition. An unknown/incomplete port is not made installable
by assigning it the same version number. Missing fan shutdown may be an
explicit v1 limitation when the normal sensor/display/HA lifecycle works.

### Publishing firmware

Use a clean committed snapshot. Prepare the public template with
`tools/prepare_release_template.py`, then package the integration. Update
`firmware/releases.json` only for a firmware change: increase its profile-local
revision and the native UI version together. The builder verifies that version
is actually present in the matching binary. Keep the currently qualified
production PM policy; private fan experiments are not public release assets.
The profile action's revision comes from the same release metadata. A matching
published version reuses the exact immutable BIN/manifest only when its
`release_source_sha256` matches the current firmware input closure. A source
change under the same version refuses instead of rebuilding another image.
Run `tools/check_profile_wire.py` after the initial compile to check real SDK
firmware crypto against the Python decoder.

Publish firmware independently with the **Firmware** workflow or
`python tools/publish_firmware.py --profile lite` for a preview, then `--publish`.
The source metadata owns the profile version; the HACS manifest is unchanged.
See [the complete publication/recovery runbook](docs/FIRMWARE_CHANNEL.md).
`build_firmware_catalog.py` remains only for legacy combined-format validation;
it is no longer the ordinary publishing command.

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

### Lite firmware in v0.1.3

The rebuilt template keeps GPIO13 HIGH when PM is OFF, preserving CO₂
communication. PM OFF stops polling and marks PM readings unavailable; it does
not stop the fan. HACS updates the installer only: devices already running
ESPHome are not reflashed automatically.

### Lite firmware 2

The direct-I2C profile adds guarded quiet PM operation and the reviewed OLED
interface: native outline/classic digits, clock/date layouts, shared local/HA
settings, slide transitions, blackout night mode and two-step slot confirmation.
Faults fall back to HIGH to preserve measurements, so a failed quiet guard can
restart the fan. [Port details and exact limits](ports/lite/README.md).
Original stock 4.3.4/4.5.8 provenance and optional existing HA display feed are
preserved by native updates. Factory Bluetooth admission remains 4.5.8/HW0001;
external-MCU Lite uses a separate, unqualified profile. Integration 0.2.1 is
required for the new personalization fields. No discovery action auto-flashes.
