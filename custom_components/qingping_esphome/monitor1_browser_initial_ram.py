"""Private consumed trial -> original live RAM transfer; no public initiator.

This stops before chmod/exec and device image-FD admission. The private caller
must hold the ordinary service reservation. Success returns an in-memory live
handoff, never a serializable handle, terminal journal record or installed
status. The actor's shared lease/history stay retained until a separate real
bounded trial lifecycle has its terminal proof. Failure closes only this
original channel and preserves all uncertain device effects without replay.
"""
import asyncio
import base64
import copy
import hashlib
import json
from pathlib import Path
import re

from .monitor1_browser_relay import RelayRefusal
from .monitor1_browser_stage import document
from .monitor1_browser_initial_review import context, validate_preparation

ROOT = Path(__file__).parent / 'monitor1_worker'
PRODUCERS = ('browser_initial_journal.py', 'browser_initial_observation.py', 'browser_initial_trial.py',
             'browser_initial_trial_job.py', 'initial-trial-contract.json', 'initial-ram-contract.json', 'initial-guardian-contract.json')
MIME = 'application/vnd.qingping.internal-browser-trial+json'
EMPTY = hashlib.sha256(b'').hexdigest()
RESERVE = 8 * 1024**2
BINDING = ('job_id', 'plan_sha256', 'intent_sha256', 'channel_id', 'channel_nonce', 'nonce', 'ram_job_id', 'guardian_job_id')


def same(left, right):
    # Python bool/int equality is too permissive for JSON protocol evidence.
    # Canonical bytes retain false vs 0 and integer vs float distinctions.
    try:
        encode = lambda value: json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)
        return encode(left) == encode(right)
    except (TypeError, ValueError):
        raise RelayRefusal from None


def producer():
    return {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in PRODUCERS}


def packet(result, checked, observed, channel_id, channel_nonce):
    value = document(result, mime=MIME, limit=24 * 1024**2)
    fields = {'schema_version', *BINDING, 'context', 'preparation', 'producer_sha256', 'guardian_body'}
    if (set(value) != fields or type(value['schema_version']) is not int or value['schema_version'] != 1 or
            value['job_id'] != checked['job_id'] or value['plan_sha256'] != checked['plan_sha256'] or
            not same(value['context'], checked) or not same(value['preparation'], observed) or value['channel_id'] != channel_id or
            value['channel_nonce'] != channel_nonce or value['producer_sha256'] != producer() or
            not isinstance(value['intent_sha256'], str) or not re.fullmatch('[a-f0-9]{64}', value['intent_sha256']) or
            any(not isinstance(value[k], str) or not re.fullmatch('[a-f0-9]{32}', value[k]) for k in ('nonce', 'ram_job_id', 'guardian_job_id')) or
            len({value[k] for k in ('nonce', 'ram_job_id', 'guardian_job_id')}) != 3 or not isinstance(value['guardian_body'], str)):
        raise RelayRefusal
    try:
        body = base64.b64decode(value['guardian_body'], validate=True)
    except Exception:
        raise RelayRefusal from None
    if (len(body) != checked['guardian']['size'] or base64.b64encode(body).decode() != value['guardian_body'] or
            hashlib.sha256(body).hexdigest() != checked['guardian']['sha256']):
        raise RelayRefusal
    return {k: v for k, v in value.items() if k != 'guardian_body'}, body


def observation(value, prepared, *, uploaded=False, previous=None):
    fields = {'kind', 'phase', *BINDING, 'ram_root_identity', 'guardian_root_identity', 'guardian_file_identity',
              'guardian_size', 'guardian_sha256', 'tmpfs_available_bytes', 'image_fd_admitted', 'execution_authority', 'context_only'}
    pin = prepared['context']['guardian']
    size, sha = (pin['size'], pin['sha256']) if uploaded else (0, EMPTY)
    if (not isinstance(value, dict) or set(value) != fields or value['kind'] != 'browser_initial_ram_observation' or
            value['phase'] != ('uploaded' if uploaded else 'precreated') or any(value[k] != prepared[k] for k in BINDING) or
            type(value['guardian_size']) is not int or value['guardian_size'] != size or value['guardian_sha256'] != sha or
            value['image_fd_admitted'] is not False or value['execution_authority'] is not False or value['context_only'] is not True or
            type(value['tmpfs_available_bytes']) is not int or
            not RESERVE + (0 if uploaded else pin['size']) <= value['tmpfs_available_bytes'] <= 2147483647):
        raise RelayRefusal
    identities = [value[k] for k in ('ram_root_identity', 'guardian_root_identity', 'guardian_file_identity')]
    if (any(not isinstance(v, list) or len(v) != 2 or any(type(n) is not int or not 1 <= n < 2**53 for n in v) for v in identities) or
            len({v[0] for v in identities}) != 1 or len({v[1] for v in identities}) != 3):
        raise RelayRefusal
    if previous is not None:
        observation(previous, prepared)
        if any(value[k] != previous[k] for k in ('ram_root_identity', 'guardian_root_identity', 'guardian_file_identity')):
            raise RelayRefusal


def proof(value, prepared, precreated, reader):
    fields = {'kind', 'precreated', 'uploaded', 'preparation', 'transport_closed', 'guardian_started',
              'image_fd_admitted', 'execution_authority', 'context_only'}
    if (not isinstance(value, dict) or set(value) != fields or value['kind'] != 'browser_initial_ram_ready' or
            not same(value['precreated'], precreated) or value['context_only'] is not True or
            any(value[k] is not False for k in ('transport_closed', 'guardian_started', 'image_fd_admitted', 'execution_authority'))):
        raise RelayRefusal
    observation(precreated, prepared)
    observation(value['uploaded'], prepared, uploaded=True, previous=precreated)
    validate_preparation(value['preparation'], prepared['context']['meta'], reader, prepared['context']['committed_scope'])


def operation_live(service, operation):
    # Check BEFORE the first pipe read too: even read-only SDK requests cannot
    # race another operation on Core's single request/response stream.
    lock = getattr(service, 'lock', None)
    if (operation is None or asyncio.current_task() is not operation or getattr(service, 'pending', None) is not operation or
            operation.done() or getattr(service, 'closing', True) is not False or getattr(service, 'failed', True) is not False or
            getattr(lock, 'locked', lambda: False)() is not True):
        raise RelayRefusal


def actor_live(service, actor, operation):
    # The exact still-running shielded task binds the reservation cycle. A new
    # worker/lock or serialized history cannot adopt the consumed kernel lease.
    operation_live(service, operation)
    if actor is None or getattr(service, 'process', None) is not actor or getattr(actor, 'returncode', 0) is not None:
        raise RelayRefusal


class PreparedBrowserRam:
    """Private live object; JSON IDs cannot recreate the original actor/lock.

    Metadata properties return copies so a later private helper cannot silently
    replace the original pins. No method launches code or releases the lease.
    """
    __slots__ = ('registry', 'current', 'capability', 'owner', 'nonce', 'channel_id', '_packet', '_proof', '_service', '_actor', '_operation', '_guardian_used')

    def __init__(self, service, actor, operation, registry, current, cap, owner, nonce, channel_id, prepared, result):
        self.registry, self.current, self.capability = registry, current, cap
        self.owner, self.nonce, self.channel_id = owner, nonce, channel_id
        self._packet, self._proof = copy.deepcopy(prepared), copy.deepcopy(result)
        self._service, self._actor, self._operation = service, actor, operation
        self._guardian_used = False

    @property
    def packet(self):
        return copy.deepcopy(self._packet)  # Metadata only, no guardian body/key.

    @property
    def proof(self):
        return copy.deepcopy(self._proof)

    def live(self):
        actor_live(self._service, self._actor, self._operation)
        if (self.registry.current is not self.current or
                self.registry.capability(self.owner, self.nonce, self.channel_id) is not self.capability or
                self.capability.closed or self.capability.failed or self._packet['producer_sha256'] != producer()):
            raise RelayRefusal

    async def close(self):
        await self.capability.close()  # Separate actor terminal proof is still absent.

    def claim_guardian(self):
        """Consume the continuation in this same live task before any SDK IO.

        This is not another journal/lease or a serializable permission. The
        original actor already consumed its durable trial intent before RAM;
        failure here or later cannot renew that attempt or release its fence.
        """
        self.live()
        if self._guardian_used:
            raise RelayRefusal
        self._guardian_used = True


async def prepare_ram(service, owner, nonce, data):
    fields = {'job_id', 'expected_plan_sha256', 'channel_id', 'experimental_reviewed'}
    if (not isinstance(data, dict) or set(data) != fields or data['experimental_reviewed'] is not True or
            any(not isinstance(data[k], str) for k in fields - {'experimental_reviewed'}) or
            not re.fullmatch('[a-f0-9]{32}', data['job_id']) or not re.fullmatch('[a-f0-9]{32}', data['channel_id']) or
            not re.fullmatch('[a-f0-9]{64}', data['expected_plan_sha256']) or service.browser_registry is None):
        raise RelayRefusal
    registry = service.browser_registry
    cap = registry.capability(owner, nonce, data['channel_id'])
    original = registry.current
    actor = None
    operation = asyncio.current_task()

    def live():
        operation_live(service, operation)
        if actor is not None:
            actor_live(service, actor, operation)
        if (registry.current is not original or registry.capability(owner, nonce, data['channel_id']) is not cap or cap.closed or cap.failed):
            raise RelayRefusal

    request = {k: data[k] for k in ('job_id', 'expected_plan_sha256')}
    body = None
    try:
        live()
        checked, reader = context(await service.exchange(owner, nonce, 'internal-browser-initial-trial-context', request), data)
        actor = getattr(service, 'process', None)
        actor_live(service, actor, operation)
        live()
        await cap.probe_initial_ram_stream()  # Positive harmless exec BEFORE consuming actor intent.
        live()
        observed = await registry.initial_trial_preparation(owner, nonce, data['channel_id'], checked['meta'])
        validate_preparation(observed, checked['meta'], reader, checked['committed_scope'])
        live()
        prepared, body = packet(await service.exchange(owner, nonce, 'internal-browser-initial-trial-prepare',
            {**request, 'experimental_reviewed': True, 'scope': {'channel_id': data['channel_id'],
             'channel_nonce': original['reported_evidence']['channel'], 'observation': observed}}),
            checked, observed, data['channel_id'], original['reported_evidence']['channel'])
        live()
        if prepared['producer_sha256'] != producer():
            raise RelayRefusal
        precreated = await cap.begin_initial_ram(prepared)
        observation(precreated, prepared)
        for offset in range(0, len(body), 65536):
            live()
            await cap.initial_ram_chunk(offset, body[offset:offset + 65536])
        body = None  # Retire private bytes before further source/proof reads.
        live()
        result = await cap.finish_initial_ram()
        proof(result, prepared, precreated, reader)
        live()
        after, _ = context(await service.exchange(owner, nonce, 'internal-browser-initial-trial-context', request), data)
        if not same(after, checked) or prepared['producer_sha256'] != producer():
            raise RelayRefusal
        live()
        handoff = PreparedBrowserRam(service, actor, operation, registry, original, cap, owner, nonce, data['channel_id'], prepared, result)
        handoff.live()
        return handoff  # Not a public response, terminal record or execution grant.
    except BaseException:
        try:
            await cap.close()
        except BaseException:
            pass
        raise RelayRefusal from None
    finally:
        body = None
