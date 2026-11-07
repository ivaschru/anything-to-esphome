"""Personalize a public ESP32 template without installing a compiler into HA.

The build reserves fixed-length strings and a 32-byte Noise slot. This changes
data, never instruction addresses or segment sizes. Both the ESP32 checksum
and appended SHA-256 are rebuilt, followed by Qingping's distinct CRC trailer.
No personalized bytes, SSID or keys are written to a public artifact or log.
"""
from __future__ import annotations

import hashlib
import ipaddress
import re
import struct
import zlib

SLOTS = {
    "display_feed_entity": b"QF_DISPLAY_FEED_ENTITY_" + b"E" * 42,
    # Original factory software is provenance, not a guessed PCB revision.
    "source_stock_version": b"QF_ORIGINAL_STOCK_VERSION_" + b"V" * 8,
    "ssid": b"QF_SSID_" + b"S" * 24,
    "wifi_password": b"QF_WIFI_PASSWORD_" + b"W" * 46,
    "name": b"qingping-" + b"z" * 22,
    "ap_ssid": b"QF_ACCESS_POINT_" + b"A" * 16,
    "ap_password": b"QF_AP_PASSWORD_" + b"P" * 48,
    "ota_password": b"QF_OTA_PASSWORD_" + b"O" * 47,
    "noise_psk": hashlib.sha256(b"Qingping public template Noise slot v1").digest(),
}


def mac_normalize(value):
    result = str(value).replace(":", "").replace("-", "").upper()
    if len(result) != 12 or any(c not in "0123456789ABCDEF" for c in result):
        raise ValueError("Некорректный MAC")
    return result


def private_ipv4(value):
    address = ipaddress.ip_address(value)
    # is_private also admits documentation/reserved ranges in some Python
    # versions. This transport is deliberately limited to the three RFC1918
    # LAN ranges, not every address described as non-global by ipaddress.
    if address.version != 4 or not any(address in ipaddress.ip_network(net) for net in
        ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16")):
        raise ValueError("Нужен локальный IPv4-адрес")
    return str(address)


def layout(data, *, verify=True):
    if len(data) < 24 or data[0] != 0xE9 or not 1 <= data[1] <= 16:
        raise ValueError("Это не ESP32 app-образ")
    if struct.unpack_from("<H", data, 12)[0] != 0:
        raise ValueError("Образ предназначен для другого ESP32")
    position, checksum, ranges = 24, 0xEF, []
    for _ in range(data[1]):
        if position + 8 > len(data):
            raise ValueError("Обрезанный заголовок сегмента")
        size = struct.unpack_from("<I", data, position + 4)[0]
        start, end = position + 8, position + 8 + size
        if end > len(data):
            raise ValueError("Обрезанный сегмент")
        ranges.append((start, end))
        for byte in data[start:end]: checksum ^= byte
        position = end
    checksum_offset = position + 15 - position % 16
    end = checksum_offset + 1
    if end > len(data) or verify and data[checksum_offset] != checksum:
        raise ValueError("Неверная контрольная сумма app")
    if data[23]:
        if end + 32 > len(data): raise ValueError("Нет appended SHA-256")
        if verify and hashlib.sha256(data[:end]).digest() != data[end:end + 32]:
            raise ValueError("Неверный appended SHA-256")
        end += 32
    if end != len(data) or len(data) >= 0x1E0000:
        raise ValueError("Лишние данные или app не помещается в OTA-раздел")
    return ranges, checksum_offset, checksum


def personalize(template, values, expected_sha256):
    if hashlib.sha256(template).hexdigest() != expected_sha256:
        raise ValueError("Шаблон не совпадает с release manifest")
    ranges, _, _ = layout(template)
    data = bytearray(template)
    for name, marker in SLOTS.items():
        value = values[name]
        if name == "display_feed_entity" and value and not re.fullmatch(r"sensor\.[a-z0-9_]+", value):
            raise ValueError("Invalid display feed entity")
        if name == "source_stock_version" and value not in {"4.3.4", "4.5.8"}:
            raise ValueError("Unqualified original stock generation")
        value = value.encode("utf-8") if isinstance(value, str) else bytes(value)
        if name == "noise_psk":
            if len(value) != 32: raise ValueError("Noise key должен содержать 32 байта")
        elif name == "name" and len(value) != len(marker):
            # ESPHome pre_setup stores a compile-time name length. Padding a
            # shorter hostname with NUL would leave that length inconsistent.
            raise ValueError("Имя должно сохранять длину публичного слота")
        elif len(value) > len(marker) or b"\0" in value:
            raise ValueError("Значение не помещается в слот: " + name)
        if value == marker: raise ValueError("Публичный placeholder не заменён")
        positions, at = [], 0
        while (at := data.find(marker, at)) >= 0:
            if not any(start <= at and at + len(marker) <= end for start, end in ranges):
                raise ValueError("Слот находится за пределами app-данных")
            positions.append(at); at += len(marker)
        if not positions: raise ValueError("В шаблоне отсутствует слот: " + name)
        for at in positions:
            data[at:at + len(marker)] = value.ljust(len(marker), b"\0")
    _, checksum_offset, checksum = layout(data, verify=False)
    data[checksum_offset] = checksum
    if data[23]:
        data[checksum_offset + 1:checksum_offset + 33] = hashlib.sha256(data[:checksum_offset + 1]).digest()
    layout(data)
    # Qingping uses reflected CRC32 with initial value 0 and NO final xor.
    crc = ~zlib.crc32(data, 0xFFFFFFFF) & 0xFFFFFFFF
    return bytes(data) + struct.pack("<I", crc)
