"""Decode a device-owned update profile using the HA entry's existing Noise key.

The action response is deliberately an opaque AES-GCM envelope as HA can expose
ordinary action responses in traces. No Wi-Fi/OTA secret is an entity state or
plain response field. A fresh caller challenge and the exact factory MAC bind
each read; possessing a different device's key or replaying an old response is
insufficient. This protocol grants no installation or secret rotation authority.
"""
from __future__ import annotations

import base64
from dataclasses import dataclass, field
import hashlib
import hmac
import json
import re

from .image import SLOTS, mac_normalize

ACTION = "qingping_update_profile_v1"
ENVELOPE = "qingping-update-profile-envelope-v1"
PROFILE = "qingping-device-update-profile-v1"
KEY_DOMAIN = b"qingping-esphome/update-profile/v1"
PROFILE_VERSIONS = {"2026.11.07-ui25-profile1": 2, "2026.11.07-ui25-quiet2": 3}
PROFILE_434_VERSIONS = {"2026.11.08-ui25-434v1": 4}
MAX_RESPONSE = 8192


class ProfileError(ValueError):
    """Fixed, value-free refusal; never attach response bodies or credentials."""


def noise_key_bytes(value):
    try:
        result = base64.b64decode(value, validate=True)
        if len(result) != 32 or not any(result): raise ValueError
        return result
    except (ValueError, TypeError):
        raise ProfileError("device_profile_unavailable") from None


def associated_data(mac, challenge):
    if not isinstance(challenge, str) or not re.fullmatch(r"[0-9a-f]{32}", challenge):
        raise ProfileError("device_profile_unavailable")
    return (PROFILE + "|" + mac_normalize(mac) + "|" + challenge).encode("ascii")


def _text(value, maximum, *, minimum=0):
    if not isinstance(value, str) or "\0" in value or not minimum <= len(value.encode()) <= maximum:
        raise ProfileError("device_profile_unavailable")
    return value


@dataclass(frozen=True)
class DeviceProfile:
    mac: str
    name: str
    version: str
    revision: int
    values: dict[str, str] = field(repr=False)
    public_version: int | None = None
    source_stock_version: str = "4.5.8"
    profile: str = "lite"


def decode_profile(response, key, mac, name, challenge, *, public_versions=None, hardware_versions=None):
    """Validate one authenticated read, with no partial/default profile values."""
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        psk = noise_key_bytes(key)
        aad = associated_data(mac, challenge)
        if not isinstance(response, bytes) or not 1 <= len(response) <= MAX_RESPONSE: raise ValueError
        envelope = json.loads(response)
        if not isinstance(envelope, dict) or set(envelope) != {"format", "nonce", "ciphertext"}: raise ValueError
        if envelope["format"] != ENVELOPE: raise ValueError
        if not re.fullmatch(r"[0-9a-f]{24}", envelope["nonce"]): raise ValueError
        if not re.fullmatch(r"[0-9a-f]{34,4128}", envelope["ciphertext"]): raise ValueError
        aes_key = hmac.digest(psk, KEY_DOMAIN, hashlib.sha256)
        plain = AESGCM(aes_key).decrypt(bytes.fromhex(envelope["nonce"]), bytes.fromhex(envelope["ciphertext"]), aad)
        if len(plain) > 2048: raise ValueError
        data = json.loads(plain)
        wire_profile = data.get("profile")
        if wire_profile == "lite-434":
            versions = {**PROFILE_434_VERSIONS, **(hardware_versions or {})}
            stock_ok = data.get("source_stock_version") == "4.3.4"
        elif wire_profile == "lite":
            versions = {**PROFILE_VERSIONS, **(public_versions or {})}
            stock_ok = (data.get("source_stock_version") == "4.5.8" or
                        data.get("source_stock_version") == "4.3.4" and data.get("version") == "2026.11.07-ui25-quiet2")
        else:
            raise ValueError
        # An authenticated API endpoint is not proof of an arbitrary board.
        # Admit only published capability/profile generations (built-in or validated catalog), never a
        # marketing model match or an unrecognised private experimental UI.
        if (data.get("format") != PROFILE or data.get("challenge") != challenge
                or data.get("mac") != mac_normalize(mac) or data.get("name") != name
                or data.get("hardware") != "0001" or not stock_ok
                or data.get("version") not in versions
                or type(data.get("revision")) is not int
                or data["revision"] < 2 or data["revision"] != versions[data["version"]]): raise ValueError
        values = data["personalization"]
        public = data.get("public_version")
        if public is not None and (type(public) is not int or not 1 <= public <= 2**53-1): raise ValueError
        keys = {"ssid", "wifi_password", "ap_ssid", "ap_password", "ota_password"}
        if not isinstance(values, dict) or set(values) not in (keys, keys | {"display_feed_entity"}): raise ValueError
        if "display_feed_entity" in values:
            feed = _text(values["display_feed_entity"], len(SLOTS["display_feed_entity"]))
            if feed and not re.fullmatch(r"sensor\.[a-z0-9_]+", feed): raise ValueError
        _text(name, len(SLOTS["name"]), minimum=len(SLOTS["name"]))
        for k in keys:
            _text(values[k], len(SLOTS[k]), minimum=8 if k == "ap_password" else 1 if k in {"ssid", "ap_ssid", "ota_password"} else 0)
        return DeviceProfile(mac_normalize(mac), name, data["version"], data["revision"], {**values, "name": name}, public, data["source_stock_version"], wire_profile)
    except Exception:
        # InvalidTag, SDK/JSON errors and malformed untrusted data must never
        # turn private plaintext/response bytes into diagnostics or HA state.
        raise ProfileError("device_profile_unavailable") from None
