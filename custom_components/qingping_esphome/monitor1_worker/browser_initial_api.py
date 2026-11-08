"""Private Core-only Noise context for the original consumed browser trial.

This is a read on the existing actor pipe, not a browser frame, export or new
trial/connection permission. Only the actor that still holds the writer lease
may read the original profile. A restarted actor and serialized journal cannot
adopt it. No key is added to the trial packet, status, SDK stdin or disk.
"""
import base64
import hashlib
import os
import re
import stat

from preparation import read_private, unique_json
from browser_disabled_policy import encoded
from browser_initial_journal import BrowserInitialTrials, INTENT, COMPLETE, invalid

MIME = 'application/vnd.qingping.internal-browser-initial-api+json'
BINDING = ('job_id', 'plan_sha256', 'intent_sha256', 'channel_id', 'channel_nonce',
           'nonce', 'ram_job_id', 'guardian_job_id')


def package(stages, owner, request):
    """Return bounded secret bytes only through Core's explicit private MIME.

    The request compares all original bindings; it selects no host, path, key,
    program or process. Rehash the private plan/profile and original consumed
    record on both sides of the read. Unknown completion/history is preserved.
    This method does not reacquire a lock, create a file, execute SDK/ADB, open
    USB/API or claim that the guardian is running. Core must retain that live
    continuation independently before requesting this package.
    """
    if (not isinstance(request, dict) or set(request) != set(BINDING) or
            any(not isinstance(v, str) for v in request.values()) or
            stages.lease_fd is None or stages.lease_job != request['job_id']):
        invalid()
    lease = stages.lease_fd
    try:
        info = os.fstat(lease)
        if (not stat.S_ISREG(info.st_mode) or stat.S_IMODE(info.st_mode) != 0o600 or
                info.st_uid != os.getuid() or info.st_nlink != 1):
            invalid()
        manager = BrowserInitialTrials(stages)
        record = manager._intent(owner, request['job_id'])
        directory, plan = stages._plan(owner, request['job_id'], record['plan_sha256'])
        if COMPLETE in os.listdir(directory):
            invalid()
        before = read_private(directory / INTENT)
        binding = {k: record[k] for k in BINDING if k != 'intent_sha256'}
        binding['intent_sha256'] = hashlib.sha256(before).hexdigest()
        if request != binding or before != encoded(record):
            invalid()
        raw = read_private(directory / 'profile.json')
        profile = unique_json(raw)
        if (hashlib.sha256(raw).hexdigest() != plan['basis']['profile_sha256'] or
                plan['api_identity'] != {k: profile[k] for k in ('node_name', 'api_mac')} or
                not isinstance(profile['node_name'], str) or
                not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', profile['node_name']) or
                not isinstance(profile['api_mac'], str) or
                not re.fullmatch(r'[a-f0-9]{2}(?::[a-f0-9]{2}){5}', profile['api_mac']) or
                profile['api_mac'] == '00:00:00:00:00:00' or int(profile['api_mac'][:2], 16) & 1 or
                not isinstance(profile['api_encryption_key'], str)):
            invalid()
        key = base64.b64decode(profile['api_encryption_key'], validate=True)
        if len(key) != 32 or base64.b64encode(key).decode() != profile['api_encryption_key']:
            invalid()
        # Returning only these fields keeps Wi-Fi/OTA/friendly name and the
        # remainder of the profile outside this narrowly scoped pipe message.
        result = encoded({'kind': 'browser_initial_api_context', 'transport': 'original_guardian_webusb', **binding,
                          'node_name': profile['node_name'], 'api_mac': profile['api_mac'],
                          'noise_psk': profile['api_encryption_key']})
        if (len(result) > 4096 or stages.lease_fd != lease or stages.lease_job != request['job_id'] or
                os.fstat(lease) != info or read_private(directory / INTENT) != before or
                read_private(directory / 'profile.json') != raw or
                manager._intent(owner, request['job_id']) != record or
                stages._plan(owner, request['job_id'], record['plan_sha256']) != (directory, plan)):
            invalid()
        return result
    except Exception:
        invalid()  # Never propagate profile/key/parser/path details to Core/HTTP.
