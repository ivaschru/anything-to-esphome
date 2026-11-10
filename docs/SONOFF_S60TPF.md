# Sonoff S60TPF

The shared installer keeps its historical `qingping_esphome` HA domain so
existing entries, private installation records, panel routes and entity IDs
survive the Anything → ESPHome repository rename.

The first Sonoff profile is the Wi-Fi S60TPF, factory firmware 1.2.0,
UIID 190 / SN-ESP32C3-S60-01. It is distinct from Zigbee S60 and other S60
variants. The initial installation is experimental; software tests do not
qualify the complete new wizard on physical hardware.

## Installation contract

- Brand → model → device. Inventory an already configured SonoffLAN registry
  first, using its in-memory device and authenticated cloud session. Do not
  copy its account password or modify its entries, entities or connections.
- Discover `_ewelink._tcp.local.` through HA's shared Zeroconf instance.
  A manual RFC1918 IPv4 is a fallback, never identity or write authority.
- Without a usable account session, sign into eWeLink in the authenticated
  administrator-only wizard. Keep password/session/key data private; no
  browser storage, public status, exception text or diagnostic logs.
- Recheck the owned device, stock version and fresh encrypted LAN identity.
  Require an explicit acknowledgement of load interruption and the initial
  bootloader power-loss risk before consuming a durable installation intent.
- Run the exact pinned GPL-3.0 Sonoff-OTA engine in a separate process, retain
  the full private stock/eFuse backup, and preserve all original validators,
  locks and readbacks. An uncertain process/OTA outcome must never auto-resume.
- Install a public placeholder template personalized privately with the
  original Wi-Fi and new per-device Noise/OTA/AP credentials. Preserve stock
  calibration and stable energy preferences. BLE Proxy is an explicit option.
- Enroll via HA's ordinary ESPHome flow after fresh encrypted identity and
  relay/measurement readback. Do not overwrite existing entries automatically.

## Subsequent firmware updates

The device owns its model-specific native ESPHome firmware update entity.
Checking a public HTTPS manifest is automatic; installation is an explicit
HA administrator action. It preserves its current private slots and NVS,
verifies the original complete SHA-256 and ESP32-C3 image layout, and writes
only the inactive existing 0x1f0000-byte app slot. No factory-conversion
engine, HACS integration or Device Builder is required for subsequent OTA.

Existing Qingping immutable tags, catalog endpoints and compiled old URLs
are compatibility inputs. Never silently republish or rewrite an old image.
Repository renaming must include a real read-back of those public endpoints.

## Build and release

Build with the pinned Python environment in `ports/sonoff_s60/requirements.txt`:
`python tools/build_sonoff.py --reuse-published`. The public app must fit the
existing 0x1f0000 app slot. A source-matched published pair is reused unchanged;
a changed source closure needs new profile-local counters.

`python tools/publish_sonoff.py` prepares a dry-run. `--publish` stages the
immutable `firmware-sonoff-s60tpf-vN` tag and `native-sonoff-s60tpf.json` in one
atomic CAS push, preserving the ordinary Qingping index and other endpoints.
No HACS release or device update happens from the firmware workflow.

Slot0 stores HA's future calendar rules in the pinned SDK's parsed format:
32 explicit little-endian bytes encoded as 64 hex characters. The firmware
sets ESPHome's global parsed timezone before energy calendar use. Native OTA
retains this slot rather than guessing today's offset or reverting to UTC.

The historical SonoffLAN entities are left in place. Once the device runs
ESPHome they no longer represent the stock service; review HA automations and
remove obsolete Sonoff entities deliberately. This release does not silently
rename entity IDs, delete entries or rewrite automations.

Existing ESPHome S60TPF installations built outside this project need a
separately reviewed transition to gain the new native updater; the factory
wizard does not claim or overwrite those devices.
