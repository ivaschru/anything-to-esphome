"""Owner-bound detached browser plan, never a native capture or USB writer."""
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import time

from preparation import PreparationError, owned_intent, private_directory, read_private, unique_json, write_new
from build_worker import build_report, environment, private_hash, run_owned, sync_directory, bound_build_intent, checked_inputs
from install_plan import source_closure

INTENT = 'browser-plan-intent.json'
COMPLETE = 'browser-plan-complete.json'
SOURCE = '53d97b9609e8e0fcdfc5d003101f620098dbc734'
ROLES = {'stock-start.sh.original', 'stock-watchdog.sh.original', 'start.sh.candidate', 'watchdog.sh.candidate',
         'launch.sh', 'SnowApp-with-PM', 'startup-hook.sh', 'bridge-program', 'native-program', 'guardian-program', 'pm_qt_bridge.so'}


def producer_digest():
    """Bind the packaged host producer separately from the frozen runtime.

    Historical plans retain their recorded producer digest on read. Only a
    new child must equal the current package; an upgrade never restarts an
    earlier incomplete child or changes its immutable runtime/source binding.
    """
    pins = {}
    for name in ('browser_plan.py', 'browser_plan_job.py', 'browser_payload.py'):
        path = Path(__file__).with_name(name)
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        with os.fdopen(fd, 'rb') as stream:
            info = os.fstat(stream.fileno())
            if (not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_uid != os.getuid() or
                    not 0 < info.st_size <= 1024**2 or stat.S_IMODE(info.st_mode) not in (0o600, 0o644)):
                raise PreparationError('usb_browser_plan_unverified')
            body = stream.read(1024**2 + 1)
            if len(body) != info.st_size:
                raise PreparationError('usb_browser_plan_unverified')
            pins[name] = hashlib.sha256(body).hexdigest()
    return hashlib.sha256(json.dumps(pins, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def checked_intent(directory, owner, job_id):
    raw = read_private(directory / INTENT)
    value = unique_json(raw)
    build = bound_build_intent(directory)
    expected = {'job_id': job_id, 'owner': owner, 'source_commit': SOURCE,
                'build_sha256': private_hash(directory / 'build-complete.json')['sha256'],
                'capture_sha256': private_hash(directory / 'capture/result.json')['sha256'],
                'profile_sha256': private_hash(directory / 'profile.json')['sha256']}
    if (not isinstance(value, dict) or set(value) != set(expected) | {'producer_sha256'} or
            any(value[k] != v for k, v in expected.items()) or build['source_commit'] != SOURCE or
            not isinstance(value['producer_sha256'], str) or not re.fullmatch(r'[a-f0-9]{64}', value['producer_sha256'])):
        raise PreparationError('usb_browser_plan_unverified')
    return value, raw


def verify(directory, intent):
    source_closure(directory)
    plan_root = private_directory(directory / 'browser-plan')
    plan = build_report(plan_root / 'plan.json')
    capture = unique_json(read_private(directory / 'capture/result.json'))
    profile = unique_json(read_private(directory / 'profile.json'))
    fields = {'schema_version', 'plan_id', 'stage', 'basis', 'target', 'api_identity', 'files', 'requested_data_free_bytes',
              'native_get_devpath', 'hardware_contacted', 'device_writes', 'installed', 'installation_ready', 'writer_enabled',
              'consumed_install_intent', 'live_recheck_required'}
    expected_basis = {'capture_sha256': intent['capture_sha256'],
                      'candidate_sha256': private_hash(directory / 'candidate/result.json')['sha256'],
                      'patches_sha256': private_hash(directory / 'browser-bootstrap/result.json')['sha256'],
                      'profile_sha256': intent['profile_sha256'], 'source_commit': SOURCE, 'producer_sha256': intent['producer_sha256']}
    if (not isinstance(plan, dict) or set(plan) != fields or type(plan['schema_version']) is not int or plan['schema_version'] != 2 or
            plan['stage'] != 'browser_offline_plan_only' or not isinstance(plan['plan_id'], str) or not re.fullmatch(r'[a-f0-9]{32}', plan['plan_id']) or
            plan['basis'] != expected_basis or capture.get('transport') != 'browser_usb' or 'usb_transport' in capture or
            capture.get('stage') != 'read_only_browser_capture_complete' or
            plan['target'] != {'kind': 'browser_webusb', **{k: capture[k] for k in ('wlan_mac', 'co2_type', 'stock_version', 'usb_serial', 'boot_id')}} or
            plan['api_identity'] != {k: profile[k] for k in ('node_name', 'api_mac')} or
            any(plan[k] is not False for k in ('native_get_devpath', 'hardware_contacted', 'installed', 'installation_ready', 'writer_enabled', 'consumed_install_intent')) or
            type(plan['device_writes']) is not int or plan['device_writes'] != 0 or plan['live_recheck_required'] is not True or
            not isinstance(plan['files'], dict) or set(plan['files']) != ROLES or set(os.listdir(plan_root)) != ROLES | {'plan.json'}):
        raise PreparationError('usb_browser_plan_unverified')
    for name, pin in plan['files'].items():
        if (not isinstance(pin, dict) or set(pin) != {'size', 'sha256'} or
                type(pin['size']) is not int or not 0 < pin['size'] <= 16 * 1024**2 or
                not isinstance(pin['sha256'], str) or not re.fullmatch(r'[a-f0-9]{64}', pin['sha256']) or
                private_hash(plan_root / name) != pin):
            raise PreparationError('usb_browser_plan_unverified')
    pair = sum(plan['files'][k]['size'] for k in ('native-program', 'guardian-program'))
    required = sum(v['size'] for v in plan['files'].values()) + pair + 8 * 1024**2
    if type(plan['requested_data_free_bytes']) is not int or plan['requested_data_free_bytes'] != required or required > 256 * 1024**2:
        raise PreparationError('usb_browser_plan_unverified')
    return plan


def frame(job_id, state, plan=None, digest=None):
    return {'job_id': job_id, 'state': state, 'plan_id': plan['plan_id'] if plan else None, 'plan_sha256': digest,
            'requested_data_free_bytes': plan['requested_data_free_bytes'] if plan else None,
            'transport_kind': 'browser_webusb', 'native_get_devpath': False, 'hardware_contacted': False,
            'device_writes': 0, 'installed': False, 'installation_ready': False, 'writer_enabled': False,
            'live_recheck_required': True}


class BrowserPlans:
    def __init__(self, builds):
        self.builds, self.parent = builds, builds.parent

    def status(self, owner, job_id):
        directory, original, _ = owned_intent(self.parent, job_id, owner)
        if original['transport'] != 'browser_usb':
            raise PreparationError('usb_browser_plan_transport_required')
        if INTENT not in os.listdir(directory):
            return frame(job_id, 'not_started')
        intent, raw = checked_intent(directory, owner, job_id)
        if COMPLETE not in os.listdir(directory):
            return frame(job_id, 'browser_plan_unverified')
        complete = unique_json(read_private(directory / COMPLETE))
        if (set(complete) != {'intent_sha256', 'complete', 'plan_sha256'} or
                complete['intent_sha256'] != hashlib.sha256(raw).hexdigest()):
            raise PreparationError('usb_browser_plan_unverified')
        if complete['complete'] is False and complete['plan_sha256'] is None:
            return frame(job_id, 'browser_plan_failed')
        if complete['complete'] is not True or complete['plan_sha256'] != private_hash(directory / 'browser-plan/plan.json')['sha256']:
            raise PreparationError('usb_browser_plan_unverified')
        checked_inputs(self.parent, job_id, owner, self.builds.contract)
        if self.builds.status(owner, job_id)['state'] != 'built_not_installed':
            raise PreparationError('usb_browser_plan_unverified')
        plan = verify(directory, intent)
        return frame(job_id, 'browser_plan_prepared', plan, complete['plan_sha256'])

    def prepare(self, owner, job_id, runner=run_owned):
        directory, original, _ = owned_intent(self.parent, job_id, owner)
        if original['transport'] != 'browser_usb':
            raise PreparationError('usb_browser_plan_transport_required')
        if self.builds.status(owner, job_id)['state'] != 'built_not_installed':
            raise PreparationError('usb_browser_plan_build_required')
        if bound_build_intent(directory)['source_commit'] != SOURCE:
            raise PreparationError('usb_browser_plan_source_required')
        names = set(os.listdir(directory))
        if INTENT in names:
            raise PreparationError('usb_browser_plan_consumed')
        if names & {'plan-intent.json', 'install-intent.json', 'full-ui-trial-intent.json', 'full-ui-activation-intent.json',
                    'pm-extension-intent.json', 'browser-install-intent.json', 'browser-plan', 'browser-bootstrap'}:
            raise PreparationError('usb_browser_plan_unverified')
        checked_inputs(self.parent, job_id, owner, self.builds.contract)
        source = source_closure(directory)
        record = {'job_id': job_id, 'owner': owner, 'source_commit': SOURCE,
                  'build_sha256': private_hash(directory / 'build-complete.json')['sha256'],
                  'capture_sha256': private_hash(directory / 'capture/result.json')['sha256'],
                  'profile_sha256': private_hash(directory / 'profile.json')['sha256'], 'producer_sha256': producer_digest()}
        raw = (json.dumps(record) + '\n').encode()
        write_new(directory / INTENT, raw);sync_directory(directory)
        success = False
        try:
            env, deadline = environment(directory / 'build-home'), time.monotonic() + 600
            with (directory / 'browser-plan.log').open('xb') as log:
                runner([str(source / '.venv/bin/python'), str(source / 'bootstrap_patches.py'), '--stock-start',
                        str(directory / 'capture/data/etc/init.d/start.sh'), '--stock-watchdog', str(directory / 'capture/data/bin/watchdog.sh'),
                        '--output', str(directory / 'browser-bootstrap')], directory, env, log, deadline)
                runner([str(source / '.venv/bin/python'), str(Path(__file__).with_name('browser_plan_job.py')), '--job', job_id],
                       directory, env, log, deadline)
            verify(directory, record);sync_directory(directory / 'browser-plan');success = True
        finally:
            write_new(directory / COMPLETE, (json.dumps({'intent_sha256': hashlib.sha256(raw).hexdigest(), 'complete': success,
                'plan_sha256': private_hash(directory / 'browser-plan/plan.json')['sha256'] if success else None}) + '\n').encode())
            sync_directory(directory)
        return self.status(owner, job_id)
