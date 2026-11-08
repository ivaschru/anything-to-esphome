"""Synthetic actual host PM packet plus canonical fixed read replies."""
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / 'tests')); sys.path.insert(0, str(root / 'tools/monitor1-usb'))
from test_usb_browser_pm_boot_journal import PmJournalTests
import generate_bridge_observer_contract as generator

case = PmJournalTests(methodName='runTest'); case.setUp()
try:
    scope = case.selected['observation']['scope']
    for name, birth in (('child', '1900001'), ('supervisor', '1900003'), ('stock', '1900007'), ('watchdog', '1900009')):
        scope['processes'][name][2] = birth
    packet = case.prepare(); c = packet['context']; old = c['arming']['context']['meta']; values = dict(generator.VALUES)
    values.update(plan_id=old['descriptor']['plan_id'], plan_sha256=c['plan_sha256'], nonce=c['arming']['nonce'],
                  commit_nonce=old['commit_nonce'], wlan_mac=old['target']['wlan_mac'], boot_id=scope['target']['boot_id'])
    for name, record in scope['processes'].items(): values[name + '_pid'] = str(record[0])
    plan = {'plan_id': values['plan_id'], 'files': old['descriptor']['files'],
            'target': {**old['target'], 'usb_serial': 'synthetic-observer', 'usb_transport': 'usb:synthetic-only'}}
    reads, _ = generator.capture(values, scope['target']['co2_type'], plan_input=plan, root_input=scope['root_identity'])
    print(json.dumps({'packet': packet, 'proof': case.proof(packet), 'reads': reads}))
finally:
    case.doCleanups()
