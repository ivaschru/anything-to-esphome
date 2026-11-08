#!/usr/bin/env python3
"""Frozen first-bridge guardian ABI text only; never execute a trial or ADB.

Derive all forty argv leaves from the canonical host frame() function. Keep
this separate from a command/launch route: a valid frame cannot admit a device
image FD, consume an intent, start a process or grant observation authority.
"""
import argparse
import hashlib
import json
import importlib.util
import re
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
PORT = ROOT / 'ports/monitor1'


def specification():
    pinned = json.loads((ROOT / 'apps/monitor1_usb/rootfs/initial-trial-contract.json').read_bytes())
    source = {name: hashlib.sha256((PORT / name).read_bytes()).hexdigest()
              for name in ('trial_initial_bridge_adb.py', 'initial_bridge_trial_main.cpp')}
    if any(pinned['source_sha256'].get(name) != digest for name, digest in source.items()):
        raise ValueError('Frozen guardian ABI source differs from admitted contract')
    sys.path.insert(0, str(PORT))
    try:
        import trial_initial_bridge_adb as trial
    finally:
        sys.path.pop(0)
    names = ['plan_id', 'plan_sha256', 'commit_nonce', 'boot_id', 'wlan_mac', 'co2_type',
             'root_device', 'root_inode', 'stock_pid', 'stock_start', 'watchdog_pid', 'watchdog_start',
             'ram_job_id', 'ram_device', 'ram_inode', 'guardian_job_id', 'guardian_device', 'guardian_inode',
             'guardian_bytes', 'guardian_sha256', 'nonce']
    roles = list(trial.review.staging.STAGED)
    names += [f'staged_{i}_{leaf}' for i in range(len(roles)) for leaf in ('bytes', 'sha256')]
    values = {name: 'CGS1_ABI_FIELD_' + name.upper() for name in names}
    # The frozen inline guard insists on a real hex transaction token. This
    # non-source literal is still converted back to a typed leaf in outputs.
    values['commit_nonce'] = '6b14947f19e44c6c99b5ae57c81752a4'
    plan = {'plan_id': values['plan_id'], 'target': {k: values[k] for k in ('boot_id', 'wlan_mac', 'co2_type')},
            'files': {role: {'size': values[f'staged_{i}_bytes'], 'sha256': values[f'staged_{i}_sha256']}
                      for i, role in enumerate(roles)}}
    snapshot = {'root_identity': [values['root_device'], values['root_inode']],
                'stock_process': [values['stock_pid'], values['stock_start']],
                'watchdog_process': [values['watchdog_pid'], values['watchdog_start']]}
    receipt = {k: values[k] for k in ('ram_job_id', 'guardian_job_id', 'nonce')}
    frame = trial.frame(plan, values['plan_sha256'], snapshot, values['commit_nonce'], receipt,
                        [values['guardian_device'], values['guardian_inode']], [values['ram_device'], values['ram_inode']],
                        {'size': values['guardian_bytes'], 'sha256': values['guardian_sha256']})
    lookup = {value: name for name, value in values.items()}
    if len(frame) != 40 or frame[0] != '--bounded-first-bridge-v1' or set(frame[1:]) != set(lookup):
        raise ValueError('Exact forty-field frozen guardian ABI required')
    markers = set(re.findall(r'CGS1_TRIAL_(?:START|CHILD|END)_V1', (PORT / 'initial_bridge_trial_main.cpp').read_text()))
    if markers != {'CGS1_TRIAL_START_V1', 'CGS1_TRIAL_CHILD_V1', 'CGS1_TRIAL_END_V1'}:
        raise ValueError('Exact frozen guardian record markers required')
    values['guardian_file_inode'] = 'CGS1_ABI_FIELD_GUARDIAN_FILE_INODE'
    vendors = sorted(trial.review.preflight.FILES)
    values.update({f'vendor_{i}': 'CGS1_ABI_FIELD_VENDOR_' + str(i) for i in range(len(vendors))})
    launch = launch_template(values) + ' '.join(frame)
    lookup = {value: name for name, value in values.items()}
    pattern = re.compile('|'.join(re.escape(v) for v in sorted(lookup, key=len, reverse=True)))
    parts, offset = [], 0
    for match in pattern.finditer(launch):
        if match.start() > offset:
            parts.append(launch[offset:match.start()])
        parts.append({'field': lookup[match.group()]})
        offset = match.end()
    if offset < len(launch):
        parts.append(launch[offset:])
    if 'CGS1_ABI_FIELD_' in ''.join(p for p in parts if isinstance(p, str)):
        raise ValueError('Unknown symbolic guardian leaf')
    return {'schema_version': 1, 'source_commit': pinned['source_commit'], 'source_sha256': source,
            'markers': {kind: 'CGS1_TRIAL_' + kind.upper() + '_V1' for kind in ('start', 'child', 'end')},
            'vendor_paths': vendors, 'launch_template': parts, 'staged_roles': roles, 'frame': [({'field': lookup[item]} if item in lookup else item) for item in frame]}


def launch_template(values):
    # Reuse the same complete committed guard/resource readers as RAM creation.
    # This emits text only; no chmod/exec occurs in this generator or its tests.
    path = ROOT / 'tools/monitor1-usb/generate_initial_ram_commands.py'
    module_spec = importlib.util.spec_from_file_location('guardian_ram_guard', path)
    ram = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(ram)
    bound = {**values, **{f'staged_{i}': values[f'staged_{i}_sha256'] for i in range(len(ram.commit.staging.STAGED))}}
    root = '/tmp/qingping-initial-guardian-' + values['guardian_job_id']
    job = '/tmp/qingping-initial-trial-' + values['ram_job_id']
    file = root + '/program'
    text = ram.preparation_guard(bound) + ram.memory_guard() + '\n'
    text += "test ! -L /tmp\ntest -d /tmp\n" + ram.commit.equal('readlink -f /tmp', '/tmp') + ram.commit.equal("stat -c '%a %u' /tmp", '1777 0')
    for path, device, inode, entries in ((job, values['ram_device'], values['ram_inode'], ''),
                                          (root, values['guardian_device'], values['guardian_inode'], 'program')):
        text += ('test ! -L ' + path + '\ntest -d ' + path + '\n' + ram.commit.equal('readlink -f ' + path, path) +
                 ram.commit.equal("stat -c '%d %i %a %u' " + path, device + ' ' + inode + ' 700 0') +
                 ram.commit.equal("stat -f -c '%t' " + path, '1021994') + ram.commit.equal('LC_ALL=C ls -A1 ' + path, entries))
    def file_guard(mode):
        metadata = values['guardian_bytes'] + ' ' + mode + ' 0 1 ' + values['guardian_device'] + ' ' + values['guardian_file_inode']
        digest = values['guardian_sha256']
        return ('test ! -L ' + file + '\ntest -f ' + file + '\n' + ram.commit.equal('readlink -f ' + file, file) +
                ram.commit.equal("stat -c '%s %a %u %h %d %i' " + file, metadata) +
                'qp_guard_sha=$(sha256sum ' + file + ')\n' +
                '[ "$qp_guard_sha" = ' + ram.commit.shlex.quote(digest + ' ' + file) + ' ] || [ "$qp_guard_sha" = ' +
                ram.commit.shlex.quote(digest + '  ' + file) + ' ]\n')
    # Only this exact newly-created guardian file changes executable mode. Both
    # original inode and complete byte pin are repeated after chmod, before exec.
    text += file_guard('600') + 'chmod 700 ' + file + '\n' + file_guard('700')
    text += 'exec ' + file + ' '  # argv appended from the exact frozen ABI below.
    return text


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    raw = json.dumps(specification(), indent=2) + '\n'
    outputs = {ROOT / 'apps/monitor1_usb/rootfs/initial-guardian-contract.json': raw,
               ROOT / 'custom_components/qingping_esphome/frontend/usb-initial-guardian-contract.mjs':
                   '// Generated by generate_initial_guardian_contract.py; pure frozen argv metadata.\n'
                   'export const initialGuardianContract = ' + raw.rstrip() + ';\n'}
    for path, body in outputs.items():
        if args.check:
            if not path.is_file() or path.read_text() != body:
                raise SystemExit('Initial guardian ABI contract is stale')
        else:
            path.write_text(body)


if __name__ == '__main__':
    main()
