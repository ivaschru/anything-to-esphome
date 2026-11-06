# Initial CGS1 installation preparation

**Engineering sources cover capture, local patch/plan preparation, disabled
staging and disabled script commit/rollback. Writers are not hardware qualified;
activation and the HACS CGS1 installation route remain unavailable.** Do not treat
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

## 6. Read-only disabled commit/rollback review

`disabled_commit_policy.py` models the two exact vendor-script transitions
without transport or filesystem writes. A forward transaction starts only
from both factory scripts. A known partial pair can only be proposed for a
separate exact rollback; it is never automatically completed. Both disable
flags, plan marker, root inode, USB/boot/CO2, source closure and stock/watchdog
session must remain unchanged. Each operation is issued once and needs a new
whole-scope observation proving exactly that file transition. A timeout,
missing readback, extra change or scope drift seals reconciliation, without
issuing a retry.

The accompanying collector is also **read-only and hardware unqualified**:

```sh
python3 ports/monitor1/review_disabled_install.py \
  --serial USB_SERIAL \
  --plan-directory "$PWD/ports/monitor1/build/install-plan-first" \
  --expected-plan-sha256 EXACT_PRIVATE_PLAN_SHA \
  --output "$PWD/ports/monitor1/build/disabled-review-first"
```

It requires the exact successful disabled-stage receipt, checks the live root,
flags and staged/vendor hashes, and reads the actual root-owned SnowApp and
its watchdog parent twice. Parent cmdline comparison and PM-library map
filtering occur on-device; generic argv, environment and INI bodies are not
exported. Unavailable maps or an unreadable live userspace executable never
become a claim that the extension/program is absent. Missing executable links
are distinguished from kernel threads/exited tasks using the upstream Linux
3.10 stat/flag layout; the vendor kernel still needs physical qualification.

The private `review.json` includes captured scope and possible disabled
transactions. It always records `installation_ready=false` and
`review_grants_write_authority=false`. It does not consume a new intent, change
a script, authorize activation or make an old capture valid after a reboot.
Tests cover all four known script combinations, process/root/source drift,
lost acknowledgement and the actual read-only scanner against an isolated
fake proc tree. None is a physical installation result.

## 7. Experimental disabled commit/rollback adapter

`commit_disabled_install.py` now binds that policy to fixed USB shell
operations. It is **not hardware qualified**, stays outside HACS, and does
not activate a monitor. Its separate `--commit-disabled` and
`--rollback-disabled` operations require the exact private plan/SHA/USB scope.
Each direction consumes its own durable exclusive receipt before the first
write and claims a permanent private operation marker on-device. Rollback
also requires the matching prior own commit receipt and remote marker.

The adapter reads a fresh complete review before every issue and after every
replacement. It rechecks the scope again inside the same shell before the
rename. Only the exact startup/watchdog source and target pairs are accepted.
It preserves the recovery source, copies to a private same-filesystem temporary,
checks `sh -n` and SHA, syncs, repeats scope/CAS checks, atomically renames, then
syncs again. This is two independently checked file replacements; both disable
flags stay set in every known intermediate combination.

Command completion alone cannot acknowledge a replacement. The policy needs
a new whole-scope observation proving exactly the issued change. A lost ACK
seals the receipt even if the rename already happened; it never resends or
automatically rolls back. Use the **read-only disabled review** to establish
the resulting known pair. Any rollback is a separate explicit operation with
its own intent, never an error handler or cleanup. Do not remove receipts or
operation markers to bypass a refusal.

Tests cover commit, separate rollback, a lost ACK after rename, no resend,
exact source/path admission and failed command-substitution propagation. A
separate Linux/root fixture maps every device path into a private temporary
tree to exercise real guard/copy/hash/syntax/rename operations. Host fixtures
do not establish NAND durability, boot behavior or a physical installation.

## 8. First bounded stock-bridge trial policy (no execution adapter yet)

`initial_bridge_trial_policy.py` defines admission and outcome for the next
stage without device, filesystem, process, signal or API IO. **It is not an
activation command or a working trial guardian.** The simulated observations
in its tests are not a fresh device review or a hardware result.

Both exact boot scripts must already be committed, and **both persistent
disable flags remain set throughout**. The first trial must not use the
retrying boot launcher. It requires a separate one-shot device-side guardian
with a fixed 60-second monotonic deadline, independent of the host connection.
The guardian may terminate/reap only its actual unreaped kernel child, with
child parent-death SIGTERM and child-only `oom_score_adj=1000` armed before
exec. The stock/watchdog PID identities are explicitly excluded. No adoption
of a PID from a file or from an ADB response is allowed.

The policy additionally requires an absent full-release store, persistent
preferences and Wi-Fi store, absent boot-launcher RAM lock, free API/OTA
listeners, and a private verified RAM workspace. This matters because the
production bridge has native core autostart enabled: a pre-existing release
store could otherwise start a second mode during a headless trial. Nothing
in this step permits enabling the PM extension or stopping stock processes.

Two authenticated API batches must match the exact API MAC/node and contain
four independent CO2/T/RH/tVOC wire-update generations, at least 10 seconds
apart. Values must be finite and valid, with a fresh stock response. A recent
batch is required at the deadline; cached early values do not qualify the
trial. A normal TERM and independent exact-child reap with a clean/TERM exit,
both flags and the whole stock scope unchanged, can qualify only this bounded
trial. An early exit, crash, stale proof, changed scope or forced stop cannot.

TERM has a five-second grace, then at most one KILL of that same held child;
failure to reap in another five seconds seals reconciliation without repeated
signals. Start is also single-issue: a delayed ACK or host timeout never
restarts or extends the trial. A future transport must consume/fsync a new
immutable trial intent before issuing the guardian; the pure policy does not
persist one or grant process authority.

Source admission uses 32 MiB initial RAM, an 8 MiB running/data floor and a
64 KiB log cap. These are conservative gates, **not a measured guarantee of
enough memory on a monitor**. A matching guardian/collector, measured process
footprint, disconnect/fallback tests and physical qualification are still
required. HACS CGS1 remains `source_only`.

`initial_trial_child.h` implements the separate Linux child primitive. It
forks once behind a private preparation gate, arms child-only OOM/PDEATHSIG,
and permits only its own exclusive unreaped child to receive one TERM/KILL.
Its internal monotonic 60/5/5-second bounds cannot be extended by a host ACK.
Closing a preparation gate prevents entry; retiring the actual parent causes
kernel TERM delivery. It has no CLI, path-based exec, PID adoption or device
integration. A supplied entry still needs exact ELF/fd/hash/xattr admission,
private RAM preferences/environment, full scope checks and a consumed intent
in the future standalone guardian. Do not call it as an installation shortcut.

Linux/root fixtures use synthetic callbacks only: normal exit, TERM, an
entry ignoring TERM followed by one KILL, refused SIGCHLD auto-reap, and
actual parent death with subreaper cleanup. Only the fixture child changes
its own OOM score. This tests kernel process behavior on the hosted runner,
not the vendor kernel, a bridge exec or the complete trial/activation flow.
The ARMv7/glibc 2.23 fixture object also compiles with pinned Zig 0.14.1;
it is not an installable guardian or a physical execution result.

Kernel behavior was checked against the Linux man-pages
[PDEATHSIG contract](https://man7.org/linux/man-pages/man2/PR_SET_PDEATHSIG.2const.html)
and the kernel's [per-process OOM documentation](https://www.kernel.org/doc/html/v6.1/filesystems/proc.html#proc-pid-oom-adj-proc-pid-oom-score-adj-adjust-the-oom-killer-score)
on 2026-11-06. A parent already dead before arming does not retroactively
deliver the signal, so the child checks its parent again. Credential and
set-id/file-capability exec transitions can clear PDEATHSIG; the future ELF
admission must exclude them. Raising the experimental child's OOM preference
does not cap memory or guarantee that stock survives every OOM condition.

## Remaining activation and hardware gates

The preparation tools stop before device writes; experimental disabled staging
and script transactions each have their own separate explicit operations.
Physical qualification and the independent activation flow remain unfinished.
An offline plan, staged directory or review does not authorize replay, script
replacement or activation.

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
