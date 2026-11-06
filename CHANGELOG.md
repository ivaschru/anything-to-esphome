# Изменения

## Не выпущено

- Monitor 1: read-only fd-проверка девяти штатных файлов после disabled commit,
  связанная с host pins; подмена пути/байтов/metadata закрывает проверку,
  запуск и аппаратная квалификация остаются отдельными этапами

- Monitor 1: read-only pre-start kernel resource reader и portable parsers:
  conservative MemFree, обе TCP tables и отказ stale/malformed данным;
  без port reservation, cache credit или включения guardian/HACS installer

- Monitor 1: filesystem reader связывает новый trial marker только с actual
  creator-owned intent и повторной проверкой всех прежних pins; нет
  ignore-marker switch, повторного claim или автоматического запуска

- Monitor 1: read-only pre-intent filesystem scope связывает named root,
  payload/flags/plan/commit markers и отказывает неизвестной истории;
  full device collector/guardian и аппаратная установка ещё не готовы

- Monitor 1: отдельный admitted child-entry source с RAM cwd/preferences,
  фиксированными argv/env и очисткой унаследованных fd; hosted exec только
  собственного fixture, standalone guardian и hardware install ещё не готовы

- Monitor 1: device-side one-shot marker primitive с exact boot/root/creator,
  fixed O_EXCL, fsync/readback и единственным parent fork grant; нет
  adoption/retry/cleanup или включения standalone guardian/HACS

- Monitor 1: read-only joined review перед trial, точная RAM identity и
  обязательный device fd proof в policy; host report не разрешает запуск,
  память проверяется консервативно через MemFree для старого kernel

- Monitor 1: child-only no_new_privs до entry, обязательный policy ACK и
  проверка сохранения OOM/PDEATHSIG/NNP через fd-exec самого Linux fixture;
  parent/stock не меняются, device post-exec QA остаётся обязательной

- Monitor 1: read-only primitives для exact ARM image fd/hash/xattr и пустого
  private tmpfs; подмена/неполное чтение закрывают admission, execution и
  post-exec protection остаются отдельными неподтверждёнными этапами

- Monitor 1: Linux one-shot child primitive с preparation gate, child-only
  OOM/PDEATHSIG и bounded TERM/KILL; отдельный kernel fixture без запуска
  firmware, transport/ELF admission и standalone guardian ещё не подключены

- Monitor 1: pure policy первого ограниченного stock-bridge trial с обоими
  opt-out, проверкой owned child, fixed deadline и свежих Noise-показаний;
  execution adapter/guardian и физическая квалификация ещё не выполнены

- Monitor 1: отдельный experimental disabled script writer/rollback с новым
  consumed intent, marker и независимым whole-scope readback; оба opt-out
  сохраняются, activation и аппаратная квалификация ещё не выполнены

- Monitor 1: pure disabled commit/rollback policy и read-only review staged
  scope/процессов, отказ неизвестным/неполным состояниям и повторным writes;
  они подготавливают отдельный experimental writer, не дают write authority

- Monitor 1: экспериментальный USB staging только в новый disabled private
  каталог, consumed intent до записи, проверка ext4/места и read-only status;
  vendor scripts/процессы не меняются, аппаратная проверка ещё не выполнена

- Monitor 1: offline install plan связывает private capture/profile/source и
  настоящие ELF/helper/bootstrap pins, сохраняет recoverable payload и явные
  границы будущего live CAS; это ещё не запись или активация на приборе

- Monitor 1: read-only USB/ADB preflight с точной идентификацией и частным
  копированием фиксированных recovery-файлов; исходный startup hook восстановлен,
  обе полные startup/watchdog SHA воспроизводятся локально без записи на прибор

- Monitor 1: сквозные private source-сборки SCD40 и S8 прошли отдельно;
  добавлены инструкция candidate build и SHA-связанные bootstrap launchers,
  без включения installation/HACS admission

- Monitor 1: экспериментальный private candidate builder с отдельным SDK,
  явным профилем S8/SCD40 и production bridge без legacy trial API;
  installation admission остаётся закрытым до проверки

- Monitor 1: публичный исходник и проверяемая ARM-сборка штатного PM helper;
  Qt headers закреплены checksum, stock QtCore остаётся приватным input,
  build-only не запускает программу и не включает CGS1 installer

- Monitor 1: общие stock/full battery/charging/voltage entities; kernel gauge
  вместо расчёта процента из напряжения, корректный unknown/unavailable
- Monitor 1: отдельный sealed offline manual Wi-Fi, сохранение других сетей,
  no-SELECT rollback и DEFERRED boot для ручного editor
- Monitor 1: малый Noise recovery с inventory и защищённым удалением старых
  executable pairs; исправлено раннее startup admission перед поздним miio
- Добавлены portable C++ regression checks и описание реальных границ QA;
  CGS1 universal installer и Bluetooth proxy этим изменением не включаются

- English по умолчанию в мастере, переключатель English / Русский; выбор
  сохраняется в браузере, форма и активная установка не пересоздаются
- Переведены подписи, Bluetooth-сообщения, статусы и ошибки сервера
- В параметрах интеграции добавлен переключатель бокового меню; он не
  перезапускает MQTT/HTTP и не прерывает сессии
- Служебная карточка установщика открывает мастер через «Перейти», даже
  когда пункт меню скрыт; права администратора сохранены
- Основной GitHub README переведён на английский, русская версия доступна
  через ссылку Русский в README.ru.md

- Stock 4.2.1 / HW 0001 выделен в отдельный MCU-профиль в разработке;
  готовой прошивки для него пока нет, установка остаётся заблокированной
- Добавлены переносимый receive-only CG/TLV parser, проверки границ под
  ASan/UBSan и перечень недостающих сведений для нового ESPHome backend
- Мастер выбирает профиль по каталогу и объясняет ограничение 4.2.1;
  повторный выбор неподдержанного прибора скрывает прежнюю форму установки

## 0.1.1 — 2026-11-06

- Обычное добавление интеграции больше не спрашивает IP и порты: адрес
  определяется через сетевые настройки HA, порты берутся по умолчанию
- При неудачном автоопределении спрашивается только локальный IP
- Ручная настройка адреса/портов вынесена в отдельные параметры интеграции
- Ранее заданные вручную значения сохранены; автоматический адрес обновляется
  при следующем запуске интеграции, в том числе после DHCP-изменения
- Первое полное аппаратное испытание браузерного мастера успешно: CGDN1,
  stock 4.5.8 / HW 0001, запуск ESPHome и живые CO₂/T/RH в HA

## 0.1.0 — 2026-11-06

- Исправлена обычная установка через HACS / Marketplace: опубликован release
  ZIP без обязательного включения предварительных версий
- Ветка `main` скрыта из списка загрузки: для zip_release нужен именно release
- Workflow различает обычные и предварительные теги
- Аппаратная готовность мастера не изменилась: он остаётся экспериментальным

## 0.1.0-beta.1 — 2026-11-06

- Единый публичный проект Lite, Monitor 1 и Monitor 2 с честной матрицей поддержки
- HACS-панель Lite: Web Bluetooth setup, локальный MQTT/HTTP, уникальные ключи
- Публичный UI25-шаблон с Inter/OFL и проверкой checksum/SHA/CRC
- Однократная OTA-команда с приватным журналом и проверкой native API
- Общие исходники CGS1 S8/SCD40; Monitor 2 остаётся unverified
- Новый мастер ещё требует полного испытания установки на реальном приборе
