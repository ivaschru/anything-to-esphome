"""Finite public browser wizard, retaining call()'s original shielded task.

This is an explicit route table over the existing separately consumed engines.
It grants no generic actor/ADB/API forwarding. History reads never select USB,
repeat a mutation, restore a continuation or claim current physical health.
"""
import re

from .monitor1_browser_stage import document
from .monitor1_browser_relay import RelayRefusal

# Name, private historical reader, positive terminal. Each writer still checks
# its complete fresh prerequisite and durable one-use journal independently.
PHASES = (
    ('stage', None, 'staged_disabled_verified'),
    ('commit', 'commit', 'committed_disabled_verified'),
    ('trial', 'initial-trial', 'browser_initial_trial_stopped_observed'),
    ('arm', 'bridge-boot', 'bridge_autostart_armed_next_boot_unverified'),
    ('pm', 'pm-boot', 'browser_pm_next_boot_armed_waiting_reboot'),
    ('full-trial', 'full-ui-trial', 'browser_full_ui_trial_returned_observed'),
    ('full-activate', 'full-ui-activation', 'browser_full_ui_active_observed'),
)
ACTIONS = {'stage', 'commit', 'trial', 'arm', 'observe', 'pm', 'full-review', 'full-trial', 'full-activate', 'enroll'}


def job(value):
    if not isinstance(value, str) or not re.fullmatch('[a-f0-9]{32}', value): raise RelayRefusal
    return value


async def progress(service, owner, nonce, data):
    if not isinstance(data, dict) or set(data) != {'job_id', 'expected_plan_sha256'}: raise RelayRefusal
    ident = job(data['job_id'])
    if not isinstance(data['expected_plan_sha256'], str) or not re.fullmatch('[a-f0-9]{64}', data['expected_plan_sha256']): raise RelayRefusal
    # Validate this exact owned browser plan before examining historical phases;
    # a native job, different plan digest or read of another owner is refused.
    document(await service.exchange(owner, nonce, 'internal-browser-plan-context', data))
    for phase, reader, terminal in PHASES:
        result = document(await service.exchange(owner, nonce,
            'jobs/' + ident + '/browser-stage' if reader is None else 'internal-browser-' + reader + '-status',
            None if reader is None else {'job_id': ident}))
        if result.get('job_id') != ident: raise RelayRefusal
        if result.get('state') != terminal:
            value = {'job_id': ident, 'phase': phase, 'state': result.get('state'), 'can_start': result.get('state') == 'not_started',
                     'installed': False, 'installation_ready': False, 'replay_allowed': False}
            if phase == 'full-activate' and value['can_start']:
                c = document(await service.exchange(owner, nonce, 'internal-browser-full-ui-activation-context', data), limit=32768)
                if not isinstance(c.get('trial_proof_sha256'), str) or not re.fullmatch('[a-f0-9]{64}', c['trial_proof_sha256']): raise RelayRefusal
                value['trial_proof_sha256'] = c['trial_proof_sha256']
            return value
    from .monitor1_browser_enrollment import status
    r = await status(service, owner, nonce, ident)
    return {'job_id': ident, 'phase': 'complete' if r['state'] in ('created', 'already_configured') else 'enroll',
            'state': r['state'], 'can_start': r['state'] == 'not_started', 'entry_id': r['entry_id'],
            'installed': False, 'installation_ready': False, 'replay_allowed': False}


async def run(service, owner, nonce, phase, data):
    if phase not in ACTIONS: raise RelayRefusal
    if phase == 'stage':
        from .monitor1_browser_stage import stage
        return await stage(service, owner, nonce, data)
    if phase == 'commit':
        from .monitor1_browser_commit import commit
        return await commit(service, owner, nonce, data)
    if phase == 'trial':
        # The RAM grant remains an actual in-memory continuation of THIS
        # shielded task. Never serialize it between HTTP requests or create a
        # second task to start the guardian after the RAM phase finishes.
        from .monitor1_browser_initial_ram import prepare_ram
        from .monitor1_browser_initial_guardian import run_guardian_trial
        return await run_guardian_trial(await prepare_ram(service, owner, nonce, data))
    if phase == 'arm':
        from .monitor1_browser_bridge_boot import arm
        return await arm(service, owner, nonce, data)
    if phase == 'observe':
        from .monitor1_browser_boot_observer import observe
        return await observe(service, owner, nonce, data)
    if phase == 'pm':
        from .monitor1_browser_pm_boot import arm
        return await arm(service, owner, nonce, data)
    if phase in ('full-review', 'full-trial'):
        from .monitor1_browser_full_ui import inspect, trial
        return await (inspect if phase == 'full-review' else trial)(service, owner, nonce, data)
    if phase == 'full-activate':
        from .monitor1_browser_full_ui_activation import activate
        return await activate(service, owner, nonce, data)
    from .monitor1_browser_enrollment import run as enroll
    return await enroll(service, owner, nonce, data)
