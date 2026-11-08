"""Synthetic original journal plus canonical native observer replies; no IO."""
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / 'tests'))
sys.path.insert(0, str(root / 'tools/monitor1-usb'))
from test_usb_browser_boot_context import ObserverContextTests
import generate_bridge_observer_contract as generator

case = ObserverContextTests(methodName='runTest'); case.setUp()
try:
    case.complete(); context = case.read()
    p = context['arming']; meta = p['context']['meta']; values = dict(generator.VALUES)
    values.update(plan_id=meta['descriptor']['plan_id'], plan_sha256=p['plan_sha256'], nonce=p['nonce'],
                  commit_nonce=meta['commit_nonce'], wlan_mac=meta['target']['wlan_mac'])
    target = {**meta['target'], 'boot_id': values['boot_id']}
    plan = {'plan_id': values['plan_id'], 'files': meta['descriptor']['files'],
            'target': {**meta['target'], 'usb_serial': 'synthetic-observer', 'usb_transport': 'usb:synthetic-only'}}
    reads, _ = generator.capture(values, target['co2_type'], plan_input=plan,
                                 root_input=p['preparation']['preparation']['scope']['root_identity'])
    print(json.dumps({'context': context, 'target': target, 'reads': reads}))
finally:
    case.doCleanups()
