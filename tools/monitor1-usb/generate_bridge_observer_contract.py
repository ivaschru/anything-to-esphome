#!/usr/bin/env python3
"""Derive read-only post-boot reads from the existing native observer.

The native readers see synthetic replies in memory. No shell, ADB, USB, SDK,
process signal or firmware program runs. The synthetic native USB locator is
used only to trace canonical source; it is never emitted or a browser receipt.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
PORT = ROOT / 'ports/monitor1'
sys.path.insert(0, str(PORT))
try:
    import verify_bridge_boot_adb as native
finally:
    sys.path.pop(0)

VALUES = {'plan_id': '19' * 16, 'plan_sha256': '29' * 32, 'nonce': '39' * 16,
          'commit_nonce': '49' * 16, 'wlan_mac': '02:00:00:00:00:13',
          'boot_id': '59999999-5999-5999-5999-599999999999',
          'supervisor_pid': '217001011', 'child_pid': '217001013',
          'stock_pid': '217001017', 'watchdog_pid': '217001019'}


def proc(pid, parent, start, path):
    parts = ['0'] * 20
    parts[0], parts[1], parts[19] = 'S', str(parent), str(start)
    return f'{pid} (synthetic observer) ' + ' '.join(parts) + '\n0\n' + path


def capture(values=VALUES, co2=2, *, plan_input=None, root_input=(1041, 1043)):
    """Trace the full native scope, including independent closing reads."""
    arm, base = native.arm, native.BASE
    plan = {'plan_id': values['plan_id'], 'target': {'usb_serial': 'synthetic-observer',
        'usb_transport': 'usb:synthetic-observer-only', 'wlan_mac': values['wlan_mac'],
        'co2_type': co2, 'boot_id': '00000000-0000-4000-8000-000000000001'},
        'files': {role: {'size': 1800101 + 2 * i, 'sha256': hashlib.sha256(role.encode()).hexdigest()}
                  for i, role in enumerate(native.staging.STAGED)}}
    if plan_input is not None:
        plan = plan_input
    digest = values['plan_sha256']
    vendors = {p: pin[0] for p, pin in native.review.preflight.FILES.items()}
    vendors.update(native.review.policy.PATCHED)
    baseline = SimpleNamespace(boot_id=plan['target']['boot_id'], root_identity=tuple(root_input),
                               vendor_hashes=tuple(sorted(vendors.items())))
    receipt = {'nonce': values['nonce']}
    commit = {'plan_id': plan['plan_id'], 'plan_sha256': digest, 'direction': 'commit_disabled',
              'stage': 'committed_disabled', 'consumed_install_intent': True, 'activated': False,
              'installed': False, 'verified': [native.review.policy.WATCHDOG, native.review.policy.START],
              'issued': [native.review.policy.WATCHDOG, native.review.policy.START], 'nonce': values['commit_nonce']}
    supervisor, child, stock, watchdog = (int(values[k]) for k in
                                         ('supervisor_pid', 'child_pid', 'stock_pid', 'watchdog_pid'))
    processes = {child: proc(child, supervisor, 1900001, base + '/program'),
                 supervisor: proc(supervisor, 1, 1900003, '/bin/busybox'),
                 stock: proc(stock, watchdog, 1900007, '/data/bin/SnowApp'),
                 watchdog: proc(watchdog, 1, 1900009, '/bin/busybox')}
    rows = []
    def add(key, reply): rows.append({'key': key, 'reply': reply})
    def identity(suffix=''):
        for key, reply in (('uid', '0'), ('wlan', values['wlan_mac']),
            ('version', 'CLEARGRASS_VERSION=4.1.8_0287'), ('architecture', 'armv7l'),
            ('co2', str(co2)), ('boot', values['boot_id'])): add('identity_' + key + suffix, reply)
    def root(suffix=''):
        add('root' + suffix, f'{root_input[0]} {root_input[1]} 700 0\n' + plan['plan_id'] + ' ' + digest)
        add('parents' + suffix, str(root_input[0]) + '\n' + str(root_input[0]))
    def file(pin, path): return f"{pin['size']} 1\n{pin['sha256']}  {path}"
    identity(); root()
    add('commit_marker', 'commit-disabled ' + commit['nonce'] + ' ' + plan['plan_id'])
    add('completion_guard', ''); add('armed_flags', '')
    add('pm_flag', '0 600 0 1\n' + native.review.policy.EMPTY_SHA + '  ' + base + '/pm-helper.disabled')
    add('bridge_layout', '')
    for i, (role, leaf) in enumerate(native.staging.STAGED.items()): add('staged_' + str(i), file(plan['files'][role], base + '/' + leaf))
    for i, (path, (sha, size)) in enumerate(native.review.preflight.FILES.items()):
        if path == native.review.policy.START: size += 298
        if path == native.review.policy.WATCHDOG: size += len(native.review.bootstrap.WATCHDOG_NEW) - len(native.review.bootstrap.WATCHDOG_OLD)
        add('vendor_' + str(i), file({'size': size, 'sha256': vendors[path]}, path))
    add('lock', str(supervisor) + '\n' + str(child))
    add('child', processes[child]); add('supervisor', processes[supervisor])
    add('child_image_process_before', processes[child])
    add('child_image_file', file(plan['files']['bridge-program'], base + '/program'))
    pin = plan['files']['bridge-program']; image = f"{root_input[0]} 1047 {pin['size']} 700 0 1"
    add('child_image', image + '\n' + image + f"\n{pin['sha256']}  /proc/{child}/exe")
    add('child_image_process_after', processes[child])
    named = '1041 1051 1234 0 1\n1041 1051 1234 0 1'
    add('supervisor_image', named); add('supervisor_arguments', '')
    add('process_scan', str(stock)); add('stock', processes[stock]); add('watchdog', processes[watchdog])
    add('stock_image', named); add('watchdog_image', named); add('watchdog_arguments', '')
    for i in range(3): add('stock_maps_' + str(i), '')
    add('endpoint', '/proc/net/tcp 17A5\n/proc/net/tcp 0CA0')
    add('memory', 'MemTotal: 131072 kB\nMemFree: 65536 kB')
    for name, pid in (('child', child), ('supervisor', supervisor), ('stock', stock), ('watchdog', watchdog)):
        add(name + '_after', processes[pid])
    add('lock_after', str(supervisor) + '\n' + str(child)); identity('_after'); root('_after')
    class Reader:
        serial = plan['target']['usb_serial']
        def __init__(self): self.index = 0
        def usb(self): return plan['target']['usb_transport']
        def read(self, command):
            row = rows[self.index]; self.index += 1; row['command'] = command
            return row['reply']
    reader = Reader()
    with patch.object(native.staging.offline, 'read_json', return_value=(commit, 'synthetic-only')):
        observed = native.scope(reader, Path('synthetic-only'), plan, digest, baseline, receipt)
    if reader.index != len(rows) or observed['boot_id'] != values['boot_id']:
        raise ValueError('Canonical observer order changed')
    return rows, plan


def specification():
    rows, plan = capture()
    tokens = dict(VALUES)
    tokens['completion_sha256'] = hashlib.sha256(('arm ' + VALUES['nonce'] + ' ' + VALUES['plan_id'] + ' ' + VALUES['plan_sha256'] + '\n').encode()).hexdigest()
    # Every staged size/hash is an exact typed descriptor leaf. Numeric sizes
    # are intentionally unique and replaced only as complete decimal tokens.
    for i, pin in enumerate(plan['files'].values()):
        tokens['staged_size_' + str(i)] = str(pin['size']); tokens['staged_sha_' + str(i)] = pin['sha256']
    lookup = {value: key for key, value in tokens.items()}
    pattern = re.compile('|'.join(re.escape(v) for v in sorted(lookup, key=len, reverse=True)))
    reads = []
    for row in rows:
        parts, offset = [], 0
        for match in pattern.finditer(row['command']):
            if match.start() > offset: parts.append(row['command'][offset:match.start()])
            parts.append({'field': lookup[match.group()]}); offset = match.end()
        if offset < len(row['command']): parts.append(row['command'][offset:])
        reads.append({'key': row['key'], 'parts': parts})
    names = set(json.loads((ROOT / 'apps/monitor1_usb/rootfs/bridge-next-boot-contract.json').read_bytes())['source_sha256']) | {'verify_bridge_boot_adb.py'}
    return {'schema_version': 1, 'source_commit': '53d97b9609e8e0fcdfc5d003101f620098dbc734',
            'source_sha256': {name: hashlib.sha256((PORT / name).read_bytes()).hexdigest() for name in sorted(names)}, 'reads': reads}


def main():
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('--check', action='store_true'); args = parser.parse_args()
    value = specification(); body = json.dumps(value, indent=2)
    outputs = {ROOT / 'apps/monitor1_usb/rootfs/bridge-observer-contract.json': body + '\n',
               ROOT / 'custom_components/qingping_esphome/frontend/usb-bridge-observer-contract.mjs':
               '// Generated canonical read-only observer; never a writer or native receipt.\nexport const bridgeObserverContract = ' + body + ';\n'}
    for path, text in outputs.items():
        if args.check:
            if not path.is_file() or path.read_text() != text: raise SystemExit('Bridge observer contract is stale')
        else: path.write_text(text)


if __name__ == '__main__': main()
