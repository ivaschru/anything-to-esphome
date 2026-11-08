"""Actual Linux/root shell against a rewritten temporary staging tree only.

No production path, USB, vendor script, monitor ELF or firmware is executed.
The JavaScript generator has no runtime path override; substitution lives only
in this test, before the test-owned shell can run. Local Mac tests skip it.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
BASE = '/data/.esphome-cgs1'
SIDE = '/data/.esphome-cgs1-stage'
BOOT = '22222222-2222-2222-2222-222222222222'


@unittest.skipUnless(sys.platform.startswith('linux') and os.geteuid() == 0, 'requires explicit Linux/root temporary fixture')
class BrowserStageRootTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='qingping-browser-stage-')
        self.addCleanup(temporary.cleanup)
        self.tree = Path(temporary.name).resolve()
        self.assertRegex(str(self.tree), r'^/[A-Za-z0-9_./-]+$')
        self.data = self.tree / 'data'
        self.data.mkdir(mode=0o700)
        self.base, self.side = self.data / 'root', self.data / 'stage'
        self.boot = self.tree / 'boot'
        self.boot.write_text(BOOT + '\n')
        self.vendor = self.data / 'unrelated-vendor-fixture'
        self.vendor.write_bytes(b'synthetic vendor original, never executed\n')
        code = """
import {stageCommands} from './custom_components/qingping_esphome/frontend/usb-stage-session.mjs';
import {STAGE_ROLES} from './custom_components/qingping_esphome/frontend/usb-stage-files.mjs';
const c=stageCommands({plan_id:'a'.repeat(32),plan_sha256:'b'.repeat(64),intent_sha256:'c'.repeat(64)},
 '22222222-2222-2222-2222-222222222222');
console.log(JSON.stringify({create:c.create,guard:c.guard,complete:c.complete,inspectComplete:c.inspectComplete,
 precreate:Object.fromEntries(STAGE_ROLES.map(([role])=>[role,c.precreate(role)])),
 setMode:Object.fromEntries(STAGE_ROLES.map(([role])=>[role,c.setMode(role)])),
 inspect:Object.fromEntries(STAGE_ROLES.map(([role])=>[role,c.inspect(role)])),roles:STAGE_ROLES}));
"""
        self.commands = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', code], cwd=ROOT, timeout=10))

    def rewritten(self, command):
        self.assertIn(BASE, command)
        result = command.replace(SIDE, str(self.side)).replace(BASE, str(self.base))
        result = result.replace('/proc/sys/kernel/random/boot_id', str(self.boot))
        result = result.replace('test ! -L /data\n', 'test ! -L ' + str(self.data) + '\n')
        self.assertNotRegex(result, r'''(?:^|[\s"'])/(?:data|proc|sys|dev)(?:/|\b)''')
        return 'set -eu\numask 077\n' + result + '\n'

    def run_shell(self, command, *, path='/usr/bin:/bin'):
        return subprocess.run(['/bin/sh'], input=self.rewritten(command).encode(), stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE, env={'PATH': path}, timeout=15)

    def success(self, command):
        result = self.run_shell(command)
        self.assertEqual(result.returncode, 0, result.stderr.decode())
        return result.stdout.decode().strip()

    def test_disabled_root_and_sidecar_preserve_frozen_guardian_layout(self):
        self.success(self.commands['create'])
        self.success(self.commands['guard'])
        self.assertEqual(set(os.listdir(self.base)), {'install.intent', 'disabled', 'pm-helper.disabled'})
        self.assertEqual(set(os.listdir(self.side)), {'intent'})
        for flag in ('disabled', 'pm-helper.disabled'):
            self.assertEqual((self.base / flag).stat().st_mode & 0o777, 0o600)
            self.assertEqual((self.base / flag).stat().st_size, 0)
        for role, leaf in self.commands['roles']:
            self.success(self.commands['precreate'][role])
            path = self.base / leaf
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            body = ('synthetic not an executable ' + role).encode()
            path.write_bytes(body)  # Emulate an upload to this test-only file.
            self.success(self.commands['setMode'][role])
            output = self.success(self.commands['inspect'][role])
            self.assertIn(hashlib.sha256(body).hexdigest() + ' ' + str(path), output)
        self.success(self.commands['complete'])
        self.assertEqual(set(os.listdir(self.base)), {'install.intent', 'disabled', 'pm-helper.disabled',
                                                    *(leaf for _, leaf in self.commands['roles'])})
        self.assertEqual(set(os.listdir(self.side)), {'intent', 'complete'})
        expected = ('a' * 32 + ' ' + 'b' * 64 + ' ' + 'c' * 64 + '\n').encode()
        self.assertEqual((self.side / 'complete').read_bytes(), expected)
        self.assertEqual(self.success(self.commands['inspectComplete']), hashlib.sha256(expected).hexdigest() + ' ' + str(self.side / 'complete'))
        self.assertNotEqual(self.run_shell(self.commands['complete']).returncode, 0)
        self.assertEqual(self.vendor.read_bytes(), b'synthetic vendor original, never executed\n')

    def test_existing_root_or_symlink_never_gets_overwritten(self):
        self.success(self.commands['create'])
        role = self.commands['roles'][0][0]
        outside = self.data / 'preserved-user-file'
        outside.write_bytes(b'preserve this file')
        (self.base / 'program').symlink_to(outside)
        self.assertNotEqual(self.run_shell(self.commands['precreate'][role]).returncode, 0)
        self.assertEqual(outside.read_bytes(), b'preserve this file')
        before = (self.base / 'install.intent').read_bytes()
        self.assertNotEqual(self.run_shell(self.commands['create']).returncode, 0)
        self.assertEqual((self.base / 'install.intent').read_bytes(), before)

    def test_wrong_boot_flag_metadata_and_unknown_sidecar_refuse(self):
        self.success(self.commands['create'])
        self.boot.write_text('33333333-3333-3333-3333-333333333333\n')
        self.assertNotEqual(self.run_shell(self.commands['guard']).returncode, 0)
        self.boot.write_text(BOOT + '\n')
        flag = self.base / 'disabled'
        flag.write_bytes(b'not empty')
        self.assertNotEqual(self.run_shell(self.commands['guard']).returncode, 0)
        flag.write_bytes(b'')
        flag.chmod(0o644)
        self.assertNotEqual(self.run_shell(self.commands['guard']).returncode, 0)
        flag.chmod(0o600)
        (self.side / 'intent').write_text('foreign history\n')
        self.assertNotEqual(self.run_shell(self.commands['guard']).returncode, 0)
        self.assertEqual(flag.read_bytes(), b'')

    def test_same_size_nul_marker_does_not_become_an_exact_line(self):
        self.success(self.commands['create'])
        for path in (self.base / 'install.intent', self.side / 'intent'):
            before = path.read_bytes()
            path.write_bytes(before[:-1] + b'\x00')
            self.assertNotEqual(self.run_shell(self.commands['guard']).returncode, 0)
            path.write_bytes(before)
        self.success(self.commands['guard'])

    def test_valid_stdout_with_failed_stat_is_not_success(self):
        self.success(self.commands['create'])
        fakebin = self.tree / 'bin'
        fakebin.mkdir(mode=0o700)
        fake = fakebin / 'stat'
        fake.write_text("#!/bin/sh\nprintf '%s\\n' '700 0'\nexit 1\n")
        fake.chmod(0o700)
        # Stop just after the first metadata comparison: a command substitution
        # embedded inside test would incorrectly hide the failing exit code.
        lines = self.commands['guard'].splitlines()
        index = next(i for i, line in enumerate(lines) if line.startswith('CGS1_STAGE_ROOT=$(stat'))
        prefix = '\n'.join(lines[:index + 2])
        # This prefix mentions only the sidecar. Supply a harmless root comment
        # for the rewriting helper's mandatory production-root coverage check.
        prefix += '\n# ' + BASE
        result = self.run_shell(prefix, path=str(fakebin) + ':/usr/bin:/bin')
        self.assertNotEqual(result.returncode, 0)


if __name__ == '__main__':
    unittest.main()
