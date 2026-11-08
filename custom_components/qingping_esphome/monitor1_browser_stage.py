"""Private consumed-plan -> live WebUSB stage composition; no public route.

The Core caller must own the ordinary operation reservation. Only its checked
actor packet supplies file bodies. Browser HTTP may deliver finite frames but
cannot create this operation, submit a packet, choose a command or record proof.
This stops at a new disabled root, never vendor commit, execution or boot change.
"""
import base64
import hashlib
import json
from pathlib import Path
import re

from .monitor1_browser_relay import RelayRefusal

SOURCE = '53d97b9609e8e0fcdfc5d003101f620098dbc734'
MIME = 'application/vnd.qingping.internal-browser-stage+json'
ROLES = ('bridge-program', 'pm_qt_bridge.so', 'launch.sh', 'SnowApp-with-PM', 'startup-hook.sh',
         'stock-start.sh.original', 'stock-watchdog.sh.original', 'start.sh.candidate', 'watchdog.sh.candidate')
MAX_PACKET = 48 * 1024**2


def unique(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise RelayRefusal
        value[key] = item
    return value


def document(result, mime='application/json', limit=8192):
    ok, actual, raw = result
    if ok is not True or actual != mime or not isinstance(raw, bytes) or len(raw) > limit:
        raise RelayRefusal
    try:
        value = json.loads(raw, object_pairs_hook=unique)
    except Exception:
        raise RelayRefusal from None
    if not isinstance(value, dict):
        raise RelayRefusal
    return value


def packet(raw, context):
    """Rehash all private bodies before issuing even the first device frame.

    Canonical source pins come from the generated local contract, not an HTTP
    response. Metadata is detached from payloads; only bounded binary chunks
    enter the finite channel. No packet/key/body is returned as HTTP status.
    """
    value = document(raw, MIME, MAX_PACKET)
    keys = {'schema_version', 'job_id', 'target', 'requested_data_free_bytes', 'descriptor', 'stock_files', 'payloads'}
    if (set(value) != keys or type(value['schema_version']) is not int or value['schema_version'] != 1 or
            value['job_id'] != context['job_id'] or value['target'] != context['target'] or
            type(value['target'].get('co2_type')) is not int or
            type(value['requested_data_free_bytes']) is not int or value['requested_data_free_bytes'] != context['requested_data_free_bytes']):
        raise RelayRefusal
    desc = value['descriptor']
    if (not isinstance(desc, dict) or set(desc) != {'plan_id', 'plan_sha256', 'intent_sha256', 'files'} or
            desc['plan_id'] != context['plan_id'] or desc['plan_sha256'] != context['plan_sha256'] or
            not isinstance(desc['intent_sha256'], str) or not re.fullmatch('[a-f0-9]{64}', desc['intent_sha256']) or
            not isinstance(desc['files'], dict) or set(desc['files']) != set(ROLES) or
            not isinstance(value['payloads'], dict) or set(value['payloads']) != set(ROLES)):
        raise RelayRefusal
    contract = json.loads((Path(__file__).parent / 'monitor1_worker/contract.json').read_bytes())
    stock = {file['path']: {'size': file['size'], 'sha256': file['sha256']} for file in contract['files']}
    if (value['stock_files'] != stock or not isinstance(value['stock_files'], dict) or
            any(type(pin['size']) is not int for pin in value['stock_files'].values())):
        raise RelayRefusal
    bodies, total = {}, 0
    for role in ROLES:
        pin, encoded = desc['files'][role], value['payloads'][role]
        if (not isinstance(pin, dict) or set(pin) != {'size', 'sha256'} or type(pin['size']) is not int or
                not 0 < pin['size'] <= 16 * 1024**2 or not isinstance(pin['sha256'], str) or
                not re.fullmatch('[a-f0-9]{64}', pin['sha256']) or not isinstance(encoded, str) or
                len(encoded) != 4 * ((pin['size'] + 2) // 3)):
            raise RelayRefusal
        total += pin['size']
        if total > 32 * 1024**2:
            raise RelayRefusal
        try:
            body = base64.b64decode(encoded, validate=True)
        except Exception:
            raise RelayRefusal from None
        if (len(body) != pin['size'] or base64.b64encode(body).decode() != encoded or
                hashlib.sha256(body).hexdigest() != pin['sha256']):
            raise RelayRefusal
        bodies[role] = body
    if total + 8 * 1024**2 > context['requested_data_free_bytes']:
        raise RelayRefusal
    return {key: value[key] for key in ('schema_version', 'job_id', 'target', 'requested_data_free_bytes', 'descriptor')}, stock, bodies


async def stage(service, owner, nonce, data):
    """One private transfer; every lost ACK preserves the actor's consumed log.

    Status is a separate read of that log. Neither an exception nor cleanup
    restarts prepare, upload, root creation or terminal recording. The retained
    actor flock is released only by its exact recorded closed-transport proof.
    """
    keys = {'job_id', 'expected_plan_sha256', 'channel_id', 'experimental_reviewed'}
    if (not isinstance(data, dict) or set(data) != keys or data['experimental_reviewed'] is not True or
            any(not isinstance(data[key], str) for key in keys - {'experimental_reviewed'}) or
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
        context = document(await service.exchange(owner, nonce, 'internal-browser-stage-context',
            {'job_id': data['job_id'], 'expected_plan_sha256': data['expected_plan_sha256']}))
        fields = {'schema_version', 'job_id', 'plan_id', 'plan_sha256', 'source_commit', 'target', 'requested_data_free_bytes', 'stage_state'}
        if (set(context) != fields or type(context['schema_version']) is not int or context['schema_version'] != 1 or
                context['job_id'] != data['job_id'] or context['plan_sha256'] != data['expected_plan_sha256'] or
                context['source_commit'] != SOURCE or context['stage_state'] != 'not_started' or
                not isinstance(context['plan_id'], str) or not re.fullmatch('[a-f0-9]{32}', context['plan_id']) or
                type(context['requested_data_free_bytes']) is not int or not 0 < context['requested_data_free_bytes'] <= 256 * 1024**2):
            raise RelayRefusal
        scope = await registry.stage_admission(owner, nonce, data['channel_id'], context['target'], context['requested_data_free_bytes'])
        live()
        result = await service.exchange(owner, nonce, 'internal-browser-stage-prepare', {'job_id': data['job_id'],
            'expected_plan_sha256': data['expected_plan_sha256'], 'scope': scope, 'experimental_reviewed': True})
        meta, stock, bodies = packet(result, context)
        live()
        await cap.begin_stage(meta, stock)
        for role in ROLES:
            live()
            await cap.stage_begin_file(role)
            body = bodies.pop(role)
            for offset in range(0, len(body), 65536):
                live()
                await cap.stage_chunk(role, offset, body[offset:offset + 65536])
            await cap.stage_finish_file(role)
        live()
        proof = await cap.finish_stage()
        desc = meta['descriptor']
        marker = (desc['plan_id'] + ' ' + desc['plan_sha256'] + ' ' + desc['intent_sha256'] + '\n').encode()
        expected = {'plan_id': desc['plan_id'], 'plan_sha256': desc['plan_sha256'], 'intent_sha256': desc['intent_sha256'],
            'target': meta['target'], 'files': desc['files'], 'stock_files': stock, 'root_mode_uid': '700 0',
            'stage_metadata_mode_uid': '700 0', 'optouts_empty_regular': True, 'transport_closed': True,
            'vendor_files_changed': False, 'program_started': False, 'after_effects_sha256': hashlib.sha256(marker).hexdigest()}
        if (not isinstance(proof, dict) or proof != expected or
                any(proof[key] is not True for key in ('optouts_empty_regular', 'transport_closed')) or
                any(proof[key] is not False for key in ('vendor_files_changed', 'program_started')) or
                any(type(pin['size']) is not int for key in ('files', 'stock_files') for pin in proof[key].values())):
            raise RelayRefusal
        live()
        # The stage's actual USB close and the parent channel-close ACK are
        # independent. A late/failed close never releases the retained lease.
        await cap.close()
        live(closed=True)
        proof = {**proof, 'channel_id': scope['channel_id'], 'channel_nonce': scope['channel_nonce']}
        result = await service.exchange(owner, nonce, 'internal-browser-stage-record', {'job_id': data['job_id'],
            'intent_sha256': desc['intent_sha256'], 'proof': proof})
        public = document(result)
        fields = {'job_id', 'state', 'replay_allowed', 'installed', 'installation_ready', 'device_write_attempted', 'live_recheck_required'}
        if (set(public) != fields or public['job_id'] != data['job_id'] or public['state'] != 'staged_disabled_verified' or
                any(public[key] is not False for key in ('replay_allowed', 'installed', 'installation_ready')) or
                any(public[key] is not True for key in ('device_write_attempted', 'live_recheck_required'))):
            raise RelayRefusal
        return public
    except BaseException:
        try:
            await cap.close()
        except BaseException:
            pass  # Preserve unknown effects; do not retry writer or close ACK.
        raise RelayRefusal from None
