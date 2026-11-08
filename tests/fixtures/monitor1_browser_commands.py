"""Public synthetic command parity vectors; no SDK, shell or device execution.

Only the frozen canonical script builder runs. A two-component identity is
sufficient for this transport-agnostic text function; no native plan/loader or
invented get-devpath is involved. The separate typed policy and journal remain
independent prerequisites of any future actual writer.
"""
from copy import deepcopy
import importlib
import json
from pathlib import Path
import shlex
import sys
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'ports/monitor1'))
commit = importlib.import_module('commit_disabled_install')
reader = json.loads((ROOT / 'apps/monitor1_usb/rootfs/disabled-contract.json').read_bytes())
nonce = 'f' * 32
empty = commit.policy.EMPTY_SHA
vectors = []
for co2 in (2, 3):
    for large in (False, True):
        files = {role: {'size': 17 + i, 'sha256': reader['sources'].get(role, str(i + 1) * 64)}
                 for i, role in enumerate(commit.staging.STAGED)}
        target = {'kind': 'browser_webusb', 'wlan_mac': '02:00:00:00:00:01', 'co2_type': co2,
                  'stock_version': '4.1.8_0287', 'usb_serial': 'synthetic-usb',
                  'boot_id': '22222222-2222-2222-2222-222222222222'}
        desc = {'plan_id': 'a' * 32, 'plan_sha256': 'b' * 64, 'intent_sha256': 'c' * 64, 'files': files}
        meta = {'schema_version': 1, 'job_id': 'd' * 32, 'target': target, 'descriptor': desc, 'commit_nonce': None}
        scope = {'kind': 'browser_disabled_scope', 'target': target, 'plan_id': desc['plan_id'], 'plan_sha256': desc['plan_sha256'],
                 'stage_intent_sha256': desc['intent_sha256'], 'root_identity': [2**40 if large else 1, 2**41 if large else 2],
                 'install_marker': desc['plan_id'] + ' ' + desc['plan_sha256'], 'root_mode': 0o700, 'root_uid': 0,
                 'disabled_flags': [[empty, 0, 0o600, 0, 1, False]] * 2,
                 'source_hashes': sorted([key, value] for key, value in reader['sources'].items()),
                 'vendor_hashes': sorted([path, pin[0]] for path, pin in commit.preflight.FILES.items()),
                 'stock_process': [50000 if large else 50, 2**40 if large else 100, commit.preflight.FILES['/data/bin/SnowApp'][0], 0],
                 'watchdog_process': [50001 if large else 51, 2**40 + 100 if large else 110, 0],
                 'own_code_running': False, 'pm_helper_loaded': False, 'data_available_bytes': 32 * 1024**2,
                 'same_filesystem': True, 'staged_files': files, 'commit_nonce': None}
        plan = {'plan_id': desc['plan_id'], 'files': files}
        for phase in ('claim', 'watchdog', 'start'):
            current_meta, current = deepcopy(meta), deepcopy(scope)
            if phase != 'claim':
                current_meta['commit_nonce'] = current['commit_nonce'] = nonce
            if phase == 'start':
                for pair in current['vendor_hashes']:
                    if pair[0] == commit.policy.WATCHDOG:
                        pair[1] = commit.policy.PATCHED[pair[0]]
            observed = SimpleNamespace(**{**current, 'target': (target['wlan_mac'], co2), 'boot_id': target['boot_id']})
            if phase == 'claim':
                lock = commit.staging.BASE + '/.commit-disabled.lock'
                text = (commit.inline_guard(plan, observed, 'commit_disabled', nonce, include_lock=False) +
                        'mkdir ' + lock + '\nchmod 700 ' + lock + "\nprintf '%s\\n' " +
                        shlex.quote('commit-disabled ' + nonce + ' ' + plan['plan_id']) + ' > ' + lock + '/owner\nsync')
            else:
                path = commit.policy.WATCHDOG if phase == 'watchdog' else commit.policy.START
                source = 'watchdog.sh.candidate' if phase == 'watchdog' else 'start.sh.candidate'
                operation = commit.policy.Operation(source, path, commit.policy.FACTORY[path], commit.policy.PATCHED[path])
                text = commit.replacement_command(plan, observed, 'commit_disabled', nonce, operation)
            vectors.append({'meta': current_meta, 'scope': current, 'nonce': nonce, 'phase': phase,
                            'expected': 'set -eu\numask 077\n' + text})
print(json.dumps(vectors))
