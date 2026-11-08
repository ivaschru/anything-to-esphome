/** Fixed sealed stream/session and root journal DTO parity; no shell/device. */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fixedStdinFixture} from './fixtures/usb_fixed_stdin_socket.mjs';
import {BridgeBootCommandStream,BrowserBridgeBootSession,bridgeBootStreamService} from '../custom_components/qingping_esphome/frontend/usb-bridge-boot-session.mjs';
const result=spawnSync('python3',['tests/fixtures/monitor1_browser_bridge_boot_packet.py'],{encoding:'utf8',maxBuffer:1024*1024,timeout:15000});
assert.equal(result.status,0,result.stderr);const original=JSON.parse(result.stdout);
const phases=['before','arm','armed','complete'];
async function fixture(options={}) {
 const f=fixedStdinFixture(BridgeBootCommandStream,bridgeBootStreamService,options);
 await f.stream.probe();const packet=structuredClone(original.packet),proof=structuredClone(original.proof);
 let identities=0,preparations=0,armedReads=0;
 const session=new BrowserBridgeBootSession({
  identity:async target=>{identities++;assert.deepEqual(target,original.packet.context.meta.target);return !options.badIdentity;},
  preparation:async(meta,marker)=>{preparations++;assert.deepEqual(meta,original.packet.context.meta);assert.deepEqual(marker,original.packet.context.trial_marker);return structuredClone(packet.preparation);},
  armed:async(meta,marker,pin)=>{armedReads++;assert.deepEqual(pin,proof.armed_scope.arm_marker);const value=structuredClone(proof.armed_scope);
   if(options.badArmedRoot)value.root_identity[1]++;return value;},
  closeTransport:()=>f.stream.close(),
 },f.stream,packet);
 return {...f,session,packet,proof,get identities(){return identities;},get preparations(){return preparations;},get armedReads(){return armedReads;},get retired(){return f.retired;}};
}
{
 const f=await fixture();await f.session.prepare();
 for(const phase of phases)assert.deepEqual(await f.session.step(phase),{phase,completed:true});
 const proof=await f.session.finish();
 assert.equal(proof.transport_closed,true);assert.equal(proof.channel_closed,false,'Core must await its separate channel ACK');
 assert.deepEqual({...proof,channel_closed:true},f.proof,'Same actual actor journal proof DTO, excluding the still-independent channel ACK');
 assert.equal(f.preparations,1);assert.equal(f.armedReads,1);assert.equal(f.records.length,5);assert.equal(f.retired,1);
 assert(f.records[2].body.includes(': > /data/.esphome-cgs1/disabled.before-next-boot'));
 assert(f.records[2].body.indexOf('disabled.before-next-boot')<f.records[2].body.indexOf('\nrm /data/.esphome-cgs1/disabled\n'));
 assert(f.records.every(r=>r.closed===1));
 await assert.rejects(f.session.step('arm'));await assert.rejects(f.session.finish());assert.equal(f.records.length,5);
}
{
 const f=await fixture();await f.session.prepare();await assert.rejects(f.session.step('arm'));
 assert.equal(f.records.length,1,'A phase cannot skip the independent fixed before guard');assert.equal(f.retired,1);
}
for(const options of [{writeLoss:true},{badOutput:true}]) {
 const f=await fixture(options);await f.session.prepare();await assert.rejects(f.session.step('before'));
 await assert.rejects(f.session.step('before'));assert.equal(f.records.length,2);assert.equal(f.retired,1);
}
{
 const f=await fixture({badArmedRoot:true});await f.session.prepare();for(const phase of phases)await f.session.step(phase);
 await assert.rejects(f.session.finish());assert.equal(f.retired,1);
}
{
 const f=await fixture({badIdentity:true});await assert.rejects(f.session.prepare());assert.equal(f.records.length,1);assert.equal(f.retired,1);
}
console.log('Sealed bounded arming phases, independent explicit armed readback, close, actor DTO and no-replay refusals PASS; no device IO');
