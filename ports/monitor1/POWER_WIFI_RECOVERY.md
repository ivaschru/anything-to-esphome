# Power, offline Wi-Fi and storage recovery

This is portable source for the CGS1 Linux host port. It is not an admission
of an unknown device, a universal precompiled image or an enabled HACS
installation route. Private device profiles and matching release manifests
are still required. Never remove those guards to make a configuration build.

## Power entities

Both stock bridge and full UI include `power-telemetry.yaml`. The read-only
`power_supply.h` reads fixed kernel `capacity`, `voltage_now` and `status`
attributes. It exports battery level, voltage, battery status, charging,
external power and diagnostic telemetry availability every ten seconds.

Battery percentage comes from the kernel gauge. It is never inferred from
voltage. Invalid readings become unavailable; unknown charging/power states
are distinct from false. `Full` means external power is present and active
charging is false. Ambiguous `Not charging` does not prove external power.
The temperature/humidity algorithm and charger configuration are unchanged.

On a CGS1-SCD40, stock and full mode were checked against the real kernel:
100 %, Full, external power true, approximately 4.16 V. HA retained its
existing device identity. Discharging, active Charging, battery transitions
and other hardware revisions still need their own physical checks.

## A new network without the previous AP

The native editor has a distinct sealed `UNASSOCIATED_MANUAL` plan. The older
`UNASSOCIATED` mode remains saved-replay-only. A manual update can add/rekey
the requested preferred network while preserving every other saved key and
its order. A failed connected read cannot authorize a different mode.

Both unassociated branches keep no-SELECT rollback: remove only the owned
candidate and restore original enabled flags with independently verified
no-connect operations. The private Store, epoch/CAS and both guardians remain
mandatory. Commit still requires real association, DHCP, route/gateway,
stable READY and explicit confirmation on the touchscreen. No remote API
accepts a Wi-Fi password.

If the preferred AP is absent or unknown in cached scan results, boot defers
without effects and leaves the manual editor available. Source/fixture tests
cover the new plans and recovery policies. The new native program was run
on hardware and exposed its editor, but a physical absent-old-AP/new-AP,
wrong-password or interrupted-save scenario has not yet been verified.

## A small recovery bridge

Repeated full installations can leave old executable pairs in
`/data/.esphome-cgs1/full-releases/`. A normal host OTA stages a second
executable next to the running one, so it needs free disk space before the
old image can be replaced. Retain current plus a verified rollback; don't
accumulate every development release on the monitor.

`stock-storage-recovery-minimal.yaml` contains **both** inventory and bounded
old-release deletion. The only delete arguments are a SHA-SHA release ID and
the exact two audited inodes. It has no arbitrary path, shell or radio API.
The protected working pair must be supplied explicitly; the `unbound`
default deliberately refuses cleanup. The unchanged mode record must name
that protected pair OFF. Fixed appliance/root/executable/ext4 checks, private
directories, SHA/inode revalidation and absence of a running executable are
required. Only the two old `program` files are removed. Other files and
directories, settings, history and Wi-Fi records are preserved.

The controller must independently verify a retained local copy of both old
executables before requesting deletion. Consume and save each request intent
before dispatch. After a lost response, read inventory instead of replaying
the delete. Each release identity is consumed in memory before its first
unlink; the bounded session permits at most eight distinct obsolete pairs.

The temporary bridge preserves Noise API/OTA and kernel power telemetry.
Stock UI and acquisition remain in the vendor programs. Ordinary physical
HA exports are temporarily absent until the matched full bridge is restored;
do not advertise fake sensor readings during recovery.

For the isolated ESPHome 2026.10.1 SDK, run
`.venv/bin/python prepare_compact_host_md5.py --apply` before building that
profile. The script checks both exact SDK sources and retains originals.
Only the recovery configuration defines `CGS1_COMPACT_HOST_MD5`. It uses
OpenSSL's standard low-level MD5 checksum implementation without static EVP
provider registration. Noise/libsodium and SHA-256 verification remain on;
ordinary full/native profiles retain the original EVP implementation.
The checked recovery image was approximately 383 KB. This size is evidence
for the tested build, not a promised size for every compiler or revision.

One actual recovery removed six old pairs after local SHA/size verification,
about 49 MB, while preserving the working pair and user data. The final full
image was restored, and a subsequent Linux reboot plus HA readings passed.
Private ELF files, profiles, backups, receipts and transport keys are not
public release assets.

## Boot timing and validation boundaries

Production core waits 60 seconds before its first readiness read. On the
measured stock boot, the screen program was ready much earlier than a late
miio process that inherited DRM around 46 seconds. The longer initial window
keeps the existing 180-second total deadline, once-per-boot attempt marker,
strict owner checks and separately bound one-shot repair. Unexpected late
owners still refuse takeover. A tested final native start occurred around
97 seconds after Linux boot. This does not prove every future boot race.

Run `python -m unittest discover -s tests` from the repository root for the
power/scheduler/filesystem checks. Planner and Wi-Fi recovery fixtures require
real Linux supervisor IPC/filesystem headers and run on Linux CI; they are
explicitly skipped on macOS rather than replacing Linux credentials with mocks.
The planner fixture also exercises the real root-owned private Store. CI runs
an explicit root step on its disposable hosted runner; ordinary local tests
skip that fixture when not root and never invoke sudo automatically.
OpenSSL development headers and pkg-config are required for those fixtures
and the filesystem prune test. The SDK MD5
fixture `test_compact_host_md5.cpp` additionally needs the generated host
defines, `USE_HOST`, `USE_MD5`, `CGS1_COMPACT_HOST_MD5`, the patched SDK and
OpenSSL. Its checked vectors include empty/chunked/reused digests and a
million-byte input. SDK builds and physical tests remain separate evidence.
BLE proxy and Monitor 2 support are not established by this work.
