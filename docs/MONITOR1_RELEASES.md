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

The Home Assistant update entity checks the S8 or SCD40 source line every
six hours. A source kit alone offers release notes. For an existing supported
installation, an administrator can prepare the exact previous and target
private builds in HA storage and then use the entity's Install action. The
target report must identify the source commit and release line. Both builds
use the same private profile and existing stock PM helper.

The experimental install replaces the complete bridge/native/guardian bundle
over the authenticated device connection. It verifies the new Linux boot and
live native sensors before recording success. It can restore the previous
bundle when the exact stock-side bridge is reachable. Keep the original
private bundle for USB recovery when the bridge does not respond. See the
[preparation and installation steps](../ports/monitor1/README.md#обновление-установленного-monitor-1-из-home-assistant).

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
