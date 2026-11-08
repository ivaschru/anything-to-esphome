/** Synthetic selected-handle backend only. The separate Linux/root fixture
 * exercises the generated shell after rewriting every production path.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {BrowserStageSession,stageCommands} from '../custom_components/qingping_esphome/frontend/usb-stage-session.mjs';
import {STAGE_ROLES} from '../custom_components/qingping_esphome/frontend/usb-stage-files.mjs';
import {contract} from '../custom_components/qingping_esphome/frontend/usb-probe-contract.mjs';
const base='/data/.esphome-cgs1',sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(options={}) {
 const contents=Object.fromEntries(STAGE_ROLES.map(([role])=>[role,new TextEncoder().encode('synthetic-not-firmware-'+role)]));
 const descriptor={plan_id:'a'.repeat(32),plan_sha256:'b'.repeat(64),intent_sha256:'c'.repeat(64),
  files:Object.fromEntries(STAGE_ROLES.map(([role])=>[role,{size:contents[role].length,sha256:sha(contents[role])}]))};
 const target={kind:'browser_webusb',wlan_mac:'02:00:00:00:00:01',co2_type:2,stock_version:'4.1.8_0287',
  usb_serial:'synthetic-usb',boot_id:'22222222-2222-2222-2222-222222222222'};
 const packet={schema_version:1,job_id:'d'.repeat(32),target,descriptor,requested_data_free_bytes:24000000};
 const stock=Object.fromEntries(contract.files.map(file=>[file.path,{size:file.size,sha256:file.sha256}]));
 const commands=stageCommands(descriptor,target.boot_id),files=new Map(),calls=[];
 let root=false,complete=false,closed=0,opens=0,inventory=0,releaseInitial;
 function guard(){assert(root,'No file may be staged outside the created private disabled root');}
 const backend={initial:async(given,free)=>{
    calls.push('initial');assert.deepEqual(given,target);assert.equal(free,packet.requested_data_free_bytes);
    if(options.pendingInitial)return new Promise(resolve=>{releaseInitial=resolve;});
    return options.badInitial!==true;
  },identity:async given=>{assert.deepEqual(given,target);return options.badIdentity!==true;},
  inventory:async()=>{inventory++;return !options.badInventory;},
  read:async command=>{
   const plain=command.startsWith('set -eu\numask 077\n')?command.slice('set -eu\numask 077\n'.length):command;
   if(plain===commands.create) {
    assert(!root,'Root creation cannot overwrite/adopt an old root');root=true;calls.push('create');
    if(options.lostRootAck)throw Error('synthetic private root error');
    return '';
   }
   guard();
   if(plain===commands.guard)return '';
   for(const [role,leaf] of STAGE_ROLES) {
    const remote=base+'/'+leaf;
    if(plain===commands.precreate(role)) {assert(!files.has(remote));files.set(remote,{body:new Uint8Array(),mode:'600'});calls.push('precreate:'+role);return '';}
    if(plain===commands.setMode(role)) {assert(files.has(remote));files.get(remote).mode=['bridge-program','launch.sh','SnowApp-with-PM'].includes(role)?'700':'600';calls.push('chmod:'+role);return '';}
    if(plain===commands.inspect(role)) {
     const file=files.get(remote);assert(file);
     return `${file.body.length} 1 0 ${file.mode}\n${options.badRemoteHash?'e'.repeat(64):sha(file.body)}${options.doubleSpace?'  ':' '}${remote}`;
    }
   }
   if(plain===commands.complete) {assert(!complete);assert.equal(files.size,9);complete=true;calls.push('complete');return '';}
   if(plain===commands.inspectComplete) {assert(complete);return sha(commands.afterBytes)+(options.doubleSpace?'  ':' ')+'/data/.esphome-cgs1-stage/complete';}
   assert.fail('Unknown command in fixed stage sequence');
  },openSync:async()=>{guard();opens++;return {close:async()=>{calls.push('sync-close');}};},
  pushV1:async({filename,file})=>{
   guard();assert(files.has(filename),'Precreate must precede any SYNC write');
   calls.push('push:'+filename);const reader=file.getReader();const blocks=[];
   try {while(true){const {value,done}=await reader.read();if(done)break;blocks.push(Buffer.from(value));}}finally{reader.releaseLock();}
   files.get(filename).body=new Uint8Array(Buffer.concat(blocks));
   if(options.lostPushAck)throw Error('synthetic private wire error');
  },closeTransport:async()=>{closed++;if(options.badClose)throw Error('synthetic private close error');}};
 const session=new BrowserStageSession(backend,packet,stock);
 return {session,contents,packet,commands,stock,calls,files,get root(){return root;},get complete(){return complete;},
  get closed(){return closed;},get opens(){return opens;},get inventory(){return inventory;},get releaseInitial(){return releaseInitial;}};
}
async function transfer(f) {
 for(const [role] of STAGE_ROLES) {
  await f.session.begin(role);await f.session.append(role,0,f.contents[role]);await f.session.finishFile(role);
 }
}
{
 const f=fixture();await f.session.prepare();assert(f.root);assert.equal(f.opens,0);
 await transfer(f);const proof=await f.session.finish();
 assert.equal(f.opens,9);assert.equal(f.closed,1);assert.equal(f.inventory,2);assert(f.complete);
 assert.equal(proof.transport_closed,true);assert.equal(proof.vendor_files_changed,false);assert.equal(proof.program_started,false);
 assert.deepEqual(proof.files,f.packet.descriptor.files);assert.deepEqual(proof.stock_files,f.stock);
 assert.equal(proof.after_effects_sha256,sha(f.commands.afterBytes));
 assert.equal(f.calls.filter(value=>value==='complete').length,1);
 await assert.rejects(f.session.prepare());await assert.rejects(f.session.begin('bridge-program'));
 assert.equal(f.opens,9);assert.equal(f.closed,1);
}
for(const options of [{badInitial:true},{lostRootAck:true}]) {
 const f=fixture(options);await assert.rejects(f.session.prepare(),{code:'usb_browser_stage_unverified'});
 assert.equal(f.opens,0);assert.equal(f.closed,1);assert.equal(f.complete,false);
 await assert.rejects(f.session.prepare());assert.equal(f.calls.filter(value=>value==='create').length,options.lostRootAck?1:0);
}
for(const options of [{lostPushAck:true},{badRemoteHash:true}]) {
 const f=fixture(options);await f.session.prepare();const role=STAGE_ROLES[0][0];
 await f.session.begin(role);await f.session.append(role,0,f.contents[role]);
 await assert.rejects(f.session.finishFile(role),{code:'usb_browser_stage_unverified'});
 assert.equal(f.opens,1);assert.equal(f.closed,1);assert.equal(f.complete,false);
 await assert.rejects(f.session.begin(role));assert.equal(f.opens,1);
}
for(const options of [{badInventory:true},{badClose:true}]) {
 const f=fixture(options);await f.session.prepare();await transfer(f);
 await assert.rejects(f.session.finish(),{code:'usb_browser_stage_unverified'});
 assert.equal(f.closed,1);assert.equal(f.complete,Boolean(options.badClose));
 assert.equal(f.opens,9);
}
{
 const f=fixture({pendingInitial:true});const pending=f.session.prepare();
 await f.session.close();f.releaseInitial(true);
 await assert.rejects(pending,{code:'usb_browser_stage_unverified'});
 assert.equal(f.root,false,'Late initial read after retirement cannot create a root');assert.equal(f.closed,1);
}
for(const change of [{plan_id:"'; arbitrary"},{plan_sha256:'bad'},{intent_sha256:['c'.repeat(64)]}])
 assert.throws(()=>stageCommands({plan_id:'a'.repeat(32),plan_sha256:'b'.repeat(64),intent_sha256:'c'.repeat(64),...change},'22222222-2222-2222-2222-222222222222'));
console.log('Fixed disabled stage session: root/opt-outs before SYNC, remote hash/mode, AFTER-effects, actual close gate and no replay passed');

{
 const f=fixture({doubleSpace:true});await f.session.prepare();await transfer(f);
 assert.equal((await f.session.finish()).transport_closed,true);assert.equal(f.closed,1);
}
