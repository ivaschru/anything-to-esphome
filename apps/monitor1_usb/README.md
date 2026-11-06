# Monitor 1 USB companion — experimental preparation

This app implements two experimental **read-only preparation paths** on its page:

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

**This is not yet a complete flashing app.** It prepares a private profile but does not compile or
upload a program, run the bounded trial, activate firmware,
reset Wi-Fi or reboot. A successful probe leaves installation_ready=false.
The explicit engineering writer/trial remains separate in
[USB_TRIAL.md](../../ports/monitor1/USB_TRIAL.md). Source tests, a container
startup and a UI preview are not a physical USB installation.

## Install and open

Requires HA OS/Supervisor with Home Assistant 2026.11.0 or later. This is an
app/add-on repository, separate from the HACS integration release:

1. In Settings → Apps (Add-ons) → app store → Repositories, add
   https://github.com/ivaschru/qingping-esphome
2. Install **Qingping USB (experimental preparation)** and start it manually.
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
input. The profile/key and captured vendor files never appear in HTTP status,
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
native USB path. Compilation and writer/trial GUI integration remain pending.

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
python -m unittest discover -s tests -p test_usb_companion.py
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
