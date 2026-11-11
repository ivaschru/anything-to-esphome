# monitor1-scd40 – firmware runtime 2

This is the **source-built full ESPHome runtime** for CGS1 / CO2 type 3.
It is not an ESP32 BIN and cannot be uploaded through the Lite updater.

Source commit: `3c5363f6ee72f0b3b314b734a796ab894d6bd136`. The source archive and release.json are immutable.
Do not boot public placeholders or publish locally compiled personalized programs.

## Build for an existing installation

Clone https://github.com/ivaschru/anything-to-esphome. Check out exactly
`3c5363f6ee72f0b3b314b734a796ab894d6bd136`, then follow `ports/monitor1/BUILD_CANDIDATE.md` from that commit.
Use a private 0600 profile, the matching original private QtCore and the pinned SDK.
The builder generates the actual native/guardian/bridge hashes in dependency order.
Keep the existing API key, node name and API MAC. Its result stays private.

The downloadable source archive is an inspection copy of ports/monitor1 and its
license, not a standalone Git checkout or substitute for the exact source commit.
Neither downloading nor compiling performs an installation or contacts hardware.
For Home Assistant installation use `ports/monitor1/build_update_candidate.py` with the exact
`--source-ref` above. Prepare both private builds using the Monitor 1 README.
The source kit never starts an automatic build or installation.

Existing S8 and SCD40 private runtimes passed real sensor/UI/settings and software
reboot tests. That does not establish hardware QA for newly built release bytes.
See release.json for the exact compatibility, delivery and qualification boundary.
