#!/usr/bin/env python3
"""Derive fixed read-only kernel/image/socket scripts from frozen source53.

Run only the canonical pure readers against synthetic replies in memory. No
ADB object, shell or program is executed. This subset does not supply complete
stock/vendor/intent/RAM/Noise observation or authorize a trial completion.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
PORT = ROOT / 'ports/monitor1'
KEYS = ('child_before', 'guardian_process_before', 'guardian_file', 'guardian_image', 'guardian_process_after',
        'child_process_before', 'child_file', 'child_image', 'child_process_after', 'endpoint', 'child_after')
VALUES = {'guardian_pid': '217001001', 'child_pid': '217001002', 'guardian_job_id': 'ab' * 16}


def process_text(pid, parent, birth, path):
    fields = ['0'] * 20
    fields[0], fields[1], fields[19] = 'S', str(parent), str(birth)
    return f'{pid} (synthetic reader fixture) ' + ' '.join(fields) + '\n0\n' + path


def vector():
    """Exact canonical helper inputs/replies, not a device evidence fixture."""
    guardian, child = (int(VALUES['guardian_pid']), 1900037), (int(VALUES['child_pid']), 1900043)
    guard_path = '/tmp/qingping-initial-guardian-' + VALUES['guardian_job_id'] + '/program'
    child_path = '/data/.esphome-cgs1/program'
    guard_pin, child_pin = {'size': 1700033, 'sha256': 'b' * 64}, {'size': 1700039, 'sha256': 'c' * 64}
    def file(pin, path): return f"{pin['size']} 1\n{pin['sha256']}  {path}"
    def image(pin, pid, device, inode):
        meta = f"{device} {inode} {pin['size']} 700 0 1"
        return meta + '\n' + meta + f"\n{pin['sha256']}  /proc/{pid}/exe"
    gp = process_text(guardian[0], 1, guardian[1], guard_path)
    cp = process_text(child[0], guardian[0], child[1], child_path)
    found = f'{child[0]} {child[1]} S'
    replies = [found, gp, file(guard_pin, guard_path), image(guard_pin, guardian[0], 7, 102), gp,
               cp, file(child_pin, child_path), image(child_pin, child[0], 1, 104), cp,
               '/proc/net/tcp 17A5\n/proc/net/tcp 0CA0', found]
    return guardian, child, guard_path, guard_pin, child_pin, replies


def canonical_reads():
    pinned = json.loads((ROOT / 'apps/monitor1_usb/rootfs/initial-trial-contract.json').read_bytes())
    sources = {name: hashlib.sha256((PORT / name).read_bytes()).hexdigest()
               for name in ('trial_initial_bridge_adb.py', 'review_disabled_install.py', 'stage_install_adb.py')}
    if any(pinned['source_sha256'].get(name) != sha for name, sha in sources.items()):
        raise ValueError('Frozen process reader source changed')
    sys.path.insert(0, str(PORT))
    try:
        import trial_initial_bridge_adb as trial
    finally:
        sys.path.pop(0)
    guardian, child, path, guard_pin, child_pin, replies = vector()
    class Reader:
        def __init__(self): self.commands = []
        def read(self, command):
            index = len(self.commands)
            if index >= len(replies): raise ValueError('Unexpected extra canonical read')
            self.commands.append(command)
            return replies[index]
    reader = Reader()
    if trial.child_of(reader, guardian) != child: raise ValueError('Canonical child identity drift')
    trial.process_image(reader, guardian, path, guard_pin)
    trial.process_image(reader, child, '/data/.esphome-cgs1/program', child_pin, guardian[0])
    trial.endpoint(reader, child)
    if trial.child_of(reader, guardian) != child or len(reader.commands) != len(KEYS):
        raise ValueError('Canonical process observation order drift')
    return pinned, sources, reader.commands


def content():
    pinned, sources, commands = canonical_reads()
    lookup = {value: key for key, value in VALUES.items()}
    pattern = re.compile('|'.join(re.escape(v) for v in sorted(lookup, key=len, reverse=True)))
    reads = []
    for key, command in zip(KEYS, commands, strict=True):
        parts, offset = [], 0
        for match in pattern.finditer(command):
            if match.start() > offset: parts.append(command[offset:match.start()])
            parts.append({'field': lookup[match.group()]});offset = match.end()
        if offset < len(command): parts.append(command[offset:])
        reads.append({'key': key, 'parts': parts})
    return json.dumps({'schema_version': 1, 'source_commit': pinned['source_commit'],
                       'source_sha256': sources, 'reads': reads}, indent=2) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    raw = content()
    outputs = {ROOT / 'apps/monitor1_usb/rootfs/initial-process-contract.json': raw,
               ROOT / 'custom_components/qingping_esphome/frontend/usb-initial-process-contract.mjs':
                   '// Generated fixed read-only kernel/image/socket commands; no transport authority.\n'
                   'export const initialProcessContract = ' + raw.rstrip() + ';\n'}
    for path, text in outputs.items():
        if args.check:
            if not path.is_file() or path.read_text() != text: raise SystemExit('Initial process contract is stale')
        else: path.write_text(text)


if __name__ == '__main__':
    main()
