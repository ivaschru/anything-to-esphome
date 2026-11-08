"""Consume one browser first-trial packet before ANY RAM/device write.

This is only the private journal/payload half, with no device execution or
public initiator. Retain the shared writer lease and unknown durable history
after packet loss, read failure, actor shutdown or restart. Terminal guardian/
API/return verification is joined only by the private original Core continuation.
No public route or lease-adoption API exists; a status cannot authorize another packet.
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

    @staticmethod
    def _proof(record, digest, proof):
        """Validate private original-Core evidence, not a JSON handle grant.

        The actor still needs its ORIGINAL retained kernel lease for record().
        Core supplies this only after live task/actor/selected-channel checks,
        authenticated wire, original END, two post-stop reads, actual USB close
        and separate channel-close ACK. HTTP never admits this operation.
        """
        binding = ('job_id', 'plan_sha256', 'intent_sha256', 'channel_id', 'channel_nonce', 'nonce', 'ram_job_id', 'guardian_job_id')
        fields = {'binding', 'ram_root_identity', 'records', 'wire', 'returned', 'transport', 'channel_closed', 'core_elapsed_at_end_ms'}
        expected = {k: digest if k == 'intent_sha256' else record[k] for k in binding}
        if (not isinstance(proof, dict) or set(proof) != fields or proof['binding'] != expected or
                proof['channel_closed'] is not True or type(proof['core_elapsed_at_end_ms']) is not int or
                not 60000 <= proof['core_elapsed_at_end_ms'] <= 110000):
            invalid()
        def stamp(value):
            return (isinstance(value, list) and len(value) == 2 and type(value[0]) is int and
                    2 <= value[0] <= 2147483647 and isinstance(value[1], str) and
                    re.fullmatch('[1-9][0-9]{0,19}', value[1]) is not None and int(value[1]) < 2**64)
        def pair(value):
            return (isinstance(value, list) and len(value) == 2 and
                    all(type(v) is int and 1 <= v < 2**53 for v in value))
        records = proof['records']
        if (not isinstance(records, dict) or set(records) != {'kind', 'start', 'child', 'end', 'raw_closed', 'transport_closed', 'records_only'} or
                records['kind'] != 'browser_initial_guardian_records' or records['raw_closed'] is not True or
                records['transport_closed'] is not False or records['records_only'] is not True):
            invalid()
        for kind in ('start', 'child'):
            row = records[kind]
            if (not isinstance(row, dict) or set(row) != {'kind', 'nonce', 'stamp'} or row['kind'] != kind or
                    row['nonce'] != record['nonce'] or not stamp(row['stamp'])):
                invalid()
        guardian, child = records['start']['stamp'], records['child']['stamp']
        scope = record['context']['committed_scope']
        if len({guardian[0], child[0], scope['stock_process'][0], scope['watchdog_process'][0]}) != 4:
            invalid()
        end = records['end']
        if (not isinstance(end, dict) or set(end) != {'kind', 'nonce', 'guardian', 'child', 'elapsed_ms', 'reaped', 'protection_ack', 'term_sent', 'forced', 'wait_status'} or
                end['kind'] != 'end' or end['nonce'] != record['nonce'] or not stamp(end['guardian']) or not stamp(end['child']) or
                end['guardian'] != guardian or end['child'] != child or
                type(end['elapsed_ms']) is not int or not 60000 <= end['elapsed_ms'] <= 71000 or
                any(end[k] is not True for k in ('reaped', 'protection_ack', 'term_sent')) or end['forced'] is not False or
                type(end['wait_status']) is not int or end['wait_status'] not in (0, 15)):
            invalid()
        wire = proof['wire']
        if (not isinstance(wire, dict) or set(wire) != {'samples', 'identity', 'last_sample_age_at_reap_s'} or
                type(wire['samples']) is not int or not 2 <= wire['samples'] <= 6 or
                wire['identity'] != record['context']['api_identity'] or
                type(wire['last_sample_age_at_reap_s']) not in (int, float) or
                not 0 <= wire['last_sample_age_at_reap_s'] <= 20):
            invalid()  # Range also rejects NaN/infinity without coercing huge integers.
        returned = proof['returned']
        required = {'kind', *binding, 'guardian', 'child', 'own_programs_absent', 'root_identity', 'ram_root_identity',
                    'stock_process', 'watchdog_process', 'prefs_layout', 'memory_free_bytes', 'memory_total_bytes',
                    'kernel_scope_checked', 'image_fd_admitted', 'execution_authority', 'context_only'}
        if (not isinstance(returned, dict) or set(returned) != required or returned['kind'] != 'browser_initial_return_observation' or
                any(returned[k] != expected[k] or not isinstance(returned[k], str) for k in binding) or
                not stamp(returned['guardian']) or not stamp(returned['child']) or
                returned['guardian'] != guardian or returned['child'] != child or
                any(returned[k] is not True for k in ('own_programs_absent', 'kernel_scope_checked', 'context_only')) or
                any(returned[k] is not False for k in ('image_fd_admitted', 'execution_authority')) or
                not pair(returned['root_identity']) or returned['root_identity'] != scope['root_identity'] or
                not pair(proof['ram_root_identity']) or not pair(returned['ram_root_identity']) or
                returned['ram_root_identity'] != proof['ram_root_identity'] or
                returned['prefs_layout'] not in ('empty', 'prefs_empty', 'prefs_file') or
                type(returned['memory_free_bytes']) is not int or type(returned['memory_total_bytes']) is not int or
                not 8 * 1024**2 <= returned['memory_free_bytes'] <= returned['memory_total_bytes'] <= 2**40):
            invalid()
        for key in ('stock_process', 'watchdog_process'):
            if not stamp(returned[key]) or returned[key] != [scope[key][0], str(scope[key][1])]:
                invalid()
        transport = proof['transport']
        if (not isinstance(transport, dict) or set(transport) != {'kind', 'observation', 'transport_closed', 'context_only'} or
                transport['kind'] != 'browser_initial_return_closed' or encoded(transport['observation']) != encoded(returned) or
                transport['transport_closed'] is not True or transport['context_only'] is not True):
            invalid()

    def record(self, owner, job_id, intent_sha256, proof):
        """One immutable terminal record after original live Core close proof.

        O_EXCL plus file/directory fsync precede lease release. Lost replies
        may only read status; no repeated record, packet, launch or adoption.
        Partial, orphan, changed-producer or mismatched history stays fenced.
        """
        directory, _, _ = owned_intent(self.parent, job_id, owner)
        value = self._intent(owner, job_id)
        raw = read_private(directory / INTENT)
        digest = hashlib.sha256(raw).hexdigest()
        if (digest != intent_sha256 or unique_json(raw) != value or COMPLETE in os.listdir(directory) or
                self.stages.lease_fd is None or self.stages.lease_job != job_id):
            invalid()
        self._proof(value, digest, proof)
        write_new(directory / COMPLETE, encoded({'schema_version': 1, 'intent_sha256': digest, 'proof': proof}))
        sync_directory(directory)
        result = self.status(owner, job_id)
        self.stages.close()  # Only this actor's retained host FD, after exact verified persistence.
        return result

    def status(self, owner, job_id):
        directory, _, _ = owned_intent(self.parent, job_id, owner)
        names = set(os.listdir(directory))
        state = 'not_started'
        if INTENT not in names:
            if COMPLETE in names:
                invalid()  # Orphan completion is not empty history or retry authority.
        else:
            value = self._intent(owner, job_id)
            digest = hashlib.sha256(read_private(directory / INTENT)).hexdigest()
            state = 'browser_initial_trial_unverified'
            if COMPLETE in names:
                complete = unique_json(read_private(directory / COMPLETE))
                if (not isinstance(complete, dict) or set(complete) != {'schema_version', 'intent_sha256', 'proof'} or
                        type(complete['schema_version']) is not int or complete['schema_version'] != 1 or complete['intent_sha256'] != digest):
                    invalid()
                self._proof(value, digest, complete['proof'])
                state = 'browser_initial_trial_stopped_observed'
        return {'job_id': job_id, 'state': state, 'replay_allowed': False, 'installed': False,
                'installation_ready': False, 'writer_enabled': False, 'activated': False,
                'device_write_attempted': False if state == 'not_started' else True if state == 'browser_initial_trial_stopped_observed' else None,
                'launch_attempted': False if state == 'not_started' else True if state == 'browser_initial_trial_stopped_observed' else None, 'live_recheck_required': True}
