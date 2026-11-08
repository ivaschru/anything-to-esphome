"""Consume one browser first-trial packet before ANY RAM/device write.

This is only the private journal/payload half, with no device execution or
public initiator. Retain the shared writer lease and unknown durable history
after packet loss, read failure, actor shutdown or restart. Terminal guardian/
API/return verification is not implemented here yet: there is deliberately no
completion or lease-adoption API. A status can never authorize another packet.
"""
import base64
import hashlib
import os
from pathlib import Path
import re
import secrets

from preparation import PreparationError, owned_intent, read_private, unique_json, write_new
from build_worker import sync_directory
from browser_stage import private_bytes
from browser_initial_trial import context, checked
from browser_disabled_policy import encoded
from browser_initial_observation import validate_preparation

INTENT = 'browser-initial-trial-intent.json'
COMPLETE = 'browser-initial-trial-complete.json'
MIME = 'application/vnd.qingping.internal-browser-trial+json'
ROOT = Path(__file__).parent
PRODUCERS = ('browser_initial_journal.py', 'browser_initial_observation.py', 'browser_initial_trial.py',
             'browser_initial_trial_job.py', 'initial-trial-contract.json', 'initial-ram-contract.json', 'initial-guardian-contract.json', 'initial-process-contract.json', 'browser_initial_api.py', 'initial-scope-contract.json')


def invalid():
    raise PreparationError('usb_browser_scope_unverified')


def producer():
    """Old consumed packets cannot be adopted after a producer change."""
    return {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in PRODUCERS}


def scope_binding(scope):
    if (not isinstance(scope, dict) or set(scope) != {'channel_id', 'channel_nonce', 'observation'} or
            not isinstance(scope['channel_id'], str) or not re.fullmatch('[a-f0-9]{32}', scope['channel_id']) or
            not isinstance(scope['channel_nonce'], str) or not re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', scope['channel_nonce'])):
        invalid()


class BrowserInitialTrials:
    def __init__(self, stages):
        self.stages, self.parent = stages, stages.parent

    @staticmethod
    def _observation(value, scope):
        scope_binding(scope)
        reader = unique_json((ROOT / 'disabled-contract.json').read_bytes())
        try:
            validate_preparation(scope['observation'], value['meta'], reader, value['committed_scope'])
        except ValueError:
            invalid()

    def prepare(self, owner, job_id, expected_sha, scope, reviewed):
        if reviewed is not True:
            raise PreparationError('usb_browser_stage_review_required')
        scope_binding(scope)
        directory, _, _ = owned_intent(self.parent, job_id, owner)
        if set(os.listdir(directory)) & {INTENT, COMPLETE}:
            raise PreparationError('usb_browser_stage_consumed')
        self.stages._hold_lease(job_id)
        try:
            self.stages.fence_all()
            value = context(self.stages, owner, job_id, expected_sha)
            self._observation(value, scope)
            nonce, ram_job, guardian_job = (secrets.token_hex(16) for _ in range(3))
            if (any(not isinstance(v, str) or not re.fullmatch('[a-f0-9]{32}', v) for v in (nonce, ram_job, guardian_job)) or
                    len({nonce, ram_job, guardian_job}) != 3):
                invalid()  # Refuse a broken/colliding generator without an unbounded retry loop.
            record = {'schema_version': 1, 'owner': owner, 'job_id': job_id, 'plan_sha256': expected_sha,
                      'channel_id': scope['channel_id'], 'channel_nonce': scope['channel_nonce'],
                      'nonce': nonce, 'ram_job_id': ram_job, 'guardian_job_id': guardian_job,
                      'context': value, 'preparation': scope['observation'], 'producer_sha256': producer(),
                      'experimental_reviewed': True, 'consumed_before_packet': True}
            # O_EXCL and file+directory fsync precede the first private program
            # read/delivery. Even a failed/lost packet is permanently consumed.
            write_new(directory / INTENT, encoded(record))
            sync_directory(directory)
            body = private_bytes(directory / 'candidate/initial-trial-guardian-program', value['guardian'])
            after = context(self.stages, owner, job_id, expected_sha)
            if after != value or producer() != record['producer_sha256']:
                invalid()
            raw = read_private(directory / INTENT)
            if raw != encoded(record):
                invalid()
            return self._packet(record, hashlib.sha256(raw).hexdigest(), body)
        except BaseException:
            if INTENT not in os.listdir(directory):
                self.stages.close()
            raise

    @staticmethod
    def _packet(record, digest, body):
        packet = {k: record[k] for k in ('schema_version', 'job_id', 'plan_sha256', 'channel_id', 'channel_nonce',
                                         'nonce', 'ram_job_id', 'guardian_job_id', 'context', 'preparation', 'producer_sha256')}
        packet.update(intent_sha256=digest, guardian_body=base64.b64encode(body).decode())
        raw = encoded(packet)
        if len(raw) > 24 * 1024**2:
            invalid()
        return raw  # Only the private actor pipe/MIME, never normal HTTP status.

    def _intent(self, owner, job_id):
        directory, _, _ = owned_intent(self.parent, job_id, owner)
        record = unique_json(read_private(directory / INTENT))
        fields = {'schema_version', 'owner', 'job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'nonce',
                  'ram_job_id', 'guardian_job_id', 'context', 'preparation', 'producer_sha256', 'experimental_reviewed', 'consumed_before_packet'}
        if (not isinstance(record, dict) or set(record) != fields or type(record['schema_version']) is not int or
                record['schema_version'] != 1 or record['owner'] != owner or record['job_id'] != job_id or
                record['consumed_before_packet'] is not True or record['experimental_reviewed'] is not True or record['producer_sha256'] != producer() or
                any(not isinstance(record[k], str) or not re.fullmatch('[a-f0-9]{32}', record[k]) for k in
                    ('nonce', 'ram_job_id', 'guardian_job_id')) or
                len({record[k] for k in ('nonce', 'ram_job_id', 'guardian_job_id')}) != 3):
            invalid()
        # A status hashes/validates original files only. It never executes a
        # fresh SDK, initializes ADB or adopts the previous actor's lease.
        again, _, _, value, _ = checked(self.stages, owner, job_id, record['plan_sha256'])
        value['guardian_artifact_checked'] = True  # Historical original SDK result, not a fresh execution.
        if again != directory or value != record['context']:
            invalid()
        self._observation(value, {'channel_id': record['channel_id'], 'channel_nonce': record['channel_nonce'],
                                  'observation': record['preparation']})
        return record

    def status(self, owner, job_id):
        directory, _, _ = owned_intent(self.parent, job_id, owner)
        names = set(os.listdir(directory))
        if COMPLETE in names:
            invalid()  # No terminal proof reader exists yet; never trust a file named complete.
        state = 'not_started'
        if INTENT in names:
            self._intent(owner, job_id)
            state = 'browser_initial_trial_unverified'
        return {'job_id': job_id, 'state': state, 'replay_allowed': False, 'installed': False,
                'installation_ready': False, 'writer_enabled': False, 'activated': False,
                'device_write_attempted': False if state == 'not_started' else None,
                'launch_attempted': False if state == 'not_started' else None, 'live_recheck_required': True}
