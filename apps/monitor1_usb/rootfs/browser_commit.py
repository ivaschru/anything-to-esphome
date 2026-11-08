"""Private consumed disabled-commit journal; no transport or device execution.

Preparation retains the shared native-install kernel lease before producing a
single metadata packet. Terminal proof needs three independent full snapshots
and acknowledged actual transport closure. A missing packet/ACK/record is never
zero-write evidence or permission to prepare again, repair or auto-rollback.
Only a future Core coordinator with the original live capability may call this
pipe-only engine; no initiating HTTP/UI route is provided.
"""
import hashlib
import json
import os
from pathlib import Path
import secrets

from preparation import PreparationError, owned_intent, read_private, unique_json, write_new
from build_worker import sync_directory
from browser_disabled_policy import checked_input, verify_source
from browser_disabled_observation import validate_assessment, validate_commit_observations

INTENT = 'browser-commit-intent.json'
COMPLETE = 'browser-commit-complete.json'
PHASES = ['claim', 'watchdog', 'start']
ROOT = Path(__file__).parent


def encoded(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':')) + '\n').encode()


def invalid():
    raise PreparationError('usb_browser_scope_unverified')


def producer():
    """Changed journal/template code never silently adopts consumed history."""
    return {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
            for name in ('browser_commit.py', 'disabled-write-contract.json')}


class BrowserCommits:
    def __init__(self, stages):
        self.stages, self.parent = stages, stages.parent

    def _base(self, owner, job_id, expected_sha, channel_id, channel_nonce, scope):
        directory, source, context, raw = checked_input(self.stages, owner, job_id, expected_sha, channel_id, channel_nonce, scope)
        write = unique_json((ROOT / 'disabled-write-contract.json').read_bytes())
        verify_source(source, write['source_sha256'])
        return directory, context, raw

    def prepare(self, owner, job_id, expected_sha, scope, reviewed):
        if reviewed is not True:
            raise PreparationError('usb_browser_stage_review_required')
        if not isinstance(scope, dict) or set(scope) != {'channel_id', 'channel_nonce', 'observation'}:
            invalid()
        directory, context, raw = self._base(owner, job_id, expected_sha, scope['channel_id'], scope['channel_nonce'], scope['observation'])
        if set(os.listdir(directory)) & {INTENT, COMPLETE}:
            raise PreparationError('usb_browser_stage_consumed')
        self.stages._hold_lease(job_id)
        try:
            self.stages.fence_all()
            assessment = self.stages.assess_disabled(owner, job_id, expected_sha, scope['channel_id'], scope['channel_nonce'], scope['observation'])
            validate_assessment(assessment, job_id, expected_sha, context['source_commit'], raw)
            if assessment['commit_admissible_for_review'] is not True:
                invalid()
            # Child analysis grants no cached write permission. Rehash the
            # exact source/stage again under the retained writer lock before
            # consuming the intent and returning its private packet once.
            again, after, checked = self._base(owner, job_id, expected_sha, scope['channel_id'], scope['channel_nonce'], scope['observation'])
            if again != directory or after != context or checked != raw:
                invalid()
            record = {'schema_version': 1, 'owner': owner, 'job_id': job_id, 'plan_sha256': expected_sha,
                      'channel_id': scope['channel_id'], 'channel_nonce': scope['channel_nonce'],
                      'nonce': secrets.token_hex(16), 'source_commit': context['source_commit'],
                      'initial_scope': scope['observation'], 'assessment': assessment, 'producer_sha256': producer(),
                      'consumed_before_packet': True}
            write_new(directory / INTENT, encoded(record))
            sync_directory(directory)  # Before a device writer can see metadata.
            return self._packet(record, hashlib.sha256(read_private(directory / INTENT)).hexdigest(), context)
        except BaseException:
            if INTENT not in os.listdir(directory):
                self.stages.close()
            raise

    def _intent(self, owner, job_id):
        directory, _, _ = owned_intent(self.parent, job_id, owner)
        raw = read_private(directory / INTENT)
        value = unique_json(raw)
        fields = {'schema_version', 'owner', 'job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'nonce',
                  'source_commit', 'initial_scope', 'assessment', 'producer_sha256', 'consumed_before_packet'}
        if (not isinstance(value, dict) or set(value) != fields or type(value['schema_version']) is not int or value['schema_version'] != 1 or
                value['owner'] != owner or value['job_id'] != job_id or value['producer_sha256'] != producer() or
                value['consumed_before_packet'] is not True or not isinstance(value['nonce'], str) or
                len(value['nonce']) != 32 or any(c not in '0123456789abcdef' for c in value['nonce'])):
            invalid()
        _, context, packet = self._base(owner, job_id, value['plan_sha256'], value['channel_id'], value['channel_nonce'], value['initial_scope'])
        validate_assessment(value['assessment'], job_id, value['plan_sha256'], context['source_commit'], packet)
        if value['source_commit'] != context['source_commit'] or value['assessment']['commit_admissible_for_review'] is not True:
            invalid()
        return directory, value, hashlib.sha256(raw).hexdigest(), context

    @staticmethod
    def _packet(value, digest, context):
        # Hashes/metadata only, no program/profile/key or arbitrary command.
        return {'schema_version': 1, 'job_id': value['job_id'], 'plan_sha256': value['plan_sha256'],
                'intent_sha256': digest, 'channel_id': value['channel_id'], 'channel_nonce': value['channel_nonce'],
                'nonce': value['nonce'], 'source_commit': value['source_commit'], 'meta': context['meta'],
                'initial_scope': value['initial_scope'], 'producer_sha256': value['producer_sha256']}

    def _proof(self, value, digest, context, proof):
        fields = {'schema_version', 'job_id', 'plan_sha256', 'intent_sha256', 'channel_id', 'channel_nonce',
                  'nonce', 'commands_acknowledged', 'observations', 'transport_closed', 'program_started', 'boot_flags_changed'}
        if (not isinstance(proof, dict) or set(proof) != fields or type(proof['schema_version']) is not int or proof['schema_version'] != 1 or
                any(proof[k] != value[k] for k in ('job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'nonce')) or
                proof['intent_sha256'] != digest or proof['commands_acknowledged'] != PHASES or
                proof['transport_closed'] is not True or proof['program_started'] is not False or proof['boot_flags_changed'] is not False or
                not isinstance(proof['observations'], list) or len(proof['observations']) != 3):
            invalid()
        meta = {**context['meta'], 'commit_nonce': value['nonce']}
        reader = unique_json((ROOT / 'disabled-contract.json').read_bytes())
        validate_commit_observations(proof['observations'], value['initial_scope'], meta, reader)

    def record(self, owner, job_id, intent_sha256, proof):
        directory, value, digest, context = self._intent(owner, job_id)
        if (digest != intent_sha256 or COMPLETE in os.listdir(directory) or
                self.stages.lease_fd is None or self.stages.lease_job != job_id):
            invalid()  # A reopened actor cannot adopt another process's lease.
        self._proof(value, digest, context, proof)
        write_new(directory / COMPLETE, encoded({'schema_version': 1, 'intent_sha256': digest, 'proof': proof}))
        sync_directory(directory)
        result = self.status(owner, job_id)
        self.stages.close()  # Only after exact proof; unknown history retains FD.
        return result

    def status(self, owner, job_id):
        directory, _, _ = owned_intent(self.parent, job_id, owner)
        names = set(os.listdir(directory))
        if INTENT not in names:
            if COMPLETE in names:
                invalid()  # Orphan history is not empty or retry permission.
            state = 'not_started'
        else:
            _, value, digest, context = self._intent(owner, job_id)
            state = 'browser_commit_unverified'
            if COMPLETE in names:
                complete = unique_json(read_private(directory / COMPLETE))
                if (not isinstance(complete, dict) or set(complete) != {'schema_version', 'intent_sha256', 'proof'} or
                        type(complete['schema_version']) is not int or complete['schema_version'] != 1 or complete['intent_sha256'] != digest):
                    invalid()
                self._proof(value, digest, context, complete['proof'])
                state = 'committed_disabled_verified'
        return {'job_id': job_id, 'state': state, 'replay_allowed': False, 'installed': False,
                'installation_ready': False, 'writer_enabled': False, 'activated': False,
                'device_write_attempted': False if state == 'not_started' else True if state == 'committed_disabled_verified' else None,
                'live_recheck_required': True}
