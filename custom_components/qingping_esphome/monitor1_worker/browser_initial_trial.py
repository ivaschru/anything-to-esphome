"""Read-only first-trial artifact join after an owned terminal browser commit.

The initial guardian is a fourth, independently compiled candidate artifact,
not the full runtime guardian and not part of the nine staged NAND files. Keep
the detached plan and native loaders unchanged. This private context can only
describe its matched bytes; it cannot admit a device image FD, allocate RAM,
consume a trial intent, upload, launch or set a boot flag.
"""
import hashlib
from pathlib import Path
import re

from preparation import PreparationError, read_private, unique_json
from build_worker import private_hash, verified_candidate_report
from install_plan import source_closure
from browser_commit import BrowserCommits, COMPLETE
from browser_disabled_policy import encoded, verify_source, run

ROOT = Path(__file__).parent
MAX_INPUT = 4096


def invalid():
    raise PreparationError('usb_browser_scope_unverified')


def checked(stages, owner, job_id, expected_sha):
    """Rehash the original plan, completed commit, candidate and private ELF.

    No native commit receipt is manufactured. The browser journal's terminal
    proof and known owner nonce stay distinct from current live USB evidence.
    Required public source fingerprints are checked before canonical imports;
    ordinary archived source modes are separate from private 0600 ELF bytes.
    """
    commits = BrowserCommits(stages)
    directory, intent, intent_sha, context = commits._intent(owner, job_id)
    if (not isinstance(expected_sha, str) or not re.fullmatch('[a-f0-9]{64}', expected_sha) or
            intent['plan_sha256'] != expected_sha or
            commits.status(owner, job_id)['state'] != 'committed_disabled_verified'):
        invalid()
    _, plan = stages._plan(owner, job_id, expected_sha)
    report = verified_candidate_report(directory)
    candidate_sha = private_hash(directory / 'candidate/result.json')['sha256']
    contract = unique_json((ROOT / 'initial-trial-contract.json').read_bytes())
    if (contract['source_commit'] != plan['basis']['source_commit'] or
            report['source_commit'] != contract['source_commit'] or
            candidate_sha != plan['basis']['candidate_sha256']):
        invalid()
    source = source_closure(directory)
    verify_source(source, contract['source_sha256'])
    guardian = report.get('initial_trial_guardian')
    if (not isinstance(guardian, dict) or set(guardian) != {'size', 'sha256'} or
            type(guardian['size']) is not int or not 52 <= guardian['size'] <= 16 * 1024**2 or
            not isinstance(guardian['sha256'], str) or not re.fullmatch('[a-f0-9]{64}', guardian['sha256']) or
            contract['guardian_role'] != 'initial-trial-guardian-program' or
            private_hash(directory / 'candidate/initial-trial-guardian-program') != guardian):
        invalid()
    # Bind the exact terminal record bytes, not just a successful state label.
    # Reopening this read never adopts a lease or creates a new trial record.
    proof_bytes = read_private(directory / COMPLETE)
    proof_sha = hashlib.sha256(proof_bytes).hexdigest()
    committed_scope = unique_json(proof_bytes)['proof']['observations'][-1]
    value = {'schema_version': 1, 'job_id': job_id, 'plan_sha256': expected_sha,
             'source_commit': contract['source_commit'], 'commit_intent_sha256': intent_sha,
             'commit_proof_sha256': proof_sha, 'candidate_sha256': candidate_sha, 'guardian': guardian}
    raw = encoded(value)
    if len(raw) > MAX_INPUT:
        invalid()
    # The already verified plan/profile binds the non-secret API identity.
    # Keep it separate from the key-bearing pipe package and SDK artifact
    # input. This fixes the sole permitted RAM preference filename before
    # the consumed packet reaches the browser; a later frame cannot select it.
    result = {**value, 'api_identity': plan['api_identity'],
              'meta': {**context['meta'], 'commit_nonce': intent['nonce']}, 'committed_scope': committed_scope,
              'context_only': True, 'guardian_artifact_checked': False, 'image_fd_admitted': False,
              'hardware_contacted': False, 'device_writes': 0, 'writer_enabled': False,
              'installation_ready': False, 'live_recheck_required': True}
    return directory, source, plan, result, raw


def artifact_result(raw):
    """One exact bounded child result, without an executable path or key."""
    return {'schema_version': 1, 'input_sha256': hashlib.sha256(raw).hexdigest(),
            'guardian_artifact_checked': True, 'image_fd_admitted': False, 'device_writes': 0}


def context(stages, owner, job_id, expected_sha, runner=run):
    directory, source, _, result, raw = checked(stages, owner, job_id, expected_sha)
    sdk = source / '.venv/bin/python'
    if not sdk.is_file():
        invalid()
    # Use only this job's existing admitted SDK, never the Core interpreter,
    # an ADB server, a downloaded toolset or inherited provider credentials.
    env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'PYTHONDONTWRITEBYTECODE': '1',
           'PYTHONNOUSERSITE': '1', 'PYTHONUTF8': '1'}
    try:
        body = runner([str(sdk), '-B', str(ROOT / 'browser_initial_trial_job.py'), '--job', job_id], directory, env, raw)
        if not isinstance(body, bytes) or len(body) > 8192 or body != encoded(artifact_result(raw)):
            invalid()
        # A successful child cannot validate a changed candidate or commit.
        again, other_source, _, after, other_raw = checked(stages, owner, job_id, expected_sha)
        if (again, other_source, after, other_raw) != (directory, source, result, raw):
            invalid()
        return {**result, 'guardian_artifact_checked': True}
    except Exception:
        invalid()  # No raw child/ELF/profile errors escape the private boundary.
