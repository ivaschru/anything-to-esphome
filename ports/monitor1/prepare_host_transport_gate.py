#!/usr/bin/env python3
"""Plan/apply the exact local host transport lifecycle patch to CGS1's SDK.

Only this firmware's isolated .venv is allowed. All four source hashes/version
are pinned and checked before any SDK write. Public diff+manifest are kept in
patches/, originals in ignored build storage. Re-running is idempotent only
for exact patched bytes; unexpected third-party edits fail without overwrite.
No device connection, upload, credentials or other Python environment action.
"""
import argparse
import difflib
import hashlib
import importlib.metadata
import importlib.util
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
PINNED = {
    "components/api/api_server.h": "e5c6492534b9231760c7940a9ad2c8be3da10fdf447f6f738e509db854a7a306",
    "components/api/api_server.cpp": "04493ab169d14da679ede65e526cf00606d94fbbb51bc78ec37e23b7d6be758f",
    "components/esphome/ota/ota_esphome.h": "c5c2935e5bd71f511f0b4ba6bfb950b4b9afadfd26dd2260aae175e6548753c9",
    "components/esphome/ota/ota_esphome.cpp": "f6d513760e165c440aa6d14b7f4081b08ff569b3eb1cb3fb678ce4428274592d",
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def replace_once(text, before, after):
    if text.count(before) != 1:
        raise RuntimeError("Exact SDK anchor changed")
    return text.replace(before, after, 1)


def patched(name, original):
    text = original.decode()
    declarations = '''#ifdef USE_CGS1_TRANSPORT_GATE
  // Main-loop only, outside API callback stacks. Keys/services are preserved.
  bool cgs1_pause_transport();
  bool cgs1_resume_transport();
  bool cgs1_transport_paused() const { return this->cgs1_transport_paused_; }
#endif
'''
    fields = '''#ifdef USE_CGS1_TRANSPORT_GATE
  bool cgs1_open_listener_();
  bool cgs1_transport_paused_{false};
#endif
'''
    if name.endswith(".h"):
        text = replace_once(text, "  void setup() override;\n", declarations + "  void setup() override;\n")
        pointer = "  socket::ListenSocket *socket_{nullptr};\n" if name.startswith("components/api/") else "  socket::ListenSocket *server_{nullptr};\n"
        return replace_once(text, pointer, fields + pointer).encode()
    if name.startswith("components/api/"):
        text = replace_once(text, "void APIServer::loop() {\n", '''void APIServer::loop() {
#ifdef USE_CGS1_TRANSPORT_GATE
  if (this->cgs1_transport_paused_)
    return;
#endif
''')
        payload = (HERE / "patches/host-api-transport.inc").read_text()
        return replace_once(text, "}  // namespace esphome::api\n", payload + "\n}  // namespace esphome::api\n").encode()
    text = replace_once(text, "void ESPHomeOTAComponent::loop() {\n", '''void ESPHomeOTAComponent::loop() {
#ifdef USE_CGS1_TRANSPORT_GATE
  if (this->cgs1_transport_paused_)
    return;
#endif
''')
    payload = (HERE / "patches/host-ota-transport.inc").read_text()
    return replace_once(text, "}  // namespace esphome\n", payload + "\n}  // namespace esphome\n").encode()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true")
    mode.add_argument("--restore", action="store_true")
    args = parser.parse_args()
    if Path(sys.prefix).resolve() != (HERE / ".venv").resolve() or importlib.metadata.version("esphome") != "2026.10.1":
        raise RuntimeError("Use only CGS1's pinned isolated ESPHome environment")
    package = Path(next(iter(importlib.util.find_spec("esphome").submodule_search_locations))).resolve()
    if not package.is_relative_to((HERE / ".venv").resolve()):
        raise RuntimeError("Resolved SDK is outside CGS1 .venv")
    backup = HERE / "build/sdk-transport-gate-original"
    if args.restore:
        manifest = json.loads((HERE / "patches/esphome-host-transport-gate.json").read_text())
        restore = {}
        for name, expected in PINNED.items():
            current = (package / name).read_bytes()
            saved = backup / name
            if sha(current) == expected:
                continue
            if sha(current) != manifest["patched_sha256"][name] or not saved.is_file() or sha(saved.read_bytes()) != expected:
                raise RuntimeError("Cannot restore additional/unknown SDK edits: " + name)
            restore[name] = saved.read_bytes()
        for name, original in restore.items():
            (package / name).write_bytes(original)
        print(json.dumps({"restored_originals": list(restore), "sdk_version": "2026.10.1"}, indent=2))
        return
    originals, updates, states = {}, {}, {}
    for name, digest in PINNED.items():
        current = (package / name).read_bytes()
        saved = backup / name
        if sha(current) == digest:
            original = current
        elif saved.is_file() and sha(saved.read_bytes()) == digest:
            original = saved.read_bytes()
        else:
            raise RuntimeError("Unrecognized SDK source: " + name)
        update = patched(name, original)
        if current not in (original, update):
            raise RuntimeError("SDK has additional edits: " + name)
        originals[name], updates[name] = original, update
        states[name] = "patched" if current == update else "original"
    # Preflight ALL files before writing any. Backups never contain user keys;
    # these are only the four pinned public SDK translation units.
    patch = "".join("".join(difflib.unified_diff(originals[name].decode().splitlines(True),
        updates[name].decode().splitlines(True), fromfile="a/" + name, tofile="b/" + name)) for name in PINNED)
    (HERE / "patches/esphome-host-transport-gate.patch").write_text(patch)
    manifest = {"sdk_version": "2026.10.1", "macro": "USE_CGS1_TRANSPORT_GATE",
                "source_sha256": PINNED, "patched_sha256": {name: sha(value) for name, value in updates.items()},
                "patch_sha256": sha(patch.encode()), "scope": "CGS1 isolated host SDK only; no auth/backend changes"}
    (HERE / "patches/esphome-host-transport-gate.json").write_text(json.dumps(manifest, indent=2) + "\n")
    if args.apply:
        for name, value in originals.items():
            saved = backup / name
            saved.parent.mkdir(parents=True, exist_ok=True)
            if saved.exists() and saved.read_bytes() != value:
                raise RuntimeError("Original backup conflict: " + name)
            if not saved.exists():
                saved.write_bytes(value)
        for name, value in updates.items():
            target = package / name
            if target.read_bytes() == value:
                continue
            temporary = target.with_name(target.name + ".cgs1-new")
            if temporary.exists():
                raise RuntimeError("Pending SDK temporary file; inspect it first")
            temporary.write_bytes(value)
            temporary.chmod(target.stat().st_mode & 0o777)
            temporary.replace(target)
        if any(sha((package / name).read_bytes()) != manifest["patched_sha256"][name] for name in PINNED):
            raise RuntimeError("SDK readback mismatch")
    print(json.dumps({"applied": args.apply, "previous_states": states, "patch_sha256": manifest["patch_sha256"]}, indent=2))


if __name__ == "__main__":
    main()
