"""Detached browser payload: same frozen binaries, distinct transport schema.

Never relabel a browser report as a native capture or invent get-devpath. The
canonical source's read-only binary/ELF/bootstrap auditors are reused, while
browser metadata has its own explicit admission. Output grants no USB writer.
"""
import hashlib
import json
import os
import re
import uuid


def prepare(canonical, capture, build, patches, profile_path, output, producer_sha256):
    capture, build, patches = map(canonical.private_directory, (capture, build, patches))
    profile, profile_sha = canonical.candidate.read_profile(profile_path)
    observed, capture_sha = canonical.read_json(capture / 'result.json')
    recipe, recipe_sha = canonical.read_json(patches / 'result.json')
    common = {'schema_version', 'stage', 'hardware_contacted', 'device_writes', 'installation_ready', 'installed',
              'usb_serial', 'wlan_mac', 'co2_type', 'boot_id', 'stock_version', 'files', 'limitations', 'transport'}
    if (set(observed) != common or type(observed['schema_version']) is not int or observed['schema_version'] != 1 or
            type(observed['co2_type']) is not int or observed['co2_type'] not in (2, 3) or
            observed['stage'] != 'read_only_browser_capture_complete' or observed['transport'] != 'browser_usb' or
            observed['hardware_contacted'] is not True or type(observed['device_writes']) is not int or observed['device_writes'] != 0 or
            observed['installed'] is not False or observed['installation_ready'] is not False or
            any(observed[k] != profile[k] for k in ('stock_version', 'wlan_mac', 'co2_type')) or
            not isinstance(observed['usb_serial'], str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,127}', observed['usb_serial']) or
            not isinstance(observed['boot_id'], str) or not re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', observed['boot_id']) or
            not isinstance(producer_sha256, str) or not re.fullmatch(r'[a-f0-9]{64}', producer_sha256)):
        raise ValueError('Browser capture/profile binding required')
    expected = {name: {'sha256': sha, 'size': size} for name, (sha, size) in canonical.preflight.FILES.items()}
    if (len(expected) != 9 or observed['files'] != expected or
            profile['qt_core_sha256'] != expected['/usr/lib/libQt5Core.so.5.9.4']['sha256']):
        raise ValueError('Exact factory source closure required')
    originals = {}
    for name, pin in expected.items():
        body = canonical.bootstrap.read_regular(canonical.child(capture, name.lstrip('/')), 8 * 1024**2)
        if len(body) != pin['size'] or hashlib.sha256(body).hexdigest() != pin['sha256']:
            raise ValueError('Captured source bytes changed')
        if name in ('/data/etc/init.d/start.sh', '/data/bin/watchdog.sh'):
            originals[name] = body
    if (type(recipe.get('schema_version')) is not int or recipe.get('schema_version') != 1 or recipe.get('stage') != 'patches_prepared_not_installed' or
            any(recipe.get(k) is not False for k in ('hardware_contacted', 'installed', 'installation_ready'))):
        raise ValueError('Unapplied bootstrap recipe required')
    hook = canonical.bootstrap.read_regular(canonical.child(patches, 'startup-hook.sh'))
    start, watchdog = originals['/data/etc/init.d/start.sh'], originals['/data/bin/watchdog.sh']
    changed_start, changed_watchdog = canonical.bootstrap.patch_bytes(start, watchdog, hook)
    payload = {'stock-start.sh.original': start, 'stock-watchdog.sh.original': watchdog,
               'start.sh.candidate': changed_start, 'watchdog.sh.candidate': changed_watchdog,
               **{name: canonical.bootstrap.read_regular(canonical.child(patches, name)) for name in canonical.bootstrap.ASSET_PINS}}
    for name, body in payload.items():
        if (recipe.get('files', {}).get(name) != {'size': len(body), 'sha256': hashlib.sha256(body).hexdigest()} or
                canonical.bootstrap.read_regular(canonical.child(patches, name)) != body):
            raise ValueError('Bootstrap bytes differ from original recipe')
    if any(hashlib.sha256(payload[name]).hexdigest() != pin for name, pin in canonical.bootstrap.ASSET_PINS.items()):
        raise ValueError('Bootstrap source pin changed')
    # This existing auditor rehashes the full frozen source closure, actual
    # ELF ABI, profile, PM helper and compiled native/guardian/bridge joins.
    # It is independent of transport and has no upload/launch operation.
    binaries, built, candidate_sha = canonical.candidate_files(build, profile_sha)
    payload.update(binaries)
    files = {}
    for name, body in payload.items():
        if not re.fullmatch(r'[A-Za-z0-9_.-]{1,80}', name) or name in ('.', '..'):
            raise ValueError('Fixed payload role required')
        fd = os.open(output / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'wb') as stream:
            stream.write(body);stream.flush();os.fsync(stream.fileno())
        files[name] = {'size': len(body), 'sha256': hashlib.sha256(body).hexdigest()}
    target = {key: observed[key] for key in ('wlan_mac', 'co2_type', 'stock_version', 'usb_serial', 'boot_id')}
    target['kind'] = 'browser_webusb'
    pair = sum(files[k]['size'] for k in ('native-program', 'guardian-program'))
    plan = {'schema_version': 2, 'plan_id': uuid.uuid4().hex, 'stage': 'browser_offline_plan_only',
            'basis': {'capture_sha256': capture_sha, 'candidate_sha256': candidate_sha, 'patches_sha256': recipe_sha,
                      'profile_sha256': profile_sha, 'source_commit': built['source_commit'], 'producer_sha256': producer_sha256},
            'target': target, 'api_identity': {k: profile[k] for k in ('node_name', 'api_mac')}, 'files': files,
            'requested_data_free_bytes': sum(v['size'] for v in files.values()) + pair + 8 * 1024**2,
            'native_get_devpath': False, 'hardware_contacted': False, 'device_writes': 0,
            'installed': False, 'installation_ready': False, 'writer_enabled': False,
            'consumed_install_intent': False, 'live_recheck_required': True}
    raw = (json.dumps(plan, indent=2) + '\n').encode()
    fd = os.open(output / 'plan.json', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(raw);stream.flush();os.fsync(stream.fileno())
    # The actor syncs this directory before its completion receipt. No
    # channel/nonce/key is exported as public status or native-plan authority.
    return plan
