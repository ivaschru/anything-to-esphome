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
mode is black while idle. Any recognized tap/swipe wakes it for 30 seconds;
the first gesture only wakes, subsequent gestures operate the menu. Every
touch extends the interval. At timeout unapplied drafts are cancelled and the
screen darkens without changing the schedule or previous Display intent.

Clock/date are invalid until HA's first synchronization, shown as --:-- and
--.--.--; an already synchronized system clock keeps running with possible
drift while powered. There is no confirmed battery-backed RTC or reboot-proof
clock. API/Wi-Fi reboot timers are disabled for standalone measurements/UI.

Lite 3 has native ESPHome configuration fields on the physical device's HA
page: CO2, Temperature, Humidity, PM1, PM25 and PM10 display source. Enter a
`sensor.entity_id`, or leave empty to use the physical sensor. The shared
"Use Home Assistant display values" switch is also in the local menu under
"Подключения → Показания HA". Entity IDs are edited in HA because the strip
has no HA entity catalog. The six fields are restored independently.

Values and unit_of_measurement are imported read-only through the existing
native API. Invalid/unavailable values, unsupported units, disconnect or a
180-second receive timeout independently fall back to fresh local readings,
or dashes if both are unavailable. Imported values affect the OLED/LED only;
physical CO2/T/RH/PM exports, heat model and fan safety always use local data.
The native API uses at most twelve stable state/unit subscriptions and bounded
30-second one-shot refresh requests; rebinding clears the old cached value.
No HA services, helper provisioning or legacy template migration are performed.
Set existing room source IDs manually after updating. The older combined feed
is not subscribed to by Lite 3, while its binary slot is kept for personalizer
compatibility. Device secrets remain only in the sealed requesting-client
update profile. Test firmware variants are never public catalog assets.

Build with ESPHome 2026.9.1: `python tools/build_lite.py`. Validate the actual
exporter with `python tools/check_profile_wire.py`, and render actual UI methods
with the generated firmware fonts using `python tools/render_lite_ui.py`.
The latter is an offline framebuffer fixture, not a photograph/hardware test.
Only public placeholders may be released. Never boot an unpersonalized template.
Factory bootloader/partitions remain; another OTA can replace the adjacent app.

Based on [nemethhh/esphome-qingping-cgdn1](https://github.com/nemethhh/esphome-qingping-cgdn1).
Firmware 1 in release v0.2.0 deliberately used polling-only HIGH13 and has no
fan shutdown. Installing a HACS update alone never updates a monitor's app.
