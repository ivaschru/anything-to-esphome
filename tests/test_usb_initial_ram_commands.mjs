/** Pure canonical text parity; generated production commands are NEVER run. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {initialRamCommands} from '../custom_components/qingping_esphome/frontend/usb-initial-ram-commands.mjs';
import {initialGuardianDescriptor} from '../custom_components/qingping_esphome/frontend/usb-initial-guardian-file.mjs';
import {validateInitialPreparation} from '../custom_components/qingping_esphome/frontend/usb-initial-trial-scope.mjs';
const vectors=JSON.parse(execFileSync(process.env.PYTHON||'python3',['tests/fixtures/monitor1_browser_initial_ram.py'],{encoding:'utf8',maxBuffer:1024*1024}));
assert.equal(vectors.length,4);
for(const {packet,preparation,expected} of vectors) {
 const commands=initialRamCommands(packet,preparation);
 assert.deepEqual(commands,expected);
 assert.equal(Object.isFrozen(commands),true);
 for(const text of Object.values(commands)) {
  assert.ok(text.length<32768);
  execFileSync('sh',['-n'],{input:text}); // Parse only, never execute the body.
 }
 assert.ok(commands.create.includes('mkdir -m 700 /tmp/qingping-initial-trial-'+packet.ram_job_id));
 assert.ok(commands.create.includes('2147483647 / $3'));
 assert.ok(!/\b(chmod|rm|kill|reboot)\b/.test(commands.create));
 assert.ok(!commands.create.includes('guardian-'+packet.guardian_job_id+'/program &'));
 const capacity=structuredClone(preparation);capacity.scope.data_available_bytes+=4096;capacity.ram_available_bytes+=1024;
 assert.deepEqual(initialRamCommands(packet,capacity),commands,'capacity fluctuation is not identity drift');
}
const vector=vectors[0];let refusals=0;
const refuse=(alterPacket=()=>{},alterFresh=()=>{})=>{
 const p=structuredClone(vector.packet),fresh=structuredClone(vector.preparation);alterPacket(p);alterFresh(fresh);
 assert.throws(()=>initialRamCommands(p,fresh),v=>v.code==='usb_browser_scope_unverified');refusals++;
};
for(const key of ['job_id','channel_id','nonce','ram_job_id','guardian_job_id','plan_sha256','intent_sha256','channel_nonce'])
 refuse(p=>{p[key]='x; touch /tmp/unexpected';});
refuse(p=>{p.guardian_body='never accepted by a text assembler';});
refuse(p=>{p.command='arbitrary';});
refuse(p=>{p.nonce=p.ram_job_id;});
for(const key of ['context_only','guardian_artifact_checked','live_recheck_required'])refuse(p=>{p.context[key]=false;});
for(const key of ['image_fd_admitted','hardware_contacted','writer_enabled','installation_ready'])refuse(p=>{p.context[key]=true;});
for(const key of ['source_commit','job_id','plan_sha256','commit_intent_sha256','commit_proof_sha256','candidate_sha256'])
 refuse(p=>{p.context[key]='0';});
refuse(p=>{p.context.device_writes=1;});
refuse(p=>{p.context.guardian.size=16*1024*1024+1;});
refuse(p=>{p.context.guardian.size=51;});
refuse(p=>{p.context.guardian.sha256='shell injection';});
refuse(p=>{delete p.producer_sha256[Object.keys(p.producer_sha256)[0]];});
refuse(p=>{p.producer_sha256.extra='0'.repeat(64);});
refuse(p=>{p.producer_sha256[Object.keys(p.producer_sha256)[0]]='bad';});
refuse(p=>{p.context.meta.commit_nonce=p.nonce;}); // New trial nonce cannot replace the old commit owner.
for(const where of ['preparation','committed_scope'])refuse(p=>{
 const scope=where==='preparation'?p.preparation.scope:p.context.committed_scope;scope.root_identity[1]++;
});
for(const [key,value] of [['persistent_stores_absent',false],['ram_processes_absent',false],['api_ota_listeners_free',false],
 ['ram_scope_checked',true],['image_fd_admitted',true],['execution_authority',true],['device_writes',1],
 ['ram_available_bytes',32*1024*1024-1],['ram_available_bytes',2**40+1],['memory_basis','MemAvailable']])
 refuse(()=>{},p=>{p[key]=value;});
for(const key of ['root_identity','stock_process','watchdog_process'])refuse(()=>{},p=>{p.scope[key][1]++;});
refuse(()=>{},p=>{p.scope.vendor_hashes[0][1]='0'.repeat(64);});
refuse(()=>{},p=>{p.scope.extra=true;});
refuse(()=>{},p=>{p.extra=true;});
// No timer/transport is needed to validate and freeze the shared descriptor.
const p=vector.packet;
const input=Object.fromEntries(['schema_version','job_id','plan_sha256','intent_sha256','channel_id','channel_nonce','nonce','ram_job_id','guardian_job_id'].map(k=>[k,p[k]]));
input.guardian=structuredClone(p.context.guardian);
const descriptor=initialGuardianDescriptor(input);input.guardian.size++;
assert.notEqual(descriptor.guardian.size,input.guardian.size);assert.equal(Object.isFrozen(descriptor.guardian),true);
validateInitialPreparation(vector.preparation,p.context.meta,p.context.committed_scope);
console.log(`Initial RAM text: four canonical S8/SCD40 numeric vectors, parse-only shell, ${refusals} refusals; no transport/allocation/launch or hardware`);
