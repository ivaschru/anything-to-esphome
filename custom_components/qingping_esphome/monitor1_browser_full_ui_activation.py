"""Core join for a separately reviewed permanent Full UI transition.

No public route is wired by this module. Reuse the unchanged inner API engine;
never turn the browser selection into a fake native forward or receipt.
"""
import asyncio
import hashlib
import re
import time

from .monitor1_browser_full_ui import FullUiObservation, FullUiRelay, prepare, key, client_factory, ROOT
from .monitor1_browser_stage import document
from .monitor1_browser_initial_ram import same
from .monitor1_browser_initial_noise import _idle
from .monitor1_browser_relay import RelayRefusal
from .monitor1_worker.full_ui_activation import run, returned_pair, capacity
from .monitor1_worker.full_ui_trial import rpc, services_named

PRODUCERS = ('browser_full_ui_activation.py', 'browser_full_ui_trial.py', 'browser_full_ui_context.py', 'full_ui_activation.py')


def activation_context(result, o):
    c = document(result, limit=32768)
    fields = {'schema_version', 'kind', 'job_id', 'plan_sha256', 'full_ui', 'trial_intent_sha256', 'trial_proof_sha256',
              'trial_job', 'boot_id', 'producer_sha256', 'context_only', 'writer_enabled', 'device_writes'}
    if (set(c) != fields or type(c['schema_version']) is not int or c['schema_version'] != 1 or
            c['kind'] != 'browser_full_ui_activation_context' or c['job_id'] != o.data['job_id'] or
            c['plan_sha256'] != o.data['expected_plan_sha256'] or not same(c['full_ui'], o.checked) or
            c['boot_id'] != o.target['boot_id'] or c['context_only'] is not True or c['writer_enabled'] is not False or
            type(c['device_writes']) is not int or c['device_writes'] != 0 or
            any(not isinstance(c[k], str) or not re.fullmatch('[a-f0-9]{64}', c[k]) for k in ('trial_intent_sha256', 'trial_proof_sha256')) or
            not isinstance(c['trial_job'], str) or not re.fullmatch('[a-f0-9]{16}', c['trial_job']) or c['trial_job'] == '0' * 16 or
            c['producer_sha256'] != {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in PRODUCERS}): raise RelayRefusal
    return c


async def preflight(o, c):
    """Current returned pair and capacity BEFORE consuming another attempt.

    These are two fixed reads through the private original Noise relay. The
    inner activation independently repeats them before its first mutation.
    A capacity refusal here consumes no permanent intent and never prunes.
    """
    profile, relay, client = await key(o), None, None
    try:
        relay = FullUiRelay(o); port = await relay.start()
        client = client_factory(o)('127.0.0.1', port, password=None, noise_psk=profile['api_encryption_key'],
                                   client_info='Qingping separate permanent review')
        await asyncio.wait_for(client.connect(login=True, log_errors=False), 12); o.live()
        info = await asyncio.wait_for(client.device_info(), 10)
        if info.name != profile['node_name'] or info.mac_address.lower() != profile['api_mac']: raise RelayRefusal
        _, listed = await asyncio.wait_for(client.list_entities_services(), 10)
        services = services_named(listed, ('full_runtime_status', 'storage_audit'))
        if set(services) != {'full_runtime_status', 'storage_audit'}: raise RelayRefusal
        returned_pair(await rpc(client, services, 'full_runtime_status', {}), o.checked['native_pair'], c['trial_job']); o.live()
        capacity(await rpc(client, services, 'storage_audit', {}), o.checked['native_pair'], o.checked['bridge']); o.live()
        returned_pair(await rpc(client, services, 'full_runtime_status', {}), o.checked['native_pair'], c['trial_job']); o.live()
        await asyncio.wait_for(client.disconnect(), 10); client = None
        await _idle(relay); await relay.close(); relay = None
        await o.scope()
    finally:
        if client is not None:
            try: await asyncio.wait_for(client.disconnect(), 10)
            except BaseException: pass
        if relay is not None:
            try: await relay.close()
            except BaseException: pass
        o.psk = None; profile.pop('api_encryption_key', None)


async def activate(service, owner, nonce, data):
    if (not isinstance(data, dict) or set(data) != {'job_id', 'expected_plan_sha256', 'channel_id', 'expected_trial_proof_sha256',
            'screen_reviewed', 'experimental_reviewed'} or data['screen_reviewed'] is not True or data['experimental_reviewed'] is not True or
            not isinstance(data['expected_trial_proof_sha256'], str) or not re.fullmatch('[a-f0-9]{64}', data['expected_trial_proof_sha256'])): raise RelayRefusal
    target = {k: data[k] for k in ('job_id', 'expected_plan_sha256', 'channel_id')}
    o = FullUiObservation(service, owner, nonce, target)
    profile = relay = None
    try:
        request = await prepare(o)
        if o.first['kind'] != 'browser_full_ui_scope': raise RelayRefusal
        c = activation_context(await service.exchange(owner, nonce, 'internal-browser-full-ui-activation-context', request), o); o.live()
        if c['trial_proof_sha256'] != data['expected_trial_proof_sha256']: raise RelayRefusal
        await preflight(o, c)
        if o.deadline - time.monotonic() < 730: raise RelayRefusal
        result = await service.exchange(owner, nonce, 'internal-browser-full-ui-activation-prepare',
            {**request, 'expected_trial_proof_sha256': c['trial_proof_sha256'],
             'scope': {'channel_id': data['channel_id'], 'channel_nonce': o.current['reported_evidence']['channel'], 'observation': o.first},
             'screen_reviewed': True, 'experimental_reviewed': True}); o.live()
        p = document(result, limit=49152)
        fields = {'schema_version', 'job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'context', 'scope', 'producer_sha256', 'intent_sha256'}
        if (set(p) != fields or type(p['schema_version']) is not int or p['schema_version'] != 1 or
                p['job_id'] != data['job_id'] or p['plan_sha256'] != data['expected_plan_sha256'] or
                p['channel_id'] != data['channel_id'] or p['channel_nonce'] != o.current['reported_evidence']['channel'] or
                not same(p['context'], c) or not same(p['scope'], o.first) or p['producer_sha256'] != c['producer_sha256'] or
                not isinstance(p['intent_sha256'], str) or not re.fullmatch('[a-f0-9]{64}', p['intent_sha256'])): raise RelayRefusal
        profile = await key(o); relay = FullUiRelay(o); port = await relay.start()
        result = await run(port, profile, o.checked['native_pair'], o.checked['bridge'], c['boot_id'], c['trial_job'], factory=client_factory(o))
        o.live(); await _idle(relay); await relay.close(); relay = None
        final = await o.scope()
        after = activation_context(await service.exchange(owner, nonce, 'internal-browser-full-ui-activation-context', request), o); o.live()
        if not same(after, c) or result['state'] != 'full_ui_active_observed': raise RelayRefusal
        await o.cap.close(); o.live(closed=True)
        proof = {'schema_version': 1, **{k: p[k] for k in ('job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'intent_sha256')},
                 'result': result, 'final_scope': final, 'api_closed': True, 'transport_closed': True, 'channel_closed': True}
        value = document(await service.exchange(owner, nonce, 'internal-browser-full-ui-activation-record',
            {'job_id': data['job_id'], 'intent_sha256': p['intent_sha256'], 'proof': proof}), limit=4096); o.live(closed=True)
        expected = {'job_id': data['job_id'], 'state': 'browser_full_ui_active_observed', 'installed': False,
                    'installation_ready': False, 'writer_enabled': False, 'replay_allowed': False, 'live_recheck_required': True}
        if not same(value, expected): raise RelayRefusal
        return value
    except BaseException:
        try: await o.cap.close()
        except BaseException: pass
        raise RelayRefusal from None
    finally:
        if relay is not None:
            try: await relay.close()
            except BaseException: pass
        o.psk = None
        if profile is not None: profile.pop('api_encryption_key', None)
