"""Linux/root allocation-tail fixture, never the complete production guard.

Every production path is rewritten into this fixture's own tmpfs directory.
No ELF, loader, native scope, ADB, GPIO or device command executes. This checks
exclusive creation and refusal/preservation only, not hardware qualification.
"""
import ast
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('initial_ram_commands', ROOT / 'tools/monitor1-usb/generate_initial_ram_commands.py')
commands = importlib.util.module_from_spec(spec)
spec.loader.exec_module(commands)


class GeneratedContract(unittest.TestCase):
    def test_exact_generated_contract_and_source_fingerprints(self):
        expected = commands.specification()
        actual = json.loads((ROOT / 'apps/monitor1_usb/rootfs/initial-ram-contract.json').read_bytes())
        self.assertEqual(actual, expected)
        for name, pin in actual['source_sha256'].items():
            self.assertEqual(hashlib.sha256((ROOT / 'ports/monitor1' / name).read_bytes()).hexdigest(), pin)
        # The actual journal and packaged actor must fence the same command
        # contract; a stale producer set cannot be adopted after restart.
        journal = (ROOT / 'apps/monitor1_usb/rootfs/browser_initial_journal.py').read_text()
        tree = ast.parse(journal)
        declarations = [node.value for node in tree.body if isinstance(node, ast.Assign)
                        and any(isinstance(target, ast.Name) and target.id == 'PRODUCERS' for target in node.targets)]
        self.assertEqual(len(declarations), 1)
        self.assertEqual(list(ast.literal_eval(declarations[0])), actual['producer_files'])
        self.assertEqual((ROOT / 'custom_components/qingping_esphome/monitor1_worker/initial-ram-contract.json').read_bytes(),
                         (ROOT / 'apps/monitor1_usb/rootfs/initial-ram-contract.json').read_bytes())


@unittest.skipUnless(sys.platform == 'linux' and os.geteuid() == 0 and Path('/dev/shm').is_dir(),
                     'Needs disposable Linux/root tmpfs fixture; never sudo from this test')
class AllocationTail(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='qp-initial-ram-', dir='/dev/shm')
        self.base = Path(self.directory.name)
        self.tmp = self.base / 'tmp'
        self.tmp.mkdir(mode=0o1777)
        self.tmp.chmod(0o1777)
        self.mem = self.base / 'meminfo'
        self.mem.write_text('MemTotal: 131072 kB\nMemFree: 65536 kB\n')
        self.values = {'ram_job_id': 'a' * 32, 'guardian_job_id': 'b' * 32, 'guardian_bytes': '52'}
        self.ram = self.tmp / ('qingping-initial-trial-' + self.values['ram_job_id'])
        self.guardian = self.tmp / ('qingping-initial-guardian-' + self.values['guardian_job_id'])

    def tearDown(self):
        self.directory.cleanup()  # Only the fixture's own host paths.

    def execute(self, fs=None):
        script = 'set -eu\numask 077\n' + commands.ram_allocation_script(self.values)
        script = script.replace('/proc/meminfo', str(self.mem)).replace('/tmp', str(self.tmp))
        if fs is not None:
            # Only the capacity observation is replaced, to exercise ARM32
            # overflow/refusal on a 64-bit runner without a giant RAM mount.
            script = script.replace("stat -f -c '%t %a %S' " + str(self.tmp), "printf '%s\\n' '" + fs + "'")
        return subprocess.run(['sh', '-c', script], capture_output=True, timeout=5).returncode

    def test_exclusive_private_creation(self):
        self.assertEqual(self.execute(), 0)
        self.assertEqual(list(self.ram.iterdir()), [])
        self.assertEqual([p.name for p in self.guardian.iterdir()], ['program'])
        for path, mode in ((self.ram, 0o700), (self.guardian, 0o700), (self.guardian / 'program', 0o600)):
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), mode)
            self.assertEqual(path.stat().st_uid, 0)
        self.assertEqual((self.guardian / 'program').stat().st_size, 0)
        (self.guardian / 'program').write_bytes(b'preserve original')
        self.assertNotEqual(self.execute(), 0)
        self.assertEqual((self.guardian / 'program').read_bytes(), b'preserve original')

    def test_bad_memory_refuses_before_creation(self):
        for text in ('MemTotal: 131072 kB\nMemFree: 32767 kB\n',
                     'MemTotal: 131072 kB\nMemFree: 65536 kB\nMemFree: 65536 kB\n',
                     'MemTotal: 131072 kB\nMemFree: 65536 bytes\n',
                     'MemTotal: 32768 kB\nMemFree: 65536 kB\n',
                     'MemTotal: 1073741825 kB\nMemFree: 65536 kB\n', 'MemAvailable: 65536 kB\n'):
            with self.subTest(text=text):
                self.mem.write_text(text)
                self.assertNotEqual(self.execute(), 0)
                self.assertFalse(self.ram.exists())
                self.assertFalse(self.guardian.exists())

    def test_bad_filesystem_budget_refuses_before_creation(self):
        for fs in ('ef53 100000 4096', '1021994 1 4096', '1021994 4294967295 4096',
                   '1021994 100000 0', '1021994 -1 4096', '1021994 1 99999', '1021994 1'):
            with self.subTest(fs=fs):
                self.assertNotEqual(self.execute(fs), 0)
                self.assertFalse(self.ram.exists())
                self.assertFalse(self.guardian.exists())

    def test_wrong_tmp_mode_refuses(self):
        self.tmp.chmod(0o777)
        self.assertNotEqual(self.execute(), 0)
        self.assertFalse(self.ram.exists())

    def test_existing_job_and_symlink_preserved(self):
        for path, linked in ((self.ram, False), (self.guardian, False), (self.ram, True), (self.guardian, True)):
            with self.subTest(path=path, linked=linked):
                target = self.base / 'untouched'
                target.write_bytes(b'original')
                if linked:
                    path.symlink_to(target)
                else:
                    path.mkdir()
                    (path / 'sentinel').write_bytes(b'original')
                self.assertNotEqual(self.execute(), 0)
                self.assertEqual(target.read_bytes(), b'original')
                if linked:
                    self.assertTrue(path.is_symlink())
                    path.unlink()
                else:
                    self.assertEqual((path / 'sentinel').read_bytes(), b'original')
                    shutil.rmtree(path)
