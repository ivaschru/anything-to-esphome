/** In-memory sealed stdin responder; it never executes the received body. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const encoder=new TextEncoder();
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
export function fixedStdinFixture(Stream,service,options={}) {
 const records=[],opened=deferred();let retired=0,live=true,openWait=options.delayOpen?deferred():null;
 const backend={live:()=>live,closeTransport:async()=>{retired++;live=false;if(options.transportCloseLoss)throw Error('synthetic private close');},open:async(frame)=>{
  const fixedService=service(frame);
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
     if(options.onBody)options.onBody(record.body);
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
 return {stream:new Stream(backend),openRaw:backend.open,records,opened:opened.promise,get retired(){return retired;},stop(){live=false;},releaseOpen(){openWait.resolve();}};
}
