/** Fixed staged-scope collector, entirely emulated IO; no shell/device. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {BrowserNativeChannel} from '../custom_components/qingping_esphome/frontend/usb-native-channel.mjs';
import {BrowserChannelPeer} from '../custom_components/qingping_esphome/frontend/usb-channel-peer.mjs';
import {collectDisabledScope,disabledScopeCommands} from '../custom_components/qingping_esphome/frontend/usb-disabled-scope.mjs';
import {disabledContract} from '../custom_components/qingping_esphome/frontend/usb-disabled-contract.mjs';
import {contract} from '../custom_components/qingping_esphome/frontend/usb-probe-contract.mjs';
import {STAGE_ROLES} from '../custom_components/qingping_esphome/frontend/usb-stage-files.mjs';
import {disabledScopeFixture as fixture,selectedDisabledScope as selected} from './fixtures/usb_disabled_scope.mjs';
for(const options of [{},{lock:true},{patched:true}]) {
 const f=fixture(options),result=await collectDisabledScope(f.backend,f.meta);
 assert.equal(result.kind,'browser_disabled_scope');assert.deepEqual(result.target,f.meta.target);
 assert.deepEqual(result.root_identity,[1,2]);assert.deepEqual(result.stock_process,[50,100,contract.files[0].sha256,0]);
 assert.deepEqual(result.watchdog_process,[51,110,0]);assert.equal(result.own_code_running,false);assert.equal(result.pm_helper_loaded,false);
 assert.equal(result.same_filesystem,true);assert.equal(result.data_available_bytes,40960000);assert.equal(f.identities,2);
 assert.equal(result.commit_nonce,f.meta.commit_nonce);
 assert(!('usb_transport' in result.target));assert(!('writer_enabled' in result));
 assert(!f.calls.some(call=>/(^|\n)(?:cp |mv |chmod |mkdir |rm |kill |reboot|sync(?:\n|$))/.test(call)),'Collector must contain no device write/launch/signal');
}
for(const flag of ['badIdentity','badGuard','changedRoot','extraRoot','extraSide','crossFs','badMarker','badMode','badStagedHash',
 'changedVendor','multipleStock','failedScan','changedBirth','badArgs','failedMaps','lowSpace']) {
 const f=fixture({[flag]:true});
 await assert.rejects(collectDisabledScope(f.backend,f.meta),error=>error.code==='usb_browser_scope_unverified' && !error.message);
}
{
 const f=fixture({lock:true,badLock:true});await assert.rejects(collectDisabledScope(f.backend,f.meta));
}
for(const modify of [m=>{m.command='reboot';},m=>{m.commit_nonce="'; reboot";},m=>{m.descriptor.plan_id="'; reboot";},
 m=>{m.descriptor.files['launch.sh'].sha256='0'.repeat(64);},m=>{m.descriptor.files['bridge-program'].size=true;}]) {
 const f=fixture();modify(f.meta);await assert.rejects(collectDisabledScope(f.backend,f.meta));assert.equal(f.calls.length,0);
}
console.log('Disabled scope: exact root/markers/files/source/proc/space, independent closing reads, known patched variants and fail-closed absence passed');


{
 const f=fixture({lock:true}),native=selected(f),peer=new BrowserChannelPeer(native.link);
 const opening=native.link.selectForReview();assert.equal(native.picked,1,'Original picker activation');await opening;
 const result=await peer.dispatch({id:'1'.repeat(32),operation:'disabled-scope',data:{meta:f.meta}});
 assert.equal(result.ok,true);assert.equal(result.data.kind,'browser_disabled_scope');assert.equal(result.data.own_code_running,false);
 await peer.close();assert.equal(native.closed,1);
}
for(const malformed of [true,false]) {
 const f=fixture({failedMaps:!malformed}),native=selected(f),peer=new BrowserChannelPeer(native.link);await native.link.selectForReview();
 const data=malformed?{meta:f.meta,command:'reboot'}:{meta:f.meta};
 const result=await peer.dispatch({id:'1'.repeat(32),operation:'disabled-scope',data});
 assert.equal(result.ok,false);assert.equal(native.closed,1);if(malformed)assert.equal(f.calls.length,0);
}
console.log('Disabled collector through actual peer/selected NativeChannel: fresh context, fixed reads, refusal/owned cleanup passed');
