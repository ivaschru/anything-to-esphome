# Qingping ESPHome

Public home for three distinct device families: Lite/CGDN1, Monitor 1/CGS1,
and Monitor 2. Firmware profiles and their installation transports remain
separate even though the HACS wizard is shared.

- Bootstrap launchers and startup-hook.sh match the existing StockInspection
  fingerprints. `bootstrap_patches.py` reproduces both complete installed
  script digests from the exact private factory originals; no vendor scripts
  are distributed. Keep bytes/process names coupled to those gates. Syntax
  checks use sh -n, never execution of production-path scripts on a host.
  `preflight_adb.py` is an initial-install read-only USB capture, not an apply
  route: explicit WLAN/CO2, boot/transport and before/after fixed-file pins,
  private output, no INI/credential dump or arbitrary command. Old adbd needs
  the final shell completion sentinel as well as the host exit code. Existing
  installs are refused; do not use this tool to upgrade or prune them. These
  steps still need guarded write/CAS/activation and physical verification.
  `prepare_install.py` only assembles a private offline plan, rehashing capture,
  source/ELF/helper/patched scripts and exact profile binding. Keep live CAS
  required, installation_ready=false and the unconsumed intent; its requested
  free-space budget is not measured capacity. Do not manufacture a USB capture
  to promote a compile fixture into a target or installation result.

- `build_candidate.py` is an experimental private CGS1 build controller,
  not installation authority. It archives one committed source revision,
  creates its own pinned SDK and matches actual PM/guardian/native/bridge
  digests. Keep the explicit 0600 profile, separate S8/SCD40, required release
  manifests and installation_ready=false. Never copy dirty deployments or
  replace missing trial artifacts with fake ones. `stock-bridge-release.yaml`
  uses the ordinary FullRuntime gates without the legacy engineering trial
  API. Hardware QA and the HACS USB/ADB pipeline are still separate work.

- `ports/monitor1/build_pm_helper.py` is build-only. It requires an explicit
  independently verified stock QtCore SHA and the isolated CGS1 environment;
  outputs/logs stay private in a fresh ignored build directory. Public Qt
  headers are pinned; vendor Qt libraries and rebuilt helpers are not release
  assets. Preserve ARM/glibc/input checks and never install the mock/test .so
  or infer loader authority from a successful build. See PM_HELPER_BUILD.md.

- CGS1 Bluetooth remains unavailable. Read BLUETOOTH_RESEARCH.md before
  hardware work: WLAN rfkill0 and the stock rkrtkbt wrapper are not safe BT
  probes. Require revision-specific UART/BT_REG_ON wiring first; don't attach
  to an apparently free tty or reuse the FIQ console. A real host tracker/GATT
  backend and lifecycle proof are also needed before exposing a proxy toggle.

- Monitor 1 power/offline Wi-Fi/recovery now have portable source and host
  tests. Power is read-only kernel capacity/voltage/status, never a guessed
  percentage. Keep sealed UNASSOCIATED_MANUAL distinct from saved replay,
  both guardians, private Store/CAS and no-SELECT rollback. No password API.
  The tiny recovery has inventory AND exact old-program prune; protect an
  explicitly bound working pair, preserve user files, verify local backups,
  and consume each release intent before deletion. Its compact SDK MD5
  backend is opt-in only; Noise/OTA and SHA-256 stay enabled. Normal profiles
  retain EVP. Production core startup settle is 60s with the same 180s total
  bound and strict DRM gates. See ports/monitor1/POWER_WIFI_RECOVERY.md.
  These sources do not enable the still-missing universal CGS1 installer or
  establish physical absent-AP, battery-transition, BLE or Monitor 2 proof.
  The planner fixture needs actual Linux/root Store ownership; CI runs its
  explicit hosted-runner root step. Never remove that production check to
  make a non-root local test pass or invoke sudo from the test wrapper.

- The wizard defaults to English and offers Russian in `frontend/i18n.mjs`.
  Store only the language preference in localStorage. Translate text nodes in
  place: never rebuild the form, repeat setup, disconnect BLE or restart a
  session when switching languages. Keep UI/backend error code coverage in
  `tests/test_i18n.mjs`; unknown errors must not expose arbitrary details.
- `show_sidebar` is an integration option, default true. Changing it updates
  the existing HA panel in place and preserves Manager/broker/session state.
  Network option changes retain their normal reload behavior. Preserve all
  unrelated options when any options-flow step saves its mapping.
- Register one SERVICE device (`installer`) with a stable identifier and
  `homeassistant://qingping_esphome` configuration URL. It is an installer
  shortcut, never a physical monitor or an ESPHome device. Keep admin checks
  and direct routing when hiding navigation. README.md is English by default;
  README.ru.md is its Russian counterpart, with reciprocal language links.

- Stock 4.2.1 is an external-MCU variant under `ports/lite-mcu421/`, not an
  additional allowed version of the direct-I2C 4.5.8 image. Its catalog entry
  is `in_development`, with no firmware asset. Do not enable installation
  before startup/ACK, power pins and measurement semantics are established.
  `protocol.h` is receive-only research code, not an ESPHome UART driver.
  Run the ASan/UBSan C++ test and `node tests/test_compatibility.mjs` after
  changing this protocol/profile boundary; CI runs both without hardware.
  Frontend admission uses the backend catalog and must keep requestDevice in
  the original click activation, before any network wait. Invalidate the old
  identity/form before each new selection; backend admission is independent.

- The owner installs and updates this integration manually. An error report
  authorizes diagnosis/package fixes, not installation, configuration or a
  restart of their HA. Read-only HA diagnostics are explicitly allowed;
  mutations and direct/manual fixes require a new direct request.
- The owner chose to retain the three advertised-name Bluetooth prefixes for
  now (2026-11-06). Do not expand to acceptAllDevices without a new decision.
  An empty filtered picker does not prove that all nearby BLE is invisible.
- A loaded installer/panel needs no duplicate config entry. Explain its zero
  device count: physical monitors belong to ESPHome. Follow Marketplace's
  actual restart requirement rather than prescribing restart unconditionally.
- Normal setup must not ask for IP/ports HA can determine. Use HA's network
  helper and default ports; manual IP is a fallback, ports live in options.
  Preserve explicitly configured old/manual entries on upgrades.

- Keep this repository free of device credentials, home/room names, real MAC
  addresses, private deployment YAML, firmware backups and generated ELF/BIN.
  Only a reproducible template containing documented public placeholders may
  be published as a firmware asset. Personalization happens inside HA.
- Never advertise an unverified hardware variant as supported. Monitor 2 is
  currently unverified. CGS1 S8 and SCD40 are distinct profiles; SCD30 is not
  automatically admitted by either one.
- The HACS installer is administrator-only. Every installation is tied to the
  selected model/MAC, USB acknowledgement, a fresh transport and a single
  consumed OTA intent. A timeout is not permission to resend an OTA command.
- Firmware downloads containing private settings are served only to the
  selected LAN peer, expire, and never become public GitHub artifacts.
- Keep substantive comments for protocol boundaries, authorization, privacy,
  timeouts and recovery. Do not obscure necessary installation choices.
- Run `python -m unittest discover -s tests` for pure protocol/image checks,
  `python -m compileall -q custom_components tools`, and `node --check` on
  frontend modules. Record what was actually tested; do not substitute these
  checks for a hardware installation.
- Update this file when architecture or build/release commands change, and
  CHANGELOG.md for changes in behavior. Preserve third-party notices.
- Build the Lite template with `python tools/build_lite.py` in an ESPHome
  2026.9.1 environment; package with `python tools/package_release.py`.
  The output ZIP, binary AND its matching manifest are release artifacts,
  ignored by Git. Never retain a manifest from another timestamped build.
- Variable-length firmware slots must be read through the volatile runtime
  loader before Wi-Fi setup. Literal replacement alone is unsafe because a
  compiler can constant-fold the old strlen. Node names remain exactly 31
  bytes because ESPHome pre_setup has a separate compiled length.
- The HA frontend uses HA HTTPS/WebSocket authentication. Stock MQTT uses
  port 1886 and a dedicated LAN HTTP listener uses port 1887 by default;
  do not expose either port on a public interface/router forward.
- Monitor 1 has an experimental build-only candidate controller; separate
  SCD40 and S8 source compiles passed with matching artifact pins.
  This does not enable the universal installer. Do not remove missing-manifest
  checks or copy private release pins to make full YAML compile. Monitor 2
  remains disabled until hardware verification.
- Normal HACS installs must have a non-prerelease tag with the ZIP asset.
  Keep hide_default_branch=true: zip_release cannot install a source branch
  without its own release asset. Hyphenated beta/rc tags remain prereleases;
  numeric stable tags must not inherit an unconditional --prerelease flag.
