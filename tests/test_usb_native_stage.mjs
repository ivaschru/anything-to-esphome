/** Actual selected NativeChannel composed with its fixed stage engine.
 * All device IO is emulated; no shell is executed or monitor is connected.
 * The independent Tango fixture checks the real encoder below this adapter.
 */
import assert from 'node:assert/strict';
import {BrowserNativeChannel} from '../custom_components/qingping_esphome/frontend/usb-native-channel.mjs';
import {contract} from '../custom_components/qingping_esphome/frontend/usb-probe-contract.mjs';
import {BrowserChannelPeer} from '../custom_components/qingping_esphome/frontend/usb-channel-peer.mjs';
import {STAGE_ROLES} from '../custom_components/qingping_esphome/frontend/usb-stage-files.mjs';
import {fixture as stageFixture} from './test_usb_stage_session.mjs';
function fixture(options={}) {
 const f=stageFixture({...options,withoutSession:true});
 const scope={uid:'0',wlan_mac:f.packet.target.wlan_mac,version:'CLEARGRASS_VERSION=4.1.8_0287',arch:'armv7l',
  co2_type:String(f.packet.target.co2_type),boot_id:f.packet.target.boot_id};
 const state={closed:0,changed:false,sync:0,picker:0};
 const client={close:async()=>{state.closed++;await f.backend.closeTransport();},createSocket:async service=>{
  if(service==='sync:') {state.sync++;return f.backend.openSync();}
  assert(service.startsWith('shell:set -e\n'),'No API or generic service may be opened during stage');
  const marker=service.match(/__CGS1_CHANNEL_OK_[a-f0-9]+__/)[0];
  const command=service.slice('shell:set -e\n'.length,service.lastIndexOf('\nprintf '));
  let result;
  const identity=contract.identity.find(step=>step.command===command),file=contract.files.find(file=>file.command===command);
  if(identity)result=scope[identity.name];
  else if(file)result=state.changed?'foreign-source':file.expected.replace(file.sha256+' '+file.path,file.sha256+'  '+file.path);
  else if(command===contract.absent_install) {assert(!f.root,'Factory absence is only observed before root creation');result='';}
  else if(command==="stat -f -c '%t %a %S' /data")result=options.noSpace?'ef53 1 4096':'ef53 10000 4096';
  else result=await f.backend.read(command);
  return {readable:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(result+'\n'+marker+'\n'));c.close();}}),close:async()=>{}};
 }};
 const library={manager:{requestDevice:()=>{state.picker++;return Promise.resolve({serial:f.packet.target.usb_serial,connect:async()=>({})});}},
  authenticate:async()=>({}),createClient:()=>client,ephemeralCredentials:()=>({}),
  createSyncSocket:socket=>socket,pushV1:f.backend.pushV1};
 return Object.assign(f,{state,link:new BrowserNativeChannel(library,contract)});
}
async function transfer(f) {
 for(const [role] of STAGE_ROLES) {
  await f.link.stageBeginFile(role);await f.link.stageAppend(role,0,f.contents[role]);await f.link.stageFinishFile(role);
 }
}
{
 const f=fixture();await f.link.select();
 assert.deepEqual(await f.link.beginStage(f.packet,f.stock),{state:'disabled_root_created'});
 assert(f.root);assert.equal(f.state.sync,0);
 await assert.rejects(f.link.openApi());await assert.rejects(f.link.checkInitialScope());
 await transfer(f);const proof=await f.link.finishStage();
 assert.equal(f.state.picker,1);assert.equal(f.state.sync,9);assert.equal(f.state.closed,1);
 assert.equal(proof.transport_closed,true);assert.equal(proof.vendor_files_changed,false);assert.equal(proof.program_started,false);
 assert.deepEqual(proof.stock_files,f.stock);assert(f.complete);
 await assert.rejects(f.link.beginStage(f.packet,f.stock));await assert.rejects(f.link.stageBeginFile(STAGE_ROLES[0][0]));
 await f.link.close();assert.equal(f.state.closed,1);
}
for(const options of [{noSpace:true},{lostRootAck:true}]) {
 const f=fixture(options);await f.link.select();
 await assert.rejects(f.link.beginStage(f.packet,f.stock));
 assert.equal(f.state.sync,0);assert.equal(f.state.closed,1);assert.equal(f.complete,false);
 await assert.rejects(f.link.beginStage(f.packet,f.stock));
 assert.equal(f.calls.filter(c=>c==='create').length,options.lostRootAck?1:0);
}
for(const changed of ['target','stock']) {
 const f=fixture();await f.link.select();
 if(changed==='target')f.packet.target.boot_id='33333333-3333-3333-3333-333333333333';
 else f.stock[contract.files[0].path].sha256='e'.repeat(64);
 await assert.rejects(f.link.beginStage(f.packet,f.stock));
 assert.equal(f.root,false);assert.equal(f.state.closed,1);assert.equal(f.state.sync,0);
}
for(const options of [{lostPushAck:true},{badRemoteHash:true},{badClose:true}]) {
 const f=fixture(options);await f.link.select();await f.link.beginStage(f.packet,f.stock);
 await assert.rejects(async()=>{await transfer(f);await f.link.finishStage();});
 assert.equal(f.state.closed,1);assert.equal(f.complete,Boolean(options.badClose));
 const before=f.state.sync;await assert.rejects(f.link.stageFinishFile(STAGE_ROLES[0][0]));assert.equal(f.state.sync,before);
}
{
 const f=fixture();await f.link.select();await f.link.beginStage(f.packet,f.stock);await transfer(f);f.state.changed=true;
 await assert.rejects(f.link.finishStage());assert.equal(f.complete,false);assert.equal(f.state.closed,1);
}
console.log('Selected native stage: fixed live source/space/role writes, independent readback, close ACK, lost ACK fencing and no API/replay passed');

{
 const f=fixture();await f.link.select();const peer=new BrowserChannelPeer(f.link);let sequence=0;
 const call=async(operation,data=null)=>{
  const result=await peer.dispatch({id:(++sequence).toString(16).padStart(32,'0'),operation,data});
  assert.equal(result.ok,true);return result.data;
 };
 assert.deepEqual(await call('stage-prepare',{packet:f.packet,stock_files:f.stock}),{state:'disabled_root_created'});
 for(const [role] of STAGE_ROLES) {
  await call('stage-file-begin',{role});
  const body=f.contents[role];
  await call('stage-chunk',{role,offset:0,body:Buffer.from(body).toString('base64')});
  await call('stage-file-finish',{role});
 }
 const proof=await call('stage-complete');assert.equal(proof.transport_closed,true);
 assert.equal(await call('channel-close'),null);assert.equal(f.state.closed,1);assert.equal(f.state.sync,9);
}
{
 const f=fixture();await f.link.select();const peer=new BrowserChannelPeer(f.link);
 assert.equal((await peer.dispatch({id:'1'.repeat(32),operation:'stage-prepare',data:{packet:f.packet,stock_files:f.stock}})).ok,true);
 const rejected=await peer.dispatch({id:'2'.repeat(32),operation:'stage-chunk',
  data:{role:STAGE_ROLES[0][0],offset:0,body:'eA==',path:'/data/other'}});
 assert.equal(rejected.ok,false);assert.equal(f.state.sync,0);assert.equal(f.state.closed,1);
 await peer.close();assert.equal(f.state.closed,1);
}
console.log('Finite peer through selected NativeChannel: complete fixed stage and malformed path refusal passed');
