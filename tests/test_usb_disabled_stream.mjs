/** Fixed raw stdin/owned lifetime fixtures; never run a shell or touch USB. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {DisabledCommandStream,disabledStreamService} from '../custom_components/qingping_esphome/frontend/usb-disabled-stream.mjs';
const loaded=spawnSync('python3',['tests/fixtures/monitor1_browser_commands.py'],{encoding:'utf8',env:{PATH:process.env.PATH},maxBuffer:1024*1024,timeout:15000});
assert.equal(loaded.status,0,loaded.stderr);const vectors=JSON.parse(loaded.stdout).slice(0,3);
const encoder=new TextEncoder();
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function fixture(options={}) {
 const records=[],opened=deferred();let retired=0,live=true,openWait=options.delayOpen?deferred():null;
 const backend={live:()=>live,closeTransport:async()=>{retired++;live=false;if(options.transportCloseLoss)throw Error('synthetic private close');},open:async(frame)=>{
  const fixedService=disabledStreamService(frame);
  let controller,closed=deferred(),bytes=new Uint8Array(),ended=false,ownedClosed=false;
  const record={chunks:[],get body(){return new TextDecoder().decode(bytes);},closed:0};records.push(record);opened.resolve();
  const raw={service:options.service || fixedService,closed:closed.promise,
   readable:new ReadableStream({start(c){controller=c;},cancel(){ended=true;closed.resolve();}}),
   writable:new WritableStream({write(chunk){
    assert(chunk instanceof Uint8Array);assert(chunk.length<=4096);record.chunks.push(chunk);
    if(options.writeLoss && records.length>1 && record.chunks.length===2)throw Error('synthetic private write');
    const next=new Uint8Array(bytes.length+chunk.length);next.set(bytes);next.set(chunk,bytes.length);bytes=next;
    if(bytes.length===frame.size && !options.noResponse) {
     assert.equal(createHash('sha256').update(bytes).digest('hex'),frame.sha256);
     const marker=frame.marker;
     const prefix=record.body.includes('CGS1_FIXED_STDIN_READY')?'CGS1_FIXED_STDIN_READY\n':'';
     let output=encoder.encode(prefix+'\n'+marker+'\n');
     if(options.badOutput && records.length>1)output=encoder.encode('synthetic private error');
     if(options.oversized)output=new Uint8Array(4097).fill(65);
     if(options.nul)output=new Uint8Array([0]);
     controller.enqueue(output);controller.close();ended=true;
     if(!options.noRemoteClose)closed.resolve();
    }
   },close(){assert.fail('Duplex stdin must not be closed before remote completion');}}),
   close:async()=>{if(ownedClosed)return;ownedClosed=true;record.closed++;
    if(!ended){controller.close();ended=true;}closed.resolve();
    if(options.stopOnSocketClose)live=false;
    if(options.socketCloseLoss)throw Error('synthetic private close');
   }};
  if(openWait)await openWait.promise;
  if(options.unsupported)throw Error('synthetic unsupported fixed exec');
  return raw;
 }};
 return {stream:new DisabledCommandStream(backend),records,opened:opened.promise,get retired(){return retired;},stop(){live=false;},releaseOpen(){openWait.resolve();}};
}
{
 const f=fixture();
 const probe=await f.stream.probe();assert.equal(probe.ready,true);assert.equal(probe.writer_enabled,false);assert.equal(probe.device_files_changed,false);
 for(const v of vectors) {
  assert.deepEqual(await f.stream.execute(v.meta,v.scope,v.nonce,v.phase),{phase:v.phase,completed:true});
  assert(f.records.at(-1).body.startsWith(v.expected));
 }
 assert.equal(f.records.length,4);assert(f.records.every(r=>r.closed===1));assert.equal(f.retired,0);
 assert(f.records[2].body.length>4096,'Long guarded body actually traverses stdin');
 assert(f.records[2].chunks.length>2);
 await Promise.all([f.stream.close(),f.stream.close()]);assert.equal(f.retired,1);
 await assert.rejects(f.stream.execute(vectors[2].meta,vectors[2].scope,vectors[2].nonce,'start'));
 assert.equal(f.records.length,4,'Consumed phases cannot reopen a stream');
}
for(const options of [{unsupported:true},{service:'tcp:6053'},{oversized:true},{nul:true},{socketCloseLoss:true}]) {
 const f=fixture(options);
 await assert.rejects(f.stream.probe(),error=>error.code==='usb_browser_scope_unverified' && !error.message);
 await assert.rejects(f.stream.probe());assert.equal(f.retired,1);assert.equal(f.records.length,1,'No fallback or repeated OPEN');
 if(options.service)assert.equal(f.records[0].chunks.length,0,'Never send body to a different service');
}
{
 const f=fixture({transportCloseLoss:true});await f.stream.probe();
 await assert.rejects(f.stream.close());await assert.rejects(f.stream.close());assert.equal(f.retired,1);
 await assert.rejects(f.stream.probe());assert.equal(f.records.length,1);
}
{
 const f=fixture({stopOnSocketClose:true});await assert.rejects(f.stream.probe());
 assert.equal(f.retired,1);assert.equal(f.records.length,1,'Closure during final cleanup cannot become a ready probe');
}
for(const options of [{writeLoss:true},{badOutput:true}]) {
 const f=fixture(options);await f.stream.probe();const v=vectors[0];
 await assert.rejects(f.stream.execute(v.meta,v.scope,v.nonce,v.phase));
 await assert.rejects(f.stream.execute(v.meta,v.scope,v.nonce,v.phase));
 assert.equal(f.retired,1);assert.equal(f.records.length,2,'Lost body/ACK is never replayed');
}
{
 const f=fixture();await f.stream.probe();const v=vectors[0];
 await assert.rejects(f.stream.execute(v.meta,v.scope,v.nonce,'start'));
 await assert.rejects(f.stream.execute(v.meta,v.scope,v.nonce,v.phase));assert.equal(f.records.length,1);
}
{
 const f=fixture({delayOpen:true});const pending=f.stream.probe();
 await f.opened;await f.stream.close();await assert.rejects(pending);
 f.releaseOpen();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.records.length,1);assert.equal(f.records[0].chunks.length,0);assert.equal(f.records[0].closed,1,'Late open is closed, never adopted');
}
{
 const original=globalThis.setTimeout;
 globalThis.setTimeout=(callback,ms,...args)=>original(callback,Math.min(ms,10),...args);
 try {
  for(const options of [{noResponse:true},{noRemoteClose:true}]) {
   const f=fixture(options);await assert.rejects(f.stream.probe());assert.equal(f.retired,1);assert.equal(f.records.length,1);
  }
 } finally {globalThis.setTimeout=original;}
}
console.log('Fixed stdin chunks, exact completion/remote close, retirement, no fallback/replay/late adoption passed; no device IO');
