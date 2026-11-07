/** Exercise the exact pinned Tango SYNC-v1 encoder against an in-memory daemon.
 * No USB transport, shell/ADB process, production path or actual ELF executes.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {BrowserStageFileSink,STAGE_ROLES} from '../custom_components/qingping_esphome/frontend/usb-stage-files.mjs';
const args=process.argv.slice(2);
if(args.length && !(args.length===2 && args[0]==='--dependencies'))throw Error('Only an explicit dependency directory is accepted');
const dependencyRoot=path.resolve(args.length ? args[1] : 'tools/monitor1-usb');
const manifest=JSON.parse(await readFile(path.join(dependencyRoot,'node_modules/@yume-chan/adb/package.json'),'utf8'));
assert.equal(manifest.version,'2.6.2');
const {AdbSyncSocket,adbSyncPushV1}=await import(pathToFileURL(path.join(dependencyRoot,'node_modules/@yume-chan/adb/esm/index.js')));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const contents=Object.fromEntries(STAGE_ROLES.map(([role],index)=>[role,
  new TextEncoder().encode(index===0 ? 'synthetic-not-firmware'.repeat(7000) : 'synthetic-'+role)]));
const descriptor={plan_id:'a'.repeat(32),plan_sha256:'b'.repeat(64),intent_sha256:'c'.repeat(64),
 files:Object.fromEntries(STAGE_ROLES.map(([role])=>[role,{size:contents[role].length,sha256:sha(contents[role])}]))};
function daemon(fail=false) {
 let input=new Uint8Array(),response,closed=0,sent=false;
 const packets=[];
 function consume(bytes) {
  const joined=new Uint8Array(input.length+bytes.length);joined.set(input);joined.set(bytes,input.length);input=joined;
  while(input.length>=8) {
   const operation=new TextDecoder().decode(input.slice(0,4)),length=new DataView(input.buffer,input.byteOffset+4,4).getUint32(0,true);
   if(operation==='DONE') {
    assert.equal(length,0);input=input.slice(8);assert.equal(input.length,0);
    assert(!sent);sent=true;packets.push({operation,length});
    const text=fail ? 'synthetic private daemon error' : '';
    const encoded=new TextEncoder().encode(text),ack=new Uint8Array(8+encoded.length);
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
{
 const daemons=[];let transportClosed=0;
 const sink=new BrowserStageFileSink({openSync:async()=>{const d=daemon();daemons.push(d);return d.socket;},
  pushV1:adbSyncPushV1,closeTransport:async()=>{transportClosed++;}},descriptor);
 try {
  for(const [role,leaf] of STAGE_ROLES) {
   const bytes=contents[role];await sink.begin(role);
   for(let offset=0;offset<bytes.length;offset+=65536)await sink.append(role,offset,bytes.slice(offset,offset+65536));
   assert.equal((await sink.finish(role)).wire_acknowledged,true);
   const d=daemons.at(-1);assert.equal(d.closed,1);
   assert.equal(d.packets[0].operation,'SEND');
   assert.equal(new TextDecoder().decode(d.packets[0].body),'/data/.esphome-cgs1/'+leaf+','+String(0o100600));
   const chunks=d.packets.filter(p=>p.operation==='DATA').map(p=>p.body);
   assert(chunks.every(chunk=>chunk.length<=65536));
   assert.deepEqual(Buffer.concat(chunks.map(chunk=>Buffer.from(chunk))),Buffer.from(bytes));
   assert.equal(d.packets.at(-1).operation,'DONE');
  }
  assert.equal(daemons.length,9);
 } finally {await sink.close();}
 assert.equal(transportClosed,1);
}
{
 let opens=0,closed=0;
 const sink=new BrowserStageFileSink({openSync:async()=>{opens++;return daemon(true).socket;},pushV1:adbSyncPushV1,
  closeTransport:async()=>{closed++;}},descriptor);
 const role=STAGE_ROLES[0][0];await sink.begin(role);
 const bytes=contents[role];for(let offset=0;offset<bytes.length;offset+=65536)await sink.append(role,offset,bytes.slice(offset,offset+65536));
 await assert.rejects(sink.finish(role),error=>error.code==='usb_browser_stage_unverified' && !error.message);
 await assert.rejects(sink.begin(role));assert.equal(opens,1);assert.equal(closed,1);
}
console.log('Actual Tango 2.6.2 SYNC-v1: SEND private fixed paths/modes, bounded DATA, DONE/OKAY and redacted FAIL no-retry passed');
