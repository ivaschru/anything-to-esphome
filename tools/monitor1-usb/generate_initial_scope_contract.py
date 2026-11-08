#!/usr/bin/env python3
"""Capture frozen live_scope reads against synthetic in-memory replies only.

No shell, ADB, program or production path executes. All three allowed RAM
preference layouts are derived separately. The fixture's native USB equality
is not exported as a browser path/receipt or used to grant a live capability.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
PORT = ROOT / 'ports/monitor1'
sys.path.insert(0, str(PORT))
try:
    import trial_initial_bridge_adb as trial
finally:
    sys.path.pop(0)

VALUES = {'guardian_pid': '217001001', 'child_pid': '217001002', 'stock_pid': '217001003',
          'watchdog_pid': '217001004', 'ram_device': '217001005', 'guardian_job_id': 'ab' * 16,
          'ram_job_id': 'cd' * 16, 'node_name': 'qingping-scope-fixture'}


def process(pid, parent, birth, path):
    fields = ['0'] * 20
    fields[0], fields[1], fields[19] = 'S', str(parent), str(birth)
    return f'{pid} (synthetic scope fixture) ' + ' '.join(fields) + '\n0\n' + path


def capture(plan, digest, baseline, receipt, guardian, ram_root, node, child, layout,
            commit_nonce='6b14947f19e44c6c99b5ae57c81752a4'):
    """Return the exact ordered native commands and matching synthetic replies.

    This entry also supports independent canonical parity vectors in tests.
    Replies validate only the pure host readers; no device result is claimed.
    The sole local receipt read is replaced with a fixed in-memory record.
    """
    if layout not in ('empty', 'prefs_empty', 'prefs_file'):
        raise ValueError('Unknown synthetic RAM layout')
    base = trial.BASE
    guard_path = '/tmp/qingping-initial-guardian-' + receipt['guardian_job_id'] + '/program'
    replies, keys = [], []
    def add(key, reply): keys.append(key); replies.append(reply)
    def file(pin, path): return f"{pin['size']} 1\n{pin['sha256']}  {path}"
    def image(pin, pid, device, inode):
        row = f"{device} {inode} {pin['size']} 700 0 1"
        return row + '\n' + row + f"\n{pin['sha256']}  /proc/{pid}/exe"
    child_reply = f'{child[0]} {child[1]} S'
    gp = process(guardian[0], 1, guardian[1], guard_path)
    cp = process(child[0], guardian[0], child[1], base + '/program')
    add('child_before', child_reply)
    for prefix, stamp, path, pin, observed, device, inode in (
            ('guardian', guardian, guard_path, receipt['guardian'], gp, ram_root[0], 102),
            ('child', child, base + '/program', plan['files']['bridge-program'], cp, baseline['root_identity'][0], 104)):
        add(prefix + '_process_before', observed)
        add(prefix + '_file', file(pin, path))
        add(prefix + '_image', image(pin, stamp[0], device, inode))
        add(prefix + '_process_after', observed)
    add('endpoint', '/proc/net/tcp 17A5\n/proc/net/tcp 0CA0')
    stock, watchdog = baseline['stock_process'], baseline['watchdog_process']
    add('process_scan', str(stock[0]))
    add('stock_process', process(stock[0], watchdog[0], stock[1], '/data/bin/SnowApp'))
    add('watchdog_process', process(watchdog[0], 1, watchdog[1], '/bin/busybox'))
    add('watchdog_arguments', '')
    for i in range(3): add('stock_maps_' + str(i), '')
    for i, (path, (sha, size)) in enumerate(trial.review.preflight.FILES.items()):
        selected = dict(baseline['vendor_hashes'])[path]
        if path == trial.review.policy.START and selected == trial.review.bootstrap.START_INSTALLED:
            size += 298
        elif path == trial.review.policy.WATCHDOG and selected == trial.review.bootstrap.WATCHDOG_INSTALLED:
            size += len(trial.review.bootstrap.WATCHDOG_NEW) - len(trial.review.bootstrap.WATCHDOG_OLD)
        add('vendor_' + str(i), file({'size': size, 'sha256': selected}, path))
    for i, (role, leaf) in enumerate(trial.review.staging.STAGED.items()):
        add('staged_' + str(i), file(plan['files'][role], base + '/' + leaf))
    root = baseline['root_identity']
    add('root', f'{root[0]} {root[1]} 700 0\n' + plan['plan_id'] + ' ' + digest)
    add('parents', f'{root[0]}\n{root[0]}')
    for leaf in ('disabled', 'pm-helper.disabled'):
        add(leaf, '0 600 0 1\n' + trial.review.policy.EMPTY_SHA + '  ' + base + '/' + leaf)
    add('absent_stores', '')
    add('memory', 'MemTotal: 131072 kB\nMemFree: 65536 kB')
    expected = ('CGS1_INITIAL_TRIAL_V1\n' + plan['plan_id'] + '\n' + digest + '\n' +
                plan['target']['boot_id'] + '\n' + plan['files']['bridge-program']['sha256'] + '\n' +
                receipt['guardian']['sha256'] + '\n' + receipt['nonce'] + '\n' +
                f'{ram_root[0]} {ram_root[1]}\n{guardian[0]} {guardian[1]}\n')
    add('intent_file', file({'size': len(expected), 'sha256': hashlib.sha256(expected.encode()).hexdigest()}, base + '/initial-trial.intent'))
    add('intent_mode', '')
    allowed = set(trial.review.staging.STAGED.values()) | {
        'install.intent', 'disabled', 'pm-helper.disabled', '.commit-disabled.lock', 'initial-trial.intent'}
    add('nand_entries', '\n'.join(sorted(allowed)))
    commit = {'plan_id': plan['plan_id'], 'plan_sha256': digest, 'direction': 'commit_disabled',
              'stage': 'committed_disabled', 'consumed_install_intent': True, 'activated': False, 'installed': False,
              'verified': [trial.review.policy.WATCHDOG, trial.review.policy.START],
              'issued': [trial.review.policy.WATCHDOG, trial.review.policy.START], 'nonce': commit_nonce}
    add('commit_marker', 'commit-disabled ' + commit['nonce'] + ' ' + plan['plan_id'])
    add('ram_identity', f'{ram_root[0]} {ram_root[1]} 700 0\n1021994')
    add('ram_entries', '' if layout == 'empty' else 'prefs')
    if layout != 'empty':
        add('prefs_guard', '')
        add('prefs_entries', node + '.prefs' if layout == 'prefs_file' else '')
        if layout == 'prefs_file': add('prefs_file', f'123 600 0 1 {ram_root[0]}')
    for key, reply in (('uid', '0'), ('wlan', plan['target']['wlan_mac']),
                       ('version', 'CLEARGRASS_VERSION=4.1.8_0287'), ('architecture', 'armv7l'),
                       ('co2', str(plan['target']['co2_type'])), ('boot', plan['target']['boot_id'])):
        add('identity_' + key, reply)
    add('child_after', child_reply)
    class Reader:
        def __init__(self): self.commands = []
        def read(self, command):
            index = len(self.commands)
            if index >= len(replies): raise ValueError('Unexpected canonical read')
            self.commands.append(command)
            return replies[index]
        def usb(self): return plan['target']['usb_transport']  # Synthetic native parity only, never emitted.
    reader = Reader()
    with patch.object(trial.review.staging.offline, 'read_json', return_value=(commit, 'not-used')):
        observed = trial.live_scope(reader, Path('synthetic-in-memory-only'), plan, digest, baseline, receipt,
                                    guardian, guard_path, ram_root, node, child)
    if observed != child or len(reader.commands) != len(keys):
        raise ValueError('Canonical live scope order changed')
    return [{'key': key, 'command': command, 'reply': reply}
            for key, command, reply in zip(keys, reader.commands, replies, strict=True)]


def content():
    pinned = json.loads((ROOT / 'apps/monitor1_usb/rootfs/initial-trial-contract.json').read_bytes())
    if any(hashlib.sha256((PORT / name).read_bytes()).hexdigest() != sha for name, sha in pinned['source_sha256'].items()):
        raise ValueError('Frozen live_scope source changed')
    window = re.findall(r'constexpr uint64_t WINDOW_MS=([0-9]+);', (PORT / 'initial_trial_scope.h').read_text())
    if window != ['5000']:
        raise ValueError('Frozen scope observation window changed')
    plan = {'plan_id': '1' * 32, 'target': {'boot_id': '33333333-3333-3333-3333-333333333333',
        'wlan_mac': '02:00:00:00:00:03', 'co2_type': 2, 'usb_transport': 'usb:synthetic-generator-only'},
        'files': {role: {'size': 1700101 + i * 2, 'sha256': hashlib.sha256(role.encode()).hexdigest()}
                  for i, role in enumerate(trial.review.staging.STAGED)}}
    vendors = {p: pin[0] for p, pin in trial.review.preflight.FILES.items()}
    vendors.update(trial.review.policy.PATCHED)
    baseline = {'stock_process': [int(VALUES['stock_pid']), 1900049],
                'watchdog_process': [int(VALUES['watchdog_pid']), 1900061],
                'vendor_hashes': sorted(vendors.items()), 'root_identity': [1041, 1043]}
    receipt = {k: VALUES[k] for k in ('guardian_job_id', 'ram_job_id')}
    receipt.update(guardian={'size': 1700033, 'sha256': 'b' * 64}, nonce='ef' * 16)
    lookup = {value: key for key, value in VALUES.items()}
    pattern = re.compile('|'.join(re.escape(v) for v in sorted(lookup, key=len, reverse=True)))
    branches, return_branches = {}, {}
    for layout in ('empty', 'prefs_empty', 'prefs_file'):
        rows = capture(plan, '2' * 64, baseline, receipt, (int(VALUES['guardian_pid']), 1900037),
                       [int(VALUES['ram_device']), 100], VALUES['node_name'], (int(VALUES['child_pid']), 1900043), layout)
        # Post-stop scope cannot use the live reader's two admitted process
        # exceptions. Reuse only its exact stock/vendor/intent/RAM tail, with
        # the frozen pre-start scan that positively refuses ALL own programs.
        # No fake guardian/child readbacks are inserted to satisfy a live DTO.
        # This is a read-only composition, not native trial() completion.
        returned = [dict(row) for row in rows if row['key'] not in {
            'child_before', 'child_after', 'endpoint', *(
                prefix + suffix for prefix in ('guardian', 'child') for suffix in
                ('_process_before', '_file', '_image', '_process_after'))}]
        if len(returned) != len(rows) - 11 or returned[0]['key'] != 'process_scan':
            raise ValueError('Frozen post-stop tail boundary changed')
        returned[0]['command'] = trial.initial.INITIAL_PROCESS_SCAN
        def templates(selected):
            reads = []
            for row in selected:
                parts, offset = [], 0
                for match in pattern.finditer(row['command']):
                    if offset < match.start(): parts.append(row['command'][offset:match.start()])
                    parts.append({'field': lookup[match.group()]}); offset = match.end()
                if offset < len(row['command']): parts.append(row['command'][offset:])
                reads.append({'key': row['key'], 'parts': parts})
            return reads
        branches[layout] = templates(rows)
        return_branches[layout] = templates(returned)
    return json.dumps({'schema_version': 1, 'source_commit': pinned['source_commit'], 'maximum_observation_ms': int(window[0]),
                       'source_sha256': pinned['source_sha256'], 'branches': branches,
                       'return_branches': return_branches}, indent=2) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    body = content()
    outputs = {ROOT / 'apps/monitor1_usb/rootfs/initial-scope-contract.json': body,
               ROOT / 'custom_components/qingping_esphome/frontend/usb-initial-scope-contract.mjs':
                   '// Generated fixed read-only live scope; no transport or execution authority.\n'
                   'export const initialScopeContract = ' + body.rstrip() + ';\n'}
    for path, text in outputs.items():
        if args.check:
            if not path.is_file() or path.read_text() != text: raise SystemExit('Initial scope contract is stale')
        else: path.write_text(text)


if __name__ == '__main__': main()
