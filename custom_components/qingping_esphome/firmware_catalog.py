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

REPOSITORY = "ivaschru/anything-to-esphome"
LEGACY_REPOSITORY = "ivaschru/qingping-esphome"
REPOSITORIES = (REPOSITORY, LEGACY_REPOSITORY)
LEGACY_CATALOG_URL = f"https://github.com/{REPOSITORY}/releases/latest/download/firmware-catalog.json"
CATALOG_BRANCH = "firmware-catalog"
CATALOG_URL = f"https://raw.githubusercontent.com/{REPOSITORY}/{CATALOG_BRANCH}/firmware-catalog.json"
CATALOG_FORMAT = "qingping-esphome-firmware-catalog-v1"
MAX_INDEX_BYTES = 65536
MAX_IMAGE_BYTES = 0x1E0000 - 1
# This is deliberately an implementation allowlist, not the marketing catalog.
# MCU Lite, Linux Monitor 1 and Monitor 2 need their own qualified updater.
UPDATE_BACKENDS = {"lite": "esp32-noise-app-v1", "lite-434": "esp32-noise-app-v1"}
KNOWN_PROFILES = {"lite-434", "lite", "lite-mcu421", "monitor1-s8", "monitor1-scd40", "monitor2"}
MONITOR1_CO2_TYPES = {"monitor1-s8": 2, "monitor1-scd40": 3}


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


def firmware_tag(profile, version):
    """Immutable data tags are not GitHub Releases, so HACS never adopts them."""
    if profile not in KNOWN_PROFILES or type(version) is not int or not 1 <= version <= 2**53-1:
        raise FirmwareError("invalid_catalog")
    return f"firmware-{profile}-v{version}"


def asset_url(value, *, filename=None, profile=None):
    """Admit old release assets and exact profile-bound immutable data tags.

    Only the catalog itself has a mutable branch URL. Firmware bytes cannot
    come from main/catalog branches, another repository, an unqualified tag,
    a query/fragment or a profile other than the one selected by HA.
    """
    value = _text(value, maximum=512)
    parsed = urlsplit(value)
    if parsed.scheme != "https" or parsed.query or parsed.fragment:
        raise FirmwareError("invalid_asset_url")
    repository = next((repo for repo in REPOSITORIES if parsed.path.startswith(f"/{repo}/")), None)
    if repository is None:
        raise FirmwareError("invalid_asset_url")
    legacy = f"/{repository}/releases/download/"
    raw = f"/{repository}/"
    if parsed.netloc == "github.com" and parsed.path.startswith(legacy):
        pieces = parsed.path[len(legacy):].split("/")
        valid = len(pieces)==2 and re.fullmatch(r"v[0-9]+\.[0-9]+\.[0-9]+",pieces[0])
    elif parsed.netloc == "raw.githubusercontent.com" and parsed.path.startswith(raw):
        pieces = parsed.path[len(raw):].split("/")
        allowed = (profile,) if profile is not None else KNOWN_PROFILES
        valid = len(pieces)==2 and any(
            re.fullmatch(rf"firmware-{re.escape(p)}-v[1-9][0-9]*",pieces[0]) for p in allowed)
    else:
        raise FirmwareError("invalid_asset_url")
    if not valid or not re.fullmatch(r"[a-z0-9][a-z0-9._-]{0,100}",pieces[1]):
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
    def parse(cls, data, *, filename, maximum, profile=None):
        if not isinstance(data, dict):
            raise FirmwareError("invalid_catalog")
        digest = data.get("sha256")
        if not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest):
            raise FirmwareError("invalid_catalog")
        return cls(asset_url(data.get("url"), filename=filename, profile=profile),
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
        legacy_url = any(re.fullmatch(rf"https://github\.com/{re.escape(repo)}/releases/tag/v[0-9]+\.[0-9]+\.[0-9]+", release_url) for repo in REPOSITORIES)
        public_number = _positive(data["public_version"],2**53-1) if "public_version" in data else None
        tag = firmware_tag(profile,public_number) if public_number is not None else None
        repository = next((repo for repo in REPOSITORIES if release_url == f"https://github.com/{repo}/tree/{tag}"), None)
        if not legacy_url and repository is None:
            raise FirmwareError("invalid_catalog")
        if not legacy_url:
            expected = f"https://raw.githubusercontent.com/{repository}/{tag}/"
            if (data.get("image",{}).get("url") != expected+stem+".bin"
                    or data.get("manifest",{}).get("url") != expected+stem+".json"):
                raise FirmwareError("invalid_asset_url")
        if legacy_url and any(str(data.get(k,{}).get("url","")).startswith("https://raw.") for k in ("image","manifest")):
            raise FirmwareError("invalid_asset_url")
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
                   Asset.parse(data.get("image"), filename=stem + ".bin", maximum=MAX_IMAGE_BYTES, profile=profile),
                   Asset.parse(data.get("manifest"), filename=stem + ".json", maximum=MAX_INDEX_BYTES, profile=profile),
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
    extra = data.get("hardware_releases", {})
    # A separate bounded extension keeps already-installed older integrations
    # reading their original map. Never let an extension replace an old key.
    if (not isinstance(extra, dict) or set(extra) - {"lite-434"}
            or set(extra) & set(data["releases"])):
        raise FirmwareError("invalid_catalog")
    return {profile: Release.parse(profile, item) for profile, item in {**data["releases"], **extra}.items()}


@dataclass(frozen=True)
class Monitor1Release:
    public_version: int
    release_url: str

    @classmethod
    def parse(cls, profile, data):
        # Runtime kits are source packages. A catalog cannot turn one into
        # an installable ESP32 image or confer permission to update a bundle.
        if (not isinstance(data, dict) or data.get("profile") != profile
                or data.get("format") != "qingping-monitor1-runtime-source-v1"
                or data.get("package_family") != "cgs1-linux-armv7-full-runtime"
                or data.get("delivery") != "source-build-private-profile"
                or data.get("hardware") != {"model": "CGS1", "soc": "RK3128", "architecture": "armv7l",
                                            "stock_version": "4.1.8_0287", "co2_type": MONITOR1_CO2_TYPES[profile]}):
            raise FirmwareError("invalid_catalog")
        version = _positive(data.get("public_version"), 2**53 - 1)
        commit = _text(data.get("source_commit"), maximum=40)
        if not re.fullmatch(r"[0-9a-f]{40}", commit):
            raise FirmwareError("invalid_catalog")
        tag = firmware_tag(profile, version)
        repo = next((repo for repo in REPOSITORIES
                     if data.get("release_url") == f"https://github.com/{repo}/tree/{tag}"), None)
        if repo is None or data.get("source_url") != f"https://github.com/{repo}/tree/{commit}":
            raise FirmwareError("invalid_asset_url")
        source = Asset.parse(data.get("source"), filename="monitor1-runtime-source.tar.gz",
                             maximum=32 * 1024 * 1024, profile=profile)
        if source.url != f"https://raw.githubusercontent.com/{repo}/{tag}/monitor1-runtime-source.tar.gz":
            raise FirmwareError("invalid_asset_url")
        return cls(version, data["release_url"])


def parse_monitor1_releases(data):
    """Read only the two known source lines without making Lite depend on them."""
    rows = data.get("runtime_releases")
    releases = {}
    if isinstance(rows, dict):
        for profile in MONITOR1_CO2_TYPES:
            if profile in rows:
                try:
                    releases[profile] = Monitor1Release.parse(profile, rows[profile])
                except FirmwareError:
                    # Malformed source metadata suppresses just this notice.
                    continue
    return releases


def device_release_profile(record):
    """Route legacy public Lite devices by authenticated original provenance.

    This selects an update, not a relabelled installed firmware. The old public
    2 stays installed until the independent revision-4 transfer is verified.
    Marketing model, IP, room and current public number cannot select a board.
    """
    profile = record.get("profile", "lite")
    if profile == "lite" and record.get("hardware") == "0001" and record.get("source_stock_version") == "4.3.4":
        return "lite-434"
    return profile
