"""Private browser staging journal/package, not a public writer endpoint.

A future Core coordinator supplies fresh live scope/capacity after its actual
channel reader. This module cannot establish that observation from JSON alone.
It deliberately has no HTTP route or automatic worker restart. It consumes the
owned plan/channel intent before returning credential-bearing file bytes once;
lost pipe replies permit status only. The native schema/USB loader is untouched.
"""
import base64
import hashlib
import json
import os
import re
import shutil
import stat

from preparation import PreparationError, owned_intent, read_private, unique_json, write_new
from build_worker import STOP_FREE, build_report, private_hash, sync_directory
from browser_plan import checked_intent, verify

INTENT = 'browser-stage-intent.json'
COMPLETE = 'browser-stage-complete.json'
MIME = 'application/vnd.qingping.internal-browser-stage+json'
ROLES = ('bridge-program', 'pm_qt_bridge.so', 'launch.sh', 'SnowApp-with-PM', 'startup-hook.sh',
         'stock-start.sh.original', 'stock-watchdog.sh.original', 'start.sh.candidate', 'watchdog.sh.candidate')
HEX = re.compile(r'[a-f0-9]{64}')
UUID = re.compile(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}')


def invalid():
    raise PreparationError('usb_browser_stage_unverified')


def _json(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':')) + '\n').encode()


def private_bytes(path, pin):
    """Hash and read the same private no-follow FD before private delivery."""
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, 'rb') as stream:
        info = os.fstat(stream.fileno())
        if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_nlink != 1 or
                stat.S_IMODE(info.st_mode) != 0o600 or info.st_size != pin['size'] or not 0 < info.st_size <= 16 * 1024**2):
            invalid()
        body = stream.read(info.st_size + 1)
        if len(body) != info.st_size or hashlib.sha256(body).hexdigest() != pin['sha256']:
            invalid()
        return body


class BrowserStages:
    def __init__(self, plans):
        self.plans, self.parent = plans, plans.parent

    def _plan(self, owner, job_id, expected_sha):
        context = self.plans.context(owner, job_id, expected_sha)
        directory, original, _ = owned_intent(self.parent, job_id, owner)
        intent, _ = checked_intent(directory, owner, job_id)
        plan = verify(directory, intent)
        if (original['transport'] != 'browser_usb' or context['target'] != plan['target'] or
                private_hash(directory / 'browser-plan/plan.json')['sha256'] != expected_sha):
            invalid()
        return directory, plan

    def _intent(self, owner, job_id):
        directory, original, _ = owned_intent(self.parent, job_id, owner)
        raw = read_private(directory / INTENT)
        value = unique_json(raw)
        keys = {'schema_version', 'owner', 'job_id', 'plan_sha256', 'channel_id', 'channel_nonce', 'target',
                'data_free_bytes', 'experimental_reviewed', 'consumed_before_package'}
        if (not isinstance(value, dict) or set(value) != keys or type(value['schema_version']) is not int or
                value['schema_version'] != 1 or value['owner'] != owner or value['job_id'] != job_id or
                value['experimental_reviewed'] is not True or value['consumed_before_package'] is not True or
                not isinstance(value['plan_sha256'], str) or not HEX.fullmatch(value['plan_sha256']) or
                not isinstance(value['channel_id'], str) or not re.fullmatch(r'[a-f0-9]{32}', value['channel_id']) or
                not isinstance(value['channel_nonce'], str) or not UUID.fullmatch(value['channel_nonce']) or
                type(value['data_free_bytes']) is not int or value['data_free_bytes'] <= 0 or original['transport'] != 'browser_usb'):
            invalid()
        _, plan = self._plan(owner, job_id, value['plan_sha256'])
        if value['target'] != plan['target'] or value['data_free_bytes'] < plan['requested_data_free_bytes']:
            invalid()
        return directory, plan, value, hashlib.sha256(raw).hexdigest()

    def prepare(self, owner, job_id, expected_sha, scope, reviewed):
        """Consume once, then return a private packet to Core's pipe only.

        The caller must hold the native-install kernel lock, check every old
        writer's durable fence, and retain the exact live channel. No browser
        or HTTP-supplied target/space assertion is valid at that boundary.
        Returning this packet never means the device was changed or verified.
        """
        if reviewed is not True:
            raise PreparationError('usb_browser_stage_review_required')
        directory, plan = self._plan(owner, job_id, expected_sha)
        names = set(os.listdir(directory))
        if INTENT in names:
            raise PreparationError('usb_browser_stage_consumed')
        if names & {'install-intent.json', 'full-ui-trial-intent.json', 'full-ui-activation-intent.json',
                    'pm-extension-intent.json', 'browser-install-intent.json', COMPLETE}:
            invalid()
        keys = {'channel_id', 'channel_nonce', 'target', 'filesystem'}
        if (not isinstance(scope, dict) or set(scope) != keys or scope['target'] != plan['target'] or
                not isinstance(scope['channel_id'], str) or not re.fullmatch(r'[a-f0-9]{32}', scope['channel_id']) or
                not isinstance(scope['channel_nonce'], str) or not UUID.fullmatch(scope['channel_nonce'])):
            invalid()
        fs = scope['filesystem']
        if (not isinstance(fs, dict) or set(fs) != {'magic', 'available_blocks', 'block_bytes'} or fs['magic'] != 'ef53' or
                type(fs['available_blocks']) is not int or not 0 <= fs['available_blocks'] < 2**63 or
                type(fs['block_bytes']) is not int or not 512 <= fs['block_bytes'] <= 65536 or
                fs['available_blocks'] * fs['block_bytes'] < plan['requested_data_free_bytes']):
            raise PreparationError('usb_browser_stage_space')
        if sum(plan['files'][role]['size'] for role in ROLES) > 32 * 1024**2:
            invalid()
        if shutil.disk_usage(self.parent).free < STOP_FREE:
            raise PreparationError('usb_install_host_space')
        value = {'schema_version': 1, 'owner': owner, 'job_id': job_id, 'plan_sha256': expected_sha,
                 'channel_id': scope['channel_id'], 'channel_nonce': scope['channel_nonce'], 'target': plan['target'],
                 'data_free_bytes': fs['available_blocks'] * fs['block_bytes'],
                 'experimental_reviewed': True, 'consumed_before_package': True}
        raw = _json(value)
        write_new(directory / INTENT, raw)
        sync_directory(directory)  # Before reading/returning any writer packet.
        intent_sha = hashlib.sha256(raw).hexdigest()
        files = {role: plan['files'][role] for role in ROLES}
        payloads = {}
        for role, pin in files.items():
            path = directory / 'browser-plan' / role
            payloads[role] = base64.b64encode(private_bytes(path, pin)).decode()
        packet = {'schema_version': 1, 'job_id': job_id, 'target': plan['target'],
                  'requested_data_free_bytes': plan['requested_data_free_bytes'],
                  'descriptor': {'plan_id': plan['plan_id'], 'plan_sha256': expected_sha,
                                 'intent_sha256': intent_sha, 'files': files}, 'payloads': payloads}
        body = _json(packet)
        if len(body) > 48 * 1024**2:
            invalid()
        return body  # Opaque internal MIME only; never ordinary browser status.

    def _expected_proof(self, directory, plan, intent, intent_sha):
        marker = (plan['plan_id'] + ' ' + intent['plan_sha256'] + ' ' + intent_sha + '\n').encode()
        capture = unique_json(read_private(directory / 'capture/result.json'))
        return {'plan_id': plan['plan_id'], 'plan_sha256': intent['plan_sha256'], 'intent_sha256': intent_sha,
                'channel_id': intent['channel_id'], 'channel_nonce': intent['channel_nonce'], 'target': intent['target'],
                'files': {role: plan['files'][role] for role in ROLES}, 'stock_files': capture['files'],
                'root_mode_uid': '700 0', 'stage_metadata_mode_uid': '700 0', 'optouts_empty_regular': True, 'transport_closed': True,
                'vendor_files_changed': False, 'program_started': False,
                'after_effects_sha256': hashlib.sha256(marker).hexdigest()}

    def record(self, owner, job_id, intent_sha, proof):
        """Only after exact remote SHA/metadata/AFTER-effects + close ACK.

        No upload/root creation/command is resumed here. A caller-provided
        report is not a physical observer: the future private coordinator is
        responsible for performing those independent reads before this call.
        """
        directory, plan, intent, expected_sha = self._intent(owner, job_id)
        if not isinstance(intent_sha, str) or intent_sha != expected_sha or not self._proof_matches(directory, plan, intent, expected_sha, proof):
            invalid()
        if COMPLETE in os.listdir(directory):
            return self.status(owner, job_id)  # History only; never new effects.
        write_new(directory / COMPLETE, _json({'intent_sha256': expected_sha, 'proof': proof}))
        sync_directory(directory)
        return self.status(owner, job_id)

    def _proof_matches(self, directory, plan, intent, digest, proof):
        expected = self._expected_proof(directory, plan, intent, digest)
        if not isinstance(proof, dict) or proof != expected:
            return False
        return (all(proof[k] is True for k in ('optouts_empty_regular', 'transport_closed')) and
                all(proof[k] is False for k in ('vendor_files_changed', 'program_started')) and
                all(type(pin['size']) is int for pins in (proof['files'], proof['stock_files']) for pin in pins.values()))

    def status(self, owner, job_id):
        directory, _, _ = owned_intent(self.parent, job_id, owner)
        state = 'not_started'
        if INTENT in os.listdir(directory):
            directory, plan, intent, digest = self._intent(owner, job_id)
            state = 'browser_stage_unverified'
            if COMPLETE in os.listdir(directory):
                complete = unique_json(read_private(directory / COMPLETE))
                if (not isinstance(complete, dict) or set(complete) != {'intent_sha256', 'proof'} or
                        complete['intent_sha256'] != digest or not self._proof_matches(directory, plan, intent, digest, complete['proof'])):
                    invalid()
                state = 'staged_disabled_verified'
        return {'job_id': job_id, 'state': state, 'replay_allowed': False, 'installed': False, 'installation_ready': False,
                'device_write_attempted': True if state == 'staged_disabled_verified' else None,
                'live_recheck_required': True}
