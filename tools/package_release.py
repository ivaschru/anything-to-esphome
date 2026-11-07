#!/usr/bin/env python3
"""Package only the HACS component and its validated public template."""
from pathlib import Path
import hashlib
from pm_policy import POLICY, digest as pm_digest
import json
import zipfile
import runpy

ROOT = Path(__file__).resolve().parents[1]
# The shipped engine/UI must be the exact shared source closure. A normal
# zip glob alone would silently omit a missing new worker or ship stale copies.
runpy.run_path(str(ROOT / "tools/monitor1-usb/package_core.py"))["package"](ROOT, check=True)
source = ROOT / "custom_components/qingping_esphome"
manifest = json.loads((source / "firmware/lite-template.json").read_text())
assert hashlib.sha256((source / "firmware/lite-template.bin").read_bytes()).hexdigest() == manifest["sha256"]
# An older valid template still passes its own checksum. Reject that stale
# binary explicitly instead of silently shipping an obsolete rail/driver pair.
assert manifest.get("pm_policy") == POLICY, "Rebuild the public Lite template with the current PM policy"
assert manifest.get("pm_source_sha256") == pm_digest(ROOT), "Template PM source does not match this release"
target = ROOT / ".build/qingping_esphome.zip"
target.parent.mkdir(exist_ok=True)
# HACS zip_release expects the integration files at the archive root.
with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(source.rglob("*")):
        if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc":
            archive.write(path, path.relative_to(source))
print(target)
