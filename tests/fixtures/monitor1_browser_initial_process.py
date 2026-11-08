"""Canonical read-only helper vectors; all process/filesystem replies synthetic."""
from contextlib import redirect_stdout
import io
import json
from pathlib import Path
import runpy
import sys

ROOT = Path(__file__).resolve().parents[2]
with redirect_stdout(io.StringIO()):
    base = runpy.run_path(str(ROOT / 'tests/fixtures/monitor1_browser_guardian_frame.py'))['result']
sys.path.insert(0, str(ROOT / 'ports/monitor1'))
import trial_initial_bridge_adb as trial

KEYS = ('child_before', 'guardian_process_before', 'guardian_file', 'guardian_image', 'guardian_process_after',
        'child_process_before', 'child_file', 'child_image', 'child_process_after', 'endpoint', 'child_after')


def stat(pid, parent, birth, path):
    fields = ['0'] * 20
    fields[0], fields[1], fields[19] = 'S', str(parent), str(birth)
    return str(pid) + ' (synthetic name ) ( with spaces) ' + ' '.join(fields) + '\n0\n' + path


result = []
for i, value in enumerate(base):
    packet, ram = value['packet'], value['ram']
    guardian, child = (217001001 + i, 2**64 - 1 - i), (217001011 + i, 1900043 + i)
    guard = '/tmp/qingping-initial-guardian-' + packet['guardian_job_id'] + '/program'
    bridge = '/data/.esphome-cgs1/program'
    guard_pin, child_pin = packet['context']['guardian'], packet['context']['meta']['descriptor']['files']['bridge-program']
    guard_device, guard_inode = ram['uploaded']['guardian_file_identity']
    child_device = packet['context']['committed_scope']['root_identity'][0]
    def file(pin, path): return f"{pin['size']} 1\n{pin['sha256']}  {path}"
    def image(pin, pid, device, inode):
        meta = f"{device} {inode} {pin['size']} 700 0 1"
        return meta + '\n' + meta + f"\n{pin['sha256']}  /proc/{pid}/exe"
    gp, cp = stat(guardian[0], 1, guardian[1], guard), stat(child[0], guardian[0], child[1], bridge)
    found = f'{child[0]} {child[1]} S'
    endpoints = '/proc/net/tcp 17A5\n/proc/net/tcp 0CA0'
    if i % 2: endpoints += '\n/proc/net/tcp6 17A5\n/proc/net/tcp6 0CA0'
    replies = [found, gp, file(guard_pin, guard), image(guard_pin, guardian[0], guard_device, guard_inode), gp,
               cp, file(child_pin, bridge), image(child_pin, child[0], child_device, 104), cp, endpoints, found]
    class Reader:
        def __init__(self): self.commands = []
        def read(self, command):
            n = len(self.commands)
            self.commands.append(command)
            return replies[n]
    reader = Reader()
    assert trial.child_of(reader, guardian) == child
    trial.process_image(reader, guardian, guard, guard_pin)
    trial.process_image(reader, child, bridge, child_pin, guardian[0])
    trial.endpoint(reader, child)
    assert trial.child_of(reader, guardian) == child
    assert len(reader.commands) == len(KEYS)
    started = {'kind': 'browser_initial_guardian_started_record', 'records_only': True,
               'start': {'kind': 'start', 'nonce': packet['nonce'], 'stamp': [guardian[0], str(guardian[1])]},
               'child': {'kind': 'child', 'nonce': packet['nonce'], 'stamp': [child[0], str(child[1])]}}
    result.append({'packet': packet, 'ram': ram, 'started': started,
                   'commands': dict(zip(KEYS, reader.commands, strict=True)), 'reads': dict(zip(KEYS, replies, strict=True)),
                   'guardian_image': [str(guard_device), str(guard_inode)], 'child_image': [str(child_device), '104']})
print(json.dumps(result))
