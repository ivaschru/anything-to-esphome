/** Sealed guardian transport with emulated records; NEVER executes its body. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {InitialGuardianStream,initialGuardianStreamService} from '../custom_components/qingping_esphome/frontend/usb-initial-guardian-stream.mjs';
import {initialGuardianLaunchBody} from '../custom_components/qingping_esphome/frontend/usb-initial-guardian-frame.mjs';
const vectors=JSON.parse(execFileSync(process.env.PYTHON||'python3',['tests/fixtures/monitor1_browser_guardian_frame.py'],{encoding:'utf8',maxBuffer:1024*1024}));
const encoder=new TextEncoder();
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function fixture(v=structuredClone(vectors[0]),options={}) {
 let opens=0,retired=0,rawClosed=0,live=true,controller,closed,wire='',sent=false,ended=false,ownedClosed=false;
 const opened=deferred(),written=deferred(),openWait=options.delayOpen?deferred():null;
 const stamp=options.stockCollision?[v.fresh.scope.stock_process[0],'1000']:[123,'18446744073709551615'];
 const nonce=v.packet.nonce,rawEnd=`CGS1_TRIAL_END_V1 ${nonce} ${stamp[0]} ${stamp[1]} 124 456 60000 1 1 1 0 15\n`;
 let marker;
 const emit=text=>{
  const bytes=encoder.encode(text);
  for(let offset=0;offset<bytes.length;offset+=7)controller.enqueue(bytes.slice(offset,offset+7));
 };
 const release=()=>{
  if(ended)return;
  let terminal=rawEnd+'\n'+marker+'\n';
  if(options.badEnd)terminal=terminal.replace('60000','59999');
  if(options.wrongChild)terminal=terminal.replace('124 456','125 457');
  if(options.extraLine)terminal+='unexpected\n';
  if(options.noMarker)terminal=rawEnd;
  emit(terminal);controller.close();ended=true;if(!options.noRemoteClose)closed.resolve();
 };
 const backend={live:()=>live,closeTransport:async()=>{retired++;live=false;if(options.closeLoss)throw Error('synthetic transport close');},
  open:async framing=>{
   opens++;opened.resolve();marker=framing.marker;closed=deferred();
   const socket={service:options.badService?'shell:not-fixed':initialGuardianStreamService(framing),closed:closed.promise,
    readable:new ReadableStream({start(c){controller=c;},cancel(){ended=true;closed.resolve();}}),
    writable:new WritableStream({write(bytes){
     if(options.writeLoss && wire.length>4096)throw Error('synthetic WRTE failure');
     wire+=new TextDecoder().decode(bytes);
     if(wire.length===framing.size) {
      assert.equal(createHash('sha256').update(wire).digest('hex'),framing.sha256);
      assert.equal(wire,initialGuardianLaunchBody(v.packet,v.fresh,v.ram));sent=true;written.resolve();
      const start=options.badNonce?'0'.repeat(32):nonce;
      if(!options.noResponse)emit(`CGS1_TRIAL_START_V1 ${start} ${stamp[0]} ${stamp[1]}\nCGS1_TRIAL_CHILD_V1 ${nonce} 124 456\n`);
      if(!options.holdEnd && !options.noResponse)release();
     }
    },close(){assert.fail('No premature duplex EOF');}}),
    close:async()=>{if(ownedClosed)return;ownedClosed=true;rawClosed++;
     if(!ended){controller.close();ended=true;}closed.resolve();if(options.rawCloseLoss)throw Error('synthetic raw close loss');},
   };
   if(openWait)await openWait.promise;
   return socket;
  },
 };
 return {stream:new InitialGuardianStream(backend),v,opened:opened.promise,written:written.promise,release,releaseOpen:()=>openWait.resolve(),
  get opens(){return opens;},get retired(){return retired;},get rawClosed(){return rawClosed;},get sent(){return sent;}};
}
for(const vector of vectors) {
 const f=fixture(structuredClone(vector),{holdEnd:true});
 const started=await f.stream.start(f.v.packet,f.v.fresh,f.v.ram);assert.equal(started.records_only,true);
 assert.deepEqual(started.start.stamp,[123,'18446744073709551615']);assert.deepEqual(started.child.stamp,[124,'456']);
 assert.equal(f.sent,true);assert.equal(f.retired,0);assert.equal(f.rawClosed,0);
 const finishing=f.stream.finish();f.release();const end=await finishing;
 assert.equal(end.records_only,true);assert.equal(end.raw_closed,true);assert.equal(end.transport_closed,false);assert.equal(end.end.term_sent,true);
 assert.equal(f.rawClosed,1);assert.equal(f.retired,0,'Keep original transport for independent post-trial checks');
 await f.stream.close();assert.equal(f.retired,1);await assert.rejects(f.stream.start(f.v.packet,f.v.fresh,f.v.ram));assert.equal(f.opens,1);
}
for(const options of [{badEnd:true},{wrongChild:true},{extraLine:true},{noMarker:true},{writeLoss:true},{badService:true},
                     {badNonce:true},{stockCollision:true},{rawCloseLoss:true}]) {
 const f=fixture(undefined,options);
 await assert.rejects(async()=>{await f.stream.start(f.v.packet,f.v.fresh,f.v.ram);await f.stream.finish();},e=>e.code==='usb_browser_scope_unverified');
 assert.equal(f.opens,1);assert.equal(f.retired,1);await assert.rejects(f.stream.start(f.v.packet,f.v.fresh,f.v.ram));assert.equal(f.opens,1);
}
{
 const f=fixture(undefined,{delayOpen:true});const starting=f.stream.start(f.v.packet,f.v.fresh,f.v.ram);
 await f.opened;await f.stream.close();await assert.rejects(starting);f.releaseOpen();await new Promise(r=>setImmediate(r));
 assert.equal(f.sent,false);assert.equal(f.rawClosed,1);assert.equal(f.retired,1);
}
{
 const f=fixture(undefined,{holdEnd:true,closeLoss:true});await f.stream.start(f.v.packet,f.v.fresh,f.v.ram);
 const closing=f.stream.close();assert.strictEqual(f.stream.close(),closing);await assert.rejects(closing);await assert.rejects(f.stream.finish());assert.equal(f.retired,1);
}
{
 const f=fixture();f.v.ram.uploaded.guardian_file_identity[1]++;
 await assert.rejects(f.stream.start(f.v.packet,f.v.fresh,f.v.ram));assert.equal(f.opens,0);assert.equal(f.retired,1);
}
{
 const original=globalThis.setTimeout,originalClear=globalThis.clearTimeout,originalNow=Date.now;
 const timers=[];
 // Drive a chosen missing-response deadline only AFTER the sealed body was
 // actually written. A real 10ms shortcut can expire while WebCrypto is still
 // hashing under CI load, testing pre-OPEN refusal instead of the intended
 // missing START/remote-close path. Keep production budgets unchanged.
 Date.now=()=>1000;
 globalThis.setTimeout=(fn,ms,...args)=>{
  if(![30000,110000].includes(ms))return original(fn,ms,...args);
  const timer={ms,active:true,fire:()=>fn(...args)};timers.push(timer);return timer;
 };
 globalThis.clearTimeout=timer=>{if(timers.includes(timer))timer.active=false;else originalClear(timer);};
 try {
  for(const options of [{noResponse:true},{noRemoteClose:true}]) {
   const f=fixture(undefined,options);
   const operation=(async()=>{await f.stream.start(f.v.packet,f.v.fresh,f.v.ram);await f.stream.finish();})();
   const refused=assert.rejects(operation);
   await f.written;await new Promise(resolve=>setImmediate(resolve));
   const timer=timers.find(timer=>timer.active && timer.ms===(options.noResponse?30000:110000));
   assert.ok(timer,'The intended post-write timeout must still be pending');
   timer.active=false;timer.fire();await refused;
   assert.equal(f.retired,1);assert.equal(f.opens,1);
  }
 } finally {globalThis.setTimeout=original;globalThis.clearTimeout=originalClear;Date.now=originalNow;}
}
console.log('Guardian transport: sealed bytes, ordered uint64-safe records, split stdout, bounded cancellation/close and one attempt passed; emulated only, no shell/monitor or independent trial success');
