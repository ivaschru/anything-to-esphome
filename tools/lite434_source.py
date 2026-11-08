"""Independent 4.3.4 source identity; never changes the historical Lite 2 pin.

The shared Lite tree is read-only input. Explicit overlay/recipe bytes are also
framed into the hash, so a polling-only image cannot pass a quiet-image pin.
"""
import hashlib
from pathlib import Path
RECIPE_PATHS = ("tools/native_update_build.py","tools/build_lite434.py", "tools/lite434_source.py", "firmware/lite434-release.json",
                "custom_components/qingping_esphome/image.py")
POLICY = "lite-434-polling-only-v1"
def source_digest(root):
    root=Path(root)
    paths=[]
    for folder in ("ports/lite", "ports/lite-434"):
        paths += [p for p in (root/folder).rglob("*") if p.is_file() and not any(
            x in {".esphome", "__pycache__"} for x in p.parts) and p.name != "secrets.yaml" and p.suffix != ".pyc"]
    paths += [root/p for p in RECIPE_PATHS]
    result=hashlib.sha256()
    for p in sorted(paths,key=lambda p:p.relative_to(root).as_posix()):
        if p.is_symlink() or not p.is_file(): raise ValueError("Missing public firmware source")
        name=p.relative_to(root).as_posix().encode(); data=p.read_bytes()
        result.update(len(name).to_bytes(4,"big")); result.update(name)
        result.update(len(data).to_bytes(8,"big")); result.update(data)
    return result.hexdigest()
