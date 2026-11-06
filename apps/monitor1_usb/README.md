# Monitor 1 USB companion — experimental connection check

This app implements two experimental **read-only connection paths** on its page:

- **Computer USB:** Chrome/Edge WebUSB talks directly to the selected monitor.
- **Home Assistant server USB:** the app's local ADB reads the selected USB
  device on the server. The browser needs neither WebUSB nor a local cable.

Both derive the fixed identity/file checks from
ports/monitor1/preflight_adb.py. They admit only CGS1 stock 4.1.8_0287,
ARMv7 and CO2 type 2/S8 or 3/SCD40, with the exact factory fingerprints.
An existing modified installation is refused by this first-install check.
It must use its own upgrade/recovery flow.

**This is not yet a complete flashing app.** It does not capture backups,
build a profile, upload a program, run the bounded trial, activate firmware,
reset Wi-Fi or reboot. A successful probe leaves installation_ready=false.
The explicit engineering writer/trial remains separate in
[USB_TRIAL.md](../../ports/monitor1/USB_TRIAL.md). Source tests, a container
startup and a UI preview are not a physical USB installation.

## Install and open

Requires HA OS/Supervisor with Home Assistant 2026.11.0 or later. This is an
app/add-on repository, separate from the HACS integration release:

1. In Settings → Apps (Add-ons) → app store → Repositories, add
   https://github.com/ivaschru/qingping-esphome
2. Install **Qingping USB (experimental check)** and start it manually.
   It is built locally by Supervisor; no firmware image is downloaded.
3. Select Open Web UI as an administrator.
4. Connect the USB-C **data** cable to the chosen computer/server. Enable
   ADB on the stock monitor if needed, then restore its real Wi-Fi connection.
5. Choose the USB location and perform the read-only check.

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
