#!/usr/bin/env python3
"""Generate canonical PM next-boot text, never execute shell or contact USB.

Only the existing pure native guard builder runs with typed synthetic inputs.
Derived digest fields are recomputed at runtime after substitution; a hash
of placeholder text must never be treated as a real marker digest.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
from types import SimpleNamespace

import generate_bridge_observer_contract as observer

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'apps/monitor1_usb/rootfs'))
try:
    import pm_extension_guard as guard
finally:
    sys.path.pop(0)

VALUES = {**observer.VALUES, 'pm_nonce': '59' * 16,
          'root_device': '217001023', 'root_inode': '217001029',
          'child_birth': '217001031', 'supervisor_birth': '217001037',
          'stock_birth': '217001041', 'watchdog_birth': '217001047'}


def commands(values=VALUES, co2=2, *, files=None):
    _, plan = observer.capture(values, co2)
    if files is not None: plan['files'] = files
    plan['target']['stock_version'] = '4.1.8_0287'
    plan['files'] = {**plan['files'], **{name: {'size': 52, 'sha256': hashlib.sha256(name.encode()).hexdigest()}
                                      for name in ('native-program', 'guardian-program')}}
    vendors = {p: pin[0] for p, pin in observer.native.review.preflight.FILES.items()}
    vendors.update(observer.native.review.policy.PATCHED)
    baseline = SimpleNamespace(boot_id=plan['target']['boot_id'],
        root_identity=tuple(int(values[k]) for k in ('root_device', 'root_inode')), vendor_hashes=tuple(sorted(vendors.items())))
    frame = {'boot_id': values['boot_id'], **{name: [int(values[name + '_pid']), int(values[name + '_birth'])]
                                           for name in ('child', 'supervisor', 'stock', 'watchdog')}}
    receipt = {'nonce': values['nonce']}
    text, body = guard.command(observer.native, plan, values['plan_sha256'], baseline, receipt, frame, values['pm_nonce'])
    after = guard.completion_check(observer.native, plan, values['plan_sha256'], baseline, frame, values['pm_nonce'])
    return {'arm': text, 'complete': after}, body, plan


def specification():
    text, body, plan = commands()
    tokens = dict(VALUES)
    # Hashes of correlated records cannot be left as generator sentinels.
    tokens['pm_owner_sha256'] = hashlib.sha256((body + '\n').encode()).hexdigest()
    tokens['install_marker_sha256'] = hashlib.sha256((VALUES['plan_id'] + ' ' + VALUES['plan_sha256'] + '\n').encode()).hexdigest()
    arm = 'arm ' + VALUES['nonce'] + ' ' + VALUES['plan_id'] + ' ' + VALUES['plan_sha256'] + '\n'
    tokens['arm_completion_sha256'] = hashlib.sha256(arm.encode()).hexdigest()
    for i, role in enumerate(observer.native.staging.STAGED): tokens['staged_sha_' + str(i)] = plan['files'][role]['sha256']
    # co2 is embedded as a quoted exact value. Replace this complete comparison
    # literal only, never the common decimal digit inside sizes/paths/hashes.
    lookup = {value: key for key, value in tokens.items()}
    pattern = re.compile('|'.join(re.escape(value) for value in sorted(lookup, key=len, reverse=True)))
    templates = {}
    for phase, command in text.items():
        parts, offset = [], 0
        for match in pattern.finditer(command):
            if match.start() > offset: parts.append(command[offset:match.start()])
            parts.append({'field': lookup[match.group()]}); offset = match.end()
        if offset < len(command): parts.append(command[offset:])
        joined = []
        count = 0
        for part in parts:
            if isinstance(part, str):
                chunks = part.split('[ "$observed_value" = 2 ]')
                count += len(chunks) - 1
                for index, chunk in enumerate(chunks):
                    if index: joined.extend(['[ "$observed_value" = ', {'field': 'co2_type'}, ' ]'])
                    joined.append(chunk)
            else: joined.append(part)
        if count != (4 if phase == 'arm' else 1):
            raise ValueError('Canonical CO2 comparison changed')
        templates[phase] = joined
    sources = observer.specification()['source_sha256']
    return {'schema_version': 1, 'maximum_body_bytes': 65536, 'source_commit': observer.specification()['source_commit'],
            'native_source_sha256': sources, 'guard_sha256': hashlib.sha256((ROOT / 'apps/monitor1_usb/rootfs/pm_extension_guard.py').read_bytes()).hexdigest(),
            'templates': templates}


def main():
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('--check', action='store_true'); args = parser.parse_args()
    value = specification(); body = json.dumps(value, indent=2)
    outputs = {ROOT / 'apps/monitor1_usb/rootfs/pm-next-boot-contract.json': body + '\n',
               ROOT / 'custom_components/qingping_esphome/frontend/usb-pm-boot-contract.mjs':
               '// Generated canonical PM text; no live writer, receipt or transport authority.\nexport const pmBootContract = ' + body + ';\n'}
    for path, text in outputs.items():
        if args.check:
            if not path.is_file() or path.read_text() != text: raise SystemExit('PM next-boot contract is stale')
        else: path.write_text(text)


if __name__ == '__main__': main()
