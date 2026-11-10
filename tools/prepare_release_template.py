#!/usr/bin/env python3
"""Prepare a public Lite template without reflashing or touching private builds.

For installer-only releases, reuse the exact v0.1.3 public image, but only when
the committed firmware tree, compiler recipe and personalizer still match its
reviewed source. Known source changes use the normal pinned build. Missing
Git/source evidence or download/validation failure is an error, never fallback.
"""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.request
import zipfile

_source_spec = importlib.util.spec_from_file_location("qf_firmware_source", Path(__file__).with_name("firmware_source.py"))
_source_module = importlib.util.module_from_spec(_source_spec)
_source_spec.loader.exec_module(_source_module)
source_digest, RECIPE_PATHS = _source_module.source_digest, _source_module.RECIPE_PATHS

ROOT = Path(__file__).resolve().parents[1]
LITE_TREE = "c67313617e800dc1ba3f92d0ee68b5eef57d2f70"
SOURCE_SHAS = {
    "tools/build_lite.py": "f698b2932ba0c0a4640804af1cc3d1660fffb3fe03bdc07f8cb32a83ea68212a",
    "custom_components/qingping_esphome/image.py": "28b4f38afb3e24250de2f21510b8bcc0ad96f069d8657002a1b43842befaa143",
}
URL = "https://github.com/ivaschru/qingping-esphome/releases/download/v0.1.3/qingping_esphome.zip"
ARCHIVE_SHA = "ba06bfcac332f0b7e2261963d2d934b491bd6a1c2718913697c6bc05b0392b7e"
IMAGE_SHA = "803dbd841ae95b3a9ee8103bf242c0097e714bfbdf42f5610ea8c47406c35df8"
IMAGE_SIZE = 1470608


def git_read(root, *arguments):
    try:
        return subprocess.check_output(["git", *arguments], cwd=root, stderr=subprocess.DEVNULL, timeout=15).decode("ascii").strip()
    except Exception:
        raise RuntimeError("Release template requires readable committed source evidence") from None


def compatible(root):
    dirty = git_read(root, "status", "--porcelain", "--untracked-files=all", "--",
                     "ports/lite", *SOURCE_SHAS)
    if dirty:
        raise RuntimeError("Use a clean source snapshot; private/unfinished Lite work must be preserved")
    tree = git_read(root, "rev-parse", "--verify", "HEAD:ports/lite")
    if not re.fullmatch(r"[a-f0-9]{40}", tree):
        raise RuntimeError("Committed Lite tree identity is unverified")
    hashes = {}
    for path in SOURCE_SHAS:
        file = root / path
        if file.is_symlink() or not file.is_file():
            raise RuntimeError("Release compiler/personalizer source is unverified")
        hashes[path] = hashlib.sha256(file.read_bytes()).hexdigest()
    return tree == LITE_TREE and hashes == SOURCE_SHAS


def verified_files(raw):
    if len(raw) > 8 * 1024 * 1024 or hashlib.sha256(raw).hexdigest() != ARCHIVE_SHA:
        raise RuntimeError("Published source archive digest differs; never substitute another asset")
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        # Extract only fixed bytes, never paths from the archive. The complete
        # pinned archive digest also prevents an untrusted ZIP bomb/path set.
        binary = archive.read("firmware/lite-template.bin")
        manifest = archive.read("firmware/lite-template.json")
    if (len(binary) != IMAGE_SIZE or hashlib.sha256(binary).hexdigest() != IMAGE_SHA or
            json.loads(manifest).get("sha256") != IMAGE_SHA):
        raise RuntimeError("Published Lite binary and manifest are not the matched pair")
    return {"lite-template.bin": binary, "lite-template.json": manifest}


def reuse(root, opener=urllib.request.urlopen):
    output = root / "custom_components/qingping_esphome/firmware"
    if output.parent.resolve() != output.parent or output.is_symlink():
        raise RuntimeError("Release output must stay inside the clean source")
    if any((output / name).exists() or (output / name).is_symlink()
           for name in ("lite-template.bin", "lite-template.json")):
        raise RuntimeError("Existing firmware outputs are preserved; use a fresh release snapshot")
    try:
        with opener(URL, timeout=45) as response:
            raw = response.read(8 * 1024 * 1024 + 1)
    except Exception:
        raise RuntimeError("Could not read the exact public Lite release; no build fallback") from None
    files = verified_files(raw)
    output.mkdir(mode=0o700, exist_ok=True)
    for name, data in files.items():
        fd = os.open(output / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())


def profile_source(root, profile):
    """Choose an independent source/recipe closure; never infer by model."""
    if profile == "lite":
        return source_digest, RECIPE_PATHS, ("ports/lite",), "firmware/releases.json", "tools/build_lite.py"
    if profile != "lite-434":
        raise ValueError("Unsupported public template profile")
    spec = importlib.util.spec_from_file_location("qf_release_434_source", root / "tools/lite434_source.py")
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module.source_digest, module.RECIPE_PATHS, ("ports/lite", "ports/lite-434"), "firmware/lite434-release.json", "tools/build_lite434.py"


def reuse_current(root, opener=urllib.request.urlopen, *, profile="lite"):
    """Reuse a newer published firmware only with its complete source pin.

    A fresh compiler embeds a different build timestamp. Rebuilding unchanged
    firmware for a HACS-only release would therefore create different bytes
    under the same version. The immutable manifest's source identity allows
    reusing the actual published pair without falsely increasing its revision.
    Transport/invalid-index errors never fall back to another image/compiler.
    """
    output = root / "custom_components/qingping_esphome/firmware"
    digest, recipes, folders, metadata_path, _ = profile_source(root, profile)
    stem = profile + "-template"
    if output.parent.resolve() != output.parent or output.is_symlink():
        raise RuntimeError("Release output must remain in the clean source")
    if any((output/name).exists() or (output/name).is_symlink() for name in (stem+".bin",stem+".json")):
        raise RuntimeError("Existing firmware outputs are preserved")
    # Import only our pure catalog validator, without HA's package __init__.
    import importlib
    import types
    package = types.ModuleType("qf_source_catalog")
    package.__path__ = [str(root / "custom_components/qingping_esphome")]
    sys.modules[package.__name__] = package
    catalog = importlib.import_module(package.__name__ + ".firmware_catalog")
    from urllib.parse import urlsplit, urljoin
    def download(url, maximum):
        # urllib follows redirects by default; use a bounded explicit opener
        # so neither signed CDN query strings nor unexpected hosts are logged.
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *args): return None
        transport = urllib.request.build_opener(NoRedirect)
        for _ in range(4):
            parsed = urlsplit(url)
            if parsed.scheme != "https" or parsed.netloc not in {"github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com", "raw.githubusercontent.com"}:
                raise RuntimeError("Unverified public firmware source URL")
            if parsed.netloc == "raw.githubusercontent.com" and url != catalog.CATALOG_URL:
                catalog.asset_url(url)
            try:
                response = transport.open(url, timeout=45)
            except urllib.error.HTTPError as error:
                if error.code in (301,302,303,307,308): url=urljoin(url,error.headers.get("Location", "")); continue
                if error.code == 404 and url in {catalog.CATALOG_URL, catalog.LEGACY_CATALOG_URL}: return None
                raise RuntimeError("Could not verify published firmware source") from None
            except Exception:
                raise RuntimeError("Could not verify published firmware source") from None
            with response:
                raw=response.read(maximum+1)
            if len(raw)>maximum: raise RuntimeError("Published firmware source is oversized")
            return raw
        raise RuntimeError("Could not verify published firmware source")
    # `opener` remains the explicit fixture boundary; production always uses
    # the bounded downloader above, not a caller-selected URL or output path.
    reader = download if opener is urllib.request.urlopen else lambda url,maximum: opener(url,maximum)
    raw = reader(catalog.CATALOG_URL, catalog.MAX_INDEX_BYTES)
    if raw is None:
        # One-time build bootstrap while the new channel is not initialized.
        # Only an explicit 404 qualifies; network/index faults never fall back.
        raw = reader(catalog.LEGACY_CATALOG_URL, catalog.MAX_INDEX_BYTES)
    if raw is None: return False
    releases = catalog.parse_catalog(json.loads(raw))
    current = json.loads((root / metadata_path).read_text())[profile]
    release = releases.get(profile)
    if not release or release.version != current["version"] or release.revision != current["revision"]: return False
    dirty = git_read(root,"status","--porcelain","--untracked-files=all","--",*folders,*recipes)
    if dirty: raise RuntimeError("Use a clean source snapshot for published firmware reuse")
    manifest_raw = reader(release.manifest.url, release.manifest.size)
    if not manifest_raw or len(manifest_raw)!=release.manifest.size or hashlib.sha256(manifest_raw).hexdigest()!=release.manifest.sha256:
        raise RuntimeError("Published firmware manifest differs")
    manifest=json.loads(manifest_raw)
    if manifest.get("release_source_sha256")!=digest(root):
        raise RuntimeError("Same firmware version has different source; publish a new UI version/revision")
    binary = reader(release.image.url, release.image.size)
    if (not binary or len(binary)!=release.image.size or hashlib.sha256(binary).hexdigest()!=release.image.sha256
            or manifest.get("sha256")!=release.image.sha256 or manifest.get("ui")!=release.version
            or manifest.get("public_version")!=release.public_version):
        raise RuntimeError("Published firmware image differs")
    image = importlib.import_module(package.__name__ + ".image")
    image.layout(binary)
    if (manifest.get("format") != "esp32-app-fixed-slots-v1" or manifest.get("model") != "CGDN1"
            or release.version.encode() not in binary
            or any(binary.count(marker) < 1 or manifest.get("slots", {}).get(key) != binary.count(marker)
                   for key,marker in image.SLOTS.items())):
        raise RuntimeError("Published firmware slot contract differs")
    if profile == "lite-434" and (manifest.get("profile") != profile
            or manifest.get("hardware") != "0001" or manifest.get("source_stock_version") != "4.3.4"
            or manifest.get("pm_policy") != "lite-434-polling-only-v1"):
        raise RuntimeError("Published 4.3.4 profile differs")
    output.mkdir(parents=True, exist_ok=True)
    for name,data in ((stem+".bin",binary),(stem+".json",manifest_raw)):
        fd=os.open(output/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
        with os.fdopen(fd,"wb") as target:
            target.write(data);target.flush();os.fsync(target.fileno())
    return True


def main(profile="lite"):
    os.umask(0o077)
    _, recipes, folders, metadata_path, compiler = profile_source(ROOT, profile)
    dirty = git_read(ROOT,"status","--porcelain","--untracked-files=all","--",*folders,*recipes)
    if dirty: raise RuntimeError("Use a clean committed public firmware source")
    current=json.loads((ROOT/metadata_path).read_text())[profile]
    if current["version"] != "2026.11.06-ui25-polling1" and reuse_current(ROOT, profile=profile):
        print("Reused exact source-matched public firmware and manifest")
    elif profile == "lite" and compatible(ROOT):
        reuse(ROOT)
        print("Reused exact public Lite v0.1.3 image and matching manifest")
    else:
        print("Committed Lite source changed; using the normal public-template compiler", flush=True)
        subprocess.run([sys.executable, str(ROOT / compiler)], cwd=ROOT, check=True)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", choices=("lite", "lite-434"), default="lite")
    main(parser.parse_args().profile)
