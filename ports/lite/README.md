# Air Monitor Lite / CGDN1 direct-I2C – firmware 2

This profile is for the qualified ESP32/direct-I2C architecture (SCD4x + SHT4x),
not every product labelled Lite. Original stock 4.3.4 and 4.5.8 are provenance,
not physical PCB revision numbers. The initial factory Bluetooth installer is
still admitted only for the tested 4.5.8/HW0001 route. Existing qualified 4.3.4
ESPHome devices use a separate authenticated native update path. External-MCU
4.2.x profiles are separate and are not installable with this image.

Firmware 2 ports the guarded quiet policy: PM OFF waits for finite CO2/raw T/RH,
then holds GPIO13 LOW between ordinary SCD4x transactions. Each transaction has
1ms settling/command gaps; the RAII window closes before measurement callbacks.
An IO/CRC error, a window over 25ms, NaN or a source older than 90s latches HIGH.
The diagnostic rail/window entities make protective fallback visible. This can
restart the fan to preserve measurements; PM OFF is a request, not a guarantee
that protection will leave the rail LOW after a fault. GPIO18/23 and whole-board
power-off ownership remain unchanged. PM ON has the existing 30s warmup.
The original ordinary private policy was acoustically and electronically tested;
public firmware 2 qualification is tracked separately from compilation.

The agreed 160x128 design uses original native-size outline digits or the OFL
Roboto Condensed classic face, with Inter for text. Outline glyphs are never
shrunk; compact layouts use ordinary text. Decimal values use a dot. Layouts:
selected physical sensor, CO2 + temperature, clock + date, clock + CO2 + T,
clock, large CO2 and summary. The upper row distinguishes Wi-Fi, the connected
Home Assistant API client, page, battery percentage and charging. It never
labels an arbitrary diagnostic API client as HA.

Every numeric/select/switch/time setting uses its same typed restored entity
locally and in HA. There is no second settings store. Drafts apply only on Save;
swipes cancel, time edits have separate hours/minutes, service actions default
to Cancel. Booting the other slot needs two independent confirmations. A first
centre tap wakes a manually darkened screen without activating anything. Night
mode is fully black for its configured window, including after touch.

Clock/date are invalid until HA's first synchronization, shown as --:-- and
--.--.--; an already synchronized system clock keeps running with possible
drift while powered. There is no confirmed battery-backed RTC or reboot-proof
clock. API/Wi-Fi reboot timers are disabled for standalone measurements/UI.

The optional existing HA display feed remains display-only and has the same
per-value freshness/local fallback. Its entity ID is personalized on HA; a long
entity ID/secret editor is deliberately not put on the touch strip. It is not
re-exported as a physical CO2/T source. Device discovery exports its current
feed and original stock provenance inside the requesting-client AES-GCM profile.
This new personalization contract requires integration 0.2.1 or later.

Build with ESPHome 2026.9.1: `python tools/build_lite.py`. Validate the actual
exporter with `python tools/check_profile_wire.py`, and render actual UI methods
with the generated firmware fonts using `python tools/render_lite_ui.py`.
The latter is an offline framebuffer fixture, not a photograph/hardware test.
Only public placeholders may be released. Never boot an unpersonalized template.
Factory bootloader/partitions remain; another OTA can replace the adjacent app.

Based on [nemethhh/esphome-qingping-cgdn1](https://github.com/nemethhh/esphome-qingping-cgdn1).
Firmware 1 in release v0.2.0 deliberately used polling-only HIGH13 and has no
fan shutdown. Installing a HACS update alone never updates a monitor's app.
