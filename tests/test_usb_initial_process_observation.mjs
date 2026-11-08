/** Canonical helper parity + parser refusals only; no process/USB/shell execution. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {initialGuardianProcessReads,initialGuardianProcessObservation} from '../custom_components/qingping_esphome/frontend/usb-initial-process-observation.mjs';
const vectors=JSON.parse(execFileSync(process.env.PYTHON||'python3',['tests/fixtures/monitor1_browser_initial_process.py'],{encoding:'utf8',maxBuffer:1024*1024}));
assert.equal(vectors.length,4);
for(const v of vectors) {
 const commands=initialGuardianProcessReads(v.packet,v.ram,v.started);
 assert.deepEqual(commands,v.commands);assert.equal(Object.keys(commands).length,11);
 for(const text of Object.values(commands))execFileSync('sh',['-n'],{input:text}); // Syntax only; production paths never execute.
 const value=initialGuardianProcessObservation(v.packet,v.ram,v.started,v.reads);
 assert.deepEqual(value.guardian,v.started.start.stamp);assert.deepEqual(value.child,v.started.child.stamp);
 assert.deepEqual(value.guardian_image,v.guardian_image);assert.deepEqual(value.child_image,v.child_image);
 assert.equal(value.image_fd_admitted,false);assert.equal(value.execution_authority,false);assert.equal(value.context_only,true);
 assert.equal(value.guardian[1],v.started.start.stamp[1],'Full uint64 birth must survive as a decimal string');
 const one=structuredClone(v.reads);
 for(const key of ['guardian_file','guardian_image','child_file','child_image'])one[key]=one[key].replaceAll('  /',' /');
 assert.deepEqual(initialGuardianProcessObservation(v.packet,v.ram,v.started,one),value,'Both native checksum text delimiters');
}
let refused=0;
function reject(mutate,builder=false) {
 const v=structuredClone(vectors[0]);mutate(v);
 assert.throws(()=>initialGuardianProcessObservation(v.packet,v.ram,v.started,v.reads),e=>e.code==='usb_browser_scope_unverified');
 if(builder)assert.throws(()=>initialGuardianProcessReads(v.packet,v.ram,v.started),e=>e.code==='usb_browser_scope_unverified');
 refused++;
}
for(const key of Object.keys(vectors[0].reads))reject(v=>{delete v.reads[key];});
reject(v=>{v.reads.extra='not a fixed read';});
for(const key of ['child_before','child_after']) {
 reject(v=>{v.reads[key]='';});reject(v=>{v.reads[key]=v.reads[key].replace(' S',' Z');});
 reject(v=>{v.reads[key]+='\n'+v.reads[key];});reject(v=>{v.reads[key]=v.reads[key].replace(v.started.child.stamp[1],'1');});
}
for(const key of ['guardian_process_before','guardian_process_after','child_process_before','child_process_after']) {
 reject(v=>{v.reads[key]=v.reads[key].replace('\n0\n','\n1\n');});
 reject(v=>{v.reads[key]=v.reads[key].replace('/program','/replaced');});
 reject(v=>{v.reads[key]=v.reads[key].replace(' S ',' Z ');});
}
reject(v=>{v.reads.child_process_after=v.reads.child_process_after.replace(' S '+v.started.start.stamp[0]+' ',' S 1 ');});
for(const key of ['guardian_file','child_file','guardian_image','child_image']) {
 reject(v=>{v.reads[key]=v.reads[key].replace(/[a-f0-9]{64}/,'0'.repeat(64));});
 reject(v=>{v.reads[key]+='\nextra';});
}
reject(v=>{v.reads.guardian_image=v.reads.guardian_image.replaceAll('7 102 ','7 999 ');});
reject(v=>{v.reads.child_image=v.reads.child_image.replaceAll(v.child_image[0]+' 104 ','9 104 ');});
reject(v=>{v.reads.guardian_image=v.reads.guardian_image.replaceAll('700 0 1','600 0 1');});
reject(v=>{v.reads.child_image=v.reads.child_image.replaceAll('700 0 1','700 0 2');});
for(const endpoint of ['', '/proc/net/tcp 17A5','/proc/net/tcp 17A5\n/proc/net/tcp 17A5',
 '/proc/net/tcp 17A5\n/proc/net/tcp 0000','/proc/net/foreign 17A5\n/proc/net/tcp 0CA0'])reject(v=>{v.reads.endpoint=endpoint;});
reject(v=>{v.reads.guardian_image='A'.repeat(65537);});reject(v=>{v.reads.child_before+='\0';});
reject(v=>{v.started.start.stamp[1]=Number(v.started.start.stamp[1]);},true);
reject(v=>{v.started.child.stamp[0]=true;},true);
reject(v=>{v.started.start.nonce='0'.repeat(32);},true);
reject(v=>{v.started.child.stamp[0]=v.started.start.stamp[0];},true);
reject(v=>{v.started.child.stamp[0]=v.packet.context.committed_scope.stock_process[0];},true);
reject(v=>{v.started.records_only=1;},true);
reject(v=>{v.started.command='not admitted';},true);
reject(v=>{v.packet.guardian_job_id='x; command';},true);
reject(v=>{v.ram.uploaded.guardian_file_identity[1]++;},true);
console.log(`Initial process subset: four exact native eleven-read vectors and ${refused} scope/kernel/image/socket refusals passed; syntax only, no transport/stock/Noise/terminal proof`);
