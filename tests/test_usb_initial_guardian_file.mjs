/** Fixed one-file RAM transport; no device, shell or actual program executes. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {BrowserInitialGuardianSink} from '../custom_components/qingping_esphome/frontend/usb-initial-guardian-file.mjs';
const body=new TextEncoder().encode('synthetic guardian; not firmware\n'.repeat(5000));
const sha=value=>createHash('sha256').update(value).digest('hex');
const descriptor={schema_version:1,job_id:'a'.repeat(32),plan_sha256:'b'.repeat(64),intent_sha256:'c'.repeat(64),
 channel_id:'d'.repeat(32),channel_nonce:'11111111-1111-1111-1111-111111111111',nonce:'e'.repeat(32),
 ram_job_id:'f'.repeat(32),guardian_job_id:'1'.repeat(32),guardian:{size:body.length,sha256:sha(body)}};
function fixture(options={}) {
 let opens=0,pushes=0,closed=0,syncClosed=0,seen;
 const factory={openSync:async()=>{opens++;if(options.lateOpen)await options.lateOpen;
   return {close:async()=>{syncClosed++;if(options.syncCloseFailure)throw Error('synthetic sync close failure');}};},
  pushV1:async request=>{pushes++;seen=request;
   const chunks=[];for await(const chunk of request.file)chunks.push(chunk);
   assert.deepEqual(Buffer.concat(chunks.map(v=>Buffer.from(v))),Buffer.from(body));
   if(options.pushFailure)throw Error('synthetic private failure');
  },closeTransport:async()=>{closed++;if(options.closeFailure)throw Error('synthetic close failure');}};
 const sink=new BrowserInitialGuardianSink(factory,options.descriptor??descriptor);
 return {sink,factory,get opens(){return opens;},get pushes(){return pushes;},get closed(){return closed;},get syncClosed(){return syncClosed;},get seen(){return seen;}};
}
{
 const mutable=structuredClone(descriptor),f=fixture({descriptor:mutable});
 mutable.guardian_job_id='2'.repeat(32);mutable.guardian.size=52;mutable.guardian.sha256='0'.repeat(64);
 await buffered(f);await f.sink.finish();
 assert.equal(f.seen.filename,'/tmp/qingping-initial-guardian-'+descriptor.guardian_job_id+'/program');
 await f.sink.close();
}
async function buffered(f,bytes=body) {
 assert.deepEqual(await f.sink.begin(),{offset:0});
 for(let offset=0;offset<bytes.length;offset+=65536) {
  const chunk=bytes.slice(offset,offset+65536);assert.deepEqual(await f.sink.append(offset,chunk),{offset:offset+chunk.length});
 }
 assert.equal(f.opens,0,'Whole-body hash must precede SYNC/open');
}
{
 const f=fixture();await buffered(f);const result=await f.sink.finish();
 assert.equal(result.wire_acknowledged,true);assert.equal(result.guardian_job_id,descriptor.guardian_job_id);
 assert.equal(f.seen.filename,'/tmp/qingping-initial-guardian-'+descriptor.guardian_job_id+'/program');
 assert.equal(f.seen.type,0o10);assert.equal(f.seen.permission,0o600);assert.equal(f.seen.mtime,0);assert.equal(f.seen.packetSize,65536);
 assert.equal(f.opens,1);assert.equal(f.pushes,1);assert.equal(f.syncClosed,1);assert.equal(f.closed,0,'Later readback/lifecycle keeps this transport');
 assert(!Object.hasOwn(result,'remote_file_verified'));assert(!Object.hasOwn(result,'image_fd_admitted'));
 await f.sink.close();await f.sink.close();assert.equal(f.closed,1);
 await assert.rejects(f.sink.begin());await assert.rejects(f.sink.finish());assert.equal(f.opens,1);
}
{
 const f=fixture();const bad=body.slice();bad[0]^=1;await buffered(f,bad);
 await assert.rejects(f.sink.finish(),v=>v.code==='usb_browser_scope_unverified');
 assert.equal(f.opens,0);assert.equal(f.closed,1);await assert.rejects(f.sink.begin());
}
for(const append of [sink=>sink.append(1,body.slice(0,1)),sink=>sink.append(0,new Uint8Array()),
                     sink=>sink.append(0,new Uint8Array(65537)),sink=>sink.append(0,[1]),sink=>sink.append(true,body.slice(0,1))]) {
 const f=fixture();await f.sink.begin();await assert.rejects(append(f.sink));assert.equal(f.opens,0);assert.equal(f.closed,1);
}
{
 const f=fixture();await f.sink.begin();await f.sink.append(0,body.slice(0,10));await assert.rejects(f.sink.finish());
 assert.equal(f.opens,0);assert.equal(f.closed,1);
}
{
 let release;const lateOpen=new Promise(resolve=>{release=resolve;});const f=fixture({lateOpen});await buffered(f);
 const pending=f.sink.finish();while(!f.opens)await new Promise(resolve=>setTimeout(resolve,0));
 await f.sink.close();release();await assert.rejects(pending);await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(f.opens,1);assert.equal(f.pushes,0);assert.equal(f.syncClosed,1);assert.equal(f.closed,1);
}
for(const options of [{pushFailure:true},{syncCloseFailure:true},{closeFailure:true}]) {
 const f=fixture(options);await buffered(f);
 if(options.syncCloseFailure || options.pushFailure)await assert.rejects(f.sink.finish());else await f.sink.finish();
 const first=f.sink.close();assert.strictEqual(f.sink.close(),first);
 if(options.closeFailure){await assert.rejects(first);await assert.rejects(f.sink.close());}
 else await first; // A retired USB handle cannot turn the failed transfer into success.
 assert.equal(f.closed,1);assert.equal(f.opens,1);await assert.rejects(f.sink.finish());
}
for(const value of [null,undefined,[],true,'not metadata']) {
 const f=fixture();await f.sink.close();
 assert.throws(()=>new BrowserInitialGuardianSink(f.factory,value),error=>error.code==='usb_browser_scope_unverified' && !error.message);
}
for(const delta of [{guardian_job_id:'../../bad'},{guardian_job_id:descriptor.ram_job_id},{nonce:true},{channel_nonce:'bad'},
                   {path:'/tmp/not-admitted'},{guardian:{size:16*1024*1024+1,sha256:'a'.repeat(64)}},
                   {guardian:{size:51,sha256:'a'.repeat(64)}},{guardian:{size:52,sha256:'bad'}}]) {
 const f=fixture();await f.sink.close();
 assert.throws(()=>new BrowserInitialGuardianSink(f.factory,{...descriptor,...delta}));
}
console.log('Initial guardian file: one fixed private tmpfs SEND, full hash-before-open, bounded chunks, detached descriptor, late-open retirement and shared close/no-retry passed; no remote verification, image admission or execution');
