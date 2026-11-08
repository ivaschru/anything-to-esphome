"""Frozen frame() parity vectors only; no ADB, program execution or SDK."""
from contextlib import redirect_stdout
import io
import json
from pathlib import Path
import runpy
import sys

ROOT = Path(__file__).resolve().parents[2]
with redirect_stdout(io.StringIO()):
    data = runpy.run_path(str(ROOT / 'tests/fixtures/monitor1_browser_initial_ram.py'))
sys.path.insert(0, str(ROOT / 'ports/monitor1'))
import trial_initial_bridge_adb as trial
result = []
for vector in data['result']:
    packet, fresh = vector['packet'], vector['preparation']
    pin = packet['context']['guardian']
    def observed(uploaded):
        return {'kind': 'browser_initial_ram_observation', 'phase': 'uploaded' if uploaded else 'precreated',
                **{k: packet[k] for k in ('job_id', 'plan_sha256', 'intent_sha256', 'channel_id', 'channel_nonce', 'nonce', 'ram_job_id', 'guardian_job_id')},
                'ram_root_identity': [7, 100], 'guardian_root_identity': [7, 101], 'guardian_file_identity': [7, 102],
                'guardian_size': pin['size'] if uploaded else 0,
                'guardian_sha256': pin['sha256'] if uploaded else trial.hashlib.sha256(b'').hexdigest(),
                'tmpfs_available_bytes': 64 * 1024**2, 'image_fd_admitted': False, 'execution_authority': False, 'context_only': True}
    ram = {'kind': 'browser_initial_ram_ready', 'precreated': observed(False), 'uploaded': observed(True), 'preparation': fresh,
           'transport_closed': False, 'guardian_started': False, 'image_fd_admitted': False, 'execution_authority': False, 'context_only': True}
    meta = packet['context']['meta']
    plan = {'plan_id': fresh['scope']['plan_id'], 'target': meta['target'], 'files': meta['descriptor']['files']}
    expected = trial.frame(plan, packet['plan_sha256'], fresh['scope'], meta['commit_nonce'], packet, [7, 101], [7, 100], pin)
    result.append({'packet': packet, 'fresh': fresh, 'ram': ram, 'expected': expected})
print(json.dumps(result))
