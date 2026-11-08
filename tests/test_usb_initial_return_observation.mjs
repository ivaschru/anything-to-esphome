/** Pure fixed post-stop composition; no device, guardian or shell execution. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {initialGuardianReturnReads,initialGuardianReturnObservation,collectInitialGuardianReturn} from '../custom_components/qingping_esphome/frontend/usb-initial-scope-observation.mjs';
const vectors=JSON.parse(execFileSync(process.env.PYTHON||'python3',['tests/fixtures/monitor1_browser_initial_scope.py'],{encoding:'utf8',maxBuffer:4*1024*1024}));
assert.equal(vectors.length,12);
for(const v of vectors) {
 const branches=initialGuardianReturnReads(v.packet,v.ram,v.started);
 assert.deepEqual(branches[v.layout],v.return_commands);
 assert.deepEqual(Object.keys(branches[v.layout]),Object.keys(v.return_reads));
 assert.equal(Object.keys(branches[v.layout]).length,v.layout==='empty'?43:v.layout==='prefs_empty'?45:46);
 assert.ok(v.return_commands.process_scan.includes('(/data/.esphome-cgs1/*|/tmp/qingping-full-*/*|/tmp/qingping-initial-*/*) exit 1;;'));
 assert.ok(!v.return_commands.process_scan.includes('case "$pid:$executable"'), 'No admitted live guardian/child exception after stop');
 for(const key of ['child_before','child_after','endpoint','guardian_image','child_image'])assert.ok(!Object.hasOwn(branches[v.layout],key));
 const value=await initialGuardianReturnObservation(v.packet,v.ram,v.started,v.return_reads);
 assert.equal(value.kind,'browser_initial_return_observation');assert.equal(value.own_programs_absent,true);
 assert.equal(value.context_only,true);assert.equal(value.execution_authority,false);assert.equal(value.image_fd_admitted,false);
 assert.ok(!Object.hasOwn(value,'process'),'No fabricated live process observation');
 assert.deepEqual(value.guardian,v.started.start.stamp);assert.deepEqual(value.child,v.started.child.stamp);
 assert.equal(value.prefs_layout,v.layout);
 let index=0;const rows=Object.entries(v.return_commands);
 assert.deepEqual(await collectInitialGuardianReturn({read:async command=>{
  const [key,expected]=rows[index++%rows.length];assert.equal(command,expected);return v.return_reads[key];
 }},v.packet,v.ram,v.started),value);
 assert.equal(index,2*rows.length);
 if(v===vectors[2] || v===vectors[11]) {
  const checked=JSON.parse(execFileSync(process.env.PYTHON||'python3',['tests/fixtures/monitor1_browser_initial_scope_dto.py'],{
   input:JSON.stringify({packet:v.packet,ram:v.ram,started:v.started,observed:value}),encoding:'utf8'}));
  assert.deepEqual(checked,{context_checked:true,execution_authority:false});
 }
}
let refused=0;
async function reject(edit) {
 const v=structuredClone(vectors[2]);edit(v);
 await assert.rejects(initialGuardianReturnObservation(v.packet,v.ram,v.started,v.return_reads),e=>e.code==='usb_browser_scope_unverified');
 refused++;
}
for(const key of Object.keys(vectors[2].return_reads))await reject(v=>{delete v.return_reads[key];});
for(const key of ['watchdog_arguments','stock_maps_0','stock_maps_1','stock_maps_2','absent_stores','intent_mode','prefs_guard'])
 await reject(v=>{v.return_reads[key]='unexpected output';});
for(const key of Object.keys(vectors[2].return_reads).filter(k=>k.startsWith('vendor_')||k.startsWith('staged_')))
 await reject(v=>{v.return_reads[key]=v.return_reads[key].replace(/[a-f0-9]{64}/,'0'.repeat(64));});
await reject(v=>{v.return_reads.extra='unexpected';});
await reject(v=>{v.return_reads.process_scan+='\n123';});
await reject(v=>{v.return_reads.root=v.return_reads.root.replace(' 700 0',' 755 0');});
await reject(v=>{v.return_reads.ram_identity=v.return_reads.ram_identity.replace(' 100 ',' 999 ');});
await reject(v=>{v.return_reads.intent_file=v.return_reads.intent_file.replace(/[a-f0-9]{64}/,'0'.repeat(64));});
await reject(v=>{v.return_reads.nand_entries+='\nunknown-history';});
await reject(v=>{v.return_reads.commit_marker+='changed';});
for(const metadata of ['65537 600 0 1 7','123 644 0 1 7','123 600 1 1 7','123 600 0 2 7','123 600 0 1 8'])
 await reject(v=>{v.return_reads.prefs_file=metadata;});
for(const key of ['ram_entries','prefs_entries']) {
 const v=vectors[2],rows=Object.entries(v.return_commands);let index=0;
 await assert.rejects(collectInitialGuardianReturn({read:async command=>{
  const [name,expected]=rows[index++];assert.equal(command,expected);return name===key?'unknown':v.return_reads[name];
 }},v.packet,v.ram,v.started));
 assert.equal(rows[index-1][0],key,'Unknown layout refuses before any optional filename read');
}
console.log(`Initial post-stop scope: 12 frozen-tail/strict-scan vectors and ${refused} refusals; pure context, no END/Noise/close/terminal authority`);
