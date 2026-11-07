"""Execute only shell syntax parsing for the inert PM next-boot guard.

These fixtures never execute a production command, ELF or hardware action.
They check binding rejection and POSIX parsing of the full generated script,
including the real complete procfs scan and nested failure-preserving reads.
"""
import copy
from pathlib import Path
import subprocess
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
with patch.object(sys, 'path', [str(ROOT / 'apps/monitor1_usb/rootfs'), str(ROOT / 'ports/monitor1'), *sys.path]):
    import pm_extension_guard as policy
    import verify_bridge_boot_adb as observer


class PmGuardTests(unittest.TestCase):
    def setUp(self):
        self.plan = {'plan_id': 'c' * 32, 'target': {'wlan_mac': '02:00:00:00:00:01', 'co2_type': 3,
            'stock_version': '4.1.8_0287'}, 'files': {kind: {'size': 100, 'sha256': 'd' * 64} for kind in
            set(observer.staging.STAGED) | {'native-program', 'guardian-program'}}}
        self.baseline = SimpleNamespace(boot_id='11111111-1111-1111-1111-111111111111', root_identity=(42, 43),
            vendor_hashes=tuple((path, value[0]) for path, value in observer.review.preflight.FILES.items()))
        self.frame = {'boot_id': '22222222-2222-2222-2222-222222222222', 'stock': (100, 1000),
                      'watchdog': (99, 990), 'child': (200, 2000), 'supervisor': (199, 1990)}
        self.digest, self.nonce = 'e' * 64, 'f' * 32

    def command(self, **changes):
        args = dict(plan=self.plan, digest=self.digest, baseline=self.baseline, receipt={'nonce': 'a' * 32},
                    frame=self.frame, nonce=self.nonce)
        return policy.command(observer, **{**args, **changes})

    def test_full_real_scan_and_script_parse_without_execution(self):
        text, body = self.command()
        # -n is essential: executing these fixed production paths on a host
        # would be wrong. No subprocess mock can substitute for POSIX parse.
        subprocess.run(['/bin/sh', '-n'], input=text.encode(), check=True, capture_output=True)
        self.assertEqual(body, 'initial-pm-enable ' + self.nonce + ' ' + self.plan['plan_id'] + ' ' + self.digest + ' ' + self.frame['boot_id'])
        remove = '\nrm ' + policy.BASE + '/' + policy.FLAG + '\n'
        self.assertEqual(text.count(remove), 1)
        self.assertLess(text.index(': > ' + policy.ATTEMPTED), text.index(remove))
        self.assertLess(text.index(': > ' + policy.BASE + '/' + policy.BACKUP), text.index(remove))
        self.assertGreater(text.index(' > ' + policy.BASE + '/' + policy.DONE), text.index(remove))
        self.assertIn('observed_value=$(# CGS1_BOOT_LOCK', text)
        self.assertIn('observed_value=$(count=0\nfor link in /proc/[0-9]*/exe', text)
        for forbidden in ('kill -', 'reboot', 'LD_PRELOAD=', 'rfkill', '/dev/tty', '/sys/class/gpio'):
            self.assertNotIn(forbidden, text)

    def test_fixture_rewrites_only_the_absolute_root_prefix_once(self):
        import test_monitor1_pm_extension_guard as execution
        fixture = execution.ExecutedPmGuardTests(methodName='runTest')
        fixture.root = Path('/dev/shm/synthetic_pm_fixture')
        original = "/data/etc/os-release /usr/lib/library /proc/sys/kernel/random/boot_id /tmp/inhibit /bin/sh"
        expected = " ".join(str(fixture.root) + p for p in (
            "/data/etc/os-release", "/usr/lib/library", "/proc/sys/kernel/random/boot_id", "/tmp/inhibit")) + " /bin/sh"
        self.assertEqual(fixture.rewrite(original), expected)
        original = "printf '/bin/sh\\n/data/bin/watchdog.sh'"
        expected = "printf '/bin/sh\\n" + str(fixture.root) + "/data/bin/watchdog.sh'"
        self.assertEqual(fixture.rewrite(original), expected)

    def test_unknown_boot_process_identity_or_shell_values_refuse(self):
        for frame in ({**self.frame, 'boot_id': self.baseline.boot_id}, {**self.frame, 'stock': (True, 1000)},
                      {**self.frame, 'child': self.frame['supervisor']}, {**self.frame, 'extra': 'unreviewed'}):
            with self.subTest(frame=frame), self.assertRaises(ValueError):
                self.command(frame=frame)
        for value in ('', '0' * 32, 'a; reboot', 'A' * 32):
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.command(nonce=value)
        for field, value in (('root_identity', (True, 43)), ('vendor_hashes', (('/tmp/foreign', 'd' * 64),))):
            baseline = copy.copy(self.baseline);setattr(baseline, field, value)
            with self.assertRaises(ValueError):self.command(baseline=baseline)

    def test_positive_absence_and_actual_optout_are_independent(self):
        text, _ = self.command()
        self.assertIn('entries=$(LC_ALL=C ls -A1 /tmp)', text)
        self.assertIn("stat -f -c '%t' /tmp", text)
        self.assertIn("stat -f -c '%t' " + policy.BASE, text)
        # The no-clobber mode stays active through every durable write. The
        # old attempt/backup/lock is never removed to manufacture a retry.
        self.assertIn('set -C\n', text)
        self.assertNotIn('rm -f', text)
        for leaf in (policy.BACKUP, policy.LOCK, policy.DONE):
            self.assertNotIn('\nrm ' + policy.BASE + '/' + leaf, text)


if __name__ == '__main__':unittest.main()
