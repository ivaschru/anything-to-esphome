#!/usr/bin/env python3
"""Pin the frozen first-trial readers, separately from native USB authority.

This is public source metadata only. It never builds a program, changes an old
browser plan or contacts a device. The private SDK must verify these actual
files before importing its transport-independent guardian artifact auditor.
"""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PORT = ROOT / 'ports/monitor1'


def content():
    names = {'trial_initial_bridge_adb.py', 'review_initial_trial.py', 'initial_bridge_trial_policy.py',
             'initial_bridge_trial_main.cpp', 'review_disabled_install.py', 'stage_install_adb.py',
             'prepare_install.py', 'build_candidate.py', 'build_pm_helper.py', 'preflight_adb.py',
             'bootstrap_patches.py', 'disabled_commit_policy.py', 'commit_disabled_install.py'}
    names.update(path.name for path in PORT.glob('initial_trial_*.h'))
    value = {'source_commit': '53d97b9609e8e0fcdfc5d003101f620098dbc734',
             'guardian_role': 'initial-trial-guardian-program',
             'source_sha256': {name: hashlib.sha256((PORT / name).read_bytes()).hexdigest() for name in sorted(names)}}
    return json.dumps(value, indent=2) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    path = ROOT / 'apps/monitor1_usb/rootfs/initial-trial-contract.json'
    data = content()
    if args.check:
        if not path.is_file() or path.read_text() != data:
            raise SystemExit('Initial-trial source contract is stale')
    else:
        path.write_text(data)


if __name__ == '__main__':
    main()
