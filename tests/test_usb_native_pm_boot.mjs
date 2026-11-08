/** Actual Native/peer/session, emulated daemon and flag effects only. */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createNativeChannel} from '../custom_components/qingping_esphome/frontend/usb-probe-bundle.mjs';
import {BrowserChannelPeer} from '../custom_components/qingping_esphome/frontend/usb-channel-peer.mjs';
import {PmBootCommandStream,pmBootStreamService} from '../custom_components/qingping_esphome/frontend/usb-pm-boot-stream.mjs';
import {pmNextBootCommand} from '../custom_components/qingping_esphome/frontend/usb-pm-boot-commands.mjs';
import {fixedStdinFixture} from './fixtures/usb_fixed_stdin_socket.mjs';
import {selectedDisabledScope} from './fixtures/usb_disabled_scope.mjs';
const loaded=spawnSync('python3',['tests/fixtures/monitor1_browser_pm_packet.py'],{encoding:'utf8',maxBuffer:2**20,timeout:15000});
assert.equal(loaded.status,0,loaded.stderr);const original=JSON.parse(loaded.stdout);
async function selected(Native,options={}) {
 const p=structuredClone(original.packet),context=p.context,meta={...context.arming.context.meta,target:p.observation.scope.target};
 const map=new Map(original.reads.map(row=>[row.command,row.reply]));let armed=false,count=0;
 const bodies=await Promise.all(['arm','complete'].map(phase=>pmNextBootCommand(context,p.observation.scope,p.nonce,phase)));
 const raw=fixedStdinFixture(PmBootCommandStream,pmBootStreamService,{...options,onBody:body=>{
  if(body.includes('CGS1_FIXED_STDIN_READY'))return;
  assert.equal(body,bodies[count++].replace(/\n$/,''),'Only the full unchanged canonical PM body is sent');
  if(count===1)armed=true;
 }});
 const f={meta,openRaw:raw.openRaw,transportCloseLoss:options.transportCloseLoss,backend:{read:async command=>{
  assert.equal(armed,false,'No fictitious disabled-scope collector after PM flag effects');
  assert(map.has(command),'Only canonical original boot reads');return map.get(command);
 }}};
 const native=selectedDisabledScope(f,Native),peer=new BrowserChannelPeer(native.link);await native.link.selectForReview();
 // Selected-handle binding is tested here; the real actor/registry binding is
 // independently exercised in Python. No forged packet is recorded as real.
 p.channel_nonce=native.link.evidence().channel;let id=0;
 const call=(operation,data=null)=>peer.dispatch({id:(++id).toString(16).padStart(32,'0'),operation,data});
 return {p,native,raw,call,get count(){return count;}};
}
for(const Native of [undefined,createNativeChannel().constructor]) {
 const s=await selected(Native);
 assert.equal((await s.call('boot-observe',{context:s.p.context})).ok,true);
 assert.equal((await s.call('pm-stream-check')).ok,true);
 assert.equal((await s.call('pm-prepare',{packet:s.p})).ok,true);
 assert.equal((await s.call('pm-step',{phase:'arm'})).ok,true);
 assert.equal((await s.call('pm-step',{phase:'complete'})).ok,true);
 const done=await s.call('pm-complete');assert.equal(done.ok,true);
 assert.equal(done.data.after_effects_read_acknowledged,true);assert.equal(done.data.pm_next_boot_armed,true);
 assert.equal(done.data.transport_closed,true);assert.equal(done.data.channel_closed,false);
 assert.equal(s.count,2);assert.equal(s.native.closed,1);
 assert.equal((await s.call('channel-close')).ok,true);assert.equal(s.native.closed,1);
}
for(const options of [{writeLoss:true},{badOutput:true},{transportCloseLoss:true}]) {
 const s=await selected(undefined,options);
 assert.equal((await s.call('boot-observe',{context:s.p.context})).ok,true);
 assert.equal((await s.call('pm-stream-check')).ok,true);
 assert.equal((await s.call('pm-prepare',{packet:s.p})).ok,true);
 const arm=await s.call('pm-step',{phase:'arm'});
 if(options.transportCloseLoss) {
  assert.equal(arm.ok,true);assert.equal((await s.call('pm-step',{phase:'complete'})).ok,true);
  assert.equal((await s.call('pm-complete')).ok,false);
 } else assert.equal(arm.ok,false);
 assert.equal(s.native.closed,1);await assert.rejects(s.call('pm-step',{phase:'arm'}));
}
console.log('Raw/delivered PM observer/probe/packet/sealed writer/AFTER/owned-close pipeline PASS; emulated device only');
