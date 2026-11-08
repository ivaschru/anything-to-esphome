/** Fixed staged-scope collector, entirely emulated IO; no shell/device. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {BrowserNativeChannel} from '../custom_components/qingping_esphome/frontend/usb-native-channel.mjs';
import {BrowserChannelPeer} from '../custom_components/qingping_esphome/frontend/usb-channel-peer.mjs';
import {collectDisabledScope,disabledScopeCommands} from '../custom_components/qingping_esphome/frontend/usb-disabled-scope.mjs';
import {disabledContract} from '../custom_components/qingping_esphome/frontend/usb-disabled-contract.mjs';
import {contract} from '../custom_components/qingping_esphome/frontend/usb-probe-contract.mjs';
import {STAGE_ROLES} from '../custom_components/qingping_esphome/frontend/usb-stage-files.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const base='/data/.esphome-cgs1';
function stat(pid,parent,start) {
 const fields=Array.from({length:20},()=> '0');fields[0]='S';fields[1]=String(parent);fields[19]=String(start);
 return `${pid} (synthetic ) process) ${fields.join(' ')}\n0\n${pid===50?'/data/bin/SnowApp':'/bin/busybox'}`;
}
function fixture(options={}) {
 const meta={schema_version:1,job_id:'a'.repeat(32),target:{kind:'browser_webusb',wlan_mac:'02:00:00:00:00:01',co2_type:2,
  stock_version:'4.1.8_0287',usb_serial:'synthetic-usb',boot_id:'22222222-2222-2222-2222-222222222222'},
  descriptor:{plan_id:'b'.repeat(32),plan_sha256:'c'.repeat(64),intent_sha256:'d'.repeat(64),
   files:Object.fromEntries(STAGE_ROLES.map(([role])=>[role,{size:17,sha256:disabledContract.sources[role]||'e'.repeat(64)}]))},
  commit_nonce:options.lock?'f'.repeat(32):null};
 const commands=disabledScopeCommands(meta),calls=[];let rootReads=0,scanReads=0,vendorReads=0,identities=0;
 const backend={identity:async target=>{identities++;assert.deepEqual(target,meta.target);return !options.badIdentity;},read:async command=>{
  calls.push(command);
  if(options.badGuard && command.includes(commands.stage.guard))throw Error('synthetic private guard error');
  if(command===commands.root){rootReads++;return '1 '+(options.changedRoot && rootReads>1?'3':'2')+' 700 0';}
  if(command===commands.entries)return [...STAGE_ROLES.map(([,leaf])=>leaf),'install.intent','disabled','pm-helper.disabled',
   ...(options.lock?['.commit-disabled.lock']:[]),...(options.extraRoot?['foreign-file']:[])].join('\n');
  if(command===commands.sideEntries)return options.extraSide?'complete\nintent\nforeign-file':'complete\nintent';
  if(command===commands.lockEntries)return options.badLock?'owner\nforeign-file':'owner';
  if(command===commands.parents)return options.crossFs?'1\n2':'1\n1';
  if(command===commands.stage.inspectComplete)return (options.badMarker?'0'.repeat(64):sha(commands.stage.afterBytes))+'  /data/.esphome-cgs1-stage/complete';
  for(const [role,leaf] of STAGE_ROLES)if(command===commands.stage.inspect(role)) {
   const pin=meta.descriptor.files[role],mode=['bridge-program','launch.sh','SnowApp-with-PM'].includes(role)?'700':'600';
   return `${pin.size} 1 0 ${options.badMode?'777':mode}\n${options.badStagedHash?'0'.repeat(64):pin.sha256}  ${base}/${leaf}`;
  }
  for(const file of contract.files)if(command===file.command) {
   vendorReads++;
   const pin=options.patched || options.changedVendor && vendorReads>contract.files.length?disabledContract.patched[file.path]||file:file;
   return `${pin.size} 1\n${pin.sha256}  ${file.path}`;
  }
  if(command===disabledContract.process_scan){scanReads++;if(options.failedScan)throw Error('synthetic scan printed PID then failed');return options.multipleStock?'50\n51':'50';}
  if(command===commands.process(50))return stat(50,51,options.changedBirth && scanReads>1?101:100);
  if(command===commands.process(51))return stat(51,1,110);
  if(command===commands.watchdog(51)) {if(options.badArgs)throw Error('synthetic private argv');return '';}
  if(command===commands.maps(50)){if(options.failedMaps)throw Error('synthetic unreadable maps');return '';}
  if(command==="stat -f -c '%t %a %S' /data")return options.lowSpace?'ef53 1 4096':'ef53 10000 4096';
  assert.fail('Unknown command; the fixture admits only fixed read operations');
 }};
 return {meta,backend,commands,calls,get identities(){return identities;}};
}
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

function selected(f) {
 const target=f.meta.target,identity={uid:'0',wlan_mac:target.wlan_mac,version:'CLEARGRASS_VERSION=4.1.8_0287',arch:'armv7l',
  co2_type:String(target.co2_type),boot_id:target.boot_id};let closed=0,picked=0;
 const client={close:async()=>{closed++;},createSocket:async service=>{
  assert(service.startsWith('shell:set -e\n'),'No sync/API/writer service');
  const marker=service.match(/__CGS1_CHANNEL_OK_[a-f0-9]+__/)[0],command=service.slice('shell:set -e\n'.length,service.lastIndexOf('\nprintf '));
  const step=contract.identity.find(v=>v.command===command),body=step?identity[step.name]:await f.backend.read(command);
  return {readable:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(body+'\n'+marker+'\n'));c.close();}}),close:async()=>{}};
 }};
 const link=new BrowserNativeChannel({manager:{requestDevice:()=>{picked++;return Promise.resolve({serial:target.usb_serial,connect:async()=>({})});}},
  authenticate:async()=>({}),createClient:()=>client,ephemeralCredentials:()=>({})},contract);
 return {link,get closed(){return closed;},get picked(){return picked;}};
}
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
