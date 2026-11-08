/** Actual pinned Tango dispatcher/socket with a tiny packet-window emulator.
 * No USB, daemon, shell, subprocess script or monitor binary is executed.
 * This proves WRTE fragmentation/ACK and remote CLSE semantics in this exact
 * library; it does not prove a physical monitor supports exec:/bin/sh.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {DisabledCommandStream,disabledStreamService} from '../custom_components/qingping_esphome/frontend/usb-disabled-stream.mjs';
const args=process.argv.slice(2);
if(args.length && !(args.length===2 && args[0]==='--dependencies'))throw Error('Only the pinned dependency directory is accepted');
const root=path.resolve(args.length?args[1]:'tools/monitor1-usb');
const manifest=JSON.parse(await readFile(path.join(root,'node_modules/@yume-chan/adb/package.json'),'utf8'));
assert.equal(manifest.version,'2.6.2');
const {Adb,AdbDaemonTransport,AdbCommand}=await import(pathToFileURL(path.join(root,'node_modules/@yume-chan/adb/esm/index.js')));
const loaded=spawnSync('python3',['tests/fixtures/monitor1_browser_commands.py'],{encoding:'utf8',env:{PATH:process.env.PATH},maxBuffer:1024*1024,timeout:15000});
assert.equal(loaded.status,0,loaded.stderr);const vectors=JSON.parse(loaded.stdout).slice(0,3);
const ramLoaded=spawnSync('python3',['tests/fixtures/monitor1_browser_initial_ram.py'],{encoding:'utf8',env:{PATH:process.env.PATH},maxBuffer:1024*1024,timeout:15000});
assert.equal(ramLoaded.status,0,ramLoaded.stderr);const ram=JSON.parse(ramLoaded.stdout)[0];
const {InitialRamCommandStream,initialRamStreamService}=await import('../custom_components/qingping_esphome/frontend/usb-initial-ram-stream.mjs');
for(const scenario of [
 {Stream:DisabledCommandStream,service:disabledStreamService,operations:vectors,
  execute:(stream,v)=>stream.execute(v.meta,v.scope,v.nonce,v.phase),bodies:vectors.map(v=>v.expected)},
 {Stream:InitialRamCommandStream,service:initialRamStreamService,operations:[ram],
  execute:(stream,v)=>stream.create(v.packet,v.preparation),bodies:[ram.expected.create]}
]) {
const encoder=new TextEncoder(),decoder=new TextDecoder(),maximum=512;
let incoming,wireClosed=false,retired=0;
const states=new Map(),opens=[],writes=[];
function reply(command,arg0,arg1,payload=new Uint8Array()) {
 assert(!wireClosed);incoming.enqueue({command,arg0,arg1,payload});
}
function nextOutput(state) {
 if(state.output.length) {
  const body=state.output.shift();reply(AdbCommand.Write,state.remote,state.local,body);
 } else {state.closeSent=true;reply(AdbCommand.Close,state.remote,state.local);}
}
function outgoing(packet) {
 assert(packet.payload.length<=maximum,'Every actual Tango OPEN/WRTE honors the negotiated window');
 if(packet.command===AdbCommand.Open) {
  const service=decoder.decode(packet.payload).slice(0,-1);
  const framing={size:Number(service.match(/count=([0-9]+)/)[1]),sha256:service.match(/[a-f0-9]{64}/)[0],marker:service.match(/__CGS1_FIXED_OK_[a-f0-9]{32}__/)[0]};
  assert.equal(service,scenario.service(framing),'Only the complete tiny sealed-receive bootstrap is in OPEN');
  const state={local:packet.arg0,remote:packet.arg0+100,body:'',output:[],closeSent:false,framing};
  states.set(state.local,state);opens.push(state);
  reply(AdbCommand.Okay,state.remote,state.local);return;
 }
 const state=states.get(packet.arg0);assert(state,'No unknown/adopted socket');
 if(packet.command===AdbCommand.Write) {
  assert.equal(packet.arg1,state.remote);writes.push(packet.payload.length);state.body+=decoder.decode(packet.payload);
  reply(AdbCommand.Okay,state.remote,state.local);
  if(state.body.length===state.framing.size) {
   assert.equal(createHash('sha256').update(state.body).digest('hex'),state.framing.sha256);
   const marker=state.framing.marker;
   const prefix=state.body.includes('CGS1_FIXED_STDIN_READY')?'CGS1_FIXED_STDIN_READY\n':'';
   const output=encoder.encode(prefix+'\n'+marker+'\n');
   for(let i=0;i<output.length;i+=maximum)state.output.push(output.slice(i,i+maximum));
   nextOutput(state);
  }
 } else if(packet.command===AdbCommand.Okay) {
  // The next remote chunk/CLSE is withheld until Tango has actually drained
  // and acknowledged this output. An unconsumed stdout would stall stdin.
  assert.equal(packet.arg1,state.remote);nextOutput(state);
 } else if(packet.command===AdbCommand.Close) {
  assert(state.closeSent,'No local close is substituted for remote completion');
  state.closed=true;
 } else assert.fail('No shell-v2/SYNC/other transport fallback');
}
const connection={
 readable:new ReadableStream({start(c){incoming=c;},cancel(){wireClosed=true;}}),
 writable:new WritableStream({write(value){return value.tryConsume(packet=>outgoing(packet));},close(){if(!wireClosed){wireClosed=true;incoming.close();}}}),
};
const transport=new AdbDaemonTransport({serial:'synthetic-only',connection,version:0x01000000,banner:'device::features=',
 features:[],maxPayloadSize:maximum,initialDelayedAckBytes:0,readTimeLimit:0});
const client=new Adb(transport);
const stream=new scenario.Stream({live:()=>!wireClosed,open:framing=>client.createSocket(scenario.service(framing)),
 closeTransport:async()=>{retired++;await client.close();}});
await stream.probe();
for(const v of scenario.operations)await scenario.execute(stream,v);
assert.equal(opens.length,scenario.operations.length+1);assert(opens.every(state=>state.closed),'Every fixed shell waited for its own remote CLSE');
scenario.bodies.forEach((body,i)=>assert.equal(opens[i+1].body,body));
assert(opens.some(state=>state.body.length>4096));
assert(writes.length>=Math.ceil(opens.reduce((n,state)=>n+state.body.length,0)/maximum));assert(writes.every(length=>length<=maximum));assert(writes.some(length=>length===maximum));
await stream.close();assert.equal(retired,1);
}
console.log('Actual Tango2.6.2: disabled and initial RAM fixed OPEN, 512-byte WRTE/ACK flow and owned remote CLSE passed; no hardware/shell execution');
