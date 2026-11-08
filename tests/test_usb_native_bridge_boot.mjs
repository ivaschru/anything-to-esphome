/** Actual selected Native/peer/session, with synthetic raw daemon/state only. */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {BrowserChannelPeer} from '../custom_components/qingping_esphome/frontend/usb-channel-peer.mjs';
import {createNativeChannel} from '../custom_components/qingping_esphome/frontend/usb-probe-bundle.mjs';
import {BridgeBootCommandStream,bridgeBootStreamService} from '../custom_components/qingping_esphome/frontend/usb-bridge-boot-session.mjs';
import {bridgeNextBootCommand,bridgeBootCompletion} from '../custom_components/qingping_esphome/frontend/usb-bridge-boot-commands.mjs';
import {initialTrialContract} from '../custom_components/qingping_esphome/frontend/usb-initial-trial-contract.mjs';
import {fixedStdinFixture} from './fixtures/usb_fixed_stdin_socket.mjs';
import {disabledScopeFixture,selectedDisabledScope} from './fixtures/usb_disabled_scope.mjs';
const result=spawnSync('python3',['tests/fixtures/monitor1_browser_bridge_boot_packet.py'],{encoding:'utf8',maxBuffer:1024*1024,timeout:15000});
assert.equal(result.status,0,result.stderr);const original=JSON.parse(result.stdout);
const phases=['before','arm','armed','complete'];
async function selected(options={},Native=undefined) {
 const p=structuredClone(original.packet),meta=p.context.meta,marker=p.context.trial_marker;
 const pin=await bridgeBootCompletion(meta.descriptor.plan_id,p.plan_sha256,p.nonce);
 const before=disabledScopeFixture({meta,lock:true,patched:true,trialMarker:marker});
 const after=disabledScopeFixture({meta,lock:true,patched:true,trialMarker:marker,armed:true,armMarker:pin,
  armMarkerWrongHash:options.badCompletion});
 const bodies=await Promise.all(phases.map(phase=>bridgeNextBootCommand(meta,p.preparation.preparation.scope,p.nonce,phase)));
 let index=0,armed=false;
 const raw=fixedStdinFixture(BridgeBootCommandStream,bridgeBootStreamService,{...options,onBody:body=>{
  if(body.includes('CGS1_FIXED_STDIN_READY'))return;
  assert.equal(body,bodies[index].replace(/\n$/,''),'Only exact frozen commands traverse sealed stdin');
  if(phases[index]==='arm')armed=true;index++;
 }});
 const f={meta,openRaw:raw.openRaw,transportCloseLoss:options.transportCloseLoss,backend:{read:async command=>{
  const r=initialTrialContract.reads;
  if(command===r.absent_stores || command===r.tcp4 || command===r.tcp6)return '';
  if(command===r.process_scan)return '50';
  if(command===r.memory)return 'MemTotal: 131072 kB\nMemFree: 65536 kB';
  return await (armed?after:before).backend.read(command);
 }}};
 const native=selectedDisabledScope(f,Native),peer=new BrowserChannelPeer(native.link);
 const opening=native.link.selectForReview();assert.equal(native.picked,1);await opening;
 p.channel_nonce=native.link.evidence().channel;let counter=0;
 const call=(operation,data=null)=>peer.dispatch({id:(++counter).toString(16).padStart(32,'0'),operation,data});
 return {p,native,raw,call,get index(){return index;}};
}
for(const Native of [undefined,createNativeChannel().constructor]) {
 const f=await selected({},Native);
 assert.equal((await f.call('bridge-boot-stream-check')).ok,true);
 const read=await f.call('bridge-boot-preparation',{meta:f.p.context.meta,trial_marker:f.p.context.trial_marker});assert.equal(read.ok,true);
 assert.equal((await f.call('bridge-boot-prepare',{packet:f.p})).ok,true);
 for(const phase of phases)assert.equal((await f.call('bridge-boot-step',{phase})).ok,true);
 const done=await f.call('bridge-boot-complete');assert.equal(done.ok,true);
 assert.equal(done.data.transport_closed,true);assert.equal(done.data.channel_closed,false);
 assert.deepEqual(done.data.armed_scope.boot_flags,{bridge_disabled:false,recovery_backup:true,pm_disabled:true});
 assert.equal(f.native.closed,1);assert.equal(f.index,4);assert.equal(f.raw.records.length,5);
 assert.equal((await f.call('channel-close')).ok,true);assert.equal(f.native.closed,1);
}
for(const options of [{badCompletion:true},{transportCloseLoss:true}]) {
 const f=await selected(options);assert.equal((await f.call('bridge-boot-stream-check')).ok,true);
 assert.equal((await f.call('bridge-boot-prepare',{packet:f.p})).ok,true);
 for(const phase of phases)assert.equal((await f.call('bridge-boot-step',{phase})).ok,true);
 assert.equal((await f.call('bridge-boot-complete')).ok,false);assert.equal(f.native.closed,1);
 await assert.rejects(f.call('bridge-boot-step',{phase:'arm'}));assert.equal(f.raw.records.length,5);
}
for(const operation of ['bridge-boot-prepare','bridge-boot-step','bridge-boot-complete']) {
 const f=await selected();const data=operation==='bridge-boot-prepare'?{packet:f.p}:operation==='bridge-boot-step'?{phase:'arm'}:null;
 assert.equal((await f.call(operation,data)).ok,false);assert.equal(f.native.closed,1);assert.equal(f.raw.records.length,0);
}
console.log('Raw/delivered original selected arming pipeline: exact sealed guards, explicit readback, actual close, separate ACK and no-replay refusals PASS; no device IO');
