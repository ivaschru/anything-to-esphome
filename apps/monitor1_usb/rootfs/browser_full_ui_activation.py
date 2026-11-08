"""separate browser permanent transition, bound to the original RAM trial.

Private actor metadata only. This module never opens USB/API, adopts a native
receipt, starts a process or supplies a key. The Core caller must retain the
original operation and selected handle for the unchanged inner API coordinator.
"""
import hashlib
import os

from preparation import PreparationError, owned_intent, read_private, unique_json, write_new
from build_worker import sync_directory
from browser_disabled_policy import encoded
from browser_initial_journal import scope_binding
from browser_full_ui_trial import BrowserFullUiTrials, INTENT as TRIAL_INTENT, COMPLETE as TRIAL_COMPLETE, scope
from browser_full_ui_context import ROOT

INTENT = 'browser-full-ui-activation-intent.json'
COMPLETE = 'browser-full-ui-activation-complete.json'
PRODUCERS = ('browser_full_ui_activation.py', 'browser_full_ui_trial.py', 'browser_full_ui_context.py', 'full_ui_activation.py')


def invalid(): raise PreparationError('usb_browser_scope_unverified')


def producers(): return {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in PRODUCERS}


def context(stages, owner, job, sha):
    def read():
        trials = BrowserFullUiTrials(stages)
        directory, prior, digest = trials._intent(owner, job)
        raw, done = read_private(directory / TRIAL_INTENT), read_private(directory / TRIAL_COMPLETE)
        terminal = unique_json(done)
        if (prior['plan_sha256'] != sha or hashlib.sha256(raw).hexdigest() != digest or unique_json(raw) != prior or
                not isinstance(terminal, dict) or set(terminal) != {'schema_version', 'intent_sha256', 'proof'} or
                type(terminal['schema_version']) is not int or terminal['schema_version'] != 1 or terminal['intent_sha256'] != digest): invalid()
        trials.proof(prior, digest, terminal['proof'])
        value = {'schema_version': 1, 'kind': 'browser_full_ui_activation_context', 'job_id': job, 'plan_sha256': sha,
                 'full_ui': prior['context'], 'trial_intent_sha256': digest, 'trial_proof_sha256': hashlib.sha256(done).hexdigest(),
                 'trial_job': prior['trial_job'], 'boot_id': terminal['proof']['result']['boot_id'],
                 'producer_sha256': producers(), 'context_only': True, 'writer_enabled': False, 'device_writes': 0}
        return value, raw, done
    first, last = read(), read()
    if encoded(first[0]) != encoded(last[0]) or first[1:] != last[1:]: invalid()
    return last[0]


class BrowserFullUiActivations:
    def __init__(self, stages): self.stages, self.parent = stages, stages.parent

    def prepare(self, owner, job, sha, trial_proof_sha, selected, screen_reviewed, experimental_reviewed):
        # The two human decisions stay separate: a successful API trial does
        # not confirm the visible screen/touch or authorize persistent startup.
        if screen_reviewed is not True or experimental_reviewed is not True:
            raise PreparationError('usb_full_ui_activation_review_required')
        scope_binding(selected)
        directory, _, _ = owned_intent(self.parent, job, owner)
        if set(os.listdir(directory)) & {INTENT, COMPLETE}: raise PreparationError('usb_full_ui_activation_consumed')
        self.stages._hold_lease(job)
        try:
            self.stages.fence_all(); before = context(self.stages, owner, job, sha)
            if trial_proof_sha != before['trial_proof_sha256']: invalid()
            scope(selected['observation'], before['full_ui'])
            if selected['observation']['target']['boot_id'] != before['boot_id']: invalid()
            value = {'schema_version': 1, 'owner': owner, 'job_id': job, 'plan_sha256': sha,
                     'channel_id': selected['channel_id'], 'channel_nonce': selected['channel_nonce'],
                     'context': before, 'scope': selected['observation'], 'screen_reviewed': True, 'experimental_reviewed': True,
                     'consumed_before_packet': True, 'producer_sha256': producers()}
            write_new(directory / INTENT, encoded(value)); sync_directory(directory)
            if encoded(context(self.stages, owner, job, sha)) != encoded(before) or value['producer_sha256'] != producers(): invalid()
            raw = read_private(directory / INTENT)
            if raw != encoded(value): invalid()
            return {**{k: v for k, v in value.items() if k not in {'owner', 'screen_reviewed', 'experimental_reviewed', 'consumed_before_packet'}},
                    'intent_sha256': hashlib.sha256(raw).hexdigest()}
        except BaseException:
            if INTENT not in os.listdir(directory): self.stages.close()
            raise

    def _intent(self, owner, job):
        directory, _, _ = owned_intent(self.parent, job, owner)
        raw = read_private(directory / INTENT); v = unique_json(raw)
        fields = {'schema_version', 'owner', 'job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'context', 'scope',
                  'screen_reviewed', 'experimental_reviewed', 'consumed_before_packet', 'producer_sha256'}
        if (not isinstance(v, dict) or set(v) != fields or type(v['schema_version']) is not int or v['schema_version'] != 1 or
                v['owner'] != owner or v['job_id'] != job or any(v[k] is not True for k in ('screen_reviewed', 'experimental_reviewed', 'consumed_before_packet')) or
                v['producer_sha256'] != producers()): invalid()
        scope_binding({'channel_id': v['channel_id'], 'channel_nonce': v['channel_nonce'], 'observation': v['scope']})
        c = context(self.stages, owner, job, v['plan_sha256'])
        if encoded(v['context']) != encoded(c): invalid()
        scope(v['scope'], c['full_ui'])
        if v['scope']['target']['boot_id'] != c['boot_id']: invalid()
        return directory, v, hashlib.sha256(raw).hexdigest()

    @staticmethod
    def proof(v, sha, p):
        fields = {'schema_version', 'job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'intent_sha256',
                  'result', 'final_scope', 'api_closed', 'transport_closed', 'channel_closed'}
        if (not isinstance(p, dict) or set(p) != fields or type(p['schema_version']) is not int or p['schema_version'] != 1 or
                any(p[k] != v[k] for k in ('job_id', 'plan_sha256', 'channel_id', 'channel_nonce')) or
                p['intent_sha256'] != sha or encoded(p['final_scope']) != encoded(v['scope']) or
                any(p[k] is not True for k in ('api_closed', 'transport_closed', 'channel_closed'))): invalid()
        r = p['result']; c = v['context']
        expected = {'state', 'trial_job', 'boot_id', 'native_job', 'native_observations', 'store_installed', 'boot_enabled',
                    'start_requested', 'start_acknowledged', 'installed', 'installation_ready', 'replay_allowed'}
        if (not isinstance(r, dict) or set(r) != expected or r['state'] != 'full_ui_active_observed' or
                r['trial_job'] != c['trial_job'] or r['boot_id'] != c['boot_id'] or type(r['native_observations']) is not int or r['native_observations'] != 2 or
                any(r[k] is not True for k in ('store_installed', 'boot_enabled', 'start_requested')) or type(r['start_acknowledged']) is not bool or
                any(r[k] is not False for k in ('installed', 'installation_ready', 'replay_allowed'))): invalid()
        # Lost start ACK is observable, not repeatable. Only the independently
        # anchored new device job and its two exact generations can qualify it.
        nonce = r['native_job']
        if (not isinstance(nonce, str) or len(nonce) != 16 or any(ch not in '0123456789abcdef' for ch in nonce) or
                nonce in ('0' * 16, c['trial_job'])): invalid()

    def record(self, owner, job, sha, proof):
        directory, v, digest = self._intent(owner, job)
        if sha != digest or COMPLETE in os.listdir(directory) or self.stages.lease_fd is None or self.stages.lease_job != job: invalid()
        self.proof(v, sha, proof)
        write_new(directory / COMPLETE, encoded({'schema_version': 1, 'intent_sha256': sha, 'proof': proof})); sync_directory(directory)
        result = self.status(owner, job); self.stages.close(); return result

    def status(self, owner, job):
        directory, _, _ = owned_intent(self.parent, job, owner); names = set(os.listdir(directory)); state = 'not_started'
        if INTENT not in names:
            if COMPLETE in names: invalid()
        else:
            _, v, digest = self._intent(owner, job); state = 'browser_full_ui_activation_unverified'
            if COMPLETE in names:
                done = unique_json(read_private(directory / COMPLETE))
                if (not isinstance(done, dict) or set(done) != {'schema_version', 'intent_sha256', 'proof'} or
                        type(done['schema_version']) is not int or done['schema_version'] != 1 or done['intent_sha256'] != digest): invalid()
                self.proof(v, digest, done['proof']); state = 'browser_full_ui_active_observed'
        return {'job_id': job, 'state': state, 'installed': False, 'installation_ready': False,
                'writer_enabled': False, 'replay_allowed': False, 'live_recheck_required': True}
