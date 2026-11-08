"""Pure typed PM admission/terminal comparisons; no transport or execution."""
import math
import re

# The standalone worker and HA package share these pure comparisons. Relative
# import is used inside HA; only the standalone actor resolves the same local
# helper by its top-level name. Neither path loads a journal/SDK dependency.
try:
    from .browser_bridge_boot_observation import same
except ImportError:
    from browser_bridge_boot_observation import same


def validate_scope(scope, context):
    fields = {'kind', 'job_id', 'plan_sha256', 'arming_intent_sha256', 'arming_proof_sha256', 'target',
              'root_identity', 'processes', 'pm_disabled', 'recovery_backup', 'bridge_disabled',
              'canonical_scope_checked', 'memory_free_bytes', 'memory_total_bytes', 'context_only', 'device_writes'}
    old = context['arming']['context']['meta']['target']
    if (not isinstance(scope, dict) or set(scope) != fields or scope['kind'] != 'browser_bridge_boot_runtime_scope' or
            scope['job_id'] != context['job_id'] or scope['plan_sha256'] != context['plan_sha256'] or
            scope['arming_intent_sha256'] != context['arming']['intent_sha256'] or
            scope['arming_proof_sha256'] != context['arming_proof_sha256'] or not isinstance(scope['target'], dict) or
            set(scope['target']) != set(old) or not isinstance(scope['target']['boot_id'], str) or
            not re.fullmatch('[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', scope['target']['boot_id']) or
            scope['target']['boot_id'] == old['boot_id'] or not same({**scope['target'], 'boot_id': old['boot_id']}, old) or
            not same(scope['root_identity'], context['arming']['preparation']['preparation']['scope']['root_identity']) or
            any(scope[k] is not True for k in ('pm_disabled', 'recovery_backup', 'canonical_scope_checked', 'context_only')) or
            scope['bridge_disabled'] is not False or type(scope['device_writes']) is not int or scope['device_writes'] != 0 or
            any(type(scope[k]) is not int for k in ('memory_free_bytes', 'memory_total_bytes')) or
            not 8 * 1024**2 <= scope['memory_free_bytes'] <= scope['memory_total_bytes'] <= 2**40): raise ValueError
    p = scope['processes']
    if (not isinstance(p, dict) or set(p) != {'child', 'supervisor', 'stock', 'watchdog'} or
            any(not isinstance(v, list) or len(v) != 3 or type(v[0]) is not int or not 2 <= v[0] <= 2147483647 or
                type(v[1]) is not int or not 1 <= v[1] <= 2147483647 or not isinstance(v[2], str) or
                not re.fullmatch('[1-9][0-9]{0,19}', v[2]) or not 0 < int(v[2]) < 2**64 for v in p.values()) or
            len({v[0] for v in p.values()}) != 4 or p['child'][1] != p['supervisor'][0] or p['stock'][1] != p['watchdog'][0]): raise ValueError


def validate_wire(wire, context):
    fields = {'samples', 'last_sample_age_at_prepare_s', 'identity', 'api_closed', 'final_scope_checked'}
    if (not isinstance(wire, dict) or set(wire) != fields or type(wire['samples']) is not int or not 2 <= wire['samples'] <= 32 or
            type(wire['last_sample_age_at_prepare_s']) not in (int, float) or not math.isfinite(wire['last_sample_age_at_prepare_s']) or
            not 0 <= wire['last_sample_age_at_prepare_s'] <= 20 or not same(wire['identity'], context['api_identity']) or
            wire['api_closed'] is not True or wire['final_scope_checked'] is not True): raise ValueError
