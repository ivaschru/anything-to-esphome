/** Actual selected NativeChannel/peer/session; fixed emulated reads/SYNC only. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {BrowserChannelPeer} from '../custom_components/qingping_esphome/frontend/usb-channel-peer.mjs';
import {createNativeChannel} from '../custom_components/qingping_esphome/frontend/usb-probe-bundle.mjs';
import {initialRamCommands} from '../custom_components/qingping_esphome/frontend/usb-initial-ram-commands.mjs';
import {initialGuardianLaunchBody} from '../custom_components/qingping_esphome/frontend/usb-initial-guardian-frame.mjs';
import {disabledTransport} from './fixtures/usb_disabled_transport.mjs';
import {initialProcessFixture} from './fixtures/usb_initial_process_reads.mjs';
const original=JSON.parse(execFileSync(process.env.PYTHON||'python3',['tests/fixtures/monitor1_browser_initial_ram.py'],{encoding:'utf8',maxBuffer:1024*1024}))[0];
const empty='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const hash=body=>createHash('sha256').update(body).digest('hex');
async function selected(options={},Native=undefined) {
 const packet=structuredClone(original.packet),body=new Uint8Array(131089).fill(27);
 packet.context.guardian={size:body.length,sha256:hash(body)};
 let commands,created=0,uploaded=false,syncOpens=0,syncClosed=0,guardianBody,guardianStarts=0,processPacket,processRam,processFixture,scopeFixture,scopeReads=0;
 let apiOpening=false,apiOpens=0,apiCloses=0,apiController,apiCancelled=false,scopeGate,scopeEntered,releaseScope;
 const apiWrites=[];
 const scopeRead=command=>{
  if(!scopeFixture)return undefined;
  const keys=Object.keys(scopeFixture.commands),key=keys[scopeReads%keys.length];assert.equal(command,scopeFixture.commands[key]);scopeReads++;
  return options.unknownPrefs && key==='prefs_entries'?'unknown.prefs':scopeFixture.reads[key];
 };
 const fixture=disabledTransport({committed:true,unsupported:options.unsupported,
  identityRead:command=>apiOpening && scopeReads && scopeReads%57===0?undefined:scopeRead(command),
  beforeReadReply:async command=>{
   if(scopeGate && command===scopeFixture?.commands.process_scan){scopeEntered();await scopeGate;scopeGate=undefined;}
  },
  apiSocket:()=>{
   apiOpens++;if(options.apiOpenLoss)throw Error('Synthetic API open ACK loss');
   return {readable:new ReadableStream({start(c){apiController=c;},cancel(){apiCancelled=true;}}),
    writable:new WritableStream({write(bytes){assert(bytes instanceof Uint8Array);apiWrites.push(Array.from(bytes));}}),
    close:async()=>{apiCloses++;if(!apiCancelled){apiCancelled=true;apiController.close();}if(options.apiCloseLoss)throw Error('Synthetic API close ACK loss');}};
  },
  rawCommand:text=>{
   if(!created){assert.equal(text,commands.create);created++;return;}
   assert.equal(text,guardianBody);guardianStarts++;
   const nonce=options.badGuardianNonce?'0'.repeat(32):packet.nonce;
   return `CGS1_TRIAL_START_V1 ${nonce} 123 1000\nCGS1_TRIAL_CHILD_V1 ${nonce} 124 456\nCGS1_TRIAL_END_V1 ${nonce} 123 1000 124 456 60000 1 1 1 0 15\n`;
  },
  customRead:command=>{
   if(scopeFixture)return scopeRead(command);
   if(processFixture){const value=processFixture.read(command);if(value!==undefined)return value;}
   if(command===commands?.inspect_roots) {
    const inode=uploaded && options.rootReplacement?103:100;
    return `7 ${inode} 700 0\n1021994 16384 4096\n7 101 700 0\n1021994 16384 4096`;
   }
   if(command===commands?.inspect_guardian) {
    const pin=uploaded?(options.badRemoteHash?'0'.repeat(64):hash(body)):empty;
    const inode=uploaded && options.fileReplacement?104:102;
    return `${uploaded?body.length:0} 600 0 1 7 ${inode}\n${pin}  /tmp/qingping-initial-guardian-${packet.guardian_job_id}/program`;
   }
  },
  syncSocket:()=>{syncOpens++;return {close:async()=>{syncClosed++;}};},
  pushV1:async request=>{
   assert.equal(request.filename,`/tmp/qingping-initial-guardian-${packet.guardian_job_id}/program`);
   assert.equal(request.permission,0o600);const chunks=[];for await(const v of request.file)chunks.push(v);
   assert.deepEqual(Buffer.concat(chunks),Buffer.from(body));if(options.syncError)throw Error('synthetic partial SYNC');uploaded=true;
  },
 },Native);
 const opening=fixture.link.selectForReview();assert.equal(fixture.picked,1);await opening;
 packet.channel_nonce=fixture.link.evidence().channel;
 commands=initialRamCommands(packet,packet.preparation);
 const peer=new BrowserChannelPeer(fixture.link);let id=0;
 return {fixture,packet,body,peer,call:async(operation,data=null)=>{
   if(operation==='api-open')apiOpening=true;
   try{return await peer.dispatch({id:(++id).toString(16).padStart(32,'0'),operation,data});}
   finally{if(operation==='api-open')apiOpening=false;}
  },
  expectGuardian:proof=>{guardianBody=initialGuardianLaunchBody(packet,proof.preparation,proof);processPacket=structuredClone(packet);processRam=structuredClone(proof);},
  expectProcesses:start=>{processFixture=initialProcessFixture(processPacket,processRam,start,options);},
  expectScope:start=>{scopeFixture=JSON.parse(execFileSync(process.env.PYTHON||'python3',['tests/fixtures/monitor1_browser_initial_scope.py','--stdin'],{
   input:JSON.stringify({packet:processPacket,ram:processRam,started:start,layout:'prefs_file'}),encoding:'utf8',maxBuffer:1024*1024}));},
  get scopeReads(){return scopeReads;},
  pauseScope:()=>{
   scopeGate=new Promise(resolve=>{releaseScope=resolve;});
   return new Promise(resolve=>{scopeEntered=resolve;});
  },releaseScope:()=>releaseScope(),feedApi:bytes=>apiController.enqueue(new Uint8Array(bytes)),
  get apiOpens(){return apiOpens;},get apiCloses(){return apiCloses;},apiWrites,
  get processReads(){return processFixture?.count||0;},
  get guardianStarts(){return guardianStarts;},get created(){return created;},get syncOpens(){return syncOpens;},get syncClosed(){return syncClosed;}};
}
for(const Native of [undefined,createNativeChannel().constructor]) {
 const f=await selected({},Native);await f.call('ram-stream-check');await f.call('ram-prepare',{packet:f.packet});await send(f);
 const ready=await f.call('ram-complete');f.expectGuardian(ready.data);
 const start=await f.call('guardian-start');f.expectScope(start.data);
 assert.equal((await f.call('api-open')).ok,true);assert.equal(f.apiOpens,1);assert.equal(f.scopeReads,57);
 const first=f.call('api-read',{max_bytes:64}),entered=f.pauseScope();
 const scope=f.call('guardian-scope-observe');await entered;
 f.feedApi([7,8]);assert.equal((await first).data,btoa(String.fromCharCode(7,8)));
 const second=f.call('api-read',{max_bytes:64});f.feedApi([9]);assert.equal((await second).data,btoa(String.fromCharCode(9)));
 f.releaseScope();assert.equal((await scope).ok,true);assert.equal(f.scopeReads,114);
 assert.equal((await f.call('api-write',btoa('opaque synthetic bytes'))).ok,true);assert.equal(f.apiWrites.length,1);
 const pending=f.call('api-read',{max_bytes:64});
 assert.equal((await f.call('api-close')).ok,true);assert.equal((await pending).data,'');
 assert.equal(f.apiCloses,1);assert.equal(f.fixture.closed,0,'API close preserves the original guardian transport');
 assert.equal((await f.call('guardian-finish')).ok,true);assert.equal(f.guardianStarts,1);
 assert.equal((await f.call('channel-close')).ok,true);assert.equal(f.fixture.closed,1);
}
for(const options of [{apiOpenLoss:true},{apiCloseLoss:true}]) {
 const f=await selected(options);await f.call('ram-stream-check');await f.call('ram-prepare',{packet:f.packet});await send(f);
 const ready=await f.call('ram-complete');f.expectGuardian(ready.data);
 const start=await f.call('guardian-start');f.expectScope(start.data);
 const opened=await f.call('api-open');
 if(options.apiOpenLoss)assert.equal(opened.ok,false);
 else {assert.equal(opened.ok,true);assert.equal((await f.call('api-close')).ok,false);}
 assert.equal(f.apiOpens,1);assert.equal(f.fixture.closed,1);assert.equal(f.guardianStarts,1);
 await assert.rejects(f.call('api-open'));assert.equal(f.apiOpens,1,'Unknown ACK is never retried');
}
for(const Native of [undefined,createNativeChannel().constructor]) {
 const f=await selected({},Native);await f.call('ram-stream-check');await f.call('ram-prepare',{packet:f.packet});await send(f);
 const final=await f.call('ram-complete');assert.equal(final.ok,true);f.expectGuardian(final.data);
 // The selected channel must retain its own detached packet/proof. A caller
 // may alter returned JSON without changing any eventual launch arguments.
 final.data.uploaded={...structuredClone(final.data.uploaded),guardian_file_identity:[7,987]};f.packet.guardian_job_id='0'.repeat(32);
 const start=await f.call('guardian-start');assert.equal(start.ok,true);assert.equal(start.data.records_only,true);
 assert.equal(f.guardianStarts,1);assert.equal(f.fixture.closed,0);
 f.expectProcesses(start.data);
 const observed=await f.call('guardian-process-observe');assert.equal(observed.ok,true);assert.equal(f.processReads,11);
 assert.equal(observed.data.kind,'browser_initial_process_observation');assert.equal(observed.data.context_only,true);
 assert.deepEqual(observed.data.guardian,start.data.start.stamp);assert.equal(observed.data.image_fd_admitted,false);
 f.expectScope(start.data);
 const scope=await f.call('guardian-scope-observe');assert.equal(scope.ok,true);assert.equal(f.scopeReads,57);
 assert.equal(scope.data.kernel_scope_checked,true);assert.equal(scope.data.prefs_layout,'prefs_file');
 const end=await f.call('guardian-finish');assert.equal(end.ok,true);assert.equal(end.data.raw_closed,true);
 assert.equal(end.data.transport_closed,false);assert.equal(end.data.end.child[0],124);
 assert.equal(f.fixture.effects,3);assert.equal(f.guardianStarts,1);assert.equal(f.fixture.closed,0);
 assert.equal((await f.call('channel-close')).ok,true);assert.equal(f.fixture.closed,1);
 await assert.rejects(f.call('guardian-start'));assert.equal(f.guardianStarts,1);
}
for(const operation of ['guardian-start','guardian-finish','guardian-process-observe','guardian-scope-observe']) {
 const f=await selected();assert.equal((await f.call(operation)).ok,false);assert.equal(f.guardianStarts,0);assert.equal(f.fixture.closed,1);
}
{
 const f=await selected({unknownPrefs:true});await f.call('ram-stream-check');await f.call('ram-prepare',{packet:f.packet});await send(f);
 const ready=await f.call('ram-complete');f.expectGuardian(ready.data);
 const start=await f.call('guardian-start');f.expectScope(start.data);
 assert.equal((await f.call('guardian-scope-observe')).ok,false);assert.equal(f.fixture.closed,1);assert.equal(f.guardianStarts,1);
}
for(const options of [{wrongImage:true},{noChild:true},{unreadable:true}]) {
 const f=await selected(options);await f.call('ram-stream-check');await f.call('ram-prepare',{packet:f.packet});await send(f);
 const ready=await f.call('ram-complete');f.expectGuardian(ready.data);
 const start=await f.call('guardian-start');f.expectProcesses(start.data);
 assert.equal((await f.call('guardian-process-observe')).ok,false);assert.equal(f.fixture.closed,1);
 assert.equal(f.guardianStarts,1,'Failed observation never starts another guardian');
}
{
 const f=await selected();await f.call('ram-stream-check');await f.call('ram-prepare',{packet:f.packet});await send(f);
 const ready=await f.call('ram-complete');f.expectGuardian(ready.data);
 const start=await f.call('guardian-start');f.expectProcesses(start.data);
 for(let i=0;i<32;i++)assert.equal((await f.call('guardian-process-observe')).ok,true);
 assert.equal(f.processReads,32*11);
 f.expectScope(start.data);
 assert.equal((await f.call('guardian-scope-observe')).ok,false);assert.equal(f.scopeReads,0);
 assert.equal(f.processReads,32*11);assert.equal(f.fixture.closed,1);
}
{
 const f=await selected();await f.call('ram-stream-check');await f.call('ram-prepare',{packet:f.packet});await send(f);
 const ready=await f.call('ram-complete');f.expectGuardian(ready.data);
 const start=await f.call('guardian-start');f.expectScope(start.data);
 const originalPerformance=globalThis.performance;
 try {
  globalThis.performance={now:()=>f.scopeReads?6000:0};
  assert.equal((await f.call('guardian-scope-observe')).ok,false);
  assert.equal(f.scopeReads,1,'Expired scope window cannot issue another read');assert.equal(f.fixture.closed,1);
 } finally {globalThis.performance=originalPerformance;}
}
for(const bad of ['nonce','arguments','repeat','other-phase','early-finish']) {
 const f=await selected({badGuardianNonce:bad==='nonce'});await f.call('ram-stream-check');await f.call('ram-prepare',{packet:f.packet});await send(f);
 const ready=await f.call('ram-complete');f.expectGuardian(ready.data);
 if(bad==='arguments')assert.equal((await f.call('guardian-start',{command:'not admitted'})).ok,false);
 else if(bad==='early-finish')assert.equal((await f.call('guardian-finish')).ok,false);
 else {
  const started=await f.call('guardian-start');assert.equal(started.ok,bad!=='nonce');
  if(bad==='repeat')assert.equal((await f.call('guardian-start')).ok,false);
  if(bad==='other-phase')assert.equal((await f.call('ram-complete')).ok,false);
 }
 assert.equal(f.guardianStarts,bad==='arguments'||bad==='early-finish'?0:1);assert.equal(f.fixture.closed,1);
}
async function send(f) {
 for(let offset=0;offset<f.body.length;offset+=65536) {
  const chunk=f.body.slice(offset,offset+65536);
  const answer=await f.call('ram-chunk',{offset,body:Buffer.from(chunk).toString('base64')});
  assert.equal(answer.ok,true);assert.equal(answer.data.offset,offset+chunk.length);
 }
}
for(const Native of [undefined,createNativeChannel().constructor]) {
 const f=await selected({},Native);
 assert.equal((await f.call('ram-stream-check')).data.ready,true);assert.equal(f.created,0);
 assert.equal((await f.call('initial-trial-preparation',{meta:f.packet.context.meta})).ok,true,'Fresh read stays available between probe and consumed intent');
 const ready=await f.call('ram-prepare',{packet:f.packet});assert.equal(ready.ok,true);assert.equal(ready.data.state,'ram_precreated');
 assert.equal(f.created,1);assert.equal(f.syncOpens,0);
 await send(f);const final=await f.call('ram-complete');assert.equal(final.ok,true);
 assert.equal(final.data.kind,'browser_initial_ram_ready');assert.equal(final.data.uploaded.guardian_sha256,hash(f.body));
 assert.equal(final.data.guardian_started,false);assert.equal(final.data.transport_closed,false);assert.equal(final.data.image_fd_admitted,false);
 assert.equal(f.fixture.closed,0);assert.equal(f.created,1);assert.equal(f.syncOpens,1);assert.equal(f.syncClosed,1);
 assert.equal(f.fixture.effects,3,'RAM stage never rewrites vendor scripts');
 assert.equal((await f.call('channel-close')).ok,true);assert.equal(f.fixture.closed,1);
 await assert.rejects(f.call('ram-complete'));assert.equal(f.created,1);
}
for(const options of [{badRemoteHash:true},{rootReplacement:true},{fileReplacement:true},{syncError:true}]) {
 const f=await selected(options);assert.equal((await f.call('ram-stream-check')).ok,true);
 assert.equal((await f.call('ram-prepare',{packet:f.packet})).ok,true);await send(f);
 assert.equal((await f.call('ram-complete')).ok,false);assert.equal(f.fixture.closed,1);
 assert.equal(f.created,1);assert.equal(f.syncOpens,1);await assert.rejects(f.call('ram-complete'));
}
{
 const f=await selected({unsupported:true});assert.equal((await f.call('ram-stream-check')).ok,false);
 assert.equal(f.created,0);assert.equal(f.syncOpens,0);assert.equal(f.fixture.closed,1);
}
for(const bad of ['nonce','target','extra']) {
 const f=await selected();await f.call('ram-stream-check');const packet=structuredClone(f.packet);
 if(bad==='nonce')packet.channel_nonce='00000000-0000-0000-0000-000000000000';
 if(bad==='target')packet.context.meta.target.wlan_mac='02:00:00:00:00:02';
 if(bad==='extra')packet.command='not admitted';
 assert.equal((await f.call('ram-prepare',{packet})).ok,false);assert.equal(f.created,0);assert.equal(f.fixture.closed,1);
}
{
 const f=await selected();assert.equal((await f.call('ram-prepare',{packet:f.packet})).ok,false);assert.equal(f.created,0);assert.equal(f.fixture.closed,1);
}
for(const operation of ['api-open','commit-stream-check','ram-stream-check','initial-trial-preparation']) {
 const f=await selected();await f.call('ram-stream-check');await f.call('ram-prepare',{packet:f.packet});
 assert.equal((await f.call(operation)).ok,false);assert.equal(f.fixture.closed,1);assert.equal(f.created,1);assert.equal(f.syncOpens,0);
}
console.log('Actual selected peer RAM/guardian: original nonce/target, retained detached proof, fixed probe/create/SYNC/readback/guardian records, raw-source + delivered bundle, close/no replay passed; emulator executes no code and supplies no terminal trial proof');
