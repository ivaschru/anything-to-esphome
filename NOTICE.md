# Third-party notices

The Lite base derives from `nemethhh/esphome-qingping-cgdn1` (MIT, copyright
2026 Oleksandr Martynenko). Its license is retained in `ports/lite/LICENSE`.
Stock-derived hardware facts, display symbols and algorithms remain identified
by comments in those sources; this project makes no claim to Qingping branding
or vendor firmware. No vendor firmware image is redistributed.

Inter is distributed under the SIL Open Font License 1.1; copies of that
license accompany both font directories. ESPHome and ESP-IDF are build-time
dependencies under their respective licenses; their upstream notices are not
removed by this project. ESP32 SDK binary components are obtained by the pinned
ESPHome build process, not copied from a private device backup.

The HACS integration, personalization/relay code, local UI additions and CGS1
port are distributed under this repository's MIT license. Third-party works
retain their original rights and licenses.

The native OTA adapter follows the ESPHome 2026.9.1 OTA protocol documented in
[esphome/espota2.py](https://github.com/esphome/esphome/blob/2026.9.1/esphome/espota2.py).
ESPHome is MIT-licensed, copyright ESPHome contributors. The adapter implements
that wire protocol using Home Assistant's aioesphomeapi Noise implementation;
the project does not bundle another copy of the ESPHome uploader or SDK.

Roboto Condensed font: Google Fonts / Roboto Project Authors, SIL Open Font
License1.1. Bundled original font and complete license are under ports/lite/fonts/.
The system fonts used by the design mockup are not redistributed.

## Sonoff S60TPF

`ports/sonoff_s60/sonoff_s60.yaml` derives from adamsthws/Sonoff-OTA commit
`37962db36b154269076afd223c11f11e2d1eb770`, GPL-3.0-only. Its full license is
`ports/sonoff_s60/COPYING`. The separate `sonoff_worker` adapters are also
GPL-3.0-only with their own COPYING. The MIT Home Assistant coordinator invokes
that separately downloaded, SHA-pinned engine via a private process contract.
No vendor firmware or personal backup is distributed by this repository.
