"""One consumed browser Full UI RAM trial; no native receipt or executor.

The original actor keeps its kernel lease until the exact trial result AND
actual API/USB/channel close proof. Reading status cannot adopt that lease,
reissue a body or reset history. The private Core caller owns all live IO.
"""
import base64
import hashlib
import os
import re
import secrets

from preparation import PreparationError, owned_intent, read_private, unique_json, write_new
from build_worker import sync_directory
from browser_disabled_policy import encoded
from browser_stage import private_bytes
from browser_initial_journal import scope_binding
from browser_full_ui_context import context, ROOT

INTENT = 'browser-full-ui-trial-intent.json'
COMPLETE = 'browser-full-ui-trial-complete.json'
MIME = 'application/vnd.qingping.internal-browser-full-ui-trial+json'
PRODUCERS = ('browser_full_ui_trial.py', 'browser_full_ui_context.py', 'full_ui_review.py', 'full_ui_trial.py')


def invalid(): raise PreparationError('usb_browser_scope_unverified')


def producers(): return {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in PRODUCERS}


def scope(value, c):
    """Reported fixed reader context only; Core still owns the live handle."""
    fields = {'kind', 'job_id', 'plan_sha256', 'pm_intent_sha256', 'pm_proof_sha256', 'target',
              'bridge_checked', 'context_only', 'device_writes'}
    if (not isinstance(value, dict) or set(value) != fields or value['kind'] != 'browser_full_ui_scope' or
            any(value[k] != c[k] for k in ('job_id', 'plan_sha256', 'pm_intent_sha256', 'pm_proof_sha256')) or
            value['bridge_checked'] is not True or value['context_only'] is not True or
            type(value['device_writes']) is not int or value['device_writes'] != 0): invalid()
    t = value['target']
    if (not isinstance(t, dict) or set(t) != set(c['target']) or type(t['co2_type']) is not int or
            not isinstance(t['boot_id'], str) or not re.fullmatch('[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', t['boot_id']) or
            t['boot_id'] in (c['pm_armed_boot'], c['target']['boot_id']) or
            encoded({**t, 'boot_id': c['target']['boot_id']}) != encoded(c['target'])): invalid()


def preflight(value):
    expected = {'state': 'full_ui_preflight_observed', 'read_only': True, 'device_writes': 0,
                'launch_authorized': False, 'installation_ready': False, 'installed': False, 'live_recheck_required': True}
    if encoded(value) != encoded(expected): invalid()


class BrowserFullUiTrials:
    def __init__(self, stages): self.stages, self.parent = stages, stages.parent

    def prepare(self, owner, job, sha, selected, reviewed):
        if reviewed is not True: raise PreparationError('usb_browser_stage_review_required')
        scope_binding(selected)
        observed = selected['observation']
        if not isinstance(observed, dict) or set(observed) != {'scope', 'preflight'}: invalid()
        directory, _, _ = owned_intent(self.parent, job, owner)
        if set(os.listdir(directory)) & {INTENT, COMPLETE}: raise PreparationError('usb_browser_stage_consumed')
        self.stages._hold_lease(job)
        try:
            self.stages.fence_all(); before = context(self.stages, owner, job, sha)
            scope(observed['scope'], before); preflight(observed['preflight'])
            nonce = secrets.token_hex(8)
            if not re.fullmatch('[a-f0-9]{16}', nonce) or nonce == '0' * 16: invalid()
            record = {'schema_version': 1, 'owner': owner, 'job_id': job, 'plan_sha256': sha,
                      'channel_id': selected['channel_id'], 'channel_nonce': selected['channel_nonce'], 'trial_job': nonce,
                      'context': before, 'observation': observed, 'producer_sha256': producers(),
                      'experimental_reviewed': True, 'consumed_before_packet': True}
            write_new(directory / INTENT, encoded(record)); sync_directory(directory)
            # Hash the SAME no-follow private FD before delivery, after intent
            # consumption. Neither a pathname nor a caller body selects images.
            images = {kind: base64.b64encode(private_bytes(directory / 'browser-plan' / kind, pin)).decode()
                      for kind, pin in before['native_pair'].items()}
            if (encoded(context(self.stages, owner, job, sha)) != encoded(before) or record['producer_sha256'] != producers()): invalid()
            raw = read_private(directory / INTENT)
            if raw != encoded(record): invalid()
            return {**{k: v for k, v in record.items() if k not in {'owner', 'experimental_reviewed', 'consumed_before_packet'}},
                    'intent_sha256': hashlib.sha256(raw).hexdigest(), 'images': images}
        except BaseException:
            if INTENT not in os.listdir(directory): self.stages.close()
            raise

    def _intent(self, owner, job):
        directory, _, _ = owned_intent(self.parent, job, owner)
        raw = read_private(directory / INTENT); v = unique_json(raw)
        fields = {'schema_version', 'owner', 'job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'trial_job',
                  'context', 'observation', 'producer_sha256', 'experimental_reviewed', 'consumed_before_packet'}
        if (not isinstance(v, dict) or set(v) != fields or type(v['schema_version']) is not int or v['schema_version'] != 1 or
                v['owner'] != owner or v['job_id'] != job or v['experimental_reviewed'] is not True or v['consumed_before_packet'] is not True or
                v['producer_sha256'] != producers() or not isinstance(v['trial_job'], str) or
                not re.fullmatch('[a-f0-9]{16}', v['trial_job']) or v['trial_job'] == '0' * 16 or
                not isinstance(v['observation'], dict) or set(v['observation']) != {'scope', 'preflight'}): invalid()
        scope_binding({'channel_id': v['channel_id'], 'channel_nonce': v['channel_nonce'], 'observation': v['observation']})
        c = context(self.stages, owner, job, v['plan_sha256'])
        if encoded(v['context']) != encoded(c): invalid()
        scope(v['observation']['scope'], c); preflight(v['observation']['preflight'])
        return directory, v, hashlib.sha256(raw).hexdigest()

    @staticmethod
    def proof(v, sha, p):
        fields = {'schema_version', 'job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'intent_sha256', 'trial_job',
                  'result', 'final_scope', 'api_closed', 'transport_closed', 'channel_closed'}
        if (not isinstance(p, dict) or set(p) != fields or type(p['schema_version']) is not int or p['schema_version'] != 1 or
                any(p[k] != v[k] for k in ('job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'trial_job')) or
                p['intent_sha256'] != sha or any(p[k] is not True for k in ('api_closed', 'transport_closed', 'channel_closed')) or
                encoded(p['final_scope']) != encoded(v['observation']['scope'])): invalid()
        r = p['result']
        expected = {'state', 'native_observations', 'stock_return_observed', 'launch_acknowledged', 'job', 'hard_runtime_ms',
                    'installed', 'installation_ready', 'boot_enabled', 'replay_allowed', 'boot_id'}
        if (not isinstance(r, dict) or set(r) != expected or r['state'] != 'full_ui_trial_returned_observed' or
                type(r['native_observations']) is not int or r['native_observations'] != 2 or r['stock_return_observed'] is not True or
                type(r['launch_acknowledged']) is not bool or r['job'] != v['trial_job'] or
                type(r['hard_runtime_ms']) is not int or r['hard_runtime_ms'] != 60000 or
                r['boot_id'] != p['final_scope']['target']['boot_id'] or
                any(r[k] is not False for k in ('installed', 'installation_ready', 'boot_enabled', 'replay_allowed'))): invalid()

    def record(self, owner, job, sha, proof):
        directory, v, digest = self._intent(owner, job)
        if digest != sha or COMPLETE in os.listdir(directory) or self.stages.lease_fd is None or self.stages.lease_job != job: invalid()
        self.proof(v, sha, proof)
        write_new(directory / COMPLETE, encoded({'schema_version': 1, 'intent_sha256': sha, 'proof': proof})); sync_directory(directory)
        result = self.status(owner, job); self.stages.close(); return result

    def status(self, owner, job):
        directory, _, _ = owned_intent(self.parent, job, owner); names = set(os.listdir(directory)); state = 'not_started'
        if INTENT not in names:
            if COMPLETE in names: invalid()
        else:
            _, v, digest = self._intent(owner, job); state = 'browser_full_ui_trial_unverified'
            if COMPLETE in names:
                done = unique_json(read_private(directory / COMPLETE))
                if (not isinstance(done, dict) or set(done) != {'schema_version', 'intent_sha256', 'proof'} or
                        type(done['schema_version']) is not int or done['schema_version'] != 1 or done['intent_sha256'] != digest): invalid()
                self.proof(v, digest, done['proof']); state = 'browser_full_ui_trial_returned_observed'
        return {'job_id': job, 'state': state, 'installed': False, 'activated': False, 'installation_ready': False,
                'writer_enabled': False, 'replay_allowed': False, 'live_recheck_required': True}
