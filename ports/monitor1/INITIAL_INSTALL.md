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
child parent-death SIGTERM, child-only `oom_score_adj=1000` and `no_new_privs`
armed before exec. The stock/watchdog PID identities are explicitly excluded. No adoption
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

Linux/root fixtures use their own synthetic code: normal exit, TERM, an
entry ignoring TERM followed by one KILL, refused SIGCHLD auto-reap, and
actual parent death with subreaper cleanup. An additional fd-based exec of
the same fixture checks that OOM/PDEATHSIG/NNP remain set in that helper.
Only the fixture child changes its own OOM/NNP; parent values stay unchanged.
This tests the hosted kernel/libc, not vendor glibc 2.23, a bridge exec or
the complete trial/activation flow.
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

The child also sets and reads back [no_new_privs](https://www.kernel.org/doc/html/latest/userspace-api/no_new_privs.html)
before entry. Linux supports it since 3.5 and preserves it across exec; it
prevents exec from granting new privileges. This avoids relying solely on
file mode/xattr reports, including for a root caller with a restricted
capability set. It does not prevent privileged code from changing its own
credentials through other syscalls, replace the xattr checks or prove the
vendor kernel behavior. A failed/unsupported prctl exits before entry.

### Read-only image and initial RAM admission

`initial_trial_admission.h` adds separate read-only building blocks. A trusted
root fd must match the independently captured directory device/inode, root
ownership, private mode and ext4 filesystem. Only its fixed `program` entry
is opened, read-only, no-follow and no-atime. Initial mode must be exactly
0700 with one link; the exact private manifest size/SHA and ARM32 hard-float
header must match. Held and named metadata, timestamps, full hash and xattr
reports are checked again before returning a close-on-exec read descriptor.
Replacement, unlink, hardlink, permission/owner change, changed bytes or a
reported file capability seal the observation. Restoring old bytes or
reopening that same object cannot revive the old observation.
The reader never changes permissions, strips xattrs, repairs or executes it.

Capability inspection requires a successful bounded attribute-name listing
plus the absent-attribute result for `security.capability`. Unsupported,
denied, malformed or changed results are refusals; even an empty present
capability is rejected. The [getxattr contract](https://man7.org/linux/man-pages/man2/getxattr.2.html)
also allows ENODATA for hidden/inaccessible metadata. Consequently these
checks report what the admitted root caller can observe: they do not prove
that an LSM cannot hide an attribute, or that PDEATHSIG survives exec on the
vendor kernel. Those remain explicit qualification gates, not a permission
to run on uncertain metadata.

The initial RAM reader separately requires an empty private root-owned tmpfs
with exact directory identity and at least 8 MiB filesystem headroom. It
returns only a read directory fd. A future entry must use it for the RAM cwd,
set `ESPHOME_PREFDIR=./prefs`, and clear inherited loader/environment state.
Once preferences exist this initial-only empty-directory proof no longer
applies; live monitoring needs its own narrower ownership checks. A tmpfs
free-space result is not MemAvailable, a measured process footprint or proof
that the canonical RAM job path remains unchanged.

These readers neither create a job nor establish the named install root,
stock/watchdog session, disable flags, transport, boot or consumed trial
intent. Their fds are not standalone exec authority. A future device-side
collector/guardian must join those checks immediately before the admitted
fd-based exec, and independently prove post-exec protection. On glibc 2.23
the [fexecve implementation](https://man7.org/linux/man-pages/man3/fexecve.3.html)
uses mounted `/proc`; a modern execveat-only assumption is unsuitable.

Linux/root fixtures use only fabricated ARM headers and private `/dev/shm`
files to exercise hash/fd/identity/mode/xattr/replacement/RAM rejections.
No ELF is executed. A tmpfs-specific test type does not change the production
ext4 alias or introduce a runtime filesystem override. This is still source
preparation, outside HACS and without physical initial-install proof.

## Remaining activation and hardware gates

### Device-side one-shot intent primitive

initial_trial_intent.h implements only the future guardian's own persistent
marker. Its production alias requires the already admitted root-owned 0700
ext4 directory, exact root device/inode, current kernel boot and the creator
process birth. The binding contains the exact plan, bridge/guardian SHA,
RAM identity and correlation nonce, without any credential or profile body.
Opening/validating it is read-only. Claim consumes the in-memory attempt
before O_EXCL creation of the one fixed initial-trial.intent file, then checks
private metadata, complete bytes, file/directory fsync and independent held/
named readback. The filename does not depend on a new nonce.

Existing, empty, partial, linked or substituted markers are preserved and
refused. A failed/ambiguous write is never retried or cleaned up. An existing
record cannot be adopted by another process/object to mint a launch: only its
verified creator may consume one in-memory fork authorization. That grant
must be consumed in the guardian before fork; it is not a transferable JSON
flag or proof for a child to reuse after fork.

This primitive does not validate the named device root/stock/disable scope,
consume the separate host intent, fork or execute firmware. A complete
standalone guardian must join those independent gates and the child timer.
It is outside HACS and has not written anything on a monitor. Linux/root
fixtures exercise private tmpfs creation/readback, stale/partial records,
tamper refusal, creator identity and two processes racing for exactly one
marker. Host fsync/readback is not a physical NAND/power-loss guarantee.

### Device-side pre-intent filesystem scope

`initial_trial_filesystem.h` implements the read-only filesystem portion of a
future device collector. Production walks only `/data/.esphome-cgs1` from the
root descriptor, opening each directory without following symlinks. Data and
the private root must be the same ext4 filesystem, with the exact expected
root device/inode. Independent fresh walks before and after content checks
must still point at the held root; a renamed old directory is not current.

The fixed nine staged payload entries must match their exact private plan
size/SHA, root ownership, one link and staging mode. Both empty 0600 opt-outs,
the exact `install.intent` plan binding and the exact private commit-lock
owner are checked by bytes and metadata. Complete bounded directory listings
must initially contain only that set, and only `owner` inside the commit lock.
This positively rejects autostart stores, partial replacement debris,
rollback history, prior trial markers and unknown files. Nothing is removed,
repaired, chmodded, executed or created. Reads use no-atime descriptors.

The reader seals after observed replacement, changed bytes/mode/owner/link,
incomplete reads or another open attempt; putting old bytes back does not
revive it. A returned read directory fd needs another complete readback.

A newly created trial marker does not automatically preserve the initial
observation. The one-shot `acknowledge_intent` transition requires the actual
already claimed intent object: its independent record/boot/creator checks
and exact root/plan/bridge binding must match. All original payload/flag/
marker/commit-lock pins are checked again, with complete listings admitting
exactly the one additional fixed marker. Fresh named-root walks must agree
before/after that readback. Only the expected directory metadata change is
then rebased; no original file snapshot is reset or silently readmitted.

There is no ignore-marker flag, adopted record, retry, cleanup or write in
this transition. An opened but unclaimed actor, copied text, wrong root/plan/
bridge, previous reader failure or repeated acknowledgement refuses. A new
reader still rejects pre-existing trial history. Acknowledgement consumes no
fork grant and is not launch authority; the separate intent, full device
scope and owned-child flow remain mandatory.

The intent object must outlive the joined reader. Each subsequent claimed
check verifies that creator-owned live record again; an inherited fork-child
copy cannot use the parent's proof. This is a parent-side filesystem join,
not complete stock/resource monitoring or proof after a vendor firmware exec.

This does not validate a host receipt's terminal state, admit arbitrary plan
pins, inspect vendor files or collect device/USB/boot/stock/resource scope.
Those independent gates still precede any launch. Linux/root fixtures only
construct private tmpfs trees; they exercise exact listings, pins, markers,
flags, hardlinks/symlinks, payload/ancestor replacement and permanent refusal.
Joined fixtures claim only their own private tmpfs marker, test the actual
creator/plan/root/bridge binding, stale/unclaimed/repeated joins, unchanged
parent proof after fork-child refusal and tampering after acknowledgement.
The compile-time tmpfs fixture seam cannot override production paths at
runtime. This remains source-only engineering without a device write.

### Admitted child-entry source

`initial_trial_exec.h` prepares only an inert child entry from the read-only
image and initial RAM readers. A production instance still requires the exact
ARM image/private ext4 admission. It rechecks both readers in the protected
fork child, validates its actual parent birth, TERM/PDEATHSIG/NNP/OOM state,
and enters the admitted RAM directory by fd. There is no path-based cwd.

Before fd-based exec it replaces stdin/stdout/stderr with the actual
`/dev/null` character device and closes every other inherited descriptor
except the close-on-exec image. A bounded complete `/proc/self/fd` scan must
succeed; uncertain close results refuse rather than retry. Transport sockets,
private profile handles and terminal/log pipes cannot be passed through as
ambient firmware inputs. Output is discarded, not written to NAND or an
unbounded guardian log. The fixed argv contains only `cgs1-initial-bridge`;
the entire environment is exactly `ESPHOME_PREFDIR=./prefs`, `LANG=C` and
`LC_ALL=C`. Inherited loader variables and credentials are not forwarded.
An exec error returns failure to the child exit path, with no shell, named
path fallback or second exec. Parent cwd/fds/environment/OOM/NNP stay intact.

This is not the complete guardian or a trial authorization. The caller must
still join the fresh named device/stock/flags/boot/resource scope, consume
both host and device intent, and release only its one owned child. Admission
reports cannot mint that authority. Post-exec vendor-kernel protection,
measured resource footprint and physical fallback remain unqualified.

The explicit Linux/root fixture execs only a private native copy of itself
and verifies the actual cwd/preferences write, exact argv/environment,
descriptor closure, stdio/protection and unchanged parent. Separate negative
cases refuse a parent call, changed parent/RAM identity, missing PDEATHSIG
and a non-CLOEXEC image. Fabricated ARM headers test only inert admission;
there is no native-architecture production override or firmware execution.

### Pre-start kernel resource evidence

`initial_trial_resources.h` adds portable parsers and a separate Linux-only
read-only collector. Production opens only fixed `/proc` fields on verified
procfs; the test root exists only in a compile-time fixture type. No socket,
controller, shell or file writer is involved. Only verified status, a
conservative free-byte count, monotonic observation time and fixed refusal
category leave the reader; raw TCP tables and peer addresses are not exported.

Memory requires unique `MemTotal`/`MemFree` fields with KiB units and at least
32 MiB genuinely free at both ends of the observation. It returns the lower
of those readings. `MemAvailable`, cache, buffers and swap grant no credit.
Both IPv4 and IPv6 TCP tables must be fully readable within bounded byte/line
budgets and have recognized headers/addresses/port fields. Any local API 6053
or OTA 3232 entry refuses, in every state. Missing IPv6, malformed or oversized
data is unverified, never an empty/free table or a previous positive result.

An observation taking more than one second is refused after reads return.
This is a freshness gate, **not a hard kernel-IO timeout**, a measured monitor
performance/footprint guarantee, OOM protection or a port reservation. A
subsequent process can bind a port after a read. The future full collector
must join fresh resource evidence with the exact device/boot/stock scope.
This reader is pre-start only; after the bridge starts its API endpoint is
expected to be in use, so running-child ownership needs a separate live check.

Portable fixtures use synthetic strings. The explicit Linux/root fd fixture
reads only private tmpfs files and tests full reads, missing/changed/oversized
tables, symlinks/FIFOs/wrong ownership and refusal after a previous positive.
It does not inspect a monitor or prove vendor procfs/runtime performance.

### Host-side joined pre-trial review

review_initial_trial.py is a read-only engineering review, not the missing
standalone guardian. It requires the exact completed own disabled-commit
receipt and remote owner marker, both patched scripts/opt-outs, and two fresh
complete fixed USB/boot/root/vendor/source/stock reviews. It also checks
absent full-release/Wi-Fi/stock-bridge/native preferences stores and boot
launcher lock, no own NAND/RAM program, free API/OTA TCP endpoints, and one
pre-existing empty private tmpfs scratch directory with a stable device/inode.
The review does not create that directory or provide an execution command.

Complete successful directory listings establish absence; a failed/partial
listing, unreadable IPv4/IPv6 table, unknown file or changed RAM identity
refuses. Raw peer addresses, generic process arguments and INI bodies are
not exported. RAM uses a conservative MemFree lower bound with no cache,
buffer or swap credit: upstream [MemAvailable started in Linux 3.14](https://man7.org/linux/man-pages/man5/proc_meminfo.5.html),
after the stock 3.10 kernel. Tmpfs storage capacity is checked separately.
These are admission floors, not measured application memory consumption.

The returned host observation deliberately has image_fd_admitted=false,
device_fd_admission_completed=false and execution_authority=false. The pure
policy now binds the exact RAM identity and requires actual device-side
image-fd admission, so that report alone cannot issue a start. No guardian
digest, intent, fd proof or successful installation is fabricated. Simulated
target joins and isolated shell parser fixtures do not qualify hardware.

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
