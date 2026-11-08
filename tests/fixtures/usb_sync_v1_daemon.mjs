/** One in-memory old SYNC-v1 peer for the pinned Tango encoder tests.
 * Records protocol frames only: no filesystem path, shell, firmware or USB.
 */
import assert from 'node:assert/strict';

export function syncV1Daemon(AdbSyncSocket,{fail=false}={}) {
 let input=new Uint8Array(),response,closed=0,sent=false;
 const packets=[];
 function consume(bytes) {
  const joined=new Uint8Array(input.length+bytes.length);joined.set(input);joined.set(bytes,input.length);input=joined;
  while(input.length>=8) {
   const operation=new TextDecoder().decode(input.slice(0,4)),length=new DataView(input.buffer,input.byteOffset+4,4).getUint32(0,true);
   if(operation==='DONE') {
    assert.equal(length,0);input=input.slice(8);assert.equal(input.length,0);
    assert(!sent);sent=true;packets.push({operation,length});
    const encoded=new TextEncoder().encode(fail?'synthetic private daemon error':''),ack=new Uint8Array(8+encoded.length);
    ack.set(new TextEncoder().encode(fail?'FAIL':'OKAY'));new DataView(ack.buffer).setUint32(4,encoded.length,true);ack.set(encoded,8);
    response.enqueue(ack);return;
   }
   assert(['SEND','DATA'].includes(operation),'No SND2/compression/mkdir/other command');
   if(input.length<8+length)return;
   packets.push({operation,body:input.slice(8,8+length)});input=input.slice(8+length);
  }
 }
 const raw={readable:new ReadableStream({start(controller){response=controller;}}),
  writable:new WritableStream({write(packet){return packet.tryConsume(bytes=>consume(bytes));}}),close:async()=>{closed++;}};
 return {socket:new AdbSyncSocket(raw,65536),packets,get closed(){return closed;}};
}
