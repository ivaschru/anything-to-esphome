"""Pure S60TPF admission, separate from network discovery and flash authority.

All public DTOs are explicit allowlists. Device keys and eWeLink sessions are
never serialized by a generic dataclass/asdict/repr operation. An mDNS address
only locates a candidate; the owned cloud record and fresh decrypted advert
must independently agree before an initial installation can start.
"""
from __future__ import annotations

from dataclasses import dataclass, field
import ipaddress
import re
import time

PROFILE = "sonoff-s60tpf"
MODEL = "S60TPF"
HARDWARE = "SN-ESP32C3-S60-01"
STOCK = "1.2.0"
UIID = 190
SLOT_SIZE = 0x1F0000
SELECTION_TTL = 300

MESSAGES = {
    "sonoff_auth_required": "Sign into the eWeLink account that owns this plug.",
    "sonoff_auth_failed": "eWeLink sign-in did not succeed. Check the account and region.",
    "sonoff_unavailable": "The selected plug did not answer on the local network.",
    "sonoff_unsupported": "Only Wi-Fi S60TPF factory 1.2.0 is admitted by this profile.",
    "sonoff_identity_changed": "The selected plug identity or firmware changed. Select it again.",
    "sonoff_selection_expired": "The device selection expired or belongs to another administrator.",
    "sonoff_load_ack": "Confirm the connected load may be interrupted and the initial power-loss risk.",
    "sonoff_busy": "An installation is already running or needs outcome review.",
    "sonoff_runtime_failed": "The installation engine could not be prepared. No automatic retry was made.",
    "sonoff_outcome_unknown": "Installation needs outcome review. Do not start another conversion.",
    "sonoff_template_missing": "Install the complete release with its matching S60TPF template.",
    "sonoff_invalid_request": "The S60TPF request could not be accepted.",
    "sonoff_backup_missing": "The private factory backup is not available.",
}


class SonoffError(ValueError):
    """Only a fixed code can cross into an HA response or exception."""
    def __init__(self, code):
        self.code = code if code in MESSAGES else "sonoff_invalid_request"
        super().__init__(MESSAGES[self.code])


def lan_address(value):
    try:
        address = ipaddress.IPv4Address(value)
        allowed = any(address in ipaddress.IPv4Network(net) for net in
                      ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"))
        if allowed and not address.is_multicast:
            return str(address)
    except (ValueError, TypeError, ipaddress.AddressValueError):
        pass
    raise SonoffError("sonoff_invalid_request")


def canonical_mac(value):
    value = str(value or "").replace(":", "").replace("-", "").upper()
    if not re.fullmatch(r"[0-9A-F]{12}", value) or value in {"0" * 12, "F" * 12}:
        raise SonoffError("sonoff_unsupported")
    return ":".join(value[i:i + 2] for i in range(0, 12, 2))


@dataclass(repr=False)
class OwnedDevice:
    """Detached private snapshot; never keep references to SonoffLAN's mapping."""
    device_id: str
    name: str
    mac: str
    version: str
    host: str | None
    source: str
    raw: dict = field(repr=False)
    auth: dict | None = field(default=None, repr=False)
    region: str = "eu"

    def __repr__(self):
        return "<OwnedDevice S60TPF private>"

    @classmethod
    def parse(cls, value, *, source, auth=None, region="eu"):
        import copy
        if not isinstance(value, dict):
            raise SonoffError("sonoff_unsupported")
        params, extra = value.get("params") or {}, value.get("extra") or {}
        if (value.get("productModel") != MODEL or extra.get("uiid") != UIID
                or extra.get("model") != HARDWARE or params.get("fwVersion") != STOCK
                or not re.fullmatch(r"[0-9a-f]{10}", str(value.get("deviceid", "")))):
            raise SonoffError("sonoff_unsupported")
        if region not in {"eu", "us", "as", "cn"}:
            raise SonoffError("sonoff_auth_required")
        host = value.get("host") or value.get("local_ip")
        try:
            host = lan_address(host) if host else None
        except SonoffError:
            host = None
        return cls(value["deviceid"], str(value.get("name") or MODEL)[:128],
                   canonical_mac(params.get("staMac")), STOCK, host, source,
                   copy.deepcopy(value), copy.deepcopy(auth), region)

    def public(self, selection):
        return {"selection": selection, "name": self.name, "model": MODEL,
                "mac": self.mac, "stock_version": self.version,
                "host": self.host, "source": self.source,
                "has_key": bool(self.raw.get("devicekey")),
                "needs_login": not bool(self.auth and self.auth.get("at"))}

    def require_key(self):
        key = self.raw.get("devicekey")
        if not isinstance(key, str) or not 8 <= len(key) <= 128:
            raise SonoffError("sonoff_auth_required")
        return key


def require_selection(selection, owner, *, now=None):
    """No UI selector can renew its authority or move it between HA users."""
    if (not selection or selection["owner"] != owner
            or (time.monotonic() if now is None else now) >= selection["expires"]):
        raise SonoffError("sonoff_selection_expired")
    return selection["device"]
