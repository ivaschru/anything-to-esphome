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
# Factory4.3.4 is now selectable, so its independent pair is mandatory in every
# ZIP. A missing/stale pair must fail publication, not fail later in the wizard.
from lite434_source import source_digest as source434, POLICY as POLICY434
binary434 = (source / "firmware/lite-434-template.bin").read_bytes()
manifest434 = json.loads((source / "firmware/lite-434-template.json").read_text())
assert manifest434.get("profile") == "lite-434" and manifest434.get("source_stock_version") == "4.3.4"
assert manifest434.get("hardware") == "0001" and manifest434.get("pm_policy") == POLICY434
assert manifest434.get("size") == len(binary434) and manifest434.get("sha256") == hashlib.sha256(binary434).hexdigest()
assert manifest434.get("release_source_sha256") == source434(ROOT), "4.3.4 template source differs"
# S60TPF owns a different chip/layout and source closure. Never ship a ZIP
# whose brand selector works while its app is missing or silently stale.
sonoff = runpy.run_path(str(ROOT / "tools/build_sonoff.py"))
sonoff_image = sonoff["image_module"]()
sonoff_binary = (source / "firmware/sonoff-s60tpf-template.bin").read_bytes()
sonoff_manifest = json.loads((source / "firmware/sonoff-s60tpf-template.json").read_text())
assert sonoff_manifest.get("profile") == "sonoff-s60tpf", "S60TPF profile missing"
assert sonoff_manifest.get("source_sha256") == sonoff["source_digest"](), "S60TPF template source differs"
assert sonoff_manifest.get("size") == len(sonoff_binary), "S60TPF template size differs"
assert sonoff_manifest.get("sha256") == hashlib.sha256(sonoff_binary).hexdigest(), "S60TPF template SHA differs"
assert sonoff_manifest.get("native_update") == {"format": "anything-native-update-v1", "patches": sonoff_image.patch_table(sonoff_binary)}, "S60TPF native slots differ"
target = ROOT / ".build/qingping_esphome.zip"
target.parent.mkdir(exist_ok=True)
# HACS zip_release expects the integration files at the archive root.
with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(source.rglob("*")):
        if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc":
            archive.write(path, path.relative_to(source))
print(target)
