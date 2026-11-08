# Monitor 1 USB — experimental installer

**English** · [Русский: пошаговая инструкция](README.ru.md)

The HACS integration includes this shared wizard. The legacy standalone app
remains available with its old private data; it is not required for new jobs.
The wizard offers two USB locations for identification, private capture and builds:

- **Computer USB:** Chrome/Edge WebUSB talks directly to the selected monitor.
- **Home Assistant server USB:** the integrated worker's local ADB reads the selected USB
  device on the server. The browser needs neither WebUSB nor a local cable.

Both derive the fixed identity/file checks from
ports/monitor1/preflight_adb.py. They admit only CGS1 stock 4.1.8_0287,
ARMv7 and CO2 type 2/S8 or 3/SCD40, with the exact factory fingerprints.
An existing modified installation is refused by this first-install check.
It must use its own upgrade/recovery flow.

The HACS Monitor 1 card opens the integrated wizard using actual HA admin
identity. It uses no Supervisor ingress, separate app install or extra HTTP
listener. Heavy builds run in a child/venv; the HA interpreter is unchanged.

For **server USB**, an explicitly reviewed experimental action now composes the
original disabled staging, script commit, bounded bridge trial and next-boot
bridge arming. A separate button reads the result after you power-cycle the
monitor yourself. **First installation on an untouched physical CGS1 has not
been verified.** This path installs the stock-side bridge only; the computer
browser-only WebUSB writer is now composed experimentally; fresh full native UI hardware qualification remains outstanding.
A separate downloaded computer ADB installer reuses these engines without a
compiler or VM on the computer; see its section below. Normal
HACS CGS1 admission remains source-only and `installation_ready=false`.
See [USB_TRIAL.md](../../ports/monitor1/USB_TRIAL.md) for the underlying engine.
Source tests, container checks and an imitated UI run are not hardware evidence.

New matching builds also offer a separate **Run a 60-second screen trial**
after positive Full UI prerequisites and an explicit acknowledgement. The
same coordinator is used by the computer CLI's `full-trial` command. It uploads
only the pinned native/guardian pair to RAM; both existing device guardians
enforce the deadline and restore stock independently of the host. Native
physical core readiness and stock return are observed, while permanent boot
stays off. `full-trial-status` reads the computer's local receipt without USB
or engine execution. Lost replies never reissue uploads/launch; old jobs remain
unchanged and refuse the new capability. After a successful trial, the separate
**Save and start the full interface** step requires both a human screen/touch
check and an independent permanent-start acknowledgement. It measures actual
storage before copying the matched pair, enables startup, resets only that
completed trial session and starts the saved pair once without a reboot.
Fresh physical readings and two guardian generations must match the new device
session. A lost enable ACK stops; a lost start ACK permits observations only.
Keep USB on the same Linux boot as the trial. The computer commands are:

```sh
.runtime/bin/python computer_install.py full-activate --serial USB_SERIAL --plan-sha256 SHOWN_SHA --experimental-reviewed --screen-reviewed
.runtime/bin/python computer_install.py full-activation-status
```

The second command reads local history without USB/ADB/engine execution. Never
repeat the first after a lost reply. An uncertain durable attempt blocks other
writers, even after server restart. The initial PM-extension transition is described below; automatic HA
enrollment remains unfinished; software tests do not qualify an
untouched device or enable CGS1 Bluetooth or Monitor 2.

## Initial Full UI prerequisite

After the first bridge boot, **Check Full UI prerequisites** may offer
**Prepare Full UI**. A wrapper mismatch alone is insufficient: the original
USB observer must positively verify the exact disabled stock, original arm
completion, current bridge/boot and physical wire readings on that same boot.
Review the separate acknowledgement, then **Prepare the next boot** once.

The fixed SDK child rechecks the private original plan and live process/file
scope. Before clearing the persistent PM opt-out, it creates the existing
RAM inhibition marker so an unrelated stock restart cannot load the extension
in this boot. It preserves a flag backup, owner lock and AFTER-effects record.
It never signals SnowApp, uploads code or reboots. A lost reply permits only
reading the completion record and saved result, never replay or rollback.

After a confirmed result, power the monitor off and on through its normal
controls, then check Full UI prerequisites again. The screen trial and
permanent-start steps remain independent. Computer commands use the same engine:

```sh
.runtime/bin/python computer_install.py pm-enable --serial USB_SERIAL --plan-sha256 SHOWN_SHA --experimental-reviewed
.runtime/bin/python computer_install.py pm-status
```

`pm-status` reads local history without USB/ADB/engines. Do not power-cycle
or repeat a write while its outcome is uncertain. The computer's later screen
trial requires the exact PM completion, a different boot and the actual Full
UI preflight; it never relabels the original bridge-only observer's scope.
These software and rewritten Linux/root tests are not untouched-device QA.

## Install and open

For server tools, use Home Assistant 2026.11 on Alpine3.24, x86-64 or ARM64
(official HA OS/Core images). Other Linux/container hosts are not yet qualified;
manual USB mapping remains the container owner's responsibility.

1. Install/update this integration through HACS as usual. Open **Qingping ESPHome**
   as a Home Assistant administrator and choose **Air Monitor 1**.
2. Open preparation. In **Prepare server tools**, choose **Prepare tools**.
   The first setup needs internet and 6 GiB free; downloads stay in private
   storage. Exact signed APK filenames/SHA are verified and extracted without
   installing system packages. This does not start ADB or touch USB.
3. Connect the USB-C **data** cable to the chosen computer/server. Enable
   ADB on the stock monitor, then restore its real Wi-Fi connection.
4. Choose the USB location. For server USB, find and select the monitor;
   for computer USB, use Chrome/Edge with HTTPS and the native USB picker.
5. Perform the read-only connection check and **Save original files**.
   Neither operation installs firmware.

The integrated worker uses `.storage/qingping_esphome_monitor1` under HA's
config directory. It does not copy, remove or resume old standalone-app jobs
under `/data/jobs`. Keep both histories/backups. Native tool prefixes are
immutable and each new job binds its exact prefix and profile. Unsupported
server platforms refuse clearly, without changing HA system packages.

The private `qingping-cgs1-capture.tar` uses regular files with mode 0600
and directories with mode 0700. It contains original vendor binaries and
device identifiers: keep it private and never publish it as a firmware asset.
It is a fixed build/recovery set, not a full NAND or user-data backup.
Every copy has a fixed size/SHA, followed by fresh source/identity checks;
an incomplete or changed capture offers no partial archive. Server copies
exist only in a private temporary folder and the owned download response;
the global USB lease remains held until delivery finishes. Browser capture copies stay in memory until the local download. The separate
profile preparation action explicitly sends them to your own HA companion;
they are not persisted in the browser or sent to a public build service.

Server capture includes the actual native USB path and canonical preflight
report. The browser cannot observe ADB's native `get-devpath`: it records a
separate browser capture stage, never invents that field and cannot be used
as an ordinary native ADB plan without the future browser transport adapter.
Neither archive creates or reopens an install/launch/OTA intent.

## Prepare a private profile

Enter the device name and choose **Prepare device profile**. Computer mode
opens a fresh USB picker, captures and verifies the original files, then sends
that archive to the integrated worker on your own HA server. Server mode performs its
own fresh USB capture. Neither route needs or changes your Wi-Fi password.

The integrated worker creates a private owner-bound job under its HA storage, with
an individual Noise key, a stable separate API MAC and the verified stock Qt
input. The profile/key and captured vendor files never appear in ordinary HTTP status,
public GitHub assets, normal logs or browser storage. Preserve this private
data/backup securely: deleting it also loses these recovery/build inputs.

A request ID is consumed before key generation. If its reply is lost, the page
reads that same job's status instead of submitting it again. After a reload,
choose from **Available saved preparations** and check its status. Interrupted
preparations remain visibly unverified; they are never regenerated or resumed
automatically. At most eight jobs are retained without automatic cleanup;
explicit job cleanup is not implemented yet. Unknown/unreadable entries are
preserved rather than treated as safe deletion candidates.

A prepared profile is **not built or installed firmware**. Archive identity is
an untrusted historical claim; every future device operation still requires its
own live USB identity/source checks. A browser capture never invents ADB's
native USB path. The build action below is available for either capture; the
experimental writer requires a server USB capture and its own later review.

## Build on the HA server

With a prepared job selected, choose **Build private firmware**. The same
HA companion builds for either cable location; the monitor need not stay
connected during compilation. No compiler/VM runs on the browser computer.

The worker fetches the fixed reviewed public commit
`53d97b9609e8e0fcdfc5d003101f620098dbc734`, creates its isolated pinned SDK and
calls the canonical `build_candidate.py`. It links your verified private Qt
input and individual profile, builds the matched guardian/native/bridge and
initial trial guardian, then checks the actual output hashes. Private inputs,
programs and logs stay in this app's `/data/jobs`; no public build service or
GitHub artifact receives them. Internet downloads are public source/tools only.

This fixed screen-trial source applies only to new builds. Existing jobs from
the previous reviewed `0de9c99e` (app0.0.9) and `e09440f9` sources retain their original source,
programs, keys and plans. Status and explicit computer export verify the same
source throughout the intent, candidate, plan and downloaded bundle; membership
in the reviewed set never permits mixing two revisions. Updating the app does
not rebuild, restart, relabel or install an old job. Incomplete historical jobs
still block new builds and cannot be adopted or replayed.

The worker uses one logical CPU with nice 10 and sequential compilation.
It requires 6 GiB free before starting, stops its own process group if free
space falls below 512 MiB, and has a two-hour total bound. The minimum free
space check is not a storage reservation. An incomplete older build also
blocks a new build after restart; a PID file never authorizes adoption or a
second process. Existing jobs, keys and logs are preserved on failure.

Starting consumes a durable intent before the worker is created. Lost replies
are reconciled with status reads only. Closing/reopening the page does not
restart a build: select the saved job and check its state. An app restart can
make a still-running old build unverified until its own terminal receipt is
available; do not start a replacement or delete its history.

**Built is not installed.** The experimental browser writer still needs
physical first-install qualification. Neither a complete compile nor a synthetic
SDK/container test establishes device compatibility, live USB authority,
Bluetooth proxy support or safe activation. Monitor 2 stays unverified.

The pinned [Zig 0.14.1 distribution](https://pypi.org/project/ziglang/0.14.1/#files)
provides musllinux wheels for both ARM64 and x86-64. CI separately checks the
actual companion image's pinned SDK imports and compiles a synthetic ARM32
program; this check uses no monitor, vendor Qt library or private firmware.

## Prepare the installation files

For a completed **server USB** job, choose **Prepare installation files**.
The companion rechecks the public source closure before running the original
bootstrap patch preparer and offline planner in that job's SDK. It verifies
all generated payload bytes and their exact target/profile binding, syncs the
private output and records completion. No ADB command or device write occurs.

The page reports a requested device free-space budget, **not measured free
capacity**. The real USB writer must still perform its own live identity,
source, boot, process and capacity checks. A prepared payload never changes
installation readiness, starts a trial or grants another consumed operation.

A lost response or reload reads the same private plan status. An interrupted
or failed preparation preserves its inputs, log and history without replay.
The browser WebUSB writer uses its separate typed plan; its capture is never
relabelled as native get-devpath evidence to pass the native planner. The
private profile/build can finish without keeping USB selected.

## Install with the computer's USB

After a completed build, choose **Download private computer installer**. This
works for either original cable location, before an HA installation attempt.
It exports the exact private profile/programs, fixed public source closure,
matched helper and local entry script. No SDK, build cache, old USB plan or
installation history is copied. The archive is at most 64 MiB, is available
only to its HA owner, and contains the individual Noise key: keep it private.
Downloading it does not contact USB or start installation.

This is an experimental **macOS/Linux terminal** route using Android
platform-tools (`adb`) and Python 3.13+. It is not a completed browser-only
writer. The computer installs only the small runtime requirements; all firmware
compilation stays on HA. No Docker/Colima/VM or local compiler is started.

Read the included `README.txt`, also available as
[computer-instructions.txt](rootfs/computer-instructions.txt). In a private
directory, run `umask 077`, extract `qingping-cgs1-computer.tar`, enter its
directory and prepare a runtime:

```sh
python3 -m venv .runtime
.runtime/bin/pip install --only-binary=:all: -r runtime-requirements.txt
adb devices -l
.runtime/bin/python computer_install.py prepare --serial USB_SERIAL
```

Replace `USB_SERIAL` with the actual local USB serial. This read-only command
checks every bundled body and the original candidate ELF/helper pins, captures
the nine factory files **again through native ADB**, and prepares a new plan.
It binds the actual local `get-devpath`, boot and profile; a previous browser
or server report is never relabelled to pass the native writer.
Wheel-only dependency installation refuses an unsupported platform instead of
starting a local compiler. Do not install a VM to work around that refusal.

App 0.0.10 also exports an offline receipt reader. If preparation output was
lost or USB is disconnected, run:

```sh
.runtime/bin/python computer_install.py local-status
```

This checks the saved plan SHA/profile/source binding and reads local receipt
metadata only. It needs no serial, ADB discovery, device engines or connection.
`plan_recorded` can recover the plan SHA; `install_recorded` describes a
historical receipt, never current boot/health. Partial/corrupt history stays
unverified, unchanged and without retry authority. Use the separate USB
`status`/`observe` commands below for live checks; they still require a serial.

Review the reported name, physical WLAN, S8/SCD40 and exact plan SHA. Only then:

```sh
.runtime/bin/python computer_install.py install --serial USB_SERIAL --plan-sha256 SHOWN_SHA --experimental-reviewed
```

Substitute the displayed SHA. The same original stage/commit/trial/arm engines
and their live checks run once, with a durable local attempt recorded first.
Keep USB and power connected. Unknown results are not retried or automatically
rolled back. Preserve the whole private folder and `computer-state`:

```sh
.runtime/bin/python computer_install.py status --serial USB_SERIAL
.runtime/bin/python computer_install.py observe --serial USB_SERIAL
```

Only a fresh `observe` result of `awaiting_reboot` confirms idle-stock arming.
Then shut down through the monitor's menu, power on and run `observe` again
with the same USB port/cable path. `bridge_observed` requires a different boot,
exact running images/listeners and fresh authenticated readings. No command
reboots, repeats installation, adopts a PID or changes normal HACS readiness.
The HA page cannot see local receipts: do not start a second server-USB install
for that monitor. Existing modified installs use their separate upgrade path.
Physical first-install QA for this route remains outstanding.

## Experimental server USB installation

Keep the same monitor connected to the HA server. With the private plan ready,
open its review and check the displayed device name, physical WLAN MAC, stock
version and S8/SCD40 backend. Read the changes and acknowledge the experimental
status before pressing **Run experimental installation**. The checkbox is cleared for a
new review; changing interface language does not submit or repeat an operation.

The fixed controller rechecks the original source/USB/boot/process/capacity
scope, stages the disabled own files and commits the two exact startup scripts
with preserved originals. It runs the original independent 60-second bridge
trial. Only a verified stopped trial with completed owned ADB/forward cleanup
can enter the separate next-boot arming step. That step preserves recovery,
leaves PM preload disabled and does not start or reboot a program. Native UI
and guardian programs intentionally remain on the server at this stage.

Full UI has an additional concrete prerequisite: the original
[stock preflight](../../ports/monitor1/network_preflight.h) requires a verified
stock PM-extension session, including its per-boot attempted marker and the
absence of `pm-helper.disabled`. This first-bridge route deliberately retains
that opt-out. Uploading the native/guardian pair alone cannot satisfy this
gate. A separate verified extension transition and full lifecycle are needed;
the wizard does not bypass that check or offer a fake completed Full UI mode.

After verifying the bridge's new boot, **Check Full UI prerequisites** reads
the actual native USB/current boot, exact bridge file, authenticated API
identity and the matching native/guardian manifest, then calls only the
original `full_runtime_status` and read-only `full_runtime_inspect_start`.
It explains `pm_extension_required` separately from an unknown or busy state.
The same optional read is available in a newly downloaded computer package:

```sh
.runtime/bin/python computer_install.py full-review --serial USB_SERIAL
```

Even `full_ui_preflight_observed` stays `installation_ready=false` and
`launch_authorized=false`. It is a snapshot requiring a new check before any
future operation, not Full UI installation. API disconnect and the exact
acknowledged owned USB forward are retired independently; an unknown cleanup
cannot become a positive result. No PM flag, program upload, launch, reboot,
session reset or cache cleanup is exposed by this read.

The attempt is recorded before any controller starts. A lost response, page
reload, language switch or app restart never grants a second installation.
Use the saved job's status and **Check the monitor**. An unknown result
is not proof that the monitor was unchanged; do not delete the job, prepare a
replacement or repeat the engine manually. Its original receipts and inputs
are needed to review the result. There is no automatic rollback or reboot.

After the operation reports arming, choose **Check the monitor** for a fresh
device read. Only when that read confirms waiting on the idle stock boot,
shut down through the monitor's own menu and power it on again. Reconnect server USB if
needed and choose **Check the monitor**. The reader distinguishes the
original boot's completed arming from a different boot with the exact bridge
process/socket and two fresh authenticated sensor updates. It does not launch
anything. A saved success is historical evidence; a new read is required for
current health. An unverified read does not authorize another install or an
automatic reboot. Read observations are retained privately, up to 64 per job.

## Keep private recovery files

For a prepared job, **Download private ESPHome profile** saves its original verified
profile, including the individual ESPHome Noise key. Only the owning HA
administrator can explicitly download it. The browser treats it as an opaque
attachment: it is not rendered in the page, parsed into form state, or stored
in browser storage. Keep it outside public repositories and screenshots.
Automatic ESPHome enrollment from this app is not implemented.

**Download saved original files** rechecks the saved nine files and report and
creates a private fixed-member archive. This remains available after the
first-install factory check would refuse an already modified device. It reads
the saved job only, makes no USB call and is not a new capture or full NAND
backup. Keep both downloads and a secure backup of the app's private data.

## Connection and access

Computer mode needs Chromium over HTTPS (localhost is also a secure context).
If its USB interface is occupied, release it in the other application yourself;
the app never kills another ADB process or changes drivers.
Server mode uses the companion's USB mapping and does not need browser USB.

The app starts only manually. It needs raw USB, not full-access mode, UART,
GPIO, host network, Docker socket or HA API permissions. It publishes no host
ports or LAN ADB listener. HTTP accepts only the actual Supervisor ingress
peer with its user identity, and binds a fresh page nonce to that owner.
Unknown users/peers, malformed selectors, TCP devices and arbitrary commands
are refused. No original ADB exceptions, INI body, keys or generic process
arguments are logged. Browser authorization keys are fresh and RAM-only.

## Build and source checks

The browser bundle is shipped offline with MIT notices, no CDN or analytics.
To rebuild it:

```sh
python tools/monitor1-usb/generate_contract.py --check
npm ci --prefix tools/monitor1-usb --ignore-scripts --no-audit --no-fund
node tools/monitor1-usb/build.mjs
node tests/test_usb_probe.mjs
python -m unittest discover -s tests -p 'test_usb_*.py'
```

The generator checks both browser and server contracts against canonical
Python pins. CI rebuilds the committed bundle, builds the app container
without USB/network mappings, and checks that its actual HTTP server refuses
unauthenticated local access. No Docker/Colima VM is needed on the Mac.

Official implementation references:
[WebUSB picker/gesture](https://tangoadb.dev/tango/daemon/usb/request-device/),
[ephemeral ADB credentials](https://tangoadb.dev/tango/daemon/credential-store/),
[HA ingress](https://contributors.home-assistant.io/apps/guides/ingress/),
[USB mapping](https://contributors.home-assistant.io/apps/reference/configuration/).

## Legacy standalone app

Existing app users can retain its native Supervisor admin ingress and old
`/data/jobs` history. This path is separate from new integrated jobs. Installing
or updating HACS never uninstalls the app, copies private keys/history or
replays a consumed operation. New users do not need to add the app repository.

Regenerate the shared HACS engine/UI with `python tools/monitor1-usb/package_core.py`
after rebuilding the offline bundle; CI runs its `--check` mode.

### Add to HA after permanent startup

The integrated HACS wizard offers “Add to Home Assistant” after a verified
permanent Full UI startup. Keep USB connected and the monitor on HA's local
network. Confirm the step: the wizard reads the current address from the
monitor, verifies its encrypted LAN session and uses the standard ESPHome
config flow. No IP/key copy is required. Existing conflicting entries need
a separate decision in HA settings. Lost responses never replay the flow;
“Read HA enrollment status” only reads history/current entries, not live
device health.

The legacy USB app and computer CLI have no HA configuration authority. After
computer installation, add the ESPHome integration through Settings → Devices
& services, using the address displayed by the monitor and the
`api_encryption_key` from your private profile. Never publish that profile or
key. First installation on an untouched physical CGS1 remains unqualified.

### Browser USB preparation in the development branch

Stable HACS 0.2.10 does not yet offer a browser first-install button. The source
branch has the private stage → disabled commit → bounded bridge trial → next-boot arming pipeline
described below. The private boot observer also joins original arming history, the full native
kernel/file scope and fresh authenticated sensor updates. The private PM next-boot join and post-PM Full UI review/RAM trial are also connected.
The finite experimental browser UI now also composes permanent startup and native HA enrollment. An untouched CGS1 has not
yet been tested; existing working monitors must not be reset to imitate one.

After a private build, a computer USB job has its own **Prepare installation
files** step. It retains the browser capture instead of inventing a native USB
path. **Select and check the computer USB monitor** opens a new Chrome picker
and compares the actual connection, boot and fixed factory files with that
build. This read grants no cached write permission. A lost preparation response
can only read the same job's status.

The internal pipeline keeps its original owner/page/channel, task reservation,
worker process, consumed intent and deadlines. JSON IDs, copied metadata,
restarted actors or another task cannot acquire those continuations. Its ten
trial producers are pinned: changed source/contract bytes refuse old consumed
attempts. Native ADB paths/receipts are never fabricated for WebUSB.

1. **Stage and disabled commit.** Check the fixed source/identity/ext4 scope,
   consume the actor journal before device IO, create only the disabled own
   root and both opt-outs, and transfer the nine canonical files with the
   pinned Tango SYNC-v1. Check remote metadata/SHA independently. The separate
   guarded vendor commit repeats the original scope/CAS gates; it neither
   activates a runtime nor enables boot. Each phase requires actual USB close,
   a separate channel-close ACK and its original actor's terminal record.
2. **Prepare the first trial.** Rehash the exact owned terminal commit,
   profile/plan and separately built guardian in the existing SDK. Read the
   committed scope twice, including positive store/process/TCP absence and
   conservative MemFree. The harmless exec probe must succeed before consuming
   a new trial intent. Allocate only new 0700 tmpfs jobs and an exclusive empty
   0600 guardian file. Upload once, then recheck full remote SHA/mode/UID/nlink,
   original directory/file inodes and source scope around both readback phases.
   Unknown effects are retained, never pruned or retried.
3. **Run one bounded guardian.** `run_guardian_trial` accepts only the original
   live RAM object and awaits all existing continuations inline. It rehashes
   the original SDK/plan/commit/guardian around start and after END. The sealed
   launch body derives all forty arguments from the frozen native source and
   checks exact bytes before shell parsing. Only its fixed RAM chmod precedes
   launch. START/CHILD/END parsing preserves uint64 birth ticks and final raw
   EOF/close. The device's independent 60/5/5-second stop/reap loop is unchanged;
   Core never signals a reported PID or sleeps to manufacture an END.
4. **Observe real encrypted messages.** A separate private actor/Core MIME
   carries the key; no browser frame, status, HTTP or SDK input receives it.
   The same selected handle provides only tcp:6053 through a Core-owned
   loopback. Every open repeats full fixed scope; an opaque read may coexist
   with the two-second scope checks. DeviceInfo name/MAC and unique physical
   sensor keys must match. At least two accepted vectors ten seconds apart
   need new callbacks for every physical field, finite valid readings, fresh
   stock-response age and wire timestamps. The original 30-second connection
   and 50-second observation ceilings reserve five seconds for cleanup. API
   teardown requires its actual ACK and keeps USB for END/return reads.
5. **Verify stop and return.** Core joins the original Noise object to exact
   child/reap records, its own END reception at least sixty seconds after issue
   and a last accepted wire age no greater than twenty seconds at that instant.
   The original selected channel reads two complete frozen stock/vendor/intent/
   RAM passes in one five-second window. The strict process scan admits no own
   program. Stable context must agree; only measured free RAM may change.
   The generated 43/45/46-read tail never fabricates live process rows.
6. **Close and record.** A separate null return-close frame awaits the actual
   original USB close; Core independently awaits channel-close ACK. Only the
   original closed continuation can send one private terminal record. The actor
   independently verifies exact binding, START/CHILD/END/reap, wire identity/
   count/age, original returned roots/RAM/stock/flags and both closes. It requires
   its still-retained original lease, writes the immutable completion with
   O_EXCL plus file/directory fsync, then releases that host lock. The result is
   historical `browser_initial_trial_stopped_observed`: installed, activated and
   installation_ready remain false. Lost record replies allow status reading
   only, never another record/launch. Orphan, malformed or changed-producer
   history stays fenced across restart; status cannot adopt a lease.

All device commands remain fixed and bounded, without caller PID/path/command
selectors. The 32 logical scope-read budget and original transport lifetime
remain shared. Sealed stdin receives and verifies the complete length/SHA body
before interpretation; truncated shell lines are never executed. Lost packet,
ACK, scope or close retires only the owned connection and preserves uncertainty.
No automatic retry, rollback, reboot or permanent activation is added.

Host tests join actual aioesphomeapi Noise, loopback/finite frames, the private
actor and real fsync/flock. Device USB replies, scope and elapsed clock are
synthetic. Raw and delivered browser bundles also test actual transport close
separately from channel ACK. These tests establish source composition and
refusal behavior, not physical sensor values, device timer/FD admission or a
first installation. The frozen firmware/native source is not rebuilt here.

The next-boot adapter now also has pure generated before/arm/armed/completion
text. Sixteen vectors match the unchanged native builder byte-for-byte, including
recovery flag before bridge-opt-out removal and the correlated completion SHA
and byte count. Nineteen refusal cases and syntax-only parsing pass. The pure
module alone enables no button or writer. Its separate consumed execution join
now performs the fresh reads and actual close proofs described below.

The private next-boot preparation now reads the exact stopped browser journal
and all nine arming source pins. It derives the size/SHA of the original
`initial-trial.intent` that remains on the monitor. A separate fixed selected
collector verifies that known file in both root passes, plus the original
stock/vendor/root/flags/resources. Unknown extra files still refuse. Core
rechecks the private context after USB IO and awaits owned channel closure.
This read grants no arming intent/lease or native trial receipt; the separate
consumed flag transition and terminal proof are described below.

The private arming composition now joins those prerequisites in the original
reserved Core task/actor. It probes fixed sealed stdin before consumption,
collects fresh stopped scope, then fsyncs a separate arming intent before any
flag-changing frame. The exact canonical before/arm/armed/completion sequence
saves the empty recovery backup before removing only the empty bridge opt-out;
PM remains disabled. A separate double-pass armed collector checks original
roots/source/vendor/stock, positive flag entries and both trial/completion
markers. Actual USB close and independent channel-close ACK precede the actor's
immutable terminal record and lease release. Lost packet/phase/close/record
replies never repeat a write or auto-roll back. The historical result is armed
for the next ordinary boot, with installed/activated/readiness false. No reboot
or process launch occurs here. Real host/transport tests use synthetic device
replies; physical first-install and the later boot observer remain separate.


The private post-boot adapter never performs a reboot. With the original boot
still current, it rechecks the armed state and reports waiting without opening
API. A fresh selected connection after a normal boot checks the canonical 64
read operations, actual executable images and process births/parents. The Core
Noise client then requires exact identity and two fresh physical wire vectors,
including stock-response age, at least ten seconds apart. API-close, final
scope/freshness, actual USB close and separate channel ACK are independent.
Its read result does not install, activate or grant a subsequent writer. The
host tests emulate the monitor; physical first-install qualification is pending.


The private PM2.5-extension adapter first repeats the full current scope and
real Noise observation. A separate harmless full-size stdin probe tests the
64KiB receive/hash/shell-argument path before any PM intent; old transports
retain their 32KiB ceiling. The actor then durably consumes one distinct PM
attempt under its original shared kernel lease. Only the existing canonical
next-boot command runs: it inhibits loading for the rest of THIS boot, backs up
the verified opt-out, clears it and records AFTER-effects. A separate fixed
read verifies those effects; actual USB close and separate channel ACK precede
terminal persistence. It never loads the helper now, signals stock or reboots.
Packet/ACK/close loss preserves uncertainty without replay. The finite public wizard composes this separate step; physical first-install
qualification remains outstanding.


The private post-PM Full UI adapter now has a separate original-click selection
with fixed 900-second, 256-MiB aggregate ciphertext, 131072-frame and 1024-open
limits. Ordinary channels keep their four-minute/8-MiB limits. These counters
allocate no image-sized browser buffer and cannot renew a selection or grant a
writer. Original PM intent/proof, source/profile/pair and two current fixed
bridge-image observations bind the read-only `status`/`inspect_start` review.
The PM-armed boot itself reports waiting without opening API or reading a key.
The private Full UI RAM trial separately consumes/fsyncs its own journal before
handing its matched private pair to Core's existing fixed 60-second API engine.
It requires two native guardian observations, physical readiness, stock return,
closed API, actual USB-close and separate channel ACK before its terminal record.
Ambiguous body, write, launch or cleanup never replays or adopts another lease.
Keys and plaintext image bodies stay on the private actor/Core side; selected
browser frames carry encrypted API bytes. Pure fixtures and real host Noise
prove software composition only. The finite public wizard now composes permanent/enrollment adapters too; no pristine-device, timer,
physical screen/touch or firmware support qualification follows from host tests.


### Integrated experimental browser walkthrough

The source wizard now offers eight separately consumed computer-WebUSB steps
inside the single HACS package. Stable0.2.10 predates these new buttons. Fresh
CGS1 hardware qualification is still outstanding; this is stated beside the
available experimental controls rather than disabling owner testing.

After private profile/build/payload preparation, open the computer USB wizard:
1. Stage the disabled recovery bundle
2. Commit the exact startup hooks while runtime startup remains disabled
3. Run the original60-second guarded bridge trial and verify stock return
4. Arm bridge startup; fully power off/on, reconnect USB and check startup
5. Prepare PM control for the next boot; fully power off/on again
6. Check screen prerequisites and run the separate60-second Full UI trial;
   inspect the visible screen, menu and touch during that trial
7. Confirm both screen/touch and permanent startup in that same monitor boot
8. Add through HA's standard ESPHome flow after USB-derived address and
   independent encrypted LAN verification

Every step uses a fresh original-click USB selection and complete backend
checks. Status only reads history; a lost response never repeats a POST or
recreates a continuation. Language preserves forms. The wizard never reboots,
prunes history, fabricates native receipts, scans LAN or overwrites conflicting
HA entries. Keep USB/power/private recovery files throughout. The final step
needs actual LAN reachability from HA; lack of it leaves the consumed result
unverified for manual reconciliation, never an automatic flow retry.
