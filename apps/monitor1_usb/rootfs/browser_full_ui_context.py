"""Private post-PM basis for a NEW Full UI WebUSB selection.

Read the original completed PM journal twice, preserving its exact intent and
proof bytes. This is neither native USB evidence nor writer/lease adoption.
The private API package is separate so normal metadata never contains a key.
"""
import base64
import hashlib
from pathlib import Path

from preparation import read_private, unique_json
from browser_disabled_policy import encoded
from browser_pm_boot_journal import BrowserPmBoot, INTENT, COMPLETE, invalid

ROOT = Path(__file__).parent
PRODUCERS = ('browser_full_ui_context.py', 'full_ui_review.py', 'full_ui_trial.py', 'full_ui_activation.py')
MIME = 'application/vnd.qingping.internal-browser-full-ui-api+json'


def context(stages, owner, job, sha):
    def read():
        pm = BrowserPmBoot(stages)
        directory, record, digest = pm._intent(owner, job)
        if record['plan_sha256'] != sha: invalid()
        raw, done = read_private(directory / INTENT), read_private(directory / COMPLETE)
        if hashlib.sha256(raw).hexdigest() != digest or unique_json(raw) != record: invalid()
        # Validate the terminal proof against this SAME already rehashed intent.
        # Calling status here would independently re-expand the complete source
        # closure again; it supplies no additional observation or authority.
        terminal = unique_json(done)
        if (not isinstance(terminal, dict) or set(terminal) != {'schema_version', 'intent_sha256', 'proof'} or
                type(terminal['schema_version']) is not int or terminal['schema_version'] != 1 or terminal['intent_sha256'] != digest): invalid()
        pm._proof(record, digest, terminal['proof'])
        _, plan = stages._plan(owner, job, sha)
        value = {'schema_version': 1, 'kind': 'browser_full_ui_context', 'job_id': job, 'plan_sha256': sha,
                 'source_commit': plan['basis']['source_commit'], 'pm_intent_sha256': digest,
                 'pm_proof_sha256': hashlib.sha256(done).hexdigest(), 'target': plan['target'],
                 'pm_armed_boot': record['observation']['scope']['target']['boot_id'],
                 'api_identity': plan['api_identity'], 'bridge': plan['files']['bridge-program'],
                 'native_pair': record['native_pair'],
                 'producer_sha256': {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in PRODUCERS},
                 'context_only': True, 'writer_enabled': False, 'device_writes': 0}
        return value, raw, done
    before, after = read(), read()
    if encoded(before[0]) != encoded(after[0]) or before[1:] != after[1:]: invalid()
    return after[0]


def api_package(stages, owner, request):
    """Private Core pipe only; no key in frames, SDK, HTTP or normal reports."""
    try:
        fields = {'job_id', 'plan_sha256', 'pm_intent_sha256', 'pm_proof_sha256'}
        if not isinstance(request, dict) or set(request) != fields: invalid()
        before = context(stages, owner, request['job_id'], request['plan_sha256'])
        if any(request[k] != before[k] for k in fields): invalid()
        directory, plan = stages._plan(owner, request['job_id'], request['plan_sha256'])
        raw = read_private(directory / 'profile.json'); profile = unique_json(raw)
        if (hashlib.sha256(raw).hexdigest() != plan['basis']['profile_sha256'] or
                {k: profile[k] for k in ('node_name', 'api_mac')} != before['api_identity'] or
                not isinstance(profile['api_encryption_key'], str)): invalid()
        key = base64.b64decode(profile['api_encryption_key'], validate=True)
        if len(key) != 32 or base64.b64encode(key).decode() != profile['api_encryption_key']: invalid()
        result = encoded({'kind': 'browser_full_ui_api_context', **request, **before['api_identity'],
                          'noise_psk': profile['api_encryption_key']})
        if (len(result) > 4096 or read_private(directory / 'profile.json') != raw or
                stages._plan(owner, request['job_id'], request['plan_sha256']) != (directory, plan) or
                encoded(context(stages, owner, request['job_id'], request['plan_sha256'])) != encoded(before)): invalid()
        return result
    except Exception:
        invalid()
