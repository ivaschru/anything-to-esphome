#!/usr/bin/env python3
"""Export audited public firmware assets and the standard HA update index.

Run after prepare_release_template.py, from a clean release snapshot. Never
compile or personalize here, and never replace an existing output/release.
An unchanged firmware retains its old version/URLs even if HACS is updated.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib
import json
from pathlib import Path
import re
import sys
import types
from urllib.error import HTTPError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
package = types.ModuleType("qingping_release_catalog")
package.__path__ = [str(ROOT / "custom_components/qingping_esphome")]
sys.modules[package.__name__] = package
catalog = importlib.import_module(package.__name__ + ".firmware_catalog")
images = importlib.import_module(package.__name__ + ".image")


def build(tag, metadata, binary, manifest_bytes, previous=None):
    if not re.fullmatch(r"v[0-9]+\.[0-9]+\.[0-9]+", tag):
        raise ValueError("Firmware catalogs require a stable vX.Y.Z release")
    if set(metadata) != {"lite"}:
        raise ValueError("Only the qualified Lite publisher is implemented")
    info = metadata["lite"]
    manifest = json.loads(manifest_bytes)
    digest = hashlib.sha256(binary).hexdigest()
    images.layout(binary)
    if (manifest.get("model") != "CGDN1" or manifest.get("format") != "esp32-app-fixed-slots-v1"
            or manifest.get("ui") != info["version"] or manifest.get("size") != len(binary)
            or manifest.get("sha256") != digest or info["version"].encode() not in binary
            or any(binary.count(marker) != manifest["slots"][key] or binary.count(marker) < 1
                   for key, marker in images.SLOTS.items())):
        raise ValueError("Public template does not match its original manifest/version/slots")
    releases = dict(previous["releases"]) if previous else {}
    if previous:
        catalog.parse_catalog(previous)
    base = f"https://github.com/{catalog.REPOSITORY}/releases/"
    def asset(name, data):
        return {"url": base + f"download/{tag}/{name}", "size": len(data),
                "sha256": hashlib.sha256(data).hexdigest()}
    entry = {**info, "image": asset("lite-template.bin", binary),
             "manifest": asset("lite-template.json", manifest_bytes),
             "release_url": base + f"tag/{tag}"}
    old = releases.get("lite")
    if old:
        identical = old["image"]["sha256"] == digest
        same_version = old["revision"] == info["revision"] and old["version"] == info["version"]
        if identical and same_version:
            entry = old  # Installer-only release: no fabricated firmware update.
        elif (identical or info["revision"] <= old["revision"] or info["version"] == old["version"]):
            raise ValueError("Changed firmware needs a new UI version and larger profile revision")
        if entry is not old and old.get("backend") == info["backend"]:
            # Carry public profile generations forward. Otherwise a monitor
            # one release behind would stop being recognised after moving to
            # a fresh HA whose integration never saw that older catalog.
            history = list(old.get("adoption_versions", []))
            if old["revision"] >= 2:
                history.append({"version": old["version"], "revision": old["revision"]})
            if history: entry["adoption_versions"] = history
    releases["lite"] = entry
    result = {"format": catalog.CATALOG_FORMAT, "releases": releases}
    catalog.parse_catalog(result)
    return result


def previous_index():
    try:
        with urlopen(catalog.CATALOG_URL, timeout=30) as response:
            data = response.read(catalog.MAX_INDEX_BYTES + 1)
        if len(data) > catalog.MAX_INDEX_BYTES: raise ValueError("Previous index is oversized")
        value = json.loads(data)
        catalog.parse_catalog(value)
        return value
    except HTTPError as error:
        if error.code == 404: return None  # The first catalog does not exist yet.
        raise ValueError("Could not verify the previous firmware index") from None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--check-previous", action="store_true")
    args = parser.parse_args()
    folder = ROOT / "custom_components/qingping_esphome/firmware"
    binary = (folder / "lite-template.bin").read_bytes()
    manifest = (folder / "lite-template.json").read_bytes()
    metadata = json.loads((ROOT / "firmware/releases.json").read_text())
    value = build(args.tag, metadata, binary, manifest, previous_index() if args.check_previous else None)
    output = ROOT / ".build/firmware-release" / args.tag
    output.mkdir(parents=True, exist_ok=False)
    for name, data in (("lite-template.bin", binary), ("lite-template.json", manifest),
                       ("firmware-catalog.json", (json.dumps(value, indent=2) + "\n").encode())):
        with (output / name).open("xb") as target: target.write(data)
    print(output)


if __name__ == "__main__": main()
