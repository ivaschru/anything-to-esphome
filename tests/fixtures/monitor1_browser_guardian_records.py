"""Canonical native stdout parser vectors; no trial, ADB or subprocess."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'ports/monitor1'))
import trial_initial_bridge_adb as trial
nonce = 'a' * 32
records = []
for birth in (12345, 2**64 - 1):
    for duration in (60000, 71000):
        for status in (0, 15):
            start = f'CGS1_TRIAL_START_V1 {nonce} 123 {birth}\n'.encode()
            child = f'CGS1_TRIAL_CHILD_V1 {nonce} 124 456\n'.encode()
            end = f'CGS1_TRIAL_END_V1 {nonce} 123 {birth} 124 456 {duration} 1 1 1 0 {status}\n'.encode()
            guardian = trial.start_record(start, nonce)
            ended = trial.end_record(end, nonce, guardian)
            ended['guardian'][1] = str(ended['guardian'][1])
            ended['child'][1] = str(ended['child'][1])
            records.append({'nonce': nonce, 'start': start.decode(), 'child': child.decode(), 'end': end.decode(),
                            'guardian': [guardian[0], str(guardian[1])], 'expected': {'kind': 'end', 'nonce': nonce, **ended}})
print(json.dumps(records))
