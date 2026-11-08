"""Actual fixed bootstrap with synthetic private temporary effects only.

No production guard, path, monitor program or device is executed. This checks
that truncated stdin remains DATA: even EOF at a valid shorter destination
cannot execute any prefix, and extra bytes cannot become another shell command.
"""
import hashlib
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
TOOLS=all(shutil.which(name) for name in ('node','dd','sha256sum'))


@unittest.skipUnless(TOOLS,'requires host node/dd/sha256sum for the synthetic framing fixture')
class FixedStdinFramingTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='qingping-fixed-stdin-');self.addCleanup(self.temp.cleanup)
        self.directory=Path(self.temp.name)
        self.effect=self.directory/'effect-long-name'
        self.body=("printf '%s' SYNTHETIC > "+shlex.quote(str(self.effect))).encode()
        self.marker='__CGS1_FIXED_OK_'+'b'*32+'__'
        frame={'size':len(self.body),'sha256':hashlib.sha256(self.body).hexdigest(),'marker':self.marker}
        code="""import {readFileSync} from 'node:fs';
import {disabledStreamService} from './custom_components/qingping_esphome/frontend/usb-disabled-stream.mjs';
console.log(disabledStreamService(JSON.parse(readFileSync(0,'utf8'))));"""
        env={'PATH':os.environ['PATH']}
        self.service=subprocess.check_output(['node','--input-type=module','-e',code],input=json.dumps(frame).encode(),cwd=ROOT,env=env,timeout=5).decode().strip()
        self.assertTrue(self.service.startswith('exec:/bin/sh -c '));self.assertLess(len(self.service),512)
        self.assertNotIn(str(self.effect),self.service,'Only typed size/SHA/marker enter the short OPEN bootstrap')

    def run_body(self,payload):
        return subprocess.run(['/bin/sh','-c',self.service[len('exec:'):]],input=payload,
            stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={'PATH':os.environ['PATH']},timeout=5)

    def test_complete_body_is_verified_before_its_one_synthetic_effect(self):
        result=self.run_body(self.body)
        self.assertEqual(result.returncode,0,result.stderr.decode())
        self.assertEqual(self.effect.read_bytes(),b'SYNTHETIC')
        self.assertEqual(result.stdout,('\n'+self.marker+'\n').encode())

    def test_partial_body_cannot_execute_a_valid_truncated_destination(self):
        for cut in (1,len(self.body)//2,self.body.index(b'effect-')+len(b'effect-'),len(self.body)-1):
            with self.subTest(cut=cut):
                result=self.run_body(self.body[:cut])
                self.assertNotEqual(result.returncode,0);self.assertEqual(list(self.directory.iterdir()),[])
                self.assertNotIn(self.marker.encode(),result.stdout)

    def test_same_size_modified_or_nul_body_is_never_parsed(self):
        for payload in (self.body[:-1]+b'X',self.body[:10]+b'\x00'+self.body[11:]):
            with self.subTest(payload=payload):
                self.assertNotEqual(self.run_body(payload).returncode,0)
                self.assertEqual(list(self.directory.iterdir()),[])

    def test_extra_stdin_after_verified_body_is_never_interpreted_as_shell(self):
        unwanted=self.directory/'unwanted'
        result=self.run_body(self.body+("\nprintf BAD > "+shlex.quote(str(unwanted))+"\n").encode())
        self.assertEqual(result.returncode,0,result.stderr.decode())
        self.assertEqual(self.effect.read_bytes(),b'SYNTHETIC');self.assertFalse(unwanted.exists())


if __name__=='__main__':unittest.main()
