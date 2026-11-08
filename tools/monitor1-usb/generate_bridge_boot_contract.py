#!/usr/bin/env python3
"""Generate pure next-boot text from the unchanged native arming builders.

Only public Python string builders run here. No shell, ADB, SDK program or
device command executes. The result is NOT a browser writer, live scope,
consumed intent or native receipt; its future caller must join those separately.
"""
import argparse
import hashlib
import importlib
import json
from pathlib import Path
import re
import sys

import generate_disabled_commands as disabled

ROOT = Path(__file__).resolve().parents[2]
PORT = ROOT / 'ports/monitor1'
sys.path.insert(0, str(PORT))
try:
    boot = importlib.import_module('arm_bridge_next_boot_adb')
finally:
    sys.path.pop(0)


def specification():
    # Reuse the canonical disabled generator's typed symbols, rather than
    # introducing a second set of source/vendor paths or a native USB binding.
    staged, vendors = list(boot.staging.STAGED), sorted(boot.commit.preflight.FILES)
    fields = dict(disabled.FIELDS)
    # completion_record validates these leaves before constructing its text.
    # Use unique valid hex sentinels, then split them just like the nonce.
    fields['plan_id'] = 'e465e10280804c148d7eca28a30613d3'
    fields['plan_sha256'] = 'b1d1304f35f167ea3d2733f5b770d7a0ca925b6147c90ce1d3948920b875008b'
    plan = {'plan_id': fields['plan_id'], 'files': {
        name: {'sha256': fields['staged_' + str(i)]} for i, name in enumerate(staged)}}
    from types import SimpleNamespace
    baseline = SimpleNamespace(root_identity=(fields['root_device'], fields['root_inode']),
        install_marker=fields['plan_id'] + ' ' + fields['plan_sha256'],
        target=(fields['wlan_mac'], fields['co2_type']), boot_id=fields['boot_id'],
        stock_process=(fields['stock_pid'], fields['stock_start']),
        watchdog_process=(fields['watchdog_pid'], fields['watchdog_start']),
        vendor_hashes=tuple((path, fields['vendor_' + str(i)]) for i, path in enumerate(vendors)))
    digest, nonce = fields['plan_sha256'], fields['nonce']
    _, body = boot.completion_record(plan, digest, nonce, 'arm')
    # completion_guard hashes the FULL correlated record. That digest cannot
    # remain the hash of symbolic placeholders after real leaves are inserted.
    # Split that exact canonical digest and size into explicitly derived leaves.
    fields['completion_sha256'] = hashlib.sha256((body + '\n').encode()).hexdigest()
    fields['completion_size'] = str(len(body) + 1)
    templates = {
        'before': boot.guard(plan, baseline, 'disabled') + boot.absence(boot.ARM_DONE) + boot.absence(boot.DISARM_DONE),
        'arm': boot.arming_command(plan, baseline, digest, nonce),
        'armed': boot.guard(plan, baseline, 'armed'),
        'complete': boot.completion_guard(plan, digest, nonce, 'arm'),
    }
    tokens = {value: key for key, value in fields.items()}
    # The numeric completion size appears only in its canonical stat equality.
    # Bound that replacement to the complete quoted stat literal, never match
    # arbitrary numeric substrings in process guards or SHA text.
    size = fields.pop('completion_size')
    tokens.pop(size)
    pattern = re.compile('|'.join(re.escape(token) for token in sorted(tokens, key=len, reverse=True)))

    def split(text, phase):
        result, offset = [], 0
        for match in pattern.finditer(text):
            if match.start() > offset:
                result.append(text[offset:match.start()])
            result.append({'field': tokens[match.group()]})
            offset = match.end()
        if offset < len(text):
            result.append(text[offset:])
        if phase == 'complete':
            literal = "'" + size + " 600 0 1'"
            found, joined = 0, []
            for part in result:
                if isinstance(part, str) and literal in part:
                    if part.count(literal) != 1:
                        raise ValueError('Canonical completion stat is ambiguous')
                    before, after = part.split(literal)
                    joined.extend([before + "'", {'field': 'completion_size'}, " 600 0 1'" + after])
                    found += 1
                else:
                    joined.append(part)
            if found != 1:
                raise ValueError('Canonical completion stat changed')
            result = joined
        literals = ''.join(part for part in result if isinstance(part, str))
        literals = re.sub(r'(?m)^# CGS1_BRIDGE_(?:NEXT_BOOT_SCOPE (?:disabled|backup_disabled|armed)|COMPLETION arm)$', '', literals)
        literals = literals.replace('# CGS1_INITIAL_ABSENT_STORES', '')
        if 'CGS1_' in literals:
            raise ValueError('Unknown symbolic leaf: ' + ','.join(re.findall(r'CGS1_[A-Z_0-9]+', literals)))
        return result

    names = ('arm_bridge_next_boot_adb.py', 'commit_disabled_install.py', 'stage_install_adb.py',
             'review_disabled_install.py', 'disabled_commit_policy.py', 'bootstrap_patches.py',
             'preflight_adb.py', 'review_initial_trial.py', 'trial_initial_bridge_adb.py')
    return {'schema_version': 1, 'staged_roles': staged, 'vendor_paths': vendors,
        'source_sha256': {name: hashlib.sha256((PORT / name).read_bytes()).hexdigest() for name in names},
        'templates': {phase: split(text, phase) for phase, text in templates.items()}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    value = specification()
    outputs = {
        ROOT / 'apps/monitor1_usb/rootfs/bridge-next-boot-contract.json': json.dumps(value, indent=2) + '\n',
        ROOT / 'custom_components/qingping_esphome/frontend/usb-bridge-boot-contract.mjs':
            '// Generated canonical text only; no live write authority.\nexport const bridgeBootContract = ' + json.dumps(value, indent=2) + ';\n',
    }
    for path, text in outputs.items():
        if args.check:
            if not path.is_file() or path.read_text() != text:
                raise SystemExit('Bridge next-boot contract is stale')
        else:
            path.write_text(text)


if __name__ == '__main__':
    main()
