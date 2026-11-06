# Qingping ESPHome

Public home for three distinct device families: Lite/CGDN1, Monitor 1/CGS1,
and Monitor 2. Firmware profiles and their installation transports remain
separate even though the HACS wizard is shared.

- The owner installs and updates this integration manually. An error report
  authorizes diagnosis/package fixes, not installation, configuration or a
  restart of their HA. Do not operate their HA without a new direct request.
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
- Monitor 1 is a source snapshot, not yet a universal release builder.
  Do not remove missing-manifest checks or copy private release pins to make
  full YAML compile. Monitor 2 remains disabled until hardware verification.
- Normal HACS installs must have a non-prerelease tag with the ZIP asset.
  Keep hide_default_branch=true: zip_release cannot install a source branch
  without its own release asset. Hyphenated beta/rc tags remain prereleases;
  numeric stable tags must not inherit an unconditional --prerelease flag.
