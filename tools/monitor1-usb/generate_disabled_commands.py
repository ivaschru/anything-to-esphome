#!/usr/bin/env python3
"""Generate fixed browser command templates from the unchanged source53 guard.

This host-only generator imports public pure script builders and NEVER executes
those scripts. Runtime values can fill only explicitly typed leaves. Retaining
exact canonical text avoids a hand-maintained second implementation of process,
source, disabled-flag and atomic-replacement checks. Templates are not a writer
or a consumed intent: no endpoint/selected transport executes them yet.
"""
import argparse
import hashlib
import importlib
import json
from pathlib import Path
import re
import shlex
import sys
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[2]
PORT = ROOT / 'ports/monitor1'
sys.path.insert(0, str(PORT))
try:
    commit = importlib.import_module('commit_disabled_install')
finally:
    sys.path.pop(0)

# All placeholders use shlex-safe characters, exactly as their checked runtime
# numeric/hex/MAC/UUID values do. The two-word install marker retains canonical
# quoting around its plan fields. No substitution is repeated after assembly.
FIELDS = {
    'plan_id': 'CGS1_PLAN_ID', 'plan_sha256': 'CGS1_PLAN_SHA',
    'root_device': 'CGS1_ROOT_DEVICE', 'root_inode': 'CGS1_ROOT_INODE',
    'wlan_mac': 'CGS1_WLAN_MAC', 'co2_type': 'CGS1_CO2_TYPE', 'boot_id': 'CGS1_BOOT_ID',
    'stock_pid': 'CGS1_STOCK_PID', 'stock_start': 'CGS1_STOCK_START',
    'watchdog_pid': 'CGS1_WATCHDOG_PID', 'watchdog_start': 'CGS1_WATCHDOG_START',
    # canonical inline_guard validates the nonce; use one valid unique token
    # only while generating, then split it into the typed nonce leaf.
    'nonce': 'c074941326f44b5991b2670b70caee35',
}
FIELDS.update({'staged_' + str(i): 'CGS1_STAGED_HASH_' + str(i) for i in range(len(commit.staging.STAGED))})
FIELDS.update({'vendor_' + str(i): 'CGS1_VENDOR_HASH_' + str(i) for i in range(len(commit.preflight.FILES))})


def split_fields(text):
    tokens = {token: field for field, token in FIELDS.items()}
    # Longer tokens first: e.g. a future _10 must never be treated as _1 + 0.
    pattern = re.compile('|'.join(re.escape(token) for token in sorted(tokens, key=len, reverse=True)))
    result = []
    offset = 0
    for match in pattern.finditer(text):
        if match.start() > offset:
            result.append(text[offset:match.start()])
        result.append({'field': tokens[match.group()]})
        offset = match.end()
    if offset < len(text):
        result.append(text[offset:])
    if 'CGS1_' in ''.join(part for part in result if isinstance(part, str)):
        raise ValueError('An unknown symbolic field must never become shell text')
    return result


def specification():
    staged = list(commit.staging.STAGED)
    vendors = sorted(commit.preflight.FILES)
    pins = {name: {'sha256': FIELDS['staged_' + str(i)]} for i, name in enumerate(staged)}
    plan = {'plan_id': FIELDS['plan_id'], 'files': pins}
    observed = SimpleNamespace(root_identity=(FIELDS['root_device'], FIELDS['root_inode']),
        install_marker=FIELDS['plan_id'] + ' ' + FIELDS['plan_sha256'],
        target=(FIELDS['wlan_mac'], FIELDS['co2_type']), boot_id=FIELDS['boot_id'],
        stock_process=(FIELDS['stock_pid'], FIELDS['stock_start']),
        watchdog_process=(FIELDS['watchdog_pid'], FIELDS['watchdog_start']),
        vendor_hashes=tuple((path, FIELDS['vendor_' + str(i)]) for i, path in enumerate(vendors)))
    direction, nonce = 'commit_disabled', FIELDS['nonce']
    lock = commit.staging.BASE + '/.commit-disabled.lock'
    claim = (commit.inline_guard(plan, observed, direction, nonce, include_lock=False) +
             'mkdir ' + lock + '\nchmod 700 ' + lock + "\nprintf '%s\\n' " +
             shlex.quote('commit-disabled ' + nonce + ' ' + plan['plan_id']) + ' > ' + lock + '/owner\nsync')
    commands = {'claim': claim}
    for phase, target, source in (('watchdog', commit.policy.WATCHDOG, 'watchdog.sh.candidate'),
                                  ('start', commit.policy.START, 'start.sh.candidate')):
        operation = commit.policy.Operation(source, target, commit.policy.FACTORY[target], commit.policy.PATCHED[target])
        commands[phase] = commit.replacement_command(plan, observed, direction, nonce, operation)
    names = ('commit_disabled_install.py', 'stage_install_adb.py', 'review_disabled_install.py',
             'disabled_commit_policy.py', 'bootstrap_patches.py', 'preflight_adb.py')
    return {'schema_version': 1, 'staged_roles': staged, 'vendor_paths': vendors,
            'source_sha256': {name: hashlib.sha256((PORT / name).read_bytes()).hexdigest() for name in names},
            'templates': {phase: split_fields(command) for phase, command in commands.items()}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    value = specification()
    outputs = {
        ROOT / 'custom_components/qingping_esphome/frontend/usb-disabled-write-contract.mjs':
            '// Generated public fixed script templates; no runtime writer or authority.\nexport const disabledWriteContract = ' + json.dumps(value, indent=2) + ';\n',
        ROOT / 'apps/monitor1_usb/rootfs/disabled-write-contract.json': json.dumps(value, indent=2) + '\n',
    }
    for path, data in outputs.items():
        if args.check:
            if not path.is_file() or path.read_text() != data:
                raise SystemExit('Disabled command contract is stale')
        else:
            path.write_text(data)


if __name__ == '__main__':
    main()
