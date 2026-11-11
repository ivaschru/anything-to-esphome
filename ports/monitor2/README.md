# Air Monitor 2 / CGS2

Отдельный Linux host-порт в исследовании. Готового полного ESPHome runtime
и установочного образа пока нет; мастер сохраняет установку закрытой.

## Подтверждённые исходные материалы

В [исследовании самого автора cgs2_decloud](https://github.com/ea/cgs2_decloud)
показан вход в developer options через семь нажатий Device Name в About,
включение USB ADB и root BusyBox shell на исследованной версии. Это полезный
вход для будущего точного read-only снимка. Поддержка такого входа на каждой
заводской версии и архитектура процессора этим не установлены.

[Автор Custom Dash](https://github.com/callumj/Qingping-Air-Monitor-2-Custom-Dash/blob/main/docs/device-notes.md)
описывает Buildroot Linux, Qt/EGLFS, `QingSnow2App`, vendor watchdog и Miio.
На его приборе остановка Snow прекращает публикацию измерений; QML-интерфейс
использует Snow offscreen как поставщика данных. Для полного ESPHome нужен
отдельный подтверждённый sensor/input/display backend и штатный возврат.
CGS1 takeover и его фиксированные пути/хэши автоматически сюда не переносятся.

[Sensirion](https://sensirion.com/company/news/press-releases-and-news/article/sensirion-inside-qingping-air-monitor-2)
подтверждает семейства SHT4x, SGP4x и SCD4x. Это не устанавливает конкретный
variant, шину, адрес, GPIO, формат noise/PM или правила компенсации.
[FCC 2AQ3F-CGS2](https://fccid.io/2AQ3F-CGS2) содержит первичные внутренние
фотографии (7070282, 2024-01-23); схема/SoC/pin map по ним здесь не заявлены.

На экземпляре Константина Северова работал Buildroot Linux 4.19.232 на
Rockchip PX30 (RK3326). В опубликованном дереве устройств указан ST7703,
четыре линии MIPI DSI и разрешение 720 × 720. Это сведения об исследованном
экземпляре. [Отчёт автора](https://robolegion.com/qingping-air-monitor-2-a-deeper-dive/)

Тот же DTS (131 099 байт, SHA-256
`998897398cd6a51aae6631b0c5b5ac3f53622e32b55beb41f793c71e5e935240`)
даёт следующие адреса по Linux I²C aliases. [Оригинальный DTS](https://disk.yandex.com/d/aOix3wGa8EeGrA)

| Шина | Адрес | Драйвер в дереве устройств |
| --- | --- | --- |
| 1 | `0x62` | SCD40, CO₂ |
| 1 | `0x59` | SGP40, VOC |
| 1 | `0x44` | SHT4x, температура и влажность |
| 1 | `0x45` | OPT3004, освещённость |
| 1 | `0x77` | TCBP001MB, давление |
| 2 | `0x38` | FocalTech FTS, сенсорный экран |
| 3 | `0x12` | PM9500, частицы |

## Снимок через USB

`usb_snapshot.py` читает версию и архитектуру ядра, ABI `QingSnow2App` и
привязки этих драйверов через существующее разрешённое USB ADB-подключение.
Для запуска нужен точный serial из `adb devices -l`.

```sh
python3 ports/monitor2/usb_snapshot.py --serial SERIAL
```

Снимок ограничен по времени и размеру. Скрипт сверяет USB-транспорт и boot ID
между чтениями. В JSON входят только аппаратные сведения. Инструмент пока
проверен с синтетическими ответами, а параметры ядра и ABI предстоит сверить
на целевом экземпляре.

## Следующий необходимый снимок

Нужны точные model/stock, результаты USB-снимка, версия libc, boot/rootfs и
ownership дисплея, input и сенсоров именно целевого CGS2. Сначала
сохраняются read-only сведения и заводские файлы/их хэши в частном месте.
Затем определяются ограниченный запуск, независимый возврат и согласованная
native/guardian сборка. Секреты, Wi-Fi/аккаунты и частные ELF не публикуются.
Включение debug mode, перезагрузка, остановка Snow или правка watchdog не
являются частью текущего программного исследования и автоматически не идут.
