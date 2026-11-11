# Firmware version lines and installation families

Status: current source contract, 2026-11-10. This contract does not itself publish a
firmware asset, relabel an installed device or enable an unfinished backend.
Lite version 2 passed separate USB upgrade/sensor/settings checks on three direct-I2C units; Monitor 1 version 1 is distributed as two immutable source-built runtime kits; it is not a generic ELF or an automatic HA update. `public_version` is the short
product number; the legacy `version` wire field remains the exact UI/build
identity and `revision` remains the internal OTA sequence. Existing devices
are not relabelled just because new source metadata exists.

## What has its own version

The product is **full ESPHome** for Lite, Monitor 1, Monitor 2 and Sonoff S60TPF.
There is one user-facing product per supported hardware profile, with public
versions **1, 2, 3, ...**. No Lite stock add-on or reduced Monitor 1/2 stock
interface edition is planned. Internal platform/package identity still gates
compatibility; it is not another edition offered to the user. The HACS integration has its own
independent version. Firmware-only publication updates the independent catalog for the selected
qualified line without a GitHub/HACS release. See [the publication runbook](FIRMWARE_CHANNEL.md).

The factory `HW 0001` string is not sufficient identity: the direct-I2C Lite
and a different external-MCU Lite both report it. Preserve existing model,
board/backend, original stock-generation and CO2-variant admission checks.
A friendly name is not hardware identity.

| Release line | Package family | First numbered release | Current readiness |
|---|---|---|---|
| Lite, direct-I2C / original stock 4.5.8 | ESP32 application replacement | 1 | One battery APP upgrade, live sensors, retained settings/keys and automatic HA adoption verified; a physical two-server move is not claimed |
| Lite, direct-I²C / original stock 4.3.4 | ESP32 application replacement, `lite-434` | 1 | Separate polling-only image; PM OFF does not stop the fan. Native updates without HACS since firmware4. Experimental factory BLE/MQTT route selects only its own template |
| Monitor 1 / S8 | Full ESPHome runtime bundle | 1 (source-built runtime) | Runtime/source builds tested; experimental common USB wizard available with a private build; automatic updater remains unfinished |
| Monitor 1 / SCD40 | Full ESPHome runtime bundle | 1 (source-built runtime) | Separate CO2 backend; same source/runtime qualification boundary |
| Lite, external MCU / original stock 4.2.1 | Not yet qualified | None | In development; no installation image |
| Monitor 2 | Linux-host research, separate backend | None | Primary research establishes a possible Linux/Qt path; no qualified full ESPHome port |
| Sonoff S60TPF / stock1.2.0 / SN-ESP32C3-S60-01 | ESP32-C3 application | 1 | Experimental eWeLink/LAN conversion, private backup and encrypted API; independent native update channel |

Monitor 1's full ESPHome interface, internal bridge, guardians and return-to-
stock mechanism form one matched package. The stock bridge remains internal
installation/recovery infrastructure, not a separately offered reduced product.
Recovery to the factory interface is not an alternative release line. Update the
validated bundle with its original component SHA bindings. Separately built,
unmatched bridge/native/guardian bytes cannot claim that package release.

The common installer must not offer an incomplete stock add-on as an
alternative to a complete port. Keep existing factory preservation/recovery
mechanisms where supported. The product decision does not authorize whole-flash
or NAND erasure, removal of safeguards, or switching an existing monitor's mode.
Monitor 2 remains unavailable until the full port is actually qualified.

## Version, update sequence and build identity

- The user-facing firmware version is the line's integer, starting with 1.
- The internal update sequence remains monotonically increasing in that exact
  line. Never reset an existing `revision` merely to rename its public version.
  Lite version 1 retains the monotonic internal revision 2; the earlier unnumbered catalog used revision 1.
- Retain source/build identifiers, ESPHome version and artifact hashes for
  diagnostics. They are not the firmware's public version.
- Mapping an old build to a numbered release needs exact qualified evidence.
  Do not relabel private quiet experiments as a public baseline or manufacture
  OTA merely to make a version label look newer.
- Match hardware profile and package family before version comparison. A
  larger number from another line is never an update for this device.
- An installer-only release retains unchanged firmware counters, original
  manifests, immutable URLs and hashes. Recompiling unchanged firmware can
  embed another timestamp and must not create an artificial device update.

Compatible Lite and Sonoff apps check their own native channels automatically;
installation remains an explicit standard ESPHome action. Monitor 1, MCU and
Monitor 2 do not acquire update entries from this document. Monitor 1 source
kits need a private matched build, rather than a generic public ELF.

## Factory preservation on Lite

The present Lite port runs an ESPHome application, not a Monitor 1-style Linux
stock companion. Reproducing factory functions in ESPHome is distinct from
keeping the original vendor application running with an additional API.

`cgdn1_boot::boot_other_slot()` selects the other application. Immediately
after initial installation it can contain factory firmware; after ESPHome
OTA it contains the previous ESPHome image. Trial return/another slot is not
permanent factory retention, concurrent operation or a qualified stock add-on.
A Lite stock add-on is explicitly out of scope by the owner's decision.

## Release gate

Version 1 is a release of a qualified package, not a blanket renaming of every
marketing model. Preserve source/manifest/image provenance and the existing
authentication, settings, installation and recovery guards. Label source,
build, install, OTA, hardware and battery checks separately. Unknown hardware
and unfinished families stay development/research entries without an
installable version. Never publish private credentials, personalised BIN/ELF
or an unknown hardware image as an installable release asset. An explicitly
experimental supported path may ship after software QA without pretending
that physical qualification was performed or imposing it as a blanket release
gate. Keep each missing capability visible.


A missing fan-off option is an acceptable explicitly documented v1 limitation
when the normal measurements, display/input and HA lifecycle work. It is not a
reason by itself to block a release. Unqualified core measurement scales,
permanent polling, display/input or power lifecycle are different gaps; raw
finite trial reports do not establish a usable sensor firmware.

The source now stages Lite6/revision7 and lite-434v5/revision8 with native
HA display sources and temporary night wake. Earlier integer versions, build
identities, immutable hashes and channel history remain unchanged. Monitor 1's build controller sources separate public
versions for S8/SCD40 and injects the same per-profile project version into
native and internal-bridge programs. Monitor 1 version 1 source kits have independent immutable tags. Their `runtime_releases` catalog entries explicitly require a private local build and never enter the installable `releases` map. Publication is not evidence of a new ARM bundle installation or permission to enable unfinished update backends.


"Full ESPHome" identifies the product/runtime, not a promise that every optional
feature exists in v1. A documented missing fan-off option can be added in v2
without changing the hardware line or requiring a new initial installation.
The MCU 4.2.x ports currently have core polling/scales/lifecycle gaps beyond
fan-off; do not confuse a factory display running during a trial with a
qualified complete ESPHome port.

## Native updater generations

The qualified native-updater releases start independently at lite / public 5 /
revision 6 and lite-434 / public 4 / revision 7. It does not merge their counters or PM
policies. Firmware-only tags/catalogs remain independent of the HACS version.
A one-time upgrade adds the updater to older firmware; later compatible
updates work through the ordinary ESPHome integration without Anything to ESPHome HACS.
For these qualified ESP32 Lite profiles, device-owned updates are a required
product contract:

- The firmware MUST check only its own compatible hardware-profile catalog and
  expose a standard ESPHome firmware UpdateEntity to Home Assistant.
- Release checking and installation of later compatible firmware MUST work
  through the ordinary ESPHome integration without Anything to ESPHome HACS or Device
  Builder. HACS may assist initial installation/adoption, but is not a required
  dependency of subsequent firmware updates.
- Checking a catalog MUST NOT install automatically. Installation requires an
  explicit user action, verified HTTPS, USB and the existing image/profile guards.
- The update MUST preserve the device's current identity, keys, Wi-Fi/AP,
  display-feed configuration and saved settings.

This requirement does not declare an unfinished family supported. Monitor 1,
external-MCU Lite and Monitor 2 need separate implementation and qualification
before an update backend can be offered.
See [the device-owned updater](NATIVE_FIRMWARE_UPDATES.md).

## Sonoff native channel

S60TPF has its own ESP32-C3 build, stock1.2.0/board/UIID admission and integer
counter. It never shares an ESP32 Lite image, private slot calendar, inactive
slot address or package license. Its native UpdateEntity checks only the fixed
S60TPF channel. SHA/TLS/full-layout checks and a consumed journal precede any
explicit installation; private slots, calibration and recovery materials stay
private. A HACS-only change to history/recovery does not change Sonoff firmware1.
