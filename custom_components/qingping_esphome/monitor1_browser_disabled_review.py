"""Private terminal-stage -> live selected browser scope join; no writer.

The actor rehashes the owned plan and terminal stage. The registry retains the
actual current channel through its fixed collector and close ACK. A returned
observation is not SDK-policy qualification, a commit intent or native USB.
No HTTP initiator is registered by this module.
"""
import hashlib
from pathlib import Path
import json
import re

from .monitor1_browser_stage import document, ROLES, SOURCE
from .monitor1_browser_relay import RelayRefusal

ROOT = Path(__file__).parent / 'monitor1_worker'


def context(result, data):
    value = document(result)
    keys = {'schema_version', 'job_id', 'plan_sha256', 'source_commit', 'stage_state', 'meta',
            'reader_source_sha256', 'sdk_policy_checked', 'writer_enabled'}
    if (set(value) != keys or type(value['schema_version']) is not int or value['schema_version'] != 1 or
            value['job_id'] != data['job_id'] or value['plan_sha256'] != data['expected_plan_sha256'] or
            value['source_commit'] != SOURCE or value['stage_state'] != 'staged_disabled_verified' or
            value['sdk_policy_checked'] is not False or value['writer_enabled'] is not False):
        raise RelayRefusal
    reader = json.loads((ROOT / 'disabled-contract.json').read_bytes())
    if value['reader_source_sha256'] != reader['source_sha256']:
        raise RelayRefusal
    meta = value['meta']
    if (not isinstance(meta, dict) or set(meta) != {'schema_version', 'job_id', 'target', 'descriptor', 'commit_nonce'} or
            type(meta['schema_version']) is not int or meta['schema_version'] != 1 or meta['job_id'] != data['job_id'] or
            meta['commit_nonce'] is not None):
        raise RelayRefusal
    desc = meta['descriptor']
    if (not isinstance(desc, dict) or set(desc) != {'plan_id', 'plan_sha256', 'intent_sha256', 'files'} or
            not isinstance(desc['plan_id'], str) or not re.fullmatch('[a-f0-9]{32}', desc['plan_id']) or
            desc['plan_sha256'] != data['expected_plan_sha256'] or not isinstance(desc['intent_sha256'], str) or
            not re.fullmatch('[a-f0-9]{64}', desc['intent_sha256']) or not isinstance(desc['files'], dict) or set(desc['files']) != set(ROLES)):
        raise RelayRefusal
    total = 0
    for pin in desc['files'].values():
        if (not isinstance(pin, dict) or set(pin) != {'size', 'sha256'} or type(pin['size']) is not int or
                not 0 < pin['size'] <= 16 * 1024**2 or not isinstance(pin['sha256'], str) or not re.fullmatch('[a-f0-9]{64}', pin['sha256'])):
            raise RelayRefusal
        total += pin['size']
    if total > 32 * 1024**2 or any(desc['files'][role]['sha256'] != digest for role, digest in reader['sources'].items()):
        raise RelayRefusal
    return value, reader


def validate_scope(value, meta, reader):
    """Strict observation DTO, not a replacement for the frozen SDK policy."""
    keys = {'kind', 'target', 'plan_id', 'plan_sha256', 'stage_intent_sha256', 'root_identity', 'install_marker',
            'root_mode', 'root_uid', 'disabled_flags', 'source_hashes', 'vendor_hashes', 'stock_process', 'watchdog_process',
            'own_code_running', 'pm_helper_loaded', 'data_available_bytes', 'same_filesystem', 'staged_files', 'commit_nonce'}
    desc = meta['descriptor']
    if (not isinstance(value, dict) or set(value) != keys or value['kind'] != 'browser_disabled_scope' or
            value['target'] != meta['target'] or not isinstance(value['target'], dict) or type(value['target'].get('co2_type')) is not int or
            value['plan_id'] != desc['plan_id'] or value['plan_sha256'] != desc['plan_sha256'] or
            value['stage_intent_sha256'] != desc['intent_sha256'] or value['commit_nonce'] is not None or
            value['install_marker'] != desc['plan_id'] + ' ' + desc['plan_sha256'] or value['staged_files'] != desc['files'] or
            any(type(pin['size']) is not int for pin in value['staged_files'].values()) or
            type(value['root_mode']) is not int or value['root_mode'] != 0o700 or type(value['root_uid']) is not int or value['root_uid'] != 0 or
            any(value[key] is not False for key in ('own_code_running', 'pm_helper_loaded')) or value['same_filesystem'] is not True or
            type(value['data_available_bytes']) is not int or not 8 * 1024**2 <= value['data_available_bytes'] < 2**53):
        raise RelayRefusal
    ids = value['root_identity']
    if not isinstance(ids, list) or len(ids) != 2 or any(type(v) is not int or not 0 < v < 2**53 for v in ids):
        raise RelayRefusal
    flag = [hashlib.sha256(b'').hexdigest(), 0, 0o600, 0, 1, False]
    if (value['disabled_flags'] != [flag, flag] or
            any(type(item) is not int for f in value['disabled_flags'] for item in f[1:5]) or
            any(f[-1] is not False for f in value['disabled_flags'])):
        raise RelayRefusal
    if value['source_hashes'] != [[key, item] for key, item in sorted(reader['sources'].items())]:
        raise RelayRefusal
    pins = json.loads((ROOT / 'contract.json').read_bytes())['files']
    vendors = value['vendor_hashes']
    if (not isinstance(vendors, list) or len(vendors) != len(pins) or
            any(not isinstance(v, list) or len(v) != 2 or not all(isinstance(s, str) for s in v) for v in vendors) or
            len(dict(vendors)) != len(vendors) or set(dict(vendors)) != {v['path'] for v in pins}):
        raise RelayRefusal
    for pin in pins:
        allowed = {pin['sha256']}
        if pin['path'] in reader['patched']:
            allowed.add(reader['patched'][pin['path']]['sha256'])
        if dict(vendors)[pin['path']] not in allowed:
            raise RelayRefusal
    stock, watchdog = value['stock_process'], value['watchdog_process']
    if (not isinstance(stock, list) or len(stock) != 4 or not isinstance(watchdog, list) or len(watchdog) != 3 or
            any(type(v) is not int or not 1 < v <= 2147483647 for v in (stock[0], watchdog[0])) or stock[0] == watchdog[0] or
            any(type(v) is not int or not 0 < v < 2**53 for v in (stock[1], watchdog[1])) or
            stock[2] != next(v['sha256'] for v in pins if v['path'] == '/data/bin/SnowApp') or
            type(stock[3]) is not int or stock[3] != 0 or type(watchdog[2]) is not int or watchdog[2] != 0):
        raise RelayRefusal


async def review(service, owner, nonce, data):
    keys = {'job_id', 'expected_plan_sha256', 'channel_id'}
    if (not isinstance(data, dict) or set(data) != keys or any(not isinstance(data[k], str) for k in keys) or
            not re.fullmatch('[a-f0-9]{32}', data['job_id']) or not re.fullmatch('[a-f0-9]{32}', data['channel_id']) or
            not re.fullmatch('[a-f0-9]{64}', data['expected_plan_sha256']) or service.browser_registry is None):
        raise RelayRefusal
    registry = service.browser_registry
    cap = registry.capability(owner, nonce, data['channel_id'])
    original = registry.current
    try:
        checked, reader = context(await service.exchange(owner, nonce, 'internal-browser-disabled-context',
            {'job_id': data['job_id'], 'expected_plan_sha256': data['expected_plan_sha256']}), data)
        observed = await registry.disabled_scope(owner, nonce, data['channel_id'], checked['meta'])
        validate_scope(observed, checked['meta'], reader)
        if registry.current is not original or registry.capability(owner, nonce, data['channel_id']) is not cap or cap.closed or cap.failed:
            raise RelayRefusal
        await cap.close()
        if (registry.current is not original or registry.capability(owner, nonce, data['channel_id']) is not cap or not cap.closed or cap.failed):
            raise RelayRefusal
    except BaseException:
        try:
            await cap.close()
        except BaseException:
            pass
        raise RelayRefusal from None
    return {'job_id': data['job_id'], 'plan_sha256': data['expected_plan_sha256'], 'state': 'browser_disabled_scope_observed',
            'hardware_contacted': True, 'device_writes': 0, 'sdk_policy_checked': False,
            'installed': False, 'installation_ready': False, 'writer_enabled': False, 'native_get_devpath': False}
