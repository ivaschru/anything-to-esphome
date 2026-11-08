"""Canonical PM parity vectors with synthetic private context; never execute."""
import copy
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / 'tests')); sys.path.insert(0, str(root / 'tools/monitor1-usb'))
from test_usb_browser_boot_context import ObserverContextTests
import generate_pm_boot_contract as generator

case = ObserverContextTests(methodName='runTest'); case.setUp()
try:
    case.complete(); original = case.read(); result = []
    for co2 in (2, 3):
        for large_ids in (False, True):
            for large_birth in (False, True):
                c = copy.deepcopy(original); p = c['arming']; meta = p['context']['meta']
                roots = [2**53 - 2, 2**53 - 1] if large_ids else [1041, 1043]
                for s in (p['context']['committed_scope'], p['preparation']['preparation']['scope']):
                    s['root_identity'] = roots; s['target']['co2_type'] = co2
                meta['target']['co2_type'] = co2
                values = dict(generator.VALUES)
                values.update(plan_id=meta['descriptor']['plan_id'], plan_sha256=c['plan_sha256'], nonce=p['nonce'],
                              commit_nonce=meta['commit_nonce'], wlan_mac=meta['target']['wlan_mac'],
                              root_device=str(roots[0]), root_inode=str(roots[1]))
                names = ('child', 'supervisor', 'stock', 'watchdog')
                if large_ids:
                    for i, name in enumerate(names): values[name + '_pid'] = str(2147483647 - i)
                if large_birth:
                    for name in names: values[name + '_birth'] = str(2**64 - 1)
                ids = {name: int(values[name + '_pid']) for name in names}
                processes = {name: [ids[name], ids['supervisor'] if name == 'child' else ids['watchdog'] if name == 'stock' else 1,
                                    values[name + '_birth']] for name in names}
                scope = {'kind': 'browser_bridge_boot_runtime_scope', 'job_id': c['job_id'], 'plan_sha256': c['plan_sha256'],
                         'arming_intent_sha256': p['intent_sha256'], 'arming_proof_sha256': c['arming_proof_sha256'],
                         'target': {**meta['target'], 'boot_id': values['boot_id']}, 'root_identity': roots, 'processes': processes,
                         'pm_disabled': True, 'recovery_backup': True, 'bridge_disabled': False, 'canonical_scope_checked': True,
                         'memory_free_bytes': 64 * 1024**2, 'memory_total_bytes': 128 * 1024**2, 'context_only': True, 'device_writes': 0}
                commands, _, _ = generator.commands(values, co2, files=meta['descriptor']['files'])
                for phase, text in commands.items():
                    result.append({'context': c, 'scope': scope, 'nonce': values['pm_nonce'], 'phase': phase, 'expected': 'set -eu\n' + text})
    print(json.dumps(result))
finally:
    case.doCleanups()
