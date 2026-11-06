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
сюда не перенесены. Для инженерной сборки теперь есть
[build-only candidate controller](BUILD_CANDIDATE.md): он создаёт private
snapshot/SDK и генерирует manifests из фактически собранных программ.
Сквозные source compiles SCD40 и S8 прошли отдельно. Базовые YAML
по-прежнему требуют matching `build/*manifest.yaml` и guardian pin, обходить
эти зависимости нельзя. Для первого USB/ADB-установщика теперь есть
[capture, точные patches и experimental disabled staging/CAS](INITIAL_INSTALL.md).
Этот новый writer ещё не проверен на приборе; его activation-часть не закончена.
Поэтому первой установки CGS1 одной кнопкой через HACS пока нет. Это граница
нового установщика, а не условие публикации уже работающего Linux runtime.

## Какой путь нужен

**На приборе уже работает этот ESPHome-порт.** Используется его существующий
Noise API/OTA и отдельная сборка для правильного CO₂-профиля. Сохраняются
node name, API MAC, Noise key и настройки. Read-only initial capture и disabled
staging для такого прибора не подходят: они намеренно отказывают существующей
установке. Дополнительный initial-trial guardian для обычного обновления не
нужен; действующие runtime guards, проверка образов и возврат в stock остаются.
Сборка matched native/guardian/bridge описана в [BUILD_CANDIDATE.md](BUILD_CANDIDATE.md).
Сам build controller ничего не загружает на прибор.

**На приборе только штатная прошивка.** Нужен первый USB/ADB-путь. Уже доступны
инженерные шаги capture, private build/plan и disabled staging/commit в
[INITIAL_INSTALL.md](INITIAL_INSTALL.md). Это подготовка, а не законченная
инструкция прошивки: запуск и постоянная активация ещё не соединены в полный
установщик. Испытывать новый путь следует отдельно в экспериментальном режиме
с сохранённым ADB-доступом и проверенным backup; после этого открывается обычная
установка. Ожидание такой проверки не блокирует публикацию исходников и
обновление уже установленного runtime. Нельзя просто поменять `source_only`
на `ready`: от этого не появится отсутствующий код первой установки.

`device_profile.h` намеренно требует явные `CGS1_EXPECTED_WLAN_MAC`,
`CGS1_ESPHOME_NODE_NAME`, `CGS1_EXPECTED_PM_HELPER_SHA` в private profile.
Пример API MAC в YAML — локально администрируемый placeholder; для разных
приборов нужны разные идентификаторы. Не удаляйте аппаратные проверки,
artifact SHA, guard-процессы или возврат в stock ради обхода ошибки сборки.

Холодное включение, boot без доступного AP и CGS1 Bluetooth proxy в этом
публичном выпуске не заявлены проверенными/реализованными.

Добавлены общие stock/full сущности питания и native ввод новой сети без
исходной association. Power export реально проверен на S8 и SCD40; offline
manual/recovery прошли source-тесты, но физический absent-AP сценарий ещё
предстоит. Также опубликован малый recovery с просмотром и точечной очисткой
старых программ, чтобы восстановить OTA при нехватке места. Подробности,
обязательные ограничения и границы испытаний –
[Power, offline Wi-Fi and storage recovery](POWER_WIFI_RECOVERY.md).

По Bluetooth опубликованы [результаты аппаратного исследования](BLUETOOTH_RESEARCH.md):
HCI отсутствует, точная BT UART/питание на плате не доказаны, host backend
ESPHome ещё требуется. Наличие RTL8723DS Wi-Fi не включает BLE proxy.

Первый общий build dependency теперь воспроизводим: [сборка штатного PM helper](PM_HELPER_BUILD.md)
из публичного исходника с проверенными Qt headers и private stock QtCore.
ARM cross-build проверен; новый helper не устанавливался. Это ещё не
доказательство установки новой native/guardian/bridge пары или включение
USB-мастера в HACS. Для всей связанной source-сборки см. candidate controller.

В [bootstrap/](bootstrap/) сохранены два нейтральных launcher source, точно
совпадающих с уже закреплёнными runtime SHA. Это ещё не процедура установки:
factory startup/watchdog patch, backup/CAS и аппаратная проверка нужны отдельно.
