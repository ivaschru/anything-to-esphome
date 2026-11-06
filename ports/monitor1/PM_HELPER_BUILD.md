# Rebuilding the stock PM helper

This is a **build-only dependency**, not a universal CGS1 installer. It does
not connect to a monitor, launch SnowApp, change a preload or publish a
release. S8/SCD40 installation admission and the matched native/guardian
manifests remain separate requirements.

`pm_qt_bridge.cpp` keeps acquisition and the persistent PM setting inside
SnowApp. It accesses the verified `AirDataController.isPM25Enabled` property
on the application's GUI thread. Its root-only local socket accepts only
GET/ON/OFF; timed-out queued work is cancelled. It has no GPIO, UART,
calibration or arbitrary-command interface. The installer must still verify
the matching stock program, library and private directory before loading it.
The helper does not grant those installation permissions by itself.

## Inputs

Use Python 3.13 or a compatible interpreter for the pinned requirements:

```sh
python3 -m venv ports/monitor1/.venv
ports/monitor1/.venv/bin/python -m pip install -r ports/monitor1/requirements.txt
```

Supply a private regular-file copy of the **matching stock
`libQt5Core.so.5.9.4`**, obtained from the owner's verified backup, and its
independently recorded SHA-256. A filename or a newly calculated hash of an
unknown library does not establish that provenance. The builder checks the
digest, ARM32/little-endian shared-object type and QtCore SONAME before
starting a build. It never downloads or distributes that vendor library.

Qt's public `v5.9.4` headers come from one fixed official source archive,
checked against the pinned tested checksum. `--qt-archive` may supply that
exact archive for an offline build; a mismatch never falls back to a download.
No Qt runtime is rebuilt or installed on the monitor.

## Build

From the repository root, replace the example paths and digest with the
independently verified local inputs:

```sh
ports/monitor1/.venv/bin/python ports/monitor1/build_pm_helper.py \
  --qt-core /absolute/private/backup/libQt5Core.so.5.9.4 \
  --qt-core-sha256 "REPLACE_WITH_VERIFIED_SHA256" \
  --output "$PWD/ports/monitor1/build/pm-helper-first"
```

The output must be **new** and inside the ignored `ports/monitor1/build/`
tree. Existing results and symlinked paths are refused. A failed attempt
retains its evidence; choose another output name after addressing the cause.
Builds use Zig 0.14.1 for ARMv7 hard-float/glibc 2.23, run sequentially at
`nice 10`, and do not start Colima or Docker.

The private output contains the production helper, a separately marked test
helper, a QtCore mock executable, `compile.log` and `result.json`. ELF checks
reject the wrong CPU/type, host RPATH/RUNPATH, text relocations and glibc
requirements above 2.23. Input source/library/archive hashes are rechecked
before `complete=true`. Logs and artifacts remain local; the report contains
digests and relative source names, without credentials or deployment identity.

Only `pm_qt_bridge.so` is a candidate production dependency. The test helper
and mock use a distinct temporary socket/path and must never be installed as
the stock extension. Building them does not execute either one.

## Verification scope

On 6 November 2026 the public source was cross-built with Python 3.14.6 from
a fresh isolated environment against a privately verified stock QtCore. All three outputs
passed ARM32/dependency/glibc checks; the production helper was 267,620 bytes.
Two fresh output directories produced identical hashes for all three outputs;
source paths are normalized for Qt assertion strings.
Five dependency-free admission tests cover incorrect input pins/archives,
symlink inputs/cache and exclusive private output. Run them with:

```sh
python3 -m unittest discover -s tests -p test_monitor1_build.py -v
```

The helper and mock source match the previously tested canonical extension.
**The newly rebuilt artifacts have not been loaded or run on a monitor.**
This cross-build is not new hardware, GUI timeout or installation proof. A
[candidate controller](BUILD_CANDIDATE.md) binds the newly produced helper
digest into its explicit device profile and matches the guardian/native/bridge
programs. A complete installation pipeline must still perform its independent
device validation before any installation. Do not substitute an old helper
pin or remove admission gates.
