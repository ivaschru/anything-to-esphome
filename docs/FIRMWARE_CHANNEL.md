# Independent firmware publication

Integration 0.2.2 separates the live firmware channel from HACS Releases.
A device's standard HA UpdateEntity still checks every six hours (or when
refreshed), compares its exact hardware profile/version and enforces
`minimum_integration`. It never installs automatically. Firmware publishing
contains no HA call or device OTA.

## Two independent streams

| Stream | Published object | Consumer |
| --- | --- | --- |
| Integration | Normal GitHub Release `v0.2.2`, HACS ZIP | HACS / Marketplace |
| Firmware | Immutable Git data tag `firmware-lite-v2`, original public BIN/manifest | Qingping firmware updater |
| Firmware index | `firmware-catalog` branch, `firmware-catalog.json` | The installed plugin, without a new plugin release |

The fixed live endpoint is:
`https://raw.githubusercontent.com/ivaschru/qingping-esphome/firmware-catalog/firmware-catalog.json`.
Only this index is mutable. Images and original manifests must use exact
profile/version tags in this repository and matching SHA-256/size. URLs to
main, another repository/profile, query strings or unnumbered tags are refused.
Each firmware tag also has `release.json` and a README linking the exact source
commit; its parent is that source commit. Public-placeholder binaries are kept
only in these data tags, never in main or a private personalized deployment.

This uses tags rather than another GitHub Release because both
[HACS](https://github.com/hacs/integration/blob/main/custom_components/hacs/repositories/base.py)
and [Marketplace 2026.11.0](https://github.com/home-assistant/core/blob/2026.11.0/homeassistant/components/marketplace/repositories/base.py)
select published releases for the integration. `make_latest=false` alone does
not exclude a firmware release from that list. A tag without a Release is not
a HACS version. No additional repository, token or user account is required.

## Publish a qualified firmware

1. Change the selected profile's actual firmware source and increment its
   integer `public_version`, internal `revision` and exact wire/UI version in
   `firmware/releases.json`. Keep other profile entries unchanged. Retain the
   exact original manifest and source fingerprint; never invent a version bump
   for recompiling identical source or moving its public files.
2. Complete profile tests and its physical qualification. Source/compile
   success does not qualify another PCB, an MCU port or a Linux backend.
3. Open Actions → **Firmware**, select the reviewed source ref and the
   qualified profile. Leave **publish=false** for a build/admission preview.
   A known unchanged version reuses its verified public pair; changed source
   uses the pinned public-placeholder compiler.
4. Run with **publish=true** to create its tag and advance the catalog. The
   workflow does not package the integration or change its manifest version.
   Equivalent CLI: `python tools/publish_firmware.py --profile lite` (preview),
   then the same command with `--publish`. `--source-commit` may pin an exact
   reviewed SHA for an isolated source archive; every input is compared with
   that committed source before publication.

Only direct-I2C Lite currently has a qualified binary publisher and automatic updater.
Monitor 1 S8/SCD40 have separate source-built runtime publishers and version 1
kits: see [Monitor 1 releases](MONITOR1_RELEASES.md). Their `runtime_releases`
entries explicitly require a private local build and stay out of the installable
`releases` map. No Linux or MCU backend is enabled by adding metadata.
The publisher retains earlier public adoption identities and every unrelated
catalog entry. A new firmware may require a newer integration explicitly;
otherwise the current plugin continues to offer the new device version.

## Immutability, concurrency and recovery

The publisher consumes/fsyncs a local intent before one `git push --atomic`.
A create-only tag and compare-and-swap catalog lease share that transaction.
A race cannot leave a new tag with an old catalog or replace another release.
An existing identical tag/catalog is read-only reconciliation; an existing
tag with different bytes is refused. Never force-update a firmware tag.

After a missing push reply, inspect `--status`, remote tag/branch refs, the
saved intent and exact public bytes. Do not delete an intent or blindly resend.
If the refs match the intended hashes, reconcile success. A genuine conflict
requires a fresh catalog review; retain the original receipt. Public files
remain checksum-verified even if somebody later violates tag immutability.

## Migration and plugin-only releases

The initial channel publication rehosts **the exact existing Lite 2 pair**,
with the same public version/revision/build/SHA. It does not trigger a device
update merely because its URLs moved. The new transport requires plugin 0.2.2.
The first absent catalog branch bootstraps adoption history from the previous
combined catalog; a network failure or malformed existing branch never becomes
an empty catalog or a fallback to an older version.

Old v0.2.1 and earlier combined release assets remain immutable. HACS-only
releases include a frozen compatibility copy of the v0.2.1 legacy catalog for
pre-0.2.2 readers; it continues to point to those old immutable assets. It does
not follow new firmware tags. Upgrade the plugin once to follow the new channel.
The initial-install template bundled with a plugin remains that plugin's
qualified template; a newer compatible firmware is offered via the live index.
No plugin upgrade silently reflashes a device or creates a new device version.

Run `python -m unittest discover -s tests -p 'test_firmware*.py' -v` before
changing the channel. This includes actual bare-Git atomic/CAS races and real
HA SDK state contracts, not physical OTA qualification.

## Original-stock 4.3.4 line

`lite-434` has its own integer counter, immutable `firmware-lite-434-vN` tags,
`lite-434-template.bin/json` assets and `firmware/lite434-release.json` metadata.
The first public version is 1; internal revision 4 advances beyond the old
shared public 2/revision 3. Installed labels change only after verified OTA.
Use `tools/build_lite434.py` and `tools/publish_firmware.py --profile lite-434`.

The root `hardware_releases` extension contains this new installable line.
Pre-0.2.9 readers ignore it and keep parsing their original `releases` map.
New readers combine both maps with duplicate/unknown extension keys refused.
Publishing either Lite line must preserve the other map and `runtime_releases`.
Do not put a new unknown profile in old readers' map or change existing Lite 2
assets/counters to hide the addition. The integration's first support is 0.2.9;
this minimum is independent from subsequent firmware-only versions.

Version 1 deliberately uses a continuous HIGH sensor rail: PM OFF affects
polling only. It does not promise fan shutdown. Initial factory BLE admission
is unchanged; the enabled route is native updates of existing managed devices
with authenticated 4.3.4/HW0001 provenance. Other original-stock generations
must never receive this image through model-name or public-number inference.

## Device-owned native endpoints

Lite 4.5.8 firmware 5 and Lite 4.3.4 firmware 4 add ordinary ESPHome update
entities and their own guarded HTTPS downloader. The same firmware-only
transaction publishes fixed native-lite.json/native-lite-434.json endpoints
and their immutable public app pair. Both publishers preserve other native
endpoints. No HACS release is required. See [native updates](NATIVE_FIRMWARE_UPDATES.md).
