# Native interface language and visible backlight

The Monitor 1 native interface has one persistent `Interface language` select:
`English` / `Русский`, initially `Русский`. The local route is
**Settings → Interface language** / **Настройки → Язык интерфейса**. Local taps
call the same ESPHome template select as Home Assistant. Its restored state
updates the renderer without a Home Assistant connection.

Translation covers readings, settings, idle screens, dates and Wi-Fi feedback.
It changes display text only. Existing entity IDs and the stored options of
`Idle screen` and `Display readings` keep their original values for compatibility.
SSID/password bytes, sensor values, HA source bindings, timeouts and in-progress
Wi-Fi transactions are not translated, reset or resubmitted. The HACS installer's
browser language remains a separate preference.

Both brightness controls now start at **2%**: day 2–100%, night 2–10%.
The observed CGS1 panel is black at 1% (raw 10/1000) and visible at 2%
(raw 20). The common UI policy enforces raw ≥20 for a visible screen, including
legacy restored values. After setup, ordinary local number calls migrate old
sub-2% preferences and publish/save the corrected state without HA.

Only the explicitly selected screen-off idle mode uses raw zero. Touching any
part of that screen wakes the home page at the protected brightness. The guarded
DRM backend and stock-recovery brightness restoration retain their exact raw
semantics; the floor is applied by the native UI above that boundary.

## Checks

- `test_ui_language.cpp`: exact locale choices, unknown-choice preservation,
  complete dictionary lookup and matching printf argument types/order
- `test_backlight_policy.cpp`: observed boundary, legacy/nonfinite values,
  visible/off ranges and unchanged valid settings
- Actual ESPHome 2026.10.1 localhost Noise fixture: old fixture saves 1%/0.5%,
  new process repairs both to 2%; local/remote language changes agree, and a
  process restart restores English and all existing display/source settings
- Production renderer/fonts: 36 synthetic 720×720 pages in each language,
  local touch interactions, outer-edge wake and unchanged in-progress input

These checks do not establish a physical firmware installation. The native
runtime still requires a matched native/guardian/bridge build and the normal
existing-device update procedure. Monitor 2 and a Linux BLE proxy are not
qualified by this UI change.
