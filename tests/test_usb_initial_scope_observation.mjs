/** Full fixed native read parity + refusal/branching, never hardware or shell execution. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {initialGuardianScopeReads,initialGuardianScopeObservation,collectInitialGuardianScope} from '../custom_components/qingping_esphome/frontend/usb-initial-scope-observation.mjs';
const vectors=JSON.parse(execFileSync(process.env.PYTHON||'python3',['tests/fixtures/monitor1_browser_initial_scope.py'],{encoding:'utf8',maxBuffer:4*1024*1024}));
assert.equal(vectors.length,12);
for(const v of vectors) {
 const branches=initialGuardianScopeReads(v.packet,v.ram,v.started);
 assert.deepEqual(branches[v.layout],v.commands);
 const value=await initialGuardianScopeObservation(v.packet,v.ram,v.started,v.reads);
 assert.equal(value.kernel_scope_checked,true);assert.equal(value.prefs_layout,v.layout);
 assert.deepEqual(value.process.guardian,v.started.start.stamp);
 assert.deepEqual(value.root_identity,v.packet.context.committed_scope.root_identity);
 assert.equal(value.memory_free_bytes,64*1024**2);
 assert.equal(value.context_only,true);assert.equal(value.image_fd_admitted,false);assert.equal(value.execution_authority,false);
 if(v===vectors[2] || v===vectors[11]) {
  const checked=JSON.parse(execFileSync(process.env.PYTHON||'python3',['tests/fixtures/monitor1_browser_initial_scope_dto.py'],{
   input:JSON.stringify({packet:v.packet,ram:v.ram,started:v.started,observed:value}),encoding:'utf8'}));
  assert.deepEqual(checked,{context_checked:true,execution_authority:false});
 }
 const entries=Object.entries(v.commands);let count=0;
 const backend={read:async command=>{
  const [key,expected]=entries[count++];assert.equal(command,expected);return v.reads[key];
 }};
 assert.deepEqual(await collectInitialGuardianScope(backend,v.packet,v.ram,v.started),value);
 assert.equal(count,entries.length);
 if(v===vectors[2])for(const text of Object.values(v.commands))execFileSync('sh',['-n'],{input:text}); // Syntax only.
 const one=structuredClone(v.reads);
 for(const key of Object.keys(one))one[key]=one[key].replaceAll('  /',' /');
 assert.deepEqual(await initialGuardianScopeObservation(v.packet,v.ram,v.started,one),value);
}
let refused=0;
async function reject(edit,builder=false) {
 const v=structuredClone(vectors[2]);edit(v);
 await assert.rejects(initialGuardianScopeObservation(v.packet,v.ram,v.started,v.reads),e=>e.code==='usb_browser_scope_unverified');
 if(builder)assert.throws(()=>initialGuardianScopeReads(v.packet,v.ram,v.started),e=>e.code==='usb_browser_scope_unverified');
 refused++;
}
for(const key of Object.keys(vectors[2].reads))await reject(v=>{delete v.reads[key];});
await reject(v=>{v.reads.extra='not a fixed read';});
for(const prefix of ['vendor_','staged_'])for(const key of Object.keys(vectors[2].reads).filter(k=>k.startsWith(prefix)))
 await reject(v=>{v.reads[key]=v.reads[key].replace(/[a-f0-9]{64}/,'0'.repeat(64));});
for(const key of ['watchdog_arguments','stock_maps_0','stock_maps_1','stock_maps_2','absent_stores','intent_mode','prefs_guard'])
 await reject(v=>{v.reads[key]='unexpected output';});
for(const key of ['stock_process','watchdog_process']) {
 await reject(v=>{v.reads[key]=v.reads[key].replace('\n0\n','\n1\n');});
 await reject(v=>{v.reads[key]=v.reads[key].replace(' S ',' Z ');});
 await reject(v=>{v.reads[key]=v.reads[key].replace(/\n\/[^\n]*$/,'\n/unknown');});
}
await reject(v=>{v.reads.stock_process=v.reads.stock_process.replace(' S '+v.packet.context.committed_scope.watchdog_process[0]+' ',' S 1 ');});
await reject(v=>{v.reads.process_scan+='\n'+v.reads.process_scan;});
await reject(v=>{v.reads.root=v.reads.root.replace(' 700 0',' 755 0');});
await reject(v=>{v.reads.parents+='\nextra';});
for(const key of ['disabled','pm-helper.disabled'])await reject(v=>{v.reads[key]=v.reads[key].replace('0 600 0 1','1 600 0 1');});
for(const memory of ['MemTotal: 131072 kB\nMemFree: 8191 kB','MemTotal: 131072 kB\nMemFree: 131073 kB',
 'MemTotal: 131072 kB\nMemAvailable: 65536 kB','MemTotal: 131072 kB\nMemFree: 65536 MB',
 'MemTotal: 131072 kB\nMemFree: 65536 kB\nMemFree: 65536 kB'])await reject(v=>{v.reads.memory=memory;});
await reject(v=>{v.reads.intent_file=v.reads.intent_file.replace(/[a-f0-9]{64}/,'0'.repeat(64));});
await reject(v=>{v.reads.nand_entries+='\nunknown-history';});
await reject(v=>{v.reads.commit_marker=v.reads.commit_marker.replace('commit-disabled','rollback-disabled');});
await reject(v=>{v.reads.ram_identity=v.reads.ram_identity.replace(' 100 ',' 999 ');});
await reject(v=>{v.reads.ram_entries='prefs\nunknown';});
await reject(v=>{v.reads.prefs_entries='foreign-node.prefs';});
for(const metadata of ['65537 600 0 1 7','123 644 0 1 7','123 600 1 1 7','123 600 0 2 7','123 600 0 1 8'])
 await reject(v=>{v.reads.prefs_file=metadata;});
for(const key of Object.keys(vectors[2].reads).filter(k=>k.startsWith('identity_')))
 await reject(v=>{v.reads[key]+='changed';});
await reject(v=>{v.packet.context.api_identity.node_name='../unsafe';},true);
await reject(v=>{v.packet.context.api_identity.api_mac='01:00:00:00:00:01';},true);
{
 const v=structuredClone(vectors[2]),rows=Object.entries(v.commands);let count=0;
 const result=await collectInitialGuardianScope({read:async command=>{
  const [key,expected]=rows[count++];assert.equal(command,expected);
  if(count===1){v.packet.context.api_identity.node_name='replaced-after-start';v.started.start.stamp[0]=999;}
  return v.reads[key];
 }},v.packet,v.ram,v.started);
 assert.equal(result.process.guardian[0],vectors[2].started.start.stamp[0]);
}
for(const key of ['ram_entries','prefs_entries']) {
 const v=vectors[2],rows=Object.entries(v.commands);let count=0;
 await assert.rejects(collectInitialGuardianScope({read:async command=>{
  const [name,expected]=rows[count++];assert.equal(command,expected);return name===key?'unknown':v.reads[name];
 }},v.packet,v.ram,v.started));
 assert.equal(rows[count-1][0],key,'Unknown layout refuses before any optional filename read');
}
console.log(`Initial live scope: 12 exact native vectors/three RAM branches and ${refused} refusals; no USB/Noise/terminal authority`);
