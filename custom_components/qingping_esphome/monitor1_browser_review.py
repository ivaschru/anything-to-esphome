"""Fresh WebUSB scope against a detached owned plan, strictly read-only.

This public operation accepts only IDs, never a host/path/key or claimed target.
The private actor supplies its rehashed target; the original live browser handle
performs its fixed read again. Positive scope is not a writer grant or cached
permission for another boot, channel, launch or installation request.
"""
import json
import re

from .monitor1_browser_relay import RelayRefusal

SOURCE = '53d97b9609e8e0fcdfc5d003101f620098dbc734'


async def review(service, user, nonce, data):
    keys = {'job_id', 'expected_plan_sha256', 'channel_id'}
    if (not isinstance(data, dict) or set(data) != keys or
            any(not isinstance(data[k], str) for k in keys) or
            not re.fullmatch(r'[a-f0-9]{32}', data['job_id']) or
            not re.fullmatch(r'[a-f0-9]{32}', data['channel_id']) or
            not re.fullmatch(r'[a-f0-9]{64}', data['expected_plan_sha256']) or service.browser_registry is None):
        raise RelayRefusal
    registry = service.browser_registry
    # Reject an unavailable/foreign/expired channel before any actor IO.
    registry.capability(user, nonce, data['channel_id'])
    ok, mime, raw = await service.exchange(user, nonce, 'internal-browser-plan-context',
        {'job_id': data['job_id'], 'expected_plan_sha256': data['expected_plan_sha256']})
    if not ok or mime != 'application/json' or not isinstance(raw, bytes) or len(raw) > 8192:
        raise RelayRefusal
    try:
        context = json.loads(raw)
        if (not isinstance(context, dict) or
                set(context) != {'schema_version', 'job_id', 'plan_sha256', 'source_commit', 'target', 'writer_enabled'} or
                type(context['schema_version']) is not int or context['schema_version'] != 1 or
                context['job_id'] != data['job_id'] or context['plan_sha256'] != data['expected_plan_sha256'] or
                context['source_commit'] != SOURCE or context['writer_enabled'] is not False):
            raise RelayRefusal
        await registry.check_plan(user, nonce, data['channel_id'], context['target'])
    except BaseException:
        raise RelayRefusal from None
    return {'job_id': data['job_id'], 'plan_sha256': data['expected_plan_sha256'],
            'state': 'browser_scope_verified', 'hardware_contacted': True, 'device_writes': 0,
            'installed': False, 'installation_ready': False, 'writer_enabled': False,
            'native_get_devpath': False, 'live_recheck_required': True}
