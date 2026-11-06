# Initial CGS1 installation preparation

**Read-only capture, local patch/plan preparation and experimental disabled
staging source are available. Vendor commit/activation and the HACS CGS1
installation route are still unavailable.** Do not treat
the commands below as a complete flashing instruction or an upgrade tool.

The verified boundary is CGS1, stock `4.1.8_0287`, ARMv7/glibc 2.23 with
CO2 type **2 (S8)** or **3 (SCD40)**. The two types select different native
backends. Monitor 2, SCD30, other firmware and unknown board revisions are
not admitted. The enclosure/model name alone is insufficient identification.

## 1. Fixed-file USB capture

The read-only engineering preflight uses an already enabled, authorized USB
ADB connection. It does not enable debugging, connect TCP ADB or change any
device setting. Select an explicit USB serial and independently identified
physical WLAN MAC and expected CO2 type. Do not reuse another device's profile.

```sh
python3 ports/monitor1/preflight_adb.py \
  --serial USB_SERIAL \
  --expected-wlan-mac VERIFIED_LOWERCASE_WLAN_MAC \
  --co2-type 3 \
  --output "$PWD/ports/monitor1/build/initial-capture-first"
```

Use `2` instead of `3` only for an independently identified S8 device. The
tool then verifies the actual scalar `sensors.co2_type` on-device. It filters
the INI there; Wi-Fi passwords, MiIO keys and other settings are not copied
into its output. Identity/root/CPU/firmware checks precede the file capture.

Only nine fixed regular files are pulled individually: original SnowApp,
startup/watchdog, two init scripts, loader/libc/libstdc++ and stock QtCore.
Each is admitted by exact size/SHA before capture, checked locally and
checked again on-device. WLAN, CO2 type, boot ID and USB transport must still
match afterward. Existing `/data/.esphome-cgs1` installs are refused, without
changing or deleting them. A failed capture retains its private partial copy
but does not write a successful result manifest.

The old daemon needs ordinary shell/SYNC, not recursive `pull` or `exec-out`.
A host return code alone does not establish remote success; every shell read
requires `set -e` and a unique final completion marker. The capture has no
device push, signals, reboot, stock/radio command, GPIO write or cleanup path.

The fresh output directory is `0700`, files `0600`, inside ignored `build/`.
Keep it private: vendor binaries are not public release assets. `result.json`
also contains private device identity. This fixed recovery/build set is not
a full NAND image or a complete user-data backup.

## 2. Prepare exact startup/watchdog candidates locally

```sh
python3 ports/monitor1/bootstrap_patches.py \
  --stock-start "$PWD/ports/monitor1/build/initial-capture-first/data/etc/init.d/start.sh" \
  --stock-watchdog "$PWD/ports/monitor1/build/initial-capture-first/data/bin/watchdog.sh" \
  --output "$PWD/ports/monitor1/build/bootstrap-first"
```

This preserves both factory originals and emits both exact patched candidates
plus the public launchers. It appends the recovered startup fragment and
changes one watchdog launch line. Factory, fragment, launcher and complete
output digests must match the [reviewed bootstrap pins](bootstrap/README.md).
Unknown/already-patched sources are refused. No vendor script is distributed
by the repository, and no output is copied to a device.

All scripts are checked with `sh -n` only. **Never execute production-path
scripts on the build computer.** Their `/data`, `/proc`, process and launch
operations belong to the monitor and would not be a valid host smoke test.

## 3. Build a matched private candidate

Use the captured QtCore and its admitted SHA with a private device profile
and the [matched candidate builder](BUILD_CANDIDATE.md). Preserve distinct
WLAN/API identities, the correct CO2 backend and private Noise key handling.
Source commits, helper, guardian, native and bridge must remain matched.
The compiler does not select a device or grant installation authority.

## 4. Assemble an offline target-bound plan

```sh
ports/monitor1/.venv/bin/python ports/monitor1/prepare_install.py \
  --capture "$PWD/ports/monitor1/build/initial-capture-first" \
  --candidate "$PWD/ports/monitor1/build/candidate-first" \
  --patches "$PWD/ports/monitor1/build/bootstrap-first" \
  --profile "$PWD/ports/monitor1/build/profile.json" \
  --output "$PWD/ports/monitor1/build/install-plan-first"
```

The plan joins the exact capture identity/CO2/Qt, the private profile digest,
the complete candidate source closure, ARM/ABI-checked programs, actual PM
helper and exact bootstrap outputs. It reads all recovery files back before
assembling a fresh private payload. Tampered, missing, mismatched or incomplete
inputs fail before an output plan is created. Neither the Noise key nor the
profile body is copied into `plan.json`; the compiled programs remain private.

The result records file hashes, exact before/after script changes, captured
USB/boot identity and a conservative free-data-space request. This request is
**not a measured resource result**. There is no live target read in this step,
no consumed install intent and no executable apply/activation instruction.
`installation_ready` stays false; even a valid plan requires fresh live CAS.

Both real S8/SCD40 source candidates have passed this planner's separate
offline source/ELF/helper-pin audit without inventing a USB capture. Full join
and rejection tests use explicitly simulated inputs, not a physical monitor.

## 5. Experimental disabled staging source

`stage_install_adb.py` implements the next **unqualified engineering stage**.
Its `--stage` operation requires the exact private plan directory, its full
SHA-256 and the selected USB serial. It checks the live USB/WLAN/firmware/CO2,
same captured boot, nine factory files, absent own root and measured ext4 data
headroom. A durable `O_EXCL` host receipt consumes the intent before the first
device write. Every file has one SYNC push and exact remote readback.

The only write destination is a newly created private `/data/.esphome-cgs1`.
Both bridge and PM-extension disable flags exist before any executable arrives.
Vendor startup/watchdog remain byte-identical. No program runs, no process is
signalled, no preload or boot/full-mode flag is enabled, and no reboot occurs.
Native/guardian binaries remain on the host instead of consuming duplicate
NAND space. The staged bridge/helper/source/backups are inert until a separate
reviewed commit and activation flow exists.

After a timeout or lost push ACK, the operation stays consumed and the private
state is retained. `--status` performs read-only reconciliation against that
exact plan/receipt/USB target; it never permits a retry, deletes files or clears
an intent. A partial/foreign root, different boot or corrupted staged file
requires review. Do not remove a receipt or create a new plan merely to rerun
an ambiguous transfer.

Host tests cover disabled staging, unchanged vendor files, capacity refusal,
lost ACK and no retry, using an in-memory ADB/filesystem adapter. **The new
staging code has not been run on a physical monitor and is not a validated
installation command.** It remains outside the HACS admission path.

## Remaining commit/activation and hardware gates

The preparation tools stop before device writes; experimental disabled staging
has its own separate explicit operation. Remaining work is the fresh guarded
vendor-script CAS/atomic replacement, rollback and activation flow, preserving
private permissions and both original scripts. An offline plan or staged
directory does not authorize replay, script replacement or activation.

Activation needs independent checks that the optional PM extension returns
to stock on failure, the bridge owns only its own child, sensor readings and
Noise identity match, and guarded native return/boot works on the selected
CO2 variant. A software build, host fixture or reconstruction of previously
installed script bytes does not establish those fresh hardware results.

No new monitor has been selected or changed by this preparation work. The
existing tested installations retain their own release manifests/receipts;
do not replay consumed OTA/launch/prune/reboot intents. Bluetooth UART/power
wiring remains a separate unresolved boundary, as documented in
[BLUETOOTH_RESEARCH.md](BLUETOOTH_RESEARCH.md).
