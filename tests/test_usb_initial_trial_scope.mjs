/** Real selected NativeChannel/peer and fixed collectors; emulated reads only. */
import assert from 'node:assert/strict';
import {BrowserChannelPeer} from '../custom_components/qingping_esphome/frontend/usb-channel-peer.mjs';
import {createNativeChannel} from '../custom_components/qingping_esphome/frontend/usb-probe-bundle.mjs';
import {initialTrialContract as initial} from '../custom_components/qingping_esphome/frontend/usb-initial-trial-contract.mjs';
import {disabledContract} from '../custom_components/qingping_esphome/frontend/usb-disabled-contract.mjs';
import {disabledTransport} from './fixtures/usb_disabled_transport.mjs';

const normal=command=>command===initial.reads.memory?'MemTotal: 131072 kB\nMemFree: 65536 kB':
 command===initial.reads.process_scan?'50':'';
async function selected(options={},Native=undefined) {
 const fixture=disabledTransport({committed:true,...options},Native),peer=new BrowserChannelPeer(fixture.link);let id=0;
 const opening=fixture.link.selectForReview();assert.equal(fixture.picked,1);await opening;
 const meta={...fixture.meta,commit_nonce:fixture.packet().nonce};
 return {fixture,meta,call:(operation,data=null)=>peer.dispatch({id:(++id).toString(16).padStart(32,'0'),operation,data})};
}
for(const Native of [undefined,createNativeChannel().constructor]) {
 let memoryReads=0;
 const f=await selected({initialRead:command=>command===initial.reads.memory?
  `MemTotal: 131072 kB\nMemFree: ${++memoryReads===1?65536:49152} kB`:normal(command)},Native);
 const answer=await f.call('initial-trial-preparation',{meta:f.meta});assert.equal(answer.ok,true);
 assert.equal(answer.data.ram_available_bytes,49152*1024);assert.equal(answer.data.memory_basis,'MemFree_lower_bound');
 assert.equal(answer.data.scope.commit_nonce,f.meta.commit_nonce);
 for(const [path,pin] of Object.entries(disabledContract.patched))assert.equal(new Map(answer.data.scope.vendor_hashes).get(path),pin.sha256);
 for(const key of ['ram_scope_checked','image_fd_admitted','execution_authority'])assert.equal(answer.data[key],false);
 assert.equal(answer.data.device_writes,0);assert.equal(f.fixture.rawBodies.length,0);assert.equal(f.fixture.effects,3);
 for(const read of Object.values(initial.reads))assert.equal(f.fixture.readCommands.filter(v=>v===read).length,2);
 assert.equal((await f.call('channel-close')).ok,true);assert.equal(f.fixture.closed,1);
}
const malformedMemory=['MemAvailable: 65536 kB','MemTotal: 131072 kB\nMemFree: 32767 kB',
 'MemTotal: 131072 kB\nMemFree: 65536 kB\nMemFree: 65536 kB',
 'MemTotal: 32768 kB\nMemFree: 65536 kB','MemTotal: 999999999999999999999999 kB\nMemFree: 65536 kB',
 'MemTotal: 131072 kB\nMemFree: 65536 bytes','MemTotal: 131072 kB\n\nMemFree: 65536 kB'];
for(const text of malformedMemory) {
 const f=await selected({initialRead:command=>command===initial.reads.memory?text:normal(command)});
 assert.equal((await f.call('initial-trial-preparation',{meta:f.meta})).ok,false);
 assert.equal(f.fixture.closed,1);assert.equal(f.fixture.rawBodies.length,0);assert.equal(f.fixture.effects,3);
}
for(const name of ['absent_stores','process_scan','tcp4','tcp6']) {
 for(const ioFailure of [false,true]) {
  const f=await selected({initialRead:command=>{
   if(command===initial.reads[name]){if(ioFailure)throw Error('synthetic failed read');return 'unverified';}return normal(command);
  }});
  assert.equal((await f.call('initial-trial-preparation',{meta:f.meta})).ok,false);
  assert.equal(f.fixture.closed,1);assert.equal(f.fixture.rawBodies.length,0);
 }
}
{
 // Drift occurs BETWEEN complete scopes, not inside the existing collector's
 // already-tested own two-pass read. Stable files alone cannot adopt a root.
 const options={committed:true};let memoryReads=0;
 options.initialRead=command=>{if(command===initial.reads.memory && ++memoryReads===1)options.changedRootAfter=1;return normal(command);};
 const fixture=disabledTransport(options),peer=new BrowserChannelPeer(fixture.link);
 await fixture.link.selectForReview();const meta={...fixture.meta,commit_nonce:fixture.packet().nonce};
 const result=await peer.dispatch({id:'1'.repeat(32),operation:'initial-trial-preparation',data:{meta}});
 assert.equal(result.ok,false);assert.equal(fixture.closed,1);assert.equal(fixture.rawBodies.length,0);
}
for(const delta of [{commit_nonce:null},{commit_nonce:'bad'}]) {
 const f=await selected();assert.equal((await f.call('initial-trial-preparation',{meta:{...f.meta,...delta}})).ok,false);
 assert.equal(f.fixture.closed,1);assert.equal(f.fixture.rawBodies.length,0);
}
for(const initialEffects of [0,1,2]) {
 const fixture=disabledTransport({initialEffects}),peer=new BrowserChannelPeer(fixture.link);
 await fixture.link.selectForReview();const meta={...fixture.meta,commit_nonce:fixture.packet().nonce};
 const result=await peer.dispatch({id:'2'.repeat(32),operation:'initial-trial-preparation',data:{meta}});
 assert.equal(result.ok,false,'Factory/partial scripts are not a terminal disabled commit');assert.equal(fixture.closed,1);
}
{
 const f=await selected();assert.equal((await f.call('initial-trial-preparation',{meta:f.meta,command:'not admitted'})).ok,false);
 assert.equal(f.fixture.rawBodies.length,0);assert.equal(f.fixture.closed,1);
}
console.log('Selected first-trial preparation: two committed scopes, positive stores/process/TCP, conservative MemFree, drift/failure refusal and delivered bundle passed; no RAM allocation, upload, launch or hardware');
