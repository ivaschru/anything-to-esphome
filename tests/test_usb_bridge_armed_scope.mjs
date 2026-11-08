/** Explicit armed read state, not a synthetic current disabled Snapshot. */
import assert from 'node:assert/strict';
import {collectArmedBridgeScope,collectStoppedTrialScope,armedBridgeScopeCommands} from '../custom_components/qingping_esphome/frontend/usb-disabled-scope.mjs';
import {bridgeBootCompletion} from '../custom_components/qingping_esphome/frontend/usb-bridge-boot-commands.mjs';
import {disabledScopeFixture} from './fixtures/usb_disabled_scope.mjs';
const marker={size:420,sha256:'a'.repeat(64)};
const original=disabledScopeFixture({lock:true,patched:true,trialMarker:marker});
const before=await collectStoppedTrialScope(original.backend,original.meta,marker);
const done=await bridgeBootCompletion(original.meta.descriptor.plan_id,original.meta.descriptor.plan_sha256,'e'.repeat(32));
function fixture(extra={}) {return disabledScopeFixture({lock:true,patched:true,trialMarker:marker,armed:true,armMarker:done,...extra});}
{
 const f=fixture(),value=await collectArmedBridgeScope(f.backend,f.meta,marker,done);
 assert.equal(value.kind,'browser_bridge_armed_scope');assert(!('disabled_flags' in value));
 assert.deepEqual(value.boot_flags,{bridge_disabled:false,recovery_backup:true,pm_disabled:true});
 assert.deepEqual(value.arm_marker,done);
 const invariant=v=>Object.fromEntries(Object.entries(v).filter(([key])=>!['kind','disabled_flags','boot_flags','arm_marker','data_available_bytes'].includes(key)));
 assert.deepEqual(invariant(value),invariant(before),'The explicit flag transition never masks root/source/stock/vendor replacement');
 assert.equal(f.calls.filter(c=>c.includes('/bridge-next-boot.complete')).length,2);
 const commands=armedBridgeScopeCommands(f.meta);
 assert(commands.guard.includes("stat -c '%a %u %h %s' /data/.esphome-cgs1/disabled.before-next-boot"));
 assert(!commands.guard.includes("stat -c '%a %u %h %s' /data/.esphome-cgs1/disabled\n"));
 assert(!('create' in commands.stage),'Armed stage view exposes no old root-create command');
 assert(!f.calls.some(c=>/(^|\n)(?:rm |mkdir |chmod |kill |reboot|exec |sync(?:\n|$))/.test(c)));
}
for(const option of ['extraRoot','markerWrongHash','markerChanged','armMarkerReadError','armMarkerWrongHash','armMarkerChanged','changedRoot','changedBirth','failedMaps']) {
 const f=fixture({[option]:true});await assert.rejects(collectArmedBridgeScope(f.backend,f.meta,marker,done));
}
for(const invalid of [null,{...done,path:'/other'},{...done,size:true},{...done,sha256:'bad'}]) {
 const f=fixture();await assert.rejects(collectArmedBridgeScope(f.backend,f.meta,marker,invalid));assert.equal(f.calls.length,0);
}
console.log('Explicit armed scope: recovery/PM flags, original two markers, invariant double-pass scope and refusal cases PASS; no IO');
