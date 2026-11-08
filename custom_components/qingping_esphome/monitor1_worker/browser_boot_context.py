"""Read-only browser post-boot basis from immutable original arming history.

This is deliberately separate from the stopped-trial preparation. It neither
reacquires a writer lease nor fabricates native USB/trial receipts. A new live
observer may repeat reads, but cannot repeat the consumed flag transition.
"""
import base64
import hashlib
from pathlib import Path

from preparation import read_private, unique_json
from browser_disabled_policy import encoded, verify_source
from browser_bridge_boot_journal import BrowserBridgeBoot, INTENT, COMPLETE, invalid
from browser_initial_trial import checked

ROOT = Path(__file__).parent


def context(stages, owner, job, digest):
    def read():
        manager = BrowserBridgeBoot(stages)
        if manager.status(owner, job)['state'] != 'bridge_autostart_armed_next_boot_unverified': invalid()
        directory, record, intent_sha = manager._intent(owner, job)
        if record['plan_sha256'] != digest: invalid()
        intent, done = read_private(directory / INTENT), read_private(directory / COMPLETE)
        if hashlib.sha256(intent).hexdigest() != intent_sha or unique_json(intent) != record: invalid()
        _, source, plan, _, _ = checked(stages, owner, job, digest)
        contract = unique_json((ROOT / 'bridge-observer-contract.json').read_bytes())
        if (set(contract) != {'schema_version', 'source_commit', 'source_sha256', 'reads'} or
                type(contract['schema_version']) is not int or contract['schema_version'] != 1 or
                contract['source_commit'] != plan['basis']['source_commit']): invalid()
        verify_source(source, contract['source_sha256'])
        value = {'schema_version': 1, 'kind': 'browser_bridge_boot_observer_context',
                 'job_id': job, 'plan_sha256': digest, 'arming': manager._packet(record, intent_sha),
                 'arming_proof_sha256': hashlib.sha256(done).hexdigest(), 'api_identity': plan['api_identity'],
                 'producer_sha256': {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
                    for name in ('browser_boot_context.py', 'bridge-observer-contract.json')},
                 'context_only': True, 'writer_enabled': False, 'device_writes': 0}
        return value, intent, done
    first, last = read(), read()
    if encoded(first[0]) != encoded(last[0]) or first[1:] != last[1:]: invalid()
    return last[0]


MIME = 'application/vnd.qingping.internal-browser-boot-api+json'


def api_package(stages, owner, request):
    """Read the exact profile on the private Core pipe, never in a USB frame.

    Completed history authorizes a read observation, not a new writer. Core
    must independently retain its selected handle, original operation/actor
    and fresh current scope before requesting or using this private package.
    No SDK child, browser storage, key export or reusable connection is made.
    """
    try:
        fields = {'job_id', 'plan_sha256', 'arming_intent_sha256', 'arming_proof_sha256'}
        if not isinstance(request, dict) or set(request) != fields: invalid()
        before = context(stages, owner, request['job_id'], request['plan_sha256'])
        if (request['arming_intent_sha256'] != before['arming']['intent_sha256'] or
                request['arming_proof_sha256'] != before['arming_proof_sha256']): invalid()
        directory, plan = stages._plan(owner, request['job_id'], request['plan_sha256'])
        raw = read_private(directory / 'profile.json'); profile = unique_json(raw)
        if (hashlib.sha256(raw).hexdigest() != plan['basis']['profile_sha256'] or
                plan['api_identity'] != before['api_identity'] or
                plan['api_identity'] != {k: profile[k] for k in ('node_name', 'api_mac')} or
                not isinstance(profile['api_encryption_key'], str)): invalid()
        key = base64.b64decode(profile['api_encryption_key'], validate=True)
        if len(key) != 32 or base64.b64encode(key).decode() != profile['api_encryption_key']: invalid()
        result = encoded({'kind': 'browser_bridge_boot_api_context', **request, **before['api_identity'],
                          'noise_psk': profile['api_encryption_key']})
        if (len(result) > 4096 or read_private(directory / 'profile.json') != raw or
                stages._plan(owner, request['job_id'], request['plan_sha256']) != (directory, plan) or
                encoded(context(stages, owner, request['job_id'], request['plan_sha256'])) != encoded(before)): invalid()
        return result
    except Exception:
        invalid()  # Never expose raw profile/parser/path/transport exceptions.
