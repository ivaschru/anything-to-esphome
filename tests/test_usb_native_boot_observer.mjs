/** Raw/delivered selected Native+peer; synthetic fixed replies, no USB device. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createNativeChannel} from '../custom_components/qingping_esphome/frontend/usb-probe-bundle.mjs';
import {BrowserChannelPeer} from '../custom_components/qingping_esphome/frontend/usb-channel-peer.mjs';
import {selectedDisabledScope,disabledScopeFixture} from './fixtures/usb_disabled_scope.mjs';
import {bridgeBootCompletion} from '../custom_components/qingping_esphome/frontend/usb-bridge-boot-commands.mjs';
const f=JSON.parse(execFileSync('python3',['tests/fixtures/monitor1_browser_boot_observer.py'],{encoding:'utf8',maxBuffer:2**20}));
async function selected(Native,options={}) {
 const context=structuredClone(f.context),old=context.arming.context.meta;
 const target=options.waiting?old.target:f.target,meta={...old,target};
 const pin=await bridgeBootCompletion(old.descriptor.plan_id,context.plan_sha256,context.arming.nonce);
 const idle=disabledScopeFixture({meta,patched:true,lock:true,armed:true,trialMarker:context.arming.context.trial_marker,armMarker:pin});
 const commands=new Map(f.reads.map(row=>[row.command,row]));let reads=0;
 const native=selectedDisabledScope({meta,transportCloseLoss:options.closeLoss,backend:{read:async command=>{
  reads++;
  if(options.waiting)return idle.backend.read(command);
  const row=commands.get(command);assert(row,'Only exact canonical fixed commands');
  if(options.badImage && row.key==='child_image')return row.reply.replace('700 0 1','777 0 1');
  return row.reply;
 }}},Native);
 const peer=new BrowserChannelPeer(native.link);await native.link.selectForReview();let id=0;
 return {native,context,call:(operation,data=null)=>peer.dispatch({id:(++id).toString(16).padStart(32,'0'),operation,data}),get reads(){return reads;}};
}
for(const Native of [undefined,createNativeChannel().constructor]) {
 const s=await selected(Native);
 const first=await s.call('boot-observe',{context:s.context});assert.equal(first.ok,true);assert.equal(first.data.kind,'browser_bridge_boot_runtime_scope');
 const count=s.reads;const second=await s.call('boot-observe',{context:s.context});assert.equal(second.ok,true);assert(s.reads>=count*2);
 assert.equal((await s.call('channel-close')).ok,true);assert.equal(s.native.closed,1);
 const waiting=await selected(Native,{waiting:true});
 const result=await waiting.call('boot-observe',{context:waiting.context});assert.equal(result.ok,true);assert.equal(result.data.kind,'browser_bridge_boot_waiting');
 assert.equal((await waiting.call('api-open')).ok,false);assert.equal(waiting.native.closed,1,'Waiting scope cannot open an API');
}
for(const options of [{badImage:true},{closeLoss:true}]) {
 const s=await selected(undefined,options);const first=await s.call('boot-observe',{context:s.context});
 if(options.badImage)assert.equal(first.ok,false);
 else {assert.equal(first.ok,true);assert.equal((await s.call('channel-close')).ok,false);}
 assert.equal(s.native.closed,1);
}
const reserved=await selected();assert.equal((await reserved.call('boot-observe',{context:reserved.context})).ok,true);
assert.equal((await reserved.call('bridge-boot-stream-check')).ok,false);assert.equal(reserved.native.closed,1);
console.log('Selected raw/delivered boot observer, idle branch, writer/API fencing and owned close PASS');
