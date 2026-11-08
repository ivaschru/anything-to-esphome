/** Real selected peer/collector with emulated fixed reads, no shell/device IO. */
import assert from 'node:assert/strict';
import {collectDisabledScope,collectStoppedTrialScope} from '../custom_components/qingping_esphome/frontend/usb-disabled-scope.mjs';
import {initialTrialContract} from '../custom_components/qingping_esphome/frontend/usb-initial-trial-contract.mjs';
import {BrowserChannelPeer} from '../custom_components/qingping_esphome/frontend/usb-channel-peer.mjs';
import {createNativeChannel} from '../custom_components/qingping_esphome/frontend/usb-probe-bundle.mjs';
import {disabledScopeFixture,selectedDisabledScope} from './fixtures/usb_disabled_scope.mjs';
const marker={size:420,sha256:'a'.repeat(64)};
function fixture(options={}) {
 const f=disabledScopeFixture({lock:true,patched:true,trialMarker:marker,...options});
 const read=f.backend.read;
 f.backend.read=async command=>{
  const r=initialTrialContract.reads;
  if(command===r.absent_stores || command===r.tcp4 || command===r.tcp6)return '';
  if(command===r.process_scan)return '50';
  if(command===r.memory)return 'MemTotal: 131072 kB\nMemFree: 65536 kB';
  return await read(command);
 };
 return f;
}
{
 const f=fixture();
 const result=await collectStoppedTrialScope(f.backend,f.meta,marker);
 assert.equal(result.kind,'browser_disabled_scope');assert.deepEqual(result.root_identity,[1,2]);
 assert.equal(f.calls.filter(c=>c.includes('/initial-trial.intent')).length,2,'Both independent root passes verify the exact persistent marker');
 assert(!f.calls.some(c=>/(^|\n)(?:rm |mkdir |chmod |kill |reboot|exec |sync(?:\n|$))/.test(c)));
}
// The ordinary collector is intentionally unchanged: it must not treat a
// trial marker as an optional ignored file before a separate stopped basis.
{
 const f=fixture();await assert.rejects(collectDisabledScope(f.backend,f.meta));
}
for(const option of ['missingTrialEntry','extraRoot','markerReadError','markerBadMode','markerWrongHash','markerChanged','changedRoot','changedBirth','failedMaps']) {
 const f=fixture({[option]:true});
 await assert.rejects(collectStoppedTrialScope(f.backend,f.meta,marker),e=>e.code==='usb_browser_scope_unverified');
}
for(const value of [null,{...marker,path:'/other'}, {...marker,size:true},{...marker,size:0},{...marker,size:4097},{...marker,sha256:"'; reboot"}]) {
 const f=fixture();await assert.rejects(collectStoppedTrialScope(f.backend,f.meta,value));assert.equal(f.calls.length,0);
}
for(const Native of [undefined,createNativeChannel().constructor]) {
 const f=fixture(),native=selectedDisabledScope(f,Native),peer=new BrowserChannelPeer(native.link);
 await native.link.selectForReview();
 const result=await peer.dispatch({id:'1'.repeat(32),operation:'bridge-boot-preparation',data:{meta:f.meta,trial_marker:marker}});
 assert.equal(result.ok,true);assert.equal(result.data.kind,'browser_bridge_boot_preparation');
 assert.equal(result.data.trial_marker_checked,true);assert.deepEqual(result.data.trial_marker,marker);
 assert.equal(result.data.preparation.persistent_stores_absent,true);
 assert.equal(result.data.preparation.ram_available_bytes,64*1024**2);
 assert.equal(native.closed,0,'A fresh read is separate from actual transport closure');
 assert.equal((await peer.dispatch({id:'2'.repeat(32),operation:'channel-close',data:null})).ok,true);
 assert.equal(native.closed,1);
}
{
 const f=fixture({markerWrongHash:true}),native=selectedDisabledScope(f),peer=new BrowserChannelPeer(native.link);
 await native.link.selectForReview();
 assert.equal((await peer.dispatch({id:'1'.repeat(32),operation:'bridge-boot-preparation',data:{meta:f.meta,trial_marker:marker}})).ok,false);
 assert.equal(native.closed,1);
}
console.log('Stopped-trial marker: strict fixed reads, two-pass continuity, ordinary-root fence and raw/delivered selected peer PASS; no writer');
