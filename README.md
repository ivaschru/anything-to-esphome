# monitor1-s8 – firmware runtime 1

This is the **source-built full ESPHome runtime** for CGS1 / CO2 type 2.
It is not an ESP32 BIN and cannot be uploaded through the Lite updater.

Source commit: `e8f640e7fc3c06151818da675fb0548a8fd563c9`. The source archive and release.json are immutable.
Do not boot public placeholders or publish locally compiled personalized programs.

## Build for an existing installation

Clone https://github.com/ivaschru/qingping-esphome. Check out exactly
`e8f640e7fc3c06151818da675fb0548a8fd563c9`, then follow `ports/monitor1/BUILD_CANDIDATE.md` from that commit.
Use a private 0600 profile, the matching original private QtCore and the pinned SDK.
The builder generates the actual native/guardian/bridge hashes in dependency order.
Keep the existing API key, node name and API MAC. Its result stays private.

The downloadable source archive is an inspection copy of ports/monitor1 and its
license, not a standalone Git checkout or substitute for the exact source commit.
Neither downloading nor compiling performs an installation or contacts hardware.
Use the existing deployment/recovery procedure for an already installed runtime.
Initial USB installation and automatic HA updates are separate unfinished routes.

Existing S8 and SCD40 private runtimes passed real sensor/UI/settings and software
reboot tests. That does not establish hardware QA for newly built release bytes.
See release.json for the exact compatibility, delivery and qualification boundary.
