#!/usr/bin/env python3
"""Stage the S60TPF native channel; dry-run unless --publish is explicit.

The ordinary Qingping index stays byte-for-byte intact. One atomic Git push
adds a create-only public firmware tag and updates only the Sonoff endpoint
under the same catalog CAS. A consumed request is never resent automatically.
This experimental source release is not a claim of physical wizard QA.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

import build_sonoff as build
import publish_firmware as gitpub

ROOT = Path(__file__).resolve().parents[1]
PROFILE = "sonoff-s60tpf"
ENDPOINT = "native-sonoff-s60tpf.json"


def assets(binary, manifest_bytes):
    """Independently reproduce the manifest's complete patch table and SHA."""
    image = build.image_module()
    image.layout(binary)
    manifest = json.loads(manifest_bytes)
    release = json.loads((ROOT / "firmware/sonoff-release.json").read_text())
    if (any(manifest.get(key) != value for key, value in release.items())
            or manifest.get("source_sha256") != build.source_digest()
            or manifest.get("size") != len(binary)
            or manifest.get("sha256") != hashlib.sha256(binary).hexdigest()
            or manifest.get("chip") != "ESP32-C3" or manifest.get("slot_size") != 0x1F0000
            or manifest.get("native_update") != {"format": "anything-native-update-v1", "patches": image.patch_table(binary)}):
        raise ValueError("S60TPF source/template/manifest mismatch")
    for key in ("revision", "public_version"):
        if type(release[key]) is not int or not 1 <= release[key] <= 1000000:
            raise ValueError("S60TPF counter out of range")
    tag = f"firmware-{PROFILE}-v{release['public_version']}"
    native = {key: release[key] for key in ("profile", "hardware", "source_stock_version", "revision", "public_version")}
    native.update(format="anything-native-update-v1", size=len(binary), sha256=manifest["sha256"],
                  url=f"https://raw.githubusercontent.com/ivaschru/anything-to-esphome/{tag}/{PROFILE}-template.bin",
                  summary="S60TPF firmware; experimental initial installer", patches=image.patch_table(binary))
    if len(gitpub.encoded(native)) > 16384:
        raise ValueError("S60TPF native manifest exceeds device bound")
    return tag, {PROFILE + "-template.bin": binary, PROFILE + "-template.json": manifest_bytes,
                 ENDPOINT: gitpub.encoded(native)}


def catalog_files(root, head):
    """Keep every existing public catalog file, including future profiles."""
    if not head:
        raise ValueError("Existing catalog required")
    names = gitpub.git(root, "ls-tree", "--full-tree", "--name-only", head).decode().splitlines()
    # A top-level catalog is deliberately tiny; an unexpected tree or binary
    # needs maintainer review instead of being omitted from the replacement.
    if not names or len(names) > 32 or any("/" in name or not name.endswith(".json") for name in names):
        raise ValueError("Unexpected public catalog tree")
    return {name: gitpub.read_object(root, head, name) for name in names}


def publish(root, files, tag, source, head, intent):
    branch = gitpub.BRANCH
    if gitpub.remote_ref(root, branch) != head:
        raise ValueError("Catalog changed; prepare again")
    current = catalog_files(root, head)
    old = json.loads(current[ENDPOINT]) if ENDPOINT in current else None
    new = json.loads(files[ENDPOINT])
    if old and old != new and (new["revision"] <= old["revision"] or new["public_version"] <= old["public_version"]):
        raise ValueError("Changed S60TPF app requires increasing counters")
    ref = "refs/tags/" + tag
    existing = gitpub.remote_ref(root, ref)
    if existing:
        gitpub.fetch_object(root, existing)
        if any(gitpub.read_object(root, existing, name) != data for name, data in files.items()):
            raise ValueError("Immutable S60TPF tag differs")
        tag_head = existing
    else:
        tagged = {**files, "release.json": gitpub.encoded({"profile": PROFILE, "source_commit": source,
                  "image_sha256": new["sha256"], "public_version": new["public_version"]})}
        tag_head = gitpub.commit(root, tagged, source, "Publish " + tag)
    if current.get(ENDPOINT) == files[ENDPOINT]:
        if not existing:
            raise ValueError("Catalog references a missing tag")
        return {"state": "already_published", "tag": tag, "catalog_head": head}
    next_head = gitpub.commit(root, {**current, ENDPOINT: files[ENDPOINT]}, head, "Index " + tag)
    value = {"tag": tag, "tag_head": tag_head, "catalog_head": next_head, "expected_catalog_head": head,
             "state": "consumed_before_atomic_push"}
    gitpub.save_intent(intent, value)
    gitpub.git(root, "push", "--atomic", f"--force-with-lease={branch}:{head}", "origin",
               f"{tag_head}:{ref}", f"{next_head}:{branch}")
    if gitpub.remote_ref(root, ref) != tag_head or gitpub.remote_ref(root, branch) != next_head:
        raise RuntimeError("Publication needs read-only reconciliation")
    return {**value, "state": "published_experimental_native"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--publish", action="store_true")
    args = parser.parse_args()
    folder = ROOT / "custom_components/qingping_esphome/firmware"
    tag, files = assets((folder / (PROFILE + "-template.bin")).read_bytes(),
                        (folder / (PROFILE + "-template.json")).read_bytes())
    source = gitpub.git(ROOT, "rev-parse", "HEAD").decode().strip()
    # Bind the public source closure to the reviewed commit. No ignored output,
    # household configuration or private firmware can be published here.
    paths = [p for p in (ROOT / "ports/sonoff_s60").rglob("*") if p.is_file() and "__pycache__" not in p.parts]
    paths += [ROOT / name for name in ("tools/build_sonoff.py", "tools/publish_sonoff.py",
              "firmware/sonoff-release.json", "custom_components/qingping_esphome/sonoff_image.py")]
    for path in paths:
        if gitpub.read_object(ROOT, source, path.relative_to(ROOT).as_posix()) != path.read_bytes():
            raise ValueError("Uncommitted S60TPF publication source")
    head = gitpub.remote_ref(ROOT, gitpub.BRANCH)
    gitpub.fetch_object(ROOT, head)
    catalog_files(ROOT, head)
    if args.publish:
        result = publish(ROOT, files, tag, source, head, ROOT / ".build/sonoff-publication" / tag / "intent.json")
    else:
        result = {"state": "dry_run", "tag": tag, "source_commit": source, "expected_catalog_head": head,
                  "native": json.loads(files[ENDPOINT])}
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
