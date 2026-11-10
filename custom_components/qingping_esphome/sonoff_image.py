"""ESP32-C3 app-only personalization; never append Qingping's stock CRC.

The slot order matches the device-owned streaming updater. Full original SHA,
segment boundaries, XOR and appended SHA are checked before any replacement.
No bootloader, partition table, NVS or factory backup is accepted as an app.
"""
import hashlib
import struct

SLOTS = {
    "display_feed_entity": b"QF_DISPLAY_FEED_ENTITY_" + b"E" * 42,
    "source_stock_version": b"QF_ORIGINAL_STOCK_VERSION_" + b"V" * 8,
    "ssid": b"QF_SSID_" + b"S" * 24,
    "wifi_password": b"QF_WIFI_PASSWORD_" + b"W" * 46,
    "name": b"qingping-" + b"z" * 22,
    "ap_ssid": b"QF_ACCESS_POINT_" + b"A" * 16,
    "ap_password": b"QF_AP_PASSWORD_" + b"P" * 48,
    "ota_password": b"QF_OTA_PASSWORD_" + b"O" * 47,
    "noise_psk": hashlib.sha256(b"Qingping public template Noise slot v1").digest(),
}
MAX_APP = 0x1F0000


def layout(data, *, verify=True):
    if (len(data) < 64 or len(data) > MAX_APP or data[0] != 0xE9
            or not 1 <= data[1] <= 16 or struct.unpack_from("<H", data, 12)[0] != 5
            or data[23] != 1):
        raise ValueError("Invalid S60TPF ESP32-C3 application")
    position, checksum, ranges = 24, 0xEF, []
    for _ in range(data[1]):
        if position + 8 > len(data):
            raise ValueError("Truncated application segment")
        length = struct.unpack_from("<I", data, position + 4)[0]
        begin, end = position + 8, position + 8 + length
        if end > len(data):
            raise ValueError("Truncated application data")
        ranges.append((begin, end))
        for byte in data[begin:end]:
            checksum ^= byte
        position = end
    at = position + 15 - position % 16
    if at + 33 != len(data):
        raise ValueError("Extra application bytes or wrong partition image")
    if verify and (data[at] != checksum or hashlib.sha256(data[:at + 1]).digest() != data[at + 1:]):
        raise ValueError("Application checksum mismatch")
    return ranges, at, checksum


def personalize(template, values, expected_sha256):
    if hashlib.sha256(template).hexdigest() != expected_sha256:
        raise ValueError("S60TPF template SHA mismatch")
    ranges, _, _ = layout(template)
    output = bytearray(template)
    for name, marker in SLOTS.items():
        value = values[name]
        value = value.encode() if isinstance(value, str) else bytes(value)
        if (len(value) > len(marker) or value == marker
                or name in {"name", "noise_psk"} and len(value) != len(marker)
                or name != "noise_psk" and b"\0" in value
                or name == "source_stock_version" and value != b"1.2.0"):
            raise ValueError("Invalid private S60TPF slot")
        start, count = 0, 0
        while (at := template.find(marker, start)) >= 0:
            if not any(begin <= at and at + len(marker) <= end for begin, end in ranges):
                raise ValueError("Personalization outside application data")
            output[at:at + len(marker)] = value.ljust(len(marker), b"\0")
            start, count = at + len(marker), count + 1
        if not count:
            raise ValueError("Missing S60TPF template slot")
    _, at, checksum = layout(output, verify=False)
    output[at] = checksum
    output[at + 1:] = hashlib.sha256(output[:at + 1]).digest()
    layout(output)
    return bytes(output)


def patch_table(template):
    ranges, _, _ = layout(template)
    patches = []
    for slot, marker in enumerate(SLOTS.values()):
        start, count = 0, 0
        while (at := template.find(marker, start)) >= 0:
            if not any(begin <= at and at + len(marker) <= end for begin, end in ranges):
                raise ValueError("Personalization outside application data")
            patches.append([at, slot])
            start, count = at + len(marker), count + 1
        if not count:
            raise ValueError("Missing public S60TPF slot")
    patches.sort()
    if len(patches) > 128:
        raise ValueError("Too many S60TPF personalization slots")
    for (at, slot), (following, _) in zip(patches, patches[1:]):
        if at + len(list(SLOTS.values())[slot]) > following:
            raise ValueError("Overlapping S60TPF slots")
    return patches
