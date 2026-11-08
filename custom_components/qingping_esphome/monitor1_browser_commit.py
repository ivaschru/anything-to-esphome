"""Private consumed disabled-commit composition; no public initiating route.

Only the current owner/page-bound registry supplies the selected handle. Fixed
raw-stdin support and a fresh complete scope precede actor intent consumption.
Thereafter every phase has its own consumed frame, independent full readback and
original-deadline check. Lost IO never retries, rolls back or records success.
"""
import hashlib
from pathlib import Path
import re

from .monitor1_browser_relay import RelayRefusal
from .monitor1_browser_stage import document
from .monitor1_browser_disabled_review import context, validate_scope
from .monitor1_worker.browser_disabled_observation import validate_commit_observations

ROOT = Path(__file__).parent / 'monitor1_worker'
PHASES = ('claim', 'watchdog', 'start')


def packet(result, checked, observed, channel_id, channel_nonce):
    value = document(result, limit=32768)
    fields = {'schema_version', 'job_id', 'plan_sha256', 'intent_sha256', 'channel_id', 'channel_nonce', 'nonce',
              'source_commit', 'meta', 'initial_scope', 'producer_sha256'}
    producer = {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
                for name in ('browser_commit.py', 'disabled-write-contract.json')}
    if (set(value) != fields or type(value['schema_version']) is not int or value['schema_version'] != 1 or
            any(value[key] != checked[key] for key in ('job_id', 'plan_sha256', 'source_commit', 'meta')) or
            value['initial_scope'] != observed or value['channel_id'] != channel_id or value['channel_nonce'] != channel_nonce or
            value['producer_sha256'] != producer or not isinstance(value['nonce'], str) or not re.fullmatch('[a-f0-9]{32}', value['nonce']) or
            not isinstance(value['intent_sha256'], str) or not re.fullmatch('[a-f0-9]{64}', value['intent_sha256'])):
        raise RelayRefusal
    return value


def proof(value, prepared, prefix, reader):
    fields = {'schema_version', 'job_id', 'plan_sha256', 'intent_sha256', 'channel_id', 'channel_nonce', 'nonce',
              'commands_acknowledged', 'observations', 'transport_closed', 'program_started', 'boot_flags_changed'}
    if (not isinstance(value, dict) or set(value) != fields or type(value['schema_version']) is not int or value['schema_version'] != 1 or
            any(value[key] != prepared[key] for key in ('job_id', 'plan_sha256', 'intent_sha256', 'channel_id', 'channel_nonce', 'nonce')) or
            value['commands_acknowledged'] != list(PHASES) or value['transport_closed'] is not True or
            value['program_started'] is not False or value['boot_flags_changed'] is not False or
            not isinstance(value['observations'], list) or len(value['observations']) != 3):
        raise RelayRefusal
    meta = {**prepared['meta'], 'commit_nonce': prepared['nonce']}
    validate_commit_observations(value['observations'], prepared['initial_scope'], meta, reader)
    # The last scope is deliberately collected again just before USB close;
    # only its measured free bytes may differ from the third step's readback.
    if (value['observations'][:2] != prefix[:2] or
            {k: v for k, v in value['observations'][2].items() if k != 'data_available_bytes'} !=
            {k: v for k, v in prefix[2].items() if k != 'data_available_bytes'}):
        raise RelayRefusal


async def commit(service, owner, nonce, data):
    fields = {'job_id', 'expected_plan_sha256', 'channel_id', 'experimental_reviewed'}
    if (not isinstance(data, dict) or set(data) != fields or data['experimental_reviewed'] is not True or
            any(not isinstance(data[k], str) for k in fields - {'experimental_reviewed'}) or
            not re.fullmatch('[a-f0-9]{32}', data['job_id']) or not re.fullmatch('[a-f0-9]{32}', data['channel_id']) or
            not re.fullmatch('[a-f0-9]{64}', data['expected_plan_sha256']) or service.browser_registry is None):
        raise RelayRefusal
    registry = service.browser_registry
    cap = registry.capability(owner, nonce, data['channel_id'])
    original = registry.current

    def live(closed=False):
        if (registry.current is not original or registry.capability(owner, nonce, data['channel_id']) is not cap or
                cap.failed or cap.closed is not closed):
            raise RelayRefusal

    try:
        live()
        checked, reader = context(await service.exchange(owner, nonce, 'internal-browser-disabled-context',
            {key: data[key] for key in ('job_id', 'expected_plan_sha256')}), data)
        # This probe sends only fixed harmless stdin, before consuming a write
        # intent. Unsupported old-daemon exec never falls back to PTY/shell-v2.
        await cap.probe_commit_stream()
        live()
        observed = await registry.disabled_scope(owner, nonce, data['channel_id'], checked['meta'])
        validate_scope(observed, checked['meta'], reader)
        live()
        channel_nonce = original['reported_evidence']['channel']
        prepared = packet(await service.exchange(owner, nonce, 'internal-browser-commit-prepare',
            {'job_id': data['job_id'], 'expected_plan_sha256': data['expected_plan_sha256'], 'experimental_reviewed': True,
             'scope': {'channel_id': data['channel_id'], 'channel_nonce': channel_nonce, 'observation': observed}}),
            checked, observed, data['channel_id'], channel_nonce)
        live()
        await cap.begin_commit(prepared)
        prefix = []
        meta = {**prepared['meta'], 'commit_nonce': prepared['nonce']}
        for phase in PHASES:
            live()
            prefix.append(await cap.commit_step(phase))
            live()
            validate_commit_observations(prefix, observed, meta, reader)
        result = await cap.finish_commit()
        proof(result, prepared, prefix, reader)
        live()
        # Actual selected USB close and a separate original-channel close ACK
        # are required before the actor can release its retained kernel lease.
        await cap.close()
        live(closed=True)
        value = document(await service.exchange(owner, nonce, 'internal-browser-commit-record',
            {'job_id': data['job_id'], 'intent_sha256': prepared['intent_sha256'], 'proof': result}))
        expected = {'job_id', 'state', 'replay_allowed', 'installed', 'installation_ready', 'writer_enabled',
                    'activated', 'device_write_attempted', 'live_recheck_required'}
        if (set(value) != expected or value['job_id'] != data['job_id'] or value['state'] != 'committed_disabled_verified' or
                any(value[k] is not False for k in ('replay_allowed', 'installed', 'installation_ready', 'writer_enabled', 'activated')) or
                value['device_write_attempted'] is not True or value['live_recheck_required'] is not True):
            raise RelayRefusal
        return value
    except BaseException:
        try:
            await cap.close()
        except BaseException:
            pass
        raise RelayRefusal from None
