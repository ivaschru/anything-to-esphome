"""Separate consumed browser next-boot intent; no device executor or replay.

The same private actor must hold its original kernel lease from packet issue
through independent flag/readback/USB/channel proof. A crash-released FD is
not permission to adopt an uncertain attempt or create another packet.
"""
import hashlib
import os
from pathlib import Path
import secrets

from preparation import PreparationError, owned_intent, read_private, unique_json, write_new
from build_worker import sync_directory
from browser_disabled_policy import encoded
from browser_initial_journal import BrowserInitialTrials, scope_binding
from browser_initial_observation import validate_preparation
from browser_bridge_boot import context
from browser_bridge_boot_observation import same, completion_pin, validate_armed

ROOT = Path(__file__).parent
INTENT = 'browser-bridge-boot-intent.json'
COMPLETE = 'browser-bridge-boot-complete.json'
PHASES = ['before', 'arm', 'armed', 'complete']


def invalid():
    raise PreparationError('usb_browser_scope_unverified')


def producer():
    return {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in
            ('browser_bridge_boot_journal.py', 'browser_bridge_boot_observation.py', 'browser_bridge_boot.py', 'bridge-next-boot-contract.json')}


def preparation(value, basis):
    if (not isinstance(value, dict) or set(value) != {'kind', 'preparation', 'trial_marker', 'trial_marker_checked', 'context_only'} or
            value['kind'] != 'browser_bridge_boot_preparation' or value['trial_marker_checked'] is not True or
            value['context_only'] is not True or not same(value['trial_marker'], basis['trial_marker'])):
        invalid()
    reader = unique_json((ROOT / 'disabled-contract.json').read_bytes())
    validate_preparation(value['preparation'], basis['meta'], reader, basis['committed_scope'])


class BrowserBridgeBoot:
    def __init__(self, stages):
        self.stages, self.parent = stages, stages.parent

    def prepare(self, owner, job, expected_sha, scope, reviewed):
        if reviewed is not True:
            raise PreparationError('usb_browser_stage_review_required')
        scope_binding(scope)
        directory, _, _ = owned_intent(self.parent, job, owner)
        if set(os.listdir(directory)) & {INTENT, COMPLETE}:
            raise PreparationError('usb_browser_stage_consumed')
        self.stages._hold_lease(job)
        try:
            self.stages.fence_all()
            basis = context(self.stages, owner, job, expected_sha)
            preparation(scope['observation'], basis)
            old = BrowserInitialTrials(self.stages)._intent(owner, job)
            nonce = secrets.token_hex(16)
            if (scope['channel_id'] == old['channel_id'] or scope['channel_nonce'] == old['channel_nonce'] or
                    not isinstance(nonce, str) or len(nonce) != 32 or any(c not in '0123456789abcdef' for c in nonce) or
                    nonce in (old['nonce'], basis['meta']['commit_nonce'])):
                invalid()  # A new selection/intent is distinct from the consumed trial/commit.
            record = {'schema_version': 1, 'owner': owner, 'job_id': job, 'plan_sha256': expected_sha,
                      'channel_id': scope['channel_id'], 'channel_nonce': scope['channel_nonce'], 'nonce': nonce,
                      'context': basis, 'preparation': scope['observation'], 'producer_sha256': producer(),
                      'experimental_reviewed': True, 'consumed_before_packet': True}
            write_new(directory / INTENT, encoded(record))
            sync_directory(directory)  # BEFORE any flag-changing packet can leave this actor.
            if not same(context(self.stages, owner, job, expected_sha), basis) or producer() != record['producer_sha256']:
                invalid()
            raw = read_private(directory / INTENT)
            if raw != encoded(record): invalid()
            return self._packet(record, hashlib.sha256(raw).hexdigest())
        except BaseException:
            if INTENT not in os.listdir(directory): self.stages.close()
            raise

    @staticmethod
    def _packet(value, digest):
        packet = {k: value[k] for k in ('schema_version', 'job_id', 'plan_sha256', 'channel_id', 'channel_nonce',
                                       'nonce', 'context', 'preparation', 'producer_sha256')}
        return {**packet, 'intent_sha256': digest}  # Metadata only: no program/key/command.

    def _intent(self, owner, job):
        directory, _, _ = owned_intent(self.parent, job, owner)
        raw = read_private(directory / INTENT); value = unique_json(raw)
        fields = {'schema_version', 'owner', 'job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'nonce',
                  'context', 'preparation', 'producer_sha256', 'experimental_reviewed', 'consumed_before_packet'}
        if (not isinstance(value, dict) or set(value) != fields or type(value['schema_version']) is not int or
                value['schema_version'] != 1 or value['owner'] != owner or value['job_id'] != job or
                value['experimental_reviewed'] is not True or value['consumed_before_packet'] is not True or
                value['producer_sha256'] != producer()): invalid()
        scope_binding({'channel_id': value['channel_id'], 'channel_nonce': value['channel_nonce'], 'observation': value['preparation']})
        completion_pin(value['context']['meta'], value['nonce'])  # Strict nonce grammar, no command parsing.
        basis = context(self.stages, owner, job, value['plan_sha256'])
        if not same(value['context'], basis): invalid()
        old = BrowserInitialTrials(self.stages)._intent(owner, job)
        if (value['channel_id'] == old['channel_id'] or value['channel_nonce'] == old['channel_nonce'] or
                value['nonce'] in (old['nonce'], basis['meta']['commit_nonce'])): invalid()
        preparation(value['preparation'], basis)
        return directory, value, hashlib.sha256(raw).hexdigest()

    @staticmethod
    def _proof(value, digest, proof):
        bindings = ('job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'nonce')
        fields = {'schema_version', *bindings, 'intent_sha256', 'commands_acknowledged', 'armed_scope',
                  'transport_closed', 'channel_closed', 'program_started', 'autostart_armed', 'pm_disabled'}
        if (not isinstance(proof, dict) or set(proof) != fields or type(proof['schema_version']) is not int or
                proof['schema_version'] != 1 or any(proof[k] != value[k] for k in bindings) or proof['intent_sha256'] != digest or
                proof['commands_acknowledged'] != PHASES or
                any(proof[k] is not True for k in ('transport_closed', 'channel_closed', 'autostart_armed', 'pm_disabled')) or
                proof['program_started'] is not False): invalid()
        validate_armed(proof['armed_scope'], value['preparation']['preparation']['scope'],
                       completion_pin(value['context']['meta'], value['nonce']))

    def record(self, owner, job, digest, proof):
        directory, value, expected = self._intent(owner, job)
        if (digest != expected or COMPLETE in os.listdir(directory) or self.stages.lease_fd is None or self.stages.lease_job != job): invalid()
        self._proof(value, digest, proof)
        write_new(directory / COMPLETE, encoded({'schema_version': 1, 'intent_sha256': digest, 'proof': proof}))
        sync_directory(directory)
        result = self.status(owner, job)
        self.stages.close()  # Own retained FD only, after strict durable verification.
        return result

    def status(self, owner, job):
        directory, _, _ = owned_intent(self.parent, job, owner)
        names = set(os.listdir(directory)); state = 'not_started'
        if INTENT not in names:
            if COMPLETE in names: invalid()
        else:
            _, value, digest = self._intent(owner, job); state = 'browser_bridge_boot_unverified'
            if COMPLETE in names:
                done = unique_json(read_private(directory / COMPLETE))
                if (not isinstance(done, dict) or set(done) != {'schema_version', 'intent_sha256', 'proof'} or
                        type(done['schema_version']) is not int or done['schema_version'] != 1 or done['intent_sha256'] != digest): invalid()
                self._proof(value, digest, done['proof'])
                state = 'bridge_autostart_armed_next_boot_unverified'
        return {'job_id': job, 'state': state, 'replay_allowed': False, 'installed': False, 'activated': False,
                'installation_ready': False, 'writer_enabled': False, 'live_recheck_required': True,
                'autostart_armed': True if state == 'bridge_autostart_armed_next_boot_unverified' else False if state == 'not_started' else None}
