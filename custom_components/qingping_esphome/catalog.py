"""Hardware evidence is a separate concern from model marketing names.

An unsupported profile stays visible in the common wizard, but it cannot gain
installation authority merely because a filename or title looks similar.
"""
from .errors import InstallerError

CATALOG = [
    {"id": "lite", "name": "Air Monitor Lite", "model": "CGDN1", "platform": "ESP32",
     "transport": "ble_mqtt", "installer": "beta", "firmware": "lite-ui25",
     "stock_versions": ["4.5.8"],
     "hardware_versions": ["0001"],
     "note": "BLE настраивает сеть, Home Assistant передаёт ESP32 app по локальной сети"},
    {"id": "lite-434", "name": "Air Monitor Lite · stock 4.3.4", "model": "CGDN1", "platform": "ESP32",
     "transport": "ble_mqtt", "installer": "beta", "firmware": "lite-434",
     "stock_versions": ["4.3.4"], "hardware_versions": ["0001"],
     "note": "Отдельная polling-only прошивка: PM OFF останавливает измерения, но не вентилятор. Первичная установка через BLE/MQTT экспериментальная"},
    {"id": "lite-mcu421", "name": "Air Monitor Lite · MCU 4.2.1", "model": "CGDN1", "platform": "ESP32 + MCU",
     "transport": "ble_mqtt", "installer": "in_development", "firmware": None,
     "stock_versions": ["4.2.1"], "hardware_versions": ["0001"],
     "note_key": "profile_mcu421",
     "note": "Отдельный MCU backend: UART receiver и raw decoder собраны; startup, шкалы, питание и экран ещё не квалифицированы. Образ для установки недоступен"},
    {"id": "monitor1-s8", "name": "Air Monitor 1 · S8", "model": "CGS1", "platform": "Linux ARMv7",
     "co2_type": 2, "transport": "usb_adb_then_noise", "installer": "source_only",
     "wizard": "experimental_usb", "installation_ready": False,
     "note": "Полный порт и экспериментальный USB-мастер доступны с частной сборкой; чистая установка на заводской прибор ещё не проверена"},
    {"id": "monitor1-scd40", "name": "Air Monitor 1 · SCD40", "model": "CGS1", "platform": "Linux ARMv7",
     "co2_type": 3, "transport": "usb_adb_then_noise", "installer": "source_only",
     "wizard": "experimental_usb", "installation_ready": False,
     "note": "Отдельный CO₂ backend и экспериментальный USB-мастер с частной сборкой; чистая установка ещё не проверена"},
    {"id": "monitor2", "name": "Air Monitor 2", "model": "CGS2", "platform": "unverified",
     "transport": None, "installer": "unverified",
     "note": "Аппаратный профиль и установка ещё не подтверждены на приборе"},
    {"id": "sonoff-s60tpf", "brand": "sonoff", "name": "S60TPF", "model": "S60TPF", "platform": "ESP32-C3",
     "transport": "ewelink_lan", "installer": "experimental", "firmware": "sonoff-s60tpf",
     "stock_versions": ["1.2.0"], "hardware_versions": ["SN-ESP32C3-S60-01"],
     "note": "Experimental Wi-Fi conversion with private factory backup; native ESPHome firmware updates afterwards"},
]

# Keep old profile IDs and admission contracts stable. A brand is navigation,
# never permission to run a different hardware family's installation engine.
for _profile in CATALOG:
    _profile.setdefault("brand", "qingping")


def admission(profile_id, model, stock_version):
    """Fail before broker setup or firmware creation for unknown hardware."""
    profile = next((p for p in CATALOG if p["id"] == profile_id), None)
    if not profile or profile["installer"] != "beta":
        if profile and profile["installer"] == "in_development":
            raise InstallerError(profile.get("note_key", "profile_unavailable"))
        raise InstallerError("profile_unavailable")
    if model != profile["model"] or stock_version not in profile["stock_versions"]:
        raise InstallerError("identity_unsupported")
    return profile


def factory_lite_profile(model, stock_version, hardware):
    """Resolve one exact factory tuple, independently of caller/profile labels.

    Both BLE transports use this same catalog. HW0001 alone cannot admit the
    external-MCU family; its stock generations have no factory-write backend.
    """
    matches = [profile for profile in CATALOG if profile["id"].startswith("lite")
               and profile.get("model") == model and stock_version in profile.get("stock_versions", ())
               and hardware in profile.get("hardware_versions", ())]
    if len(matches) != 1:
        raise InstallerError("identity_unsupported")
    return admission(matches[0]["id"], model, stock_version)
