# Air Monitor Lite – original stock 4.3.4 / HW0001

Independent firmware **1**, profile **lite-434**, full ESPHome replacement.
The stock-generation identifier is preserved provenance, not a proven PCB ID.
Do not select this profile from the CGDN1 name or HW0001 alone.

CO₂, temperature, humidity, local UI and HA use the existing direct-I²C
backend. **Fan shutdown is not supported in version 1.** PM OFF stops polling
and invalidates the three PM readings; GPIO13 remains HIGH. It does not pause
CO₂, temperature or humidity. GPIO18/23 remain untouched.

## Build and publish

Use the repository's pinned ESPHome 2026.9.1 environment:

```sh
python tools/build_lite434.py
python tools/check_lite434_wire.py
python -m unittest discover -s tests -p 'test_firmware*.py'
python tools/publish_firmware.py --profile lite-434 --source-commit <reviewed-SHA>
# Publish only after reviewing the exact public pair/catalog preview:
python tools/publish_firmware.py --profile lite-434 --source-commit <reviewed-SHA> --publish
```

The builder stages `ports/lite` unchanged, overlays the PM controller and binds
this profile's UI version, public number and sealed identity. The independent
source digest covers every shared input and all overlay/compiler recipes.
Outputs are `lite-434-template.bin` and its original matching JSON manifest.
These contain public placeholders, never operational credentials. Do not flash
an unpersonalized template or a whole-flash/factory image.

## Install/update

Integration **0.2.9+** routes an existing managed ESPHome device with authenticated
original stock 4.3.4/HW0001 to this release in HA's standard Updates section.
It uses the existing private Noise/OTA/Wi-Fi/AP values, fresh exact MAC/settings
and USB checks, one durable consumed intent and encrypted APP-only OTA.
No downgrade/reinstall or device write happens during discovery. An existing
public Lite 2 keeps that installed label until profile-specific 1 is verified;
internal revision 4 preserves forward OTA ordering. Firmware updates after this
initial integration support remain independent of HACS versions.

A new factory Bluetooth installation for 4.3.4 is not qualified or enabled.
This release was built and software-tested, not installed during publication.
Prior live physical source/UI/HA checks establish the direct-I²C backend;
software tests do not substitute for a fresh hardware install or fan-off proof.
