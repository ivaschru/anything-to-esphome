#!/usr/bin/env python3
"""Prepare a public Lite template without reflashing or touching private builds.

For installer-only releases, reuse the exact v0.1.3 public image, but only when
the committed firmware tree, compiler recipe and personalizer still match its
reviewed source. Known source changes use the normal pinned build. Missing
Git/source evidence or download/validation failure is an error, never fallback.
"""
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.request
import zipfile

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


def main():
    os.umask(0o077)
    if compatible(ROOT):
        reuse(ROOT)
        print("Reused exact public Lite v0.1.3 image and matching manifest")
    else:
        print("Committed Lite source changed; using the normal public-template compiler", flush=True)
        subprocess.run([sys.executable, str(ROOT / "tools/build_lite.py")], cwd=ROOT, check=True)


if __name__ == "__main__":
    main()
