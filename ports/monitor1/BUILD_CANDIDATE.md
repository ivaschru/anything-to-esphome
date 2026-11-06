# Matched CGS1 build candidate

**Experimental build-only controller; installation remains unavailable.**
Separate end-to-end SCD40 and S8 source compiles have passed. No result from this tool is
hardware QA or permission to install it. Its report always keeps
`installation_ready=false`, and the HACS CGS1 profiles remain `source_only`.

The controller builds the stock PM helper, a guardian, the full native UI and
a matched stock bridge from **one committed public source revision**. The
guardian digest is embedded in the native program; both actual program
digests and sizes are then embedded in the bridge. There are no default,
copied private or fabricated artifact pins.

## Requirements and private profile

Use a Linux or macOS build computer, Git, Perl and the dedicated environment
from [PM helper build](PM_HELPER_BUILD.md). The invocation creates another
isolated pinned SDK inside its private output so a patched environment or
old generated project cannot affect a different candidate. It does not start
Colima/Docker. All compiler work is sequential at `nice 10`.

Copy [the profile example](profiles/candidate-build.example.json) into the
ignored `ports/monitor1/build/` directory and make it an owned `0600` regular
file. Fill it locally from independently verified device information:

- Only CGS1 stock `4.1.8_0287` is admitted for a candidate build.
- `co2_type` must explicitly be **2 (S8)** or **3 (SCD40)**. Model appearance
  alone does not establish the sensor type. SCD30 and Monitor 2 are refused.
- `wlan_mac` identifies the physical Linux interface; `api_mac` must be a
  different locally administered unicast identity. Keep an existing device's
  API identity and node name when preparing an upgrade.
- `api_encryption_key` is a nonzero 32-byte base64 Noise key. Keep it in the
  private profile; never put it in arguments, environment variables, Git,
  issue bodies or chat. This build does not need the owner's Wi-Fi password.
- `qt_core_sha256` must come from the matching verified stock backup. Supply
  the private QtCore library separately, as described in the PM helper guide.

The example intentionally has invalid placeholders. It cannot silently fall
back to a real device, a public transport key or an unverified CO2 profile.

## Invocation

From a checkout that contains the committed controller:

```sh
ports/monitor1/.venv/bin/python ports/monitor1/build_candidate.py \
  --profile "$PWD/ports/monitor1/build/profile.json" \
  --qt-core /absolute/private/backup/libQt5Core.so.5.9.4 \
  --output "$PWD/ports/monitor1/build/candidate-first"
```

The default source is `HEAD`; `--source-ref` can select an exact reviewed
commit. **Dirty and untracked working files are never used as build inputs.**
The builder archives only `ports/monitor1/` from that commit. Existing or
symlinked output paths are refused. Optional `--qt-archive` and
`--openssl-archive` accept only the exact checksum-pinned public archives,
so cached/offline source use does not bypass verification.

The private output has a stage report (`result.json`), `build.log`, the source
snapshot and its fresh SDK/build tree. A successful candidate also has
`native-program`, `guardian-program` and `bridge-program`; the production PM
extension remains under the snapshot's private build directory. Test helper
and mock artifacts are never production payloads.

The profile is captured once; only `secrets.yaml` in the private snapshot
holds its Noise key for ESPHome. Build logs may contain generated source and
must also remain private. A failure records the last stage and retains its
output for diagnosis. Do not overwrite it or interpret a partial executable
as a complete candidate; address the cause and choose a new output directory.

## Gates that remain in place

`stock-bridge-release.yaml` uses the ordinary `FullRuntime` and its existing
strict stock/device inspection, two guardians, own Store/CAS, transport gate,
return/recovery and boot lifecycle. Its manifest is required and generated
only from the two built ARM ELF files. It omits the older engineering
network-trial API, which would otherwise require an unrelated trial image.

Custom component/root-header dependencies are collected from their actual
include graph. Unrelated runtime headers are not enabled just to make the
compiler pass; YAML/header traversal cannot leave the public snapshot.
ARM32/little-endian ELF, glibc <= 2.23, RPATH/TEXTREL and final source-hash
checks still apply. A successful source build does not grant board access.

There is **no upload, remote command, USB connection, preload change, launch,
boot activation or Home Assistant mutation** in this controller. A complete
installer still needs independent current device identity/stock/CO2 checks,
verified backup, a matching PM loader, resource checks, one consumed install
intent and real guarded return/boot verification. Do not enable the HACS
installation route until that separate work has passed.

## Current validation

On 6 November 2026 the committed controller completed isolated SCD40 and S8
compile fixtures from revision `a2121b8d`: fresh SDK, ARM crypto, PM helper,
guardian, native and production bridge. Output ELF/ABI checks passed; the
native embeds its actual guardian digest, and the bridge embeds both actual
program digests. The SCD40 source selects the kernel reader without a SenseAir
instance; S8 selects its actual SenseAir component, UART and CO2 output. Both
bridges omit the legacy maintenance API. The fixtures are deliberately
non-operational and were never installed or run on a monitor.

Seven profile/include-boundary tests pass. CI for that source revision passed
all five jobs, including Linux Store/IPC and both HA contract versions. Local
pure checks remain separate from this cross-build and from physical testing.
Neither these compile fixtures nor older private hardware proof establish a
fresh installation through a new USB/HACS pipeline.
