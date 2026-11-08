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
    # Independent post-stop vector: exact frozen tail plus the stricter
    # positive-absence scan. No live process rows are fabricated or reused.
    names = {'child_before', 'child_after', 'endpoint', *(prefix + suffix
             for prefix in ('guardian', 'child') for suffix in
             ('_process_before', '_file', '_image', '_process_after'))}
    returned = [dict(r) for r in rows if r['key'] not in names]
    assert len(returned) == len(rows) - 11
    returned[0]['command'] = generator.trial.initial.INITIAL_PROCESS_SCAN
    # Independently execute the actual frozen intent_and_ram HOST parser on
    # its synthetic bounded replies; no shell or named device path executes.
    subset = returned[[r['key'] for r in returned].index('intent_file'):]
    subset = [r for r in subset if not r['key'].startswith('identity_')]
    class IntentReader:
        def __init__(self): self.index = 0
        def read(self, command):
            r = subset[self.index]; self.index += 1
            assert command == r['command']
            return r['reply']
    reader = IntentReader()
    commit = {'plan_id': scope['plan_id'], 'plan_sha256': packet['plan_sha256'], 'direction': 'commit_disabled',
              'stage': 'committed_disabled', 'consumed_install_intent': True, 'activated': False, 'installed': False,
              'verified': [generator.trial.review.policy.WATCHDOG, generator.trial.review.policy.START],
              'issued': [generator.trial.review.policy.WATCHDOG, generator.trial.review.policy.START], 'nonce': meta['commit_nonce']}
    from unittest.mock import patch
    with patch.object(generator.trial.review.staging.offline, 'read_json', return_value=(commit, 'unused')):
        generator.trial.intent_and_ram(reader, Path('synthetic-in-memory-only'), plan, packet['plan_sha256'], receipt,
            tuple(map(int, started['start']['stamp'])), ram['uploaded']['ram_root_identity'], packet['context']['api_identity']['node_name'])
    assert reader.index == len(subset)
    return {'packet': packet, 'ram': ram, 'started': started, 'layout': layout,
            'commands': {r['key']: r['command'] for r in rows}, 'reads': {r['key']: r['reply'] for r in rows},
            'return_commands': {r['key']: r['command'] for r in returned}, 'return_reads': {r['key']: r['reply'] for r in returned}}

if sys.argv[1:] == ['--stdin']:
    v = json.loads(sys.stdin.buffer.read(1024 * 1024))
    assert set(v) == {'packet', 'ram', 'started', 'layout'}
    result = vector(v, v['layout'])
else:
    assert not sys.argv[1:]
    result = [vector(v, layout) for v in process_vectors for layout in ('empty', 'prefs_empty', 'prefs_file')]
print(json.dumps(result))
