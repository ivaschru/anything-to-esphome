/** Complete canonical reads with emulated replies, never a monitor or shell. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {collectBridgeRuntimeScope,validateBridgeObserverContext,bridgeObserverReadParts} from '../custom_components/qingping_esphome/frontend/usb-bridge-observer.mjs';
const f=JSON.parse(execFileSync('python3',['tests/fixtures/monitor1_browser_boot_observer.py'],{encoding:'utf8',maxBuffer:2**20}));
const clone=v=>structuredClone(v);
function backend(change=()=>{}) {
 let i=0,identities=0;
 return {value:{identity:async target=>{assert.deepEqual(target,f.target);identities++;return true;},read:async command=>{
  const row=f.reads[i++];assert.equal(command,row.command,'Exact unchanged native command: '+row.key);
  const value={text:row.reply};change(row.key,value,i);return value.text;
 }},get reads(){return i;},get identities(){return identities;}};
}
validateBridgeObserverContext(f.context);
const b=backend(),scope=await collectBridgeRuntimeScope(b.value,f.context,f.target);
assert.equal(b.reads,64);assert.equal(b.identities,2);assert.equal(scope.target.boot_id,f.target.boot_id);
assert.equal(scope.processes.child[1],scope.processes.supervisor[0]);assert.equal(scope.processes.stock[1],scope.processes.watchdog[0]);
assert.equal(scope.pm_disabled,true);assert.equal(scope.device_writes,0);assert.equal(scope.context_only,true);
assert.equal(scope.canonical_scope_checked,true);
for(const [key,change] of [
 ['root',v=>v.text=v.text.replace('700 0','777 0')],
 ['completion_guard',v=>v.text='unverified'],
 ['armed_flags',()=>{throw Error('synthetic incomplete flag read');}],
 ['vendor_0',v=>v.text=v.text.replace(/[a-f0-9]{64}/,'0'.repeat(64))],
 ['child_image',v=>v.text=v.text.replace('700 0 1','700 0 2')],
 ['supervisor_image',v=>v.text=v.text+'\nextra'],
 ['stock_maps_2',()=>{throw Error('synthetic unreadable maps');}],
 ['endpoint',v=>v.text='/proc/net/tcp 17A5'],
 ['memory',v=>v.text='MemTotal: 131072 kB\nMemFree: 1 kB'],
 ['child_after',v=>v.text=v.text.replace('1900001','1900002')],
 ['lock_after',v=>v.text='1\n2'],
 ['identity_boot_after',v=>v.text='00000000-0000-4000-8000-000000000001']
]) {
 const bad=backend((name,v)=>{if(name===key)change(v);});
 await assert.rejects(collectBridgeRuntimeScope(bad.value,f.context,f.target));
}
for(const target of [{...f.target,boot_id:f.context.arming.context.meta.target.boot_id},{...f.target,usb_serial:'another'}]) {
 const b=backend();await assert.rejects(collectBridgeRuntimeScope(b.value,f.context,target));assert.equal(b.reads,0);
}
const bad=clone(f.context);bad.api_identity.node_name={};assert.throws(()=>validateBridgeObserverContext(bad));
const {reads}=await bridgeObserverReadParts(f.context,f.target);
assert.equal(reads.length,64);
console.log('Canonical complete post-boot scope, process/image/flags/closing-read refusals PASS');
