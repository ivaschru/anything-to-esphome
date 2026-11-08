"""One consumed browser-to-native-HA handoff after the exact permanent proof.

Only the private actor/Core pipe carries the profile. No native USB receipt,
ADB child, shell/host selector or fabricated forward is used. A live actor
retains its original shared kernel lease through USB read, flow and record;
status after response loss may inspect entries but cannot resume that flow.
"""
import hashlib
import os
import re

from preparation import PreparationError, owned_intent, read_private, unique_json, write_new
from build_worker import sync_directory
from browser_disabled_policy import encoded
from browser_initial_journal import scope_binding
from browser_full_ui_activation import BrowserFullUiActivations, INTENT as ACTIVATION_INTENT, COMPLETE as ACTIVATION_COMPLETE
from browser_full_ui_trial import scope
from browser_full_ui_context import ROOT, api_package
from ha_enrollment import checked_proof, frame, STATES, MIME

INTENT = 'browser-ha-enrollment-intent.json'
PROOF = 'browser-ha-enrollment-proof.json'
RESULT = 'browser-ha-enrollment-result.json'
PRODUCERS = ('browser_ha_enrollment.py', 'browser_full_ui_activation.py', 'ha_enrollment.py', 'ha_enrollment_usb.py')


def invalid(): raise PreparationError('usb_enrollment_unverified')
def producers(): return {n: hashlib.sha256((ROOT / n).read_bytes()).hexdigest() for n in PRODUCERS}


def context(stages, owner, job, sha):
    """Rehash positive permanent history twice; never open USB or acquire lease."""
    def read():
        manager = BrowserFullUiActivations(stages)
        directory, prior, digest = manager._intent(owner, job)
        raw, terminal_raw = read_private(directory / ACTIVATION_INTENT), read_private(directory / ACTIVATION_COMPLETE)
        terminal = unique_json(terminal_raw)
        if (prior['plan_sha256'] != sha or hashlib.sha256(raw).hexdigest() != digest or unique_json(raw) != prior or
                not isinstance(terminal, dict) or set(terminal) != {'schema_version', 'intent_sha256', 'proof'} or
                type(terminal['schema_version']) is not int or terminal['schema_version'] != 1 or terminal['intent_sha256'] != digest): invalid()
        manager.proof(prior, digest, terminal['proof'])
        r = terminal['proof']['result']
        return {'schema_version': 1, 'kind': 'browser_ha_enrollment_context', 'job_id': job, 'plan_sha256': sha,
                'activation_intent_sha256': digest, 'activation_proof_sha256': hashlib.sha256(terminal_raw).hexdigest(),
                'full_ui': prior['context']['full_ui'], 'boot_id': r['boot_id'], 'native_job': r['native_job'],
                'producer_sha256': producers(), 'context_only': True, 'writer_enabled': False, 'device_writes': 0}, raw, terminal_raw
    first, last = read(), read()
    if encoded(first[0]) != encoded(last[0]) or first[1:] != last[1:]: invalid()
    return last[0]


class BrowserHaEnrollments:
    def __init__(self, stages): self.stages, self.parent = stages, stages.parent

    def prepare(self, owner, job, sha, selected, reviewed):
        if reviewed is not True: raise PreparationError('usb_enrollment_review_required')
        scope_binding(selected)
        directory, _, _ = owned_intent(self.parent, job, owner)
        if set(os.listdir(directory)) & {INTENT, PROOF, RESULT}: raise PreparationError('usb_enrollment_consumed')
        self.stages._hold_lease(job)
        try:
            self.stages.fence_all(); c = context(self.stages, owner, job, sha)
            scope(selected['observation'], c['full_ui'])
            if selected['observation']['target']['boot_id'] != c['boot_id']: invalid()
            v = {'schema_version': 1, 'owner': owner, 'job_id': job, 'plan_sha256': sha, 'context': c,
                 'channel_id': selected['channel_id'], 'channel_nonce': selected['channel_nonce'], 'scope': selected['observation'],
                 'reviewed': True, 'consumed_before_usb_read': True, 'producer_sha256': producers()}
            write_new(directory / INTENT, encoded(v)); sync_directory(directory)
            if encoded(context(self.stages, owner, job, sha)) != encoded(c): invalid()
            raw = read_private(directory / INTENT)
            if raw != encoded(v): invalid()
            return {**{k: v[k] for k in ('schema_version', 'job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'context', 'scope', 'producer_sha256')},
                    'intent_sha256': hashlib.sha256(raw).hexdigest()}
        except BaseException:
            if INTENT not in os.listdir(directory): self.stages.close()
            raise

    def _intent(self, owner, job):
        directory, _, _ = owned_intent(self.parent, job, owner)
        raw = read_private(directory / INTENT); v = unique_json(raw)
        fields = {'schema_version', 'owner', 'job_id', 'plan_sha256', 'context', 'channel_id', 'channel_nonce', 'scope',
                  'reviewed', 'consumed_before_usb_read', 'producer_sha256'}
        if (not isinstance(v, dict) or set(v) != fields or type(v['schema_version']) is not int or v['schema_version'] != 1 or
                v['owner'] != owner or v['job_id'] != job or v['reviewed'] is not True or v['consumed_before_usb_read'] is not True or
                v['producer_sha256'] != producers()): invalid()
        scope_binding({'channel_id': v['channel_id'], 'channel_nonce': v['channel_nonce'], 'observation': v['scope']})
        c = context(self.stages, owner, job, v['plan_sha256'])
        if encoded(v['context']) != encoded(c) or v['scope']['target']['boot_id'] != c['boot_id']: invalid()
        scope(v['scope'], c['full_ui'])
        return directory, v, hashlib.sha256(raw).hexdigest()

    def _held(self, job):
        if self.stages.lease_fd is None or self.stages.lease_job != job: invalid()

    @staticmethod
    def proof(v, digest, p):
        fields = {'schema_version', 'job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'intent_sha256', 'host', 'boot_id', 'native_job',
                  'native_observations', 'final_scope', 'api_closed', 'transport_closed', 'channel_closed'}
        if (not isinstance(p, dict) or set(p) != fields or type(p['schema_version']) is not int or p['schema_version'] != 1 or
                any(p[k] != v[k] for k in ('job_id', 'plan_sha256', 'channel_id', 'channel_nonce')) or
                type(p['native_observations']) is not int or p['native_observations'] != 2 or
                encoded(p['final_scope']) != encoded(v['scope']) or
                p['boot_id'] != v['context']['boot_id'] or p['native_job'] != v['context']['native_job'] or
                any(p[k] is not True for k in ('api_closed', 'transport_closed', 'channel_closed'))): invalid()
        checked_proof({k: p[k] for k in ('intent_sha256', 'host', 'boot_id', 'native_job')}, digest)

    def observe(self, owner, job, digest, proof):
        """One terminal USB observation, still holding lease for native HA flow."""
        directory, v, actual = self._intent(owner, job); self._held(job)
        if digest != actual or set(os.listdir(directory)) & {PROOF, RESULT}: invalid()
        self.proof(v, digest, proof)
        write_new(directory / PROOF, encoded(proof)); sync_directory(directory)
        return self.package(owner, job)

    def package(self, owner, job):
        directory, v, digest = self._intent(owner, job)
        p = unique_json(read_private(directory / PROOF)); self.proof(v, digest, p)
        c = v['context']['full_ui']
        private = unique_json(api_package(self.stages, owner, {k: c[k] for k in
                              ('job_id', 'plan_sha256', 'pm_intent_sha256', 'pm_proof_sha256')}))
        result = encoded({'job_id': job, 'intent_sha256': digest, **{k: p[k] for k in ('host', 'boot_id', 'native_job')},
                          **c['api_identity'], 'noise_psk': private['noise_psk'],
                          'native_sha256': c['native_pair']['native-program']['sha256'],
                          'guardian_sha256': c['native_pair']['guardian-program']['sha256']})
        if encoded(context(self.stages, owner, job, v['plan_sha256'])) != encoded(v['context']): invalid()
        return result

    def record(self, owner, job, digest, state, entry_id):
        directory, _, actual = self._intent(owner, job); self._held(job)
        # Validate the already closed USB proof and profile before accepting a
        # native flow result. An entry ID is never permission to edit an entry.
        self.package(owner, job)
        if (digest != actual or state not in STATES or
                ((state in ('created', 'already_configured')) != (entry_id is not None)) or
                entry_id is not None and (not isinstance(entry_id, str) or not re.fullmatch('[A-Za-z0-9_-]{1,64}', entry_id))): invalid()
        write_new(directory / RESULT, encoded({'intent_sha256': digest, 'state': state, 'entry_id': entry_id})); sync_directory(directory)
        result = self.status(owner, job); self.stages.close(); return result

    def status(self, owner, job):
        directory, _, _ = owned_intent(self.parent, job, owner); names = set(os.listdir(directory))
        if INTENT not in names:
            if names & {PROOF, RESULT}: invalid()
            return frame(job, 'not_started')
        _, v, digest = self._intent(owner, job)
        if PROOF in names:
            self.proof(v, digest, unique_json(read_private(directory / PROOF)))
        if RESULT not in names: return frame(job, 'unverified')
        if PROOF not in names: invalid()
        r = unique_json(read_private(directory / RESULT))
        if (not isinstance(r, dict) or set(r) != {'intent_sha256', 'state', 'entry_id'} or r['intent_sha256'] != digest or
                r['state'] not in STATES or ((r['state'] in ('created', 'already_configured')) != (r['entry_id'] is not None)) or
                r['entry_id'] is not None and (not isinstance(r['entry_id'], str) or not re.fullmatch('[A-Za-z0-9_-]{1,64}', r['entry_id']))): invalid()
        return frame(job, r['state'], entry_id=r['entry_id'])
