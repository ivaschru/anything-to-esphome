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

## Installation history and recovery

Version 0.3.1 keeps an owner-only, newest-first history with pages of 50 jobs.
Select an older job to view its progress or download its private stock/eFuse
backup. Backups contain device secrets; the separate diagnostics download uses
an explicit allowlist and excludes account/Wi-Fi/key/IP/name/MAC/raw-log data.
Neither download changes the device or clears a consumed installation.

After a lost response, **Check installed ESPHome** reads through the original
Noise key and verifies the exact MAC/project plus fresh typed readings. A new
RFC1918 IP is accepted only after that authentication. It never toggles relay
or Bluetooth, enrolls in HA, reflashes or relaunches the conversion engine.

The original v2 worker's nonce/MAC-bound terminal receipt and released kernel
lease must agree before the attempt is settled. Its actual child processes
inherit the lease; parent exit alone is insufficient. Positive settlement can
unblock a different plug, including when the first app cannot be reached.
The consumed original MAC always stays blocked against another conversion.

Missing/partial/legacy receipts remain uncertain even when an app answers or
an old record says verified. The UI can retain that useful app observation,
but cannot invent worker completion. Restarting HA or refreshing the page does
not clear this fence. A successful read-only recovery also does not replace an
existing HA entry; add/check the standard ESPHome integration separately when
enrollment needs manual attention.

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
