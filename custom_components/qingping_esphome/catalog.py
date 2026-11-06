"""Hardware evidence is a separate concern from model marketing names.

An unsupported profile stays visible in the common wizard, but it cannot gain
installation authority merely because a filename or title looks similar.
"""
CATALOG = [
    {"id": "lite", "name": "Air Monitor Lite", "model": "CGDN1", "platform": "ESP32",
     "transport": "ble_mqtt", "installer": "beta", "firmware": "lite-ui25",
     "stock_versions": ["4.5.8"],
     "hardware_versions": ["0001"],
     "note": "BLE настраивает сеть, Home Assistant передаёт ESP32 app по локальной сети"},
    {"id": "lite-mcu421", "name": "Air Monitor Lite · MCU 4.2.1", "model": "CGDN1", "platform": "ESP32 + MCU",
     "transport": "ble_mqtt", "installer": "in_development", "firmware": None,
     "stock_versions": ["4.2.1"], "hardware_versions": ["0001"],
     "note": "Lite 4.2.1 использует отдельный MCU. Разбор пакетов подготовлен; запуск и питание ещё не восстановлены. Образ для прошивки пока недоступен"},
    {"id": "monitor1-s8", "name": "Air Monitor 1 · S8", "model": "CGS1", "platform": "Linux ARMv7",
     "co2_type": 2, "transport": "usb_adb_then_noise", "installer": "source_only",
     "note": "Порт испытан на приборе; общий USB-установщик ещё не включён"},
    {"id": "monitor1-scd40", "name": "Air Monitor 1 · SCD40", "model": "CGS1", "platform": "Linux ARMv7",
     "co2_type": 3, "transport": "usb_adb_then_noise", "installer": "source_only",
     "note": "Отдельный CO₂ backend; общий USB-установщик ещё не включён"},
    {"id": "monitor2", "name": "Air Monitor 2", "model": "CGS2", "platform": "unverified",
     "transport": None, "installer": "unverified",
     "note": "Аппаратный профиль и установка ещё не подтверждены на приборе"},
]


def admission(profile_id, model, stock_version):
    """Fail before broker setup or firmware creation for unknown hardware."""
    profile = next((p for p in CATALOG if p["id"] == profile_id), None)
    if not profile or profile["installer"] != "beta":
        if profile and profile["installer"] == "in_development":
            raise ValueError(profile["note"])
        raise ValueError("Для этого аппаратного профиля установщик ещё не готов")
    if model != profile["model"] or stock_version not in profile["stock_versions"]:
        raise ValueError("Эта модель или заводская версия ещё не проверена")
    return profile
