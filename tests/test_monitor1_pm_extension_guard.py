"""Linux/root execution of rewritten PM guards in a private tmpfs fixture.

Every production path is replaced before /bin/sh sees the script. No monitor
ELF, stock launcher, real /data, /proc or hardware is executed/modified. The
production ext4 check is substituted ONLY in this explicit tmpfs test; this
qualifies failure/order semantics, not device NAND or a physical installation.
"""
import hashlib
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
import test_usb_pm_extension_guard as fixtures


@unittest.skipUnless(sys.platform.startswith('linux') and os.geteuid() == 0 and Path('/dev/shm').is_dir(),
                     'Explicit disposable Linux/root tmpfs fixture; never request local sudo')
class ExecutedPmGuardTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='qingping_pm_guard_', dir='/dev/shm')
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name);self.root.chmod(0o700)
        self.canonical, self.policy = fixtures.observer, fixtures.policy
        f = fixtures.PmGuardTests(methodName='runTest');f.setUp()
        self.plan, self.digest, self.nonce, self.frame = f.plan, f.digest, f.nonce, f.frame
        self.receipt = {'nonce': 'a' * 32}
        self.base = self.path(self.policy.BASE);self.base.mkdir(parents=True, mode=0o700)
        self.base.chmod(0o700)
        self.path('/tmp').mkdir(mode=0o1777);self.path('/tmp').chmod(0o1777)
        for name, leaf in self.canonical.staging.STAGED.items():
            body = ('synthetic-role ' + name).encode()
            self.write(self.policy.BASE + '/' + leaf, body)
            self.plan['files'][name] = {'size': len(body), 'sha256': hashlib.sha256(body).hexdigest()}
        vendor_hashes = []
        for path in self.canonical.review.preflight.FILES:
            body = ('synthetic-vendor ' + path).encode();self.write(path, body)
            vendor_hashes.append((path, hashlib.sha256(body).hexdigest()))
        self.write('/data/etc/setting.ini', b'[sensors]\nco2_type=3\n')
        self.write('/data/etc/os-release', b'CLEARGRASS_VERSION=4.1.8_0287\n')
        self.write('/sys/class/net/wlan0/address', (self.plan['target']['wlan_mac'] + '\n').encode())
        self.write('/proc/sys/kernel/random/boot_id', (self.frame['boot_id'] + '\n').encode())
        self.write('/bin/busybox', b'synthetic never-executed busybox image')
        self.write(self.policy.BASE + '/install.intent', (self.plan['plan_id'] + ' ' + self.digest + '\n').encode())
        self.write(self.policy.BASE + '/' + self.policy.FLAG, b'')
        leaf, body = self.canonical.arm.completion_record(self.plan, self.digest, self.receipt['nonce'], 'arm')
        self.write(self.policy.BASE + '/' + leaf, (body + '\n').encode())
        self.write(self.canonical.LOCK + '/supervisor.pid', (str(self.frame['supervisor'][0]) + '\n').encode())
        self.write(self.canonical.LOCK + '/child.pid', (str(self.frame['child'][0]) + '\n').encode())
        parents = {'stock': 'watchdog', 'child': 'supervisor'}
        images = {'stock': '/data/bin/SnowApp', 'child': self.policy.BASE + '/program',
                  'supervisor': '/bin/busybox', 'watchdog': '/bin/busybox'}
        for name, pair in self.frame.items():
            if name == 'boot_id':continue
            pid, start = pair
            parent = self.frame[parents[name]][0] if name in parents else 1
            fields = ['S', str(parent), *(['0'] * 17), str(start)]
            self.write('/proc/' + str(pid) + '/stat', (str(pid) + ' (synthetic) ' + ' '.join(fields) + '\n').encode())
            self.path('/proc/' + str(pid) + '/exe').symlink_to(self.path(images[name]))
            self.write('/proc/' + str(pid) + '/maps', b'')
        for name, args in [('supervisor', ['/bin/sh', self.policy.BASE + '/launch.sh', 'supervise']),
                           ('watchdog', ['/bin/sh', '/data/bin/watchdog.sh'])]:
            self.write('/proc/' + str(self.frame[name][0]) + '/cmdline', b'\x00'.join(self.rewrite(a).encode() for a in args) + b'\x00')
        info = self.base.stat()
        self.baseline = SimpleNamespace(boot_id=f.baseline.boot_id, root_identity=(info.st_dev, info.st_ino),
                                        vendor_hashes=tuple(vendor_hashes))
        self.script = self.policy.command(self.canonical, self.plan, self.digest, self.baseline, self.receipt, self.frame, self.nonce)[0]
        self.proof = self.policy.completion_check(self.canonical, self.plan, self.digest, self.baseline, self.frame, self.nonce)

    def path(self, path):return self.root / path.lstrip('/')

    def write(self, path, body):
        path = self.path(path);path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        path.write_bytes(body);path.chmod(0o600)

    def rewrite(self, script):
        # A single regex pass prevents recursively replacing /data segments
        # inside an already substituted private fixture path.
        pattern = r'/bin/busybox|/(?:data|proc|sys|tmp|etc|lib|usr)(?=/|\b)'
        text = re.sub(pattern, lambda match: str(self.path(match[0])), script)
        # This fixture deliberately uses tmpfs; production admission remains
        # ext4 with no environment/CLI override or runtime test mode.
        return text.replace("= ef53 ]", "= 1021994 ]")

    def execute(self, script):
        text = self.rewrite(script)
        self.assertNotRegex(text, r'(?<![A-Za-z0-9_])/(?:data|proc|sys|tmp|etc|lib|usr)(?=/|\b)')
        return subprocess.run(['/bin/sh', '-e'], input=text.encode(), capture_output=True, timeout=20)

    def test_real_shell_completes_once_and_refuses_replay_without_removing_history(self):
        result = self.execute(self.script)
        self.assertEqual(result.returncode, 0, result.stderr.decode())
        self.assertEqual(result.stdout, b'')
        self.assertFalse((self.base / self.policy.FLAG).exists())
        for path in (self.base / self.policy.BACKUP, self.path(self.policy.ATTEMPTED)):
            self.assertEqual(path.read_bytes(), b'')
        self.assertTrue((self.base / self.policy.DONE).is_file())
        self.assertEqual(self.execute(self.proof).returncode, 0)
        before = {str(p): p.read_bytes() for p in (self.base / self.policy.DONE, self.base / self.policy.LOCK / 'owner')}
        self.assertNotEqual(self.execute(self.script).returncode, 0)
        self.assertEqual({str(p): p.read_bytes() for p in map(Path, before)}, before)

    def test_changed_process_birth_refuses_before_lock_or_flag_effect(self):
        path = self.path('/proc/' + str(self.frame['stock'][0]) + '/stat')
        path.write_bytes(path.read_bytes().replace(b'1000\n', b'1001\n'))
        self.assertNotEqual(self.execute(self.script).returncode, 0)
        self.assertTrue((self.base / self.policy.FLAG).exists())
        self.assertFalse((self.base / self.policy.LOCK).exists())
        self.assertFalse(self.path(self.policy.ATTEMPTED).exists())

    def test_interrupted_after_inhibition_keeps_optout_and_cannot_resume(self):
        stop = ': > ' + self.policy.ATTEMPTED + '\nsync\n'
        self.assertEqual(self.script.count(stop), 1)
        broken = self.script.replace(stop, stop + 'exit 97\n')
        self.assertEqual(self.execute(broken).returncode, 97)
        self.assertTrue((self.base / self.policy.FLAG).exists())
        self.assertTrue(self.path(self.policy.ATTEMPTED).is_file())
        self.assertFalse((self.base / self.policy.DONE).exists())
        self.assertNotEqual(self.execute(self.proof).returncode, 0)
        self.assertNotEqual(self.execute(self.script).returncode, 0)

    def test_interrupted_after_last_flag_needs_actual_completion_record(self):
        stop = '\nrm ' + self.policy.BASE + '/' + self.policy.FLAG + '\nsync\n'
        self.assertEqual(self.script.count(stop), 1)
        broken = self.script.replace(stop, stop + 'exit 98\n')
        self.assertEqual(self.execute(broken).returncode, 98)
        self.assertFalse((self.base / self.policy.FLAG).exists())
        self.assertTrue(self.path(self.policy.ATTEMPTED).is_file())
        self.assertFalse((self.base / self.policy.DONE).exists())
        self.assertNotEqual(self.execute(self.proof).returncode, 0)
        self.assertNotEqual(self.execute(self.script).returncode, 0)


if __name__ == '__main__':unittest.main()
