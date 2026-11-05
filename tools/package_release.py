#!/usr/bin/env python3
"""Package only the HACS component and its validated public template."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "custom_components/qingping_esphome"
manifest = json.loads((source / "firmware/lite-template.json").read_text())
assert hashlib.sha256((source / "firmware/lite-template.bin").read_bytes()).hexdigest() == manifest["sha256"]
target = ROOT / ".build/qingping_esphome.zip"
target.parent.mkdir(exist_ok=True)
# HACS zip_release expects the integration files at the archive root.
with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(source.rglob("*")):
        if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc":
            archive.write(path, path.relative_to(source))
print(target)
