"""Private Full UI review through the original post-PM WebUSB capability.

Reuse the inner read-only API engine, never a fake native USB forward/receipt.
The key remains on the actor/Core pipe. Fixed scope reads and positively closed
API, USB and channel are independently required. No upload/launch follows from
this review, and an earlier PM-armed boot must not pass as an applied PM boot.
"""
import base64
import hashlib
import re
import time

from .monitor1_browser_relay import BrowserApiRelay, RelayRefusal
from .monitor1_browser_stage import document
from .monitor1_browser_initial_ram import same
from .monitor1_browser_boot_observer import _Observation, _Relay, _Stream, ROOT
from .monitor1_browser_initial_noise import _idle
from .monitor1_worker.full_ui_review import review

MIME = 'application/vnd.qingping.internal-browser-full-ui-api+json'
PRODUCERS = ('browser_full_ui_context.py', 'full_ui_review.py', 'full_ui_trial.py', 'full_ui_activation.py')
BINDINGS = ('job_id', 'plan_sha256', 'pm_intent_sha256', 'pm_proof_sha256')


def context(result, data):
    c = document(result, limit=16384)
    fields = {'schema_version', 'kind', *BINDINGS, 'source_commit', 'target', 'pm_armed_boot', 'api_identity',
              'bridge', 'native_pair', 'producer_sha256', 'context_only', 'writer_enabled', 'device_writes'}
    digest = lambda v, n: isinstance(v, str) and re.fullmatch('[a-f0-9]{' + str(n) + '}', v)
    uuid = lambda v: isinstance(v, str) and re.fullmatch('[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', v)
    def pin(p):
        return (isinstance(p, dict) and set(p) == {'size', 'sha256'} and type(p['size']) is int and
                0 < p['size'] <= 16 * 1024**2 and digest(p['sha256'], 64))
    if (set(c) != fields or type(c['schema_version']) is not int or c['schema_version'] != 1 or
            c['kind'] != 'browser_full_ui_context' or c['job_id'] != data['job_id'] or
            c['plan_sha256'] != data['expected_plan_sha256'] or not all(digest(c[k], 64) for k in BINDINGS[1:]) or
            c['source_commit'] != '53d97b9609e8e0fcdfc5d003101f620098dbc734' or not uuid(c['pm_armed_boot']) or
            c['context_only'] is not True or c['writer_enabled'] is not False or type(c['device_writes']) is not int or c['device_writes'] != 0 or
            c['producer_sha256'] != {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in PRODUCERS} or
            not pin(c['bridge']) or not isinstance(c['native_pair'], dict) or
            set(c['native_pair']) != {'native-program', 'guardian-program'} or not all(pin(p) for p in c['native_pair'].values())):
        raise RelayRefusal
    t, identity = c['target'], c['api_identity']
    mac = lambda v: isinstance(v, str) and re.fullmatch('[a-f0-9]{2}(?::[a-f0-9]{2}){5}', v) and v != '00:00:00:00:00:00' and not int(v[:2], 16) & 1
    if (not isinstance(t, dict) or set(t) != {'kind', 'usb_serial', 'wlan_mac', 'boot_id', 'co2_type', 'stock_version'} or
            t['kind'] != 'browser_webusb' or not isinstance(t['usb_serial'], str) or
            not re.fullmatch('[A-Za-z0-9][A-Za-z0-9_-]{0,127}', t['usb_serial']) or not mac(t['wlan_mac']) or
            not uuid(t['boot_id']) or t['boot_id'] == c['pm_armed_boot'] or type(t['co2_type']) is not int or
            t['co2_type'] not in (2, 3) or t['stock_version'] != '4.1.8_0287' or
            not isinstance(identity, dict) or set(identity) != {'node_name', 'api_mac'} or
            not isinstance(identity['node_name'], str) or not re.fullmatch('[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', identity['node_name']) or
            not mac(identity['api_mac'])):
        raise RelayRefusal
    return c


class FullUiObservation(_Observation):
    def __init__(self, service, owner, nonce, data):
        super().__init__(service, owner, nonce, data)
        if self.current.get('purpose') != 'full-ui' or self.cap.purpose != 'full-ui': raise RelayRefusal
        # Captured once at creation, never extended by a read or reconnect.
        self.deadline = min(self.current['deadline'], time.monotonic() + 900)

    async def scope(self, *, io=False):
        self.live(io=io)
        value = await self.cap.observe_full_ui_scope(self.checked)
        self.live(io=io)
        waiting = self.target['boot_id'] == self.checked['pm_armed_boot']
        expected = {'kind': 'browser_full_ui_waiting_for_pm_boot' if waiting else 'browser_full_ui_scope',
                    **{k: self.checked[k] for k in BINDINGS}, 'target': self.target, 'bridge_checked': True,
                    'context_only': True, 'device_writes': 0}
        if not same(value, expected): raise RelayRefusal
        self.first = value
        return value


class FullUiRelay(_Relay):
    def __init__(self, observation):
        self.o, self.cap = observation, observation.cap
        self.deadline = observation.deadline
        self.relay = BrowserApiRelay(_Channel(self), purpose='full-ui')
        observation.relay = self


class _Channel:
    def __init__(self, owner): self.owner = owner
    async def open_api(self):
        r = self.owner; r._live(io=True)
        await r.o.scope(io=True)
        if r.o.first['kind'] != 'browser_full_ui_scope': raise RelayRefusal
        remote = await r.cap.open_full_ui_api(); r._live(io=True)
        return _Stream(r, remote)
    async def close(self):
        if self.owner.relay.failed: await self.owner.cap.close()


def request(data):
    if (not isinstance(data, dict) or set(data) != {'job_id', 'expected_plan_sha256', 'channel_id'} or
            any(not isinstance(v, str) for v in data.values()) or
            not re.fullmatch('[a-f0-9]{32}', data['job_id']) or not re.fullmatch('[a-f0-9]{32}', data['channel_id']) or
            not re.fullmatch('[a-f0-9]{64}', data['expected_plan_sha256'])): raise RelayRefusal
    return {k: data[k] for k in ('job_id', 'expected_plan_sha256')}


async def prepare(o):
    payload = request(o.data)
    o.live(); o.checked = context(await o.service.exchange(o.owner, o.nonce, 'internal-browser-full-ui-context', payload), o.data); o.live()
    e, old = o.current['reported_evidence'], o.checked['target']
    o.target = {'kind': 'browser_webusb', 'usb_serial': e['serial'], **{k: e[k] for k in ('wlan_mac', 'boot_id', 'co2_type', 'stock_version')}}
    if not same({**o.target, 'boot_id': old['boot_id']}, old) or o.target['boot_id'] == old['boot_id']: raise RelayRefusal
    await o.scope()
    return payload


async def key(o):
    binding = {k: o.checked[k] for k in BINDINGS}
    value = document(await o.service.exchange(o.owner, o.nonce, 'internal-browser-full-ui-api', binding), mime=MIME, limit=4096); o.live()
    if (set(value) != {'kind', *binding, 'node_name', 'api_mac', 'noise_psk'} or value['kind'] != 'browser_full_ui_api_context' or
            any(value[k] != v for k, v in binding.items()) or
            not same({k: value[k] for k in ('node_name', 'api_mac')}, o.checked['api_identity']) or not isinstance(value['noise_psk'], str)): raise RelayRefusal
    raw = base64.b64decode(value['noise_psk'], validate=True)
    if len(raw) != 32 or base64.b64encode(raw).decode() != value['noise_psk']: raise RelayRefusal
    o.psk = value.pop('noise_psk')
    return {**o.checked['api_identity'], 'api_encryption_key': o.psk}


def client_factory(o):
    from aioesphomeapi import APIClient
    def factory(host, port, **kwargs):
        return APIClient(host, port, provide_time=False, expected_name=o.checked['api_identity']['node_name'], **kwargs)
    return factory


async def api_review(o):
    profile, relay = await key(o), None
    try:
        relay = FullUiRelay(o); port = await relay.start()
        result = await review(port, profile, o.checked['native_pair'], o.checked['bridge']['sha256'], o.target['boot_id'], factory=client_factory(o))
        o.live(); await _idle(relay); await relay.close(); relay = None
        return result
    finally:
        if relay is not None:
            try: await relay.close()
            except BaseException: pass
        o.psk = None; profile.pop('api_encryption_key', None)


async def inspect(service, owner, nonce, data):
    payload = request(data)
    o = FullUiObservation(service, owner, nonce, data)
    relay = profile = None
    try:
        await prepare(o)
        if o.first['kind'] == 'browser_full_ui_waiting_for_pm_boot':
            result = {'state': 'full_ui_waiting_for_pm_boot', 'read_only': True, 'device_writes': 0,
                      'launch_authorized': False, 'installation_ready': False, 'installed': False, 'live_recheck_required': True}
        else:
            result = await api_review(o)
            await o.scope()
        after = context(await service.exchange(owner, nonce, 'internal-browser-full-ui-context', payload), data); o.live()
        if not same(after, o.checked): raise RelayRefusal
        await o.cap.close(); o.live(closed=True)
        return {'job_id': data['job_id'], **result, 'hardware_contacted': True, 'transport_closed': True, 'channel_closed': True}
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


TRIAL_MIME = 'application/vnd.qingping.internal-browser-full-ui-trial+json'
TRIAL_PRODUCERS = ('browser_full_ui_trial.py', 'browser_full_ui_context.py', 'full_ui_review.py', 'full_ui_trial.py')


def trial_packet(result, o, preflight):
    p = document(result, mime=TRIAL_MIME, limit=48 * 1024**2)
    fields = {'schema_version', 'job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'trial_job', 'context',
              'observation', 'producer_sha256', 'intent_sha256', 'images'}
    observation = {'scope': o.first, 'preflight': preflight}
    if (set(p) != fields or type(p['schema_version']) is not int or p['schema_version'] != 1 or
            p['job_id'] != o.data['job_id'] or p['plan_sha256'] != o.data['expected_plan_sha256'] or
            p['channel_id'] != o.data['channel_id'] or p['channel_nonce'] != o.current['reported_evidence']['channel'] or
            not same(p['context'], o.checked) or not same(p['observation'], observation) or
            p['producer_sha256'] != {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in TRIAL_PRODUCERS} or
            not isinstance(p['trial_job'], str) or not re.fullmatch('[a-f0-9]{16}', p['trial_job']) or p['trial_job'] == '0' * 16 or
            not isinstance(p['intent_sha256'], str) or not re.fullmatch('[a-f0-9]{64}', p['intent_sha256']) or
            not isinstance(p['images'], dict) or set(p['images']) != set(o.checked['native_pair'])): raise RelayRefusal
    images = {}
    for kind, pin in o.checked['native_pair'].items():
        value = p['images'][kind]
        if not isinstance(value, str) or len(value) != 4 * ((pin['size'] + 2) // 3): raise RelayRefusal
        body = base64.b64decode(value, validate=True)
        if len(body) != pin['size'] or base64.b64encode(body).decode() != value or hashlib.sha256(body).hexdigest() != pin['sha256']: raise RelayRefusal
        images[kind] = body
    return {k: v for k, v in p.items() if k != 'images'}, images


async def trial(service, owner, nonce, data):
    if not isinstance(data, dict) or data.get('experimental_reviewed') is not True: raise RelayRefusal
    request_data = {k: v for k, v in data.items() if k != 'experimental_reviewed'}
    payload = request(request_data); o = FullUiObservation(service, owner, nonce, request_data)
    profile = relay = None; images = None
    try:
        await prepare(o)
        if o.first['kind'] != 'browser_full_ui_scope': raise RelayRefusal
        preflight = await api_review(o); o.live()
        if preflight['state'] != 'full_ui_preflight_observed': raise RelayRefusal
        await o.scope()
        # Reserve enough of this ORIGINAL selection for the unchanged inner
        # upload/prepare/60s trial/return bounds. No consumed attempt on a
        # channel already too old; choosing another selection cannot replay it.
        if o.deadline - time.monotonic() < 650: raise RelayRefusal
        selected = {'channel_id': data['channel_id'], 'channel_nonce': o.current['reported_evidence']['channel'],
                    'observation': {'scope': o.first, 'preflight': preflight}}
        result = await service.exchange(owner, nonce, 'internal-browser-full-ui-trial-prepare',
            {**payload, 'scope': selected, 'experimental_reviewed': True}); o.live()
        packet, images = trial_packet(result, o, preflight)
        profile = await key(o); relay = FullUiRelay(o); port = await relay.start()
        from .monitor1_worker.full_ui_trial import run
        result = await run(port, profile, o.checked['native_pair'], o.checked['bridge']['sha256'], o.target['boot_id'],
                           packet['trial_job'], images, factory=client_factory(o))
        o.live(); await _idle(relay); await relay.close(); relay = None
        final_scope = await o.scope()
        after = context(await service.exchange(owner, nonce, 'internal-browser-full-ui-context', payload), request_data); o.live()
        if not same(after, o.checked) or result['state'] != 'full_ui_trial_returned_observed': raise RelayRefusal
        await o.cap.close(); o.live(closed=True)
        proof = {'schema_version': 1, **{k: packet[k] for k in ('job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'intent_sha256', 'trial_job')},
                 'result': result, 'final_scope': final_scope, 'api_closed': True, 'transport_closed': True, 'channel_closed': True}
        # Consume the one terminal request before private pipe IO. Lost reply
        # permits immutable status reconciliation only, never another trial.
        value = document(await service.exchange(owner, nonce, 'internal-browser-full-ui-trial-record',
            {'job_id': data['job_id'], 'intent_sha256': packet['intent_sha256'], 'proof': proof}), limit=4096)
        o.live(closed=True)
        expected = {'job_id': data['job_id'], 'state': 'browser_full_ui_trial_returned_observed', 'installed': False,
                    'activated': False, 'installation_ready': False, 'writer_enabled': False, 'replay_allowed': False, 'live_recheck_required': True}
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
        if images is not None: images.clear()
