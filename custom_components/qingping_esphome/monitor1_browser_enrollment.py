"""Explicit browser USB observation followed by HA's ordinary ESPHome flow.

The existing native user/encryption_key flow remains the only config-entry
writer. Browser frames carry fixed wlan0 evidence and opaque Noise bytes;
keys never leave the private actor/Core pipe. An uncertain result is consumed,
and historical reconciliation can only inspect existing HA entries.
"""
import asyncio
import hashlib
import ipaddress
import re
import time

from .monitor1_browser_full_ui import FullUiObservation, FullUiRelay, prepare, key, client_factory, ROOT
from .monitor1_browser_initial_ram import same
from .monitor1_browser_initial_noise import _idle
from .monitor1_browser_relay import RelayRefusal
from .monitor1_browser_stage import document
from .monitor1_enrollment import payload, enroll, existing, MIME
from .monitor1_worker.full_ui_trial import native_sample, rpc, services_named

PRODUCERS = ('browser_ha_enrollment.py', 'browser_full_ui_activation.py', 'ha_enrollment.py', 'ha_enrollment_usb.py')


def context(result, o):
    c = document(result, limit=32768)
    fields = {'schema_version', 'kind', 'job_id', 'plan_sha256', 'activation_intent_sha256', 'activation_proof_sha256',
              'full_ui', 'boot_id', 'native_job', 'producer_sha256', 'context_only', 'writer_enabled', 'device_writes'}
    if (set(c) != fields or type(c['schema_version']) is not int or c['schema_version'] != 1 or c['kind'] != 'browser_ha_enrollment_context' or
            c['job_id'] != o.data['job_id'] or c['plan_sha256'] != o.data['expected_plan_sha256'] or not same(c['full_ui'], o.checked) or
            c['boot_id'] != o.target['boot_id'] or c['context_only'] is not True or c['writer_enabled'] is not False or
            type(c['device_writes']) is not int or c['device_writes'] != 0 or
            any(not isinstance(c[k], str) or not re.fullmatch('[a-f0-9]{64}', c[k]) for k in ('activation_intent_sha256', 'activation_proof_sha256')) or
            not isinstance(c['native_job'], str) or not re.fullmatch('[a-f0-9]{16}', c['native_job']) or c['native_job'] == '0' * 16 or
            c['producer_sha256'] != {n: hashlib.sha256((ROOT / n).read_bytes()).hexdigest() for n in PRODUCERS}): raise RelayRefusal
    return c


async def network(o):
    o.live(); r = await o.cap.observe_full_ui_network(); o.live()
    if (not isinstance(r, dict) or set(r) != {'kind', 'host', 'device_writes'} or r['kind'] != 'browser_full_ui_network' or
            type(r['device_writes']) is not int or r['device_writes'] != 0 or not isinstance(r['host'], str)): raise RelayRefusal
    try:
        address = ipaddress.IPv4Address(r['host'])
        if not address.is_private or address.is_loopback or address.is_link_local or address.is_unspecified or address.is_multicast: raise ValueError
        return str(address)
    except Exception: raise RelayRefusal from None



async def observe(o, c):
    host = await network(o)
    profile, relay, client = await key(o), None, None
    try:
        relay = FullUiRelay(o); port = await relay.start()
        client = client_factory(o)('127.0.0.1', port, password=None, noise_psk=profile['api_encryption_key'], client_info='Qingping browser HA verification')
        await asyncio.wait_for(client.connect(login=True, log_errors=False), 12); o.live()
        info = await asyncio.wait_for(client.device_info(), 10)
        if info.name != profile['node_name'] or info.mac_address.lower() != profile['api_mac']: raise RelayRefusal
        _, listed = await asyncio.wait_for(client.list_entities_services(), 10)
        services = services_named(listed, ('full_native_status',))
        if set(services) != {'full_native_status'}: raise RelayRefusal
        previous = None
        for index in range(2):
            body = await rpc(client, services, 'full_native_status', {}); o.live()
            if not native_sample(body, o.checked['native_pair'], c['boot_id'], c['native_job']): raise RelayRefusal
            current = body['guardian_generations']
            if previous is not None and not all(n > old for n, old in zip(current, previous)): raise RelayRefusal
            previous = current
            if index == 0: await asyncio.sleep(.75); o.live()
        await asyncio.wait_for(client.disconnect(), 10); client = None
        await _idle(relay); await relay.close(); relay = None
        await o.scope()
        if await network(o) != host: raise RelayRefusal
        return host
    finally:
        if client is not None:
            try: await asyncio.wait_for(client.disconnect(), 10)
            except BaseException: pass
        if relay is not None:
            try: await relay.close()
            except BaseException: pass
        o.psk = None; profile.pop('api_encryption_key', None)


async def run(service, owner, nonce, data):
    if not isinstance(data, dict) or set(data) != {'job_id', 'expected_plan_sha256', 'channel_id', 'reviewed'} or data['reviewed'] is not True: raise RelayRefusal
    target = {k: data[k] for k in ('job_id', 'expected_plan_sha256', 'channel_id')}
    o = FullUiObservation(service, owner, nonce, target); private = None
    try:
        request = await prepare(o)
        if o.first['kind'] != 'browser_full_ui_scope': raise RelayRefusal
        c = context(await service.exchange(owner, nonce, 'internal-browser-enrollment-context', request), o); o.live()
        if o.deadline - time.monotonic() < 120: raise RelayRefusal
        selected = {'channel_id': data['channel_id'], 'channel_nonce': o.current['reported_evidence']['channel'], 'observation': o.first}
        p = document(await service.exchange(owner, nonce, 'internal-browser-enrollment-prepare', {**request, 'scope': selected, 'reviewed': True}), limit=49152); o.live()
        fields = {'schema_version', 'job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'context', 'scope', 'producer_sha256', 'intent_sha256'}
        if (set(p) != fields or type(p['schema_version']) is not int or p['schema_version'] != 1 or
                p['job_id'] != data['job_id'] or p['plan_sha256'] != data['expected_plan_sha256'] or
                p['channel_id'] != data['channel_id'] or p['channel_nonce'] != selected['channel_nonce'] or
                not same(p['context'], c) or not same(p['scope'], o.first) or p['producer_sha256'] != c['producer_sha256'] or
                not isinstance(p['intent_sha256'], str) or not re.fullmatch('[a-f0-9]{64}', p['intent_sha256'])): raise RelayRefusal
        host = await observe(o, c)
        after = context(await service.exchange(owner, nonce, 'internal-browser-enrollment-context', request), o); o.live()
        if not same(after, c): raise RelayRefusal
        final = await o.scope()
        await o.cap.close(); o.live(closed=True)
        proof = {'schema_version': 1, **{k: p[k] for k in ('job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'intent_sha256')},
                 'host': host, 'boot_id': c['boot_id'], 'native_job': c['native_job'], 'native_observations': 2,
                 'final_scope': final, 'api_closed': True, 'transport_closed': True, 'channel_closed': True}
        response = await service.exchange(owner, nonce, 'internal-browser-enrollment-observe', {'job_id': data['job_id'], 'intent_sha256': p['intent_sha256'], 'proof': proof})
        o.live(closed=True)
        if not response[0] or response[1] != MIME: raise RelayRefusal
        private = payload(response[2], data['job_id'])
        if (private['intent_sha256'] != p['intent_sha256'] or private['host'] != host or private['boot_id'] != c['boot_id'] or
                private['native_job'] != c['native_job'] or private['node_name'] != o.checked['api_identity']['node_name'] or
                private['api_mac'] != o.checked['api_identity']['api_mac'] or
                private['native_sha256'] != o.checked['native_pair']['native-program']['sha256'] or
                private['guardian_sha256'] != o.checked['native_pair']['guardian-program']['sha256']): raise RelayRefusal
        try:
            # Independent encrypted LAN verification is inside this existing
            # native flow engine; no custom entry construction or overwrite.
            state, entry_id = await enroll(service.hass, private)
        except Exception: state, entry_id = 'unverified', None
        o.live(closed=True)
        return document(await service.exchange(owner, nonce, 'internal-browser-enrollment-record',
            {'job_id': data['job_id'], 'intent_sha256': p['intent_sha256'], 'state': state, 'entry_id': entry_id}), limit=4096)
    except BaseException:
        try: await o.cap.close()
        except BaseException: pass
        raise RelayRefusal from None
    finally:
        o.psk = None
        if private is not None: private.pop('noise_psk', None)


async def status(service, owner, nonce, job):
    """Historical entry reconciliation only: no USB, flow, record or retry."""
    result = await service.exchange(owner, nonce, 'internal-browser-enrollment-status', {'job_id': job})
    public = document(result, limit=4096)
    if public.get('state') == 'unverified':
        packet = await service.exchange(owner, nonce, 'internal-browser-enrollment-package', {'job_id': job})
        # A consumed read without its closed proof has no package. Keep its
        # existing uncertainty; do not request USB or run a flow from status.
        if packet[0] and packet[1] == MIME:
            private = payload(packet[2], job)
            try:
                current = existing(service.hass, private)
                if current and current[0] == 'already_configured': public.update(state=current[0], entry_id=current[1])
            finally: private.pop('noise_psk', None)
    return public
