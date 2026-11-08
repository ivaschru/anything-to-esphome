"""Read-only isolated SDK policy admission, never a writer or child restart.

Each call rehashes the terminal owned stage and its admitted frozen source.
Only a new bounded pure-analysis child runs; it has no device/ADB API, file
output or write intent. A lost reply may not be relabeled as a verified result.
"""
import hashlib
import json
from pathlib import Path
import re
import os
import stat
import subprocess

from preparation import PreparationError, unique_json
from install_plan import source_closure
from browser_disabled_observation import validate_scope, policy_input, validate_assessment

MAX_INPUT = 32 * 1024
MAX_OUTPUT = 8192


def encoded(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':')) + '\n').encode()


def verify_source(source, fingerprints):
    """Exact public source fingerprints under the admitted private SDK root."""
    for name, digest in fingerprints.items():
        # Archived public source is ordinarily 0644, unlike private payloads.
        # Reuse the source closure's no-follow/regular/owner/link/size contract;
        # requiring private_hash's 0600 here would reject real Git archives.
        fd = os.open(source / name, os.O_RDONLY | os.O_NOFOLLOW)
        with os.fdopen(fd, 'rb') as stream:
            info = os.fstat(stream.fileno())
            if (not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_uid != os.getuid() or
                    not 0 < info.st_size <= 8 * 1024**2):
                raise PreparationError('usb_browser_scope_unverified')
            body = stream.read(8 * 1024**2 + 1)
        if len(body) != info.st_size or hashlib.sha256(body).hexdigest() != digest:
            raise PreparationError('usb_browser_scope_unverified')


def checked_input(stages, owner, job_id, expected_sha, channel_id, channel_nonce, scope):
    if (not isinstance(channel_id, str) or not re.fullmatch('[a-f0-9]{32}', channel_id) or
            not isinstance(channel_nonce, str) or not re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', channel_nonce)):
        raise PreparationError('usb_browser_scope_unverified')
    context = stages.disabled_context(owner, job_id, expected_sha)
    reader = unique_json(Path(__file__).with_name('disabled-contract.json').read_bytes())
    try:
        validate_scope(scope, context['meta'], reader)
    except ValueError:
        raise PreparationError('usb_browser_scope_unverified') from None
    directory, _ = stages._plan(owner, job_id, expected_sha)
    source = source_closure(directory)
    # Required hashes are public reader inputs; verify actual private source
    # bytes independently before either parent or child imports canonical code.
    verify_source(source, reader['source_sha256'])
    raw = policy_input(job_id, expected_sha, channel_id, channel_nonce, scope)
    if len(raw) > MAX_INPUT:
        raise PreparationError('usb_browser_scope_unverified')
    return directory, source, context, raw


def run(command, cwd, env, raw):
    # This fixed trusted child emits one bounded JSON result. No stderr/log,
    # credentials, ADB socket, inherited environment or compiler is exposed.
    result = subprocess.run(command, cwd=cwd, env=env, input=raw, stdout=subprocess.PIPE,
                            stderr=subprocess.DEVNULL, timeout=15, check=False)
    if result.returncode != 0 or len(result.stdout) > MAX_OUTPUT:
        raise PreparationError('usb_browser_scope_unverified')
    return result.stdout


def assess(stages, owner, job_id, expected_sha, channel_id, channel_nonce, scope, runner=run):
    directory, source, context, raw = checked_input(stages, owner, job_id, expected_sha, channel_id, channel_nonce, scope)
    sdk = source / '.venv/bin/python'
    if not sdk.is_file():
        raise PreparationError('usb_browser_scope_unverified')
    # A pure policy needs no native toolset lookup, HOME, Android/ADB or HA
    # credentials. In particular a read cannot download tools or start ADB.
    env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'PYTHONDONTWRITEBYTECODE': '1',
           'PYTHONNOUSERSITE': '1', 'PYTHONUTF8': '1'}
    try:
        body = runner([str(sdk), '-B', str(Path(__file__).with_name('browser_disabled_policy_job.py')),
                       '--job', job_id], directory, env, raw)
        if not isinstance(body, bytes) or len(body) > MAX_OUTPUT:
            raise ValueError
        value = unique_json(body)
        validate_assessment(value, job_id, expected_sha, context['source_commit'], raw)
        # Verify original inputs again after the child; even read-only output
        # cannot qualify a changed profile/source/terminal stage across IO.
        _, _, after, again = checked_input(stages, owner, job_id, expected_sha, channel_id, channel_nonce, scope)
        if after != context or again != raw:
            raise ValueError
        return value
    except Exception:
        raise PreparationError('usb_browser_scope_unverified') from None
