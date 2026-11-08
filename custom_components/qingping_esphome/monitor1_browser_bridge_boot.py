"""Private stopped-trial context/fresh selected-read join; no arming writer.

The actor validates durable history/source. The registry and selected browser
independently bind current owner/page/target/deadline and positive root reads.
Neither half alone grants an arming intent or a native USB/trial receipt.
"""
import hashlib
import json
from pathlib import Path
import re

from .monitor1_browser_stage import document, ROLES, SOURCE
from .monitor1_browser_disabled_review import validate_scope
from .monitor1_browser_initial_review import validate_preparation
from .monitor1_browser_relay import RelayRefusal

ROOT = Path(__file__).parent / 'monitor1_worker'
HEX = re.compile('[a-f0-9]{64}')
ID = re.compile('[a-f0-9]{32}')


def context(result, data):
    """Strict private metadata, with exact current packaged producer pins."""
    value = document(result)
    fields = {'schema_version', 'kind', 'job_id', 'plan_sha256', 'source_commit', 'trial_intent_sha256',
              'trial_proof_sha256', 'meta', 'committed_scope', 'trial_marker', 'producer_sha256',
              'context_only', 'writer_enabled', 'installed', 'installation_ready', 'device_writes', 'live_recheck_required'}
    if (set(value) != fields or type(value['schema_version']) is not int or value['schema_version'] != 1 or
            value['kind'] != 'browser_bridge_next_boot_context' or value['job_id'] != data['job_id'] or
            value['plan_sha256'] != data['expected_plan_sha256'] or value['source_commit'] != SOURCE or
            any(not isinstance(value[k], str) or not HEX.fullmatch(value[k]) for k in ('trial_intent_sha256', 'trial_proof_sha256')) or
            any(value[k] is not True for k in ('context_only', 'live_recheck_required')) or
            any(value[k] is not False for k in ('writer_enabled', 'installed', 'installation_ready')) or
            type(value['device_writes']) is not int or value['device_writes'] != 0):
        raise RelayRefusal
    expected = {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
                for name in ('browser_bridge_boot.py', 'bridge-next-boot-contract.json')}
    if value['producer_sha256'] != expected:
        raise RelayRefusal
    marker = value['trial_marker']
    if (not isinstance(marker, dict) or set(marker) != {'size', 'sha256'} or type(marker['size']) is not int or
            not 1 <= marker['size'] <= 4096 or not isinstance(marker['sha256'], str) or not HEX.fullmatch(marker['sha256'])):
        raise RelayRefusal
    meta = value['meta']
    if (not isinstance(meta, dict) or set(meta) != {'schema_version', 'job_id', 'target', 'descriptor', 'commit_nonce'} or
            type(meta['schema_version']) is not int or meta['schema_version'] != 1 or meta['job_id'] != data['job_id'] or
            not isinstance(meta['commit_nonce'], str) or not ID.fullmatch(meta['commit_nonce'])):
        raise RelayRefusal
    desc = meta['descriptor']
    if (not isinstance(desc, dict) or set(desc) != {'plan_id', 'plan_sha256', 'intent_sha256', 'files'} or
            not isinstance(desc['plan_id'], str) or not ID.fullmatch(desc['plan_id']) or
            desc['plan_sha256'] != data['expected_plan_sha256'] or
            not isinstance(desc['intent_sha256'], str) or not HEX.fullmatch(desc['intent_sha256']) or
            not isinstance(desc['files'], dict) or set(desc['files']) != set(ROLES)):
        raise RelayRefusal
    total = 0
    for pin in desc['files'].values():
        if (not isinstance(pin, dict) or set(pin) != {'size', 'sha256'} or type(pin['size']) is not int or
                not 0 < pin['size'] <= 16 * 1024**2 or not isinstance(pin['sha256'], str) or not HEX.fullmatch(pin['sha256'])):
            raise RelayRefusal
        total += pin['size']
    reader = json.loads((ROOT / 'disabled-contract.json').read_bytes())
    if total > 32 * 1024**2 or any(desc['files'][name]['sha256'] != digest for name, digest in reader['sources'].items()):
        raise RelayRefusal
    validate_scope(value['committed_scope'], meta, reader)
    vendors = dict(value['committed_scope']['vendor_hashes'])
    if any(vendors.get(path) != pin['sha256'] for path, pin in reader['patched'].items()):
        raise RelayRefusal
    return value, reader


def observation(value, checked, reader):
    """A claimed marker flag cannot replace the independent fixed collector."""
    if (not isinstance(value, dict) or set(value) != {'kind', 'preparation', 'trial_marker', 'trial_marker_checked', 'context_only'} or
            value['kind'] != 'browser_bridge_boot_preparation' or value['trial_marker_checked'] is not True or
            value['context_only'] is not True or
            json.dumps(value['trial_marker'], sort_keys=True) != json.dumps(checked['trial_marker'], sort_keys=True)):
        raise RelayRefusal
    validate_preparation(value['preparation'], checked['meta'], reader, checked['committed_scope'])


async def review(service, owner, nonce, data):
    """Read the stopped basis and fresh scope, then close the owned channel.

    This read-only review never acquires the writer lease, consumes an arming
    intent or returns a resumable live handle. A later writer must repeat its
    fresh admission in its own original reserved operation, never adopt JSON.
    """
    if (not isinstance(data, dict) or set(data) != {'job_id', 'expected_plan_sha256', 'channel_id'} or
            any(not isinstance(data[k], str) for k in data) or not ID.fullmatch(data['job_id']) or
            not ID.fullmatch(data['channel_id']) or not HEX.fullmatch(data['expected_plan_sha256']) or service.browser_registry is None):
        raise RelayRefusal
    registry = service.browser_registry
    cap, current = registry.capability(owner, nonce, data['channel_id']), registry.current
    def live(closed=False):
        if (registry.current is not current or registry.capability(owner, nonce, data['channel_id']) is not cap or
                cap.failed or cap.closed is not closed):
            raise RelayRefusal
    request = {k: data[k] for k in ('job_id', 'expected_plan_sha256')}
    try:
        live()
        checked, reader = context(await service.exchange(owner, nonce, 'internal-browser-bridge-boot-context', request), data)
        live()
        value = await registry.bridge_boot_preparation(owner, nonce, data['channel_id'], checked['meta'], checked['trial_marker'])
        live()
        observation(value, checked, reader)
        after, _ = context(await service.exchange(owner, nonce, 'internal-browser-bridge-boot-context', request), data)
        if json.dumps(after, sort_keys=True) != json.dumps(checked, sort_keys=True):
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
    return {'job_id': data['job_id'], 'state': 'browser_bridge_boot_preparation_observed',
            'hardware_contacted': True, 'device_writes': 0, 'writer_enabled': False,
            'installed': False, 'installation_ready': False, 'live_recheck_required': True}
