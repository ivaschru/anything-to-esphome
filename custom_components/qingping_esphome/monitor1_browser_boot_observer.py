"""Private read-only ordinary-boot observation through the selected WebUSB.

Arming history is immutable context; runtime requires a distinct current boot,
the complete fixed kernel/file frame, authenticated physical wire updates and
independent API/USB/channel closure. This never launches, reboots or repairs.
"""
import asyncio
import base64
import copy
import hashlib
import json
import re
import time

from .monitor1_browser_relay import BrowserApiRelay, RelayRefusal
from .monitor1_browser_initial_ram import actor_live, same
from .monitor1_browser_stage import document
from .monitor1_browser_bridge_boot import context as boot_context, packet as boot_packet, ROOT
from .monitor1_browser_initial_noise import _WireSamples, _disconnect, _idle, REQUIRED

MIME = 'application/vnd.qingping.internal-browser-boot-api+json'
_now, _wait = time.monotonic, asyncio.sleep


def context(result, data):
    value = document(result, limit=65536)
    fields = {'schema_version', 'kind', 'job_id', 'plan_sha256', 'arming', 'arming_proof_sha256',
              'api_identity', 'producer_sha256', 'context_only', 'writer_enabled', 'device_writes'}
    producers = {n: hashlib.sha256((ROOT / n).read_bytes()).hexdigest()
                 for n in ('browser_boot_context.py', 'bridge-observer-contract.json')}
    if (set(value) != fields or type(value['schema_version']) is not int or value['schema_version'] != 1 or
            value['kind'] != 'browser_bridge_boot_observer_context' or value['job_id'] != data['job_id'] or
            value['plan_sha256'] != data['expected_plan_sha256'] or value['context_only'] is not True or
            value['writer_enabled'] is not False or type(value['device_writes']) is not int or value['device_writes'] != 0 or
            value['producer_sha256'] != producers or not isinstance(value['arming_proof_sha256'], str) or
            not re.fullmatch('[a-f0-9]{64}', value['arming_proof_sha256'])):
        raise RelayRefusal
    p = value['arming']
    checked, _ = boot_context((True, 'application/json', json.dumps(p['context']).encode()), data)
    boot_packet((True, 'application/json', json.dumps(p).encode()), checked, p['preparation'], p['channel_id'], p['channel_nonce'])
    identity = value['api_identity']
    if (not isinstance(identity, dict) or set(identity) != {'node_name', 'api_mac'} or
            not isinstance(identity['node_name'], str) or not re.fullmatch('[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', identity['node_name']) or
            not isinstance(identity['api_mac'], str) or not re.fullmatch('[a-f0-9]{2}(?::[a-f0-9]{2}){5}', identity['api_mac']) or
            identity['api_mac'] == '00:00:00:00:00:00' or int(identity['api_mac'][:2], 16) & 1): raise RelayRefusal
    return value


def validate_scope(value, checked, target):
    bindings = {'job_id': checked['job_id'], 'plan_sha256': checked['plan_sha256'],
                'arming_intent_sha256': checked['arming']['intent_sha256'],
                'arming_proof_sha256': checked['arming_proof_sha256']}
    common = {'kind', *bindings, 'target', 'context_only', 'device_writes'}
    waiting = target['boot_id'] == checked['arming']['context']['meta']['target']['boot_id']
    expected = common if waiting else common | {'root_identity', 'processes', 'pm_disabled', 'recovery_backup',
        'bridge_disabled', 'canonical_scope_checked', 'memory_free_bytes', 'memory_total_bytes'}
    if (not isinstance(value, dict) or set(value) != expected or
            value['kind'] != ('browser_bridge_boot_waiting' if waiting else 'browser_bridge_boot_runtime_scope') or
            any(value[k] != v for k, v in bindings.items()) or not same(value['target'], target) or
            value['context_only'] is not True or type(value['device_writes']) is not int or value['device_writes'] != 0):
        raise RelayRefusal
    if waiting: return
    p = value['processes']
    if (not same(value['root_identity'], checked['arming']['preparation']['preparation']['scope']['root_identity']) or
            any(value[k] is not True for k in ('pm_disabled', 'recovery_backup', 'canonical_scope_checked')) or
            value['bridge_disabled'] is not False or not isinstance(p, dict) or set(p) != {'child', 'supervisor', 'stock', 'watchdog'} or
            any(not isinstance(v, list) or len(v) != 3 or type(v[0]) is not int or not 2 <= v[0] <= 2147483647 or
                type(v[1]) is not int or not 1 <= v[1] <= 2147483647 or not isinstance(v[2], str) or
                not re.fullmatch('[1-9][0-9]{0,19}', v[2]) or not 0 < int(v[2]) < 2**64 for v in p.values()) or
            len({v[0] for v in p.values()}) != 4 or p['child'][1] != p['supervisor'][0] or p['stock'][1] != p['watchdog'][0] or
            any(type(value[k]) is not int for k in ('memory_free_bytes', 'memory_total_bytes')) or
            not 8 * 1024**2 <= value['memory_free_bytes'] <= value['memory_total_bytes'] <= 2**40): raise RelayRefusal


class _Observation:
    def __init__(self, service, owner, nonce, data):
        self.service, self.owner, self.nonce, self.data = service, owner, nonce, data
        self.actor, self.operation = getattr(service, 'process', None), asyncio.current_task()
        actor_live(service, self.actor, self.operation)  # Foreign tasks do no IO/cleanup.
        self.registry = service.browser_registry
        self.cap, self.current = self.registry.capability(owner, nonce, data['channel_id']), self.registry.current
        self.deadline = min(self.current['deadline'], _now() + 120)
        self.checked = self.target = self.first = self.relay = None
        self.psk = None

    def live(self, *, io=False, closed=False):
        task = asyncio.current_task()
        owned = io and self.relay is not None and (task in self.relay.relay.tasks or task in self.relay.relay.pumps)
        if task is self.operation: actor_live(self.service, self.actor, self.operation)
        elif (not owned or self.service.pending is not self.operation or self.operation.done() or
              self.service.process is not self.actor or self.actor.returncode is not None or
              self.service.closing or self.service.failed or not self.service.lock.locked()): raise RelayRefusal
        if (self.registry.current is not self.current or self.registry.capability(self.owner, self.nonce, self.data['channel_id']) is not self.cap or
                self.cap.failed or self.cap.closed is not closed or _now() >= self.deadline): raise RelayRefusal

    async def scope(self, *, io=False):
        self.live(io=io)
        value = await self.cap.observe_bridge_boot(self.checked)
        self.live(io=io); validate_scope(value, self.checked, self.target)
        stable = lambda v: {k: x for k, x in v.items() if k != 'memory_free_bytes'}
        if self.first is not None and not same(stable(value), stable(self.first)): raise RelayRefusal
        self.first = copy.deepcopy(value)
        return value


class _Relay:
    """Only this operation's owned pumps may carry opaque API bytes."""
    def __init__(self, observation):
        self.o, self.cap = observation, observation.cap
        self.deadline = min(observation.deadline, _now() + 50)
        self.relay = BrowserApiRelay(_Channel(self)); observation.relay = self

    def _live(self, *, io=False):
        self.o.live(io=io)
        if _now() >= self.deadline or self.o.psk is None: raise RelayRefusal

    async def start(self):
        self._live(); port = await self.relay.start(); self.relay.deadline = self.deadline; self._live(); return port

    async def close(self):
        await self.relay.close()
        tasks = self.relay.tasks | self.relay.pumps
        if tasks: await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), 5)
        self.o.live()
        if self.relay.failed or self.relay.active is not None or self.relay.tasks or self.relay.pumps or self.cap.pending or self.cap.opened or self.cap.opening:
            raise RelayRefusal


class _Channel:
    def __init__(self, owner): self.owner = owner
    async def open_api(self):
        owner = self.owner; owner._live(io=True)
        await owner.o.scope(io=True)
        remote = await owner.cap.open_boot_observer_api(); owner._live(io=True)
        return _Stream(owner, remote)
    async def close(self):
        # Normal API teardown preserves USB for the closing kernel frame.
        if self.owner.relay.failed: await self.owner.cap.close()


class _Stream:
    def __init__(self, owner, remote): self.owner, self.remote = owner, remote
    async def read(self, size):
        self.owner._live(io=True); value = await self.remote.read(size); self.owner._live(io=True); return value
    async def write(self, data):
        self.owner._live(io=True); await self.remote.write(data); self.owner._live(io=True)
    async def close(self): await self.remote.close()  # ACK still needed after expiry/cancellation.


async def _wire(o):
    from aioesphomeapi import APIClient
    relay, client = _Relay(o), None
    try:
        port = await relay.start(); identity = o.checked['api_identity']
        client = APIClient('127.0.0.1', port, password=None, noise_psk=o.psk, expected_name=identity['node_name'],
                           provide_time=False, client_info='Qingping USB boot observation')
        await asyncio.wait_for(client.connect(login=True, log_errors=False), 15); o.live(); relay._live()
        info = await asyncio.wait_for(client.device_info(), 5)
        if info.name != identity['node_name'] or info.mac_address.lower() != identity['api_mac']: raise RelayRefusal
        entities, _ = await asyncio.wait_for(client.list_entities_services(), 5)
        samples = _WireSamples(entities)
        # Post-boot native observation requires a new stock-age callback too,
        # not merely a still-young value from the previous accepted vector.
        samples.counts = {name: 0 for name in REQUIRED}
        client.subscribe_states(samples.received)
        stop = min(_now() + 40, relay.deadline - 5)
        while _now() < stop:
            await o.scope(); relay._live(); now = _now()
            if samples.accept(now) and samples.samples >= 2: break
            await _wait(min(2, max(0, stop - now)))
        if samples.samples < 2: raise RelayRefusal
        await _disconnect(client); client = None
        await _idle(relay); await relay.close()
        await o.scope(); o.live()
        age = _now() - samples.last_accepted_at
        if not 0 <= age <= 20: raise RelayRefusal
        return {'samples': samples.samples, 'last_sample_age_at_final_scope_s': age}
    finally:
        if client is not None:
            try: await _disconnect(client)
            except BaseException: pass
        await relay.close()
        o.psk = None


async def observe(service, owner, nonce, data):
    fields = {'job_id', 'expected_plan_sha256', 'channel_id'}
    if (not isinstance(data, dict) or set(data) != fields or any(not isinstance(v, str) for v in data.values()) or
            not re.fullmatch('[a-f0-9]{32}', data['job_id']) or not re.fullmatch('[a-f0-9]{32}', data['channel_id']) or
            not re.fullmatch('[a-f0-9]{64}', data['expected_plan_sha256']) or service.browser_registry is None): raise RelayRefusal
    o = _Observation(service, owner, nonce, data)
    request = {k: data[k] for k in ('job_id', 'expected_plan_sha256')}
    try:
        o.live(); o.checked = context(await service.exchange(owner, nonce, 'internal-browser-boot-observer-context', request), data); o.live()
        evidence = o.current['reported_evidence']; old = o.checked['arming']['context']['meta']['target']
        o.target = {'kind': 'browser_webusb', 'usb_serial': evidence['serial'], **{k: evidence[k] for k in ('wlan_mac', 'boot_id', 'co2_type', 'stock_version')}}
        if not same({**o.target, 'boot_id': old['boot_id']}, old): raise RelayRefusal
        await o.scope(); waiting = o.first['kind'] == 'browser_bridge_boot_waiting'
        api = None
        if not waiting:
            binding = {'job_id': data['job_id'], 'plan_sha256': data['expected_plan_sha256'],
                       'arming_intent_sha256': o.checked['arming']['intent_sha256'], 'arming_proof_sha256': o.checked['arming_proof_sha256']}
            value = document(await service.exchange(owner, nonce, 'internal-browser-boot-observer-api', binding), mime=MIME, limit=4096); o.live()
            if (set(value) != {'kind', *binding, 'node_name', 'api_mac', 'noise_psk'} or value['kind'] != 'browser_bridge_boot_api_context' or
                    any(value[k] != v for k, v in binding.items()) or
                    not same({k: value[k] for k in ('node_name', 'api_mac')}, o.checked['api_identity']) or not isinstance(value['noise_psk'], str)): raise RelayRefusal
            raw = base64.b64decode(value['noise_psk'], validate=True)
            if len(raw) != 32 or base64.b64encode(raw).decode() != value['noise_psk']: raise RelayRefusal
            o.psk = value.pop('noise_psk'); api = await _wire(o)
        after = context(await service.exchange(owner, nonce, 'internal-browser-boot-observer-context', request), data); o.live()
        if not same(after, o.checked): raise RelayRefusal
        await o.cap.close(); o.live(closed=True)
        return {'job_id': data['job_id'], 'state': 'bridge_autostart_waiting_for_boot' if waiting else 'post_boot_bridge_observed',
                'runtime_observed': not waiting, 'hardware_contacted': True, 'device_writes': 0,
                'installed': False, 'activated': False, 'installation_ready': False, 'writer_enabled': False,
                'api': api, 'transport_closed': True, 'channel_closed': True}
    except BaseException:
        o.psk = None
        try: await o.cap.close()
        except BaseException: pass
        raise RelayRefusal from None
