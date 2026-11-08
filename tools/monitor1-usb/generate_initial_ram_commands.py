#!/usr/bin/env python3
"""Pure fixed RAM command templates from frozen canonical disabled guards.

Nothing executes here. Required runtime leaves are typed before substitution
by the browser assembler; no caller path, shell body or execution selector is
accepted. The eventual writer still needs its consumed journal/original live
capability and the sealed length/SHA stdin transport before interpreting this
bounded creation body. Readback and device image-FD admission stay separate.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[2]
PORT = ROOT / 'ports/monitor1'
sys.path.insert(0, str(PORT))
try:
    import commit_disabled_install as commit
    import review_initial_trial as initial
finally:
    sys.path.pop(0)

FIELDS = {name: 'QP_BROWSER_RAM_FIELD_' + name.upper() for name in
          ('plan_id', 'plan_sha256', 'root_device', 'root_inode', 'wlan_mac', 'co2_type', 'boot_id',
           'stock_pid', 'stock_start', 'watchdog_pid', 'watchdog_start', 'ram_job_id', 'guardian_job_id', 'guardian_bytes')}
FIELDS['commit_nonce'] = '6b14947f19e44c6c99b5ae57c81752a4'  # Canonical builder requires an actual hex token.
FIELDS.update({'staged_' + str(i): 'QP_BROWSER_RAM_FIELD_STAGED_' + str(i) for i in range(len(commit.staging.STAGED))})
FIELDS.update({'vendor_' + str(i): 'QP_BROWSER_RAM_FIELD_VENDOR_' + str(i) for i in range(len(commit.preflight.FILES))})
PRODUCERS = ['browser_initial_journal.py', 'browser_initial_observation.py', 'browser_initial_trial.py',
             'browser_initial_trial_job.py', 'initial-trial-contract.json', 'initial-ram-contract.json', 'initial-guardian-contract.json', 'initial-process-contract.json', 'browser_initial_api.py']


def split_fields(text):
    tokens = {value: name for name, value in FIELDS.items()}
    pattern = re.compile('|'.join(re.escape(value) for value in sorted(tokens, key=len, reverse=True)))
    result, offset = [], 0
    for match in pattern.finditer(text):
        if offset < match.start(): result.append(text[offset:match.start()])
        result.append({'field': tokens[match.group()]});offset = match.end()
    if offset < len(text): result.append(text[offset:])
    if 'QP_BROWSER_RAM_FIELD_' in ''.join(v for v in result if isinstance(v, str)):
        raise ValueError('Unknown symbolic leaf in the RAM command')
    return result


def memory_guard():
    # Match the canonical host memory() semantics with an inline refusal before
    # allocating tmpfs pages. No MemAvailable/buffer/cache/swap credit; duplicate
    # labels, wrong units, impossible totals and low free memory all refuse.
    minimum = initial.trial.MIN_START_RAM
    if minimum % 1024:
        raise ValueError('Canonical RAM minimum is not whole KiB')
    return ("""awk '
$1 == "MemTotal:" || $1 == "MemFree:" {
 if (NF != 3 || $2 !~ /^[0-9]+$/ || $3 != "kB" || seen[$1]++) bad=1;
 if ($1 == "MemTotal:") total=$2; else free=$2;
}
END { if (bad || seen["MemTotal:"] != 1 || seen["MemFree:"] != 1 ||
 free < MINIMUM_KIB || free > total || total > 1073741824) exit 1 }
' /proc/meminfo""".replace('MINIMUM_KIB', str(minimum // 1024)))


def ram_allocation_script(values):
    """Only new private tmpfs jobs and one exclusive non-executable file.

    Kept separately so a Linux/root fixture can execute a path-rewritten copy
    of this new allocation tail only. It never executes a production guard or
    guardian, and cannot qualify the complete source/device/USB admission.
    """
    ram = '/tmp/qingping-initial-trial-' + values['ram_job_id']
    guardian = '/tmp/qingping-initial-guardian-' + values['guardian_job_id']
    return (memory_guard() + "\ntest ! -L /tmp\ntest -d /tmp\n" +
        commit.equal("readlink -f /tmp", '/tmp') + commit.equal("stat -c '%a %u' /tmp", '1777 0') +
        "qp_ram_fs=$(stat -f -c '%t %a %S' /tmp)\nset -- $qp_ram_fs\n[ \"$#\" -eq 3 ]\n" +
        "[ \"$1\" = '1021994' ]\ncase \"$2:$3\" in (*[!0-9:]*|:*|*:) exit 1;; esac\n" +
        '[ "$3" -ge 512 ]\n[ "$3" -le 65536 ]\n' +
        # Shell integer overflow must not turn malformed capacity into budget.
        '[ "${#2}" -le 10 ]\n[ "${#3}" -le 5 ]\n' +
        # Bound BEFORE multiplication for ARM32 BusyBox signed arithmetic.
        '[ "$2" -le "$(( 2147483647 / $3 ))" ]\n' +
        '[ "$(( $2 * $3 ))" -ge "$(( ' + values['guardian_bytes'] + ' + 8388608 ))" ]\n' +
        'test ! -e ' + ram + '\ntest ! -L ' + ram + '\ntest ! -e ' + guardian + '\ntest ! -L ' + guardian + '\n' +
        'mkdir -m 700 ' + ram + '\nmkdir -m 700 ' + guardian + '\n' +
        'test ! -e ' + guardian + '/program\ntest ! -L ' + guardian + '/program\nset -C\n: > ' + guardian + '/program')


def preparation_guard(values):
    staged, vendors = list(commit.staging.STAGED), sorted(commit.preflight.FILES)
    plan = {'plan_id': values['plan_id'], 'files': {name: {'sha256': values['staged_' + str(i)]} for i, name in enumerate(staged)}}
    scope = SimpleNamespace(root_identity=(values['root_device'], values['root_inode']),
        install_marker=values['plan_id'] + ' ' + values['plan_sha256'], target=(values['wlan_mac'], values['co2_type']),
        boot_id=values['boot_id'], stock_process=(values['stock_pid'], values['stock_start']),
        watchdog_process=(values['watchdog_pid'], values['watchdog_start']),
        vendor_hashes=tuple((path, values['vendor_' + str(i)]) for i, path in enumerate(vendors)))
    guard = commit.inline_guard(plan, scope, 'commit_disabled', values['commit_nonce'])
    if guard.count(commit.review.PROCESS_SCAN) != 1:
        raise ValueError('Exact canonical stock scan required')
    # Strengthen only the initial RAM-program scan with the canonical initial
    # reader. Never weaken the frozen root, source, flags, lock or PID checks.
    guard = guard.replace(commit.review.PROCESS_SCAN, initial.INITIAL_PROCESS_SCAN)
    return ('set -eu\numask 077\n' + guard + initial.ABSENT_STORES + '\n' +
            initial.tcp_read(False) + '\n' + initial.tcp_read(True) + '\n')


def commands(values):
    create = preparation_guard(values) + ram_allocation_script(values)
    ram = '/tmp/qingping-initial-trial-' + values['ram_job_id']
    guardian = '/tmp/qingping-initial-guardian-' + values['guardian_job_id']
    tmp = ('test ! -L /tmp\ntest -d /tmp\n' + commit.equal('readlink -f /tmp', '/tmp') +
           commit.equal("stat -c '%a %u' /tmp", '1777 0'))
    roots = 'set -eu\numask 077\n' + tmp
    for path, entries in ((ram, ''), (guardian, 'program')):
        roots += ('test ! -L ' + path + '\ntest -d ' + path + '\n' + commit.equal('readlink -f ' + path, path) +
                  commit.equal("stat -c '%a %u' " + path, '700 0') +
                  commit.equal('LC_ALL=C ls -A1 ' + path, entries) + "stat -c '%d %i %a %u' " + path +
                  "\nstat -f -c '%t %a %S' " + path + '\n')
    file = guardian + '/program'
    inspect = ('set -eu\numask 077\n' + tmp + 'test ! -L ' + guardian + '\ntest -d ' + guardian + '\n' +
               commit.equal('readlink -f ' + guardian, guardian) + commit.equal("stat -c '%a %u' " + guardian, '700 0') +
               'test ! -L ' + file + '\ntest -f ' + file + '\n' +
               commit.equal("stat -c '%a %u %h' " + file, '600 0 1') + "stat -c '%s %a %u %h %d %i' " + file + '\nsha256sum ' + file)
    return {'create': create, 'inspect_roots': roots.rstrip('\n'), 'inspect_guardian': inspect}


def specification():
    required = json.loads((ROOT / 'apps/monitor1_usb/rootfs/initial-trial-contract.json').read_bytes())
    return {'schema_version': 1, 'source_commit': required['source_commit'], 'staged_roles': list(commit.staging.STAGED),
            'vendor_paths': sorted(commit.preflight.FILES), 'producer_files': PRODUCERS,
            'source_sha256': {name: hashlib.sha256((PORT / name).read_bytes()).hexdigest() for name in
                ('commit_disabled_install.py', 'review_initial_trial.py', 'review_disabled_install.py', 'stage_install_adb.py',
                 'initial_bridge_trial_policy.py', 'disabled_commit_policy.py', 'bootstrap_patches.py', 'preflight_adb.py')},
            'templates': {name: split_fields(body) for name, body in commands(FIELDS).items()}}


def main():
    parser = argparse.ArgumentParser(description=__doc__);parser.add_argument('--check', action='store_true');args = parser.parse_args()
    value = specification();raw = json.dumps(value, indent=2) + '\n'
    outputs = {ROOT / 'apps/monitor1_usb/rootfs/initial-ram-contract.json': raw,
        ROOT / 'custom_components/qingping_esphome/frontend/usb-initial-ram-contract.mjs':
            '// Generated by tools/monitor1-usb/generate_initial_ram_commands.py; pure fixed RAM templates.\n'
            'export const initialRamContract = ' + raw.rstrip() + ';\n'}
    for path, body in outputs.items():
        if args.check:
            if not path.is_file() or path.read_text() != body:raise SystemExit('Initial RAM command contract is stale')
        else:path.write_text(body)


if __name__ == '__main__':main()
