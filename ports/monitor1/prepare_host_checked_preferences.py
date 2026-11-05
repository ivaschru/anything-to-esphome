#!/usr/bin/env python3
"""CAS-pinned checked RAM preference writes in CGS1's isolated host SDK.

The opt-in macro only checks existing fwrite/fflush/fclose results. The SDK
manager, key format, filename and RAM placement are preserved. There are no
device connections or changes to another Python environment. Original and
patched public source hashes make apply/restore idempotent and reviewable.
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
NAME = 'components/host/preferences.cpp'
ORIGINAL = '13982552ed40fe1aaea0f3628a1e9c5ffd46257255071e2258612d7250620ad5'
MACRO = 'USE_CGS1_CHECKED_RAM_PREFERENCES'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def patched(original):
    before = '''  for (auto &it : this->data_) {
    fwrite(&it.first, sizeof(uint32_t), 1, fp);
    uint8_t len = it.second.size();
    fwrite(&len, sizeof(len), 1, fp);
    fwrite(it.second.data(), sizeof(uint8_t), it.second.size(), fp);
  }
  fclose(fp);
  return true;
'''
    after = '''#ifdef USE_CGS1_CHECKED_RAM_PREFERENCES
  // CGS1's native-only snapshot adapter must distinguish a complete SDK
  // map from a valid-looking prefix left by a short RAM write. The durable
  // copy/CRC/atomic fsync+rename live outside this SDK file; no flash file
  // or alternate key format is selected by this opt-in check.
  bool okay = true;
  for (auto &it : this->data_) {
    uint8_t len = it.second.size();
    if (fwrite(&it.first, sizeof(uint32_t), 1, fp) != 1 ||
        fwrite(&len, sizeof(len), 1, fp) != 1 ||
        fwrite(it.second.data(), sizeof(uint8_t), it.second.size(), fp) != it.second.size()) {
      okay = false;
      break;
    }
  }
  if (fflush(fp) != 0 || ferror(fp))
    okay = false;
  if (fclose(fp) != 0)
    okay = false;
  return okay;
#else
''' + before + '''#endif
'''
    text = original.decode()
    if text.count(before) != 1:
        raise RuntimeError('Exact pinned SDK preferences anchor changed')
    text = text.replace(before, after, 1)
    anchor = 'void HostPreferences::setup_() {\n'
    if text.count(anchor) != 1:
        raise RuntimeError('Exact SDK setup anchor changed')
    # A durable native profile calls this symbol. Defining its macro against
    # an unpatched SDK must fail at link time, rather than silently trusting
    # the upstream unchecked writer because its signature happens to match.
    marker = '''#ifdef USE_CGS1_CHECKED_RAM_PREFERENCES
bool cgs1_checked_ram_preferences_active() { return true; }
#endif

'''
    return text.replace(anchor, marker + anchor, 1).encode()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--apply', action='store_true')
    mode.add_argument('--restore', action='store_true')
    args = parser.parse_args()
    if Path(sys.prefix).resolve() != (HERE / '.venv').resolve() or importlib.metadata.version('esphome') != '2026.10.1':
        raise RuntimeError("Use only CGS1's pinned isolated ESPHome environment")
    package = Path(next(iter(importlib.util.find_spec('esphome').submodule_search_locations))).resolve()
    if not package.is_relative_to((HERE / '.venv').resolve()):
        raise RuntimeError('Resolved SDK outside CGS1 .venv')
    target = package / NAME
    saved = HERE / 'build/sdk-checked-preferences-original/preferences.cpp'
    current = target.read_bytes()
    original = current if sha(current) == ORIGINAL else saved.read_bytes() if saved.is_file() else b''
    if sha(original) != ORIGINAL:
        raise RuntimeError('Unrecognized original SDK preferences source')
    update = patched(original)
    if current not in (original, update):
        raise RuntimeError('Additional SDK preferences edits; no overwrite')
    diff = ''.join(difflib.unified_diff(original.decode().splitlines(True), update.decode().splitlines(True),
                                      fromfile='a/' + NAME, tofile='b/' + NAME))
    manifest = {'sdk_version': '2026.10.1', 'macro': MACRO, 'source': NAME,
                'original_sha256': ORIGINAL, 'patched_sha256': sha(update), 'patch_sha256': sha(diff.encode()),
                'scope': 'Checked RAM writes only; concrete SDK manager/keys/filename unchanged'}
    (HERE / 'patches/esphome-host-checked-preferences.patch').write_text(diff)
    (HERE / 'patches/esphome-host-checked-preferences.json').write_text(json.dumps(manifest, indent=2) + '\n')
    if args.apply:
        saved.parent.mkdir(parents=True, exist_ok=True)
        if saved.exists() and saved.read_bytes() != original:
            raise RuntimeError('Original backup conflict')
        if not saved.exists():
            saved.write_bytes(original)
    desired = original if args.restore else update
    if (args.apply or args.restore) and current != desired:
        temporary = target.with_name(target.name + '.cgs1-new')
        if temporary.exists():
            raise RuntimeError('Pending SDK temporary source; inspect before retry')
        temporary.write_bytes(desired)
        temporary.chmod(target.stat().st_mode & 0o777)
        temporary.replace(target)
        if target.read_bytes() != desired:
            raise RuntimeError('SDK source readback mismatch')
    print(json.dumps({'applied': args.apply, 'restored': args.restore,
                      'previous_state': 'patched' if current == update else 'original', **manifest}))


if __name__ == '__main__':
    main()
