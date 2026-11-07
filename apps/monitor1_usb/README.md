# Monitor 1 USB — experimental installer

This app offers two USB locations for identification, private capture and builds:

- **Computer USB:** Chrome/Edge WebUSB talks directly to the selected monitor.
- **Home Assistant server USB:** the app's local ADB reads the selected USB
  device on the server. The browser needs neither WebUSB nor a local cable.

Both derive the fixed identity/file checks from
ports/monitor1/preflight_adb.py. They admit only CGS1 stock 4.1.8_0287,
ARMv7 and CO2 type 2/S8 or 3/SCD40, with the exact factory fingerprints.
An existing modified installation is refused by this first-install check.
It must use its own upgrade/recovery flow.

The HACS Monitor 1 card exposes the same first-step choice. Computer mode
opens its native WebUSB picker directly, without installing this app. Server
mode resolves the exact installed companion from Supervisor metadata and opens
its native admin ingress page. Missing/stopped apps produce instructions;
the integration never installs, starts or configures an app automatically.

For **server USB**, an explicitly reviewed experimental action now composes the
original disabled staging, script commit, bounded bridge trial and next-boot
bridge arming. A separate button reads the result after you power-cycle the
monitor yourself. **First installation on an untouched physical CGS1 has not
been verified.** This path installs the stock-side bridge only; the computer
browser-only WebUSB writer and full native UI installation are still unfinished.
A separate downloaded computer ADB installer reuses these engines without a
compiler or VM on the computer; see its section below. Normal
HACS CGS1 admission remains source-only and `installation_ready=false`.
See [USB_TRIAL.md](../../ports/monitor1/USB_TRIAL.md) for the underlying engine.
Source tests, container checks and an imitated UI run are not hardware evidence.

## Install and open

Requires HA OS/Supervisor with Home Assistant 2026.11.0 or later. This is an
app/add-on repository, separate from the HACS integration release:

1. In Settings → Apps (Add-ons) → app store → Repositories, add
   https://github.com/ivaschru/qingping-esphome
2. Install **Qingping USB (experimental installer)** and start it manually.
   It is built locally by Supervisor; no firmware image is downloaded.
3. Select Open Web UI as an administrator.
4. Connect the USB-C **data** cable to the chosen computer/server. Enable
   ADB on the stock monitor if needed, then restore its real Wi-Fi connection.
5. Choose the USB location and perform the read-only check.
6. Use **Save original files** to download nine fixed recovery/build files
   and a verified identity/hash report. Capture performs its own fresh check;
   computer mode opens a fresh native USB picker. Nothing is installed.

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
that archive to this companion on your own HA server. Server mode performs its
own fresh USB capture. Neither route needs or changes your Wi-Fi password.

The companion creates a private owner-bound job under its `/data/jobs`, with
an individual Noise key, a stable separate API MAC and the verified stock Qt
input. The profile/key and captured vendor files never appear in ordinary HTTP status,
public GitHub assets, normal logs or browser storage. Preserve the app's private
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
`e09440f9fa36da2aaad16212734879bb6304f6d2`, creates its isolated pinned SDK and
calls the canonical `build_candidate.py`. It links your verified private Qt
input and individual profile, builds the matched guardian/native/bridge and
initial trial guardian, then checks the actual output hashes. Private inputs,
programs and logs stay in this app's `/data/jobs`; no public build service or
GitHub artifact receives them. Internet downloads are public source/tools only.

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

**Built is not installed.** Real first-install qualification and the computer
writer are still unfinished. Neither a complete compile nor a synthetic
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
The browser-only WebUSB writer adapter is still unfinished; its capture is never
relabelled as native get-devpath evidence to pass the native planner. Browser
jobs can still prepare profiles/build programs without that adapter.

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
