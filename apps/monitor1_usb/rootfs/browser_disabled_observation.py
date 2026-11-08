"""Shared strict private disabled-scope DTO; no SDK/device side effects."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent


class ObservationRefusal(ValueError):
    """Finite invalid evidence category, never a raw private detail."""


def validate_scope(value, meta, reader):
    """Strict observation DTO, not a replacement for the frozen SDK policy."""
    keys = {'kind', 'target', 'plan_id', 'plan_sha256', 'stage_intent_sha256', 'root_identity', 'install_marker',
            'root_mode', 'root_uid', 'disabled_flags', 'source_hashes', 'vendor_hashes', 'stock_process', 'watchdog_process',
            'own_code_running', 'pm_helper_loaded', 'data_available_bytes', 'same_filesystem', 'staged_files', 'commit_nonce'}
    desc = meta['descriptor']
    nonce = meta['commit_nonce']
    if nonce is not None and (not isinstance(nonce, str) or not re.fullmatch('[a-f0-9]{32}', nonce)):
        raise ObservationRefusal
    if (not isinstance(value, dict) or set(value) != keys or value['kind'] != 'browser_disabled_scope' or
            value['target'] != meta['target'] or not isinstance(value['target'], dict) or type(value['target'].get('co2_type')) is not int or
            value['plan_id'] != desc['plan_id'] or value['plan_sha256'] != desc['plan_sha256'] or
            value['stage_intent_sha256'] != desc['intent_sha256'] or value['commit_nonce'] != nonce or
            value['install_marker'] != desc['plan_id'] + ' ' + desc['plan_sha256'] or value['staged_files'] != desc['files'] or
            any(type(pin['size']) is not int for pin in value['staged_files'].values()) or
            type(value['root_mode']) is not int or value['root_mode'] != 0o700 or type(value['root_uid']) is not int or value['root_uid'] != 0 or
            any(value[key] is not False for key in ('own_code_running', 'pm_helper_loaded')) or value['same_filesystem'] is not True or
            type(value['data_available_bytes']) is not int or not 8 * 1024**2 <= value['data_available_bytes'] < 2**53):
        raise ObservationRefusal
    ids = value['root_identity']
    if not isinstance(ids, list) or len(ids) != 2 or any(type(v) is not int or not 0 < v < 2**53 for v in ids):
        raise ObservationRefusal
    flag = [hashlib.sha256(b'').hexdigest(), 0, 0o600, 0, 1, False]
    if (value['disabled_flags'] != [flag, flag] or
            any(type(item) is not int for f in value['disabled_flags'] for item in f[1:5]) or
            any(f[-1] is not False for f in value['disabled_flags'])):
        raise ObservationRefusal
    if value['source_hashes'] != [[key, item] for key, item in sorted(reader['sources'].items())]:
        raise ObservationRefusal
    pins = json.loads((ROOT / 'contract.json').read_bytes())['files']
    vendors = value['vendor_hashes']
    if (not isinstance(vendors, list) or len(vendors) != len(pins) or
            any(not isinstance(v, list) or len(v) != 2 or not all(isinstance(s, str) for s in v) for v in vendors) or
            len(dict(vendors)) != len(vendors) or set(dict(vendors)) != {v['path'] for v in pins}):
        raise ObservationRefusal
    for pin in pins:
        allowed = {pin['sha256']}
        if pin['path'] in reader['patched']:
            allowed.add(reader['patched'][pin['path']]['sha256'])
        if dict(vendors)[pin['path']] not in allowed:
            raise ObservationRefusal
    stock, watchdog = value['stock_process'], value['watchdog_process']
    if (not isinstance(stock, list) or len(stock) != 4 or not isinstance(watchdog, list) or len(watchdog) != 3 or
            any(type(v) is not int or not 1 < v <= 2147483647 for v in (stock[0], watchdog[0])) or stock[0] == watchdog[0] or
            any(type(v) is not int or not 0 < v < 2**53 for v in (stock[1], watchdog[1])) or
            stock[2] != next(v['sha256'] for v in pins if v['path'] == '/data/bin/SnowApp') or
            type(stock[3]) is not int or stock[3] != 0 or type(watchdog[2]) is not int or watchdog[2] != 0):
        raise ObservationRefusal



def policy_input(job_id, plan_sha256, channel_id, channel_nonce, scope):
    """Canonical private-pipe input; no executable/path/key or device action."""
    value = {'schema_version': 1, 'job_id': job_id, 'plan_sha256': plan_sha256,
             'channel_id': channel_id, 'channel_nonce': channel_nonce, 'scope': scope}
    return (json.dumps(value, sort_keys=True, separators=(',', ':')) + '\n').encode()


def validate_assessment(value, job_id, plan_sha256, source_commit, raw):
    """A child result belongs to these exact bytes, never cached live authority."""
    fields = {'schema_version', 'job_id', 'plan_sha256', 'observation_sha256', 'source_commit', 'sdk_policy_checked',
              'commit_admissible_for_review', 'state', 'device_writes', 'writer_enabled', 'installation_ready', 'live_recheck_required'}
    if (not isinstance(value, dict) or set(value) != fields or type(value['schema_version']) is not int or value['schema_version'] != 1 or
            value['job_id'] != job_id or value['plan_sha256'] != plan_sha256 or
            value['observation_sha256'] != hashlib.sha256(raw).hexdigest() or value['source_commit'] != source_commit or
            value['sdk_policy_checked'] is not True or type(value['commit_admissible_for_review']) is not bool or
            value['state'] != ('factory_commit_admissible_for_review' if value['commit_admissible_for_review'] else 'known_scope_not_admissible') or
            type(value['device_writes']) is not int or value['device_writes'] != 0 or
            value['writer_enabled'] is not False or value['installation_ready'] is not False or value['live_recheck_required'] is not True):
        raise ObservationRefusal
