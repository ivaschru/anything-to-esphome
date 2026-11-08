"""Private terminal-stage -> live selected browser scope join; no writer.

The actor rehashes the owned plan and terminal stage. The registry retains the
actual current channel through its fixed collector and close ACK. A returned
analysis is not a commit intent, cached writer authority or native USB.
No HTTP initiator is registered by this module.
"""
from pathlib import Path
import json
import re

from .monitor1_browser_stage import document, ROLES, SOURCE
from .monitor1_browser_relay import RelayRefusal

from .monitor1_worker.browser_disabled_observation import policy_input, validate_assessment

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
    # Share the same strict DTO with the isolated SDK policy child. This
    # wrapper keeps this parent module's finite public exception category.
    from .monitor1_worker.browser_disabled_observation import validate_scope as check, ObservationRefusal
    try:
        check(value, meta, reader)
    except ObservationRefusal:
        raise RelayRefusal from None


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
        # Bind the fixed read to the original registry channel, never a caller
        # nonce. The trusted SDK only constructs the pure transaction; no
        # issue/ack, command, write intent or device operation runs in it.
        channel_nonce = original['reported_evidence']['channel']
        raw = policy_input(data['job_id'], data['expected_plan_sha256'], data['channel_id'], channel_nonce, observed)
        assessment = document(await service.exchange(owner, nonce, 'internal-browser-disabled-assess',
            {**data, 'channel_nonce': channel_nonce, 'scope': observed}))
        validate_assessment(assessment, data['job_id'], data['expected_plan_sha256'], checked['source_commit'], raw)
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
    return {'job_id': data['job_id'], 'plan_sha256': data['expected_plan_sha256'], 'state': 'browser_disabled_policy_assessed',
            'hardware_contacted': True, 'device_writes': 0, 'sdk_policy_checked': True, 'commit_admissible_for_review': assessment['commit_admissible_for_review'],
            'live_recheck_required': True, 'installed': False, 'installation_ready': False, 'writer_enabled': False, 'native_get_devpath': False}
