"""Separate consumed PM next-boot intent under the original host kernel lease.

This module cannot obtain live scope/Noise from JSON or execute a command. The
private Core coordinator must join its original read operation and actual USB
handle before asking this actor to consume the distinct PM attempt. A lost
packet/ACK remains fenced; neither status nor a restarted actor resumes it.
"""
import hashlib
import os
from pathlib import Path
import secrets

from preparation import PreparationError, owned_intent, read_private, unique_json, write_new
from build_worker import sync_directory
from browser_disabled_policy import encoded, verify_source
from browser_initial_journal import scope_binding
from browser_initial_trial import checked
from browser_boot_context import context
from browser_pm_boot_observation import validate_scope, validate_wire
from browser_bridge_boot_observation import same

ROOT = Path(__file__).parent
INTENT = 'browser-pm-boot-intent.json'
COMPLETE = 'browser-pm-boot-complete.json'
PRODUCERS = ('browser_pm_boot_journal.py', 'browser_pm_boot_observation.py', 'pm-next-boot-contract.json',
             'pm_extension_guard.py', 'browser_boot_context.py')


def invalid(): raise PreparationError('usb_browser_scope_unverified')


def producer(): return {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in PRODUCERS}


def basis(stages, owner, job, sha):
    value = context(stages, owner, job, sha)
    _, source, plan, _, _ = checked(stages, owner, job, sha)
    contract = unique_json((ROOT / 'pm-next-boot-contract.json').read_bytes())
    if (not isinstance(contract, dict) or set(contract) != {'schema_version', 'maximum_body_bytes', 'source_commit',
            'native_source_sha256', 'guard_sha256', 'templates'} or type(contract['schema_version']) is not int or
            contract['schema_version'] != 1 or type(contract['maximum_body_bytes']) is not int or contract['maximum_body_bytes'] != 65536 or
            contract['source_commit'] != plan['basis']['source_commit'] or
            contract['guard_sha256'] != hashlib.sha256((ROOT / 'pm_extension_guard.py').read_bytes()).hexdigest()): invalid()
    verify_source(source, contract['native_source_sha256'])
    # The canonical guard requires this exact candidate pair as well as the
    # nine staged roles. Metadata is not a program upload or launch authority.
    pair = {kind: plan['files'][kind] for kind in ('native-program', 'guardian-program')}
    return value, pair


class BrowserPmBoot:
    def __init__(self, stages): self.stages, self.parent = stages, stages.parent

    def prepare(self, owner, job, sha, selected, reviewed):
        if reviewed is not True: raise PreparationError('usb_browser_stage_review_required')
        scope_binding(selected)
        observed = selected['observation']
        if not isinstance(observed, dict) or set(observed) != {'scope', 'wire'}: invalid()
        directory, _, _ = owned_intent(self.parent, job, owner)
        if set(os.listdir(directory)) & {INTENT, COMPLETE}: raise PreparationError('usb_browser_stage_consumed')
        self.stages._hold_lease(job)
        try:
            self.stages.fence_all()
            before, pair = basis(self.stages, owner, job, sha)
            validate_scope(observed['scope'], before); validate_wire(observed['wire'], before)
            old = before['arming']; nonce = secrets.token_hex(16)
            if (selected['channel_id'] == old['channel_id'] or selected['channel_nonce'] == old['channel_nonce'] or
                    nonce == '0' * 32 or nonce in (old['nonce'], old['context']['meta']['commit_nonce']) or
                    len(nonce) != 32 or any(c not in '0123456789abcdef' for c in nonce)): invalid()
            record = {'schema_version': 1, 'owner': owner, 'job_id': job, 'plan_sha256': sha,
                      'channel_id': selected['channel_id'], 'channel_nonce': selected['channel_nonce'], 'nonce': nonce,
                      'context': before, 'native_pair': pair, 'observation': observed, 'producer_sha256': producer(),
                      'experimental_reviewed': True, 'consumed_before_packet': True}
            write_new(directory / INTENT, encoded(record)); sync_directory(directory)
            if not same(basis(self.stages, owner, job, sha), (before, pair)) or record['producer_sha256'] != producer(): invalid()
            raw = read_private(directory / INTENT)
            if raw != encoded(record): invalid()
            return self._packet(record, hashlib.sha256(raw).hexdigest())
        except BaseException:
            if INTENT not in os.listdir(directory): self.stages.close()
            raise

    @staticmethod
    def _packet(record, sha):
        return {**{k: v for k, v in record.items() if k not in {'owner', 'experimental_reviewed', 'consumed_before_packet'}},
                'intent_sha256': sha}

    def _intent(self, owner, job):
        directory, _, _ = owned_intent(self.parent, job, owner)
        raw = read_private(directory / INTENT); value = unique_json(raw)
        fields = {'schema_version', 'owner', 'job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'nonce',
                  'context', 'native_pair', 'observation', 'producer_sha256', 'experimental_reviewed', 'consumed_before_packet'}
        if (not isinstance(value, dict) or set(value) != fields or type(value['schema_version']) is not int or
                value['schema_version'] != 1 or value['owner'] != owner or value['job_id'] != job or
                value['experimental_reviewed'] is not True or value['consumed_before_packet'] is not True or
                value['producer_sha256'] != producer()): invalid()
        scope_binding({'channel_id': value['channel_id'], 'channel_nonce': value['channel_nonce'], 'observation': value['observation']})
        before, pair = basis(self.stages, owner, job, value['plan_sha256'])
        if (not same(value['context'], before) or not same(value['native_pair'], pair) or
                not isinstance(value['observation'], dict) or set(value['observation']) != {'scope', 'wire'}): invalid()
        validate_scope(value['observation']['scope'], before); validate_wire(value['observation']['wire'], before)
        old = before['arming']; nonce = value['nonce']
        if (not isinstance(nonce, str) or len(nonce) != 32 or any(c not in '0123456789abcdef' for c in nonce) or nonce == '0' * 32 or
                nonce in (old['nonce'], old['context']['meta']['commit_nonce']) or
                value['channel_id'] == old['channel_id'] or value['channel_nonce'] == old['channel_nonce']): invalid()
        return directory, value, hashlib.sha256(raw).hexdigest()

    @staticmethod
    def _proof(value, digest, proof):
        bindings = ('job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'nonce')
        fields = {*bindings, 'schema_version', 'intent_sha256', 'commands_acknowledged', 'after_effects_read_acknowledged',
                  'target', 'current_boot_preserved', 'transport_closed', 'channel_closed', 'pm_next_boot_armed'}
        if (not isinstance(proof, dict) or set(proof) != fields or type(proof['schema_version']) is not int or proof['schema_version'] != 1 or
                any(proof[k] != value[k] for k in bindings) or proof['intent_sha256'] != digest or
                proof['commands_acknowledged'] != ['arm', 'complete'] or
                any(proof[k] is not True for k in ('after_effects_read_acknowledged', 'current_boot_preserved', 'transport_closed', 'channel_closed', 'pm_next_boot_armed')) or
                not same(proof['target'], value['observation']['scope']['target'])): invalid()

    def record(self, owner, job, digest, proof):
        directory, value, expected = self._intent(owner, job)
        if digest != expected or COMPLETE in os.listdir(directory) or self.stages.lease_fd is None or self.stages.lease_job != job: invalid()
        self._proof(value, digest, proof)
        write_new(directory / COMPLETE, encoded({'schema_version': 1, 'intent_sha256': digest, 'proof': proof})); sync_directory(directory)
        result = self.status(owner, job); self.stages.close(); return result

    def status(self, owner, job):
        directory, _, _ = owned_intent(self.parent, job, owner); names = set(os.listdir(directory)); state = 'not_started'
        if INTENT not in names:
            if COMPLETE in names: invalid()
        else:
            _, value, digest = self._intent(owner, job); state = 'browser_pm_boot_unverified'
            if COMPLETE in names:
                done = unique_json(read_private(directory / COMPLETE))
                if (not isinstance(done, dict) or set(done) != {'schema_version', 'intent_sha256', 'proof'} or
                        type(done['schema_version']) is not int or done['schema_version'] != 1 or done['intent_sha256'] != digest): invalid()
                self._proof(value, digest, done['proof']); state = 'browser_pm_next_boot_armed_waiting_reboot'
        return {'job_id': job, 'state': state, 'replay_allowed': False, 'installed': False, 'activated': False,
                'installation_ready': False, 'writer_enabled': False, 'live_recheck_required': True,
                'pm_next_boot_armed': True if state == 'browser_pm_next_boot_armed_waiting_reboot' else False if state == 'not_started' else None}
