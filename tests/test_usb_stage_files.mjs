import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {BrowserStageFileSink,STAGE_ROLES} from '../custom_components/qingping_esphome/frontend/usb-stage-files.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
// Parse the canonical Python table without importing or executing an adapter.
const canonical=JSON.parse(execFileSync(process.env.QINGPING_TEST_PYTHON || 'python3',['-c',
 "import ast,json; t=ast.parse(open('ports/monitor1/stage_install_adb.py').read()); print(json.dumps(next(ast.literal_eval(n.value) for n in t.body if isinstance(n,ast.Assign) and any(isinstance(k,ast.Name) and k.id=='STAGED' for k in n.targets))))"],{encoding:'utf8'}));
assert.deepEqual(STAGE_ROLES,Object.entries(canonical),'Keep the exact canonical fixed staging roles');

function fixture({badAck=false,badClose=false}={}) {
 const contents=Object.fromEntries(STAGE_ROLES.map(([role])=>[role,new TextEncoder().encode('synthetic-not-firmware-'+role)]));
 const descriptor={plan_id:'a'.repeat(32),plan_sha256:'b'.repeat(64),intent_sha256:'c'.repeat(64),
  files:Object.fromEntries(STAGE_ROLES.map(([role])=>[role,{size:contents[role].length,sha256:sha(contents[role])}]))};
 const calls=[];let opened=0,closed=0,transportClosed=0;
 const factory={openSync:async()=>{opened++;return {close:async()=>{closed++;if(badClose)throw Error('private close error');}};},
  pushV1:async options=>{
   const {file,...metadata}=options;calls.push(metadata);
   const reader=file.getReader();let bytes=[];
   try {while(true){const {value,done}=await reader.read();if(done)break;bytes.push(...value);}}finally{reader.releaseLock();}
   assert.deepEqual(new Uint8Array(bytes),contents[STAGE_ROLES[calls.length-1][0]]);
   if(badAck)throw Error('private SYNC error text');
  },closeTransport:async()=>{transportClosed++;}};
 return {sink:new BrowserStageFileSink(factory,descriptor),descriptor,contents,calls,
  get opened(){return opened;},get closed(){return closed;},get transportClosed(){return transportClosed;}};
}
{
 const f=fixture();
 for(const [role,leaf] of STAGE_ROLES) {
  const bytes=f.contents[role];
  assert.deepEqual(await f.sink.begin(role),{role,offset:0});
  await f.sink.append(role,0,bytes.slice(0,3));
  await f.sink.append(role,3,bytes.slice(3));
  assert.equal(f.opened,f.calls.length,'Buffering/hashing does not open another SYNC socket');
  assert.deepEqual(await f.sink.finish(role),{role,size:bytes.length,sha256:sha(bytes),wire_acknowledged:true});
  assert.equal(f.calls.at(-1).filename,'/data/.esphome-cgs1/'+leaf);
  assert.equal(f.calls.at(-1).permission,0o600);assert.equal(f.calls.at(-1).type,0o10);
  assert.equal(f.calls.at(-1).mtime,0);assert.equal(f.calls.at(-1).packetSize,65536);
 }
 assert.equal(f.opened,9);assert.equal(f.closed,9);
 await f.sink.close();await f.sink.close();assert.equal(f.transportClosed,1);
}
{
 const f=fixture(),role=STAGE_ROLES[0][0],bytes=f.contents[role];
 await f.sink.begin(role);await f.sink.append(role,0,new Uint8Array(bytes.length));
 await assert.rejects(f.sink.finish(role),{code:'usb_browser_stage_unverified'});
 assert.equal(f.opened,0);assert.equal(f.transportClosed,1);
 await assert.rejects(f.sink.begin(role));
}
for(const operation of ['duplicate','wrong-offset','wrong-role','path','oversized','incomplete']) {
 const f=fixture(),role=STAGE_ROLES[0][0];
 await f.sink.begin(role);
 let action;
 if(operation==='duplicate')action=()=>f.sink.begin(role);
 if(operation==='wrong-offset')action=()=>f.sink.append(role,1,new Uint8Array([1]));
 if(operation==='wrong-role')action=()=>f.sink.append(STAGE_ROLES[1][0],0,new Uint8Array([1]));
 if(operation==='path')action=()=>f.sink.append('/etc/passwd',0,new Uint8Array([1]));
 if(operation==='oversized')action=()=>f.sink.append(role,0,new Uint8Array(65537));
 if(operation==='incomplete')action=()=>f.sink.finish(role);
 await assert.rejects(action,{code:'usb_browser_stage_unverified'});
 assert.equal(f.opened,0);assert.equal(f.transportClosed,1);await f.sink.close();
}
for(const options of [{badAck:true},{badClose:true}]) {
 const f=fixture(options),role=STAGE_ROLES[0][0];
 await f.sink.begin(role);await f.sink.append(role,0,f.contents[role]);
 await assert.rejects(f.sink.finish(role),{code:'usb_browser_stage_unverified'});
 await assert.rejects(f.sink.begin(role));
 assert.equal(f.opened,1,'Lost wire/close ACK never permits a second push');assert.equal(f.transportClosed,1);
}
{
 let resolveOpen,lateClosed=0,transportClosed=0;
 const f=fixture();await f.sink.close();
 const sink=new BrowserStageFileSink({openSync:()=>new Promise(resolve=>{resolveOpen=resolve;}),
  pushV1:async()=>assert.fail('Late socket cannot write'),closeTransport:async()=>{transportClosed++;}},f.descriptor);
 const role=STAGE_ROLES[0][0];await sink.begin(role);await sink.append(role,0,f.contents[role]);
 const finishing=sink.finish(role);
 while(!resolveOpen)await new Promise(resolve=>setImmediate(resolve));
 await sink.close();resolveOpen({close:async()=>{lateClosed++;}});
 await assert.rejects(finishing,{code:'usb_browser_stage_unverified'});
 assert.equal(lateClosed,1);assert.equal(transportClosed,1);
}
console.log('Disabled-root file sink: fixed roles, bounded chunks, hash-before-SYNC, exact private modes, late close and no retry passed');
{
 const f=fixture();await f.sink.close();
 const noIO={openSync:async()=>assert.fail('Bad descriptor cannot open USB'),pushV1:async()=>assert.fail('Bad descriptor cannot write'),closeTransport:async()=>{}};
 for(const change of [{plan_id:['a'.repeat(32)]},{plan_sha256:1},{intent_sha256:'bad'},
   {files:{...f.descriptor.files,'/etc/passwd':{size:1,sha256:'e'.repeat(64)}}}])
  assert.throws(()=>new BrowserStageFileSink(noIO,{...f.descriptor,...change}));
}
{
 const f=fixture(),role=STAGE_ROLES[0][0],before=Date.now;
 try {
  await f.sink.begin(role);
  Date.now=()=>before()+240001;
  await assert.rejects(f.sink.append(role,0,f.contents[role]),{code:'usb_browser_stage_unverified'});
  assert.equal(f.opened,0);assert.equal(f.transportClosed,1);
 } finally {Date.now=before;await f.sink.close();}
}
