"""Independent native arming text vectors; no shell/ADB or device execution."""
from copy import deepcopy
import importlib
import json
from pathlib import Path
import runpy
import sys
from types import SimpleNamespace
import contextlib
import io

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'ports/monitor1'))
boot = importlib.import_module('arm_bridge_next_boot_adb')
# Reuse PUBLIC synthetic target/descriptor vectors, without running their
# printed output or any production-path command. They contain no native path.
with contextlib.redirect_stdout(io.StringIO()):
    source = runpy.run_path(str(ROOT / 'tests/fixtures/monitor1_browser_commands.py'))['vectors']
vectors = []
for candidate in (row for row in source if row['phase'] == 'start'):
    meta, scope = deepcopy(candidate['meta']), deepcopy(candidate['scope'])
    for row in scope['vendor_hashes']:
        if row[0] in boot.commit.policy.PATCHED:
            row[1] = boot.commit.policy.PATCHED[row[0]]
    nonce = 'e' * 32
    plan = {'plan_id': meta['descriptor']['plan_id'], 'files': meta['descriptor']['files']}
    digest = meta['descriptor']['plan_sha256']
    baseline = SimpleNamespace(**{**scope, 'target': (meta['target']['wlan_mac'], meta['target']['co2_type']),
                                 'boot_id': meta['target']['boot_id']})
    commands = {
        'before': boot.guard(plan, baseline, 'disabled') + boot.absence(boot.ARM_DONE) + boot.absence(boot.DISARM_DONE),
        'arm': boot.arming_command(plan, baseline, digest, nonce),
        'armed': boot.guard(plan, baseline, 'armed'),
        'complete': boot.completion_guard(plan, digest, nonce, 'arm'),
    }
    for phase, text in commands.items():
        vectors.append({'meta': meta, 'scope': scope, 'nonce': nonce, 'phase': phase,
                        'expected': 'set -eu\numask 077\n' + text})
print(json.dumps(vectors))
