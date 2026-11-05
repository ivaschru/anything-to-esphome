# Air Monitor 1 / CGS1

Исходники Linux ARMv7 host-порта для RK3128. Это отдельная программа на Linux,
а не ESP32 app. Проверенная среда — ESPHome `2026.10.1` и Zig `0.14.1`.

На реальных CGS1 со stock `4.1.8_0287` проверены stock bridge и полный режим:
экран, физические показания, настройки, guarded return и постоянный запуск
после программного Linux reboot. S8 (`co2_type=2`, UART0) и SCD40
(`co2_type=3`, kernel sysfs) — разные профили. Пакет
`profiles/co2-scd40.yaml` удаляет S8 reader и сохраняет публичный CO₂ sensor.
SCD30 (`co2_type=1`) обнаружен в stock-коде, но на приборе не проверен.

Публичный snapshot содержит общие YAML, компоненты, guard/runtime, сборочные
обёртки и Inter/OFL. Частные release manifests и скомпилированные программы
сюда не перенесены. Поэтому полные YAML **ещё нельзя собрать одной командой**:
их `build/*manifest.yaml` и `build/full-native-release.yaml` должны быть
созданы заново из согласованной пары программ. Готовый универсальный builder
и USB/ADB-установщик — следующий отдельный этап; кнопка в HACS отключена.

`device_profile.h` намеренно требует явные `CGS1_EXPECTED_WLAN_MAC`,
`CGS1_ESPHOME_NODE_NAME`, `CGS1_EXPECTED_PM_HELPER_SHA` в private profile.
Пример API MAC в YAML — локально администрируемый placeholder; для разных
приборов нужны разные идентификаторы. Не удаляйте аппаратные проверки,
artifact SHA, guard-процессы или возврат в stock ради обхода ошибки сборки.

Холодное включение, boot без доступного AP и CGS1 Bluetooth proxy в этом
публичном выпуске не заявлены проверенными/реализованными.
