"""Durable owner/plan authority for one initial PM next-boot transition.

This is independent of the bridge install, screen trial and permanent Full UI
intents. No request can select a path, PID, command, remote address or reboot.
"""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import time

from preparation import PreparationError, owned_intent, private_directory, read_private, unique_json, write_new
from build_worker import STOP_FREE, adb_environment, build_report, private_hash, run_owned, sync_directory
from install_plan import source_closure
import full_ui_installation as trials
from pm_extension_usb import checked_proof

INTENT = 'pm-extension-intent.json'
RESULT = 'pm-extension-result.json'


def checked_intent(directory, owner, job_id):
    raw = read_private(directory / INTENT)
    value = unique_json(raw)
    plan = build_report(directory / 'install-plan/plan.json')
    if (not isinstance(value, dict) or set(value) != {'job_id', 'owner', 'source_commit', 'plan_sha256',
            'install_intent_sha256', 'nonce', 'experimental_reviewed'} or value['job_id'] != job_id or
            value['owner'] != owner or value['experimental_reviewed'] is not True or
            value['plan_sha256'] != private_hash(directory / 'install-plan/plan.json')['sha256'] or
            value['install_intent_sha256'] != private_hash(directory / 'install-intent.json')['sha256'] or
            value['source_commit'] != plan['basis']['source_commit'] or
            value['source_commit'] not in trials.TRIAL_SOURCE_COMMITS or
            not isinstance(value['nonce'], str) or not re.fullmatch(r'[a-f0-9]{32}', value['nonce']) or value['nonce'] == '0' * 32):
        raise PreparationError('usb_pm_extension_unverified')
    return value, raw


def frame(job_id, state, available, proof=None):
    # Historical only: the original Linux boot/session and key stay private.
    return {'job_id': job_id, 'state': state, 'pm_available': available,
            'arming_acknowledged': proof['arming_acknowledged'] if proof else None,
            'completion_observed': proof['completion_observed'] if proof else None,
            'next_boot_armed': True if state == 'pm_extension_armed_waiting_reboot' else None,
            'installed': False, 'installation_ready': False, 'replay_allowed': False, 'live_recheck_required': True}


class PmExtensions:
    def __init__(self, installations):
        self.installations, self.parent = installations, installations.parent

    def status(self, owner, job_id):
        directory, _, _ = owned_intent(self.parent, job_id, owner)
        names = os.listdir(directory)
        if INTENT not in names:
            plan = build_report(directory / 'install-plan/plan.json')
            available = (plan.get('basis', {}).get('source_commit') in trials.TRIAL_SOURCE_COMMITS and
                         self.installations.status(owner, job_id)['state'] == 'bridge_observed' and
                         trials.INTENT not in names and 'full-ui-activation-intent.json' not in names)
            return frame(job_id, 'not_started', available)
        intent, raw = checked_intent(directory, owner, job_id)
        if RESULT not in names:
            return frame(job_id, 'pm_extension_unverified', False)
        result = unique_json(read_private(directory / RESULT))
        if set(result) != {'intent_sha256', 'proof'} or result['intent_sha256'] != hashlib.sha256(raw).hexdigest():
            raise PreparationError('usb_pm_extension_unverified')
        proof = checked_proof(result['proof'], intent['nonce'], result['proof'].get('boot_id'))
        if proof['state'] == 'pm_extension_armed_waiting_reboot' and proof['boot_id'] == build_report(directory / 'install-plan/plan.json')['target']['boot_id']:
            raise PreparationError('usb_pm_extension_unverified')
        return frame(job_id, proof['state'], False, proof)

    def fence(self, directory, owner):
        if INTENT in os.listdir(directory) and self.status(owner, directory.name)['state'] != 'pm_extension_armed_waiting_reboot':
            raise PreparationError('usb_pm_extension_previous_unverified')

    def start(self, owner, job_id, expected_plan_sha256, experimental_reviewed, runner=run_owned):
        if experimental_reviewed is not True or not isinstance(expected_plan_sha256, str) or not re.fullmatch(r'[a-f0-9]{64}', expected_plan_sha256):
            raise PreparationError('usb_pm_extension_review_required')
        directory, _, _ = owned_intent(self.parent, job_id, owner)
        if INTENT in os.listdir(directory):
            raise PreparationError('usb_pm_extension_consumed')
        if private_hash(directory / 'install-plan/plan.json')['sha256'] != expected_plan_sha256:
            raise PreparationError('usb_pm_extension_review_required')
        if not self.status(owner, job_id)['pm_available']:
            raise PreparationError('usb_pm_extension_bridge_required')
        source = source_closure(directory)
        if shutil.disk_usage(self.parent).free < STOP_FREE:
            raise PreparationError('usb_install_host_space')
        fd = os.open(Path(self.parent).parent / 'native-install.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
        try:
            info = os.fstat(fd)
            if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_nlink != 1 or stat.S_IMODE(info.st_mode) != 0o600:
                raise PreparationError('usb_pm_extension_unverified')
            try:fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:raise PreparationError('usb_busy') from None
            from full_ui_activation_installation import FullUiActivations
            for other in private_directory(Path(self.parent)).iterdir():
                private_directory(other)
                names = os.listdir(other)
                prior_owner = unique_json(read_private(other / 'intent.json'))['owner']
                self.fence(other, prior_owner)
                FullUiActivations(self.installations).fence(other, prior_owner)
                if 'install-intent.json' in names and self.installations.status(prior_owner, other.name)['state'] not in ('armed_waiting_reboot', 'bridge_observed'):
                    raise PreparationError('usb_install_previous_unverified')
                if trials.INTENT in names and trials.FullUiTrials(self.installations).status(prior_owner, other.name)['state'] != 'full_ui_trial_returned_observed':
                    raise PreparationError('usb_full_ui_trial_previous_unverified')
            if not self.status(owner, job_id)['pm_available']:
                raise PreparationError('usb_pm_extension_bridge_required')
            env = adb_environment(directory)
            plan = build_report(directory / 'install-plan/plan.json')
            import secrets
            record = {'job_id': job_id, 'owner': owner, 'plan_sha256': expected_plan_sha256,
                      'source_commit': plan['basis']['source_commit'], 'nonce': secrets.token_hex(16),
                      'install_intent_sha256': private_hash(directory / 'install-intent.json')['sha256'], 'experimental_reviewed': True}
            write_new(directory / INTENT, (json.dumps(record) + '\n').encode());sync_directory(directory)
            command = [str(source / '.venv/bin/python'), str(Path(__file__).with_name('usb_install_job.py')), '--job', job_id, '--pm-enable']
            try:
                with (directory / 'pm-extension.log').open('xb') as log:runner(command, directory, env, log, time.monotonic() + 350)
            except Exception:pass  # Preserve the consumed request and partial history.
            return self.status(owner, job_id)
        finally:os.close(fd)
