/** Complete-line parser only; synthetic records are never launch authority. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {initialGuardianRecord} from '../custom_components/qingping_esphome/frontend/usb-initial-guardian-records.mjs';
const vectors=JSON.parse(execFileSync(process.env.PYTHON||'python3',['tests/fixtures/monitor1_browser_guardian_records.py'],{encoding:'utf8'}));
assert.equal(vectors.length,8);
for(const v of vectors) {
 const start=initialGuardianRecord(v.start,v.nonce);assert.equal(start.kind,'start');assert.deepEqual(start.stamp,v.guardian);
 const child=initialGuardianRecord(v.child,v.nonce,start.stamp);assert.deepEqual(child.stamp,[124,'456']);
 const end=initialGuardianRecord(v.end,v.nonce,start.stamp);assert.deepEqual(end,v.expected);
 assert.equal(Object.isFrozen(end.guardian),true);assert.equal(typeof end.guardian[1],'string');
 assert.deepEqual(initialGuardianRecord(v.end.replace('\n','\r\n'),v.nonce,start.stamp),end);
}
const v=vectors[0];let refusals=0;
const reject=(line,nonce=v.nonce,expected=v.guardian)=>{
 assert.throws(()=>initialGuardianRecord(line,nonce,expected),e=>e.code==='usb_browser_scope_unverified');refusals++;
};
for(const line of ['',v.end.slice(0,-1),v.end+'\n',v.end.replaceAll(' ','  '),v.end.replace(' 123 ','\t123 '),
 v.end.replace('CGS1_TRIAL_END_V1','CGS1_TRIAL_END_V2'),v.end.replace(' 60000 ',' 59999 '),v.end.replace(' 60000 ',' 71001 '),
 v.end.replace('1 1 1 0','1 1 1 1'),v.end.replace('1 1 1 0','0 1 1 0'),v.end.replace('1 1 1 0','1 0 1 0'),
 v.end.replace('1 1 1 0','1 1 0 0'),v.end.replace(' 0\n',' 9\n'),v.end.replace(' 124 ',' 123 '),
 v.end.replace(' 123 ',' 1 '),v.end.replace(' 12345 ',' 18446744073709551616 '),v.end.replace(' 12345 ',' 0 '),
 v.end.replace(' 12345 ',' 012345 '),'X'.repeat(513)+'\n',v.end.replace(' 456 ',' NaN '),v.end+'\0'])reject(line);
reject(v.end,'b'.repeat(32));reject(v.end,v.nonce,[123,'999']);reject(v.end,v.nonce,null);
reject(v.start); // START cannot restart an already-bound guardian stream.
reject(v.child,v.nonce,[124,'456']);
const giant=initialGuardianRecord(`CGS1_TRIAL_START_V1 ${v.nonce} 2147483647 18446744073709551615\n`,v.nonce);
assert.deepEqual(giant.stamp,[2147483647,'18446744073709551615']);
reject(`CGS1_TRIAL_START_V1 ${v.nonce} 2147483648 1\n`,v.nonce,null);
console.log(`Frozen guardian records: eight native boundary vectors, ${refusals} refusals and exact uint64 decimal births passed; no PID adoption, image admission or hardware`);
