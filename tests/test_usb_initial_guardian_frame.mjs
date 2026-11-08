/** Frozen native frame parity only; no shell, FD admission or process launch. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {initialGuardianFrame,initialGuardianLaunchBody} from '../custom_components/qingping_esphome/frontend/usb-initial-guardian-frame.mjs';
const vectors=JSON.parse(execFileSync(process.env.PYTHON||'python3',['tests/fixtures/monitor1_browser_guardian_frame.py'],{encoding:'utf8',maxBuffer:1024*1024}));
assert.equal(vectors.length,4);
for(const {packet,fresh,ram,expected} of vectors) {
 const frame=initialGuardianFrame(packet,fresh,ram);
 assert.deepEqual(frame,expected);assert.equal(frame.length,40);assert.equal(Object.isFrozen(frame),true);
 assert.equal(frame[3],packet.context.meta.commit_nonce);assert.notEqual(frame[3],packet.nonce);
 assert.ok(!frame.some(v=>v.includes('/') || v.includes('exec')));
 const body=initialGuardianLaunchBody(packet,fresh,ram);
 execFileSync('sh',['-n'],{input:body}); // Syntax only, never execute production text.
 assert.ok(body.length<32768);
 assert.ok(body.endsWith('exec /tmp/qingping-initial-guardian-'+packet.guardian_job_id+'/program '+expected.join(' ')));
 assert.deepEqual(body.match(/^chmod .+$/gm),['chmod 700 /tmp/qingping-initial-guardian-'+packet.guardian_job_id+'/program']);
 assert.ok(!/^(rm|mv|cp|kill|reboot|mount|umount) /m.test(body));
 assert.ok(body.includes('600 0 1 7 102'));
 assert.ok(body.includes('700 0 1 7 102'));
 assert.ok(body.includes('MemFree:') && body.includes('32768'));
}
let refusals=0;
const refuse=mutate=>{
 const v=structuredClone(vectors[0]);mutate(v);
 assert.throws(()=>initialGuardianFrame(v.packet,v.fresh,v.ram),e=>e.code==='usb_browser_scope_unverified');
 assert.throws(()=>initialGuardianLaunchBody(v.packet,v.fresh,v.ram),e=>e.code==='usb_browser_scope_unverified');refusals++;
};
for(const key of ['transport_closed','guardian_started','image_fd_admitted','execution_authority'])refuse(v=>{v.ram[key]=true;});
refuse(v=>{v.ram.context_only=false;});refuse(v=>{v.ram.extra=true;});
for(const [key,value] of [['guardian_file_identity',[7,103]],['ram_root_identity',[7,103]],['guardian_root_identity',[7,103]],
 ['guardian_sha256','0'.repeat(64)],['guardian_size',53],['context_only',1],['image_fd_admitted',0],['execution_authority',true],
 ['phase','precreated'],['nonce','f'.repeat(32)],['tmpfs_available_bytes',1]])refuse(v=>{v.ram.uploaded[key]=value;});
for(const key of ['ram_root_identity','guardian_root_identity','guardian_file_identity'])refuse(v=>{v.ram.precreated[key][1]++;});
refuse(v=>{v.fresh.scope.root_identity[1]++;});
refuse(v=>{v.ram.preparation.scope.stock_process[1]++;});
refuse(v=>{v.packet.context.meta.commit_nonce=v.packet.nonce;});
refuse(v=>{v.packet.ram_job_id='x; command';});
refuse(v=>{v.packet.context.meta.target.co2_type=4;});
refuse(v=>{v.packet.context.meta.descriptor.files['bridge-program'].size=NaN;});
console.log(`Frozen guardian argv: four exact native forty-field vectors and ${refusals} scope/inode/type refusals passed with parse-only guarded text; no FD admission or execution`);
