"""Read-only browser arming basis from the EXACT stopped first-trial history.

This is not a native trial receipt, USB binding, writer or new lease. It pins
the original browser terminal bytes and the unchanged public arming source.
A future live collector/consumed arming journal must independently join it to
the actual selected device immediately before any flag transition.
"""
import hashlib
from pathlib import Path
import re

from preparation import PreparationError, read_private, unique_json
from browser_disabled_policy import encoded, verify_source
from browser_initial_journal import BrowserInitialTrials, INTENT, COMPLETE
from browser_initial_trial import checked

ROOT = Path(__file__).parent
SOURCES = {'arm_bridge_next_boot_adb.py', 'commit_disabled_install.py', 'stage_install_adb.py',
           'review_disabled_install.py', 'disabled_commit_policy.py', 'bootstrap_patches.py',
           'preflight_adb.py', 'review_initial_trial.py', 'trial_initial_bridge_adb.py'}


def invalid():
    raise PreparationError('usb_browser_scope_unverified')


def context(stages, owner, job_id, expected_sha):
    """Recheck plan/profile/source and stopped proof, without executing SDK/ADB.

    Hash the exact intent/completion bytes, not merely a successful status name.
    Repeat all private-file checks after source IO. Unknown, orphan, partial or
    changed-producer history refuses; reads never repair it or acquire a lease.
    Keys, program bodies and raw terminal proof do not leave the private actor.
    """
    def read():
        trials = BrowserInitialTrials(stages)
        if trials.status(owner, job_id)['state'] != 'browser_initial_trial_stopped_observed':
            invalid()
        original = trials._intent(owner, job_id)
        directory, source, plan, basis, _ = checked(stages, owner, job_id, expected_sha)
        intent, complete = read_private(directory / INTENT), read_private(directory / COMPLETE)
        terminal = unique_json(complete)
        digest = hashlib.sha256(intent).hexdigest()
        # status() independently validates all strict proof leaves. Comparing
        # both raw files again prevents replacing that checked result across IO.
        if (unique_json(intent) != original or original['plan_sha256'] != expected_sha or
                terminal['intent_sha256'] != digest):
            invalid()
        trials._proof(original, digest, terminal['proof'])
        contract = unique_json((ROOT / 'bridge-next-boot-contract.json').read_bytes())
        if (not isinstance(contract, dict) or set(contract) != {'schema_version', 'staged_roles', 'vendor_paths', 'source_sha256', 'templates'} or
                type(contract['schema_version']) is not int or contract['schema_version'] != 1 or
                set(contract['source_sha256']) != SOURCES or
                any(not isinstance(v, str) or not re.fullmatch('[a-f0-9]{64}', v) for v in contract['source_sha256'].values())):
            invalid()
        verify_source(source, contract['source_sha256'])
        proof = terminal['proof']
        # This known fixed NAND marker survives the trial. Expose its derived
        # hash/size only, so the next collector can positively verify that exact
        # entry instead of ignoring an unknown root file or deleting history.
        guardian = proof['records']['start']['stamp']
        ram = proof['ram_root_identity']
        body = ('CGS1_INITIAL_TRIAL_V1\n' + plan['plan_id'] + '\n' + expected_sha + '\n' +
                basis['meta']['target']['boot_id'] + '\n' + plan['files']['bridge-program']['sha256'] + '\n' +
                original['context']['guardian']['sha256'] + '\n' + original['nonce'] + '\n' +
                f'{ram[0]} {ram[1]}\n{guardian[0]} {guardian[1]}\n').encode('ascii')
        value = {'schema_version': 1, 'kind': 'browser_bridge_next_boot_context',
                 'job_id': job_id, 'plan_sha256': expected_sha, 'source_commit': basis['source_commit'],
                 'trial_intent_sha256': digest, 'trial_proof_sha256': hashlib.sha256(complete).hexdigest(),
                 'meta': basis['meta'], 'committed_scope': basis['committed_scope'],
                 'trial_marker': {'size': len(body), 'sha256': hashlib.sha256(body).hexdigest()},
                 'producer_sha256': {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
                                     for name in ('browser_bridge_boot.py', 'bridge-next-boot-contract.json')},
                 'context_only': True, 'writer_enabled': False, 'installed': False,
                 'installation_ready': False, 'device_writes': 0, 'live_recheck_required': True}
        return value, intent, complete

    before = read()
    after = read()
    if encoded(before[0]) != encoded(after[0]) or before[1:] != after[1:]:
        invalid()
    return after[0]
