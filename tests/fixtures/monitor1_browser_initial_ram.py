"""Synthetic text parity only; no SDK, USB, shell execution or real identity."""
from contextlib import redirect_stdout
from copy import deepcopy
import importlib.util
import io
import json
from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parents[2]
with redirect_stdout(io.StringIO()):
    baseline = runpy.run_path(str(ROOT / 'tests/fixtures/monitor1_browser_commands.py'))
spec = importlib.util.spec_from_file_location('ram_commands', ROOT / 'tools/monitor1-usb/generate_initial_ram_commands.py')
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)
reader, commit = baseline['reader'], baseline['commit']
result = []
for vector in baseline['vectors']:
    if vector['phase'] != 'start':
        continue
    meta, scope = deepcopy(vector['meta']), deepcopy(vector['scope'])
    for pair in scope['vendor_hashes']:
        if pair[0] in reader['patched']:
            pair[1] = reader['patched'][pair[0]]['sha256']
    preparation = {'kind': 'browser_initial_trial_preparation', 'scope': scope, 'ram_available_bytes': 48 * 1024**2,
                   'memory_basis': 'MemFree_lower_bound', 'persistent_stores_absent': True, 'ram_processes_absent': True,
                   'api_ota_listeners_free': True, 'ram_scope_checked': False, 'image_fd_admitted': False,
                   'execution_authority': False, 'device_writes': 0}
    guardian = {'size': 8388608 if scope['root_identity'][0] > 1 else 52, 'sha256': '1' * 64}
    context = {'schema_version': 1, 'job_id': meta['job_id'], 'plan_sha256': scope['plan_sha256'],
               'source_commit': generator.specification()['source_commit'], 'commit_intent_sha256': '2' * 64,
               'commit_proof_sha256': '3' * 64, 'candidate_sha256': '4' * 64, 'guardian': guardian,
               'meta': meta, 'committed_scope': scope, 'context_only': True, 'guardian_artifact_checked': True,
               'image_fd_admitted': False, 'hardware_contacted': False, 'device_writes': 0,
               'writer_enabled': False, 'installation_ready': False, 'live_recheck_required': True}
    packet = {'schema_version': 1, 'job_id': meta['job_id'], 'plan_sha256': scope['plan_sha256'],
              'intent_sha256': '5' * 64, 'channel_id': '6' * 32, 'channel_nonce': '77777777-7777-7777-7777-777777777777',
              'nonce': '8' * 32, 'ram_job_id': '9' * 32, 'guardian_job_id': 'a' * 32,
              'context': context, 'preparation': preparation,
              'producer_sha256': {name: 'b' * 64 for name in generator.PRODUCERS}}
    values = {'plan_id': scope['plan_id'], 'plan_sha256': scope['plan_sha256'],
              'root_device': str(scope['root_identity'][0]), 'root_inode': str(scope['root_identity'][1]),
              'wlan_mac': meta['target']['wlan_mac'], 'co2_type': str(meta['target']['co2_type']),
              'boot_id': meta['target']['boot_id'], 'stock_pid': str(scope['stock_process'][0]),
              'stock_start': str(scope['stock_process'][1]), 'watchdog_pid': str(scope['watchdog_process'][0]),
              'watchdog_start': str(scope['watchdog_process'][1]), 'commit_nonce': meta['commit_nonce'],
              'ram_job_id': packet['ram_job_id'], 'guardian_job_id': packet['guardian_job_id'],
              'guardian_bytes': str(guardian['size'])}
    values.update({'staged_' + str(i): meta['descriptor']['files'][role]['sha256']
                   for i, role in enumerate(commit.staging.STAGED)})
    values.update({'vendor_' + str(i): pair[1] for i, pair in enumerate(scope['vendor_hashes'])})
    result.append({'packet': packet, 'preparation': preparation, 'expected': generator.commands(values)})
print(json.dumps(result))
