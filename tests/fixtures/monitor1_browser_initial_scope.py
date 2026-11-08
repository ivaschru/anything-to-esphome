"""Independent native live_scope command/reply vectors; no real USB or shell."""
from contextlib import redirect_stdout
import importlib.util
import io
import json
from pathlib import Path
import runpy
import sys

ROOT = Path(__file__).resolve().parents[2]
with redirect_stdout(io.StringIO()):
    process_vectors = runpy.run_path(str(ROOT / 'tests/fixtures/monitor1_browser_initial_process.py'))['result']
spec = importlib.util.spec_from_file_location('canonical_scope', ROOT / 'tools/monitor1-usb/generate_initial_scope_contract.py')
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)
def vector(v, layout):
    packet, ram, started = v['packet'], v['ram'], v['started']
    meta, scope = packet['context']['meta'], packet['context']['committed_scope']
    plan = {'plan_id': scope['plan_id'], 'files': meta['descriptor']['files'],
            'target': {**meta['target'], 'usb_transport': 'usb:synthetic-parity-only'}}
    receipt = {k: packet[k] for k in ('nonce', 'ram_job_id', 'guardian_job_id')}
    receipt['guardian'] = packet['context']['guardian']
    rows = generator.capture(plan, packet['plan_sha256'], scope, receipt, tuple(map(int, started['start']['stamp'])),
            ram['uploaded']['ram_root_identity'], packet['context']['api_identity']['node_name'],
            tuple(map(int, started['child']['stamp'])), layout, meta['commit_nonce'])
    # The capture's positive native parser uses integer births; the actual
    # browser records deliberately preserve full uint64 decimal strings.
    return {'packet': packet, 'ram': ram, 'started': started, 'layout': layout,
            'commands': {r['key']: r['command'] for r in rows}, 'reads': {r['key']: r['reply'] for r in rows}}

if sys.argv[1:] == ['--stdin']:
    v = json.loads(sys.stdin.buffer.read(1024 * 1024))
    assert set(v) == {'packet', 'ram', 'started', 'layout'}
    result = vector(v, v['layout'])
else:
    assert not sys.argv[1:]
    result = [vector(v, layout) for v in process_vectors for layout in ('empty', 'prefs_empty', 'prefs_file')]
print(json.dumps(result))
