/** Real finite RAM session/classes, synthetic reads/SYNC only; no shell/USB. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {BrowserInitialRamSession} from '../custom_components/qingping_esphome/frontend/usb-initial-ram-session.mjs';
import {InitialRamCommandStream,initialRamStreamService} from '../custom_components/qingping_esphome/frontend/usb-initial-ram-stream.mjs';
import {initialRamCommands} from '../custom_components/qingping_esphome/frontend/usb-initial-ram-commands.mjs';
import {fixedStdinFixture} from './fixtures/usb_fixed_stdin_socket.mjs';
const base=JSON.parse(execFileSync(process.env.PYTHON||'python3',['tests/fixtures/monitor1_browser_initial_ram.py'],{encoding:'utf8',maxBuffer:1024*1024}))[0];
const empty='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fixture(options={}) {
 const wire=fixedStdinFixture(InitialRamCommandStream,initialRamStreamService,options.wire);
 await wire.stream.probe();
 const packet=structuredClone(base.packet),preparation=structuredClone(base.preparation);
 packet.context.guardian.size=131089;
 const body=new Uint8Array(packet.context.guardian.size).fill(42);packet.context.guardian.sha256=digest(body);
 const commands=initialRamCommands(packet,preparation),path='/tmp/qingping-initial-guardian-'+packet.guardian_job_id+'/program';
 let uploaded=false,opens=0,pushes=0,syncClosed=0,preparations=0,reads=0;
 const backend={
  preparation:async()=>{
   preparations++;if(options.preparationWait && preparations===1)await options.preparationWait;
   const p=structuredClone(preparation);
   if(uploaded && options.sourceDrift)p.scope.stock_process[1]++;
   return p;
  },
  read:async command=>{
   reads++;if(options.readError)throw Error('synthetic read failed');
   const inode=uploaded && options.rootReplacement?103:100;
   const root=`1 ${inode} 700 0\n1021994 16384 4096\n1 101 700 0\n1021994 16384 4096`;
   if(command===commands.inspect_roots)return root;
   assert.equal(command,commands.inspect_guardian);
   const size=uploaded?body.length:0,hash=uploaded?(options.remoteBadHash?'0'.repeat(64):digest(body)):empty;
   const fileInode=uploaded && options.fileReplacement?104:102;
   return `${size} 600 0 1 1 ${fileInode}\n${hash}  ${path}`;
  },
  openSync:async()=>{opens++;if(options.syncOpenError)throw Error('synthetic sync failure');
   return {close:async()=>{syncClosed++;}};},
  pushV1:async request=>{
   pushes++;assert.equal(request.filename,path);assert.equal(request.permission,0o600);
   const chunks=[];for await(const chunk of request.file)chunks.push(chunk);
   assert.deepEqual(Buffer.concat(chunks),Buffer.from(body));
   if(options.pushError)throw Error('synthetic partial write');uploaded=true;
  },
 };
 const session=new BrowserInitialRamSession(backend,wire.stream,packet);
 return {session,wire,packet,body,get opens(){return opens;},get pushes(){return pushes;},get preparations(){return preparations;},
  get reads(){return reads;},get syncClosed(){return syncClosed;}};
}
async function append(f,body=f.body) {
 for(let offset=0;offset<body.length;offset+=65536) {
  const chunk=body.slice(offset,offset+65536);
  assert.deepEqual(await f.session.append(offset,chunk),{offset:offset+chunk.length});
 }
}
{
 const f=await fixture();const result=await f.session.prepare();assert.equal(result.state,'ram_precreated');
 assert.equal(result.precreated.guardian_size,0);assert.equal(f.wire.records.length,2);assert.equal(f.reads,3);
 assert.equal(f.opens,0,'No guardian upload before independent empty-file/root checks');
 await append(f);const ready=await f.session.finish();
 assert.equal(ready.kind,'browser_initial_ram_ready');assert.equal(ready.uploaded.guardian_sha256,digest(f.body));
 for(const k of ['transport_closed','guardian_started','image_fd_admitted','execution_authority'])assert.equal(ready[k],false);
 assert.equal(ready.context_only,true);assert.equal(f.wire.retired,0,'Keep original transport for separate guardian lifecycle');
 assert.equal(f.preparations,4);assert.equal(f.reads,6);assert.equal(f.opens,1);assert.equal(f.pushes,1);assert.equal(f.syncClosed,1);
 await assert.rejects(f.session.finish());assert.equal(f.wire.retired,1);assert.equal(f.opens,1);
 const closing=f.session.close();assert.strictEqual(f.session.close(),closing);await closing;assert.equal(f.wire.retired,1);
}
for(const options of [{rootReplacement:true},{fileReplacement:true},{remoteBadHash:true},{sourceDrift:true},{pushError:true},{syncOpenError:true}]) {
 const f=await fixture(options);await f.session.prepare();await append(f);
 await assert.rejects(f.session.finish(),v=>v.code==='usb_browser_scope_unverified');
 await assert.rejects(f.session.finish());assert.equal(f.wire.retired,1);assert.equal(f.opens,1);
 assert.equal(f.pushes,options.syncOpenError?0:1);
}
{
 const f=await fixture({readError:true});await assert.rejects(f.session.prepare());
 assert.equal(f.wire.retired,1);assert.equal(f.opens,0);await assert.rejects(f.session.prepare());assert.equal(f.wire.records.length,2);
}
{
 const f=await fixture();await f.session.prepare();const bad=f.body.slice();bad[0]^=1;await append(f,bad);
 await assert.rejects(f.session.finish());assert.equal(f.opens,0,'Full body hash before SYNC');assert.equal(f.wire.retired,1);
}
for(const action of [f=>f.session.append(0,f.body),f=>f.session.finish()]) {
 const f=await fixture();await assert.rejects(action(f));assert.equal(f.wire.retired,1);assert.equal(f.wire.records.length,1);
}
{
 let release;const preparationWait=new Promise(resolve=>{release=resolve;});
 const f=await fixture({preparationWait});const pending=f.session.prepare();
 while(f.preparations===0)await new Promise(resolve=>setImmediate(resolve));
 await f.session.close();await assert.rejects(pending);release();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.wire.records.length,1,'Late pure preparation never creates a RAM job');assert.equal(f.wire.retired,1);
}
{
 const f=await fixture({wire:{transportCloseLoss:true}});await f.session.prepare();await append(f);await f.session.finish();
 const closing=f.session.close();await assert.rejects(closing);assert.strictEqual(f.session.close(),closing);
 await assert.rejects(f.session.close());assert.equal(f.wire.retired,1);
}
{
 // Only the session's pending-read bound is accelerated. The transport/sink
 // lifetimes are not restarted and no late pure read can become a write.
 const f=await fixture({preparationWait:new Promise(()=>{})});
 const original=globalThis.setTimeout;
 globalThis.setTimeout=(callback,ms,...args)=>original(callback,ms===90000?10:ms,...args);
 try {await assert.rejects(f.session.prepare());assert.equal(f.wire.retired,1);assert.equal(f.wire.records.length,1);}
 finally {globalThis.setTimeout=original;await f.session.close();}
}
console.log('RAM session: fresh source bracket, one sealed create, exclusive precreate readback, one SYNC, exact inode/SHA readback, cancellation/unknown retirement passed; no guardian start, device FD admission or hardware');
