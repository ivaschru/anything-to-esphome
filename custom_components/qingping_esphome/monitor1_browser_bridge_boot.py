"""Private stopped-trial context/fresh selected-read join; no arming writer.

The actor validates durable history/source. The registry and selected browser
independently bind current owner/page/target/deadline and positive root reads.
Neither half alone grants an arming intent or a native USB/trial receipt.
"""
import hashlib
import asyncio
import json
from pathlib import Path
import re

from .monitor1_browser_stage import document, ROLES, SOURCE
from .monitor1_browser_disabled_review import validate_scope
from .monitor1_browser_initial_review import validate_preparation
from .monitor1_browser_relay import RelayRefusal
from .monitor1_browser_initial_ram import actor_live, same
from .monitor1_worker.browser_bridge_boot_observation import completion_pin, validate_armed

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


def packet(result, checked, observed, channel, channel_nonce):
    value = document(result, limit=65536)
    fields = {'schema_version', 'job_id', 'plan_sha256', 'intent_sha256', 'channel_id', 'channel_nonce',
              'nonce', 'context', 'preparation', 'producer_sha256'}
    producers = {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in
                 ('browser_bridge_boot_journal.py', 'browser_bridge_boot_observation.py', 'browser_bridge_boot.py', 'bridge-next-boot-contract.json')}
    if (set(value) != fields or type(value['schema_version']) is not int or value['schema_version'] != 1 or
            value['job_id'] != checked['job_id'] or value['plan_sha256'] != checked['plan_sha256'] or
            value['channel_id'] != channel or value['channel_nonce'] != channel_nonce or
            not same(value['context'], checked) or not same(value['preparation'], observed) or value['producer_sha256'] != producers or
            not isinstance(value['nonce'], str) or not ID.fullmatch(value['nonce']) or value['nonce'] == checked['meta']['commit_nonce'] or
            not isinstance(value['intent_sha256'], str) or not HEX.fullmatch(value['intent_sha256'])):
        raise RelayRefusal
    return value


def terminal(value, prepared, *, channel_closed):
    bindings = ('job_id', 'plan_sha256', 'intent_sha256', 'channel_id', 'channel_nonce', 'nonce')
    fields = {'schema_version', *bindings, 'commands_acknowledged', 'armed_scope',
              'transport_closed', 'channel_closed', 'program_started', 'autostart_armed', 'pm_disabled'}
    if (not isinstance(value, dict) or set(value) != fields or type(value['schema_version']) is not int or value['schema_version'] != 1 or
            any(value[k] != prepared[k] for k in bindings) or value['commands_acknowledged'] != ['before', 'arm', 'armed', 'complete'] or
            any(value[k] is not True for k in ('transport_closed', 'autostart_armed', 'pm_disabled')) or
            value['program_started'] is not False or value['channel_closed'] is not channel_closed):
        raise RelayRefusal
    try:
        validate_armed(value['armed_scope'], prepared['preparation']['preparation']['scope'],
                       completion_pin(prepared['context']['meta'], prepared['nonce']))
    except ValueError:
        raise RelayRefusal from None


async def arm(service, owner, nonce, data):
    """One private original-operation flag transition, with no public initiator.

    Probe and fresh stopped scope precede durable actor consumption. All later
    frames are fixed and consumed once; exact explicit armed readback and both
    closes precede terminal persistence/release. No reboot, process signal,
    native receipt substitution, implicit retry or automatic rollback follows.
    """
    fields = {'job_id', 'expected_plan_sha256', 'channel_id', 'experimental_reviewed'}
    if (not isinstance(data, dict) or set(data) != fields or data['experimental_reviewed'] is not True or
            any(not isinstance(data[k], str) for k in fields - {'experimental_reviewed'}) or
            not ID.fullmatch(data['job_id']) or not ID.fullmatch(data['channel_id']) or
            not HEX.fullmatch(data['expected_plan_sha256']) or service.browser_registry is None):
        raise RelayRefusal
    registry = service.browser_registry
    cap, current = registry.capability(owner, nonce, data['channel_id']), registry.current
    actor, operation = getattr(service, 'process', None), asyncio.current_task()
    actor_live(service, actor, operation)  # A foreign/new task must cause no channel IO or cleanup.
    def live(closed=False):
        actor_live(service, actor, operation)
        if (registry.current is not current or registry.capability(owner, nonce, data['channel_id']) is not cap or
                cap.failed or cap.closed is not closed):
            raise RelayRefusal
    request = {k: data[k] for k in ('job_id', 'expected_plan_sha256')}
    try:
        live()
        checked, reader = context(await service.exchange(owner, nonce, 'internal-browser-bridge-boot-context', request), data)
        live()
        await cap.probe_bridge_boot_stream()  # Harmless fixed exec, no PTY/fallback, BEFORE intent consumption.
        live()
        observed = await registry.bridge_boot_preparation(owner, nonce, data['channel_id'], checked['meta'], checked['trial_marker'])
        observation(observed, checked, reader)
        live()
        prepared = packet(await service.exchange(owner, nonce, 'internal-browser-bridge-boot-prepare',
            {**request, 'experimental_reviewed': True, 'scope': {'channel_id': data['channel_id'],
             'channel_nonce': current['reported_evidence']['channel'], 'observation': observed}}),
            checked, observed, data['channel_id'], current['reported_evidence']['channel'])
        live()
        await cap.begin_bridge_boot(prepared)
        for phase in ('before', 'arm', 'armed', 'complete'):
            live(); await cap.bridge_boot_step(phase); live()
        value = await cap.finish_bridge_boot()
        live()
        terminal(value, prepared, channel_closed=False)
        await cap.close()  # Independent channel ACK after actual selected-USB close.
        live(closed=True)
        value = {**value, 'channel_closed': True}
        terminal(value, prepared, channel_closed=True)
        result = document(await service.exchange(owner, nonce, 'internal-browser-bridge-boot-record',
            {'job_id': data['job_id'], 'intent_sha256': prepared['intent_sha256'], 'proof': value}))
        live(closed=True)
        expected = {'job_id', 'state', 'replay_allowed', 'installed', 'activated', 'installation_ready',
                    'writer_enabled', 'live_recheck_required', 'autostart_armed'}
        if (set(result) != expected or result['job_id'] != data['job_id'] or result['state'] != 'bridge_autostart_armed_next_boot_unverified' or
                any(result[k] is not False for k in ('replay_allowed', 'installed', 'activated', 'installation_ready', 'writer_enabled')) or
                result['live_recheck_required'] is not True or result['autostart_armed'] is not True):
            raise RelayRefusal
        return result
    except BaseException:
        try:
            await cap.close()
        except BaseException:
            pass
        raise RelayRefusal from None
