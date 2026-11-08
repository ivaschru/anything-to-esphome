"""Pure explicit armed-state comparison; never a relabeled disabled snapshot."""
import hashlib
import json
import re


class ObservationRefusal(ValueError):
    pass


def same(left, right):
    # Python considers True/1 and 1/1.0 equal. Evidence comparison must not.
    return json.dumps(left, sort_keys=True, allow_nan=False) == json.dumps(right, sort_keys=True, allow_nan=False)


def completion_pin(meta, nonce):
    if not isinstance(nonce, str) or not re.fullmatch('[a-f0-9]{32}', nonce):
        raise ObservationRefusal
    body = ('arm ' + nonce + ' ' + meta['descriptor']['plan_id'] + ' ' + meta['descriptor']['plan_sha256'] + '\n').encode('ascii')
    return {'size': len(body), 'sha256': hashlib.sha256(body).hexdigest()}


def validate_armed(value, baseline, marker):
    """Only the explicit bridge/recovery flag transition may differ.

    baseline has already passed the complete disabled/preparation validator.
    Do not convert the current armed state into a fictitious disabled Snapshot.
    Compare invariant source/vendor/root/stock/plan fields directly; capacity
    alone may fluctuate. The new completion marker proves AFTER-effects only.
    """
    fields = (set(baseline) - {'disabled_flags'}) | {'boot_flags', 'arm_marker'}
    flags = {'bridge_disabled': False, 'recovery_backup': True, 'pm_disabled': True}
    if (not isinstance(value, dict) or set(value) != fields or value['kind'] != 'browser_bridge_armed_scope' or
            not same(value['boot_flags'], flags) or not same(value['arm_marker'], marker) or
            type(value['data_available_bytes']) is not int or not 8 * 1024**2 <= value['data_available_bytes'] < 2**53):
        raise ObservationRefusal
    exclude = {'kind', 'disabled_flags', 'boot_flags', 'arm_marker', 'data_available_bytes'}
    if not same({k: v for k, v in value.items() if k not in exclude},
                {k: v for k, v in baseline.items() if k not in exclude}):
        raise ObservationRefusal
