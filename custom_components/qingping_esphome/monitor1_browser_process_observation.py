"""Pure original-binding validation of the fixed process observation subset.

This has no IO, process adoption or terminal journal action. Both the channel
and Core independently join returned context to their own retained metadata;
reported JSON alone never acquires the original task/actor/USB capability.
"""
import re

from .monitor1_browser_relay import RelayRefusal

BINDING = ('job_id', 'plan_sha256', 'intent_sha256', 'channel_id', 'channel_nonce', 'nonce', 'ram_job_id', 'guardian_job_id')


def decimal(value):
    return (isinstance(value, str) and re.fullmatch('[1-9][0-9]{0,19}', value) is not None and int(value) < 2**64)


def stamp(value):
    return (isinstance(value, list) and len(value) == 2 and type(value[0]) is int and
            2 <= value[0] <= 2147483647 and decimal(value[1]))


def validate_context(binding, started, root_device, guardian_identity):
    if not isinstance(binding, dict) or set(binding) != set(BINDING):
        raise RelayRefusal
    for key in BINDING:
        pattern = ('[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}' if key == 'channel_nonce' else
                   '[a-f0-9]{64}' if key in ('plan_sha256', 'intent_sha256') else '[a-f0-9]{32}')
        if not isinstance(binding[key], str) or not re.fullmatch(pattern, binding[key]):
            raise RelayRefusal
    if (not isinstance(started, dict) or set(started) != {'kind', 'start', 'child', 'records_only'} or
            started['kind'] != 'browser_initial_guardian_started_record' or started['records_only'] is not True or
            type(root_device) is not int or not 1 <= root_device < 2**53 or
            not isinstance(guardian_identity, list) or len(guardian_identity) != 2 or
            any(type(v) is not int or not 1 <= v < 2**53 for v in guardian_identity)):
        raise RelayRefusal
    for key in ('start', 'child'):
        record = started[key]
        if (not isinstance(record, dict) or set(record) != {'kind', 'nonce', 'stamp'} or record['kind'] != key or
                record['nonce'] != binding['nonce'] or not stamp(record['stamp'])):
            raise RelayRefusal
    if started['start']['stamp'][0] == started['child']['stamp'][0]:
        raise RelayRefusal


def validate_observation(value, binding, started, root_device, guardian_identity):
    validate_context(binding, started, root_device, guardian_identity)
    fields = {'kind', *BINDING, 'guardian', 'child', 'guardian_parent', 'guardian_image', 'child_image',
              'kernel_child_checked', 'process_images_checked', 'endpoint_ownership_checked',
              'image_fd_admitted', 'execution_authority', 'context_only'}
    if (not isinstance(value, dict) or set(value) != fields or value['kind'] != 'browser_initial_process_observation' or
            any(not isinstance(value[k], str) or value[k] != binding[k] for k in BINDING) or
            any(value[k] is not True for k in ('kernel_child_checked', 'process_images_checked', 'endpoint_ownership_checked', 'context_only')) or
            value['image_fd_admitted'] is not False or value['execution_authority'] is not False or
            not stamp(value['guardian']) or not stamp(value['child']) or
            value['guardian'] != started['start']['stamp'] or value['child'] != started['child']['stamp'] or
            type(value['guardian_parent']) is not int or not 1 <= value['guardian_parent'] <= 2147483647):
        raise RelayRefusal
    for key in ('guardian_image', 'child_image'):
        pair = value[key]
        if not isinstance(pair, list) or len(pair) != 2 or not all(decimal(v) for v in pair):
            raise RelayRefusal
    if (value['guardian_image'] != list(map(str, guardian_identity)) or value['child_image'][0] != str(root_device)):
        raise RelayRefusal
