"""Bind every quiet-rail/driver input to the public template manifest.

A header checksum alone cannot identify a coordinated I2C driver change. Frame
paths and bytes for the complete implementation; reject missing/symlink input.
"""
import hashlib
POLICY = "quiet-scd4x-window-v1"
PATHS = ("ports/lite/cgdn1.yaml",) + tuple("ports/lite/components/" + p for p in (
    "cgdn1_pm/__init__.py", "cgdn1_pm/cgdn1_pm.h", "cgdn1_pm/rail_policy.h",
    "cgdn1_pm/transaction_window.h", "scd4x/__init__.py", "scd4x/sensor.py",
    "scd4x/scd4x.h", "scd4x/scd4x.cpp", "scd4x/scd4x_io_trace.h"))
def digest(root):
    result = hashlib.sha256()
    for name in PATHS:
        path = root / name
        if not path.is_file() or path.is_symlink(): raise ValueError("Missing PM policy source")
        value=path.read_bytes(); encoded=name.encode()
        result.update(len(encoded).to_bytes(4,"big")); result.update(encoded)
        result.update(len(value).to_bytes(8,"big")); result.update(value)
    return result.hexdigest()
