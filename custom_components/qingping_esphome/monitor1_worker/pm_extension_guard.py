"""Fixed next-boot PM-extension guard, not an executable installer.

This composes the existing initial-install observer's exact current scope.
A separate owner/plan-bound consumed intent and SDK adapter must precede use.
It never signals SnowApp or changes UART/GPIO/DRM, and cannot launch a helper.
The existing once-per-boot wrapper and stock fallback remain unchanged.
"""
import hashlib
import re
import shlex

BASE = '/data/.esphome-cgs1'
FLAG = 'pm-helper.disabled'
BACKUP = 'pm-helper.disabled.before-initial-enable'
LOCK = '.initial-pm-enable.lock'
DONE = 'initial-pm-enable.complete'
ATTEMPTED = '/tmp/qingping-pm-helper.attempted'


def require(value):
    if not value:
        raise ValueError('Exact current initial PM-extension scope required')


def absent(leaf):
    """A failed directory read is not absence; only these fixed leaves exist."""
    require(leaf in (FLAG, BACKUP, LOCK, DONE, 'disabled'))
    return ('entries=$(LC_ALL=C ls -A1 ' + BASE + ')\n' +
            'printf \'%s\\n\' "$entries" | while IFS= read -r entry; do\n' +
            ' case "$entry" in (' + leaf + ') exit 1;; esac\ndone\n')


def binding(plan, digest, baseline, frame, nonce):
    """Validate every interpolated value before assembling a shell guard."""
    require(isinstance(digest, str) and re.fullmatch(r'[a-f0-9]{64}', digest) and
            isinstance(plan.get('plan_id'), str) and re.fullmatch(r'[a-f0-9]{32}', plan['plan_id']) and
            isinstance(nonce, str) and re.fullmatch(r'[a-f0-9]{32}', nonce) and nonce != '0' * 32 and
            isinstance(frame, dict) and set(frame) == {'boot_id', 'child', 'supervisor', 'stock', 'watchdog'})
    boot = frame['boot_id']
    require(isinstance(boot, str) and re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', boot) and
            boot != baseline.boot_id and type(baseline.root_identity) is tuple and len(baseline.root_identity) == 2 and
            all(type(value) is int and 0 < value < 2**64 for value in baseline.root_identity))
    pairs = [frame[name] for name in ('child', 'supervisor', 'stock', 'watchdog')]
    require(all(isinstance(pair, (tuple, list)) and len(pair) == 2 and type(pair[0]) is int and
                1 < pair[0] <= 2**31 - 1 and type(pair[1]) is int and 0 < pair[1] < 2**64 for pair in pairs) and
            len({pair[0] for pair in pairs}) == 4)
    target = plan['target']
    require(isinstance(target['wlan_mac'], str) and re.fullmatch(r'[a-f0-9]{2}(?::[a-f0-9]{2}){5}', target['wlan_mac']) and
            type(target['co2_type']) is int and target['co2_type'] in (2, 3) and target['stock_version'] == '4.1.8_0287')
    return 'initial-pm-enable ' + nonce + ' ' + plan['plan_id'] + ' ' + digest + ' ' + boot


def command(observer, plan, digest, baseline, receipt, frame, nonce):
    """One fixed opt-out removal for NEXT boot, bracketed by actual guards.

    The caller must collect observer.scope freshly and rejoin the original
    bridge arming AFTER-effects record before this command. The same shell
    repeats boot, root, immutable bytes, process births/parents and complete
    scans immediately before each flag effect. A matching completion record
    is written after the final flag mutation; flags alone never prove that
    an older timed-out writer has finished. Locks and backups are permanent.
    """
    body = binding(plan, digest, baseline, frame, nonce)
    arm, commit = observer.arm, observer.arm.commit
    require(observer.BASE == BASE and arm.BASE == BASE and observer.staging.BASE == BASE)
    # These sources came from canonical load_plan/basis, not HTTP filenames.
    require(set(plan['files']) == set(observer.staging.STAGED) | {'native-program', 'guardian-program'})
    for pin in plan['files'].values():
        require(isinstance(pin, dict) and set(pin) == {'size', 'sha256'} and type(pin['size']) is int and
                0 < pin['size'] <= 16 * 1024**2 and isinstance(pin['sha256'], str) and re.fullmatch(r'[a-f0-9]{64}', pin['sha256']))
    expected_vendors = dict(baseline.vendor_hashes)
    require(set(expected_vendors) == set(observer.review.preflight.FILES) and
            all(isinstance(sha, str) and re.fullmatch(r'[a-f0-9]{64}', sha) for sha in expected_vendors.values()))
    equal, checked = commit.equal, commit.checked_file
    empty_sha = hashlib.sha256(b'').hexdigest()
    def flag(leaf):
        require(leaf in (FLAG, BACKUP))
        path = BASE + '/' + leaf
        return checked(path, empty_sha) + equal("stat -c '%s %a %u %h' " + path, '0 600 0 1')
    def guard():
        root = str(baseline.root_identity[0]) + ' ' + str(baseline.root_identity[1]) + ' 700 0'
        text = 'test ! -L /data\ntest ! -L ' + BASE + '\ntest -d ' + BASE + '\n'
        text += equal("stat -c '%d %i %a %u' " + BASE, root)
        text += equal("stat -f -c '%t' " + BASE, 'ef53')
        text += checked(BASE + '/install.intent', hashlib.sha256((plan['plan_id'] + ' ' + digest + '\n').encode()).hexdigest())
        text += equal("stat -c '%s %a %u %h' " + BASE + '/install.intent', '98 600 0 1')
        text += arm.completion_guard(plan, digest, receipt['nonce'], 'arm') + absent('disabled')
        text += equal('cat /sys/class/net/wlan0/address', plan['target']['wlan_mac'])
        text += equal('cat /data/etc/os-release', 'CLEARGRASS_VERSION=4.1.8_0287')
        text += equal('cat /proc/sys/kernel/random/boot_id', frame['boot_id'])
        text += equal(observer.review.preflight.CO2_READ, plan['target']['co2_type'])
        for name, leaf in observer.staging.STAGED.items():
            require(re.fullmatch(r'[a-zA-Z0-9_.-]{1,80}', leaf) and leaf not in ('.', '..'))
            text += checked(BASE + '/' + leaf, plan['files'][name]['sha256'])
        for path, sha in expected_vendors.items():
            text += checked(path, sha)
        text += equal(observer.lock_command(), str(frame['supervisor'][0]) + '\n' + str(frame['child'][0]))
        text += ('entries=$(LC_ALL=C ls -A1 ' + BASE + ')\n' +
                 'printf \'%s\\n\' "$entries" | while IFS= read -r entry; do\n' +
                 ' case "$entry" in (full-releases|wifi|full-state) exit 1;; esac\ndone\n')
        text += equal('cat ' + observer.LOCK + '/supervisor.pid', frame['supervisor'][0])
        text += equal('cat ' + observer.LOCK + '/child.pid', frame['child'][0])
        # Keep the complete stock/own-code scan, admitting only this verified
        # current bridge child. A printed PID followed by read failure fails.
        original = '(/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*) exit 1;;'
        scan = arm.initial.INITIAL_PROCESS_SCAN
        require(scan.count(original) == 1)
        allowed = original.removesuffix(' exit 1;;') + '\ncase "$pid:$executable" in\n(' + shlex.quote(
            str(frame['child'][0]) + ':' + BASE + '/program') + ') :;;\n(*) exit 1;;\nesac;;'
        text += equal(scan.replace(original, allowed), frame['stock'][0])
        for name, executable in (('child', BASE + '/program'), ('supervisor', '/bin/busybox'),
                                 ('stock', '/data/bin/SnowApp'), ('watchdog', '/bin/busybox')):
            pid, start = frame[name]
            proc = '/proc/' + str(pid)
            text += equal('readlink ' + proc + '/exe', executable) + equal("stat -c '%u' " + proc, 0)
            text += equal("sed 's/.*) //' " + proc + "/stat | awk '{print $20}'", start)
            text += ("process_state=$(sed 's/.*) //' " + proc + "/stat | awk '{print $1}')\n" +
                     'case "$process_state" in R|S|D|I) :;; *) exit 1;; esac\n')
        for name, parent in (('stock', 'watchdog'), ('child', 'supervisor')):
            text += equal("sed 's/.*) //' /proc/" + str(frame[name][0]) + "/stat | awk '{print $2}'", frame[parent][0])
        for name, args in (('supervisor', '/bin/sh\\n' + BASE + '/launch.sh\\nsupervise'),
                           ('watchdog', '/bin/sh\\n/data/bin/watchdog.sh')):
            text += "arguments=$(tr '\\000' '\\n' < /proc/" + str(frame[name][0]) + "/cmdline)\n"
            text += '[ "$arguments" = "$(printf ' + shlex.quote(args) + ')" ]\n'
        maps = '/proc/' + str(frame['stock'][0]) + '/maps'
        for prefix in (BASE + '/', '/tmp/qingping-full-', '/tmp/qingping-initial-'):
            text += 'test -r ' + maps + '\nif grep -F -q ' + shlex.quote(prefix) + ' ' + maps + "; then exit 1; else result=$?; [ \"$result\" -eq 1 ]; fi\n"
        return text
    base_guard = guard()
    tmp_guard = ('test ! -L /tmp\ntest -d /tmp\n' + equal("stat -c '%a %u' /tmp", '1777 0') +
                 equal("stat -f -c '%t' /tmp", '1021994'))
    attempted_absent = ('entries=$(LC_ALL=C ls -A1 /tmp)\n' +
                        'printf \'%s\\n\' "$entries" | while IFS= read -r entry; do\n' +
                        ' case "$entry" in (qingping-pm-helper.attempted) exit 1;; esac\ndone\n')
    attempted_guard = (tmp_guard + checked(ATTEMPTED, empty_sha) +
                       equal("stat -c '%s %a %u %h' " + ATTEMPTED, '0 600 0 1'))
    owner = BASE + '/' + LOCK + '/owner'
    lock_guard = ('test ! -L ' + BASE + '/' + LOCK + '\ntest -d ' + BASE + '/' + LOCK + '\n' +
                  equal("stat -c '%a %u' " + BASE + '/' + LOCK, '700 0') +
                  checked(owner, hashlib.sha256((body + '\n').encode()).hexdigest()) +
                  equal("stat -c '%s %a %u %h' " + owner, str(len(body) + 1) + ' 600 0 1'))
    # Creation is itself a consumed remote attempt. Nothing unlinks this lock,
    # marker, original recovery flag or completion record to manufacture retry.
    text = ('umask 077\n' + base_guard + tmp_guard + attempted_absent + flag(FLAG) + absent(BACKUP) + absent(LOCK) + absent(DONE) +
            'mkdir ' + BASE + '/' + LOCK + '\nset -C\nprintf \'%s\\n\' ' + shlex.quote(body) + ' > ' + owner + '\nsync\n')
    text += base_guard + lock_guard + flag(FLAG) + absent(BACKUP) + absent(DONE)
    # Inhibit EVERY stock relaunch for the rest of this boot before removing
    # its persistent opt-out. Otherwise an unrelated stock crash could load
    # the helper immediately instead of waiting for the operator's next boot.
    text += tmp_guard + attempted_absent + ': > ' + ATTEMPTED + '\nsync\n'
    text += base_guard + lock_guard + attempted_guard + flag(FLAG) + absent(BACKUP) + absent(DONE)
    text += ': > ' + BASE + '/' + BACKUP + '\nsync\n'
    text += base_guard + lock_guard + attempted_guard + flag(FLAG) + flag(BACKUP) + absent(DONE)
    text += 'rm ' + BASE + '/' + FLAG + '\nsync\n'
    # No further flag effects follow this record, including on failure.
    text += absent(DONE) + "printf '%s\\n' " + shlex.quote(body) + ' > ' + BASE + '/' + DONE + '\nsync\n'
    return text, body


def completion_check(observer, plan, digest, baseline, frame, nonce):
    """Read-only same-boot AFTER-effects proof, never a write continuation.

    A complete owner-bound record must follow every flag effect. Its existence
    alone is insufficient: root, original plan, bytes, flag backup and this
    boot's inhibition must still match. No incomplete receipt is repaired.
    """
    body = binding(plan, digest, baseline, frame, nonce)
    commit = observer.arm.commit
    require(observer.BASE == BASE and observer.staging.BASE == BASE)
    equal, checked = commit.equal, commit.checked_file
    text = 'test ! -L /data\ntest ! -L ' + BASE + '\ntest -d ' + BASE + '\n'
    text += equal("stat -c '%d %i %a %u' " + BASE, str(baseline.root_identity[0]) + ' ' + str(baseline.root_identity[1]) + ' 700 0')
    text += equal('cat /proc/sys/kernel/random/boot_id', frame['boot_id'])
    text += equal('cat /sys/class/net/wlan0/address', plan['target']['wlan_mac'])
    text += equal('cat /data/etc/os-release', 'CLEARGRASS_VERSION=4.1.8_0287')
    text += equal(observer.review.preflight.CO2_READ, plan['target']['co2_type'])
    text += checked(BASE + '/install.intent', hashlib.sha256((plan['plan_id'] + ' ' + digest + '\n').encode()).hexdigest())
    # The original arm completion was already captured by observer.scope.
    # This receipt establishes only the new flag writer's end, not live sensor
    # health or authority to reuse its predecessor's PID/session.
    for leaf in (LOCK + '/owner', DONE):
        path = BASE + '/' + leaf
        text += checked(path, hashlib.sha256((body + '\n').encode()).hexdigest())
        text += equal("stat -c '%s %a %u %h' " + path, str(len(body) + 1) + ' 600 0 1')
    text += 'test ! -L ' + BASE + '/' + LOCK + '\ntest -d ' + BASE + '/' + LOCK + '\n'
    text += equal("stat -c '%a %u' " + BASE + '/' + LOCK, '700 0')
    text += absent(FLAG) + absent('disabled')
    for path in (BASE + '/' + BACKUP, ATTEMPTED):
        text += checked(path, hashlib.sha256(b'').hexdigest()) + equal("stat -c '%s %a %u %h' " + path, '0 600 0 1')
    text += 'test ! -L /tmp\ntest -d /tmp\n' + equal("stat -c '%a %u' /tmp", '1777 0')
    text += equal("stat -f -c '%t' /tmp", '1021994') + equal("stat -f -c '%t' " + BASE, 'ef53')
    require(set(plan['files']) == set(observer.staging.STAGED) | {'native-program', 'guardian-program'})
    for name, leaf in observer.staging.STAGED.items():
        require(re.fullmatch(r'[a-zA-Z0-9_.-]{1,80}', leaf) and leaf not in ('.', '..'))
        pin = plan['files'][name]
        require(isinstance(pin['sha256'], str) and re.fullmatch(r'[a-f0-9]{64}', pin['sha256']))
        text += checked(BASE + '/' + leaf, pin['sha256'])
    return text
