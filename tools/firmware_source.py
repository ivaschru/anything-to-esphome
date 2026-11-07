"""Content identity for reproducible public firmware reuse, without secrets.

Only the public Lite input tree, release metadata and compiler/personalizer
recipes participate. Paths and bytes are framed, so concatenation ambiguity
cannot make unrelated inputs share a source identity. No output/cache or
private YAML is read. Changing this algorithm also changes its own input hash.
"""
import hashlib
from pathlib import Path

RECIPE_PATHS = ("tools/pm_policy.py", "tools/build_lite.py", "tools/firmware_source.py",
                "custom_components/qingping_esphome/image.py", "firmware/releases.json")


def source_digest(root):
    root = Path(root)
    files = []
    for path in (root / "ports/lite").rglob("*"):
        if any(p in {".esphome", "__pycache__"} for p in path.parts): continue
        if path.name == "secrets.yaml" or path.suffix == ".pyc": continue
        if path.is_symlink(): raise ValueError("Unverified public firmware source")
        if path.is_file(): files.append(path)
    files.extend(root / path for path in RECIPE_PATHS)
    result = hashlib.sha256()
    for path in sorted(files, key=lambda p: p.relative_to(root).as_posix()):
        if path.is_symlink() or not path.is_file(): raise ValueError("Missing public firmware source")
        name = path.relative_to(root).as_posix().encode()
        data = path.read_bytes()
        result.update(len(name).to_bytes(4,"big")); result.update(name)
        result.update(len(data).to_bytes(8,"big")); result.update(data)
    return result.hexdigest()
