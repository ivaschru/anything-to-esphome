# Monitor 1 runtime releases

Version 1 has separate `monitor1-s8` (CO2 type 2) and `monitor1-scd40` (type 3)
lines for RK3128 / ARMv7 / factory `4.1.8_0287`. Each immutable data tag holds
`monitor1-runtime-source.tar.gz`, `release.json` and build instructions.

**Delivery is source-built, not a ready generic ELF download.** Existing private
full-runtime deployments passed sensors, UI, persistent settings, guarded return
and software reboot. Public source compiles passed separately. Exact newly built
release programs are not claimed hardware-tested. No credentials, personalized
programs, vendor QtCore or factory scripts are distributed.

Use the `source_commit` in release.json to clone/check out the public repository.
Follow that commit's `ports/monitor1/BUILD_CANDIDATE.md`, using a private profile
and the matching private factory QtCore. It compiles a matched native/guardian/
bridge and derives actual dependency hashes, rather than copying old pins. The
source tar is an inspection copy; the builder needs the exact Git commit.

For an existing ESPHome installation retain the current node name, API MAC,
Noise key and preferences. Use its established deployment/recovery procedure.
The release does not provide a new automatic updater, generic OTA image or a
qualified first-install USB route. Factory-only and existing installations must
not be routed through each other's tools. Read the installation boundaries in
`ports/monitor1/README.md` before any device action.

The integration's Monitor 1 update entity checks for new source kits every
six hours. It links the kit for the S8 or SCD40 project reported by the existing
encrypted ESPHome connection. The entity offers release notes. Installation
still requires the private build and the matched bridge, native and guardian
programs. Older custom builds without the published project name and numeric
version cannot be associated with a source line automatically.

## Publication

From a clean archive of a reviewed committed source:

```sh
python tools/publish_monitor1.py --profile both --source-commit <full-source-SHA>
# Review the exact source/profile/package hashes before the authorized write:
python tools/publish_monitor1.py --profile both --source-commit <full-source-SHA> --publish
```

`--profile monitor1-s8` or `monitor1-scd40` publishes one line. Default is a dry
run. A publication adds create-only tags `firmware-monitor1-s8-v1` and/or
`firmware-monitor1-scd40-v1` plus a catalog CAS in one atomic Git push. Existing
identical publication reconciles; changed bytes at version 1 refuse. A later
source change needs the next public number in `ports/monitor1/release-versions.json`.
Never retry a lost push blindly: read refs and original intent first.

The live `firmware-catalog` branch records these as `runtime_releases`, with
`delivery=source-build-private-profile` and automatic/initial install readiness
false. The installable `releases` map is preserved, so current HA integrations
continue reading Lite 2 and do not offer Linux programs to the ESP32 updater.
No HACS ZIP/version or GitHub Release is created.

## External-MCU Lite is a different port

Missing fan-off is an acceptable version 1 limitation. The current 4.2.x MCU
experiment additionally has finite polling and a 300-second factory return,
raw/unqualified temperature and humidity, and no complete permanent ESPHome UI.
It is not a ready runtime source release. Do not publish its trial BIN as v1 or
reuse the direct-I2C Lite image. Runtime qualification must close those concrete
core gaps; the fan feature can follow independently.
