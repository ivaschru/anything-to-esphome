"""Private original-commit/guardian/live resource join; never a trial writer.

An existing admitted SDK checks the exact separate guardian artifact before
and after a selected-channel read. Two complete committed scopes and positive
resource observations remain distinct from RAM allocation, device FD admission
and a future consumed trial intent. No public HTTP/UI initiator is registered.
"""
import json
from pathlib import Path
import re

from .monitor1_browser_stage import document, ROLES, SOURCE
from .monitor1_browser_disabled_review import validate_scope
from .monitor1_browser_relay import RelayRefusal
from .monitor1_worker.browser_initial_observation import validate_preparation as check_preparation, ObservationRefusal

ROOT = Path(__file__).parent / 'monitor1_worker'
HEX = re.compile('[a-f0-9]{64}')


def context(result, data):
    value = document(result)
    fields = {'schema_version', 'job_id', 'plan_sha256', 'source_commit', 'commit_intent_sha256',
              'commit_proof_sha256', 'candidate_sha256', 'guardian', 'meta', 'committed_scope', 'context_only',
              'guardian_artifact_checked', 'image_fd_admitted', 'hardware_contacted', 'device_writes',
              'writer_enabled', 'installation_ready', 'live_recheck_required'}
    if (set(value) != fields or type(value['schema_version']) is not int or value['schema_version'] != 1 or
            value['job_id'] != data['job_id'] or value['plan_sha256'] != data['expected_plan_sha256'] or
            value['source_commit'] != SOURCE or any(value[k] is not True for k in
                ('context_only', 'guardian_artifact_checked', 'live_recheck_required')) or
            any(value[k] is not False for k in ('image_fd_admitted', 'hardware_contacted', 'writer_enabled', 'installation_ready')) or
            type(value['device_writes']) is not int or value['device_writes'] != 0 or
            any(not isinstance(value[k], str) or not HEX.fullmatch(value[k]) for k in
                ('commit_intent_sha256', 'commit_proof_sha256', 'candidate_sha256'))):
        raise RelayRefusal
    guardian = value['guardian']
    if (not isinstance(guardian, dict) or set(guardian) != {'size', 'sha256'} or type(guardian['size']) is not int or
            not 52 <= guardian['size'] <= 16 * 1024**2 or not isinstance(guardian['sha256'], str) or not HEX.fullmatch(guardian['sha256'])):
        raise RelayRefusal
    meta = value['meta']
    if (not isinstance(meta, dict) or set(meta) != {'schema_version', 'job_id', 'target', 'descriptor', 'commit_nonce'} or
            type(meta['schema_version']) is not int or meta['schema_version'] != 1 or meta['job_id'] != data['job_id'] or
            not isinstance(meta['commit_nonce'], str) or not re.fullmatch('[a-f0-9]{32}', meta['commit_nonce'])):
        raise RelayRefusal
    desc = meta['descriptor']
    if (not isinstance(desc, dict) or set(desc) != {'plan_id', 'plan_sha256', 'intent_sha256', 'files'} or
            not isinstance(desc['plan_id'], str) or not re.fullmatch('[a-f0-9]{32}', desc['plan_id']) or
            desc['plan_sha256'] != data['expected_plan_sha256'] or not isinstance(desc['intent_sha256'], str) or not HEX.fullmatch(desc['intent_sha256']) or
            not isinstance(desc['files'], dict) or set(desc['files']) != set(ROLES)):
        raise RelayRefusal
    total = 0
    for pin in desc['files'].values():
        if (not isinstance(pin, dict) or set(pin) != {'size', 'sha256'} or type(pin['size']) is not int or
                not 0 < pin['size'] <= 16 * 1024**2 or not isinstance(pin['sha256'], str) or not HEX.fullmatch(pin['sha256'])):
            raise RelayRefusal
        total += pin['size']
    reader = json.loads((ROOT / 'disabled-contract.json').read_bytes())
    if total > 32 * 1024**2 or any(desc['files'][role]['sha256'] != digest for role, digest in reader['sources'].items()):
        raise RelayRefusal
    validate_scope(value['committed_scope'], meta, reader)
    committed = dict(value['committed_scope']['vendor_hashes'])
    if any(committed.get(path) != pin['sha256'] for path, pin in reader['patched'].items()):
        raise RelayRefusal
    return value, reader


def validate_preparation(value, meta, reader, committed=None):
    try:
        check_preparation(value, meta, reader, committed)
    except ObservationRefusal:
        raise RelayRefusal from None


async def review(service, owner, nonce, data):
    fields = {'job_id', 'expected_plan_sha256', 'channel_id'}
    if (not isinstance(data, dict) or set(data) != fields or any(not isinstance(data[k], str) for k in fields) or
            not re.fullmatch('[a-f0-9]{32}', data['job_id']) or not re.fullmatch('[a-f0-9]{32}', data['channel_id']) or
            not HEX.fullmatch(data['expected_plan_sha256']) or service.browser_registry is None):
        raise RelayRefusal
    registry = service.browser_registry
    cap = registry.capability(owner, nonce, data['channel_id'])
    original = registry.current
    if cap.closed or cap.failed:
        raise RelayRefusal
    def live(closed=False):
        if (registry.current is not original or registry.capability(owner, nonce, data['channel_id']) is not cap or
                cap.failed or cap.closed is not closed):
            raise RelayRefusal
    request = {k: data[k] for k in ('job_id', 'expected_plan_sha256')}
    try:
        checked, reader = context(await service.exchange(owner, nonce, 'internal-browser-initial-trial-context', request), data)
        live()
        observed = await registry.initial_trial_preparation(owner, nonce, data['channel_id'], checked['meta'])
        validate_preparation(observed, checked['meta'], reader, checked['committed_scope'])
        live()
        # Rehash the same terminal proof/candidate/artifact after device IO.
        # A changed file or expired registry does not renew this observation.
        after, _ = context(await service.exchange(owner, nonce, 'internal-browser-initial-trial-context', request), data)
        if after != checked:
            raise RelayRefusal
        live()
        await cap.close()
        live(closed=True)
    except BaseException:
        try:
            await cap.close()
        except BaseException:
            pass
        raise RelayRefusal from None
    return {'job_id': data['job_id'], 'plan_sha256': data['expected_plan_sha256'],
            'state': 'browser_initial_trial_preparation_observed', 'guardian_artifact_checked': True,
            'hardware_contacted': True, 'device_writes': 0, 'ram_scope_checked': False,
            'image_fd_admitted': False, 'execution_authority': False, 'installed': False,
            'installation_ready': False, 'writer_enabled': False, 'live_recheck_required': True}
