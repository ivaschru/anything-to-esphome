"""Validate model-specific public releases before any private personalization.

The index may change; its image and manifest URLs must name immutable assets
in this exact repository. A catalog entry is release metadata, never authority
to enable an unqualified hardware backend. Firmware revisions are independent
of the HACS integration version, so an installer-only release is not an OTA.
"""
from __future__ import annotations

from dataclasses import dataclass
import re
from urllib.parse import urlsplit

REPOSITORY = "ivaschru/qingping-esphome"
CATALOG_URL = f"https://github.com/{REPOSITORY}/releases/latest/download/firmware-catalog.json"
CATALOG_FORMAT = "qingping-esphome-firmware-catalog-v1"
MAX_INDEX_BYTES = 65536
MAX_IMAGE_BYTES = 0x1E0000 - 1
# This is deliberately an implementation allowlist, not the marketing catalog.
# MCU Lite, Linux Monitor 1 and Monitor 2 need their own qualified updater.
UPDATE_BACKENDS = {"lite": "esp32-noise-app-v1"}
KNOWN_PROFILES = {"lite", "lite-mcu421", "monitor1-s8", "monitor1-scd40", "monitor2"}


class FirmwareError(ValueError):
    """A fixed public error code; never include a credential or remote body."""


def _text(value, *, maximum=128):
    if not isinstance(value, str) or not 1 <= len(value) <= maximum or any(ord(c) < 32 for c in value):
        raise FirmwareError("invalid_catalog")
    return value


def _positive(value, maximum):
    if type(value) is not int or not 1 <= value <= maximum:
        raise FirmwareError("invalid_catalog")
    return value


def asset_url(value, *, filename=None):
    """No arbitrary URLs, mutable branch paths, credentials, ports or queries."""
    value = _text(value, maximum=512)
    parsed = urlsplit(value)
    prefix = f"/{REPOSITORY}/releases/download/"
    if (parsed.scheme != "https" or parsed.netloc != "github.com"
            or parsed.query or parsed.fragment or not parsed.path.startswith(prefix)):
        raise FirmwareError("invalid_asset_url")
    pieces = parsed.path[len(prefix):].split("/")
    if len(pieces) != 2 or not re.fullmatch(r"v[0-9]+\.[0-9]+\.[0-9]+", pieces[0]):
        raise FirmwareError("invalid_asset_url")
    if not re.fullmatch(r"[a-z0-9][a-z0-9._-]{0,100}", pieces[1]):
        raise FirmwareError("invalid_asset_url")
    if filename is not None and pieces[1] != filename:
        raise FirmwareError("invalid_asset_url")
    return value


@dataclass(frozen=True)
class Asset:
    url: str
    size: int
    sha256: str

    @classmethod
    def parse(cls, data, *, filename, maximum):
        if not isinstance(data, dict):
            raise FirmwareError("invalid_catalog")
        digest = data.get("sha256")
        if not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest):
            raise FirmwareError("invalid_catalog")
        return cls(asset_url(data.get("url"), filename=filename),
                   _positive(data.get("size"), maximum), digest)


@dataclass(frozen=True)
class Release:
    profile: str
    version: str
    revision: int
    backend: str
    minimum_integration: str
    image: Asset
    manifest: Asset
    release_url: str
    summary: str
    # Prior public profile-capable versions must remain recognisable when a
    # device moves after several newer releases. This bounded public history
    # comes from the same validated catalog, never from the device itself.
    adoption_versions: tuple[tuple[str, int], ...] = ()
    public_version: int | None = None

    @property
    def display_version(self):
        # Keep the exact old UI/build identity for native verification. A short
        # public label must never reset or replace the internal OTA sequence.
        return str(self.public_version) if self.public_version is not None else self.version

    @classmethod
    def parse(cls, profile, data):
        if profile not in KNOWN_PROFILES or not isinstance(data, dict):
            raise FirmwareError("invalid_catalog")
        # Each hardware profile owns its asset names. A Linux/MCU image cannot
        # gain Lite install support by merely reusing the CGDN1 model string.
        stem = "lite-template" if profile == "lite" else profile + "-template"
        minimum = _text(data.get("minimum_integration"))
        if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", minimum):
            raise FirmwareError("invalid_catalog")
        release_url = _text(data.get("release_url"), maximum=512)
        if not re.fullmatch(r"https://github\.com/ivaschru/qingping-esphome/releases/tag/v[0-9]+\.[0-9]+\.[0-9]+", release_url):
            raise FirmwareError("invalid_catalog")
        history = data.get("adoption_versions", [])
        revision = _positive(data.get("revision"), 2**53 - 1)
        if not isinstance(history, list) or len(history) > 128:
            raise FirmwareError("invalid_catalog")
        current_version = _text(data.get("version"))
        versions, revisions, admitted = {current_version}, {revision}, []
        for item in history:
            if not isinstance(item, dict) or set(item) != {"version", "revision"}:
                raise FirmwareError("invalid_catalog")
            version = _text(item["version"])
            prior = _positive(item["revision"], revision)
            if prior < 2 or version in versions or prior in revisions:
                raise FirmwareError("invalid_catalog")
            versions.add(version); revisions.add(prior); admitted.append((version, prior))
        return cls(profile, _text(data.get("version")),
                   _positive(data.get("revision"), 2**53 - 1),
                   _text(data.get("backend")), minimum,
                   Asset.parse(data.get("image"), filename=stem + ".bin", maximum=MAX_IMAGE_BYTES),
                   Asset.parse(data.get("manifest"), filename=stem + ".json", maximum=MAX_INDEX_BYTES),
                   release_url, _text(data.get("summary"), maximum=255), tuple(admitted),
                   _positive(data["public_version"], 2**53 - 1) if "public_version" in data else None)

    def supports_install(self, integration_version):
        """New catalogs cannot silently demand a backend absent from this HA."""
        if self.backend != UPDATE_BACKENDS.get(self.profile):
            return False
        try:
            installed = tuple(int(n) for n in integration_version.split("."))
            minimum = tuple(int(n) for n in self.minimum_integration.split("."))
        except (TypeError, ValueError):
            return False
        return len(installed) == 3 and installed >= minimum


def parse_catalog(data):
    if (not isinstance(data, dict) or data.get("format") != CATALOG_FORMAT
            or not isinstance(data.get("releases"), dict)
            or len(data["releases"]) > len(KNOWN_PROFILES)):
        raise FirmwareError("invalid_catalog")
    return {profile: Release.parse(profile, item) for profile, item in data["releases"].items()}
